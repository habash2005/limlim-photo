// src/pages/Portfolio.jsx
import React, { useEffect, useState, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import Lightbox from "../components/Lightbox";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

// Intersection Observer hook for animations
function useInView(options = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.1, ...options });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, isInView];
}

// Animated Section wrapper
function AnimatedSection({ children, className = "", delay = 0 }) {
  const [ref, isInView] = useInView();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? "none" : "translateY(40px)",
        transition: `opacity 0.7s ease-out ${delay}ms, transform 0.7s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function Portfolio() {
  const [images, setImages] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for header transparency
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const galSnap = await getDocs(
          query(collection(db, "galleries"), where("tag", "==", "portfolio"), limit(1))
        );
        if (galSnap.empty) { setImages([]); return; }
        const galId = galSnap.docs[0].id;

        const imgsSnap = await getDocs(collection(db, `galleries/${galId}/images`));
        const rows = imgsSnap.docs.map(d => d.data());
        rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        setImages(rows.map(r => ({
          id: r.public_id,
          src: r.secure_url,
          alt: r.original_filename || r.public_id,
          width: r.width,
          height: r.height,
          filename: r.original_filename
        })));
      } catch (e) {
        console.error(e);
        setErr("Could not load portfolio images.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Helmet>
        <title>Portfolio | Lama Wafa Photography</title>
        <meta
          name="description"
          content="Browse the portfolio of Lama Wafa, a photographer based in Raleigh, NC."
        />
        <link rel="canonical" href="https://lamawafa.com/portfolio" />
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* Elegant Header */}
        <section
          className={`relative pt-24 md:pt-28 pb-8 md:pb-10 overflow-hidden transition-all duration-500 ${
            scrolled ? "bg-burgundy/80 backdrop-blur-sm" : "bg-burgundy"
          }`}
        >
          {/* Subtle background accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gold/10 rounded-full blur-3xl" />

          {/* Content */}
          <div className="relative text-center px-4">
            {/* Decorative line */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 md:w-12 h-px bg-gradient-to-r from-transparent to-gold/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-gold/50" />
              <div className="w-8 md:w-12 h-px bg-gradient-to-l from-transparent to-gold/60" />
            </div>

            <h1 className="font-serif text-4xl md:text-5xl font-light text-white tracking-tight">
              Portfolio
            </h1>

            <p className="mt-2 text-white/70 text-base md:text-lg">
              A collection of moments, beautifully preserved
            </p>

            {/* Bottom decorative element */}
            <div className="mt-5 flex items-center justify-center">
              <div className="w-16 md:w-24 h-0.5 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
            </div>
          </div>
        </section>

        {/* Full-width Masonry Gallery */}
        {!loading && images.length > 0 && (
          <section className="bg-white py-8 md:py-12">
            <div className="w-full columns-2 md:columns-3 lg:columns-4 gap-1 md:gap-2">
              {images.map((img, idx) => (
                <AnimatedSection
                  key={img.id}
                  className="break-inside-avoid mb-1 md:mb-2"
                  delay={Math.min(idx * 50, 500)}
                >
                  <button
                    onClick={() => setLightboxIndex(idx)}
                    className="relative w-full overflow-hidden group cursor-pointer block"
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="w-full h-auto object-cover portfolio-img"
                      loading={idx < 8 ? "eager" : "lazy"}
                      decoding="async"
                      fetchpriority={idx === 0 ? "high" : undefined}
                      style={{
                        aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : 'auto',
                      }}
                    />
                    <div className="absolute inset-0 bg-burgundy/0 group-hover:bg-burgundy/30 transition-colors duration-500 flex items-center justify-center">
                      <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <svg className="w-5 h-5 text-burgundy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                        </svg>
                      </span>
                    </div>
                  </button>
                </AnimatedSection>
              ))}
            </div>
          </section>
        )}

        {/* Loading State */}
        {loading && (
          <section className="pb-8 md:pb-12 bg-white">
            <div className="w-full columns-2 md:columns-3 lg:columns-4 gap-1 md:gap-2">
              {[...Array(12)].map((_, idx) => (
                <div
                  key={idx}
                  className="break-inside-avoid mb-1 md:mb-2 bg-burgundy/5 animate-pulse"
                  style={{ aspectRatio: idx % 3 === 0 ? '3/4' : '4/3' }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Error State */}
        {err && (
          <section className="py-16 bg-white">
            <div className="max-w-4xl mx-auto px-4 text-center">
              <div className="p-6 bg-red-50 border border-red-100 text-red-600">
                {err}
              </div>
            </div>
          </section>
        )}

        {/* Instagram Section */}
        <section className="py-16 md:py-24 bg-white border-t border-burgundy/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimatedSection>
              <div className="text-center">
                <span className="text-gold text-sm font-medium tracking-widest uppercase">Follow Along</span>
                <h2 className="mt-4 font-serif text-3xl md:text-4xl text-charcoal">
                  @lama.wafa
                </h2>
                <p className="mt-4 text-charcoal/60 max-w-lg mx-auto">
                  Follow my journey on Instagram for behind-the-scenes content, recent sessions, and photography tips.
                </p>
              </div>
            </AnimatedSection>

            {/* Instagram Grid - Uses portfolio images */}
            <AnimatedSection delay={200}>
              <div className="mt-12 grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
                {images.slice(0, 6).map((img, idx) => (
                  <a
                    key={img.id || idx}
                    href="https://instagram.com/lama.wafa"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square overflow-hidden group"
                  >
                    <img
                      src={img.src}
                      alt=""
                      className="w-full h-full object-cover portfolio-img"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-burgundy/0 group-hover:bg-burgundy/50 transition-colors duration-300 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            </AnimatedSection>

            <AnimatedSection delay={400}>
              <div className="mt-10 text-center">
                <a
                  href="https://instagram.com/lama.wafa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-medium hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                  </svg>
                  Follow @lama.wafa
                </a>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-28 bg-burgundy relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gold rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
          </div>

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <AnimatedSection>
              <div className="w-12 h-0.5 bg-gold mx-auto mb-8" />
              <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-white leading-tight">
                Ready to Create Something
                <br />
                <span className="text-gold italic">Beautiful?</span>
              </h2>
              <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto">
                Let's work together to capture your special moments.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/booking" className="btn btn-gold px-8 py-4 text-base">
                  Book Your Session
                </Link>
                <a href="mailto:lamawafa13@gmail.com" className="btn btn-outline px-8 py-4 text-base">
                  Get in Touch
                </a>
              </div>
            </AnimatedSection>
          </div>
        </section>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(index) => setLightboxIndex(index)}
        />
      )}
    </>
  );
}
