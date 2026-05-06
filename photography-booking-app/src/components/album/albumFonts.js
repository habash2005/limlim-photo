// Available fonts for text slots and theme overrides.
// Loaded via Google Fonts in index.html.

export const FONT_OPTIONS = [
  { id: "Playfair Display", name: "Playfair Display", style: "serif", sample: "Aa" },
  { id: "Cormorant Garamond", name: "Cormorant Garamond", style: "serif", sample: "Aa" },
  { id: "Lora", name: "Lora", style: "serif", sample: "Aa" },
  { id: "DM Serif Display", name: "DM Serif Display", style: "serif", sample: "Aa" },
  { id: "Poppins", name: "Poppins", style: "sans", sample: "Aa" },
  { id: "Bebas Neue", name: "Bebas Neue", style: "display", sample: "Aa" },
  { id: "Caveat", name: "Caveat", style: "script", sample: "Aa" },
];

export function isFontAvailable(name) {
  return FONT_OPTIONS.some((f) => f.id === name);
}

export const DEFAULT_HEADING_FONT = "Playfair Display";
export const DEFAULT_BODY_FONT = "Lora";
