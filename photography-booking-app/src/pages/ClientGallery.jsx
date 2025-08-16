// src/pages/ClientGallery.jsx
import React, { useState } from "react";
import { db } from "../lib/firebase";
import { saveAs } from "file-saver";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

const CLOUD_NAME = "lamaphoto"; // Cloudinary cloud name

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Original download URL (no transforms), forced as attachment
function originalDownloadUrl(publicId, format) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/fl_attachment/${publicId}.${format}`;
}

export default function ClientGallery() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [gallery, setGallery] = useState(null); // { id, name, slug, tag, ... }
  const [images, setImages] = useState([]);     // [{ public_id, format, ... }]
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState({});
  const [zipping, setZipping] = useState(false);

  const checkCode = async () => {
    setErr("");
    setLoading(true);
    setGallery(null);
    setImages([]);
    setSelected({});

    try {
      // 1) load galleries
      const snap = await getDocs(collection(db, "galleries"));
      const galleries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 2) verify code
      const hash = await sha256(code.trim());
      const match = galleries.find((g) => g.codeHash === hash);
      if (!match) {
        setErr("Invalid access code. Double-check and try again.");
        setLoading(false);
        return;
      }
      setGallery(match);

      // 3) fetch images from Firestore subcollection
      const imagesCol = collection(db, `galleries/${match.id}/images`);
      const qy = query(imagesCol, orderBy("createdAt", "asc"));
      const imgsSnap = await getDocs(qy);
      const imgs = imgsSnap.docs.map((d) => d.data());

      if (imgs.length === 0) {
        setErr(`No images found for gallery "${match.name}". Make sure you uploaded with this gallery selected.`);
      } else {
        setErr("");
      }
      setImages(imgs);

      // preselect all
      const pre = {};
      imgs.forEach((img) => { pre[img.public_id] = true; });
      setSelected(pre);
    } catch (e) {
      console.error(e);
      setErr("There was a problem opening your gallery. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCode("");
    setGallery(null);
    setImages([]);
    setSelected({});
    setZipping(false);
    setErr("");
  };

  const allChecked = images.length > 0 && images.every((img) => !!selected[img.public_id]);
  const someChecked = images.some((img) => !!selected[img.public_id]);

  const toggleOne = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const toggleAll = (checked) => {
    const next = {};
    images.forEach((img) => (next[img.public_id] = checked));
    setSelected(next);
  };

  // ZIP originals via server (streams a zip back as binary)
  async function zipItems(items, filename) {
    setZipping(true);
    try {
      const resp = await fetch("/.netlify/functions/zip-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, filename }),
      });

      const contentType = resp.headers.get("content-type") || "";
      if (resp.ok && contentType.includes("application/zip")) {
        // It's the ZIP file itself — save it
        const blob = await resp.blob();
        saveAs(blob, filename || "photos.zip");
        return;
      }

      // Otherwise, try to read a JSON error payload
      const text = await resp.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      throw new Error(data?.error || `Archive failed (${resp.status})`);
    } catch (e) {
      console.error(e);
      alert(e.message || "Download failed. Please try again.");
    } finally {
      setZipping(false);
    }
  }

  const downloadSelectedZip = async () => {
    const items = images
      .filter((i) => !!selected[i.public_id])
      .map((i) => ({ public_id: i.public_id, format: i.format }));
    if (!items.length) return;
    await zipItems(items, "selected-images.zip");
  };

  const downloadAllZip = async () => {
    const items = images.map((i) => ({ public_id: i.public_id, format: i.format }));
    if (!items.length) return;
    await zipItems(items, "all-images.zip");
  };

  return (
    <section className="w-full py-16 md:py-24 bg-ivory">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-charcoal">Client Gallery</h2>

        {/* Step 1: Access form */}
        {!gallery && (
          <div className="mt-6 max-w-md space-y-3">
            <p className="text-charcoal/70">Enter your access code to view your photos.</p>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access code"
              className="w-full rounded-xl border border-rose/30 px-3 py-2 bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && code.trim()) checkCode();
              }}
            />
            <button
              onClick={checkCode}
              disabled={loading || !code.trim()}
              className={`rounded-full px-5 py-3 text-sm font-semibold shadow-md transition-all ${
                loading || !code.trim()
                  ? "bg-blush text-charcoal/50 cursor-not-allowed"
                  : "bg-rose text-ivory hover:bg-gold hover:text-charcoal"
              }`}
            >
              {loading ? "Checking…" : "Open Gallery"}
            </button>
            {err && <div className="text-sm text-red-700">{err}</div>}
          </div>
        )}

        {/* Step 2: Gallery grid + download controls */}
        {gallery && (
          <div className="mt-8">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-serif text-xl text-charcoal">{gallery.name}</h3>
                <div className="text-xs text-charcoal/60">Tag: <code>{gallery.tag}</code></div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!allChecked}
                    ref={(el) => el && (el.indeterminate = !allChecked && someChecked)}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  Select all
                </label>

                <button
                  onClick={downloadSelectedZip}
                  disabled={!someChecked || zipping}
                  className={`rounded-full px-4 py-2 text-sm font-semibold shadow-md ${
                    !someChecked || zipping ? "bg-blush text-charcoal/50" : "bg-rose text-ivory hover:bg-gold hover:text-charcoal"
                  }`}
                >
                  {zipping ? "Preparing…" : "Download Selected"}
                </button>

                <button
                  onClick={downloadAllZip}
                  disabled={!images.length || zipping}
                  className={`rounded-full px-4 py-2 text-sm font-semibold shadow-md ${
                    !images.length || zipping ? "bg-blush text-charcoal/50" : "bg-gold text-charcoal hover:bg-rose hover:text-ivory"
                  }`}
                >
                  {zipping ? "Please wait…" : "Download All"}
                </button>

                <button onClick={reset} className="text-sm underline text-charcoal/70 hover:text-rose">
                  Use a different code
                </button>
              </div>
            </div>

            {images.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((img) => {
                  // Fast preview (transformed). Downloads use originals.
                  const previewSrc =
                    `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,g_auto,f_auto,q_auto,w_800,h_800/${img.public_id}.${img.format}`;
                  return (
                    <figure key={img.public_id} className="overflow-hidden rounded-xl shadow-sm hover:shadow-lg transition-shadow">
                      <img
                        src={previewSrc}
                        alt={img.public_id}
                        loading="lazy"
                        className="w-full aspect-square object-cover transition-transform duration-200 hover:scale-[1.01]"
                      />
                      <figcaption className="flex items-center justify-between px-3 py-2 text-xs bg-white/70">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!selected[img.public_id]}
                            onChange={() => toggleOne(img.public_id)}
                          />
                          <span className="truncate max-w-[10rem]">
                            {img.public_id.split("/").pop()}
                          </span>
                        </label>
                        {/* Single original download (no transforms) */}
                        <a
                          className="underline text-charcoal/70 hover:text-rose"
                          href={originalDownloadUrl(img.public_id, img.format)}
                          title="Download original"
                        >
                          Original
                        </a>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 text-charcoal/60">No images yet for this gallery.</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
