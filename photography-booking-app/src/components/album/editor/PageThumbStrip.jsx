import React, { memo } from "react";
import { renderTemplateThumbSvg, getTemplate } from "../albumTemplates";

const PageThumb = memo(function PageThumb({ page, index, current, onClick, theme }) {
  const tpl = getTemplate(page.templateId);
  const svg = renderTemplateThumbSvg(tpl, {
    fill: theme.accent,
    bg: theme.pageBg,
    textFill: theme.accent,
  });
  const active = index === current;
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => onClick(index)}
        aria-label={`Page ${index + 1}`}
        aria-current={active ? "true" : undefined}
        className={`relative aspect-[3/4] w-16 rounded-[3px] overflow-hidden ring-1 transition-all
                    ${
                      active
                        ? "ring-2 ring-gold ring-offset-2 ring-offset-white shadow-soft"
                        : "ring-burgundy/15 hover:ring-burgundy/40"
                    }`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span
        className={`text-[10px] font-mono ${
          active ? "text-burgundy font-semibold" : "text-charcoal/50"
        }`}
      >
        {index + 1}
      </span>
    </div>
  );
});

export default function PageThumbStrip({
  pages,
  currentIndex,
  theme,
  isAlbumMode,
  onSelect,
  onSelectAlbum,
  onAddPage,
  onDeletePage,
  onDuplicatePage,
  onMovePage,
}) {
  return (
    <div className="border-t border-burgundy/10 bg-white/80 backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-3 overflow-x-auto px-4 py-3">
        {/* Album / Cover button — first tile, special */}
        <button
          type="button"
          onClick={onSelectAlbum}
          aria-label="Edit album cover and theme"
          aria-current={isAlbumMode ? "true" : undefined}
          className="shrink-0 flex flex-col items-center gap-1 group"
        >
          <span
            className={`grid place-items-center aspect-[3/4] w-16 rounded-[3px] overflow-hidden transition-all
                       ${
                         isAlbumMode
                           ? "ring-2 ring-gold ring-offset-2 ring-offset-white shadow-soft"
                           : "ring-1 ring-burgundy/15 hover:ring-burgundy/40"
                       }`}
            style={{
              background: "radial-gradient(ellipse at 30% 20%, #6B1224 0%, #4A0E1A 55%, #2A0610 100%)",
            }}
          >
            <span className="text-gold/85 font-serif text-lg tracking-[0.2em]">LW</span>
          </span>
          <span
            className={`text-[10px] font-mono ${
              isAlbumMode ? "text-burgundy font-semibold" : "text-charcoal/50"
            }`}
          >
            Cover
          </span>
        </button>

        <span className="h-12 w-px bg-burgundy/15 shrink-0" aria-hidden />

        {pages.map((page, i) => (
          <PageThumb
            key={page.id || `p-${i}`}
            page={page}
            index={i}
            current={isAlbumMode ? -1 : currentIndex}
            theme={theme}
            onClick={onSelect}
          />
        ))}

        <button
          type="button"
          onClick={onAddPage}
          aria-label="Add page"
          className="shrink-0 flex flex-col items-center gap-1 group"
        >
          <span className="grid place-items-center aspect-[3/4] w-16 rounded-[3px] border-2 border-dashed border-burgundy/30 bg-cream group-hover:border-burgundy/60 group-hover:bg-gold/10 transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-burgundy/60"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-charcoal/55">
            Add
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMovePage?.(currentIndex, currentIndex - 1)}
            disabled={pages.length === 0 || currentIndex <= 0}
            aria-label="Move page left"
            title="Move page left"
            className="grid place-items-center w-8 h-8 rounded-full bg-cream ring-1 ring-burgundy/15 text-burgundy hover:bg-gold/20 disabled:opacity-40 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMovePage?.(currentIndex, currentIndex + 1)}
            disabled={pages.length === 0 || currentIndex >= pages.length - 1}
            aria-label="Move page right"
            title="Move page right"
            className="grid place-items-center w-8 h-8 rounded-full bg-cream ring-1 ring-burgundy/15 text-burgundy hover:bg-gold/20 disabled:opacity-40 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <span className="w-2" />
          <button
            type="button"
            onClick={() => onDuplicatePage(currentIndex)}
            disabled={pages.length === 0}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-cream ring-1 ring-burgundy/15 text-burgundy hover:bg-gold/20 disabled:opacity-40 transition-colors"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => onDeletePage(currentIndex)}
            disabled={pages.length === 0}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-cream ring-1 ring-burgundy/15 text-wine hover:bg-wine/10 disabled:opacity-40 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
