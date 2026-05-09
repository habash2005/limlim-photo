import React, { forwardRef, useEffect, useState } from "react";
import { getTemplate } from "./albumTemplates";
import { getTextValue, getTextStyle } from "./layoutSchema";
import { cdnUrl } from "../../lib/imageUrl";

function HeartIcon({ filled }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function PhotoSlot({
  slotKey,
  geometry,
  slot,
  item,
  shouldLoad,
  isSelected,
  onToggleSelect,
  mode,
  isEditorSelected,
  onSlotClick,
  halfGutter,
  fullGutter,
  accent,
}) {
  // Resilient image src: try CDN first, fall back to raw secure_url on
  // error (CDN rejects sources >20 MB). Without the fallback, IMG.onerror
  // fires silently and the slot stays at opacity:0 = visually empty.
  // Three local states (loaded / cdnFailed / failed) — kept inline to
  // avoid a custom hook that HMR can desync.
  const [loaded, setLoaded] = useState(false);
  const [cdnFailed, setCdnFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setCdnFailed(false);
    setFailed(false);
  }, [item?.public_id]);
  const imgSrc = !item?.secure_url
    ? null
    : cdnFailed
      ? item.secure_url
      : cdnUrl(item.secure_url, { w: 2000, q: 85 });
  const onLoad = () => setLoaded(true);
  const onError = () => {
    if (!cdnFailed) {
      if (typeof console !== "undefined") {
        console.warn("[AlbumPage] CDN failed, falling back to raw:", item?.secure_url);
      }
      setCdnFailed(true);
    } else {
      if (typeof console !== "undefined") {
        console.warn("[AlbumPage] raw URL also failed:", item?.secure_url);
      }
      setFailed(true);
    }
  };

  const style = {
    left: `calc(${geometry.x}% + ${halfGutter}px)`,
    top: `calc(${geometry.y}% + ${halfGutter}px)`,
    width: `calc(${geometry.w}% - ${fullGutter}px)`,
    height: `calc(${geometry.h}% - ${fullGutter}px)`,
  };

  const isEmpty = !slot || !slot.publicId || !item;

  // Image rendering: prefer custom crop area when present, else object-cover with focal.
  const cropArea = slot?.crop?.area;
  const useCustomCrop = !!cropArea && (cropArea.width > 0 && cropArea.height > 0);

  let imgStyle;
  if (useCustomCrop) {
    // The crop modal saves `area` as PERCENTAGES (0-100) of the source image.
    // The legacy `width: 100/cropArea.width%, height: 100/cropArea.height%`
    // formula only renders the picked region correctly when the cropArea's
    // aspect on the source image happens to match the slot's aspect. When it
    // drifts (after `changeTemplate` preserves a crop into a slot with a
    // different aspect, or the slot's geometry differs from when the crop
    // was made), the IMG box ends up at a non-natural aspect and either
    // `object-fit: cover` re-crops the image (cutting heads off) OR the box
    // doesn't span the slot (leaving empty cream space).
    //
    // Fix — pick the LARGER of the two scale candidates so the IMG box
    // always covers the slot, and constrain the IMG box to the photo's
    // NATURAL aspect ratio so cover doesn't re-crop. Center the cropArea on
    // the slot so the user's intended subject stays maximally in frame.
    const imgW = item?.width || 0;
    const imgH = item?.height || 0;
    if (imgW > 0 && imgH > 0) {
      // 720×960 = the page canvas (see editor/PageCanvas.jsx + ScrollPage).
      const slotW = (geometry.w / 100) * 720;
      const slotH = (geometry.h / 100) * 960;
      // Two scale candidates that would make the cropArea region exactly
      // span the slot in width vs height.
      const sx = slotW / ((cropArea.width / 100) * imgW);
      const sy = slotH / ((cropArea.height / 100) * imgH);
      // Take the larger so the IMG box covers the slot in BOTH axes.
      const s = Math.max(sx, sy);
      const renderedW = s * imgW;
      const renderedH = s * imgH;
      // Align the cropArea center with the slot center.
      const cropCx = ((cropArea.x + cropArea.width / 2) / 100) * renderedW;
      const cropCy = ((cropArea.y + cropArea.height / 2) / 100) * renderedH;
      const leftPx = slotW / 2 - cropCx;
      const topPx = slotH / 2 - cropCy;
      imgStyle = {
        position: "absolute",
        width: `${(renderedW / slotW) * 100}%`,
        height: `${(renderedH / slotH) * 100}%`,
        left: `${(leftPx / slotW) * 100}%`,
        top: `${(topPx / slotH) * 100}%`,
        // IMG box now matches the photo's natural aspect; cover is a no-op.
        objectFit: "cover",
        opacity: loaded ? 1 : 0,
      };
    } else {
      // Fall back to legacy formula when image dimensions are unknown.
      imgStyle = {
        position: "absolute",
        width: `${(100 / cropArea.width) * 100}%`,
        height: `${(100 / cropArea.height) * 100}%`,
        left: `${(-cropArea.x / cropArea.width) * 100}%`,
        top: `${(-cropArea.y / cropArea.height) * 100}%`,
        objectFit: "cover",
        opacity: loaded ? 1 : 0,
      };
    }
  } else {
    const focalX = (slot?.focal?.x ?? 0.5) * 100;
    const focalY = (slot?.focal?.y ?? 0.5) * 100;
    const zoom = slot?.zoom ?? 1;
    imgStyle = {
      objectPosition: `${focalX}% ${focalY}%`,
      transform: zoom !== 1 ? `scale(${zoom})` : undefined,
      opacity: loaded ? 1 : 0,
    };
  }

  return (
    <figure
      className={`absolute overflow-hidden bg-charcoal/10 ${
        mode === "edit"
          ? `cursor-pointer transition-shadow ${
              isEditorSelected
                ? "ring-2 ring-gold ring-offset-1 ring-offset-cream"
                : "ring-0 hover:ring-1 hover:ring-burgundy/30"
            }`
          : ""
      } ${isEmpty && mode === "edit" ? "ring-2 ring-dashed ring-burgundy/30 bg-cream/60" : ""}`}
      style={style}
      onClick={mode === "edit" && onSlotClick ? (e) => { e.stopPropagation(); onSlotClick(slotKey); } : undefined}
    >
      {!isEmpty && shouldLoad && item?.secure_url ? (
        <>
          <img
            src={imgSrc}
            alt={item.original_filename || "Photo"}
            loading="lazy"
            decoding="async"
            draggable="false"
            onLoad={onLoad}
            onError={onError}
            className={
              useCustomCrop
                ? "select-none transition-opacity duration-700 ease-out"
                : "w-full h-full object-cover select-none transition-opacity duration-700 ease-out"
            }
            style={imgStyle}
          />
          {failed && mode === "edit" && (
            <div className="absolute inset-0 grid place-items-center bg-rose-50/95 text-rose-800 text-xs px-3 text-center pointer-events-none">
              <div>
                <div className="font-semibold mb-1">Image failed to load</div>
                <div className="text-rose-700/80 text-[11px] truncate max-w-full">
                  {item.original_filename || item.public_id || "(no filename)"}
                </div>
              </div>
            </div>
          )}
        </>
      ) : !isEmpty ? (
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal/10 to-charcoal/20 animate-pulse" />
      ) : mode === "edit" ? (
        <div className="absolute inset-0 grid place-items-center bg-burgundy/5 border-2 border-dashed border-burgundy/40">
          <div className="text-center px-3">
            <div className="mx-auto mb-2 grid place-items-center w-10 h-10 rounded-full bg-burgundy/10 text-burgundy/70">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-burgundy/80 font-semibold">
              Empty slot
            </div>
            <div className="font-sans text-[10px] text-charcoal/55 mt-0.5">
              Drag a photo here
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-burgundy/40 font-sans text-xs uppercase tracking-[0.2em]">
          {""}
        </div>
      )}

      {!isEmpty && mode === "view" && onToggleSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(slot.publicId);
          }}
          aria-label={isSelected ? "Unmark this photo" : "Mark this photo"}
          aria-pressed={isSelected}
          className={`absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full
                     backdrop-blur-md ring-1 transition-all duration-200 shadow-soft
                     focus:outline-none focus:ring-2 focus:ring-gold ${
                       isSelected
                         ? "bg-olive/95 text-cream ring-burgundy"
                         : "bg-cream/85 text-wine/90 ring-burgundy/25 hover:bg-gold/40 hover:scale-105"
                     }`}
        >
          <HeartIcon filled={isSelected} />
        </button>
      )}
    </figure>
  );
}

function TextSlot({
  definition,
  textEntry,
  fontHeading,
  accent,
  mode,
  isEditorSelected,
  onClick,
  halfGutter,
  fullGutter,
}) {
  const value = getTextValue(textEntry);
  const styleOverride = getTextStyle(textEntry);

  const fontFamily = styleOverride.font || fontHeading;
  const color = styleOverride.color || accent;
  const align = styleOverride.align || definition.defaultAlign || "center";
  const italic =
    styleOverride.italic !== undefined ? styleOverride.italic : !!definition.italic;
  const weight = styleOverride.weight || (definition.defaultWeight || "500");
  const sizePx = (styleOverride.size || definition.defaultFontSize || 18) * 0.6;

  const style = {
    left: `calc(${definition.x}% + ${halfGutter}px)`,
    top: `calc(${definition.y}% + ${halfGutter}px)`,
    width: `calc(${definition.w}% - ${fullGutter}px)`,
    height: `calc(${definition.h}% - ${fullGutter}px)`,
    fontFamily: `"${fontFamily}", serif`,
    color,
    fontStyle: italic ? "italic" : "normal",
    fontWeight: weight,
    textAlign: align,
    fontSize: `${sizePx}px`,
    lineHeight: 1.2,
  };

  const isEmpty = !value;

  return (
    <div
      className={`absolute flex items-center justify-center px-2 ${
        mode === "edit"
          ? `cursor-text ${
              isEditorSelected
                ? "ring-2 ring-gold ring-offset-1 ring-offset-cream"
                : "hover:ring-1 hover:ring-burgundy/30"
            } ${isEmpty ? "ring-2 ring-dashed ring-burgundy/30" : ""}`
          : ""
      }`}
      style={style}
      onClick={mode === "edit" && onClick ? (e) => { e.stopPropagation(); onClick(definition.key); } : undefined}
    >
      <span className="block w-full" style={{ textAlign: align }}>
        {isEmpty ? (
          <span className="text-charcoal/30 font-sans not-italic text-xs uppercase tracking-[0.2em]" style={{ fontWeight: 500 }}>
            {mode === "edit" ? "Click to edit" : ""}
          </span>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

const AlbumPage = forwardRef(function AlbumPage(
  {
    page,
    theme,
    imagesById,
    pageNumber,
    totalPages,
    shouldLoad,
    selected,
    onToggleSelect,
    mode = "view",
    side = "right",
    isPortrait = false,
    onSlotClick,
    onTextEdit,
    editorSelectedSlot,
    editorSelectedText,
    onEmptyClick,
    hideChrome = false,
  },
  ref
) {
  const tpl = getTemplate(page.templateId);
  const themeOverride = page.themeOverride || {};
  const pageBg = theme?.pageBg || "#FBF6EE";
  const accent = themeOverride.accent || theme?.accent || "#5A1A2B";
  const fontHeading = themeOverride.fontHeading || theme?.fontHeading || "Playfair Display";

  const gutter = page.gutter || 0;
  const halfGutter = gutter / 2;

  const spineClass = isPortrait
    ? ""
    : side === "left"
    ? "album-spine-shadow-right"
    : "album-spine-shadow-left";
  const numberAlign = side === "left" ? "left-3 sm:left-4" : "right-3 sm:right-4";

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`Page ${pageNumber} of ${totalPages}`}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: pageBg }}
      onClick={mode === "edit" && onEmptyClick ? () => onEmptyClick() : undefined}
    >
      {tpl.slots.map((geometry, i) => {
        const key = String(i);
        const slot = page.slots?.[key];
        const item = slot?.publicId ? imagesById?.get(slot.publicId) : null;
        const isSelected = !!(slot?.publicId && selected?.[slot.publicId]);
        return (
          <PhotoSlot
            key={`s-${key}`}
            slotKey={key}
            geometry={geometry}
            slot={slot}
            item={item}
            shouldLoad={shouldLoad}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect}
            mode={mode}
            isEditorSelected={editorSelectedSlot === key}
            onSlotClick={onSlotClick}
            halfGutter={halfGutter}
            fullGutter={gutter}
            accent={accent}
          />
        );
      })}

      {tpl.texts.map((definition) => (
        <TextSlot
          key={`t-${definition.key}`}
          definition={definition}
          textEntry={page.texts?.[definition.key]}
          fontHeading={fontHeading}
          accent={accent}
          mode={mode}
          isEditorSelected={editorSelectedText === definition.key}
          onClick={onTextEdit}
          halfGutter={halfGutter}
          fullGutter={gutter}
        />
      ))}

      {/* binding-edge fold shadow (only in view mode, scroll viewer) */}
      {!hideChrome && mode === "view" && (
        <div
          className={`pointer-events-none absolute inset-y-0 ${
            side === "left" ? "right-0" : "left-0"
          } w-8 ${spineClass}`}
        />
      )}

      {/* thin gold edge frame for album-leaf identity */}
      {!hideChrome && (
        <div
          className="pointer-events-none absolute inset-0 ring-1 ring-inset"
          style={{ boxShadow: `inset 0 0 0 1px rgba(70, 84, 59, 0.2)` }}
        />
      )}

      {/* page number pill (view mode only) */}
      {!hideChrome && mode === "view" && totalPages > 0 && (
        <div className={`absolute bottom-3 ${numberAlign} flex items-center gap-2 z-10`}>
          <span
            className="font-serif italic text-[11px] sm:text-xs tracking-wider px-2 py-0.5 rounded-full backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
            style={{
              backgroundColor: `${accent}8c`,
              color: pageBg,
            }}
          >
            {pageNumber}
          </span>
        </div>
      )}
    </div>
  );
});

export default AlbumPage;
