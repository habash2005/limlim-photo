import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import HTMLFlipBook from "react-pageflip";

import AlbumCover from "./AlbumCover";
import AlbumPage from "./AlbumPage";
import AlbumToolbar from "./AlbumToolbar";
import useAlbumKeyboard from "./useAlbumKeyboard";
import {
  buildAlbumPages,
  pageKey,
  pageContainsAllSelected,
  pageContainsAnySelected,
} from "./albumPages";
import "./album.css";

const NEIGHBOR_RADIUS = 2;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function AlbumBook({
  items,
  selected,
  onToggleOne,
  clientName,
  subtitle,
}) {
  const bookRef = useRef(null);
  const containerRef = useRef(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = (e) => setIsPortrait(e.matches);
    mq.addEventListener
      ? mq.addEventListener("change", onChange)
      : mq.addListener(onChange);
    return () => {
      mq.removeEventListener
        ? mq.removeEventListener("change", onChange)
        : mq.removeListener(onChange);
    };
  }, []);

  const albumPages = useMemo(() => buildAlbumPages(items), [items]);
  const totalAlbumPages = albumPages.length;
  const totalFlipPages = totalAlbumPages + 2; // + front + back covers

  // currentIndex 0 = front cover, 1..totalAlbumPages = photo pages, totalAlbumPages+1 = back cover
  const currentAlbumPageIndex =
    currentIndex >= 1 && currentIndex <= totalAlbumPages
      ? currentIndex - 1
      : -1;
  const currentPage =
    currentAlbumPageIndex >= 0 ? albumPages[currentAlbumPageIndex] : null;
  const currentPageNumber =
    currentAlbumPageIndex >= 0 ? currentAlbumPageIndex + 1 : 0;

  const currentPageAllSelected = currentPage
    ? pageContainsAllSelected(currentPage, selected)
    : false;
  const currentPageAnySelected = currentPage
    ? pageContainsAnySelected(currentPage, selected)
    : false;
  const currentPageItemCount = currentPage ? currentPage.items.length : 0;

  const selectedCount = useMemo(
    () => items.reduce((n, img) => n + (selected[img.public_id] ? 1 : 0), 0),
    [items, selected]
  );

  const flipNext = useCallback(() => {
    bookRef.current?.pageFlip()?.flipNext();
  }, []);
  const flipPrev = useCallback(() => {
    bookRef.current?.pageFlip()?.flipPrev();
  }, []);
  const flipTo = useCallback((idx) => {
    bookRef.current?.pageFlip()?.flip(idx);
  }, []);

  const goFirstPage = useCallback(() => flipTo(1), [flipTo]);
  const goLastPage = useCallback(
    () => flipTo(totalAlbumPages),
    [flipTo, totalAlbumPages]
  );

  const toggleCurrentPage = useCallback(() => {
    if (!currentPage || !onToggleOne) return;
    const allSelected = pageContainsAllSelected(currentPage, selected);
    // If all are selected, unmark all; else mark any unmarked.
    currentPage.items.forEach((it) => {
      const isSel = !!selected[it.public_id];
      if (allSelected && isSel) onToggleOne(it.public_id);
      else if (!allSelected && !isSel) onToggleOne(it.public_id);
    });
  }, [currentPage, selected, onToggleOne]);

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const handleEscape = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  useAlbumKeyboard({
    onPrev: flipPrev,
    onNext: flipNext,
    onFirst: goFirstPage,
    onLast: goLastPage,
    onEscape: handleEscape,
    onToggleCurrent: toggleCurrentPage,
    enabled: true,
  });

  const flippingTime = prefersReducedMotion() ? 0 : 950;

  const flipPages = useMemo(() => {
    const nodes = [];

    nodes.push(
      <AlbumCover
        key="cover-front"
        variant="front"
        clientName={clientName}
        subtitle={subtitle}
        photoCount={items.length}
      />
    );

    albumPages.forEach((page, i) => {
      const pageNumber = i + 1;
      const distance = Math.abs(
        pageNumber - Math.max(1, currentPageNumber)
      );
      const shouldLoad =
        currentPageNumber === 0
          ? pageNumber <= NEIGHBOR_RADIUS + 1
          : distance <= NEIGHBOR_RADIUS;

      nodes.push(
        <AlbumPage
          key={pageKey(page, i)}
          page={page}
          pageNumber={pageNumber}
          totalPages={totalAlbumPages}
          shouldLoad={shouldLoad}
          selected={selected}
          onToggleSelect={onToggleOne}
          side={pageNumber % 2 === 1 ? "right" : "left"}
          isPortrait={isPortrait}
        />
      );
    });

    nodes.push(<AlbumCover key="cover-back" variant="back" />);

    return nodes;
  }, [
    albumPages,
    selected,
    onToggleOne,
    clientName,
    subtitle,
    items.length,
    totalAlbumPages,
    currentPageNumber,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative ${
        isFullscreen
          ? "bg-[radial-gradient(ellipse_at_top,_#3a0a14_0%,_#1a0309_100%)] p-6 flex flex-col"
          : ""
      }`}
    >
      <div className={isFullscreen ? "max-w-4xl w-full mx-auto" : ""}>
        <AlbumToolbar
          currentPhoto={currentPageNumber}
          totalPhotos={totalAlbumPages}
          isOnCover={currentIndex === 0}
          isOnBackCover={currentIndex === totalFlipPages - 1}
          onPrev={flipPrev}
          onNext={flipNext}
          canPrev={currentIndex > 0}
          canNext={currentIndex < totalFlipPages - 1}
          isCurrentSelected={currentPageAllSelected}
          isCurrentPartiallySelected={
            currentPageAnySelected && !currentPageAllSelected
          }
          currentItemCount={currentPageItemCount}
          hasCurrentPhoto={!!currentPage}
          onToggleCurrent={toggleCurrentPage}
          selectedCount={selectedCount}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onClose={isFullscreen ? handleToggleFullscreen : null}
        />
      </div>

      <div
        className={`album-stage mt-6 flex items-center justify-center w-full ${
          isFullscreen ? "flex-1" : ""
        }`}
      >
        <div className="relative w-full">
          {/* ambient shadow under the book */}
          <div
            aria-hidden="true"
            className="absolute -bottom-5 left-1/4 right-1/4 h-10 rounded-full bg-burgundy/30 blur-3xl pointer-events-none"
          />
          <HTMLFlipBook
            key={isPortrait ? "portrait" : "landscape"}
            ref={bookRef}
            width={620}
            height={840}
            size="stretch"
            minWidth={320}
            maxWidth={780}
            minHeight={440}
            maxHeight={1040}
            maxShadowOpacity={0.6}
            showCover={true}
            usePortrait={isPortrait}
            mobileScrollSupport={true}
            flippingTime={flippingTime}
            drawShadow={true}
            startPage={0}
            className="album-book"
            style={{ margin: "0 auto" }}
            onFlip={(e) => setCurrentIndex(e.data)}
          >
            {flipPages}
          </HTMLFlipBook>
        </div>
      </div>

      <div className={`mt-5 text-center text-[11px] font-sans tracking-wide ${
        isFullscreen ? "text-cream/55" : "text-charcoal/50"
      }`}>
        <kbd className="font-mono px-1.5 py-0.5 rounded bg-burgundy/10 text-burgundy/80 ring-1 ring-burgundy/15">←</kbd>
        <span className="mx-1.5">/</span>
        <kbd className="font-mono px-1.5 py-0.5 rounded bg-burgundy/10 text-burgundy/80 ring-1 ring-burgundy/15">→</kbd>
        <span className="mx-2">to flip</span>
        <span className="text-charcoal/30 mx-1">·</span>
        <kbd className="font-mono px-1.5 py-0.5 rounded bg-burgundy/10 text-burgundy/80 ring-1 ring-burgundy/15">S</kbd>
        <span className="ml-2">to mark current page</span>
      </div>
    </div>
  );
}
