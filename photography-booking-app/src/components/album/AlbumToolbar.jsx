import React from "react";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IconHeart({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function IconExpand() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
function IconCollapse() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

export default function AlbumToolbar({
  currentPhoto,
  totalPhotos,
  isOnCover,
  isOnBackCover,
  onPrev,
  onNext,
  canPrev,
  canNext,
  isCurrentSelected,
  isCurrentPartiallySelected,
  currentItemCount = 1,
  hasCurrentPhoto,
  onToggleCurrent,
  selectedCount,
  isFullscreen,
  onToggleFullscreen,
  onClose,
}) {
  const markLabel = isCurrentSelected
    ? "Marked"
    : isCurrentPartiallySelected
    ? "Mark all"
    : currentItemCount > 1
    ? `Mark page (${currentItemCount})`
    : "Mark photo";
  const pillBase =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-gold";
  const navBtn = cls(
    pillBase,
    "bg-cream/90 text-burgundy ring-1 ring-burgundy/15 hover:bg-gold/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cream/90"
  );

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap rounded-2xl bg-burgundy/5 ring-1 ring-burgundy/10 px-3 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous page"
          className={navBtn}
        >
          <IconChevronLeft />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <div
          className="font-serif italic text-charcoal/80 text-sm sm:text-base px-2 min-w-[7ch] text-center"
          aria-live="polite"
        >
          {isOnCover ? (
            <span className="text-burgundy font-semibold not-italic tracking-wide">Cover</span>
          ) : isOnBackCover ? (
            <span className="text-burgundy font-semibold not-italic tracking-wide">End</span>
          ) : totalPhotos > 0 ? (
            <>
              <span className="text-burgundy font-semibold not-italic">{currentPhoto}</span>
              <span className="mx-1.5 text-charcoal/40">/</span>
              <span>{totalPhotos}</span>
            </>
          ) : (
            "—"
          )}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next page"
          className={navBtn}
        >
          <span className="hidden sm:inline">Next</span>
          <IconChevronRight />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleCurrent}
          disabled={!hasCurrentPhoto}
          aria-label={
            isCurrentSelected
              ? currentItemCount > 1
                ? "Unmark photos on this page"
                : "Unmark this photo"
              : currentItemCount > 1
              ? "Mark photos on this page"
              : "Mark this photo"
          }
          aria-pressed={!!isCurrentSelected}
          className={cls(
            pillBase,
            "ring-1",
            isCurrentSelected
              ? "bg-olive text-cream ring-burgundy hover:bg-burgundy"
              : isCurrentPartiallySelected
              ? "bg-gold/25 text-burgundy ring-gold/60 hover:bg-gold/40"
              : "bg-cream/90 text-wine ring-burgundy/20 hover:bg-gold/30",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <IconHeart filled={isCurrentSelected} />
          <span className="hidden sm:inline">{markLabel}</span>
        </button>

        {typeof selectedCount === "number" && (
          <span className="hidden md:inline text-xs text-charcoal/60 font-sans">
            {selectedCount} selected
          </span>
        )}

        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-pressed={!!isFullscreen}
          className={cls(pillBase, "bg-cream/90 text-burgundy ring-1 ring-burgundy/15 hover:bg-gold/30")}
        >
          {isFullscreen ? <IconCollapse /> : <IconExpand />}
          <span className="hidden sm:inline">
            {isFullscreen ? "Exit" : "Fullscreen"}
          </span>
        </button>

        {isFullscreen && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close album"
            className={cls(pillBase, "bg-olive text-cream hover:bg-burgundy")}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
