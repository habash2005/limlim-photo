import React from "react";
import { motion } from "framer-motion";

export default function AlbumScrollDots({ total, current, onJump }) {
  if (total <= 1) return null;

  return (
    <nav
      aria-label="Album page navigation"
      data-album-scroll-dots=""
      className="hidden md:flex fixed right-5 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-2"
    >
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const active = current === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onJump?.(n)}
            aria-label={`Jump to page ${n}`}
            aria-current={active ? "true" : undefined}
            className="group relative grid place-items-center w-5 h-5"
          >
            <motion.span
              className={`block rounded-full ring-1 transition-colors ${
                active
                  ? "bg-burgundy ring-burgundy/40"
                  : "bg-cream/0 ring-burgundy/30 group-hover:bg-burgundy/30"
              }`}
              animate={{
                width: active ? 10 : 6,
                height: active ? 10 : 6,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </button>
        );
      })}
    </nav>
  );
}
