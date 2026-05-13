// src/admin/appearance/sections/ui/ColorField.jsx
import React from "react";
import { Field, Input } from "./UiComponents";
import { isHexColor } from "./sectionHelpers";

// ============================================
// ✅ Paletas de color (idénticas al original)
// ============================================
export const COLOR_PALETTES = {
  rosa: [
    "#ffffff",
    "#111827",
    "#d4af37",
    "#fce7f3",
    "#fb7185",
    "#ec4899",
    "#fda4af",
    "#ffe4e6",
  ],
  neutros: [
    "#ffffff",
    "#f5f5f5",
    "#e5e7eb",
    "#d1d5db",
    "#9ca3af",
    "#4b5563",
    "#111827",
    "#000000",
  ],
  dorados: [
    "#fff7e6",
    "#fceec8",
    "#f3d68a",
    "#d4af37",
    "#b8860b",
    "#8b6b1f",
  ],
};

// ============================================
// ✅ Botón de ayuda
// ============================================
export function HelpButton({ onClick, title = "Ayuda" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
      title={title}
      aria-label={title}
    >
      ?
    </button>
  );
}

// ============================================
// ✅ ColorField
// ============================================
export default function ColorField({
  label,
  hint,
  value,
  onChange,
  onHelp,
  palettes = ["rosa", "neutros", "dorados"],
}) {
  const safe = typeof value === "string" ? value : "";
  const isValid = isHexColor(safe);

  const setColor = (v) => onChange?.(v);

  // 🔥 SOLUCIÓN REAL:
  // Eliminamos colores duplicados (ej: #ffffff)
  const allColors = palettes.flatMap((k) =>
    Array.isArray(COLOR_PALETTES[k]) ? COLOR_PALETTES[k] : []
  );

  const uniqueColors = [];
  const seen = new Set();

  for (const c of allColors) {
    const normalized = String(c || "").toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueColors.push(c);
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <Input
          value={safe}
          onChange={(e) => setColor(e.target.value)}
          placeholder="#ffffff"
        />

        <input
          type="color"
          value={isValid ? safe : "#000000"}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 p-0 border border-neutral-200 rounded-lg bg-white cursor-pointer"
          title="Elegir color"
        />

        <HelpButton onClick={onHelp} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {uniqueColors.slice(0, 14).map((c, index) => (
          <button
            key={`${c.toLowerCase()}-${index}`}
            type="button"
            onClick={() => setColor(c)}
            className={[
              "w-7 h-7 rounded-full border transition",
              safe?.toLowerCase() === c.toLowerCase()
                ? "border-neutral-900 ring-2 ring-neutral-900/20"
                : "border-neutral-200 hover:border-neutral-400",
            ].join(" ")}
            style={{ backgroundColor: c }}
            title={c}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      {!isValid && safe ? (
        <div className="mt-2 text-xs text-rose-700">
          Color inválido. Usa formato <b>#RGB</b> o <b>#RRGGBB</b>.
        </div>
      ) : null}
    </Field>
  );
}