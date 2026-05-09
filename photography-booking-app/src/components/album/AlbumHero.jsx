import React, { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { cdnUrl } from "../../lib/imageUrl";

function ChevronDownIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Pre-baked cover skins per theme variant. Keeps the leather/grain identity
// but recolors so a sage-themed album doesn't slam into a burgundy hero.
const COVER_SKINS = {
  burgundy: {
    bg: "radial-gradient(ellipse at 30% 20%, #6B1224 0%, #4A0E1A 55%, #2A0610 100%)",
    foilColor: "#46543B",
    foilDim: "rgba(70,84,59,0.55)",
    foilLight: "rgba(70,84,59,0.85)",
    rule1: "rgba(70,84,59,0.55)",
    rule2: "rgba(70,84,59,0.25)",
    surfaceText: "rgba(251, 246, 232, 0.8)",
  },
  sage: {
    bg: "radial-gradient(ellipse at 30% 20%, #8A9A75 0%, #6B7A5A 55%, #3F4A36 100%)",
    foilColor: "#E8DCB8",
    foilDim: "rgba(232, 220, 184, 0.5)",
    foilLight: "rgba(232, 220, 184, 0.85)",
    rule1: "rgba(232, 220, 184, 0.55)",
    rule2: "rgba(232, 220, 184, 0.25)",
    surfaceText: "rgba(244, 241, 232, 0.85)",
  },
  navy: {
    bg: "radial-gradient(ellipse at 30% 20%, #2C3A55 0%, #1F2A44 55%, #0E1428 100%)",
    foilColor: "#46543B",
    foilDim: "rgba(70,84,59,0.55)",
    foilLight: "rgba(70,84,59,0.9)",
    rule1: "rgba(70,84,59,0.55)",
    rule2: "rgba(70,84,59,0.25)",
    surfaceText: "rgba(245, 239, 225, 0.85)",
  },
  blush: {
    bg: "radial-gradient(ellipse at 30% 20%, #C28890 0%, #B16777 55%, #7A3F4D 100%)",
    foilColor: "#FCF3EF",
    foilDim: "rgba(252, 243, 239, 0.55)",
    foilLight: "rgba(252, 243, 239, 0.9)",
    rule1: "rgba(252, 243, 239, 0.55)",
    rule2: "rgba(252, 243, 239, 0.22)",
    surfaceText: "rgba(252, 243, 239, 0.85)",
  },
  charcoal: {
    bg: "radial-gradient(ellipse at 30% 20%, #3a3531 0%, #2B2622 55%, #15110F 100%)",
    foilColor: "#C9BCAC",
    foilDim: "rgba(201, 188, 172, 0.55)",
    foilLight: "rgba(201, 188, 172, 0.9)",
    rule1: "rgba(201, 188, 172, 0.55)",
    rule2: "rgba(201, 188, 172, 0.22)",
    surfaceText: "rgba(246, 244, 240, 0.85)",
  },
};

export default function AlbumHero({
  clientName,
  subtitle,
  photoCount,
  onScrollDown,
  variant = "burgundy",
  cover = {},
  coverPhotoUrl = null,
}) {
  const containerRef = useRef(null);
  const reduce = useReducedMotion();
  const skin = COVER_SKINS[variant] || COVER_SKINS.burgundy;

  const coverStyle = cover.style || "leather";
  const monogramText = cover.monogram ?? "LW";
  const titleText = cover.title ?? "Lama Wafa";
  const subtitleText = cover.subtitle ?? "Photography";
  const showMonogram = !cover.hideMonogram;
  const showClientName = !cover.hideClientName;
  const showDate = !cover.hideDate;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const textureY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);
  const monoY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -40]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const isPhoto = coverStyle === "photo" && coverPhotoUrl;
  const isMinimal = coverStyle === "minimal";

  return (
    <section
      ref={containerRef}
      className="relative w-full min-h-screen overflow-hidden flex items-center justify-center text-center"
      style={{
        background: isMinimal ? skin.bg : isPhoto ? "#1a0309" : skin.bg,
      }}
    >
      {isPhoto && (
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={cdnUrl(coverPhotoUrl, { w: 2400, q: 88 })}
            alt=""
            onError={(e) => {
              if (coverPhotoUrl && e.currentTarget.dataset.fallback !== "1") {
                e.currentTarget.dataset.fallback = "1";
                e.currentTarget.src = coverPhotoUrl;
              }
            }}
            className="absolute inset-0 w-full h-full object-cover"
            draggable="false"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/55" />
        </div>
      )}
      <motion.div
        aria-hidden="true"
        style={{ y: textureY }}
        className="absolute inset-0 pointer-events-none"
      >
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 200px rgba(0,0,0,0.55)" }} />
      </motion.div>

      <div
        className="absolute inset-8 sm:inset-12 rounded-[2px] pointer-events-none"
        style={{ border: `1px solid ${skin.rule1}` }}
      />
      <div
        className="absolute inset-10 sm:inset-14 rounded-[2px] pointer-events-none"
        style={{ border: `1px solid ${skin.rule2}` }}
      />

      <motion.div
        style={{ y: monoY, opacity: fade }}
        className="relative z-10 px-8"
      >
        {showMonogram && monogramText && (
          <>
            <div
              className="font-serif text-7xl sm:text-8xl md:text-9xl tracking-[0.18em] leading-none"
              style={{ color: skin.foilColor, textShadow: "0 1px 0 rgba(0,0,0,0.55), 0 -1px 0 rgba(232,228,200,0.18)" }}
            >
              {monogramText}
            </div>
            <div className="mt-5 mx-auto h-px w-24" style={{ backgroundColor: skin.foilLight }} />
          </>
        )}
        {titleText && (
          <div
            className={`${showMonogram ? "mt-7" : ""} font-serif text-2xl sm:text-3xl md:text-4xl tracking-[0.08em]`}
            style={{ color: skin.foilColor, textShadow: "0 1px 0 rgba(0,0,0,0.55)" }}
          >
            {titleText}
          </div>
        )}
        {subtitleText && (
          <div
            className="mt-2 font-sans uppercase tracking-[0.45em] text-[10px] sm:text-xs"
            style={{ color: skin.foilDim }}
          >
            {subtitleText}
          </div>
        )}

        {showClientName && clientName && (
          <div
            className="mt-14 sm:mt-16 font-sans uppercase tracking-[0.3em] text-[11px] sm:text-xs"
            style={{ color: skin.foilLight }}
          >
            {clientName}
          </div>
        )}
        {showDate && subtitle && (
          <div
            className="mt-1.5 font-serif italic text-sm sm:text-base"
            style={{ color: skin.surfaceText }}
          >
            {subtitle}
          </div>
        )}
      </motion.div>

      <motion.button
        type="button"
        onClick={onScrollDown}
        aria-label="Scroll down to album"
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 grid place-items-center w-11 h-11 rounded-full backdrop-blur-sm transition-colors"
        style={{
          color: skin.foilLight,
          backgroundColor: "rgba(0,0,0,0.25)",
          border: `1px solid ${skin.rule2}`,
          opacity: fade,
        }}
        animate={reduce ? undefined : { y: [0, 6, 0] }}
        transition={reduce ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ChevronDownIcon />
      </motion.button>

      {photoCount > 0 && (
        <motion.div
          style={{ opacity: fade, color: skin.foilDim }}
          className="absolute bottom-3 right-6 z-10 font-sans uppercase tracking-[0.4em] text-[9px]"
        >
          {photoCount} photographs
        </motion.div>
      )}
    </section>
  );
}
