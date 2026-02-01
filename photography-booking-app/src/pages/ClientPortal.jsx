// src/pages/ClientPortal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { getStorage, ref as sref, getBlob } from "firebase/storage";
import { Helmet } from "react-helmet-async";
import Lightbox from "../components/Lightbox";

const storage = getStorage();

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
  const [lightboxIndex, setLightboxIndex] = useState(null);

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

      const imgsSnap = await getDocs(collection(db, `bookings/${bdoc.id}/images`));
      const imgs = imgsSnap.docs.map((d) => d.data());
      imgs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setImages(imgs);

      const pre = {};
      imgs.forEach((img) => (pre[img.public_id] = true));
      setSelected(pre);
    } catch (e) {
      console.error(e);
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    localStorage.removeItem("clientRef");
    setRefInput("");
    setBooking(null);
    setImages([]);
    setSelected({});
    setErr("");
    setZipping(false);
    setZipProgress(0);
  }

  async function zipAndDownload(files, outName) {
    if (!files.length) {
      alert("No files selected");
      return;
    }
    const TOTAL_LIMIT_MB = 500;
    let approx = 0;
    for (const f of files) approx += f.size || 5_000_000;
    if (approx / (1024 * 1024) > TOTAL_LIMIT_MB) {
      alert(`Selection too large (>${TOTAL_LIMIT_MB}MB). Please select fewer images.`);
      return;
    }
    setZipping(true);
    setZipProgress(0);
    try {
      const zip = new JSZip();
      for (let i = 0; i < files.length; i++) {
        const img = files[i];
        const path = storagePathOf(img);
        if (!path) continue;
        const blob = await getBlob(sref(storage, path));
        zip.file(fileNameFrom(img), blob, { compression: "STORE" });
        setZipProgress(Math.round(((i + 1) / files.length) * 80));
      }
      const zipBlob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } },
        (meta) => setZipProgress(80 + Math.round(meta.percent * 0.2))
      );
      saveAs(zipBlob, outName || "photos.zip");
    } catch (e) {
      console.error(e);
      alert(e.message || "Download failed. Please try again.");
    } finally {
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
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-burgundy/20">
                  <div className="flex items-center gap-4">
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
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
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
                  </div>
                </div>

                {/* Progress bar */}
                {zipping && (
                  <div className="mb-6 h-2 w-full bg-burgundy/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold transition-all duration-300"
                      style={{ width: `${zipProgress}%` }}
                    />
                  </div>
                )}

                {/* Gallery Grid */}
                {images.length > 0 ? (
                  <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                    {images.map((img) => (
                      <div
                        key={img.public_id}
                        className="group relative mb-4 break-inside-avoid overflow-hidden bg-burgundy/5 cursor-pointer"
                        onClick={() => toggleOne(img.public_id)}
                      >
                        <img
                          src={img.secure_url}
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
                ) : (
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
    </>
  );
}
