// src/pages/ClientGallery.jsx
import React, { useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const CLOUD_NAME = "lamaphoto"; // your Cloudinary cloud name

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ORIGINAL download URL (no transforms), as an attachment
function originalDownloadUrl(publicId, format) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/fl_attachment/${publicId}.${format}`;
}

// Build selected ids from *current* state (prevents stale reads)
function getSelectedIds(images, selectedMap) {
  return images.filter((i) => !!selectedMap[i.public_id]).map((i) => i.public_id);
}

export default function ClientGallery() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [gallery, setGallery] = useState(null);  // { name, slug, tag, ... }
  const [images, setImages] = useState([]);
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
      // 1) fetch galleries from Firestore
      const snap = await getDocs(collection(db, "galleries"));
      const galleries = snap.docs.map((d) => d.data());

      // 2) verify code
      const hash = await sha256(code.trim());
      const match = galleries.find((g) => g.codeHash === hash);

      if (!match) {
        setErr("Invalid access code. Double-check and try again.");
        setLoading(false);
        return;
      }
      setGallery(match);

      // 3) fetch images from Cloudinary Asset Lists (tag must match)
      try {
        const res = await fetch(
          `https://res.cloudinary.com/${CLOUD_NAME}/image/list/${match.tag}.json`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const imgs = data.resources || [];
        setImages(imgs);

        // preselect all
        const pre = {};
        imgs.forEach((img) => (pre[img.public_id] = true));
        setSelected(pre);
      } catch (imgErr) {
        console.error(imgErr);
        setErr(
          "Could not load images. Make sure Cloudinary ‘Asset lists’ are enabled and your photos are tagged with the gallery tag."
        );
      }
    } catch (e) {
      console.error(e);
      setErr("There was a problem checking your code. Please try again.");
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

  function toggleOne(publicId) {
    setSelected((s) => ({ ...s, [publicId]: !s[publicId] }));
  }
  function toggleAll(checked) {
    const next = {};
    images.forEach((img) => (next[img.public_id] = checked));
    setSelected(next);
  }

  // Core ZIP helper
  async function zipByPublicIds(ids, filename) {
    setZipping(true);
    try {
      const resp = await fetch("/.netlify/functions/cloudinary-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_ids: ids, filename }),
      });
      const text = await resp.text();                 // robust parse
      const data = text ? JSON.parse(text) : {};
      if (!resp.ok) {
        console.error("Archive error detail:", data);
        throw new Error(data?.detail?.message || data?.error || "Cloudinary error");
      }
      window.location.assign(data.url);
    } catch (e) {
      console.error(e);
      alert(e.message || "Download failed. Please try again.");
    } finally {
      setZipping(false);
    }
  }

  async function downloadSelectedZip() {
    const ids = getSelectedIds(images, selected);
    if (!ids.length) return;
    await zipByPublicIds(ids, "selected-images.zip");
  }

  async function downloadAllZip() {
    const ids = images.map((i) => i.public_id);
    if (!ids.length) return;
    await zipByPublicIds(ids, "all-images.zip");
  }

  return (
    <section className="w-full py-16 md:py-24 bg-ivory">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-charcoal">
          Client Gallery
        </h2>

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
                <div className="text-xs text-charcoal/60">
                  Tag: <code>{gallery.tag}</code>
                </div>
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
                    !someChecked || zipping
                      ? "bg-blush text-charcoal/50"
                      : "bg-rose text-ivory hover:bg-gold hover:text-charcoal"
                  }`}
                >
                  {zipping ? "Preparing…" : "Download Selected"}
                </button>

                <button
                  onClick={downloadAllZip}
                  disabled={!images.length || zipping}
                  className={`rounded-full px-4 py-2 text-sm font-semibold shadow-md ${
                    !images.length || zipping
                      ? "bg-blush text-charcoal/50"
                      : "bg-gold text-charcoal hover:bg-rose hover:text-ivory"
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
                  const previewSrc = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,g_auto,f_auto,q_auto,w_800,h_800/${img.public_id}.${img.format}`;
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
