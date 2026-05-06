import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { motion, AnimatePresence } from "framer-motion";

export default function CropModal({
  imageUrl,
  aspect = 1,
  initialCrop = null,
  onSave,
  onCancel,
}) {
  const [crop, setCrop] = useState(initialCrop?.cropPos || { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCrop?.zoom || 1);
  const [croppedArea, setCroppedArea] = useState(initialCrop?.area || null);

  const onCropComplete = useCallback((area, areaPixels) => {
    // area is in percentages (0-100) of source image — exactly what we need.
    setCroppedArea(area);
  }, []);

  const handleSave = () => {
    if (!croppedArea) {
      onCancel?.();
      return;
    }
    onSave({
      area: croppedArea,
      cropPos: crop,
      zoom,
    });
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center bg-burgundy/40 backdrop-blur-sm p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="bg-cream rounded-2xl shadow-[0_30px_80px_-20px_rgba(74,14,26,0.55)] ring-1 ring-burgundy/15 w-full max-w-3xl overflow-hidden flex flex-col"
          style={{ maxHeight: "90vh" }}
        >
          <div className="px-5 py-3 border-b border-burgundy/10 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-semibold text-burgundy">
                Adjust crop
              </h3>
              <p className="text-[11px] uppercase tracking-[0.2em] text-charcoal/55 mt-0.5">
                Drag to pan · Scroll or pinch to zoom
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="grid place-items-center w-8 h-8 rounded-full text-charcoal/60 hover:bg-burgundy/10 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="relative bg-charcoal" style={{ height: "min(60vh, 480px)" }}>
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              showGrid={true}
              restrictPosition={true}
              style={{
                containerStyle: { background: "#1a0309" },
                cropAreaStyle: { border: "1px solid rgba(70,84,59,0.7)", color: "rgba(74,14,26,0.65)" },
              }}
            />
          </div>

          <div className="px-5 py-4 border-t border-burgundy/10 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-sans uppercase tracking-[0.2em] text-charcoal/55 w-12">
                Zoom
              </span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-wine"
              />
              <span className="text-xs font-mono text-charcoal/70 w-12 text-right">
                {zoom.toFixed(2)}×
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-charcoal/65 hover:text-burgundy transition-colors"
              >
                Reset
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-cream ring-1 ring-burgundy/15 text-charcoal/70 hover:text-burgundy transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-olive text-cream hover:bg-burgundy shadow-soft transition-colors"
                >
                  Save crop
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
