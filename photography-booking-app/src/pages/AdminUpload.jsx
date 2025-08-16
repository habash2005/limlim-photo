// src/pages/AdminUpload.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";

const CLOUD_NAME = "lamaphoto";
const UPLOAD_PRESET = "lamaphoto_unsigned"; // make sure this preset has NO incoming transformations

export default function AdminUpload() {
  const [mode, setMode] = useState("portfolio"); // "portfolio" | "client"
  const [galleries, setGalleries] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, "galleries"));
        if (cancelled) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setGalleries(list);
        if (list.length) setSelectedId(list[0].id);
      } catch (e) {
        console.error("[AdminUpload] Firestore galleries fetch failed:", e);
        setMsg("Couldn’t load galleries. You can still upload to Portfolio.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(
    () => galleries.find((g) => g.id === selectedId) || null,
    [galleries, selectedId]
  );

  const openWidget = useCallback(() => {
    if (!window.cloudinary) {
      setMsg("Upload widget not loaded yet. Try again in a second.");
      console.warn("[AdminUpload] window.cloudinary is undefined.");
      return;
    }

    const isPortfolio = mode === "portfolio";
    const tag   = isPortfolio ? "portfolio" : selected?.tag;
    const folder = isPortfolio ? "portfolio" : "client-galleries";

    if (!isPortfolio && !tag) {
      setMsg("Pick a client gallery first.");
      return;
    }

    setMsg("");

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        folder,
        tags: [tag],                 // ← ensures tag is on the asset
        multiple: true,
        sources: ["local", "camera", "url", "google_drive", "dropbox"],
        clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
        maxFileSize: 20_000_000,
        styles: {
          palette: {
            window: "#FFF8F0",
            sourceBg: "#ffffff",
            windowBorder: "#F4A6A6",
            tabIcon: "#F4A6A6",
            menuIcons: "#333333",
            textDark: "#333333",
            link: "#F4A6A6",
            action: "#D4AF37",
            inProgress: "#F4A6A6",
            complete: "#D4AF37",
            error: "#ff4b4b",
          },
        },
      },
      async (error, result) => {
        if (error) {
          console.error("[AdminUpload] Upload error:", error);
          setMsg("Upload error — see console.");
          return;
        }
        if (result?.event === "success") {
          const info = result.info; // Cloudinary asset info
          const where = isPortfolio ? "Portfolio" : (selected?.name || "Gallery");

          // Write metadata only for client galleries so ClientGallery can read them.
          try {
            if (!isPortfolio && selected?.id) {
              const imgCol = collection(db, `galleries/${selected.id}/images`);
              const imgDoc = doc(imgCol);
              await setDoc(imgDoc, {
                public_id: info.public_id,            // e.g. client-galleries/abcd1234
                format: info.format,                  // jpg/png/webp
                bytes: info.bytes,
                width: info.width,
                height: info.height,
                secure_url: info.secure_url,          // original delivery (no transforms)
                original_filename: info.original_filename,
                version: info.version,
                tag,                                   // gallery tag
                createdAt: serverTimestamp(),
              });
            }
            setMsg(`✅ Uploaded to ${where}: ${info.original_filename}`);
          } catch (e) {
            console.error("[AdminUpload] Firestore write failed:", e);
            setMsg("Uploaded to Cloudinary, but failed to save to Firestore.");
          }
        }
      }
    );

    widget.open();
  }, [mode, selected]);

  return (
    <section className="w-full py-16 md:py-24 bg-ivory">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-charcoal">Admin Upload</h2>
        <p className="text-charcoal/70 mt-1">Upload to the public <strong>Portfolio</strong> or pick a <strong>Client Gallery</strong>.</p>

        {/* Mode toggle */}
        <div className="mt-6 flex gap-4 items-center">
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="portfolio" checked={mode === "portfolio"} onChange={() => setMode("portfolio")} />
            <span>Portfolio</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="client" checked={mode === "client"} onChange={() => setMode("client")} />
            <span>Client Gallery</span>
          </label>
        </div>

        {/* Client gallery picker */}
        {mode === "client" && (
          <div className="mt-4">
            <label className="text-sm font-medium text-charcoal">Select gallery</label>
            <select
              className="mt-2 w-full rounded-xl border border-rose/30 px-3 py-2 bg-white"
              disabled={loading || galleries.length === 0}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {loading && <option>Loading…</option>}
              {!loading && galleries.length === 0 && <option>No galleries found</option>}
              {!loading && galleries.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {g.slug} ({g.tag})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Upload */}
        <div className="mt-6">
          <button
            onClick={openWidget}
            className="rounded-full px-5 py-3 text-sm font-semibold shadow-md bg-rose text-ivory hover:bg-gold hover:text-charcoal transition-all"
          >
            {mode === "portfolio" ? "Upload to Portfolio" : "Upload to Selected Gallery"}
          </button>
        </div>

        {msg && <div className="mt-3 text-sm text-charcoal">{msg}</div>}

        <div className="mt-4 text-xs text-charcoal/70">
          Portfolio uploads use tag <code>portfolio</code>. Client uploads use the gallery’s tag (
          <code>{mode === "client" ? (galleries.find((g) => g.id === selectedId)?.tag || "gal-&lt;slug&gt;") : "portfolio"}</code>).
        </div>
      </div>
    </section>
  );
}
