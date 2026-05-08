// src/lib/albumPdf.js
//
// Builds a multi-page PDF of the client's album by rasterising each rendered
// AlbumPage. The page geometry on screen is 720x960 (3:4); the PDF page is
// sized in points to match exactly, so client text positions, photo crops,
// and the gold edge frame land on the page in the same proportions as the
// digital view.
//
// Images are captured at html2canvas scale=3, giving ~216 DPI at 10x13.33 in
// — comfortable for screen viewing and good-quality print. JPEG q=0.92
// keeps file size in check without visible loss for photographic content.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const PAGE_W_PT = 720;
const PAGE_H_PT = 960;
const CAPTURE_SCALE = 3;
const JPEG_QUALITY = 0.92;

/**
 * Decode a blob with EXIF orientation applied, then re-encode it so the raw
 * bitmap data matches the displayed orientation.
 *
 * Why: html2canvas captures images by drawing the underlying bitmap to a
 * canvas (drawImage). It does NOT honour the EXIF Orientation tag, so a
 * portrait photo with Orientation=6 (most phone portraits) renders sideways
 * even though the on-screen <img> displays correctly. When that sideways
 * bitmap is then forced into a portrait album slot, object-fit: cover crops
 * aggressively in unpredictable ways — the "way-off cropping" symptom.
 *
 * Fix: createImageBitmap with imageOrientation: "from-image" returns a
 * bitmap whose pixels are already in the displayed orientation. Re-encoding
 * via canvas.toBlob produces a new file whose Orientation is implicitly 1.
 * html2canvas then reads pixels in the orientation we expect.
 *
 * @param {Blob} blob
 * @returns {Promise<Blob>} an orientation-normalised JPEG (or the original
 *   blob if normalisation isn't supported / the source isn't a raster image).
 */
async function normalizeOrientation(blob) {
  if (!blob || !blob.type || !blob.type.startsWith("image/")) {
    return { blob, width: 0, height: 0 };
  }
  if (typeof createImageBitmap !== "function") {
    return { blob, width: 0, height: 0 };
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch (_) {
    // Older browsers throw on the imageOrientation option — try plain.
    try {
      bitmap = await createImageBitmap(blob);
    } catch (_) {
      return { blob, width: 0, height: 0 };
    }
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob, width: bitmap.width, height: bitmap.height };
    ctx.drawImage(bitmap, 0, 0);
    const out = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || blob), "image/jpeg", 0.95);
    });
    return { blob: out, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close?.();
  }
}

/**
 * Pre-fetch a set of remote image URLs as same-origin blob: URLs with EXIF
 * orientation baked into the pixel data.
 *
 * @param {string[]} urls
 * @param {AbortSignal} [signal]
 * @returns {Promise<Map<string, {url: string, width: number, height: number}>>}
 *   original URL -> blob URL plus the post-normalisation pixel dimensions.
 *   Callers should override any cached width/height on photo records with
 *   these so the AlbumPage crop math operates on the same dims html2canvas
 *   will see.
 */
export async function prefetchAsBlobUrls(urls, signal) {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const out = new Map();
  const concurrency = 4; // re-encoding is CPU-bound; cap parallelism
  let cursor = 0;
  async function worker() {
    while (cursor < unique.length) {
      if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
      const i = cursor++;
      const url = unique[i];
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`Fetch ${res.status}`);
        const raw = await res.blob();
        const { blob: normalized, width, height } = await normalizeOrientation(raw);
        out.set(url, {
          url: URL.createObjectURL(normalized),
          width,
          height,
        });
      } catch (e) {
        if (e?.name === "AbortError") throw e;
        // Leave this URL absent — the album will render an empty slot
        // rather than abort the whole PDF on one missing photo.
        console.warn("Album PDF prefetch failed for", url, e);
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, unique.length) },
    () => worker()
  );
  await Promise.all(workers);
  return out;
}

/**
 * Wait until every <img> inside the given root has resolved (loaded or
 * errored), and the page's web fonts are ready. html2canvas captures whatever
 * is on screen at the moment it runs, so racing it against image decode
 * produces blank or partially-rendered pages.
 *
 * @param {HTMLElement} root
 * @param {AbortSignal} [signal]
 */
export async function waitForRendered(root, signal) {
  // Fonts first — once they're swapped in, the layout may reflow and any
  // subsequent image-based capture will be at the final geometry.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  if (signal?.aborted) throw new DOMException("cancelled", "AbortError");

  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        };
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    })
  );

  // Two animation frames give Framer/transition opacity-fades a chance to
  // settle so the final captured pixels match the final visual state.
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
}

/**
 * Pre-flatten every <img> in the staged DOM into a bitmap that already
 * contains the exact visible slot region at slot pixel dimensions.
 *
 * Why: html2canvas mishandles object-fit: cover combined with percentage-based
 * width/height/offset on absolutely-positioned <img> elements. Photos render
 * at their natural aspect ratio inside the box (effectively object-fit:
 * contain), leaving empty space where the slot should be filled.
 *
 * What this does for each IMG:
 *   1. Reads the IMG's bounding rect and its parent slot's bounding rect.
 *   2. Maps the slot's visible area back to source-pixel coordinates.
 *   3. drawImage into a fresh canvas at slot pixel dimensions × 3 (DPR).
 *      The canvas pixels are exactly what the slot should show.
 *   4. Swaps the IMG's src to the canvas data URL and resets its CSS to
 *      width:100%; height:100%; left:0; top:0 — no object-fit, no overflow
 *      tricks. html2canvas now just stamps the bitmap onto its target.
 *
 * @param {HTMLElement} stageRoot
 * @param {AbortSignal} [signal]
 */
async function flattenSlotImages(stageRoot, signal) {
  const imgs = Array.from(stageRoot.querySelectorAll("img"));
  // Run sequentially: each pre-render is short, but a long album would
  // otherwise spawn dozens of parallel canvas allocations.
  for (const img of imgs) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    if (!img.complete || !img.naturalWidth || !img.naturalHeight) continue;

    const figure = img.closest("figure");
    if (!figure) continue;
    const slotRect = figure.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    if (slotRect.width <= 0 || slotRect.height <= 0) continue;
    if (imgRect.width <= 0 || imgRect.height <= 0) continue;

    // Map slot's visible region (0,0 .. slotW,slotH) back to source pixels
    // on the IMG's bitmap.
    const imgLeft = imgRect.left - slotRect.left;
    const imgTop = imgRect.top - slotRect.top;
    const naturalToBoxX = img.naturalWidth / imgRect.width;
    const naturalToBoxY = img.naturalHeight / imgRect.height;
    const sx = -imgLeft * naturalToBoxX;
    const sy = -imgTop * naturalToBoxY;
    const sw = slotRect.width * naturalToBoxX;
    const sh = slotRect.height * naturalToBoxY;

    // Clamp to valid source rect — drawImage with sx<0 or sx+sw>natural is
    // browser-defined and has produced empty regions in some implementations.
    const clampedSx = Math.max(0, sx);
    const clampedSy = Math.max(0, sy);
    const clampedSw = Math.min(sw, img.naturalWidth - clampedSx);
    const clampedSh = Math.min(sh, img.naturalHeight - clampedSy);
    if (clampedSw <= 0 || clampedSh <= 0) continue;

    // Output canvas — slot pixel dims × DPR for sharp downstream capture.
    // 3 matches the html2canvas scale we use later.
    const dpr = 3;
    const dx = ((clampedSx - sx) / sw) * slotRect.width * dpr;
    const dy = ((clampedSy - sy) / sh) * slotRect.height * dpr;
    const dw = (clampedSw / sw) * slotRect.width * dpr;
    const dh = (clampedSh / sh) * slotRect.height * dpr;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(slotRect.width * dpr);
    canvas.height = Math.round(slotRect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    try {
      ctx.drawImage(img, clampedSx, clampedSy, clampedSw, clampedSh, dx, dy, dw, dh);
    } catch (e) {
      console.warn("flattenSlotImages: drawImage failed", e);
      continue;
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.94);

    // Swap src and reset positioning. Wait for decode so html2canvas reads
    // a populated bitmap.
    await new Promise((resolve) => {
      const onSettled = () => {
        img.removeEventListener("load", onSettled);
        img.removeEventListener("error", onSettled);
        resolve();
      };
      img.addEventListener("load", onSettled, { once: true });
      img.addEventListener("error", onSettled, { once: true });
      img.src = dataUrl;
    });

    img.style.position = "absolute";
    img.style.left = "0";
    img.style.top = "0";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "fill";
    img.style.objectPosition = "0 0";
    // Defuse the slot's "show only what fits" overflow so html2canvas
    // doesn't second-guess clipping.
    img.style.transform = "none";
  }
}

/**
 * Build a PDF from a list of pre-rendered, fully-loaded HTMLElements.
 * Each node should be styled at exactly PAGE_W_PT x PAGE_H_PT pixels.
 *
 * @param {object} options
 * @param {HTMLElement[]} options.pageNodes
 * @param {string} options.outName
 * @param {(p: {index: number, total: number}) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @param {HTMLElement} [options.stageRoot]
 *   The container holding the pageNodes. If supplied, every <img> inside it
 *   is pre-flattened to the exact slot region before capture (works around
 *   html2canvas's object-fit / percentage-positioning quirks).
 */
export async function generateAlbumPdf({ pageNodes, outName, onProgress, signal, stageRoot }) {
  if (!pageNodes || !pageNodes.length) throw new Error("No pages to render");

  if (stageRoot) {
    await flattenSlotImages(stageRoot, signal);
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [PAGE_W_PT, PAGE_H_PT],
    compress: true,
  });

  for (let i = 0; i < pageNodes.length; i++) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const node = pageNodes[i];

    const canvas = await html2canvas(node, {
      scale: CAPTURE_SCALE,
      backgroundColor: null,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 0,
      logging: false,
      // Disable scroll math: the node is fixed-size and not in view.
      scrollX: 0,
      scrollY: 0,
      windowWidth: PAGE_W_PT,
      windowHeight: PAGE_H_PT,
    });

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

    if (i > 0) pdf.addPage([PAGE_W_PT, PAGE_H_PT], "portrait");
    pdf.addImage(dataUrl, "JPEG", 0, 0, PAGE_W_PT, PAGE_H_PT, undefined, "FAST");

    // Hint to GC by clearing canvas reference; some browsers hold large
    // pixel buffers around otherwise.
    canvas.width = 0;
    canvas.height = 0;

    onProgress?.({ index: i + 1, total: pageNodes.length });
  }

  pdf.save(outName);
}
