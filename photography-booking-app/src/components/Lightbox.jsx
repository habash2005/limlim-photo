// src/components/Lightbox.jsx
import React, { useEffect, useCallback, useState } from "react";

export default function Lightbox({ images = [], currentIndex = 0, onClose, onNavigate }) {
  const [touchStart, setTouchStart] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentImage = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goNext = useCallback(() => {
    if (hasNext && onNavigate) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  const goPrev = useCallback(() => {
    if (hasPrev && onNavigate) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, goNext, goPrev]);

  // Reset loading state when image changes
  useEffect(() => {
    setIsLoading(true);
  }, [currentIndex]);

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
  };

  if (!currentImage) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-gold/80 flex items-center justify-center text-white transition-colors"
        aria-label="Close lightbox"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image counter */}
      <div className="absolute top-4 left-4 z-10 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Navigation arrows */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-full bg-white/10 hover:bg-gold/80 flex items-center justify-center text-white transition-all hover:scale-105"
          aria-label="Previous image"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-full bg-white/10 hover:bg-gold/80 flex items-center justify-center text-white transition-all hover:scale-105"
          aria-label="Next image"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Main image container */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4 md:p-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white/20 border-t-gold rounded-full animate-spin" />
          </div>
        )}

        <img
          src={currentImage.src || currentImage.secure_url}
          alt={currentImage.alt || currentImage.original_filename || "Photo"}
          className={`max-w-full max-h-full object-contain portfolio-img transition-opacity duration-300 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
          onLoad={() => setIsLoading(false)}
          onClick={(e) => e.stopPropagation()}
          loading="eager"
          decoding="sync"
          fetchpriority="high"
        />
      </div>

      {/* Image info (optional) */}
      {(currentImage.alt || currentImage.original_filename) && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm">
          {currentImage.alt || currentImage.original_filename}
        </div>
      )}

      {/* Thumbnail strip (optional for large galleries) */}
      {images.length > 1 && images.length <= 20 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-full bg-white/10 backdrop-blur-sm max-w-[90vw] overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={img.id || idx}
              onClick={(e) => { e.stopPropagation(); onNavigate?.(idx); }}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all ${
                idx === currentIndex
                  ? "ring-2 ring-gold scale-110"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={img.src || img.secure_url}
                alt=""
                className="w-full h-full object-cover portfolio-img"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
