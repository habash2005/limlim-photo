// src/pages/AdminUpload.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "../lib/firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { ref as sRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { uploadWithRetry, TRANSIENT_CODES } from "../lib/uploadWithRetry";

const ADMIN_EMAIL = "lamawafa13@gmail.com";
const MAX_SIZE = 100 * 1024 * 1024;            // 100 MB per file (was 25 MB)
const BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "";
const CONCURRENCY = 3;                          // parallel uploads (was 4)
const PER_FILE_RETRIES = 3;                     // attempts per file on transient errors

// Bump the SDK's per-upload retry window from 2 min default to 10 min, and the
// per-operation (metadata fetch etc.) window from 2 min to 5 min. In Firebase
// v9 modular, these are properties on the storage instance, not free functions.
try {
  storage.maxUploadRetryTime = 10 * 60 * 1000;
  storage.maxOperationRetryTime = 5 * 60 * 1000;
} catch (e) {
  console.warn("Could not raise storage retry windows:", e?.message || e);
}

/* utils */
const cls = (...xs) => xs.filter(Boolean).join(" ");
const toSlug = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const randomId = (len = 8) => Math.random().toString(36).slice(2, 2 + len);
const extOf = (name = "") => (name.split(".").pop() || "jpg").toLowerCase();
const fileKeyOf = (f) => `${f.name}|${f.size}|${f.lastModified}`;

function formatBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}
async function getImageDims(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function AdminUpload() {
  const fileInputRef = useRef(null);
  const clientDropRef = useRef(null);
  const listRef = useRef(null);

  const [me, setMe] = useState(null);
  const notAdmin = !me || me.email !== ADMIN_EMAIL;

  const [mode, setMode] = useState("client"); // "client" | "portfolio"

  // bookings for client selector
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [openClientList, setOpenClientList] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);

  // keyboard highlight index
  const [highlighted, setHighlighted] = useState(0);

  // files + progress
  const [files, setFiles] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [queue, setQueue] = useState([]); // rows shown immediately
  const [busy, setBusy] = useState(false);

  /* auth */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u || null));
    return () => unsub();
  }, []);

  /* load bookings */
  useEffect(() => {
    (async () => {
      try {
        setLoadingBookings(true);
        let snap;
        try {
          snap = await getDocs(
            query(collection(db, "bookings"), orderBy("startAt", "desc"), limit(200))
          );
        } catch {
          snap = await getDocs(
            query(collection(db, "bookings"), orderBy("createdAt", "desc"), limit(200))
          );
        }
        const rows = snap.docs.map((d) => {
          const data = d.data();
          const dt = data.startAt?.toDate?.() || null;
          return {
            id: d.id,
            reference: data.reference || "",
            name: data.details?.name || "",
            email: data.details?.email || "",
            phone: data.details?.phone || "",
            date: data.date || "",
            time: data.time || "",
            start: dt,
            status: (data.status || "").toLowerCase(),
          };
        });
        setBookings(rows);
      } catch {
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    })();
  }, []);

  // close dropdown if clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!openClientList) return;
      if (clientDropRef.current && !clientDropRef.current.contains(e.target)) {
        setOpenClientList(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openClientList]);

  // wheel-scrolling even when hovering the header/button area
  useEffect(() => {
    const el = clientDropRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!openClientList) return;
      if (!listRef.current) return;
      e.preventDefault();
      listRef.current.scrollTop += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [openClientList]);

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      return (
        b.reference.toLowerCase().includes(q) ||
        (b.name || "").toLowerCase().includes(q) ||
        (b.email || "").toLowerCase().includes(q) ||
        (b.phone || "").toLowerCase().includes(q) ||
        (b.date || "").toLowerCase().includes(q) ||
        (b.time || "").toLowerCase().includes(q) ||
        (b.status || "").toLowerCase().includes(q)
      );
    });
  }, [search, bookings]);

  // keep highlighted within bounds when list changes
  useEffect(() => {
    if (highlighted >= filtered.length) setHighlighted(Math.max(0, filtered.length - 1));
  }, [filtered, highlighted]);

  // ensure active option is visible
  useEffect(() => {
    if (!openClientList || !listRef.current) return;
    const list = listRef.current;
    const active = list.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [highlighted, openClientList]);

  /* seed queue so rows show immediately */
  const seedQueueForFiles = (newFiles) => {
    setQueue((prev) => {
      const prevKeys = new Set(prev.map((q) => fileKeyOf(q.file)));
      const additions = [];
      for (const f of newFiles) {
        const k = fileKeyOf(f);
        if (prevKeys.has(k)) continue;
        additions.push({
          id: `${Date.now()}_${randomId(7)}`,
          file: f,
          status: "queued",
          progress: 0,
          bytesTransferred: 0,
          totalBytes: f.size || 0,
          url: "",
          error: "",
          task: null,
        });
      }
      return additions.length ? [...prev, ...additions] : prev;
    });
  };

  const acceptFiles = (list) => {
    const ok = [];
    const bad = [];
    const existing = new Set(files.map(fileKeyOf));
    for (const f of list) {
      const key = fileKeyOf(f);
      if (existing.has(key)) continue;
      if (!f.type?.startsWith("image/")) {
        bad.push({ name: f.name, size: f.size, reason: "Not an image" });
        continue;
      }
      if (f.size > MAX_SIZE) {
        bad.push({ name: f.name, size: f.size, reason: "Over 25MB" });
        continue;
      }
      ok.push(f);
      existing.add(key);
    }
    if (ok.length) {
      setFiles((prev) => [...prev, ...ok]);
      seedQueueForFiles(ok);
    }
    if (bad.length) setRejected((prev) => [...prev, ...bad]);
  };

  const onPick = (e) => acceptFiles(Array.from(e.target.files || []));
  const onDrop = (e) => {
    e.preventDefault();
    acceptFiles(Array.from(e.dataTransfer.files || []));
  };
  const onBrowse = () => fileInputRef.current?.click();

  /* ---------- Storage preflight: probe the SAME directory as the real upload ---------- */
  async function storagePreflight(currentMode, refCode) {
    try {
      const blob = new Blob(["ok"], { type: "text/plain" });

      const dir =
        currentMode === "client" && refCode ? `clients/${refCode}` : "portfolio";

      const testRef = sRef(storage, `${dir}/__preflight_${Date.now()}.txt`);
      const task = uploadBytesResumable(testRef, blob, {
        contentType: "text/plain",
        cacheControl: "public,max-age=60",
      });

      await new Promise((resolve, reject) => {
        task.on("state_changed", null, reject, resolve);
      });

      await getDownloadURL(testRef);
    } catch (e) {
      const msg = String(e?.message || e);
      const m = msg.toLowerCase();
      let hint = "";
      if (m.includes("appcheck")) {
        hint =
          "App Check token missing/invalid. Confirm App Check is initialized and your site key allows limlim.netlify.app.";
      } else if (m.includes("unauthorized") || m.includes("forbidden")) {
        hint =
          "Storage rules blocked the write. Ensure admin auth + rules allow writes to this path.";
      } else if (m.includes("failed to fetch")) {
        hint =
          "CORS/preflight blocked. Verify CORS is set on limlim-32e6a.firebasestorage.app and the request URL hits that bucket (not appspot).";
      }
      throw new Error(hint ? `${msg}\n\n${hint}` : msg);
    }
  }

  /* portfolio doc (optional) */
  async function getOrCreatePortfolioDoc() {
    const qy = query(collection(db, "galleries"), where("tag", "==", "portfolio"), limit(1));
    const snap = await getDocs(qy);
    if (!snap.empty) return snap.docs[0].ref;

    const newRef = doc(collection(db, "galleries"));
    await setDoc(newRef, {
      name: "Portfolio",
      slug: toSlug("Portfolio"),
      tag: "portfolio",
      codeHash: randomId(16),
      createdAt: serverTimestamp(),
    });
    return newRef;
  }

  /* run a single upload attempt — used inside the retry loop in uploadOne */
  function uploadOnce({ item, file, path, attempt, totalAttempts }) {
    return new Promise((resolve) => {
      const objRef = sRef(storage, path);
      const task = uploadBytesResumable(objRef, file, {
        contentType: file.type || "image/jpeg",
        cacheControl: "public,max-age=31536000,immutable",
      });

      setQueue((q) =>
        q.map((qit) =>
          qit.id === item.id
            ? {
                ...qit,
                status: "uploading",
                task,
                attempt,
                error: attempt > 1 ? `Retry ${attempt}/${totalAttempts}…` : "",
              }
            : qit
        )
      );

      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setQueue((q) =>
            q.map((qit) =>
              qit.id === item.id
                ? {
                    ...qit,
                    progress: pct,
                    bytesTransferred: snap.bytesTransferred,
                    totalBytes: snap.totalBytes,
                  }
                : qit
            )
          );
        },
        (err) => resolve({ ok: false, error: err }),
        () => resolve({ ok: true, snapshot: task.snapshot })
      );
    });
  }

  /* upload one — wraps uploadOnce in the testable retry helper */
  async function uploadOne({ item, basePath, imagesCollectionPath, extraDocFields }) {
    const file = item.file;
    const id = `${Date.now()}_${randomId(6)}`;
    const path = `${basePath}/${id}.${extOf(file.name)}`;

    const retryResult = await uploadWithRetry({
      maxAttempts: PER_FILE_RETRIES,
      attempt: (attemptN, total) =>
        uploadOnce({ item, file, path, attempt: attemptN, totalAttempts: total }).then((r) =>
          r.ok ? { ok: true, value: r.snapshot } : { ok: false, error: r.error }
        ),
    });

    if (!retryResult.ok) {
      const lastErr = retryResult.error;
      setQueue((q) =>
        q.map((qit) =>
          qit.id === item.id
            ? {
                ...qit,
                status: "error",
                error: String(lastErr?.message || lastErr || "Upload failed"),
              }
            : qit
        )
      );
      return { ok: false, error: lastErr, file };
    }

    // Upload succeeded — finalize Firestore doc + UI state
    try {
      const url = await getDownloadURL(retryResult.value.ref);
      const { width, height } = await getImageDims(file);

      if (imagesCollectionPath) {
        const imagesCol = collection(db, imagesCollectionPath);
        const docId = path.replace(/\//g, "__");
        await setDoc(doc(imagesCol, docId), {
          public_id: path,
          format: extOf(file.name),
          bytes: file.size,
          width,
          height,
          secure_url: url,
          original_filename: file.name,
          version: 1,
          createdAt: serverTimestamp(),
          ...extraDocFields,
        });
      }

      setQueue((q) =>
        q.map((qit) =>
          qit.id === item.id
            ? { ...qit, status: "done", progress: 100, url, error: "" }
            : qit
        )
      );
      return { ok: true, url };
    } catch (err) {
      setQueue((q) =>
        q.map((qit) =>
          qit.id === item.id
            ? { ...qit, status: "error", error: String(err?.message || err) }
            : qit
        )
      );
      return { ok: false, error: err, file };
    }
  }

  /* submit */
  async function onUpload() {
    if (notAdmin) return alert("You must be signed in as the admin to upload.");
    if (queue.length === 0) return alert("Pick some image files first.");
    if (mode === "client" && !selectedBooking) return alert("Choose a client reference first.");

    // Preflight: probe the exact folder (and reflect failure in the UI rows)
    try {
      await storagePreflight(mode, selectedBooking?.reference);
    } catch (e) {
      console.error("[Storage preflight]", e);
      setQueue((q) =>
        q.map((it) =>
          it.status === "queued" || it.status === "uploading"
            ? { ...it, status: "error", error: `Preflight failed: ${e.message}` }
            : it
        )
      );
      alert(e.message || "Storage preflight failed.");
      return;
    }

    setBusy(true);

    try {
      let basePath = "";
      let imagesCollectionPath = "";
      let extraDocFields = {};

      if (mode === "client") {
        basePath = `clients/${selectedBooking.reference}`;
        imagesCollectionPath = `bookings/${selectedBooking.id}/images`;
        extraDocFields = { ref: selectedBooking.reference };
      } else {
        basePath = `portfolio`;
        const galRef = await getOrCreatePortfolioDoc();
        imagesCollectionPath = `galleries/${galRef.id}/images`;
        extraDocFields = { tag: "portfolio" };
      }

      const itemsToUpload = queue.filter(
        (it) => it.status === "queued" || it.status === "error"
      );
      if (itemsToUpload.length === 0) {
        alert("Nothing to upload (all files are done).");
        return;
      }

      // Clear previous error states to queued
      setQueue((q) =>
        q.map((it) =>
          it.status === "error" ? { ...it, status: "queued", progress: 0, error: "" } : it
        )
      );

      const batches = chunk(itemsToUpload, CONCURRENCY);
      let successCount = 0;
      let failCount = 0;

      for (const group of batches) {
        const res = await Promise.all(
          group.map((it) =>
            uploadOne({
              item: it,
              basePath,
              imagesCollectionPath,
              extraDocFields,
            })
          )
        );
        successCount += res.filter((r) => r.ok).length;
        failCount += res.filter((r) => !r.ok).length;
      }

      alert(
        `Uploaded ${successCount} file${successCount === 1 ? "" : "s"}${
          failCount ? `, ${failCount} failed` : ""
        }.`
      );
    } catch (e) {
      console.error("[AdminUpload] Error:", e);
      alert(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  /* overall progress */
  const overall = useMemo(() => {
    const totals = queue.reduce(
      (acc, it) => {
        const tb = it.totalBytes || it.file?.size || 0;
        const bt = it.bytesTransferred || (it.status === "done" ? tb : 0);
        return { total: acc.total + tb, done: acc.done + bt };
      },
      { total: 0, done: 0 }
    );
    return totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
  }, [queue]);

  const totalSize = useMemo(() => files.reduce((s, f) => s + (f.size || 0), 0), [files]);

  /* UI */
  return (
    <section className="p-4 md:p-5">
      {/* status */}
      <div className="mb-3 grid grid-cols-1 gap-2">
        <div
          className={cls(
            "text-xs rounded-lg px-3 py-2",
            notAdmin ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-700"
          )}
        >
          {notAdmin
            ? "Not signed in as admin (lamawafa13@gmail.com). Uploads will be blocked by rules."
            : `Signed in as ${me?.email}.`}
        </div>
        <div className="text-[11px] rounded-lg px-3 py-2 bg-slate-50 text-slate-600">
          Bucket: <code>{BUCKET || "(not set)"}</code>
        </div>
      </div>

      {/* destination + client picker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:items-end">
        <div className="lg:col-span-3">
          <label className="block text-sm font-medium text-charcoal/80 mb-1">Destination</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="dest"
                value="client"
                checked={mode === "client"}
                onChange={() => setMode("client")}
              />
              Client (by reference)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="dest"
                value="portfolio"
                checked={mode === "portfolio"}
                onChange={() => setMode("portfolio")}
              />
              Portfolio
            </label>
          </div>
          <p className="mt-1 text-xs text-charcoal/50">
            Client uploads appear in their portal (reference code).
          </p>
        </div>

        {/* client selector */}
        <div className="lg:col-span-5" ref={clientDropRef}>
          <label className="block text-sm font-medium text-charcoal/80 mb-1">
            {mode === "client" ? "Choose client by reference" : "Client (disabled in Portfolio mode)"}
          </label>

          <div className="relative">
            <button
              type="button"
              disabled={mode !== "client" || loadingBookings}
              onClick={() => {
                setOpenClientList((o) => !o);
                setHighlighted(0);
              }}
              className={cls(
                "w-full rounded-2xl border border-rose/30 bg-white px-4 py-2.5 text-left",
                mode !== "client" || loadingBookings ? "text-charcoal/40" : "text-charcoal"
              )}
              title={mode !== "client" ? "Switch to Client destination to choose" : ""}
            >
              {loadingBookings
                ? "Loading clients…"
                : mode !== "client"
                ? "Portfolio selected"
                : selectedBooking
                ? `${selectedBooking.reference} • ${selectedBooking.name || "Client"}`
                : "Select a client"}
            </button>

            {openClientList && mode === "client" && (
              <div className="absolute z-10 mt-2 w-full rounded-2xl border border-rose/30 bg-white shadow-lg">
                <div className="p-2">
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setHighlighted(0);
                    }}
                    onKeyDown={(e) => {
                      if (!filtered.length) return;
                      const last = filtered.length - 1;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlighted((i) => (i >= last ? last : i + 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlighted((i) => (i <= 0 ? 0 : i - 1));
                      } else if (e.key === "PageDown") {
                        e.preventDefault();
                        setHighlighted((i) => Math.min(i + 5, last));
                      } else if (e.key === "PageUp") {
                        e.preventDefault();
                        setHighlighted((i) => Math.max(i - 5, 0));
                      } else if (e.key === "Home") {
                        e.preventDefault();
                        setHighlighted(0);
                      } else if (e.key === "End") {
                        e.preventDefault();
                        setHighlighted(last);
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const pick = filtered[highlighted];
                        if (pick) {
                          setSelectedBooking(pick);
                          setOpenClientList(false);
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setOpenClientList(false);
                      }
                    }}
                    placeholder="Search by ref, name, email…"
                    className="w-full rounded-xl border border-rose/30 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div ref={listRef} className="max-h-80 overflow-y-auto overscroll-contain p-1">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-charcoal/60">No matches.</div>
                  ) : (
                    filtered.map((b, i) => {
                      const when = b.start
                        ? b.start.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                        : `${b.date} ${b.time}`;
                      const isActive = i === highlighted;
                      const statusColor =
                        b.status === "canceled"
                          ? "text-rose"
                          : b.status === "confirmed"
                          ? "text-emerald-600"
                          : "text-slate-500";
                      return (
                        <button
                          key={b.id}
                          type="button"
                          data-active={isActive ? "true" : "false"}
                          className={cls(
                            "w-full text-left px-3 py-2 text-sm rounded-md",
                            isActive ? "bg-ivory/90" : "hover:bg-ivory/70"
                          )}
                          onMouseEnter={() => setHighlighted(i)}
                          onClick={() => {
                            setSelectedBooking(b);
                            setOpenClientList(false);
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{b.reference}</div>
                            <div className={cls("text-xs", statusColor)}>●</div>
                          </div>
                          <div className="text-xs text-charcoal/70 truncate">
                            {b.name || "Client"} — {when}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {mode === "client" && selectedBooking && (
            <p className="mt-1 text-xs text-emerald-700">
              Selected: {selectedBooking.name || "Client"} ({selectedBooking.reference})
            </p>
          )}
        </div>

        {/* Dropzone */}
        <div
          className="lg:col-span-4 rounded-2xl border-2 border-dashed border-rose/30 bg-ivory/60 px-4 py-4 text-center hover:border-rose/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,image/heic,image/heif"
            multiple
            onChange={onPick}
            className="sr-only"
          />
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onBrowse}
              className="rounded-full bg-rose px-4 py-2 text-ivory hover:bg-gold hover:text-charcoal transition shadow"
            >
              Browse files
            </button>
            <span className="text-sm text-charcoal/60">…or drag & drop images here</span>
            <span className="text-xs text-charcoal/50">Max 25MB each · JPG, PNG, HEIC</span>
          </div>
        </div>
      </div>

      {/* Lists + actions */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8">
          {files.length > 0 ? (
            <div className="rounded-xl bg-white ring-1 ring-rose/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-charcoal/80">
                  {files.length} file{files.length > 1 ? "s" : ""} selected
                </p>
                <p className="text-xs text-charcoal/50">Total ~ {formatBytes(totalSize)}</p>
              </div>
              <ul className="mt-2 max-h-40 overflow-auto space-y-1 text-sm">
                {files.map((f, i) => (
                  <li
                    key={f.name + f.size + i}
                    className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-ivory/60"
                    title={f.name}
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-charcoal/50">
                      {formatBytes(f.size)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-charcoal/50">No files selected yet.</p>
          )}

          {rejected.length > 0 && (
            <div className="mt-3 rounded-xl bg-rose-50 ring-1 ring-rose/20 p-3">
              <div className="text-sm font-medium text-rose-800">
                {rejected.length} file{rejected.length > 1 ? "s" : ""} were skipped:
              </div>
              <ul className="mt-1 text-xs text-rose-800/90 space-y-1">
                {rejected.map((r, i) => (
                  <li key={r.name + r.size + i}>
                    {r.name} — {r.reason} ({formatBytes(r.size)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="md:col-span-4 flex flex-col md:items-end gap-2">
          <button
            type="button"
            onClick={() => {
              setFiles([]);
              setRejected([]);
              setQueue([]);
            }}
            disabled={(files.length === 0 && rejected.length === 0 && queue.length === 0) || busy}
            className="rounded-full px-4 py-2 text-sm font-semibold text-charcoal/70 hover:text-rose underline disabled:text-charcoal/30"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onUpload}
            disabled={busy || queue.length === 0 || notAdmin || (mode === "client" && !selectedBooking)}
            className={cls(
              "rounded-full px-5 py-3 text-sm font-semibold shadow-md transition",
              busy || queue.length === 0 || notAdmin || (mode === "client" && !selectedBooking)
                ? "bg-blush text-charcoal/50 cursor-not-allowed"
                : "bg-gold text-charcoal hover:bg-rose hover:text-ivory"
            )}
            title={
              notAdmin
                ? "Sign in as the admin first"
                : mode === "client" && !selectedBooking
                ? "Choose a client"
                : "Upload"
            }
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      {/* progress */}
      {queue.length > 0 && (
        <div className="mt-6 rounded-xl bg-white ring-1 ring-rose/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-charcoal/70">
              Overall progress: <span className="font-semibold text-charcoal">{overall}%</span>
            </div>
            <div className="text-xs text-charcoal/50">
              {queue.filter((i) => i.status === "done").length}/{queue.length} done
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blush/40">
            <div className="h-full bg-rose transition-all" style={{ width: `${overall}%` }} />
          </div>

          <ul className="mt-4 space-y-2">
            {queue.map((it) => (
              <li key={it.id} className="rounded-lg border border-rose/20 p-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-charcoal">
                      {it.file?.name}
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-blush/30">
                      <div
                        className={cls(
                          "h-full transition-all",
                          it.status === "done"
                            ? "bg-gold"
                            : it.status === "error"
                            ? "bg-red-500"
                            : "bg-rose"
                        )}
                        style={{ width: `${it.progress || 0}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-charcoal/60">
                      {it.status === "uploading" && `${it.progress || 0}%`}
                      {it.status === "done" && "Uploaded ✓"}
                      {it.status === "error" && `Error: ${it.error}`}
                      {it.status === "queued" && "Queued"}
                    </div>
                  </div>
                  {it.url ? (
                    <a
                      className="shrink-0 text-xs underline text-charcoal/70 hover:text-rose"
                      href={it.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="shrink-0 text-[11px] text-charcoal/50">
                      {it.status === "uploading" ? "…" : it.status === "error" ? "Retry later" : ""}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
