import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { THEME_LIST } from "../albumThemes";
import { FONT_OPTIONS } from "../albumFonts";
import { getTextValue, getTextStyle } from "../layoutSchema";
import TemplatePicker from "./TemplatePicker";
import { getTemplate } from "../albumTemplates";
import { cdnUrl } from "../../../lib/imageUrl";

// A small, curated swatch palette that looks good on a cream album page.
const TEXT_COLOR_SWATCHES = [
  "#5A1A2B", "#4A0E1A", "#821829", "#46543B",
  "#1F2A44", "#6B7A5A", "#B16777", "#2B2622",
  "#333333", "#FBF6EE",
];

function Section({ title, children }) {
  return (
    <div className="px-5 py-4 border-b border-burgundy/10">
      <h4 className="text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-charcoal/55 mb-3">
        {title}
      </h4>
      {children}
    </div>
  );
}

export default function Inspector({
  layout,
  page,
  images,
  isAlbumMode,
  selectedSlotKey,
  selectedTextKey,
  imagesById,
  onChangeTemplate,
  onClearSlot,
  onEditCrop,
  onSetGutter,
  onSetCaption,
  onSetTextStyle,
  onSetPageOverride,
  onSetTheme,
  onSetCover,
  onClose,
}) {
  const theme = layout.theme;
  const showAlbum = isAlbumMode || !page;

  return (
    <aside className="flex flex-col h-full min-h-0 bg-white/55 backdrop-blur-2xl border-l border-burgundy/10">
      <div className="px-5 py-4 border-b border-burgundy/10 shrink-0">
        <h3 className="font-serif text-base font-semibold text-burgundy">Inspector</h3>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-charcoal/55">
          {selectedSlotKey != null
            ? `Slot ${parseInt(selectedSlotKey, 10) + 1}`
            : selectedTextKey
            ? `Text — ${selectedTextKey}`
            : showAlbum
            ? "Album & Cover"
            : "Page"}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedSlotKey != null ? `slot-${selectedSlotKey}` : selectedTextKey ? `text-${selectedTextKey}` : page ? "page" : "album"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {selectedSlotKey != null ? (
              <SlotInspector
                page={page}
                slotKey={selectedSlotKey}
                imagesById={imagesById}
                onClearSlot={onClearSlot}
                onEditCrop={onEditCrop}
              />
            ) : selectedTextKey ? (
              <TextInspector
                page={page}
                textKey={selectedTextKey}
                onSetCaption={onSetCaption}
                onSetTextStyle={onSetTextStyle}
              />
            ) : page ? (
              <PageInspector
                page={page}
                theme={theme}
                onChangeTemplate={onChangeTemplate}
                onSetGutter={onSetGutter}
                onSetPageOverride={onSetPageOverride}
              />
            ) : (
              <AlbumInspector
                theme={theme}
                layout={layout}
                images={images || []}
                onSetTheme={onSetTheme}
                onSetCover={onSetCover}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}

function AlbumInspector({ theme, layout, images, onSetTheme, onSetCover }) {
  const cover = theme.cover || {};
  const coverStyle = cover.style || "leather";

  return (
    <>
      <Section title="Theme">
        <div className="grid grid-cols-1 gap-2">
          {THEME_LIST.map((t) => {
            const active = theme.presetId === t.presetId;
            return (
              <motion.button
                key={t.presetId}
                type="button"
                onClick={() => onSetTheme(t)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`flex items-center gap-3 p-2 rounded-lg ring-1 transition-all ${
                  active
                    ? "ring-2 ring-gold ring-offset-1 ring-offset-cream bg-gold/10"
                    : "ring-burgundy/15 hover:ring-burgundy/40 bg-white"
                }`}
              >
                <span className="flex shrink-0">
                  {t.swatch.map((c, i) => (
                    <span
                      key={i}
                      className="w-5 h-8 first:rounded-l-[3px] last:rounded-r-[3px]"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-sm font-serif text-burgundy">{t.name}</span>
                  <span className="block text-[10px] uppercase tracking-[0.15em] text-charcoal/55">
                    {t.fontHeading}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </Section>

      <Section title="Cover style">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "leather", label: "Leather" },
            { id: "photo", label: "Photo" },
            { id: "minimal", label: "Minimal" },
          ].map((s) => {
            const active = coverStyle === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSetCover("style", s.id)}
                className={`px-2 py-1.5 rounded-md text-[11px] font-semibold ring-1 transition-colors ${
                  active
                    ? "bg-olive text-cream ring-olive"
                    : "bg-white text-burgundy ring-burgundy/15 hover:bg-gold/20"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>

      {coverStyle === "photo" && (
        <Section title="Cover photo">
          {cover.photoPublicId ? (
            <div className="space-y-2">
              <div className="aspect-[3/4] rounded-md overflow-hidden ring-1 ring-burgundy/15">
                {(() => {
                  const raw = images.find((i) => i.public_id === cover.photoPublicId)?.secure_url;
                  return (
                    <img
                      src={cdnUrl(raw, { w: 800, q: 85 })}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        if (raw && e.currentTarget.dataset.fallback !== "1") {
                          e.currentTarget.dataset.fallback = "1";
                          e.currentTarget.src = raw;
                        }
                      }}
                    />
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => onSetCover("photoPublicId", null)}
                className="w-full px-3 py-1.5 rounded-full text-xs font-semibold bg-cream ring-1 ring-burgundy/15 text-wine hover:bg-wine/10 transition-colors"
              >
                Clear photo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {images.slice(0, 12).map((img) => (
                <button
                  key={img.public_id}
                  type="button"
                  onClick={() => onSetCover("photoPublicId", img.public_id)}
                  className="aspect-square rounded-md overflow-hidden ring-1 ring-burgundy/15 hover:ring-burgundy/40 hover:scale-[1.02] transition-all"
                >
                  <img
                    src={cdnUrl(img.secure_url, { w: 300, q: 75 })}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      if (e.currentTarget.dataset.fallback !== "1") {
                        e.currentTarget.dataset.fallback = "1";
                        e.currentTarget.src = img.secure_url;
                      }
                    }}
                  />
                </button>
              ))}
              {images.length > 12 && (
                <p className="col-span-3 text-[10px] uppercase tracking-[0.18em] text-charcoal/55 text-center mt-2">
                  Showing first 12 — drag any photo onto the cover area in the canvas to use it
                </p>
              )}
            </div>
          )}
        </Section>
      )}

      <Section title="Cover text">
        <div className="space-y-2.5">
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-charcoal/55 block mb-1">
              Monogram
            </label>
            <input
              type="text"
              value={cover.monogram ?? ""}
              onChange={(e) => onSetCover("monogram", e.target.value || null)}
              placeholder="LW"
              maxLength={4}
              className="w-full rounded-md border border-burgundy/20 px-3 py-1.5 text-sm bg-white focus:border-burgundy focus:ring-2 focus:ring-gold/40 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-charcoal/55 block mb-1">
              Title
            </label>
            <input
              type="text"
              value={cover.title ?? ""}
              onChange={(e) => onSetCover("title", e.target.value || null)}
              placeholder="Lama Wafa"
              className="w-full rounded-md border border-burgundy/20 px-3 py-1.5 text-sm bg-white focus:border-burgundy focus:ring-2 focus:ring-gold/40 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-charcoal/55 block mb-1">
              Subtitle
            </label>
            <input
              type="text"
              value={cover.subtitle ?? ""}
              onChange={(e) => onSetCover("subtitle", e.target.value || null)}
              placeholder="Photography"
              className="w-full rounded-md border border-burgundy/20 px-3 py-1.5 text-sm bg-white focus:border-burgundy focus:ring-2 focus:ring-gold/40 outline-none"
            />
          </div>
        </div>
      </Section>

      <Section title="Cover toggles">
        <label className="flex items-center gap-2 text-sm text-charcoal/80 cursor-pointer">
          <input
            type="checkbox"
            checked={!cover.hideClientName}
            onChange={(e) => onSetCover("hideClientName", e.target.checked ? null : true)}
            className="accent-wine"
          />
          Show client name
        </label>
        <label className="flex items-center gap-2 text-sm text-charcoal/80 cursor-pointer mt-1.5">
          <input
            type="checkbox"
            checked={!cover.hideDate}
            onChange={(e) => onSetCover("hideDate", e.target.checked ? null : true)}
            className="accent-wine"
          />
          Show date
        </label>
        <label className="flex items-center gap-2 text-sm text-charcoal/80 cursor-pointer mt-1.5">
          <input
            type="checkbox"
            checked={!cover.hideMonogram}
            onChange={(e) => onSetCover("hideMonogram", e.target.checked ? null : true)}
            className="accent-wine"
          />
          Show monogram
        </label>
      </Section>
    </>
  );
}

function PageInspector({ page, theme, onChangeTemplate, onSetGutter, onSetPageOverride }) {
  const tpl = getTemplate(page.templateId);
  const override = page.themeOverride || {};

  return (
    <>
      <Section title="Template">
        <TemplatePicker
          currentTemplateId={page.templateId}
          theme={theme}
          onPick={onChangeTemplate}
        />
      </Section>

      {tpl.supportsGutter && (
        <Section title={`Gutter — ${page.gutter || 0}px`}>
          <input
            type="range"
            min="0"
            max="32"
            value={page.gutter || 0}
            onChange={(e) => onSetGutter(parseInt(e.target.value, 10))}
            className="w-full accent-wine"
          />
          <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-charcoal/55">
            Space between photos on this page
          </p>
        </Section>
      )}

      <Section title="Page background">
        <div className="flex flex-wrap gap-1.5">
          {["#FBF6EE", "#F4F1E8", "#F5EFE1", "#FCF3EF", "#F6F4F0", "#FFFFFF", "#1F2A44", "#2B2622"].map((c) => {
            const active = override.pageBg === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() =>
                  onSetPageOverride("pageBg", c === theme.pageBg ? null : c)
                }
                aria-label={`Background ${c}`}
                className={`w-7 h-7 rounded-md ring-2 transition-all ${
                  active ? "ring-gold scale-110" : "ring-burgundy/15 hover:ring-burgundy/40"
                }`}
                style={{ backgroundColor: c }}
              />
            );
          })}
          <label className="relative w-7 h-7 grid place-items-center rounded-md ring-2 ring-burgundy/15 hover:ring-burgundy/40 cursor-pointer bg-white">
            <input
              type="color"
              value={override.pageBg || theme.pageBg}
              onChange={(e) => onSetPageOverride("pageBg", e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Custom page background"
            />
            <span className="text-[10px] text-burgundy">+</span>
          </label>
        </div>
        {override.pageBg && (
          <button
            type="button"
            onClick={() => onSetPageOverride("pageBg", null)}
            className="mt-2 text-[10px] uppercase tracking-[0.18em] text-charcoal/55 hover:text-burgundy"
          >
            Reset to theme
          </button>
        )}
      </Section>

      <Section title="Page accent">
        <div className="flex flex-wrap gap-1.5">
          {["#5A1A2B", "#4A0E1A", "#821829", "#46543B", "#1F2A44", "#6B7A5A", "#B16777", "#2B2622"].map((c) => {
            const active = override.accent === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onSetPageOverride("accent", c === theme.accent ? null : c)}
                aria-label={`Accent ${c}`}
                className={`w-7 h-7 rounded-full ring-2 transition-all ${
                  active ? "ring-gold scale-110" : "ring-burgundy/15 hover:ring-burgundy/40"
                }`}
                style={{ backgroundColor: c }}
              />
            );
          })}
          <label className="relative w-7 h-7 grid place-items-center rounded-full ring-2 ring-burgundy/15 hover:ring-burgundy/40 cursor-pointer overflow-hidden bg-white">
            <input
              type="color"
              value={override.accent || theme.accent}
              onChange={(e) => onSetPageOverride("accent", e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Custom accent"
            />
            <span className="text-[10px] text-burgundy">+</span>
          </label>
        </div>
        {override.accent && (
          <button
            type="button"
            onClick={() => onSetPageOverride("accent", null)}
            className="mt-2 text-[10px] uppercase tracking-[0.18em] text-charcoal/55 hover:text-burgundy"
          >
            Reset to theme
          </button>
        )}
      </Section>

      <Section title="Page heading font">
        <select
          value={override.fontHeading || ""}
          onChange={(e) => onSetPageOverride("fontHeading", e.target.value || null)}
          className="w-full rounded-md border border-burgundy/20 px-3 py-2 text-sm bg-white focus:border-burgundy focus:ring-2 focus:ring-gold/40 outline-none"
        >
          <option value="">— theme default ({theme.fontHeading}) —</option>
          {FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </Section>
    </>
  );
}

function SlotInspector({ page, slotKey, imagesById, onClearSlot, onEditCrop }) {
  const slot = page.slots?.[slotKey];
  const item = slot?.publicId ? imagesById?.get(slot.publicId) : null;

  if (!slot || !slot.publicId) {
    return (
      <Section title="Photo Slot">
        <p className="text-sm text-charcoal/65">
          Empty slot. Drag a photo from the bin onto this slot, or tap a photo
          then tap the slot.
        </p>
      </Section>
    );
  }

  const hasCustomCrop = !!slot.crop?.area;

  return (
    <>
      <Section title="Photo">
        {item ? (
          <div className="aspect-square rounded-md overflow-hidden ring-1 ring-burgundy/15 mb-3">
            <img
              src={cdnUrl(item.secure_url, { w: 800, q: 85 })}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                if (e.currentTarget.dataset.fallback !== "1") {
                  e.currentTarget.dataset.fallback = "1";
                  e.currentTarget.src = item.secure_url;
                }
              }}
            />
          </div>
        ) : (
          <div className="aspect-square rounded-md bg-cream/60 ring-1 ring-burgundy/15 mb-3 grid place-items-center text-[10px] uppercase tracking-[0.2em] text-charcoal/55">
            Photo unavailable
          </div>
        )}
      </Section>

      <Section title="Crop & focus">
        <button
          type="button"
          onClick={() => onEditCrop?.(slotKey)}
          className="w-full px-3 py-2 rounded-full text-xs font-semibold bg-olive text-cream hover:bg-burgundy shadow-soft transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2v14a2 2 0 002 2h14" />
            <path d="M18 22V8a2 2 0 00-2-2H2" />
          </svg>
          {hasCustomCrop ? "Adjust crop" : "Edit crop"}
        </button>
        {hasCustomCrop && (
          <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-charcoal/55 text-center">
            Custom crop applied
          </p>
        )}
      </Section>

      <Section title="Actions">
        <button
          type="button"
          onClick={() => onClearSlot(slotKey)}
          className="w-full px-3 py-1.5 rounded-full text-xs font-semibold bg-cream ring-1 ring-burgundy/15 text-wine hover:bg-wine/10 transition-colors"
        >
          Clear slot
        </button>
      </Section>
    </>
  );
}

function TextInspector({ page, textKey, onSetCaption, onSetTextStyle }) {
  const entry = page.texts?.[textKey];
  const value = getTextValue(entry);
  const style = getTextStyle(entry);

  const setField = (field, val) => onSetTextStyle?.(textKey, field, val);

  return (
    <>
      <Section title={`Text — ${textKey}`}>
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onSetCaption(textKey, e.target.value)}
          placeholder="Type caption…"
          className="w-full rounded-md border border-burgundy/20 px-3 py-2 text-sm bg-white focus:border-burgundy focus:ring-2 focus:ring-gold/40 outline-none"
        />
      </Section>

      <Section title="Font">
        <div className="grid grid-cols-2 gap-1.5">
          {FONT_OPTIONS.map((f) => {
            const active = (style.font || "Playfair Display") === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setField("font", f.id === "Playfair Display" ? null : f.id)}
                className={`relative px-2 py-2 rounded-md ring-1 transition-all text-left ${
                  active
                    ? "ring-2 ring-gold ring-offset-1 ring-offset-cream bg-gold/10"
                    : "ring-burgundy/15 hover:ring-burgundy/40 bg-white"
                }`}
                style={{ fontFamily: `"${f.id}", serif` }}
              >
                <span className="block text-base text-burgundy">{f.sample}</span>
                <span className="block text-[10px] uppercase tracking-[0.12em] text-charcoal/55 font-sans not-italic">
                  {f.name}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={`Size — ${style.size || "auto"}`}>
        <input
          type="range"
          min="12"
          max="120"
          step="2"
          value={style.size || 32}
          onChange={(e) => setField("size", parseInt(e.target.value, 10))}
          className="w-full accent-wine"
        />
        {style.size != null && (
          <button
            type="button"
            onClick={() => setField("size", null)}
            className="mt-1 text-[10px] uppercase tracking-[0.18em] text-charcoal/55 hover:text-burgundy"
          >
            Reset to auto
          </button>
        )}
      </Section>

      <Section title="Color">
        <div className="flex flex-wrap gap-1.5">
          {TEXT_COLOR_SWATCHES.map((c) => {
            const active = style.color === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setField("color", c)}
                aria-label={`Color ${c}`}
                className={`w-7 h-7 rounded-full ring-2 transition-all ${
                  active
                    ? "ring-gold scale-110"
                    : "ring-burgundy/15 hover:ring-burgundy/40"
                }`}
                style={{ backgroundColor: c }}
              />
            );
          })}
          <label className="w-7 h-7 grid place-items-center rounded-full ring-2 ring-burgundy/15 hover:ring-burgundy/40 cursor-pointer overflow-hidden bg-white">
            <input
              type="color"
              value={style.color || "#5A1A2B"}
              onChange={(e) => setField("color", e.target.value)}
              className="opacity-0 w-full h-full cursor-pointer"
              aria-label="Custom color"
            />
            <span className="absolute text-[10px] text-burgundy">+</span>
          </label>
        </div>
        {style.color && (
          <button
            type="button"
            onClick={() => setField("color", null)}
            className="mt-2 text-[10px] uppercase tracking-[0.18em] text-charcoal/55 hover:text-burgundy"
          >
            Reset to theme accent
          </button>
        )}
      </Section>

      <Section title="Style">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "left", label: "⟵" },
            { id: "center", label: "═" },
            { id: "right", label: "⟶" },
          ].map((a) => {
            const active = (style.align || "center") === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setField("align", a.id === "center" ? null : a.id)}
                aria-label={`Align ${a.id}`}
                className={`px-3 py-1.5 rounded-md text-sm font-mono ring-1 transition-colors ${
                  active
                    ? "bg-olive text-cream ring-olive"
                    : "bg-white ring-burgundy/15 hover:ring-burgundy/40 text-burgundy"
                }`}
              >
                {a.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setField("italic", !style.italic ? true : null)}
            aria-pressed={!!style.italic}
            className={`px-3 py-1.5 rounded-md text-sm italic font-serif ring-1 transition-colors ${
              style.italic
                ? "bg-olive text-cream ring-olive"
                : "bg-white ring-burgundy/15 hover:ring-burgundy/40 text-burgundy"
            }`}
          >
            I
          </button>
          <button
            type="button"
            onClick={() => setField("weight", style.weight === "700" ? null : "700")}
            aria-pressed={style.weight === "700"}
            className={`px-3 py-1.5 rounded-md text-sm font-bold font-serif ring-1 transition-colors ${
              style.weight === "700"
                ? "bg-olive text-cream ring-olive"
                : "bg-white ring-burgundy/15 hover:ring-burgundy/40 text-burgundy"
            }`}
          >
            B
          </button>
        </div>
      </Section>
    </>
  );
}
