// Album theme presets. Each preset stores resolved values so saved albums
// don't drift if the preset definitions change later.

export const THEME_PRESETS = {
  "burgundy-classic": {
    presetId: "burgundy-classic",
    name: "Burgundy & Olive",
    pageBg: "#FBF6EE",
    accent: "#5A1A2B",
    fontHeading: "Playfair Display",
    fontBody: "Lora",
    coverVariant: "burgundy",
    swatch: ["#FBF6EE", "#5A1A2B", "#46543B"],
  },
  "sage-cream": {
    presetId: "sage-cream",
    name: "Sage & Cream",
    pageBg: "#F4F1E8",
    accent: "#6B7A5A",
    fontHeading: "Cormorant Garamond",
    fontBody: "Lora",
    coverVariant: "sage",
    swatch: ["#F4F1E8", "#6B7A5A", "#C8B68A"],
  },
  "navy-gold": {
    presetId: "navy-gold",
    name: "Navy & Olive",
    pageBg: "#F5EFE1",
    accent: "#1F2A44",
    fontHeading: "Playfair Display",
    fontBody: "Lora",
    coverVariant: "navy",
    swatch: ["#F5EFE1", "#1F2A44", "#46543B"],
  },
  "blush-rose": {
    presetId: "blush-rose",
    name: "Blush & Rose",
    pageBg: "#FCF3EF",
    accent: "#B16777",
    fontHeading: "Cormorant Garamond",
    fontBody: "Lora",
    coverVariant: "blush",
    swatch: ["#FCF3EF", "#B16777", "#E8C5BC"],
  },
  "editorial-mono": {
    presetId: "editorial-mono",
    name: "Editorial Mono",
    pageBg: "#F6F4F0",
    accent: "#2B2622",
    fontHeading: "Bebas Neue",
    fontBody: "Poppins",
    coverVariant: "charcoal",
    swatch: ["#F6F4F0", "#2B2622", "#9C9388"],
  },
};

export const THEME_LIST = Object.values(THEME_PRESETS);

export const DEFAULT_THEME_ID = "burgundy-classic";

export function getTheme(presetId) {
  return THEME_PRESETS[presetId] || THEME_PRESETS[DEFAULT_THEME_ID];
}

// Resolve a saved theme block. We store the resolved values directly so
// preset definitions can drift without retroactively changing saved albums.
export function resolveTheme(themeBlock) {
  if (!themeBlock) return { ...THEME_PRESETS[DEFAULT_THEME_ID] };
  return { ...THEME_PRESETS[DEFAULT_THEME_ID], ...themeBlock };
}
