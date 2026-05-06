// Album page templates. Each template defines fixed-geometry photo slots and
// optional text slots in normalized 0–100 percent coordinates so the same
// definition scales identically in editor thumbnails and full-size pages.

export const TEMPLATES = {
  // ---------- SINGLE PHOTO ----------
  "single-bleed": {
    id: "single-bleed",
    name: "Full Bleed",
    category: "single",
    slotCount: 1,
    textCount: 0,
    slots: [{ x: 0, y: 0, w: 100, h: 100 }],
    texts: [],
    supportsGutter: false,
  },
  "single-framed": {
    id: "single-framed",
    name: "Framed",
    category: "single",
    slotCount: 1,
    textCount: 0,
    slots: [{ x: 6, y: 6, w: 88, h: 88 }],
    texts: [],
    supportsGutter: false,
  },
  "single-card": {
    id: "single-card",
    name: "Centered Card",
    category: "single",
    slotCount: 1,
    textCount: 0,
    slots: [{ x: 14, y: 18, w: 72, h: 64 }],
    texts: [],
    supportsGutter: false,
  },
  "single-caption-bottom": {
    id: "single-caption-bottom",
    name: "Caption Below",
    category: "single",
    slotCount: 1,
    textCount: 1,
    slots: [{ x: 0, y: 0, w: 100, h: 82 }],
    texts: [
      { key: "caption", x: 6, y: 84, w: 88, h: 12, defaultFontSize: 18, defaultAlign: "center", italic: true },
    ],
    supportsGutter: false,
  },
  "single-caption-top": {
    id: "single-caption-top",
    name: "Caption Above",
    category: "single",
    slotCount: 1,
    textCount: 1,
    slots: [{ x: 0, y: 14, w: 100, h: 86 }],
    texts: [
      { key: "title", x: 6, y: 3, w: 88, h: 9, defaultFontSize: 22, defaultAlign: "center", italic: false },
    ],
    supportsGutter: false,
  },
  "single-portrait-card": {
    id: "single-portrait-card",
    name: "Portrait Card",
    category: "single",
    slotCount: 1,
    textCount: 1,
    slots: [{ x: 16, y: 8, w: 68, h: 70 }],
    texts: [
      { key: "caption", x: 10, y: 82, w: 80, h: 10, defaultFontSize: 16, defaultAlign: "center", italic: true },
    ],
    supportsGutter: false,
  },

  // ---------- TWO PHOTOS ----------
  "two-stack": {
    id: "two-stack",
    name: "Stacked",
    category: "two",
    slotCount: 2,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 100, h: 50 },
      { x: 0, y: 50, w: 100, h: 50 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "two-side": {
    id: "two-side",
    name: "Side by Side",
    category: "two",
    slotCount: 2,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 50, h: 100 },
      { x: 50, y: 0, w: 50, h: 100 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "two-asym-60-40-l": {
    id: "two-asym-60-40-l",
    name: "60/40 Left",
    category: "two",
    slotCount: 2,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 60, h: 100 },
      { x: 60, y: 0, w: 40, h: 100 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "two-asym-60-40-r": {
    id: "two-asym-60-40-r",
    name: "60/40 Right",
    category: "two",
    slotCount: 2,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 40, h: 100 },
      { x: 40, y: 0, w: 60, h: 100 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "two-asym-70-30": {
    id: "two-asym-70-30",
    name: "70/30 Split",
    category: "two",
    slotCount: 2,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 70, h: 100 },
      { x: 70, y: 0, w: 30, h: 100 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "two-stack-asym": {
    id: "two-stack-asym",
    name: "Stacked 65/35",
    category: "two",
    slotCount: 2,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 100, h: 65 },
      { x: 0, y: 65, w: 100, h: 35 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "two-with-caption": {
    id: "two-with-caption",
    name: "Two + Caption",
    category: "two",
    slotCount: 2,
    textCount: 1,
    slots: [
      { x: 0, y: 0, w: 50, h: 84 },
      { x: 50, y: 0, w: 50, h: 84 },
    ],
    texts: [
      { key: "caption", x: 6, y: 86, w: 88, h: 10, defaultFontSize: 16, defaultAlign: "center", italic: true },
    ],
    supportsGutter: true,
  },
  "two-inset-card": {
    id: "two-inset-card",
    name: "Inset Card",
    category: "two",
    slotCount: 2,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 60, y: 60, w: 35, h: 35 },
    ],
    texts: [],
    supportsGutter: false,
  },

  // ---------- THREE PHOTOS ----------
  "three-hero-stack-right": {
    id: "three-hero-stack-right",
    name: "Hero + Two Right",
    category: "three",
    slotCount: 3,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 60, h: 100 },
      { x: 60, y: 0, w: 40, h: 50 },
      { x: 60, y: 50, w: 40, h: 50 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "three-hero-stack-left": {
    id: "three-hero-stack-left",
    name: "Hero + Two Left",
    category: "three",
    slotCount: 3,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 40, h: 50 },
      { x: 0, y: 50, w: 40, h: 50 },
      { x: 40, y: 0, w: 60, h: 100 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "three-hero-top": {
    id: "three-hero-top",
    name: "Hero Top + Two",
    category: "three",
    slotCount: 3,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 100, h: 60 },
      { x: 0, y: 60, w: 50, h: 40 },
      { x: 50, y: 60, w: 50, h: 40 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "three-hero-bottom": {
    id: "three-hero-bottom",
    name: "Two + Hero Bottom",
    category: "three",
    slotCount: 3,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 50, h: 40 },
      { x: 50, y: 0, w: 50, h: 40 },
      { x: 0, y: 40, w: 100, h: 60 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "three-triptych-h": {
    id: "three-triptych-h",
    name: "Triptych Horizontal",
    category: "three",
    slotCount: 3,
    textCount: 0,
    slots: [
      { x: 0, y: 25, w: 33.33, h: 50 },
      { x: 33.33, y: 25, w: 33.33, h: 50 },
      { x: 66.66, y: 25, w: 33.34, h: 50 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "three-triptych-v": {
    id: "three-triptych-v",
    name: "Triptych Vertical",
    category: "three",
    slotCount: 3,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 100, h: 33.33 },
      { x: 0, y: 33.33, w: 100, h: 33.33 },
      { x: 0, y: 66.66, w: 100, h: 33.34 },
    ],
    texts: [],
    supportsGutter: true,
  },

  // ---------- FOUR PHOTOS ----------
  "four-grid-2x2": {
    id: "four-grid-2x2",
    name: "Grid 2×2",
    category: "four",
    slotCount: 4,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 50, h: 50 },
      { x: 50, y: 0, w: 50, h: 50 },
      { x: 0, y: 50, w: 50, h: 50 },
      { x: 50, y: 50, w: 50, h: 50 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "four-hero-strip-right": {
    id: "four-hero-strip-right",
    name: "Hero + Strip Right",
    category: "four",
    slotCount: 4,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 65, h: 100 },
      { x: 65, y: 0, w: 35, h: 33.33 },
      { x: 65, y: 33.33, w: 35, h: 33.33 },
      { x: 65, y: 66.66, w: 35, h: 33.34 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "four-hero-strip-bottom": {
    id: "four-hero-strip-bottom",
    name: "Hero + Strip Below",
    category: "four",
    slotCount: 4,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 100, h: 65 },
      { x: 0, y: 65, w: 33.33, h: 35 },
      { x: 33.33, y: 65, w: 33.33, h: 35 },
      { x: 66.66, y: 65, w: 33.34, h: 35 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "four-strip": {
    id: "four-strip",
    name: "Horizontal Strip",
    category: "four",
    slotCount: 4,
    textCount: 0,
    slots: [
      { x: 0, y: 25, w: 25, h: 50 },
      { x: 25, y: 25, w: 25, h: 50 },
      { x: 50, y: 25, w: 25, h: 50 },
      { x: 75, y: 25, w: 25, h: 50 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "four-magazine": {
    id: "four-magazine",
    name: "Magazine",
    category: "four",
    slotCount: 4,
    textCount: 1,
    slots: [
      { x: 0, y: 0, w: 60, h: 60 },
      { x: 60, y: 0, w: 40, h: 30 },
      { x: 60, y: 30, w: 40, h: 30 },
      { x: 0, y: 60, w: 100, h: 30 },
    ],
    texts: [
      { key: "caption", x: 6, y: 92, w: 88, h: 6, defaultFontSize: 14, defaultAlign: "center", italic: true },
    ],
    supportsGutter: true,
  },
  "four-asymmetric": {
    id: "four-asymmetric",
    name: "Asymmetric Mix",
    category: "four",
    slotCount: 4,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 60, h: 60 },
      { x: 60, y: 0, w: 40, h: 60 },
      { x: 0, y: 60, w: 40, h: 40 },
      { x: 40, y: 60, w: 60, h: 40 },
    ],
    texts: [],
    supportsGutter: true,
  },

  // ---------- FIVE+ PHOTOS ----------
  "five-hero-quad": {
    id: "five-hero-quad",
    name: "Hero + Quad",
    category: "many",
    slotCount: 5,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 100, h: 60 },
      { x: 0, y: 60, w: 25, h: 40 },
      { x: 25, y: 60, w: 25, h: 40 },
      { x: 50, y: 60, w: 25, h: 40 },
      { x: 75, y: 60, w: 25, h: 40 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "six-grid-2x3": {
    id: "six-grid-2x3",
    name: "Grid 2×3",
    category: "many",
    slotCount: 6,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 50, h: 33.33 },
      { x: 50, y: 0, w: 50, h: 33.33 },
      { x: 0, y: 33.33, w: 50, h: 33.33 },
      { x: 50, y: 33.33, w: 50, h: 33.33 },
      { x: 0, y: 66.66, w: 50, h: 33.34 },
      { x: 50, y: 66.66, w: 50, h: 33.34 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "six-grid-3x2": {
    id: "six-grid-3x2",
    name: "Grid 3×2",
    category: "many",
    slotCount: 6,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 33.33, h: 50 },
      { x: 33.33, y: 0, w: 33.33, h: 50 },
      { x: 66.66, y: 0, w: 33.34, h: 50 },
      { x: 0, y: 50, w: 33.33, h: 50 },
      { x: 33.33, y: 50, w: 33.33, h: 50 },
      { x: 66.66, y: 50, w: 33.34, h: 50 },
    ],
    texts: [],
    supportsGutter: true,
  },
  "eight-grid-2x4": {
    id: "eight-grid-2x4",
    name: "Grid 2×4",
    category: "many",
    slotCount: 8,
    textCount: 0,
    slots: [
      { x: 0, y: 0, w: 50, h: 25 },
      { x: 50, y: 0, w: 50, h: 25 },
      { x: 0, y: 25, w: 50, h: 25 },
      { x: 50, y: 25, w: 50, h: 25 },
      { x: 0, y: 50, w: 50, h: 25 },
      { x: 50, y: 50, w: 50, h: 25 },
      { x: 0, y: 75, w: 50, h: 25 },
      { x: 50, y: 75, w: 50, h: 25 },
    ],
    texts: [],
    supportsGutter: true,
  },

  // ---------- TEXT PAGES ----------
  "title-page": {
    id: "title-page",
    name: "Title Page",
    category: "text",
    slotCount: 0,
    textCount: 2,
    slots: [],
    texts: [
      { key: "title", x: 10, y: 32, w: 80, h: 16, defaultFontSize: 48, defaultAlign: "center", italic: false },
      { key: "subtitle", x: 10, y: 50, w: 80, h: 8, defaultFontSize: 14, defaultAlign: "center", italic: true },
    ],
    supportsGutter: false,
  },
  "divider-chapter": {
    id: "divider-chapter",
    name: "Chapter Divider",
    category: "text",
    slotCount: 0,
    textCount: 1,
    slots: [],
    texts: [
      { key: "title", x: 10, y: 38, w: 80, h: 24, defaultFontSize: 60, defaultAlign: "center", italic: true },
    ],
    supportsGutter: false,
  },
  "quote-page": {
    id: "quote-page",
    name: "Quote",
    category: "text",
    slotCount: 0,
    textCount: 2,
    slots: [],
    texts: [
      { key: "title", x: 12, y: 30, w: 76, h: 28, defaultFontSize: 32, defaultAlign: "center", italic: true },
      { key: "subtitle", x: 12, y: 60, w: 76, h: 6, defaultFontSize: 12, defaultAlign: "center", italic: false },
    ],
    supportsGutter: false,
  },
  "closing-page": {
    id: "closing-page",
    name: "Closing",
    category: "text",
    slotCount: 0,
    textCount: 2,
    slots: [],
    texts: [
      { key: "title", x: 10, y: 36, w: 80, h: 12, defaultFontSize: 36, defaultAlign: "center", italic: false },
      { key: "subtitle", x: 10, y: 50, w: 80, h: 8, defaultFontSize: 14, defaultAlign: "center", italic: true },
    ],
    supportsGutter: false,
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export const TEMPLATE_CATEGORIES = [
  { id: "single", label: "Single" },
  { id: "two", label: "Two" },
  { id: "three", label: "Three" },
  { id: "four", label: "Four" },
  { id: "many", label: "Five+" },
  { id: "text", label: "Text" },
];

export function getTemplate(id) {
  return TEMPLATES[id] || TEMPLATES["single-bleed"];
}

// Tiny inline SVG thumbnail rendered from the template's geometry.
export function renderTemplateThumbSvg(template, { fill = "#5A1A2B", bg = "#FBF6EE", textFill = "#5A1A2B" } = {}) {
  const slots = (template.slots || [])
    .map((s) => {
      const inset = 0.4;
      return `<rect x="${s.x + inset}" y="${s.y + inset}" width="${s.w - inset * 2}" height="${s.h - inset * 2}" fill="${fill}" opacity="0.85" rx="0.4" />`;
    })
    .join("");
  const texts = (template.texts || [])
    .map((t) => {
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      const len = Math.min(t.w * 0.7, 30);
      return `<rect x="${cx - len / 2}" y="${cy - 1.2}" width="${len}" height="2.4" rx="1.2" fill="${textFill}" opacity="0.55" />`;
    })
    .join("");
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <rect width="100" height="100" fill="${bg}" />
    <g style="filter: drop-shadow(0 0.3px 0.3px rgba(0,0,0,0.05))">${slots}</g>
    ${texts}
    <rect x="0" y="0" width="100" height="100" fill="none" stroke="#46543B" stroke-opacity="0.25" stroke-width="0.5" />
  </svg>`;
}
