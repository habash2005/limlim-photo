import React, { useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

import JSZip from "jszip";
import { saveAs } from "file-saver";


import { Helmet } from "react-helmet-async"

function cls(...xs) { return xs.filter(Boolean).join(" "); }

/* ---------- shared helpers ---------- */
function fileNameFrom(img) {
  const rawBase =
    img.original_filename ||
    (img.public_id && img.public_id.split("/").pop()) ||
    "image";
  const base = rawBase.replace(/\.(jpe?g|png|webp|heic|heif|gif|tiff?)$/i, "");
  const ext =
    (img.format && String(img.format).toLowerCase()) ||
    (img.secure_url && (img.secure_url.split("?")[0].split(".").pop() || "").toLowerCase()) ||
    "jpg";
  return `${base}.${ext.replace(/[^a-z0-9]/gi, "") || "jpg"}`;
}

/* ----------------- SelectableGallery (same look) ----------------- */
function SelectableGallery({ items, selected, onToggle, layout = "masonry" }) {
  if (layout === "masonry") {
    return (
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5">
        {items.map((img) => (
          <figure
            key={img.public_id}
            className="group relative mb-5 break-inside-avoid overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.06)] ring-1 ring-burgundy/10 transition-shadow hover:shadow-[0_14px_38px_rgba(0,0,0,0.10)]"
            title={img.original_filename || img.public_id}
          >
            <img
              src={img.secure_url}
              alt={img.original_filename || img.public_id}
              loading="lazy"
              decoding="async"
              className="w-full h-auto object-cover portfolio-img"
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <label className="absolute top-2 left-2 inline-flex items-center">
              <input
                type="checkbox"
                checked={!!selected[img.public_id]}
                onChange={() => onToggle(img.public_id)}
                className="sr-only"
              />
              <span
                className={cls(
                  "grid place-items-center w-8 h-8 rounded-full text-[12px] font-bold shadow-soft ring-1 transition-colors",
                  selected[img.public_id]
                    ? "bg-wine text-white ring-gold"
                    : "bg-white/95 text-charcoal ring-burgundy/20 hover:bg-gold/20"
                )}
              >
                {selected[img.public_id] ? "✓" : "+"}
              </span>
            </label>

            <a
              className="absolute top-2 right-2 text-[11px] underline decoration-1 text-white/95 hover:text-gold opacity-0 group-hover:opacity-100 transition-opacity"
              href={img.secure_url}
              target="_blank"
              rel="noreferrer"
            >
              Original
            </a>
          </figure>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((img) => (
        <figure
          key={img.public_id}
          className="group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.06)] ring-1 ring-burgundy/10 transition-shadow hover:shadow-[0_14px_38px_rgba(0,0,0,0.10)]"
          title={img.original_filename || img.public_id}
        >
          <div className="aspect-square w-full">
            <img
              src={img.secure_url}
              alt={img.original_filename || img.public_id}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover portfolio-img"
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <label className="absolute top-2 left-2 inline-flex items-center">
            <input
              type="checkbox"
              checked={!!selected[img.public_id]}
              onChange={() => onToggle(img.public_id)}
              className="sr-only"
            />
            <span
              className={cls(
                "grid place-items-center w-8 h-8 rounded-full text-[12px] font-bold shadow-soft ring-1 transition-colors",
                selected[img.public_id]
                  ? "bg-wine text-white ring-gold"
                  : "bg-white/95 text-charcoal ring-burgundy/20 hover:bg-gold/20"
              )}
            >
              {selected[img.public_id] ? "✓" : "+"}
            </span>
          </label>
          <a
            className="absolute top-2 right-2 text-[11px] underline decoration-1 text-white/95 hover:text-gold opacity-0 group-hover:opacity-100 transition-opacity"
            href={img.secure_url}
            target="_blank"
            rel="noreferrer"
          >
            Original
          </a>
        </figure>
      ))}
    </div>
  );
}

export default function ClientGallery() {

  <Helmet>
        <title>Lama Wafa | Raleigh, NC Photographer</title>
        <meta
          name="description"
          content="Lama is a Palestinian photographer based in Raleigh, NC, specializing in events, milestones, and personal portraits." />
        <link rel="canonical" href="https://lamawafa.com/" />
      </Helmet>

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [booking, setBooking] = useState(null);
  const [images, setImages] = useState([]);

  const [selected, setSelected] = useState({});
  const someChecked = images.some((img) => !!selected[img.public_id]);
  const allChecked  = images.length > 0 && images.every((img) => !!selected[img.public_id]);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const toggleOne = (pid) => setSelected((s) => ({ ...s, [pid]: !s[pid] }));
  const toggleAll = (checked) => {
    const next = {};
    images.forEach((img) => (next[img.public_id] = checked));
    setSelected(next);
  };

  async function checkCode() {
    setErr("");
    setLoading(true);
    setBooking(null);
    setImages([]);
    setSelected({});

    try {
      const refCode = code.trim().toUpperCase();
      if (!refCode) {
        setErr("Enter your access code.");
        setLoading(false);
        return;
      }

      const qy = query(collection(db, "bookings"), where("reference", "==", refCode), limit(1));
      const snap = await getDocs(qy);
      if (snap.empty) {
        setErr("Invalid access code. Double-check and try again.");
        setLoading(false);
        return;
      }
      const doc = snap.docs[0];
      const data = doc.data();
      const bookingObj = { id: doc.id, ...data };
      setBooking(bookingObj);

      const imgsSnap = await getDocs(collection(db, `bookings/${doc.id}/images`));
      const imgs = imgsSnap.docs.map((d) => d.data());
      imgs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setImages(imgs);

      const pre = {};
      imgs.forEach((img) => (pre[img.public_id] = true));
      setSelected(pre);
    } catch (e) {
      console.error(e);
      setErr("There was a problem checking your code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCode("");
    setBooking(null);
    setImages([]);
    setSelected({});
    setZipping(false);
    setZipProgress(0);
    setErr("");
  }

  // Zip using saved signed URLs
  async function zipAndDownload(files, outName) {
    if (!files.length) {
      alert("No files selected");
      return;
    }

    const TOTAL_LIMIT_MB = 500;
    let approx = 0;
    for (const f of files) approx += (f.bytes || 5_000_000);
    if (approx / (1024 * 1024) > TOTAL_LIMIT_MB) {
      alert(`Too many or too large files (>${TOTAL_LIMIT_MB}MB). Try fewer at once.`);
      return;
    }

    setZipping(true);
    setZipProgress(0);
    try {
      const zip = new JSZip();

      for (let i = 0; i < files.length; i++) {
        const img = files[i];
        const url = img.secure_url;
        if (!url) continue;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        const blob = await res.blob();

        zip.file(fileNameFrom(img), blob, { compression: "STORE" });
        setZipProgress(Math.round(((i + 1) / files.length) * 80));
      }

      const zipBlob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } },
        (meta) => setZipProgress(80 + Math.round(meta.percent * 0.2))
      );

      saveAs(zipBlob, outName || "gallery.zip");
    } catch (e) {
      console.error(e);
      alert(e.message || "Preparing ZIP failed.");
    } finally {
      setZipping(false);
      setZipProgress(0);
    }
  }

  async function downloadSelectedZip() {
    const files = images.filter((i) => !!selected[i.public_id]);
    await zipAndDownload(files, "selected-images.zip");
  }
  async function downloadAllZip() {
    await zipAndDownload(images, "all-images.zip");
  }

  const headerTitle = useMemo(() => {
    if (!booking) return "Client Gallery";
    const name = booking?.details?.name || "Client";
    return `${name} — ${booking.reference}`;
  }, [booking]);

  return (
    <section className="w-full py-16 md:py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-burgundy">
          {headerTitle}
        </h2>

        {/* Step 1: Access form */}
        {!booking && (
          <div className="mt-6 max-w-md space-y-3">
            <p className="text-charcoal/70">Enter your access code to view your photos.</p>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access code"
              className="w-full rounded-xl border border-burgundy/20 px-3 py-2 bg-white focus:border-burgundy focus:ring-gold/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && code.trim()) checkCode();
              }}
            />
            <button
              onClick={checkCode}
              disabled={loading || !code.trim()}
              className={cls(
                "rounded-full px-5 py-3 text-sm font-semibold shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-gold",
                loading || !code.trim()
                  ? "bg-burgundy/10 text-charcoal/50 cursor-not-allowed"
                  : "bg-wine text-white hover:bg-maroon"
              )}
            >
              {loading ? "Checking…" : "Open Gallery"}
            </button>
            {err && <div className="text-sm text-wine">{err}</div>}
          </div>
        )}

        {/* Step 2: Grid + actions */}
        {booking && (
          <div className="mt-8">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-serif text-xl text-charcoal">
                  {booking?.details?.name || "Client"} ({booking.reference})
                </h3>
                <div className="text-xs text-charcoal/60">
                  {booking.date} {booking.time} • {booking.package?.name}
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
                  className={cls(
                    "rounded-full px-4 py-2 text-sm font-semibold shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-gold",
                    !someChecked || zipping ? "bg-burgundy/10 text-charcoal/50" : "bg-wine text-white hover:bg-maroon"
                  )}
                >
                  {zipping ? `Preparing… ${zipProgress}%` : "Download Selected"}
                </button>

                <button
                  onClick={downloadAllZip}
                  disabled={!images.length || zipping}
                  className={cls(
                    "rounded-full px-4 py-2 text-sm font-semibold shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-gold",
                    !images.length || zipping ? "bg-burgundy/10 text-charcoal/50" : "bg-gold text-charcoal hover:bg-wine hover:text-white"
                  )}
                >
                  {zipping ? `Please wait… ${zipProgress}%` : "Download All"}
                </button>

                <button onClick={reset} className="text-sm underline text-charcoal/70 hover:text-burgundy">
                  Use a different code
                </button>
              </div>
            </div>

            {zipping && (
              <div className="mt-3 h-2 w-full bg-burgundy/10 rounded-full overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${zipProgress}%` }} />
              </div>
            )}

            {images.length > 0 ? (
              <div className="mt-6">
                <SelectableGallery
                  layout="masonry"   // 👈 Lens-style masonry
                  items={images}
                  selected={selected}
                  onToggle={(pid) => setSelected((s) => ({ ...s, [pid]: !s[pid] }))}
                />
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
