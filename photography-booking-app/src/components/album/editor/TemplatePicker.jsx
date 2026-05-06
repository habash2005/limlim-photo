import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TEMPLATE_LIST,
  TEMPLATE_CATEGORIES,
  renderTemplateThumbSvg,
} from "../albumTemplates";

export default function TemplatePicker({ currentTemplateId, theme, onPick }) {
  const [category, setCategory] = useState("single");

  const templates = TEMPLATE_LIST.filter((t) => t.category === category);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors ${
              category === c.id
                ? "bg-olive text-cream shadow-soft"
                : "bg-cream text-charcoal/70 ring-1 ring-burgundy/15 hover:bg-gold/20"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={category}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 gap-2"
        >
          {templates.map((t) => {
            const active = currentTemplateId === t.id;
            const svg = renderTemplateThumbSvg(t, {
              fill: theme.accent,
              bg: theme.pageBg,
              textFill: theme.accent,
            });
            return (
              <motion.button
                key={t.id}
                type="button"
                onClick={() => onPick(t.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className={`flex flex-col items-stretch gap-1.5 p-2 rounded-lg ring-1 transition-all ${
                  active
                    ? "ring-2 ring-gold ring-offset-1 ring-offset-cream bg-gold/10"
                    : "ring-burgundy/15 hover:ring-burgundy/40 bg-white"
                }`}
              >
                <span
                  className="aspect-[3/4] rounded-[2px] overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <span className="text-[10px] font-sans uppercase tracking-[0.15em] text-charcoal/65 leading-tight text-left">
                  {t.name}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
