// src/pages/AdminUpload.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const CLOUD_NAME = "lamaphoto";              // <-- your cloud name
const UPLOAD_PRESET = "lamaphoto_unsigned";  // <-- unsigned preset (Asset folder MUST be blank)

export default function AdminUpload() {
  const [mode, setMode] = useState("portfolio"); // "portfolio" | "client"
  const [galleries, setGalleries] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Load gallery list (read-only)
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
        console.error("[AdminUpload] Failed to fetch galleries:", e);
        setMsg("Couldn’t load galleries (you can still upload to Portfolio).");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => galleries.find((g) => g.id === selectedId) || null,
    [galleries, selectedId]
  );

  const openWidget = useCallback(() => {
    if (!window.cloudinary || !window.cloudinary.createUploadWidget) {
      setMsg("Upload widget not loaded yet. Refresh and try again.");
      console.warn("[AdminUpload] Cloudinary widget script not found.");
      return;
    }

    const isPortfolio = mode === "portfolio";

    // ----- Folder (since preset's Asset folder is blank) -----
    // Keep folders simple and consistent. Do NOT include a leading slash.
    const folder = isPortfolio
      ? "portfolio"
      : selected
      ? `client-galleries/${selected.slug || selected.id}`
      : "";

    if (!isPortfolio && !selected) {
      setMsg("Pick a client gallery first.");
      return;
    }

    // ----- Tags -----
    // Portfolio uploads use "portfolio". Client uploads use the gallery tag for grouping.
    const tags = isPortfolio ? ["portfolio"] : [selected.tag];

    setMsg("");

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,   // unsigned preset with **no Asset folder** set
        folder,                        // we control the folder from the app (Option 1)
        tags,                          // keep your gallery/tag linkage
        multiple: true,
        sources: ["local", "camera", "url", "google_drive", "dropbox"],
        clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
        maxFileSize: 20_000_000,       // 20 MB per file
        // IMPORTANT: keep originals — do NOT add any "Incoming Transformations" to the preset
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
          setMsg(error?.message || "Upload error — see console.");
          return;
        }

        if (result?.event === "success") {
          const info = result.info; // Cloudinary asset info
          const where = isPortfolio ? "Portfolio" : (selected?.name || "Gallery");

          // ✅ Option 1: No Firestore write (pure Cloudinary).
          // Your Client Gallery page can load via Cloudinary by tag or folder,
          // or you can re-enable the Firestore write below.

          // 🔓 OPTIONAL — If you later re-enable Firestore metadata writes, move your
          // security rules to allow the admin and then uncomment this block:
          //
          // try {
          //   if (!isPortfolio && selected?.id) {
          //     const imgCol = collection(db, `galleries/${selected.id}/images`);
          //     const imgDoc = doc(imgCol);
          //     await setDoc(imgDoc, {
          //       public_id: info.public_id,
          //       format: info.format,
          //       bytes: info.bytes,
          //       width: info.width,
          //       height: info.height,
          //       secure_url: info.secure_url,
          //       original_filename: info.original_filename,
          //       version: info.version,
          //       tag: selected.tag,
          //       createdAt: serverTimestamp(),
          //     });
          //   }
          // } catch (e) {
          //   console.error("[AdminUpload] Firestore write failed:", e);
          //   // Non-blocking: the upload succeeded; metadata is optional.
          // }

          setMsg(`✅ Uploaded to ${where}: ${info.original_filename}`);
        }
      }
    );

    widget.open();
  }, [mode, selected]);

  return (
    <section className="w-full py-16 md:py-24 bg-ivory">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-charcoal">
          Admin Upload
        </h2>
        <p className="text-charcoal/70 mt-1">
          Upload to the public <strong>Portfolio</strong> or pick a <strong>Client Gallery</strong>.
        </p>

        {/* Mode toggle */}
        <div className="mt-6 flex gap-4 items-center">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="portfolio"
              checked={mode === "portfolio"}
              onChange={() => setMode("portfolio")}
            />
            <span>Portfolio</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="client"
              checked={mode === "client"}
              onChange={() => setMode("client")}
            />
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
              {!loading &&
                galleries.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} — {g.slug} ({g.tag})
                  </option>
                ))}
            </select>
            {!loading && galleries.length === 0 && (
              <div className="text-xs text-charcoal/70 mt-2">
                Create one in the “New Gallery” box above, then come back.
              </div>
            )}
          </div>
        )}

        {/* Upload button */}
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
          Preset: <code>{UPLOAD_PRESET}</code> (Unsigned, Asset folder blank) ·
          Folder used:{" "}
          <code>
            {mode === "portfolio"
              ? "portfolio"
              : selected
              ? `client-galleries/${selected.slug || selected.id}`
              : "—"}
          </code>{" "}
          · Tags:{" "}
          <code>{mode === "portfolio" ? "portfolio" : selected?.tag || "—"}</code>
        </div>
      </div>
    </section>
  );
}
