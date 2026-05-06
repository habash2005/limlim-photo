// Schema helpers for the album layout document.
//
// Path in Firestore: bookings/{bookingId}/albumLayout/main
//
// Shape:
//   {
//     schemaVersion: 1,
//     theme: { presetId, pageBg, accent, fontHeading, fontBody, coverVariant },
//     pages: [
//       {
//         id: string,
//         templateId: string,
//         slots: { "0": { publicId, focal: {x,y}, zoom }, ... },
//         texts: { "title": "Hello" },
//         gutter: number (px),
//         themeOverride: { accent?, fontHeading? } | null
//       }
//     ],
//     updatedAt, updatedBy
//   }

import { buildAlbumPages } from "./albumPages";
import { TEMPLATES, getTemplate } from "./albumTemplates";
import { THEME_PRESETS, DEFAULT_THEME_ID } from "./albumThemes";

export const SCHEMA_VERSION = 1;

function rid(prefix = "p") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function defaultThemeBlock() {
  return { ...THEME_PRESETS[DEFAULT_THEME_ID] };
}

export function createEmptyLayout() {
  return {
    schemaVersion: SCHEMA_VERSION,
    theme: defaultThemeBlock(),
    pages: [],
  };
}

export function createBlankPage(templateId = "single-bleed") {
  const tpl = getTemplate(templateId);
  const slots = {};
  for (let i = 0; i < tpl.slotCount; i++) {
    slots[String(i)] = null;
  }
  const texts = {};
  for (const t of tpl.texts || []) {
    texts[t.key] = "";
  }
  return {
    id: rid("p"),
    templateId,
    slots,
    texts,
    gutter: 0,
    themeOverride: null,
  };
}

// Convert raw image items (no layout doc yet) into a layout doc shape using
// the existing auto-packer. Lets the renderer use a single code path.
export function autoPackToLayout(items) {
  const packed = buildAlbumPages(items);
  return {
    schemaVersion: SCHEMA_VERSION,
    theme: defaultThemeBlock(),
    pages: packed.map((p, i) => {
      const templateId = p.layout === "stacked" ? "two-stack" : "single-bleed";
      const slots = {};
      p.items.forEach((item, idx) => {
        slots[String(idx)] = {
          publicId: item.public_id,
          focal: { x: 0.5, y: 0.5 },
          zoom: 1,
        };
      });
      return {
        id: `auto-${i}`,
        templateId,
        slots,
        texts: {},
        gutter: 0,
        themeOverride: null,
      };
    }),
  };
}

// Stable key for React lists.
export function pageReactKey(page, index) {
  return page.id || `p-${index}`;
}

// Cheap hash for dirty detection.
export function hashLayout(layout) {
  if (!layout) return "";
  try {
    return JSON.stringify({
      v: layout.schemaVersion,
      t: layout.theme,
      p: layout.pages,
    });
  } catch {
    return String(Math.random());
  }
}

// Resolve a slot's image record from the imagesById map.
// Returns null if the slot is unfilled or the image was deleted.
export function resolveSlot(slot, imagesById) {
  if (!slot || !slot.publicId) return null;
  return imagesById.get(slot.publicId) || null;
}

// Per-text storage is either:
//   - a plain string (legacy: just the text content, theme styling)
//   - an object { text, font?, size?, color?, align?, italic?, weight? } (new)
// Always read via these helpers so the renderer can stay simple.
export function getTextValue(textEntry) {
  if (textEntry == null) return "";
  if (typeof textEntry === "string") return textEntry;
  return textEntry.text || "";
}

export function getTextStyle(textEntry) {
  if (textEntry == null || typeof textEntry === "string") return {};
  const { text, ...style } = textEntry;
  return style;
}

export function setTextValue(prev, value) {
  if (prev == null || typeof prev === "string") return value;
  return { ...prev, text: value };
}

export function setTextStyleField(prev, field, value) {
  const existing =
    prev == null
      ? { text: "" }
      : typeof prev === "string"
      ? { text: prev }
      : { ...prev };
  if (value === undefined || value === null || value === "") {
    delete existing[field];
  } else {
    existing[field] = value;
  }
  return existing;
}

// On changeTemplate: preserve slot assignments and crops by index up to the
// new slotCount, drop overflow, fill new slots null. Also reconcile texts:
// keep matching keys, drop missing, init new ones empty.
export function changeTemplate(page, newTemplateId) {
  const newTpl = getTemplate(newTemplateId);
  const oldSlotEntries = Object.entries(page.slots || {});
  const newSlots = {};
  for (let i = 0; i < newTpl.slotCount; i++) {
    const key = String(i);
    const old = oldSlotEntries.find(([k]) => k === key);
    newSlots[key] = old ? old[1] : null;
  }
  const newTexts = {};
  for (const t of newTpl.texts || []) {
    newTexts[t.key] = page.texts?.[t.key] ?? "";
  }
  return {
    ...page,
    templateId: newTemplateId,
    slots: newSlots,
    texts: newTexts,
  };
}

// Validation: report broken references and empty slots.
export function validateLayout(layout, imagesById) {
  const issues = [];
  if (!layout?.pages) return issues;
  layout.pages.forEach((page, pi) => {
    const tpl = TEMPLATES[page.templateId];
    if (!tpl) {
      issues.push({ type: "unknown-template", pageIndex: pi, templateId: page.templateId });
      return;
    }
    Object.entries(page.slots || {}).forEach(([k, slot]) => {
      if (!slot) {
        issues.push({ type: "empty-slot", pageIndex: pi, slotKey: k });
      } else if (!imagesById.has(slot.publicId)) {
        issues.push({ type: "missing-image", pageIndex: pi, slotKey: k, publicId: slot.publicId });
      }
    });
  });
  return issues;
}
