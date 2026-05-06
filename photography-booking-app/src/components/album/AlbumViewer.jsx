import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AlbumHero from "./AlbumHero";
import ScrollPage from "./ScrollPage";
import AlbumScrollDots from "./AlbumScrollDots";
import AlbumFloatingBar from "./AlbumFloatingBar";
import { autoPackToLayout, pageReactKey } from "./layoutSchema";
import { resolveTheme } from "./albumThemes";
import "./album.css";

export default function AlbumViewer({
  items,
  layoutDoc,
  selected,
  onToggleOne,
  clientName,
  subtitle,
}) {
  const containerRef = useRef(null);
  const feedRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const imagesById = useMemo(() => {
    const m = new Map();
    for (const it of items || []) m.set(it.public_id, it);
    return m;
  }, [items]);

  const layout = useMemo(() => {
    if (layoutDoc?.pages?.length) return layoutDoc;
    return autoPackToLayout(items || []);
  }, [layoutDoc, items]);

  const theme = useMemo(() => resolveTheme(layout.theme), [layout.theme]);
  const pages = layout.pages;
  const totalPages = pages.length;

  const scrollToFeed = useCallback(() => {
    feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      const top = containerRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const jumpToPage = useCallback((n) => {
    const el = document.querySelector(`[data-page-number="${n}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

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
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const handlePageVisible = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${
        isFullscreen
          ? "overflow-y-auto h-screen"
          : ""
      }`}
      style={
        isFullscreen
          ? { background: `radial-gradient(ellipse at top, ${theme.accent}cc 0%, #1a0309 100%)` }
          : undefined
      }
    >
      <AlbumHero
        clientName={clientName}
        subtitle={subtitle}
        photoCount={items.length}
        onScrollDown={scrollToFeed}
        variant={theme.coverVariant || "burgundy"}
        cover={theme.cover || {}}
        coverPhotoUrl={
          theme.cover?.photoPublicId
            ? imagesById.get(theme.cover.photoPublicId)?.secure_url || null
            : null
        }
      />

      <div
        ref={feedRef}
        className="relative w-full py-[6vh]"
        style={{ backgroundColor: theme.pageBg }}
      >
        <div className="max-w-7xl mx-auto px-4">
          {pages.length === 0 ? (
            <div className="text-center text-charcoal/60 py-20">
              No images yet.
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {pages.map((page, i) => (
                <ScrollPage
                  key={pageReactKey(page, i)}
                  page={page}
                  theme={theme}
                  imagesById={imagesById}
                  pageNumber={i + 1}
                  totalPages={totalPages}
                  selected={selected}
                  onToggleOne={onToggleOne}
                  onVisible={handlePageVisible}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="mt-12 mb-6 text-center font-serif italic text-sm"
          style={{ color: `${theme.accent}66` }}
        >
          ❦
        </div>
      </div>

      <AlbumScrollDots total={totalPages} current={currentPage} onJump={jumpToPage} />

      <AlbumFloatingBar
        currentPage={currentPage}
        totalPages={totalPages}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onScrollTop={scrollToTop}
      />
    </div>
  );
}
