// src/pages/ClientPortal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db, storage } from "../lib/firebase";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { ref as sref, getDownloadURL, getBlob } from "firebase/storage";
import { openWithFallback, fetchWithStatus } from "../lib/downloadWithRetry";
import { Helmet } from "react-helmet-async";
import Lightbox from "../components/Lightbox";
import { cdnUrl } from "../lib/imageUrl";
import AlbumViewer from "../components/album/AlbumViewer";
import AlbumPage from "../components/album/AlbumPage";
import { resolveTheme } from "../components/album/albumThemes";
// Memoised AlbumPage variant used by the hidden PDF stage. We mutate <img>
// elements in-place during PDF generation; ClientPortal re-renders driven by
// progress state would otherwise clobber those mutations. memo keeps the
// stage stable as long as its props are referentially equal.
const AlbumPagePdf = React.memo(AlbumPage);
import { streamZipDownload } from "../lib/zipDownload";
// albumPdf bundles jsPDF + html2canvas (~400KB). Loaded on demand from
// downloadAlbumAsPdf so portal first paint stays light.

function cls(...xs) { return xs.filter(Boolean).join(" "); }
function upRef(s = "") { return String(s).trim().toUpperCase(); }
function fileNameFrom(img) {
  const rawBase =
    img.original_filename ||
    (img.public_id && img.public_id.split("/").pop()) ||
    (img.secure_url &&
      (decodeURIComponent((img.secure_url.match(/\/o\/([^?]+)/)?.[1] || "")).split("/").pop())) ||
    "image";
  const base = rawBase.replace(/\.(jpe?g|png|webp|heic|heif|gif|tiff?)$/i, "");
  const ext =
    (img.format && String(img.format).toLowerCase()) ||
    (img.secure_url && (img.secure_url.split("?")[0].split(".").pop() || "").toLowerCase()) ||
    "jpg";
  return `${base}.${ext.replace(/[^a-z0-9]/gi, "") || "jpg"}`;
}
function storagePathOf(img) {
  if (img.path || img.storagePath || img.fullPath) return img.path || img.storagePath || img.fullPath;
  const m = String(img.secure_url || "").match(/\/o\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : (img.public_id || null);
}
function parseRefFromUrl() {
  try {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const params = new URLSearchParams(search || (hash.includes("?") ? hash.split("?")[1] : ""));
    return params.get("ref") || "";
  } catch {
    return "";
  }
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const styles = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    finished: "bg-gold/20 text-charcoal border-gold/40",
    canceled: "bg-red-50 text-red-700 border-red-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const labels = {
    confirmed: "Confirmed",
    finished: "Completed",
    canceled: "Canceled",
    pending: "Pending",
  };
  return (
    <span className={cls(
      "inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border",
      styles[s] || styles.pending
    )}>
      {labels[s] || "Pending"}
    </span>
  );
}

export default function ClientPortal() {
  const [headerVisible, setHeaderVisible] = useState(false);
  const [refInput, setRefInput] = useState("");
  const [booking, setBooking] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState({});
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const abortRef = useRef(null);
  // Set between mobile chunked-download parts. UI shows a banner asking
  // the user to tap Continue (iOS requires a fresh user gesture between
  // programmatic downloads).
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [layoutDoc, setLayoutDoc] = useState(null);

  // PDF generation state. `pdfStage` is one of:
  //   null         — idle
  //   "prefetching" — downloading album photos as same-origin blobs
  //   "rendering"   — hidden subtree mounting + waiting for image decode
  //   "capturing"   — html2canvas + jsPDF building pages
  // pdfImagesById is a SWAPPED imagesById whose secure_url fields point at
  // blob: URLs so the captured canvas isn't tainted by cross-origin pixels.
  const [pdfStage, setPdfStage] = useState(null);
  const [pdfProgress, setPdfProgress] = useState({ index: 0, total: 0 });
  const [pdfImagesById, setPdfImagesById] = useState(null);
  const pdfRootRef = useRef(null);
  const pdfPageRefs = useRef([]);

  const imagesById = useMemo(() => {
    const m = new Map();
    for (const it of images || []) m.set(it.public_id, it);
    return m;
  }, [images]);
  const pdfTheme = useMemo(() => resolveTheme(layoutDoc?.theme), [layoutDoc?.theme]);
  // "album" — curated layout view (download = printable PDF)
  // "photos" — flat grid with per-photo selection (download = zip of files)
  const [view, setView] = useState("album");
  const hasAlbum = !!layoutDoc?.pages?.length;
  // If there's no album layout, force the photos tab
  const activeView = hasAlbum ? view : "photos";

  const someChecked = images.some((img) => !!selected[img.public_id]);
  const allChecked = images.length > 0 && images.every((img) => !!selected[img.public_id]);
  const selectedCount = images.filter((img) => !!selected[img.public_id]).length;

  const toggleOne = (pid) => setSelected((s) => ({ ...s, [pid]: !s[pid] }));
  const toggleAll = (checked) => {
    const next = {};
    images.forEach((img) => (next[img.public_id] = checked));
    setSelected(next);
  };

  useEffect(() => {
    setHeaderVisible(true);
    const urlRef = parseRefFromUrl();
    const saved = localStorage.getItem("clientRef") || "";
    const initial = upRef(urlRef || saved);
    if (initial) loginWithRef(initial);
  }, []);

  async function loginWithRef(rawRef) {
    const ref = upRef(rawRef || refInput);
    if (!ref) return;
    setErr("");
    setLoading(true);
    setImages([]);
    setSelected({});
    setBooking(null);

    try {
      const qy = query(collection(db, "bookings"), where("reference", "==", ref), limit(1));
      const bsnap = await getDocs(qy);
      if (bsnap.empty) {
        setErr("Invalid reference code. Please check and try again.");
        setLoading(false);
        return;
      }
      const bdoc = bsnap.docs[0];
      const bdata = { id: bdoc.id, ...bdoc.data() };
      setBooking(bdata);
      localStorage.setItem("clientRef", ref);

      // Fetch images and album layout doc in parallel
      const [imgsSnap, layoutSnap] = await Promise.all([
        getDocs(collection(db, `bookings/${bdoc.id}/images`)),
        getDoc(doc(db, `bookings/${bdoc.id}/albumLayout/main`)).catch(() => null),
      ]);

      const imgs = imgsSnap.docs.map((d) => d.data());
      imgs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setImages(imgs);

      const pre = {};
      imgs.forEach((img) => (pre[img.public_id] = true));
      setSelected(pre);

      setLayoutDoc(layoutSnap && layoutSnap.exists() ? layoutSnap.data() : null);
    } catch (e) {
      console.error(e);
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Build a multi-page PDF of the album by rasterising each AlbumPage at the
  // exact 720x960 design geometry and embedding each page into a jsPDF sized
  // to match. Photos are pre-fetched as blob: URLs first so the canvas isn't
  // cross-origin tainted. See src/lib/albumPdf.js for the capture pipeline.
  async function downloadAlbumAsPdf() {
    const pages = layoutDoc?.pages || [];
    if (!pages.length) {
      alert("No album layout yet.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const blobUrls = [];
    setPdfStage("prefetching");
    setPdfProgress({ index: 0, total: pages.length });

    try {
      // Dynamic-import to keep jsPDF + html2canvas (~400 KB) out of the
      // portal's initial bundle.
      const { generateAlbumPdf, prefetchAsBlobUrls, waitForRendered } =
        await import("../lib/albumPdf");

      // 1. Collect every distinct secure_url referenced by the album layout.
      const used = new Set();
      for (const page of pages) {
        const slots = page.slots || {};
        for (const k of Object.keys(slots)) {
          const pid = slots[k]?.publicId;
          const item = pid ? imagesById.get(pid) : null;
          if (item?.secure_url) used.add(item.secure_url);
        }
      }

      // 2. Pre-fetch as same-origin blob URLs (with EXIF baked into pixels).
      const urlMap = await prefetchAsBlobUrls(Array.from(used), controller.signal);
      for (const v of urlMap.values()) blobUrls.push(v.url);

      // 3. Build a swapped imagesById so AlbumPage receives blob URLs AND
      //    post-normalisation dimensions. The crop math in AlbumPage uses
      //    item.width/item.height; html2canvas will read the bitmap dims.
      //    Feeding the same numbers to both keeps geometry consistent even
      //    if Firestore cached pre-rotation dims from an older upload run.
      const swapped = new Map();
      for (const [pid, item] of imagesById) {
        const entry = item?.secure_url ? urlMap.get(item.secure_url) : null;
        if (entry) {
          swapped.set(pid, {
            ...item,
            secure_url: entry.url,
            width: entry.width || item.width,
            height: entry.height || item.height,
          });
        } else {
          swapped.set(pid, item);
        }
      }

      // 4. Mount the hidden render subtree.
      setPdfImagesById(swapped);
      setPdfStage("rendering");
      // Let React commit, then ensure DOM has flushed.
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 0));

      const root = pdfRootRef.current;
      if (!root) throw new Error("PDF render root missing");
      await waitForRendered(root, controller.signal);

      // 5. Capture each page node.
      setPdfStage("capturing");
      const nodes = pdfPageRefs.current.slice(0, pages.length).filter(Boolean);
      if (nodes.length !== pages.length) {
        throw new Error("Album pages did not all render");
      }

      const safeName =
        (booking?.details?.name || "album")
          .replace(/[^A-Za-z0-9._ -]+/g, "")
          .trim()
          .replace(/\s+/g, "_") || "album";
      await generateAlbumPdf({
        pageNodes: nodes,
        stageRoot: root,
        outName: `${safeName}-album.pdf`,
        signal: controller.signal,
        onProgress: (p) => setPdfProgress(p),
      });
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error(e);
        alert(e.message || "Generating the album PDF failed.");
      }
    } finally {
      blobUrls.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch (_) {}
      });
      abortRef.current = null;
      setPdfStage(null);
      setPdfImagesById(null);
      setPdfProgress({ index: 0, total: 0 });
    }
  }

  function cancelPdf() {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (_) {}
    }
  }

  const pdfStatusText = (() => {
    if (!pdfStage) return "";
    if (pdfStage === "prefetching") return "Loading photos…";
    if (pdfStage === "rendering") return "Composing album…";
    if (pdfStage === "capturing") {
      const { index, total } = pdfProgress;
      return total ? `Rendering page ${index} of ${total}…` : "Rendering pages…";
    }
    return "";
  })();
  const pdfPercent = (() => {
    if (pdfStage === "capturing" && pdfProgress.total) {
      return Math.round((pdfProgress.index / pdfProgress.total) * 100);
    }
    if (pdfStage === "prefetching") return 5;
    if (pdfStage === "rendering") return 15;
    return 0;
  })();

  function signOut() {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (_) {}
      abortRef.current = null;
    }
    localStorage.removeItem("clientRef");
    setRefInput("");
    setBooking(null);
    setImages([]);
    setSelected({});
    setErr("");
    setZipping(false);
    setZipProgress(0);
    setLayoutDoc(null);
  }

  function cancelZip() {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (_) {}
    }
  }

  async function openFileFromImg(img, controller) {
    // Each file is downloaded as a fully-buffered Blob, not a streaming
    // Response. We tried streaming the Response body straight into the zip
    // writer; that had a fatal flaw on flaky networks: `reader.read()` in
    // the middle of a body stream surfaces `ERR_QUIC_PROTOCOL_ERROR` and
    // similar transport blips as `TypeError: network error`, completely
    // bypassing the retry layer (the Response had already been "opened
    // successfully" by then). One in-flight chunk failure killed the whole
    // 1.5 GB zip with no recovery.
    //
    // Buffering to Blob makes each file an atomic unit — either the whole
    // download succeeds (and goes into the zip) or it fails (and we retry
    // / fall back). Peak RAM is ~one file (8–15 MB) at a time, which is
    // negligible compared to what the zip sink already holds.
    //
    //   primary  — Firebase Storage SDK getBlob(). XHR under the hood with
    //              its own internal retry, different transport pool from
    //              fetch — robust to fetch-only failure modes (QUIC blips,
    //              extension XHR shims, service-worker eviction).
    //   fallback — raw fetch().blob(). Useful when SDK init / App Check
    //              is the failing component, since it goes straight to the
    //              pre-signed URL with no SDK middleware in the way.
    //
    // 5 attempts × exponential backoff so transient QUIC + Chrome's HTTP/3
    // → HTTP/2 fallback have time to take effect (~10–15 s total).
    const path = storagePathOf(img);
    let url = img.secure_url;
    if (!url && path) {
      url = await getDownloadURL(sref(storage, path));
    }

    const fetchToBlob = async () => {
      if (!url) throw new Error("No URL available for fallback");
      const res = await fetchWithStatus(url, {
        signal: controller.signal,
        cache: "no-store",
      });
      return await res.blob();
    };

    return openWithFallback({
      maxAttempts: 5,
      primary: path
        ? () => getBlob(sref(storage, path))
        : fetchToBlob,
      fallback: path && url ? fetchToBlob : undefined,
    });
  }

  // Single zip path for all clients. streamZipDownload picks the best sink:
  //   1. showSaveFilePicker (Chromium/Edge/Firefox desktop) — bytes go
  //      straight to disk, RAM flat.
  //   2. StreamSaver service worker (Safari mobile/desktop, iOS Safari) —
  //      same flat-RAM streaming via a same-origin SW + iframe trigger.
  //   3. In-memory Blob (last resort, very old browsers without SW) —
  //      single zip, capped by available RAM but still ONE file.
  //
  // Per-file resilience lives in openFileFromImg (3 fetch retries + SDK
  // getBlob fallback) so transient network/extension issues during the
  // 1.5GB chain don't abort the zip.
  async function zipAndDownload(files, baseOutName) {
    if (!files.length) {
      alert("No files selected");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setZipping(true);
    setZipProgress(0);

    try {
      const result = await streamZipDownload({
        files,
        getName: fileNameFrom,
        openFile: (img) => openFileFromImg(img, controller),
        outName: baseOutName || "photos.zip",
        signal: controller.signal,
        onProgress: ({ index, total }) => {
          setZipProgress(Math.round((index / total) * 100));
        },
      });
      if (result.cancelled) return;
    } catch (e) {
      if (e?.name === "AbortError" || e?.name === "NotAllowedError") return;
      console.error(e);
      alert(e.message || "Download failed. Please try again.");
    } finally {
      abortRef.current = null;
      setZipping(false);
      setZipProgress(0);
    }
  }

  async function downloadSelectedZip() {
    const files = images.filter((i) => !!selected[i.public_id]);
    await zipAndDownload(files, "selected-photos.zip");
  }
  async function downloadAllZip() {
    await zipAndDownload(images, "all-photos.zip");
  }

  const clientName = useMemo(() => booking?.details?.name || "Client", [booking]);
  const whenText = useMemo(() => {
    if (!booking) return "";
    const dt = booking.startAt?.toDate?.();
    return dt
      ? dt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
      : `${booking.date || ""} ${booking.time || ""}`.trim();
  }, [booking]);

  return (
    <>
      <Helmet>
        <title>Client Portal | Lama Wafa Photography</title>
        <meta
          name="description"
          content="Access your photos from your session with Lama Wafa Photography."
        />
        <link rel="canonical" href="https://lamawafa.com/portal" />
      </Helmet>

      <div className="min-h-screen bg-cream">
        {/* Header */}
        <section className="relative bg-burgundy overflow-hidden -mt-16 md:-mt-20 pt-24 md:pt-28 pb-12 md:pb-16">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gold rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div
                className={cls(
                  "transition-all duration-700",
                  headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
              >
                <div className="w-12 h-0.5 bg-gold mb-6" />
                <h1 className="font-serif text-3xl md:text-4xl font-light text-white">
                  {booking ? `Welcome, ${clientName}` : "Client Portal"}
                </h1>
                {booking ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
                    <span className="font-mono bg-white/10 px-3 py-1">{booking.reference}</span>
                    <span>{booking.package?.name}</span>
                    {whenText && <span>{whenText}</span>}
                  </div>
                ) : (
                  <p className="mt-3 text-white/70">
                    Access your photos using your reference code.
                  </p>
                )}
              </div>
              {booking && (
                <div className="flex items-center gap-3">
                  <StatusBadge status={booking.status} />
                  <button
                    onClick={signOut}
                    className="text-white/80 hover:text-white text-sm font-medium transition-colors px-4 py-2 rounded-full border border-white/20 hover:border-white/40"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Login Form */}
            {!booking && (
              <div className="max-w-md mx-auto">
                <div className="bg-white border border-burgundy/10 shadow-soft p-6 md:p-8">
                  <div className="w-12 h-12 bg-gold/20 text-gold flex items-center justify-center mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <h2 className="font-serif text-xl text-charcoal">
                    Enter your reference code
                  </h2>
                  <p className="mt-2 text-sm text-charcoal/60">
                    You received this code when you booked your session.
                  </p>
                  <div className="mt-6 space-y-4">
                    <input
                      type="text"
                      value={refInput}
                      onChange={(e) => setRefInput(e.target.value)}
                      placeholder="e.g., 8F2KQX"
                      className="input text-center text-lg font-mono uppercase tracking-widest"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !loading && refInput.trim()) loginWithRef();
                      }}
                    />
                    <button
                      onClick={() => loginWithRef()}
                      disabled={loading || !refInput.trim()}
                      className={cls(
                        "btn w-full",
                        loading || !refInput.trim()
                          ? "bg-burgundy/20 text-burgundy/50 cursor-not-allowed"
                          : "btn-primary"
                      )}
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          Loading...
                        </>
                      ) : (
                        "Access Photos"
                      )}
                    </button>
                    {err && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                        {err}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Gallery */}
            {booking && (
              <div>
                {/* Tabs (only show when an album layout exists) */}
                {hasAlbum && (
                  <div className="mb-4 flex items-center gap-1 print:hidden" role="tablist" aria-label="View">
                    {[
                      { id: "album", label: "Album" },
                      { id: "photos", label: "Photos" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={activeView === t.id}
                        onClick={() => setView(t.id)}
                        className={cls(
                          "px-5 py-2 text-sm font-medium rounded-full transition-colors",
                          activeView === t.id
                            ? "bg-burgundy text-cream shadow-soft"
                            : "text-charcoal/60 hover:text-burgundy"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Toolbar — controls swap based on the active tab */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-burgundy/20 print:hidden">
                  <div className="flex items-center gap-4">
                    {activeView === "photos" ? (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={!!allChecked}
                            ref={(el) => el && (el.indeterminate = !allChecked && someChecked)}
                            onChange={(e) => toggleAll(e.target.checked)}
                            className="w-5 h-5 rounded border-burgundy/30 text-burgundy focus:ring-gold"
                          />
                          <span className="text-sm text-charcoal/70 group-hover:text-charcoal">
                            Select all
                          </span>
                        </label>
                        {someChecked && (
                          <span className="text-sm text-charcoal/60">
                            {selectedCount} of {images.length} selected
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-charcoal/60">
                        {layoutDoc.pages.length} page{layoutDoc.pages.length === 1 ? "" : "s"} · {images.length} photo{images.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {activeView === "photos" ? (
                      <>
                        <button
                          onClick={downloadSelectedZip}
                          disabled={!someChecked || zipping}
                          className={cls(
                            "btn text-sm",
                            !someChecked || zipping
                              ? "bg-burgundy/10 text-burgundy/40 cursor-not-allowed"
                              : "btn-secondary"
                          )}
                        >
                          {zipping ? `Preparing... ${zipProgress}%` : "Download Selected"}
                        </button>
                        <button
                          onClick={downloadAllZip}
                          disabled={!images.length || zipping}
                          className={cls(
                            "btn text-sm",
                            !images.length || zipping
                              ? "bg-burgundy/10 text-burgundy/40 cursor-not-allowed"
                              : "btn-primary"
                          )}
                        >
                          {zipping ? `Please wait... ${zipProgress}%` : "Download All"}
                        </button>
                        {zipping && (
                          <button
                            onClick={cancelZip}
                            className="btn text-sm border border-burgundy/30 text-burgundy hover:bg-burgundy/5"
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={downloadAlbumAsPdf}
                          disabled={!images.length || !!pdfStage}
                          className={cls(
                            "btn text-sm",
                            !images.length || !!pdfStage
                              ? "bg-burgundy/10 text-burgundy/40 cursor-not-allowed"
                              : "btn-primary"
                          )}
                          title="Saves the album as a PDF, ready to share or print"
                        >
                          {pdfStage
                            ? `${pdfStatusText}${pdfStage === "capturing" ? ` ${pdfPercent}%` : ""}`
                            : "Download Album (PDF)"}
                        </button>
                        {pdfStage && (
                          <button
                            onClick={cancelPdf}
                            className="btn text-sm border border-burgundy/30 text-burgundy hover:bg-burgundy/5"
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar (photos tab only) */}
                {zipping && activeView === "photos" && (
                  <div className="mb-6 h-2 w-full bg-burgundy/10 rounded-full overflow-hidden print:hidden">
                    <div
                      className="h-full bg-gold transition-all duration-300"
                      style={{ width: `${zipProgress}%` }}
                    />
                  </div>
                )}

                {/* Progress bar (album PDF) */}
                {pdfStage && activeView === "album" && (
                  <div className="mb-6 h-2 w-full bg-burgundy/10 rounded-full overflow-hidden print:hidden">
                    <div
                      className="h-full bg-gold transition-all duration-300"
                      style={{ width: `${pdfPercent}%` }}
                    />
                  </div>
                )}

                {/* Album Viewer */}
                {images.length > 0 && hasAlbum && activeView === "album" && (
                  <div className="-mx-4 sm:-mx-6 lg:-mx-8 mb-12 album-print-root">
                    <AlbumViewer
                      items={images}
                      layoutDoc={layoutDoc}
                      selected={selected}
                      onToggleOne={toggleOne}
                      clientName={clientName}
                      subtitle={whenText}
                    />
                  </div>
                )}

                {/* Gallery Grid (photos tab) */}
                {images.length === 0 ? null : activeView === "photos" ? (
                  <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                    {images.map((img) => (
                      <div
                        key={img.public_id}
                        className="group relative mb-4 break-inside-avoid overflow-hidden bg-burgundy/5 cursor-pointer"
                        onClick={() => toggleOne(img.public_id)}
                      >
                        <img
                          src={cdnUrl(img.secure_url, { w: 900, q: 82 })}
                          alt={img.original_filename || "Photo"}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-auto object-cover portfolio-img"
                        />
                        {/* Overlay */}
                        <div className={cls(
                          "absolute inset-0 transition-all duration-200",
                          selected[img.public_id]
                            ? "bg-gold/20"
                            : "bg-transparent group-hover:bg-burgundy/10"
                        )} />
                        {/* Checkbox */}
                        <div className="absolute top-3 left-3">
                          <div
                            className={cls(
                              "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg",
                              selected[img.public_id]
                                ? "bg-gold text-charcoal"
                                : "bg-white/90 text-burgundy/50 group-hover:text-burgundy"
                            )}
                          >
                            {selected[img.public_id] ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                              </svg>
                            )}
                          </div>
                        </div>
                        {/* View in lightbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const idx = images.findIndex(i => i.public_id === img.public_id);
                            setLightboxIndex(idx >= 0 ? idx : 0);
                          }}
                          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-burgundy/60 hover:text-burgundy hover:bg-gold transition-all shadow-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* No photos at all */}
                {images.length === 0 && (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 mx-auto mb-4 bg-burgundy/10 flex items-center justify-center">
                      <svg className="w-8 h-8 text-burgundy/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <h3 className="font-serif text-xl text-charcoal">No photos yet</h3>
                    <p className="mt-2 text-sm text-charcoal/60">
                      Your photos will appear here once they're ready.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images.map(img => ({
            id: img.public_id,
            src: img.secure_url,
            alt: img.original_filename || "Photo"
          }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(index) => setLightboxIndex(index)}
        />
      )}

      {/* Hidden PDF render stage. Mounted only while a PDF is being built;
          rendered at the album's native 720x960 design size and parked
          off-screen so html2canvas can capture each page at its true layout
          regardless of viewport, scroll, or animation state. */}
      {pdfStage && pdfImagesById && layoutDoc?.pages?.length > 0 && (
        <div
          ref={pdfRootRef}
          aria-hidden="true"
          data-pdf-stage="true"
          style={{
            // Parked far above the viewport rather than transformed —
            // html2canvas can mis-position elements whose ancestors have a
            // CSS transform applied. Static negative top is safe.
            position: "fixed",
            left: 0,
            top: -100000,
            width: 720,
            pointerEvents: "none",
            zIndex: -1,
            // Opacity must be 1 so html2canvas captures real pixels.
            opacity: 1,
          }}
        >
          {layoutDoc.pages.map((page, i) => (
            <div
              key={i}
              ref={(el) => { pdfPageRefs.current[i] = el; }}
              style={{
                width: 720,
                height: 960,
                overflow: "hidden",
                backgroundColor: pdfTheme.pageBg,
              }}
            >
              <AlbumPagePdf
                page={page}
                theme={pdfTheme}
                imagesById={pdfImagesById}
                pageNumber={i + 1}
                totalPages={layoutDoc.pages.length}
                shouldLoad={true}
                mode="view"
                side={i % 2 === 0 ? "right" : "left"}
                isPortrait={true}
                hideChrome={false}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
