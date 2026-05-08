import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import AlbumPage from "./AlbumPage";

const APPLE_EASE = [0.16, 1, 0.3, 1];

export default function ScrollPage({
  page,
  theme,
  imagesById,
  pageNumber,
  totalPages,
  selected,
  onToggleOne,
  onVisible,
}) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  const isInLoadWindow = useInView(ref, {
    once: false,
    margin: "200px 0px 200px 0px",
  });

  const isCurrentlyVisible = useInView(ref, {
    once: false,
    margin: "-30% 0px -30% 0px",
  });

  React.useEffect(() => {
    if (isCurrentlyVisible && onVisible) onVisible(pageNumber);
  }, [isCurrentlyVisible, pageNumber, onVisible]);

  const isOddPage = pageNumber % 2 === 1;

  return (
    <motion.section
      ref={ref}
      data-page-number={pageNumber}
      data-album-scroll-page=""
      className="relative w-full flex items-center justify-center py-[6vh] sm:py-[8vh]
                 [content-visibility:auto] [contain-intrinsic-size:auto_900px]"
      initial={
        reduce
          ? { opacity: 0 }
          : {
              opacity: 0,
              y: 40,
              scale: 0.97,
              x: isOddPage ? -8 : 8,
            }
      }
      whileInView={
        reduce
          ? { opacity: 1 }
          : { opacity: 1, y: 0, scale: 1, x: 0 }
      }
      transition={{
        duration: reduce ? 0.2 : 0.75,
        ease: APPLE_EASE,
      }}
      viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
    >
      <div
        className="relative w-[min(92vw,720px)] aspect-[3/4]
                   shadow-[0_25px_60px_-25px_rgba(74,14,26,0.45),0_8px_20px_-10px_rgba(74,14,26,0.20)]
                   rounded-sm overflow-hidden"
      >
        <AlbumPage
          page={page}
          theme={theme}
          imagesById={imagesById}
          pageNumber={pageNumber}
          totalPages={totalPages}
          shouldLoad={isInLoadWindow}
          selected={selected}
          onToggleSelect={onToggleOne}
          side={isOddPage ? "right" : "left"}
          isPortrait={true}
          mode="view"
        />
      </div>
    </motion.section>
  );
}
