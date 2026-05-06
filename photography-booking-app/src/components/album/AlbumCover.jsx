import React, { forwardRef } from "react";

const AlbumCover = forwardRef(function AlbumCover(
  { variant = "front", clientName, subtitle, photoCount },
  ref
) {
  return (
    <div
      ref={ref}
      data-density="hard"
      className="album-leather-grain relative w-full h-full overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.45)" }}
      />

      <div className="absolute inset-6 border border-gold/60 rounded-[2px] pointer-events-none" />
      <div className="absolute inset-8 border border-gold/30 rounded-[2px] pointer-events-none" />

      {variant === "front" ? (
        <div className="relative h-full w-full flex flex-col items-center justify-center text-center px-8">
          <div className="album-gold-foil font-serif text-6xl md:text-7xl tracking-[0.15em] leading-none">
            LW
          </div>
          <div className="mt-3 h-px w-20 bg-gold/70" />
          <div className="album-gold-foil mt-5 font-serif text-xl md:text-2xl tracking-[0.08em]">
            Lama Wafa
          </div>
          <div className="album-gold-foil mt-1 font-sans uppercase tracking-[0.4em] text-[10px] text-gold/70">
            Photography
          </div>

          {clientName && (
            <div className="mt-12 font-sans uppercase tracking-[0.3em] text-[11px] text-gold/85">
              {clientName}
            </div>
          )}
          {subtitle && (
            <div className="mt-1 font-serif italic text-sm text-cream/75">
              {subtitle}
            </div>
          )}

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 font-sans uppercase tracking-[0.4em] text-[10px] text-gold/55">
            {photoCount ? `${photoCount} photographs` : "your album"}
          </div>
        </div>
      ) : (
        <div className="relative h-full w-full flex items-center justify-center">
          <div className="album-gold-foil font-serif text-4xl text-gold/70">❦</div>
        </div>
      )}
    </div>
  );
});

export default AlbumCover;
