import React, { useEffect, useId, useRef, useState } from "react";
import { Input } from "./UiComponents";
import "./sectionColorPicker.css";

const SUGGESTED_COLORS = [
  "#ffffff", "#1c1917", "#d4af37", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef",
];
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const clamp = (value) => Math.max(0, Math.min(1, value));

function hexToRgba(value) {
  if (!HEX_COLOR.test(value)) return null;
  let digits = value.slice(1);
  if (digits.length < 6) digits = [...digits].map((digit) => digit + digit).join("");
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
    alpha: digits.length === 8 ? digits.slice(6, 8).toLowerCase() : "",
  };
}

function rgbToHsv({ r, g, b }) {
  const channels = [r, g, b].map((channel) => channel / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const difference = max - min;
  let hue = 0;
  if (difference) {
    if (max === channels[0]) hue = ((channels[1] - channels[2]) / difference) % 6;
    else if (max === channels[1]) hue = (channels[2] - channels[0]) / difference + 2;
    else hue = (channels[0] - channels[1]) / difference + 4;
  }
  return { h: (hue * 60 + 360) % 360, s: max ? difference / max : 0, v: max };
}

function hsvToHex(h, s, v, alpha = "") {
  const chroma = v * s;
  const segment = (h % 360) / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const candidates = [
    [chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary],
    [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary],
  ];
  const rgb = candidates[Math.floor(segment)].map((channel) =>
    Math.round((channel + v - chroma) * 255).toString(16).padStart(2, "0"));
  return `#${rgb.join("")}${alpha}`;
}

export default function SectionColorPicker({ value, onChange, label = "Color" }) {
  const [open, setOpen] = useState(false);
  const [hue, setHue] = useState(0);
  const rootRef = useRef(null);
  const draggingRef = useRef(false);
  const panelId = useId();
  const safe = typeof value === "string" ? value : "";
  const parsed = hexToRgba(safe);
  const hsv = rgbToHsv(parsed || { r: 212, g: 175, b: 55 });
  const visibleHue = hsv.s > 0.001 ? hsv.h : hue;

  useEffect(() => {
    if (hsv.s > 0.001) setHue(hsv.h);
  }, [hsv.h, hsv.s]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const changeTone = (event) => {
    const nextHue = Number(event.target.value);
    setHue(nextHue);
    onChange?.(hsvToHex(nextHue, hsv.s || 0.75, hsv.v || 0.85, parsed?.alpha));
  };

  const changeArea = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    const saturation = clamp((event.clientX - bounds.left) / bounds.width);
    const brightness = 1 - clamp((event.clientY - bounds.top) / bounds.height);
    onChange?.(hsvToHex(visibleHue, saturation, brightness, parsed?.alpha));
  };

  const changeAreaWithKeyboard = (event) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    let { s, v } = hsv;
    if (event.key === "ArrowLeft") s = clamp(s - step);
    else if (event.key === "ArrowRight") s = clamp(s + step);
    else if (event.key === "ArrowUp") v = clamp(v + step);
    else if (event.key === "ArrowDown") v = clamp(v - step);
    else return;
    event.preventDefault();
    onChange?.(hsvToHex(visibleHue, s, v, parsed?.alpha));
  };

  return (
    <div className="section-color-picker" ref={rootRef}>
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
          <span style={{ backgroundColor: parsed ? safe : "#d4af37" }} />
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
      {safe && !parsed ? (
        <p className="section-color-picker__error" role="status">Usa #RGB, #RRGGBB o #RRGGBBAA.</p>
      ) : null}
      {open ? (
        <div className="section-color-picker__panel" id={panelId}>
          <div className="section-color-picker__heading">
            <strong>Elige el color</strong>
            <span>Arrastra en el cuadro o usa las flechas del teclado.</span>
          </div>
          <div
            className="section-color-picker__area"
            role="group"
            aria-label={`Saturación y brillo de ${label}`}
            tabIndex={0}
            style={{ backgroundColor: `hsl(${visibleHue} 100% 50%)` }}
            onPointerDown={(event) => {
              draggingRef.current = true;
              event.currentTarget.setPointerCapture?.(event.pointerId);
              changeArea(event);
            }}
            onPointerMove={(event) => { if (draggingRef.current) changeArea(event); }}
            onPointerUp={() => { draggingRef.current = false; }}
            onPointerCancel={() => { draggingRef.current = false; }}
            onKeyDown={changeAreaWithKeyboard}
          >
            <span
              className="section-color-picker__cursor"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
          <label className="section-color-picker__hue-label" htmlFor={`${panelId}-tone`}>
            <span>Tono</span><span>{Math.round(visibleHue)}°</span>
          </label>
          <input
            id={`${panelId}-tone`}
            className="section-color-picker__hue"
            type="range"
            min="0"
            max="359"
            value={Math.round(visibleHue)}
            onChange={changeTone}
            aria-label={`Tono de ${label}`}
          />
          <div className="section-color-picker__suggestions" role="group" aria-label="Colores sugeridos">
            <span>Atajos</span>
            <div>
              {SUGGESTED_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  style={{ backgroundColor: color }}
                  className={safe.toLowerCase() === color ? "is-selected" : ""}
                  onClick={() => onChange?.(parsed?.alpha ? `${color}${parsed.alpha}` : color)}
                  title={color}
                  aria-label={`Usar color ${color}`}
                  aria-pressed={safe.toLowerCase() === color}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
