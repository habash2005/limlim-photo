import React, { useEffect, useRef, useState } from "react";
import AlbumPage from "../AlbumPage";

const PAGE_W = 720;
const PAGE_H = 960;

export default function PageCanvas({
  page,
  pageNumber,
  totalPages,
  theme,
  imagesById,
  selectedSlotKey,
  selectedTextKey,
  onSlotClick,
  onTextEdit,
  onAssignPhoto,
  onDeselect,
}) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.7);
  const [dragOverSlot, setDragOverSlot] = useState(null);

  useEffect(() => {
    function recalc() {
      const wrap = wrapRef.current;
      if (!wrap) return;
      // Fit to width primarily; scroll vertically if the page is taller than available.
      const availW = wrap.clientWidth - 32;
      const sx = availW / PAGE_W;
      setScale(Math.max(0.3, Math.min(1, sx)));
    }
    recalc();
    const ro = new ResizeObserver(recalc);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, []);

  // Map a pointer event to a slot index by hit-testing absolute slot rects.
  const hitSlotKey = (clientX, clientY) => {
    const stage = wrapRef.current?.querySelector("[data-album-stage]");
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const slots = stage.querySelectorAll("figure[data-slot-key]");
    for (const fig of slots) {
      const r = fig.getBoundingClientRect();
      if (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      ) {
        return fig.getAttribute("data-slot-key");
      }
    }
    return null;
  };

  const onDragOver = (e) => {
    if (!e.dataTransfer.types.includes("application/x-album-photo")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const key = hitSlotKey(e.clientX, e.clientY);
    setDragOverSlot(key);
  };

  const onDragLeave = () => setDragOverSlot(null);

  const onDrop = (e) => {
    const publicId = e.dataTransfer.getData("application/x-album-photo");
    if (!publicId) return;
    e.preventDefault();
    const key = hitSlotKey(e.clientX, e.clientY);
    setDragOverSlot(null);
    if (key !== null) onAssignPhoto?.(key, publicId);
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full min-h-0 flex items-start justify-center overflow-y-auto overflow-x-hidden pt-6 pb-10 px-4"
      style={{
        minHeight: 0,
        background: "radial-gradient(ellipse at center, #FFFAF0 0%, #FBF6EE 100%)",
      }}
      onClick={onDeselect}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center">
        <div
          style={{
            width: PAGE_W * scale,
            height: PAGE_H * scale,
            position: "relative",
          }}
        >
          <div
            data-album-stage
            className="absolute top-0 left-0 shadow-[0_30px_80px_-30px_rgba(74,14,26,0.45)]"
            style={{
              width: PAGE_W,
              height: PAGE_H,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            <SlotKeyAttacher>
              <AlbumPage
                page={page}
                theme={theme}
                imagesById={imagesById}
                pageNumber={pageNumber}
                totalPages={totalPages}
                shouldLoad={true}
                mode="edit"
                isPortrait={true}
                onSlotClick={onSlotClick}
                onTextEdit={onTextEdit}
                editorSelectedSlot={selectedSlotKey}
                editorSelectedText={selectedTextKey}
                onEmptyClick={onDeselect}
              />
            </SlotKeyAttacher>

            {dragOverSlot !== null && (
              <DragHighlight slotKey={dragOverSlot} />
            )}
          </div>
        </div>

        <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-charcoal/40 font-sans">
          Page {pageNumber} of {totalPages}
        </div>
      </div>
    </div>
  );
}

// Attaches data-slot-key to each rendered figure for drop hit-testing.
function SlotKeyAttacher({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const figures = ref.current.querySelectorAll("figure");
    figures.forEach((f, i) => {
      f.setAttribute("data-slot-key", String(i));
    });
  });
  return (
    <div ref={ref} className="relative w-full h-full">
      {children}
    </div>
  );
}

function DragHighlight({ slotKey }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 ring-4 ring-gold/70 ring-offset-2 ring-offset-cream rounded-sm animate-pulse"
      data-debug={slotKey}
    />
  );
}
