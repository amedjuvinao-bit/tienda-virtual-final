import React, { useId, useState } from "react";
import { Input } from "./UiComponents";
import "./sectionColorPicker.css";

export const SECTION_COLOR_PALETTES = {
  rosa: ["#fff1f5", "#fecddc", "#fb7185", "#e11d48", "#9f1239"],
  neutros: ["#ffffff", "#f5f5f4", "#a8a29e", "#44403c", "#111827", "#000000"],
  dorados: ["#fffbeb", "#fde68a", "#d4af37", "#a16207", "#713f12"],
  tierra: ["#f5e6d3", "#d4a373", "#a47148", "#75533b", "#3f2d20"],
  frescos: ["#ecfeff", "#67e8f9", "#0d9488", "#2563eb", "#312e81"],
};

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function colorForNativePicker(value) {
  if (!HEX_COLOR.test(value)) return "#d4af37";
  if (value.length === 4 || value.length === 5) {
    return `#${[...value.slice(1, 4)].map((digit) => digit + digit).join("")}`;
  }
  return value.slice(0, 7);
}

export default function SectionColorPicker({ value, onChange, label = "Color", palettes }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const safe = typeof value === "string" ? value : "";
  const valid = HEX_COLOR.test(safe);
  const groups = (palettes?.length ? palettes : Object.keys(SECTION_COLOR_PALETTES))
    .filter((name) => SECTION_COLOR_PALETTES[name]);
  const chosen = colorForNativePicker(safe);

  return (
    <div className="section-color-picker">
      <div className="section-color-picker__row">
        <button
          type="button"
          className="section-color-picker__current"
          onClick={() => setOpen((previous) => !previous)}
          aria-label={`Abrir paleta de ${label}`}
          aria-expanded={open}
          aria-controls={panelId}
          title="Abrir paleta de colores"
        >
          <span style={{ backgroundColor: valid ? safe : chosen }} />
        </button>
        <Input
          value={safe}
          onChange={(event) => onChange?.(event.target.value)}
          aria-label={`${label}: código hexadecimal`}
          placeholder="#ffffff"
          spellCheck={false}
          className="section-color-picker__hex"
        />
        <button
          type="button"
          className="section-color-picker__toggle"
          onClick={() => setOpen((previous) => !previous)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          {open ? "Cerrar" : "Paleta"}
        </button>
      </div>
      {safe && !valid ? (
        <p className="section-color-picker__error" role="status">
          Usa #RGB, #RRGGBB o #RRGGBBAA.
        </p>
      ) : null}
      {open ? (
        <div className="section-color-picker__panel" id={panelId}>
          <div className="section-color-picker__spectrum">
            <div>
              <strong>Espectro completo</strong>
              <span>Elige cualquier tono y ajusta el código si lo necesitas.</span>
            </div>
            <input
              type="color"
              value={chosen}
              onChange={(event) => onChange?.(event.target.value)}
              aria-label={`Elegir ${label} del espectro completo`}
            />
          </div>
          <div className="section-color-picker__groups">
            {groups.map((name) => (
              <div key={name} className="section-color-picker__group" role="group" aria-label={`Gama ${name}`}>
                <span>{name}</span>
                <div>
                  {SECTION_COLOR_PALETTES[name].map((color) => (
                    <button
                      key={color}
                      type="button"
                      style={{ backgroundColor: color }}
                      className={safe.toLowerCase() === color ? "is-selected" : ""}
                      onClick={() => onChange?.(color)}
                      title={color}
                      aria-label={`Usar color ${color}`}
                      aria-pressed={safe.toLowerCase() === color}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
