import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  autoPackToLayout,
  createBlankPage,
  changeTemplate as schemaChangeTemplate,
  hashLayout,
  pageReactKey,
  setTextValue,
  setTextStyleField,
} from "../components/album/layoutSchema";
import { resolveTheme } from "../components/album/albumThemes";

import PhotoBin from "../components/album/editor/PhotoBin";
import PageCanvas from "../components/album/editor/PageCanvas";
import PageThumbStrip from "../components/album/editor/PageThumbStrip";
import Inspector from "../components/album/editor/Inspector";
import AlbumHero from "../components/album/AlbumHero";
import { getTemplate } from "../components/album/albumTemplates";

// Lazy-load CropModal so react-easy-crop ships only when the user opens it.
const CropModal = lazy(() => import("../components/album/editor/CropModal"));

// Page is rendered at 720×960 logical units (3:4 portrait).
const PAGE_W = 720;
const PAGE_H = 960;

export default function AdminAlbumEditor() {
  const { bookingId } = useParams();

  const [booking, setBooking] = useState(null);
  const [images, setImages] = useState([]);
  const [layout, setLayout] = useState(null);
  const [initialHash, setInitialHash] = useState("");
  const [serverUpdatedAt, setServerUpdatedAt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [selectedSlotKey, setSelectedSlotKey] = useState(null);
  const [selectedTextKey, setSelectedTextKey] = useState(null);
  const [pickedPhoto, setPickedPhoto] = useState(null);
  const [isAlbumMode, setIsAlbumMode] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedToast, setSavedToast] = useState(false);

  const [cropModalSlot, setCropModalSlot] = useState(null);

  // Load booking + images + (optional) layout doc
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        // Parallelize the three reads: booking, images, layout doc.
        const [bsnap, imgsSnap, lsnap] = await Promise.all([
          getDoc(doc(db, "bookings", bookingId)),
          getDocs(collection(db, `bookings/${bookingId}/images`)),
          getDoc(doc(db, `bookings/${bookingId}/albumLayout/main`)).catch((e) => {
            console.warn("Layout read failed:", e?.code || e?.message);
            return null;
          }),
        ]);

        if (!bsnap.exists()) {
          setLoadError("Booking not found.");
          setLoading(false);
          return;
        }
        const bdata = { id: bsnap.id, ...bsnap.data() };

        const imgs = imgsSnap.docs.map((d) => d.data());
        imgs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        let layoutDoc = null;
        let updatedAt = null;
        if (lsnap && lsnap.exists()) {
          layoutDoc = lsnap.data();
          updatedAt = layoutDoc.updatedAt;
        }

        const startingLayout = layoutDoc || autoPackToLayout(imgs);

        if (!cancelled) {
          setBooking(bdata);
          setImages(imgs);
          setLayout(startingLayout);
          setInitialHash(hashLayout(startingLayout));
          setServerUpdatedAt(updatedAt);
          setSelectedPageIndex(0);
          setSelectedSlotKey(null);
          setSelectedTextKey(null);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLoadError(e?.message || "Failed to load booking.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const imagesById = useMemo(() => {
    const m = new Map();
    for (const it of images || []) m.set(it.public_id, it);
    return m;
  }, [images]);

  const usageCount = useMemo(() => {
    const m = new Map();
    if (!layout) return m;
    for (const page of layout.pages) {
      for (const slot of Object.values(page.slots || {})) {
        if (slot?.publicId) {
          m.set(slot.publicId, (m.get(slot.publicId) || 0) + 1);
        }
      }
    }
    return m;
  }, [layout]);

  const theme = useMemo(() => resolveTheme(layout?.theme), [layout?.theme]);
  const currentPage = layout?.pages?.[selectedPageIndex] || null;
  const isDirty = layout && hashLayout(layout) !== initialHash;

  // ---------- mutations ----------

  const updateLayout = useCallback((mutator) => {
    setLayout((prev) => {
      if (!prev) return prev;
      const next = mutator(prev);
      return next || prev;
    });
  }, []);

  const updatePage = useCallback(
    (index, patch) => {
      updateLayout((prev) => ({
        ...prev,
        pages: prev.pages.map((p, i) =>
          i === index ? { ...p, ...patch } : p
        ),
      }));
    },
    [updateLayout]
  );

  const handleAddPage = useCallback(() => {
    updateLayout((prev) => {
      const newPage = createBlankPage("single-bleed");
      return { ...prev, pages: [...prev.pages, newPage] };
    });
    setTimeout(() => {
      setSelectedPageIndex(layout?.pages?.length || 0);
      setSelectedSlotKey(null);
      setSelectedTextKey(null);
    }, 0);
  }, [updateLayout, layout?.pages?.length]);

  const handleDuplicatePage = useCallback(
    (index) => {
      updateLayout((prev) => {
        const src = prev.pages[index];
        if (!src) return prev;
        const copy = {
          ...src,
          id: `p_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`,
          slots: JSON.parse(JSON.stringify(src.slots || {})),
          texts: { ...(src.texts || {}) },
        };
        const next = [...prev.pages];
        next.splice(index + 1, 0, copy);
        return { ...prev, pages: next };
      });
    },
    [updateLayout]
  );

  const handleDeletePage = useCallback(
    (index) => {
      if (!confirm("Delete this page?")) return;
      updateLayout((prev) => {
        const next = prev.pages.filter((_, i) => i !== index);
        return { ...prev, pages: next };
      });
      setSelectedPageIndex((i) => Math.max(0, i - (i >= index ? 1 : 0)));
      setSelectedSlotKey(null);
      setSelectedTextKey(null);
    },
    [updateLayout]
  );

  const handleMovePage = useCallback(
    (from, to) => {
      if (from === to) return;
      updateLayout((prev) => {
        if (to < 0 || to >= prev.pages.length) return prev;
        const next = [...prev.pages];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...prev, pages: next };
      });
      setSelectedPageIndex(to);
    },
    [updateLayout]
  );

  const handleChangeTemplate = useCallback(
    (templateId) => {
      updateLayout((prev) => {
        const next = [...prev.pages];
        next[selectedPageIndex] = schemaChangeTemplate(next[selectedPageIndex], templateId);
        return { ...prev, pages: next };
      });
    },
    [updateLayout, selectedPageIndex]
  );

  const handleAssignPhoto = useCallback(
    (slotKey, publicId) => {
      updatePage(selectedPageIndex, {
        slots: {
          ...(currentPage?.slots || {}),
          [slotKey]: {
            publicId,
            focal: { x: 0.5, y: 0.5 },
            zoom: 1,
          },
        },
      });
      setSelectedSlotKey(slotKey);
      setPickedPhoto(null);
    },
    [updatePage, selectedPageIndex, currentPage]
  );

  const handleClearSlot = useCallback(
    (slotKey) => {
      updatePage(selectedPageIndex, {
        slots: {
          ...(currentPage?.slots || {}),
          [slotKey]: null,
        },
      });
    },
    [updatePage, selectedPageIndex, currentPage]
  );

  const handleEditCrop = useCallback((slotKey) => {
    setCropModalSlot(slotKey);
  }, []);

  const handleCropSave = useCallback(
    (cropData) => {
      if (cropModalSlot == null) return;
      const slot = currentPage?.slots?.[cropModalSlot];
      if (!slot?.publicId) {
        setCropModalSlot(null);
        return;
      }
      updatePage(selectedPageIndex, {
        slots: {
          ...(currentPage?.slots || {}),
          [cropModalSlot]: {
            ...slot,
            crop: cropData,
          },
        },
      });
      setCropModalSlot(null);
    },
    [cropModalSlot, currentPage, selectedPageIndex, updatePage]
  );

  const handleCropCancel = useCallback(() => setCropModalSlot(null), []);

  // Compute slot aspect ratio for the cropper.
  const cropAspect = useMemo(() => {
    if (cropModalSlot == null || !currentPage) return 1;
    const tpl = getTemplate(currentPage.templateId);
    const idx = parseInt(cropModalSlot, 10);
    const geom = tpl.slots[idx];
    if (!geom) return 1;
    return (geom.w * PAGE_W) / (geom.h * PAGE_H);
  }, [cropModalSlot, currentPage]);

  const cropImageUrl = useMemo(() => {
    if (cropModalSlot == null || !currentPage) return null;
    const slot = currentPage.slots?.[cropModalSlot];
    if (!slot?.publicId) return null;
    return imagesById.get(slot.publicId)?.secure_url || null;
  }, [cropModalSlot, currentPage, imagesById]);

  const cropInitial = useMemo(() => {
    if (cropModalSlot == null || !currentPage) return null;
    return currentPage.slots?.[cropModalSlot]?.crop || null;
  }, [cropModalSlot, currentPage]);

  const handleSetGutter = useCallback(
    (g) => {
      updatePage(selectedPageIndex, { gutter: g });
    },
    [updatePage, selectedPageIndex]
  );

  const handleSetCaption = useCallback(
    (textKey, value) => {
      const prev = currentPage?.texts?.[textKey];
      updatePage(selectedPageIndex, {
        texts: {
          ...(currentPage?.texts || {}),
          [textKey]: setTextValue(prev, value),
        },
      });
    },
    [updatePage, selectedPageIndex, currentPage]
  );

  const handleSetTextStyle = useCallback(
    (textKey, field, value) => {
      const prev = currentPage?.texts?.[textKey];
      updatePage(selectedPageIndex, {
        texts: {
          ...(currentPage?.texts || {}),
          [textKey]: setTextStyleField(prev, field, value),
        },
      });
    },
    [updatePage, selectedPageIndex, currentPage]
  );

  const handleSetPageOverride = useCallback(
    (field, value) => {
      const prev = currentPage?.themeOverride || {};
      const next = { ...prev };
      if (value === null || value === undefined || value === "") {
        delete next[field];
      } else {
        next[field] = value;
      }
      updatePage(selectedPageIndex, {
        themeOverride: Object.keys(next).length ? next : null,
      });
    },
    [updatePage, selectedPageIndex, currentPage]
  );

  const handleSetTheme = useCallback(
    (themeBlock) => {
      updateLayout((prev) => ({
        ...prev,
        theme: { ...prev.theme, ...themeBlock },
      }));
    },
    [updateLayout]
  );

  const handleSetCover = useCallback(
    (field, value) => {
      updateLayout((prev) => {
        const cover = { ...(prev.theme?.cover || {}) };
        if (value === null || value === undefined || value === "") {
          delete cover[field];
        } else {
          cover[field] = value;
        }
        return {
          ...prev,
          theme: {
            ...prev.theme,
            cover: Object.keys(cover).length ? cover : null,
          },
        };
      });
    },
    [updateLayout]
  );

  const handleSlotClick = useCallback(
    (slotKey) => {
      setSelectedTextKey(null);
      // if a photo is "picked" via tap-to-place, drop it here
      if (pickedPhoto) {
        handleAssignPhoto(slotKey, pickedPhoto);
        return;
      }
      setSelectedSlotKey(slotKey);
    },
    [pickedPhoto, handleAssignPhoto]
  );

  const handleTextEdit = useCallback((textKey) => {
    setSelectedSlotKey(null);
    setSelectedTextKey(textKey);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedSlotKey(null);
    setSelectedTextKey(null);
  }, []);

  const handleSelectPage = useCallback((index) => {
    setIsAlbumMode(false);
    setSelectedPageIndex(index);
    setSelectedSlotKey(null);
    setSelectedTextKey(null);
  }, []);

  const handleSelectAlbum = useCallback(() => {
    setIsAlbumMode(true);
    setSelectedSlotKey(null);
    setSelectedTextKey(null);
  }, []);

  const handlePickPhoto = useCallback((pid) => {
    setPickedPhoto((p) => (p === pid ? null : pid));
  }, []);

  // ---------- save ----------

  const handleSave = useCallback(async () => {
    if (!layout) return;
    setSaving(true);
    setSaveError("");
    try {
      const lref = doc(db, `bookings/${bookingId}/albumLayout/main`);

      // Race check is best-effort — failures here (e.g. transient offline)
      // must NOT block the save itself.
      try {
        const fresh = await getDoc(lref);
        if (fresh.exists() && serverUpdatedAt) {
          const freshTs = fresh.data().updatedAt;
          const ourMs = serverUpdatedAt?.toMillis?.() || serverUpdatedAt?.seconds * 1000;
          const freshMs = freshTs?.toMillis?.() || freshTs?.seconds * 1000;
          if (freshMs && ourMs && freshMs > ourMs) {
            if (
              !confirm(
                "Layout was modified elsewhere since you opened this editor. Overwrite anyway?"
              )
            ) {
              setSaving(false);
              return;
            }
          }
        }
      } catch (raceErr) {
        console.warn("Skipping race check:", raceErr?.code || raceErr?.message);
      }

      await setDoc(
        lref,
        {
          ...layout,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || null,
        },
        { merge: false }
      );

      setInitialHash(hashLayout(layout));
      // refetch to capture new updatedAt — also best-effort
      try {
        const re = await getDoc(lref);
        if (re.exists()) setServerUpdatedAt(re.data().updatedAt);
      } catch {}
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2200);
    } catch (e) {
      console.error(e);
      setSaveError(e?.message || "Failed to save layout.");
    } finally {
      setSaving(false);
    }
  }, [layout, bookingId, serverUpdatedAt]);

  const handleResetToAuto = useCallback(() => {
    if (!confirm("Reset this layout to the auto-arranged version? Custom edits will be lost.")) {
      return;
    }
    const fresh = autoPackToLayout(images);
    setLayout(fresh);
    setSelectedPageIndex(0);
    setSelectedSlotKey(null);
    setSelectedTextKey(null);
  }, [images]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] grid place-items-center">
        <div className="text-charcoal/60 font-serif italic">Loading editor…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full min-h-[60vh] grid place-items-center">
        <div className="text-center">
          <div className="text-wine font-semibold">{loadError}</div>
          <Link to="/admin/bookings" className="mt-3 inline-block text-sm underline text-burgundy">
            Back to bookings
          </Link>
        </div>
      </div>
    );
  }

  const previewUrl = booking?.reference ? `/portal?ref=${booking.reference}` : "/portal";

  return (
    <div className="w-full bg-cream">
      <header className="border-b border-burgundy/10 bg-white/85 backdrop-blur-xl sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link to="/admin/bookings" className="text-[11px] uppercase tracking-[0.2em] text-charcoal/55 hover:text-burgundy">
              ← Bookings
            </Link>
            <div className="flex items-baseline gap-3 mt-0.5">
              <h1 className="font-serif text-xl text-burgundy truncate">
                {booking?.details?.name || "Album"}
              </h1>
              <span className="font-mono text-xs text-charcoal/55">
                {booking?.reference}
              </span>
              {isDirty && (
                <span className="text-[10px] uppercase tracking-[0.2em] text-wine font-semibold">
                  • Unsaved
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToAuto}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-cream ring-1 ring-burgundy/15 text-charcoal/70 hover:text-burgundy hover:ring-burgundy/40 transition-colors"
            >
              Reset to Auto
            </button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-cream ring-1 ring-burgundy/15 text-burgundy hover:bg-gold/20 transition-colors"
            >
              Preview ↗
            </a>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-gold ${
                !isDirty || saving
                  ? "bg-burgundy/10 text-charcoal/50 cursor-not-allowed"
                  : "bg-olive text-cream hover:bg-burgundy"
              }`}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {saveError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="px-4 py-2 text-xs text-wine bg-wine/5 border-t border-wine/20"
            >
              {saveError}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div
        className="grid grid-cols-[260px_minmax(0,1fr)_340px] overflow-hidden"
        style={{ height: "calc(100vh - 60px)" }}
      >
        <PhotoBin
          images={images}
          usageCount={usageCount}
          pickedPhoto={pickedPhoto}
          onPickPhoto={handlePickPhoto}
        />

        <div className="flex flex-col h-full overflow-hidden min-h-0">
          <div className="flex-1 overflow-hidden min-h-0 min-w-0">
            {isAlbumMode ? (
              <CoverPreview
                theme={theme}
                imagesById={imagesById}
                clientName={booking?.details?.name}
                subtitle={booking?.date || ""}
              />
            ) : currentPage ? (
              <PageCanvas
                page={currentPage}
                pageNumber={selectedPageIndex + 1}
                totalPages={layout.pages.length}
                theme={theme}
                imagesById={imagesById}
                selectedSlotKey={selectedSlotKey}
                selectedTextKey={selectedTextKey}
                onSlotClick={handleSlotClick}
                onTextEdit={handleTextEdit}
                onAssignPhoto={handleAssignPhoto}
                onDeselect={handleDeselect}
              />
            ) : (
              <div className="w-full h-full grid place-items-center bg-cream">
                <div className="text-center">
                  <div className="text-charcoal/60 font-serif italic mb-3">
                    No pages yet.
                  </div>
                  <button
                    onClick={handleAddPage}
                    className="px-4 py-2 rounded-full text-sm font-semibold bg-olive text-cream hover:bg-burgundy shadow-soft transition-colors"
                  >
                    Add first page
                  </button>
                </div>
              </div>
            )}
          </div>

          <PageThumbStrip
            pages={layout.pages}
            currentIndex={selectedPageIndex}
            isAlbumMode={isAlbumMode}
            theme={theme}
            onSelect={handleSelectPage}
            onSelectAlbum={handleSelectAlbum}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
            onDuplicatePage={handleDuplicatePage}
            onMovePage={handleMovePage}
          />
        </div>

        <Inspector
          layout={layout}
          page={isAlbumMode ? null : currentPage}
          images={images}
          isAlbumMode={isAlbumMode}
          selectedSlotKey={selectedSlotKey}
          selectedTextKey={selectedTextKey}
          imagesById={imagesById}
          onChangeTemplate={handleChangeTemplate}
          onClearSlot={handleClearSlot}
          onEditCrop={handleEditCrop}
          onSetGutter={handleSetGutter}
          onSetCaption={handleSetCaption}
          onSetTextStyle={handleSetTextStyle}
          onSetPageOverride={handleSetPageOverride}
          onSetTheme={handleSetTheme}
          onSetCover={handleSetCover}
        />
      </div>

      {cropModalSlot != null && cropImageUrl && (
        <Suspense fallback={null}>
          <CropModal
            imageUrl={cropImageUrl}
            aspect={cropAspect}
            initialCrop={cropInitial}
            onSave={handleCropSave}
            onCancel={handleCropCancel}
          />
        </Suspense>
      )}

      <AnimatePresence>
        {savedToast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-olive text-cream text-sm font-semibold shadow-soft z-50"
          >
            Saved ✓
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mini-preview of the AlbumHero rendered inside the editor center pane.
// Uses the same component the client portal uses so the preview is
// pixel-faithful.
const CoverPreview = React.memo(function CoverPreview({ theme, imagesById, clientName, subtitle }) {
  const cover = theme.cover || {};
  const coverPhotoUrl = cover.photoPublicId
    ? imagesById?.get(cover.photoPublicId)?.secure_url || null
    : null;

  return (
    <div
      className="relative w-full h-full overflow-y-auto"
      style={{ background: "radial-gradient(ellipse at center, #FFFAF0 0%, #FBF6EE 100%)" }}
    >
      <div className="max-w-2xl mx-auto py-8 px-6">
        <div className="rounded-md overflow-hidden ring-1 ring-burgundy/10 shadow-[0_30px_80px_-30px_rgba(74,14,26,0.45)]">
          <div className="relative" style={{ aspectRatio: "3 / 4" }}>
            <div className="absolute inset-0 [&>section]:!min-h-0 [&>section]:!h-full">
              <AlbumHero
                clientName={clientName}
                subtitle={subtitle}
                photoCount={0}
                onScrollDown={() => {}}
                variant={theme.coverVariant || "burgundy"}
                cover={cover}
                coverPhotoUrl={coverPhotoUrl}
              />
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.2em] text-charcoal/50 font-sans">
          Cover preview · live
        </p>
      </div>
    </div>
  );
});
