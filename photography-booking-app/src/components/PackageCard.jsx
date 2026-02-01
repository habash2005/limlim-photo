// src/components/PackageCard.jsx
import React from "react";

function cls(...xs) { return xs.filter(Boolean).join(" "); }

/**
 * Props:
 *  - p: { id, name, tagline, duration, desc, includes?, featured?, image? }
 *  - selected: boolean
 *  - onSelect: () => void
 */
export default function PackageCard({ p, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cls(
        "group text-left relative w-full rounded-2xl p-4 md:p-5 transition-all",
        "bg-white/90 border shadow-[0_10px_30px_rgba(0,0,0,0.06)]",
        selected
          ? "border-burgundy ring-2 ring-gold/40"
          : "border-burgundy/20 hover:border-gold/60 hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)]",
        "focus:outline-none focus:ring-2 focus:ring-gold"
      )}
    >
      {selected && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-burgundy/5 to-gold/10" />
      )}

      <div className="relative">
        {p.image && (
          <div className="mb-3 overflow-hidden rounded-xl">
            <img
              src={p.image}
              alt=""
              className="w-full aspect-[4/3] object-cover portfolio-img"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-lg font-serif font-semibold text-charcoal">{p.name}</h4>
            {p.tagline && <p className="mt-1 text-sm text-charcoal/70">{p.tagline}</p>}
          </div>
          <span
            className={cls(
              "inline-flex items-center justify-center rounded-full w-6 h-6 text-[12px] font-bold",
              selected
                ? "bg-wine text-white"
                : "bg-cream text-burgundy border border-burgundy/30 group-hover:bg-gold group-hover:text-charcoal group-hover:border-gold/50"
            )}
          >
            {selected ? "✓" : "+"}
          </span>
        </div>

        {p.desc && <p className="mt-3 text-sm text-charcoal/80">{p.desc}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-charcoal/70">
          {p.duration && <Badge>{p.duration}</Badge>}
          {p.includes?.slice(0, 3).map((it, i) => (
            <Badge key={i}>{it}</Badge>
          ))}
          {p.featured && <Badge tone="gold">Popular</Badge>}
        </div>
      </div>
    </button>
  );
}

function Badge({ children, tone }) {
  const tones =
    tone === "gold"
      ? "border-gold/40 bg-gold/15 text-charcoal"
      : "border-burgundy/25 bg-burgundy/5 text-burgundy";
  return (
    <span className={cls("inline-flex items-center rounded-full px-2 py-0.5 border", tones)}>
      {children}
    </span>
  );
}
