import React, { memo, useEffect, useMemo, useRef, useState } from "react";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unused", label: "Unused" },
  { id: "used", label: "Used" },
];

// Lazy-mount image: only attach <img src> when the tile is within or
// near the viewport. Avoids browser queueing 50 full-res fetches at once.
const PhotoTile = memo(function PhotoTile({
  publicId,
  secureUrl,
  used,
  isPicked,
  onPick,
}) {
  const ref = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shouldLoad) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLoad]);

  const handleDragStart = (e) => {
    e.dataTransfer.setData("application/x-album-photo", publicId);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      ref={ref}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onPick?.(publicId)}
      className={`relative aspect-square rounded-md overflow-hidden cursor-grab active:cursor-grabbing
                 ring-1 transition-all
                 [content-visibility:auto] [contain-intrinsic-size:auto_120px]
                 hover:scale-[1.03] hover:shadow-soft active:scale-[0.98] ${
                   isPicked
                     ? "ring-2 ring-gold ring-offset-1 ring-offset-cream shadow-soft"
                     : "ring-burgundy/10"
                 }`}
    >
      {shouldLoad ? (
        <img
          src={secureUrl}
          alt=""
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          draggable="false"
          className="w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="absolute inset-0 bg-burgundy/5 animate-pulse" />
      )}
      {used > 0 && (
        <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-burgundy/85 text-cream text-[10px] font-semibold backdrop-blur-sm pointer-events-none">
          {used}×
        </span>
      )}
    </div>
  );
});

function PhotoBinInner({ images, usageCount, onPickPhoto, pickedPhoto }) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "unused")
      return images.filter((img) => !usageCount.get(img.public_id));
    if (filter === "used")
      return images.filter((img) => usageCount.get(img.public_id));
    return images;
  }, [images, filter, usageCount]);

  return (
    <aside className="flex flex-col h-full min-h-0 bg-white/60 backdrop-blur-2xl border-r border-burgundy/10">
      <div className="p-4 border-b border-burgundy/10 shrink-0">
        <h3 className="font-serif text-base font-semibold text-burgundy">Photos</h3>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-charcoal/55">
          {images.length} total
        </p>
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-burgundy/5 p-0.5 ring-1 ring-burgundy/10">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors ${
                filter === f.id
                  ? "bg-olive text-cream shadow-soft"
                  : "text-charcoal/70 hover:text-burgundy"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-charcoal/50 py-10">
            No photos in this view.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((img) => (
              <PhotoTile
                key={img.public_id}
                publicId={img.public_id}
                secureUrl={img.secure_url}
                used={usageCount.get(img.public_id) || 0}
                isPicked={pickedPhoto === img.public_id}
                onPick={onPickPhoto}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-burgundy/10 text-[10px] uppercase tracking-[0.2em] text-charcoal/50 shrink-0">
        Drag onto a slot, or tap to pick
      </div>
    </aside>
  );
}

// Memoize the whole bin so caption/title typing in the inspector doesn't
// trigger 50+ tile re-renders. usageCount is a Map — compare by value
// (size + identity of underlying entries) so we still update when usage
// genuinely changes.
function areBinPropsEqual(prev, next) {
  if (prev.images !== next.images) return false;
  if (prev.pickedPhoto !== next.pickedPhoto) return false;
  if (prev.onPickPhoto !== next.onPickPhoto) return false;
  if (prev.usageCount === next.usageCount) return true;
  if (prev.usageCount.size !== next.usageCount.size) return false;
  for (const [k, v] of prev.usageCount.entries()) {
    if (next.usageCount.get(k) !== v) return false;
  }
  return true;
}

export default memo(PhotoBinInner, areBinPropsEqual);
