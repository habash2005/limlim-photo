// src/pages/Home.jsx
import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { db } from "../lib/firebase";
import { collection, getDocs, limit, query, where } from "firebase/firestore";

// Hero image
import heroImg from "../img_4942.jpg";

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
function AnimatedSection({ children, className = "", delay = 0, direction = "up" }) {
  const [ref, isInView] = useInView();

  const transforms = {
    up: "translateY(40px)",
    down: "translateY(-40px)",
    left: "translateX(40px)",
    right: "translateX(-40px)",
    none: "translateY(0)",
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? "none" : transforms[direction],
        transition: `opacity 0.7s ease-out ${delay}ms, transform 0.7s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// Services data
const SERVICES = [
  {
    id: "events",
    name: "Events",
    desc: "Concerts, celebrations, and gatherings captured with energy and authenticity.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    ),
  },
  {
    id: "branding",
    name: "Branding",
    desc: "Professional imagery that elevates your personal brand and business.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
    ),
  },
  {
    id: "portraits",
    name: "Portraits",
    desc: "Seniors, milestones, and personal portraits that tell your story.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
    ),
  },
  {
    id: "couples",
    name: "Couples",
    desc: "Celebrating love and connection through timeless imagery.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
      </svg>
    ),
  },
];


export default function Home() {
  const [portfolioImages, setPortfolioImages] = useState([]);

  // Load portfolio images
  useEffect(() => {
    (async () => {
      try {
        const galSnap = await getDocs(
          query(collection(db, "galleries"), where("tag", "==", "portfolio"), limit(1))
        );
        if (galSnap.empty) return;
        const galId = galSnap.docs[0].id;
        const imgsSnap = await getDocs(query(collection(db, `galleries/${galId}/images`), limit(8)));
        const rows = imgsSnap.docs.map((d) => d.data());
        rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setPortfolioImages(rows.map((r) => ({
          id: r.public_id,
          src: r.secure_url,
          alt: r.original_filename || r.public_id,
          width: r.width || 1,
          height: r.height || 1,
          isPortrait: (r.height || 1) > (r.width || 1),
        })));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);


  return (
    <>
      <Helmet>
        <title>Lama Wafa | Portrait & Event Photography in Raleigh, NC</title>
        <meta
          name="description"
          content="Professional portrait and event photography in Raleigh, NC. Capturing life's beautiful moments with artistry and authenticity."
        />
      </Helmet>

      {/* ==================== HERO SECTION ==================== */}
      <section className="hero-fullscreen -mt-16 md:-mt-20">
        {/* Background Image - Photographer portrait */}
        <div className="absolute inset-0">
          <img
            src={heroImg}
            alt="Lama Wafa - Photographer"
            className="w-full h-full object-cover object-[50%_20%]"
            loading="eager"
          />
        </div>

        {/* Overlay */}
        <div className="hero-overlay" />

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="animate-fade-in-up">
            <div className="line-gold mx-auto mb-8" />
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-white leading-tight">
              Capturing Life's
              <br />
              <span className="italic text-gold">Beautiful Moments</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
              Portrait & Event Photography in Raleigh, NC
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/booking" className="btn btn-gold px-8 py-4 text-base">
                Book Your Session
              </Link>
              <Link to="/portfolio" className="btn btn-outline px-8 py-4 text-base">
                View Portfolio
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 scroll-indicator">
          <div className="w-8 h-12 rounded-full border-2 border-white/30 flex items-start justify-center pt-2">
            <div className="w-1.5 h-3 bg-gold rounded-full animate-bounce-slow" />
          </div>
        </div>
      </section>

      {/* ==================== ABOUT SECTION ==================== */}
      <section className="section bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <span className="text-gold text-sm font-medium tracking-widest uppercase">About Me</span>
            <h2 className="mt-4 font-serif text-3xl md:text-4xl text-charcoal leading-tight">
              Hi, I'm Lama
            </h2>
            <div className="mt-6 space-y-4 text-charcoal/70 leading-relaxed max-w-2xl mx-auto">
              <p>
                I'm a Palestinian photographer based in Raleigh, NC, with a passion for
                capturing authentic moments that tell your unique story.
              </p>
              <p>
                Whether it's the joy of a milestone celebration, the energy of a live event,
                or the intimacy of a portrait session, I believe every photograph should
                feel genuine and timeless.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ==================== PORTFOLIO GALLERY ==================== */}
      {portfolioImages.length > 0 && (
        <section className="bg-cream">
          {/* Header */}
          <div className="py-12 md:py-16 text-center px-4">
            <AnimatedSection>
              <span className="text-gold text-sm font-medium tracking-widest uppercase">Portfolio</span>
              <h2 className="mt-4 font-serif text-3xl md:text-4xl lg:text-5xl text-charcoal">
                Recent Work
              </h2>
            </AnimatedSection>
          </div>

          {/* Full-width Masonry Grid */}
          <div className="w-full columns-2 md:columns-3 lg:columns-4 gap-1 md:gap-2 px-1 md:px-2">
            {portfolioImages.map((img, idx) => (
              <AnimatedSection
                key={img.id}
                className="break-inside-avoid mb-1 md:mb-2"
                delay={idx * 100}
              >
                <div className="relative w-full overflow-hidden group">
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full h-auto object-cover portfolio-img"
                    loading={idx < 4 ? "eager" : "lazy"}
                    decoding="async"
                    fetchpriority={idx === 0 ? "high" : undefined}
                    style={{
                      aspectRatio: `${img.width} / ${img.height}`,
                    }}
                  />
                  <div className="absolute inset-0 bg-burgundy/0 group-hover:bg-burgundy/20 transition-colors duration-500" />
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* CTA Button */}
          <AnimatedSection delay={800}>
            <div className="py-12 md:py-16 text-center">
              <Link to="/portfolio" className="btn btn-primary">
                View Full Portfolio
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>
              </Link>
            </div>
          </AnimatedSection>
        </section>
      )}

      {/* ==================== SERVICES SECTION ==================== */}
      <section className="section bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="text-gold text-sm font-medium tracking-widest uppercase">Services</span>
              <h2 className="mt-4 font-serif text-3xl md:text-4xl lg:text-5xl text-charcoal">
                What I Offer
              </h2>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-burgundy/10">
            {SERVICES.map((service, idx) => (
              <AnimatedSection key={service.id} delay={idx * 100}>
                <Link
                  to={`/booking?service=${service.id}`}
                  className="block bg-white p-8 h-full text-center group hover:bg-cream transition-colors duration-300"
                >
                  <div className="w-14 h-14 mx-auto bg-burgundy/5 group-hover:bg-gold/20 flex items-center justify-center text-burgundy group-hover:text-wine transition-all duration-300">
                    {service.icon}
                  </div>
                  <h3 className="mt-6 font-serif text-xl text-charcoal">{service.name}</h3>
                  <p className="mt-3 text-sm text-charcoal/60 leading-relaxed">{service.desc}</p>
                  <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-burgundy group-hover:text-gold transition-colors">
                    Book Now
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </span>
                </Link>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FINAL CTA SECTION ==================== */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-burgundy via-maroon to-wine" />
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gold rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <div className="w-12 h-0.5 bg-gold mx-auto mb-8" />
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-white leading-tight">
              Ready to Create Something
              <br />
              <span className="text-gold italic">Beautiful?</span>
            </h2>
            <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto">
              Book your session today and let's capture moments that will last a lifetime.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/booking" className="btn btn-gold px-8 py-4 text-base">
                Book Your Session
              </Link>
              <a
                href="https://instagram.com/lama.wafa"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline px-8 py-4 text-base"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                </svg>
                @lama.wafa
              </a>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
