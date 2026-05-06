import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
function IconArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

export default function AlbumFloatingBar({
  currentPage,
  totalPages,
  isFullscreen,
  onToggleFullscreen,
  onScrollTop,
}) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(typeof window !== "undefined" ? window.scrollY : 0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) < 8) return;
      // hide on scroll down past hero, reveal on scroll up
      if (dy > 0 && y > 600) setHidden(true);
      else if (dy < 0) setHidden(false);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40
                     inline-flex items-center gap-2 rounded-full
                     bg-cream/85 backdrop-blur-xl ring-1 ring-burgundy/15
                     shadow-[0_10px_30px_-10px_rgba(74,14,26,0.35)] px-2 py-1.5"
          role="toolbar"
          aria-label="Album controls"
        >
          {totalPages > 0 && (
            <div className="px-3 font-serif italic text-xs text-charcoal/75">
              <span className="text-burgundy font-semibold not-italic">
                {Math.max(1, currentPage)}
              </span>
              <span className="mx-1.5 text-charcoal/30">/</span>
              <span>{totalPages}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onScrollTop}
            aria-label="Scroll to top"
            className="grid place-items-center w-9 h-9 rounded-full text-burgundy hover:bg-gold/30 transition-colors focus:outline-none focus:ring-2 focus:ring-gold"
          >
            <IconArrowUp />
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-pressed={!!isFullscreen}
            className="grid place-items-center w-9 h-9 rounded-full text-burgundy hover:bg-gold/30 transition-colors focus:outline-none focus:ring-2 focus:ring-gold"
          >
            {isFullscreen ? <IconCollapse /> : <IconExpand />}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
