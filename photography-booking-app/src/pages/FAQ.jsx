// src/pages/FAQ.jsx
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

function cls(...xs) { return xs.filter(Boolean).join(" "); }

const FAQ_ITEMS = [
  {
    q: "What should I wear for my session?",
    a: "Be you! The best photos come when you feel like yourself. Wear what makes you comfortable, confident, and happy. I can give tips for colors or styles, but the most important thing is that it feels like you.",
  },
  {
    q: "What if I need to reschedule or cancel my session?",
    a: "Life happens! If you need to reschedule, just let me know as soon as possible. Your 25% deposit is applied to the new date, so rescheduling won't cost extra. If you need to cancel, please give at least 48 hours' notice. The deposit is non-refundable but this doesn't affect rescheduling—it just holds your spot.",
  },
  {
    q: "Do you travel for sessions, and are there travel fees?",
    a: "Yes! I love exploring new locations. Travel fees are based on distance: 0–20 miles is free, 21–40 miles is $15, 41–60 miles is $25, 61–80 miles is $40, and 80+ miles requires a custom quote.",
  },
  {
    q: "How long until I receive my photos?",
    a: "For most sessions, you'll receive your edited photos within 2-3 weeks. For larger events, it may take up to 4 weeks. I'll keep you updated throughout the process!",
  },
  {
    q: "Do you provide raw/unedited photos?",
    a: "I don't provide raw files as my editing style is an integral part of my work. However, you'll receive a carefully curated set of fully edited images that tell your story beautifully.",
  },
  {
    q: "What happens if it rains on the day of our outdoor session?",
    a: "We'll work together to either find a covered backup location or reschedule to another date that works for both of us. No extra fees for weather reschedules!",
  },
];

export default function FAQ() {
  const [headerVisible, setHeaderVisible] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    setHeaderVisible(true);
  }, []);

  const toggleItem = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <>
      <Helmet>
        <title>FAQ | Lama Wafa Photography</title>
        <meta
          name="description"
          content="Frequently asked questions about booking a photography session with Lama Wafa."
        />
        <link rel="canonical" href="https://lamawafa.com/faq" />
      </Helmet>

      <div className="min-h-screen bg-cream">
        {/* Header */}
        <section className="relative bg-burgundy overflow-hidden -mt-16 md:-mt-20 pt-24 md:pt-32 pb-16 md:pb-20">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/2 w-96 h-96 bg-gold rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-gold rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className={cls(
                "transition-all duration-1000",
                headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
            >
              <div className="w-12 h-0.5 bg-gold mb-6" />
              <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-white">
                Frequently Asked Questions
              </h1>
              <p className="mt-4 text-lg text-white/70 max-w-2xl">
                Everything you need to know about working with me.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Items */}
        <section className="py-12 md:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-4">
              {FAQ_ITEMS.map((item, index) => (
                <AccordionItem
                  key={index}
                  question={item.q}
                  answer={item.a}
                  isOpen={openIndex === index}
                  onToggle={() => toggleItem(index)}
                  delay={index * 50}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-16 md:py-24 bg-gradient-to-br from-burgundy via-maroon to-wine relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="w-12 h-0.5 bg-gold mx-auto mb-6" />
            <h2 className="font-serif text-2xl md:text-3xl font-light text-white">
              Still have questions?
            </h2>
            <p className="mt-4 text-white/70 max-w-xl mx-auto">
              I'm happy to help! Reach out anytime and I'll get back to you as soon as possible.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a
                href="mailto:lamawafa13@gmail.com"
                className="btn btn-gold px-8"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Email Me
              </a>
              <Link to="/booking" className="btn btn-outline px-8">
                Book a Session
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function AccordionItem({ question, answer, isOpen, onToggle, delay }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cls(
        "bg-white border border-burgundy/10 overflow-hidden transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        isOpen ? "shadow-lg border-gold/50" : "shadow-soft hover:shadow-lg hover:border-burgundy/20"
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left"
      >
        <h3 className="font-medium text-charcoal pr-4">{question}</h3>
        <div
          className={cls(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
            isOpen ? "bg-gold text-charcoal" : "bg-burgundy/10 text-burgundy"
          )}
        >
          <svg
            className={cls("w-4 h-4 transition-transform duration-300", isOpen && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </button>
      <div
        className={cls(
          "overflow-hidden transition-all duration-300 ease-out",
          isOpen ? "max-h-96" : "max-h-0"
        )}
      >
        <div className="px-5 md:px-6 pb-5 md:pb-6">
          <div className="pt-0 border-t border-burgundy/10">
            <p className="pt-4 text-charcoal/70 leading-relaxed">{answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
