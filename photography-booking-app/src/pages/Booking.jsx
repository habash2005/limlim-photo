// src/pages/Booking.jsx
import React, { useMemo, useState, useEffect } from "react";
import { checkAvailability, submitBooking } from "../lib/api";
import { Helmet } from "react-helmet-async";

/* -------------------------------- Services -------------------------------- */
const SERVICES = [
  {
    id: "events",
    name: "Events",
    duration: "2 hours",
    desc: "Concerts, celebrations, and gatherings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    ),
  },
  {
    id: "branding",
    name: "Branding",
    duration: "60 min",
    desc: "Professional photos for your business and personal brand",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
    ),
  },
  {
    id: "portraits",
    name: "Portraits + Milestones",
    duration: "45–60 min",
    desc: "Seniors, milestone, and personal portraits",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
    ),
  },
  {
    id: "couples",
    name: "Couples",
    duration: "60 min",
    desc: "Celebrating love and shared moments",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
      </svg>
    ),
  },
];

/* ----------------------------- Time utilities ----------------------------- */
const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 21 * 60 + 30;
function buildTimes() {
  const out = [];
  for (let m = OPEN_MIN; m <= CLOSE_MIN; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push(`${hh}:${mm}`);
  }
  return out;
}
const TIME_OPTS = buildTimes();
function to12h(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}
function cls(...xs) { return xs.filter(Boolean).join(" "); }

/* --------------------------------- Page ----------------------------------- */
export default function Booking() {
  const [step, setStep] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    setHeaderVisible(true);
  }, []);

  // Selected service
  const [selected, setSelected] = useState({ ...SERVICES[0], price: 0 });

  // Date & time + availability
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [err, setErr] = useState("");

  // Core + extras
  const [details, setDetails] = useState({
    name: "", email: "", phone: "", location: "Studio",
    shootFor: "", locationNotes: "", notes: "",
    contactPref: "", bestContactTime: "", instagram: "", howHeard: "",
    peopleCount: "", organization: "", venueName: "", venueAddress: "",
    city: "", state: "", zip: "", indoorOutdoor: "", rainPlan: "",
    accessibility: "", shotList: "", moodboard: "", deadline: "",
    deliverables: "", usage: "", serviceOccasion: "",
  });

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const canNext0 = !!selected?.id;
  const canNext1 = !!date && !!time && availability === true;
  const canNext2 =
    details.name.trim() &&
    details.email.trim() &&
    details.phone.trim() &&
    details.location.trim();

  /* ------------------------- Availability check -------------------------- */
  async function doCheck() {
    setErr("");
    setAvailability(null);
    if (!date || !time) return;
    setChecking(true);
    const res = await checkAvailability({
      date,
      time,
      pkg: { id: selected.id, name: selected.name, price: 0, duration: selected.duration },
    });
    setAvailability(res.available);
    if (!res.available && res.reason) setErr(res.reason);
    setChecking(false);
  }

  /* ----------------------------- Submit flow ----------------------------- */
  function mergedNotesPayload(d) {
    const lines = [];
    if (d.contactPref)     lines.push(`Preferred contact: ${d.contactPref}`);
    if (d.bestContactTime) lines.push(`Best time to reach: ${d.bestContactTime}`);
    if (d.instagram)       lines.push(`Instagram: ${d.instagram}`);
    if (d.howHeard)        lines.push(`How they heard: ${d.howHeard}`);
    if (d.serviceOccasion) lines.push(`Occasion: ${d.serviceOccasion}`);
    if (d.organization)    lines.push(`Organization/School: ${d.organization}`);
    if (d.peopleCount)     lines.push(`People/Guests: ${d.peopleCount}`);
    const locBits = [];
    if (d.venueName)    locBits.push(`Venue: ${d.venueName}`);
    if (d.venueAddress) locBits.push(`Address: ${d.venueAddress}`);
    const cityStateZip = [d.city, d.state, d.zip].filter(Boolean).join(", ");
    if (cityStateZip)   locBits.push(`City/State/Zip: ${cityStateZip}`);
    if (d.indoorOutdoor)locBits.push(`Indoor/Outdoor: ${d.indoorOutdoor}`);
    if (d.rainPlan)     locBits.push(`Rain backup: ${d.rainPlan}`);
    if (d.accessibility)locBits.push(`Accessibility: ${d.accessibility}`);
    if (locBits.length) lines.push(locBits.join(" | "));
    if (d.shotList)  lines.push(`Shot list: ${d.shotList}`);
    if (d.moodboard) lines.push(`Mood board: ${d.moodboard}`);
    if (d.deadline)  lines.push(`Deadline/Needed by: ${d.deadline}`);
    if (d.deliverables) lines.push(`Deliverables: ${d.deliverables}`);
    if (d.usage)       lines.push(`Usage (branding): ${d.usage}`);
    if (d.notes) lines.push(`Notes: ${d.notes}`);
    return lines.join("\n");
  }

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { name, email, phone, location, shootFor } = details;

      const locNoteLines = [];
      if (details.venueName)    locNoteLines.push(`Venue: ${details.venueName}`);
      if (details.venueAddress) locNoteLines.push(`Address: ${details.venueAddress}`);
      if (details.city || details.state || details.zip) {
        locNoteLines.push(`City/State/Zip: ${[details.city, details.state, details.zip].filter(Boolean).join(", ")}`);
      }
      if (details.indoorOutdoor) locNoteLines.push(`Indoor/Outdoor: ${details.indoorOutdoor}`);
      if (details.rainPlan)      locNoteLines.push(`Rain backup: ${details.rainPlan}`);
      if (details.accessibility) locNoteLines.push(`Accessibility: ${details.accessibility}`);

      const sendDetails = {
        name, email, phone, location,
        shootFor: shootFor || selected.name,
        locationNotes: [details.locationNotes || "", ...locNoteLines].filter(Boolean).join("\n"),
        notes: mergedNotesPayload(details),
      };

      const res = await submitBooking({
        pkg: { id: selected.id, name: selected.name, price: 0, duration: selected.duration },
        date, time, details: sendDetails,
      });

      if (!res?.ok) throw new Error(res?.error || "Failed to submit booking");

      if (res.reference) localStorage.setItem("clientRef", res.reference);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert(e.message || "We couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(0);
    setSelected({ ...SERVICES[0], price: 0 });
    setDate("");
    setTime("");
    setAvailability(null);
    setDetails({
      name: "", email: "", phone: "", location: "Studio",
      shootFor: "", locationNotes: "", notes: "",
      contactPref: "", bestContactTime: "", instagram: "", howHeard: "",
      peopleCount: "", organization: "", venueName: "", venueAddress: "",
      city: "", state: "", zip: "", indoorOutdoor: "", rainPlan: "",
      accessibility: "", shotList: "", moodboard: "", deadline: "",
      deliverables: "", usage: "", serviceOccasion: "",
    });
    setSubmitting(false);
    setResult(null);
    setErr("");
  }

  const STEPS = ["Service", "Date & Time", "Details", "Review"];

  /* -------------------------------- Render -------------------------------- */
  return (
    <>
      <Helmet>
        <title>Book a Session | Lama Wafa Photography</title>
        <meta
          name="description"
          content="Book a photography session with Lama Wafa in Raleigh, NC."
        />
        <link rel="canonical" href="https://lamawafa.com/booking" />
      </Helmet>

      <div className="min-h-screen bg-cream">
        {/* Header */}
        <section className="relative bg-burgundy overflow-hidden -mt-16 md:-mt-20 pt-24 md:pt-28 pb-12 md:pb-16">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gold rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className={cls(
                "transition-all duration-700",
                headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="w-12 h-0.5 bg-gold mb-6" />
              <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-white">
                Book Your Session
              </h1>
              <p className="mt-4 text-white/70 max-w-xl">
                Choose your session type, pick a date, and let's create something beautiful together.
              </p>
            </div>

            {/* Progress Steps */}
            <div className="mt-10">
              <div className="flex items-center justify-between max-w-md">
                {STEPS.map((label, i) => (
                  <div key={label} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={cls(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                          step > i
                            ? "bg-gold text-charcoal"
                            : step === i
                            ? "bg-white text-burgundy"
                            : "bg-white/20 text-white/60"
                        )}
                      >
                        {step > i ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span
                        className={cls(
                          "text-xs font-medium transition-colors whitespace-nowrap",
                          step >= i ? "text-white" : "text-white/40"
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={cls(
                          "flex-1 h-px mx-3 transition-colors",
                          step > i ? "bg-gold" : "bg-white/20"
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Form Content */}
        <section className="py-12 md:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white border border-burgundy/10 shadow-soft overflow-hidden">
              {/* Step 0: Service selection */}
              {step === 0 && (
                <div className="p-6 md:p-8">
                  <h2 className="font-serif text-2xl font-light text-charcoal">
                    Choose a service
                  </h2>
                  <p className="mt-1 text-sm text-charcoal/60">
                    Select the type of session you're looking for.
                  </p>

                  <div className="mt-6 grid sm:grid-cols-2 gap-4">
                    {SERVICES.map((s) => {
                      const active = s.id === selected.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelected({ ...s, price: 0 })}
                          className={cls(
                            "text-left p-5 rounded-xl border-2 transition-all duration-300",
                            active
                              ? "border-gold bg-gold/5 shadow-glow"
                              : "border-burgundy/15 hover:border-gold/50 hover:bg-gold/5 hover:shadow-soft"
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={cls(
                                "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300",
                                active ? "bg-gold text-charcoal shadow-glow" : "bg-burgundy/10 text-burgundy"
                              )}
                            >
                              {s.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-medium text-charcoal">{s.name}</h3>
                                <span className={cls(
                                  "text-xs font-medium px-2 py-1 rounded-full transition-colors",
                                  active ? "text-charcoal bg-gold/30" : "text-burgundy bg-burgundy/10"
                                )}>
                                  {s.duration}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-charcoal/60">{s.desc}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={() => setStep(1)}
                      disabled={!canNext0}
                      className="btn btn-gold"
                    >
                      Continue
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 1: Date & Time */}
              {step === 1 && (
                <div className="p-6 md:p-8">
                  <h2 className="font-serif text-2xl font-light text-charcoal">
                    Pick date & time
                  </h2>
                  <p className="mt-1 text-sm text-charcoal/60">
                    Sessions are available between 9:30 AM and 9:30 PM.
                  </p>

                  <div className="mt-6 grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-charcoal mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => { setDate(e.target.value); setAvailability(null); }}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-charcoal mb-2">
                        Time
                      </label>
                      <select
                        value={time}
                        onChange={(e) => { setTime(e.target.value); setAvailability(null); }}
                        className="input"
                      >
                        <option value="">Select time</option>
                        {TIME_OPTS.map((t) => (
                          <option key={t} value={t}>{to12h(t)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={doCheck}
                      disabled={!date || !time || checking}
                      className={cls(
                        "btn w-full sm:w-auto",
                        !date || !time || checking
                          ? "bg-burgundy/20 text-burgundy/50 cursor-not-allowed"
                          : "btn-secondary"
                      )}
                    >
                      {checking ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          Checking...
                        </>
                      ) : (
                        "Check Availability"
                      )}
                    </button>
                  </div>

                  {availability === true && (
                    <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-emerald-800">Time slot available</p>
                        <p className="text-sm text-emerald-600">You can proceed with this date and time.</p>
                      </div>
                    </div>
                  )}

                  {availability === false && (
                    <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-red-800">Not available</p>
                        <p className="text-sm text-red-600">{err || "Please try a different time."}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 flex justify-between">
                    <button
                      onClick={() => setStep(0)}
                      className="btn btn-ghost"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                      </svg>
                      Back
                    </button>
                    <button
                      onClick={() => setStep(2)}
                      disabled={!canNext1}
                      className={cls(
                        "btn",
                        canNext1 ? "btn-primary" : "bg-burgundy/20 text-burgundy/50 cursor-not-allowed"
                      )}
                    >
                      Continue
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Details */}
              {step === 2 && (
                <div className="p-6 md:p-8">
                  <h2 className="font-serif text-2xl font-light text-charcoal">
                    Your details
                  </h2>
                  <p className="mt-1 text-sm text-charcoal/60">
                    Tell me a bit about yourself and your session.
                  </p>

                  {/* Contact Info */}
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-burgundy uppercase tracking-wider">
                      Contact Information
                    </h3>
                    <div className="mt-4 grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          Full name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={details.name}
                          onChange={(e) => setDetails({ ...details, name: e.target.value })}
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          className="input"
                          value={details.email}
                          onChange={(e) => setDetails({ ...details, email: e.target.value })}
                          placeholder="you@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          Phone <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          className="input"
                          value={details.phone}
                          onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          Preferred contact
                        </label>
                        <select
                          className="input"
                          value={details.contactPref}
                          onChange={(e) => setDetails({ ...details, contactPref: e.target.value })}
                        >
                          <option value="">Select</option>
                          <option>Email</option>
                          <option>Text</option>
                          <option>Call</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-burgundy uppercase tracking-wider">
                      Location
                    </h3>
                    <div className="mt-4 grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          Location type <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="input"
                          value={details.location}
                          onChange={(e) => setDetails({ ...details, location: e.target.value })}
                        >
                          <option>Studio</option>
                          <option>Client Location</option>
                          <option>Outdoors</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          Venue name
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={details.venueName}
                          onChange={(e) => setDetails({ ...details, venueName: e.target.value })}
                          placeholder="Venue, park, campus, etc."
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          Address
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={details.venueAddress}
                          onChange={(e) => setDetails({ ...details, venueAddress: e.target.value })}
                          placeholder="Street address"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-burgundy uppercase tracking-wider">
                      Additional Details
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          How did you hear about me?
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {["Instagram", "TikTok", "Google", "Friend/Family", "Other"].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setDetails((d) => ({ ...d, howHeard: opt }))}
                              className={cls(
                                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                                details.howHeard === opt
                                  ? "bg-burgundy text-white"
                                  : "bg-burgundy/10 text-burgundy hover:bg-burgundy/20"
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          Anything else I should know?
                        </label>
                        <textarea
                          rows={3}
                          className="input"
                          value={details.notes}
                          onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                          placeholder="Special requests, ideas, or questions..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <button onClick={() => setStep(1)} className="btn btn-ghost">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                      </svg>
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!canNext2}
                      className={cls(
                        "btn",
                        canNext2 ? "btn-primary" : "bg-burgundy/20 text-burgundy/50 cursor-not-allowed"
                      )}
                    >
                      Review
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Confirm */}
              {step === 3 && (
                <div className="p-6 md:p-8">
                  <h2 className="font-serif text-2xl font-light text-charcoal">
                    Review & confirm
                  </h2>
                  <p className="mt-1 text-sm text-charcoal/60">
                    Please review your booking details before confirming.
                  </p>

                  <div className="mt-6 space-y-4">
                    {/* Session Summary */}
                    <div className="p-5 rounded-xl bg-burgundy/5 border border-burgundy/15">
                      <h3 className="text-sm font-semibold text-burgundy uppercase tracking-wider mb-4">
                        Session Details
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-charcoal/60">Service</span>
                          <span className="font-medium text-charcoal">{selected.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-charcoal/60">Date</span>
                          <span className="font-medium text-charcoal">{date}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-charcoal/60">Time</span>
                          <span className="font-medium text-charcoal">{time ? to12h(time) : "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-charcoal/60">Duration</span>
                          <span className="font-medium text-charcoal">{selected.duration}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-charcoal/60">Location</span>
                          <span className="font-medium text-charcoal">{details.location}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contact Summary */}
                    <div className="p-5 rounded-xl bg-burgundy/5 border border-burgundy/15">
                      <h3 className="text-sm font-semibold text-burgundy uppercase tracking-wider mb-4">
                        Contact Information
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-charcoal/60">Name</span>
                          <span className="font-medium text-charcoal">{details.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-charcoal/60">Email</span>
                          <span className="font-medium text-charcoal">{details.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-charcoal/60">Phone</span>
                          <span className="font-medium text-charcoal">{details.phone}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!result ? (
                    <div className="mt-8 flex justify-between">
                      <button onClick={() => setStep(2)} className="btn btn-ghost">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                        Back
                      </button>
                      <button
                        onClick={confirm}
                        disabled={submitting}
                        className="btn btn-primary"
                      >
                        {submitting ? (
                          <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            Submitting...
                          </>
                        ) : (
                          "Confirm Booking"
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-8 p-6 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                      <h3 className="mt-4 font-serif text-xl text-emerald-800">Booking requested!</h3>
                      <p className="mt-2 text-sm text-emerald-700">
                        Your reference code: <code className="font-mono font-bold">{result.reference}</code>
                      </p>
                      <p className="mt-1 text-sm text-emerald-600">
                        I'll reach out soon to confirm your session.
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <button
                          onClick={() => navigator.clipboard?.writeText(result.reference)}
                          className="btn btn-secondary text-sm"
                        >
                          Copy Reference
                        </button>
                        <button onClick={reset} className="btn btn-primary text-sm">
                          Book Another Session
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
