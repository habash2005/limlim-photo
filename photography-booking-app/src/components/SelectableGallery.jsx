/* ----------------- SelectableGallery (Portfolio/Home look) ----------------- */
function SelectableGallery({ items, selected, onToggle, layout = "square" }) {
    if (layout === "masonry") {
      // Home-style natural aspect masonry
      return (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {items.map((img) => (
            <figure
              key={img.public_id}
              className="mb-4 break-inside-avoid rounded-2xl border border-burgundy/15 bg-white/70 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-lg transition-shadow relative group"
              title={img.original_filename || img.public_id}
            >
              <img
                src={img.secure_url}
                alt={img.original_filename || img.public_id}
                loading="lazy"
                decoding="async"
                className="w-full h-auto object-cover portfolio-img"
              />
  
              {/* overlay checkbox */}
              <SelectOverlay
                checked={!!selected[img.public_id]}
                onChange={() => onToggle(img.public_id)}
              />
            </figure>
          ))}
        </div>
      );
    }
  
    // Portfolio-style uniform squares
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((img) => (
          <figure
            key={img.public_id}
            className="relative overflow-hidden rounded-2xl border border-burgundy/15 bg-white/70 backdrop-blur-sm shadow-sm hover:shadow-lg transition-shadow"
            title={img.original_filename || img.public_id}
          >
            <div className="aspect-square w-full">
              <img
                src={img.secure_url}
                alt={img.original_filename || img.public_id}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover portfolio-img"
              />
            </div>
  
            {/* overlay checkbox */}
            <SelectOverlay
              checked={!!selected[img.public_id]}
              onChange={() => onToggle(img.public_id)}
            />
          </figure>
        ))}
      </div>
    );
  }
  
  /* ----------------------------- Overlay control ---------------------------- */
  function SelectOverlay({ checked, onChange }) {
    return (
      <>
        {/* subtle top gradient for contrast */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <label className="absolute top-2 left-2 inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="peer sr-only"
          />
          <span
            className={cls(
              "grid place-items-center w-7 h-7 rounded-full text-[12px] font-bold shadow-soft transition-colors",
              checked
                ? "bg-wine text-white ring-2 ring-gold"
                : "bg-white/90 text-charcoal ring-1 ring-burgundy/20 hover:bg-gold/20"
            )}
            aria-hidden
          >
            {checked ? "✓" : "+"}
          </span>
        </label>
        {/* 'Original' link on hover, top-right */}
        <a
          className="absolute top-2 right-2 text-[11px] underline decoration-1 text-white/95 hover:text-gold opacity-0 group-hover:opacity-100 transition-opacity"
          href="#"
          onClick={(e) => {
            // prevent immediate navigation when label clicked
            e.preventDefault();
            const fig = e.currentTarget.closest("figure");
            const img = fig?.querySelector("img");
            if (img?.src) window.open(img.src, "_blank", "noopener,noreferrer");
          }}
        >
          Original
        </a>
      </>
    );
  }
  