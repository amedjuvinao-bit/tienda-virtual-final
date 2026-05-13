// src/admin/appearance/sections/ui/SectionsPanelUI.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Input } from "./UiComponents";
import { isHexColor, clampNumber } from "./sectionHelpers";

// ✅ IMPORTANTE: se mantiene porque CardImageMover sí consulta imágenes del producto por productId
import api from "../../../../lib/api";

// ============================================
// ✅ Badge de estado de sección
// ============================================
export function SectionBadge({ enabled, supported }) {
  const text = !supported ? "No soportada" : enabled ? "Activa" : "Desactivada";
  const cls = !supported
    ? "bg-amber-50 border-amber-200 text-amber-900"
    : enabled
    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
    : "bg-neutral-50 border-neutral-200 text-neutral-600";

  return (
    <span className={["text-[11px] px-2 py-1 rounded-full border", cls].join(" ")}>
      {text}
    </span>
  );
}

// ============================================
// ✅ Botón de pestaña
// ============================================
export function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-xl text-sm font-bold border transition",
        active
          ? "bg-neutral-900 text-white border-neutral-900"
          : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ============================================
// ✅ Modal reusable (overlay + panel)
// ============================================
export function ModalShell({ open, title, onClose, children }) {
  const isOpen = typeof open === "boolean" ? open : true;
  const contentRef = useRef(null);
  const scrollTopRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const el = contentRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = scrollTopRef.current || 0;
    });
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="absolute inset-0 p-3 sm:p-6 flex items-center justify-center">
        <div className="w-full max-w-6xl max-h-[90vh] rounded-2xl bg-white shadow-xl border border-neutral-200 overflow-hidden relative">
          {title ? (
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div className="text-base sm:text-lg font-extrabold text-neutral-900">
                {title}
              </div>
              <Button type="button" kind="ghost" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          ) : null}

          <div
            ref={contentRef}
            onScroll={() => {
              const el = contentRef.current;
              if (el) scrollTopRef.current = el.scrollTop;
            }}
            className={
              title
                ? "p-4 overflow-y-auto max-h-[calc(90vh-70px)]"
                : "p-4 overflow-y-auto max-h-[90vh]"
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ✅ Paletas / tipografías / ayudas
// ============================================
export const COLOR_PALETTES = {
  rosa: ["#ffffff", "#111827", "#d4af37", "#fce7f3", "#fb7185", "#ec4899", "#fda4af", "#ffe4e6"],
  neutros: ["#ffffff", "#f5f5f5", "#e5e7eb", "#d1d5db", "#9ca3af", "#4b5563", "#111827", "#000000"],
  dorados: ["#fff7e6", "#fceec8", "#f3d68a", "#d4af37", "#b8860b", "#8b6b1f"],
};

export const CARD_TEXT_FONT_OPTIONS = [
  { label: "Por defecto del sitio (inherit)", value: "" },
  { label: "System UI (rápida y limpia)", value: "system-ui" },
  { label: "Inter (moderna)", value: "Inter, system-ui, sans-serif" },
  { label: "Poppins (moderna/Redondeada)", value: "Poppins, system-ui, sans-serif" },
  { label: "Montserrat (elegante)", value: "Montserrat, system-ui, sans-serif" },
  { label: "Playfair Display (lujosa)", value: '"Playfair Display", Georgia, serif' },
  { label: "Cormorant Garamond (premium)", value: '"Cormorant Garamond", Georgia, serif' },
  { label: "Lora (serif suave)", value: "Lora, Georgia, serif" },
  { label: "Personalizada… (pegar)", value: "__custom__" },
];

// ============================================
// ✅ Utiles de texto
// ============================================
export function buildTextStyle(st, prefix, fallback = {}) {
  const fontFamily =
    typeof st?.[`${prefix}FontFamily`] === "string" && st[`${prefix}FontFamily`].trim()
      ? st[`${prefix}FontFamily`].trim()
      : fallback.fontFamily || "inherit";

  const color =
    typeof st?.[`${prefix}Color`] === "string" && st[`${prefix}Color`].trim()
      ? st[`${prefix}Color`].trim()
      : fallback.color || "inherit";

  const sizePx = clampNumber(
    Number(st?.[`${prefix}SizePx`] ?? fallback.fontSize ?? 14),
    8,
    120
  );

  const weight = clampNumber(
    Number(st?.[`${prefix}Weight`] ?? fallback.fontWeight ?? 400),
    100,
    900
  );

  return {
    fontFamily,
    color,
    fontSize: sizePx,
    fontWeight: weight,
    fontStyle: st?.[`${prefix}Italic`] ? "italic" : "normal",
    textDecoration: st?.[`${prefix}Underline`] ? "underline" : "none",
  };
}

// ============================================
// ✅ Campo de color
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

export function ColorField({
  label,
  hint,
  value,
  onChange,
  onHelp,
  palettes = ["rosa", "neutros", "dorados"],
}) {
  const safe = typeof value === "string" ? value : "";
  const valid = isHexColor(safe);

  const setColor = (v) => onChange?.(v);

  return (
    <Field label={label} hint={hint}>
      <div className="grid grid-cols-[minmax(0,1fr)_44px_32px] gap-2 items-center">
        <Input
          value={safe}
          onChange={(e) => setColor(e.target.value)}
          placeholder="#ffffff"
        />

        <input
          type="color"
          value={valid ? safe : "#000000"}
          onChange={(e) => setColor(e.target.value)}
          className="w-11 h-10 p-0 border border-neutral-200 rounded-lg bg-white cursor-pointer"
          title="Elegir color"
        />

        <HelpButton onClick={onHelp} />
      </div>

      {!valid && safe ? (
        <div className="mt-2 text-xs text-rose-700">
          Color inválido. Usa formato <b>#RGB</b> o <b>#RRGGBB</b>.
        </div>
      ) : null}
    </Field>
  );
}

// ============================================
// ✅ Dropdown de rutas
// ============================================
export const BASE_ROUTE_OPTIONS = [
  { label: "Inicio", value: "/" },
  { label: "Lo nuevo", value: "/lo-nuevo" },
  { label: "Carrito", value: "/carrito" },
  { label: "Favoritos", value: "/favoritos" },
  { label: "Checkout", value: "/checkout" },
  { label: "Gracias", value: "/gracias" },
  { label: "Categorías", value: "/categorias" },
  { label: "Contacto", value: "/contacto" },
  { label: "Búsqueda", value: "/buscar" },
];

export function uniqRouteOptions(options) {
  const seen = new Set();
  const out = [];
  for (const o of options || []) {
    const v = String(o?.value || "").trim();
    const l = String(o?.label || v).trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push({ label: l || v, value: v });
  }
  return out;
}

export function RouteDropdown({ label, value, onChange, options }) {
  const safeValue = typeof value === "string" ? value : "";
  const list = Array.isArray(options) ? options : [];

  const inList = list.some((o) => o.value === safeValue);
  const [mode, setMode] = useState(inList ? "list" : safeValue ? "custom" : "list");

  useEffect(() => {
    const nowInList = list.some((o) => o.value === safeValue);
    setMode(nowInList ? "list" : safeValue ? "custom" : "list");
  }, [safeValue, list]);

  return (
    <Field label={label} hint="Selecciona una ruta o pega una personalizada">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-2">
        {mode === "list" ? (
          <select
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
            value={inList ? safeValue : ""}
            onChange={(e) => onChange?.(e.target.value)}
          >
            <option value="">(Selecciona…)</option>
            {list.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.value}
              </option>
            ))}
          </select>
        ) : (
          <Input
            value={safeValue}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder="/carrito o /favoritos o https://..."
          />
        )}

        <select
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          title="Modo"
        >
          <option value="list">Lista</option>
          <option value="custom">Personalizada…</option>
        </select>
      </div>
    </Field>
  );
}

// ============================================
// ✅ Util: extraer imágenes de un producto (backend)
// ============================================
function extractAllImagesFromProduct(product) {
  if (!product || typeof product !== "object") return [];

  const images = new Set();

  if (typeof product.image === "string" && product.image.trim()) images.add(product.image.trim());
  if (typeof product.image1 === "string" && product.image1.trim()) images.add(product.image1.trim());
  if (typeof product.image2 === "string" && product.image2.trim()) images.add(product.image2.trim());

  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      if (typeof img === "string" && img.trim()) images.add(img.trim());
      else if (img && typeof img === "object" && typeof img.url === "string" && img.url.trim()) {
        images.add(img.url.trim());
      }
    }
  }

  if (product.images && typeof product.images === "object") {
    if (typeof product.images.cover === "string" && product.images.cover.trim()) {
      images.add(product.images.cover.trim());
    }
    if (Array.isArray(product.images.gallery)) {
      for (const g of product.images.gallery) {
        if (typeof g === "string" && g.trim()) images.add(g.trim());
        else if (g && typeof g === "object" && typeof g.url === "string" && g.url.trim()) {
          images.add(g.url.trim());
        }
      }
    }
  }

  return Array.from(images);
}

// ============================================
// ✅ CardImageMover
// ============================================
export function CardImageMover({ productId, item, uploadToCloudinary, onChangeImages }) {
  const [loading, setLoading] = useState(false);
  const [imgs, setImgs] = useState([]);
  const [mode, setMode] = useState("main");
  const [main, setMain] = useState("");
  const [hover, setHover] = useState("");
  const [error, setError] = useState("");

  const pid = useMemo(() => {
    const fromItem = item && typeof item === "object" ? String(item.productId || "").trim() : "";
    const fromProp = String(productId || "").trim();
    return fromProp || fromItem;
  }, [productId, item]);

  useEffect(() => {
    const m = item && typeof item === "object" ? String(item.mainImage || "").trim() : "";
    const h = item && typeof item === "object" ? String(item.hoverImage || "").trim() : "";
    setMain((prev) => prev || m);
    setHover((prev) => prev || h);
  }, [pid, item]);

  const fetchImages = async () => {
    if (!pid) return;
    setLoading(true);
    setError("");
    try {
      const r = await api.get(`/api/products/${encodeURIComponent(pid)}`);
      const payload = r?.data?.product || r?.data?.data || r?.data;
      const list = extractAllImagesFromProduct(payload);

      setImgs(list);

      const first = list[0] || "";
      const second = list[1] || first;

      setMain((prev) => prev || (item?.mainImage ? String(item.mainImage).trim() : "") || first);
      setHover((prev) => prev || (item?.hoverImage ? String(item.hoverImage).trim() : "") || second);

      const nextMain = (item?.mainImage ? String(item.mainImage).trim() : "") || first;
      const nextHover = (item?.hoverImage ? String(item.hoverImage).trim() : "") || second;

      if (nextMain) onChangeImages?.({ mainImage: nextMain, hoverImage: nextHover });
    } catch (e) {
      console.error("CardImageMover: error consultando producto:", e);
      setImgs([]);
      setError("No pude cargar las imágenes de este producto.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const emit = (m, h) => {
    const mm = String(m || "").trim();
    const hh = String(h || "").trim();
    onChangeImages?.({
      mainImage: mm,
      hoverImage: hh || mm,
    });
  };

  const pick = (url) => {
    if (!url) return;

    if (mode === "hover") {
      setHover(url);
      emit(main || url, url);
    } else {
      setMain(url);
      emit(url, hover || url);
    }
  };

  const handleUpload = async (file) => {
    if (!uploadToCloudinary || !file) return;
    setLoading(true);
    setError("");
    try {
      const url = await uploadToCloudinary(file);
      if (!url) return;

      setImgs((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        if (!next.includes(url)) next.unshift(url);
        return next;
      });

      pick(url);
    } catch (e) {
      console.error("CardImageMover: error subiendo imagen:", e);
      setError("No pude subir la imagen.");
    } finally {
      setLoading(false);
    }
  };

  const selectedHint = useMemo(() => {
    if (!main && !hover) return "Sin selección";
    return `Principal: ${main ? "OK" : "—"} · Hover: ${hover ? "OK" : "—"}`;
  }, [main, hover]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-neutral-900">Imágenes del producto</div>
          <div className="text-xs text-neutral-500">
            Elige una miniatura como <b>Principal</b> o <b>Hover</b>.
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">{selectedHint}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("main")}
            className={[
              "px-2 py-1 rounded-lg border text-xs font-semibold",
              mode === "main"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50",
            ].join(" ")}
          >
            Elegir Principal
          </button>
          <button
            type="button"
            onClick={() => setMode("hover")}
            className={[
              "px-2 py-1 rounded-lg border text-xs font-semibold",
              mode === "hover"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50",
            ].join(" ")}
          >
            Elegir Hover
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button type="button" kind="ghost" size="sm" onClick={fetchImages} disabled={loading || !pid}>
          {loading ? "Cargando..." : "Recargar"}
        </Button>

        <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer shadow-sm hover:bg-neutral-800 transition">
          <span className="mr-1">{loading ? "Procesando..." : "Subir imagen"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={loading || !uploadToCloudinary}
            onChange={(e) => handleUpload(e.target.files?.[0] || null)}
          />
        </label>

        {!uploadToCloudinary ? (
          <span className="text-[11px] text-neutral-400">(uploadToCloudinary no está disponible)</span>
        ) : null}
      </div>

      {error ? <div className="mt-2 text-xs text-rose-700">{error}</div> : null}

      <div className="mt-3 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
        {!imgs.length && !loading ? (
          <div className="col-span-full text-xs text-neutral-500">
            No hay imágenes disponibles para este producto (o no pude cargarlas).
          </div>
        ) : null}

        {imgs.map((url) => {
          const isMain = main && url === main;
          const isHover = hover && url === hover;

          return (
            <button
              key={url}
              type="button"
              onClick={() => pick(url)}
              className={[
                "relative h-14 w-14 rounded-lg overflow-hidden border bg-neutral-50",
                isMain ? "border-emerald-500 ring-2 ring-emerald-500/20" : "",
                isHover ? "border-fuchsia-500 ring-2 ring-fuchsia-500/20" : "",
                !isMain && !isHover ? "border-neutral-200 hover:border-neutral-400" : "",
              ].join(" ")}
              title={url}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
              {(isMain || isHover) && (
                <div className="absolute bottom-0 left-0 right-0 text-[10px] font-bold text-white bg-black/60 px-1 py-[2px]">
                  {isMain ? "MAIN" : "HOVER"}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// ✅ Helper: estilo de texto para cards
// ============================================
export function getCardTextStyle(st) {
  const s = st || {};
  const baseColor =
    typeof s.cardTextColor === "string" && s.cardTextColor.trim() ? s.cardTextColor : "inherit";

  return {
    fontFamily: s.cardTextFontFamily || "inherit",
    color: baseColor,
    fontSize: clampNumber(Number(s.cardTextSizePx ?? 14), 10, 32),
    fontWeight: clampNumber(Number(s.cardTextWeight ?? 700), 200, 900),
    fontStyle: s.cardTextItalic ? "italic" : "normal",
    textDecoration: s.cardTextUnderline ? "underline" : "none",
  };
}

// ============================================
// ✅ Campo rango + número
// ============================================
export function RangeNumberField({
  label,
  hint,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
}) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : Number(min);

  return (
    <Field label={label} hint={hint}>
      <div className="grid grid-cols-[1fr_96px] gap-3 items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safe}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className="w-full"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={safe}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        />
      </div>
    </Field>
  );
}

// ============================================
// ✅ Toggle simple
// ============================================
export function ToggleChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-xl border text-sm font-semibold transition",
        active
          ? "bg-neutral-900 text-white border-neutral-900"
          : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ============================================
// ✅ Selector de fuentes reutilizable
// ============================================
export function FontFamilyField({
  label,
  value,
  onChange,
  options = CARD_TEXT_FONT_OPTIONS,
  customPlaceholder = 'Ej: "Playfair Display", serif',
}) {
  const safeValue = typeof value === "string" ? value : "";
  const inList = options.some((o) => o.value === safeValue);
  const [mode, setMode] = useState(inList || !safeValue ? "list" : "custom");

  useEffect(() => {
    const nextInList = options.some((o) => o.value === safeValue);
    setMode(nextInList || !safeValue ? "list" : "custom");
  }, [safeValue, options]);

  const selectedListValue = inList ? safeValue : "";

  return (
    <Field label={label}>
      <div className="grid grid-cols-1 gap-2">
        {mode === "list" ? (
          <select
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
            value={selectedListValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") {
                setMode("custom");
                onChange?.("");
                return;
              }
              onChange?.(v);
            }}
          >
            {options.map((opt) => (
              <option key={opt.value || "inherit"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            value={safeValue}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={customPlaceholder}
          />
        )}

        <select
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="list">Lista</option>
          <option value="custom">Personalizada…</option>
        </select>
      </div>
    </Field>
  );
}

// ============================================
// ✅ Editor de estilos de texto
// ============================================
export function TextStyleFields({
  title,
  prefix,
  style,
  onChange,
  showColorHelp,
}) {
  const setField = (key, val) => {
    onChange?.({
      ...(style || {}),
      [key]: val,
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="text-sm font-extrabold text-neutral-900 mb-3">{title}</div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <FontFamilyField
          label="Familia tipográfica"
          value={style?.[`${prefix}FontFamily`] || ""}
          onChange={(v) => setField(`${prefix}FontFamily`, v)}
        />

        <ColorField
          label="Color"
          value={style?.[`${prefix}Color`] || ""}
          onChange={(v) => setField(`${prefix}Color`, v)}
          onHelp={showColorHelp}
        />

        <RangeNumberField
          label="Tamaño (px)"
          min={8}
          max={120}
          step={1}
          value={style?.[`${prefix}SizePx`] ?? 14}
          onChange={(v) => setField(`${prefix}SizePx`, v)}
        />

        <RangeNumberField
          label="Peso"
          min={100}
          max={900}
          step={100}
          value={style?.[`${prefix}Weight`] ?? 400}
          onChange={(v) => setField(`${prefix}Weight`, v)}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ToggleChip
          active={!!style?.[`${prefix}Italic`]}
          onClick={() => setField(`${prefix}Italic`, !style?.[`${prefix}Italic`])}
        >
          Itálica
        </ToggleChip>

        <ToggleChip
          active={!!style?.[`${prefix}Underline`]}
          onClick={() => setField(`${prefix}Underline`, !style?.[`${prefix}Underline`])}
        >
          Subrayado
        </ToggleChip>
      </div>
    </div>
  );
}