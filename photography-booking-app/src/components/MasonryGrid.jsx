// src/components/MasonryGrid.jsx
import React, { useState } from "react";

function cls(...xs) { return xs.filter(Boolean).join(" "); }

export default function MasonryGrid({ items = [], className = "", onImageClick }) {
  const [loadedImages, setLoadedImages] = useState({});

  const handleImageLoad = (id) => {
    setLoadedImages((prev) => ({ ...prev, [id]: true }));
  };

  const handleClick = (e, index) => {
    if (onImageClick) {
      e.preventDefault();
      onImageClick(index);
    }
  };

  return (
    <div
      className={cls(
        "columns-1 sm:columns-2 xl:columns-3 2xl:columns-4",
        "gap-3 sm:gap-4",
        className
      )}
    >
      {items.map((item, index) => (
        <a
          key={item.id}
          href={item.src}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => handleClick(e, index)}
          className="group relative block mb-3 sm:mb-4 break-inside-avoid overflow-hidden"
        >
          <img
            src={item.src}
            alt={item.alt || ""}
            loading="lazy"
            decoding="async"
            onLoad={() => handleImageLoad(item.id)}
            className={cls(
              "w-full h-auto object-cover portfolio-img transition-opacity duration-300",
              loadedImages[item.id] ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-burgundy/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* View indicator */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-14 h-14 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-glow transform scale-90 group-hover:scale-100 transition-transform duration-300">
              <svg className="w-6 h-6 text-burgundy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
              </svg>
            </div>
          </div>

          {/* Loading skeleton */}
          {!loadedImages[item.id] && (
            <div className="absolute inset-0 bg-burgundy/10 animate-pulse" />
          )}
        </a>
      ))}
    </div>
  );
}
