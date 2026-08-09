// src/components/FilterSidebar.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Range } from "react-range";
import {
  ChevronDown,
  Search,
  Sparkles,
  SlidersHorizontal,
  Palette,
  BadgeDollarSign,
} from "lucide-react";
import api from "../lib/api";
import { normalizeFilterCategories } from "./filterSidebarMeta";

// ===== Precio =====
const MIN_PRICE = 0;
const MAX_PRICE = 10_000_000;
const STEP_PRICE = 10_000;
const formatMoney = (n) => Number(n || 0).toLocaleString("es-CO");

// ===== Sugerencias (fallback) =====
const SUGGESTED_CATEGORIES = [
  "Vestidos cortos",
  "Vestidos largos",
  "Conjuntos",
  "Pantalones",
  "Jeans",
  "Shorts",
  "Faldas",
  "Blusas",
  "Pijamas",
  "Abrigos",
  "Accesorios",
];

const COLORS_FALLBACK = [
  "#6fd2c5",
  "#ffe991",
  "#a9d4ed",
  "#fae1b8",
  "#ffffff",
  "#cfa8e0",
  "#eacbcb",
  "#ff7bac",
  "#fbb2d3",
  "#ff8c94",
];

// ===== Util colores =====
const COLOR_LABELS = {
  "#d4af37": "Dorado",
  "#6fd2c5": "Aqua pastel",
  "#ffe991": "Amarillo pastel",
  "#a9d4ed": "Azul pastel",
  "#fae1b8": "Durazno",
  "#ffffff": "Blanco",
  "#cfa8e0": "Lila",
  "#eacbcb": "Rosa claro",
  "#ff7bac": "Rosa",
  "#fbb2d3": "Rosa suave",
  "#ff8c94": "Coral",
  "#000000": "Negro",
  "#ff69b4": "Rosa",
  "#ff1493": "Fucsia",
  "#0000ff": "Azul",
  "#00ff00": "Verde",
  "#ff0000": "Rojo",
};

const NAME_ALIASES = {
  negro: "#000000",
  blanco: "#ffffff",
  rojo: "#ff0000",
  verde: "#00ff00",
  azul: "#0000ff",
  fucsia: "#ff1493",
  rosa: "#ff69b4",
  "rosa palo": "#f4a2b7",
  celeste: "#87ceeb",
  dorado: "#d4af37",
  morado: "#800080",
  lila: "#cfa8e0",
  coral: "#ff8c94",
};

const prettyColor = (c) => COLOR_LABELS[String(c || "").toLowerCase()] || c;

const isValidCssColor = (c) => {
  if (!c) return false;
  const s = new Option().style;
  s.color = "";
  s.color = c;
  return s.color !== "";
};

const normalizeToCss = (c) => {
  if (!c) return "";
  if (typeof c === "object") {
    const raw = c?.hex || c?.value || c?.name || "";
    return normalizeToCss(raw);
  }
  const raw = String(c).trim();
  if (isValidCssColor(raw)) return raw;
  const alias = NAME_ALIASES[raw.toLowerCase()];
  return alias && isValidCssColor(alias) ? alias : "";
};

const buildPalette = (arr) => {
  const out = [];
  const seen = new Set();
  for (const c of arr) {
    const n = normalizeToCss(c);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
};

// Extrae colores de productos
const extractColorsFromProducts = (list) => {
  const collected = [];
  for (const p of Array.isArray(list) ? list : []) {
    const arr = Array.isArray(p?.colors) ? p.colors : [];
    for (const c of arr) collected.push(c);
  }
  return buildPalette(collected);
};

// Extrae categorías (cuenta ocurrencias)
const extractCategoriesFromProducts = (list) => {
  const counts = new Map();
  for (const p of Array.isArray(list) ? list : []) {
    const arr =
      Array.isArray(p?.categories) && p.categories.length
        ? p.categories
        : p?.category
          ? [p.category]
          : [];
    for (const raw of arr) {
      const name = String(raw || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      counts.set(key, { name, count: (counts.get(key)?.count || 0) + 1 });
    }
  }

  if (counts.size === 0) {
    for (const s of SUGGESTED_CATEGORIES) {
      counts.set(s.toLowerCase(), { name: s, count: 0 });
    }
  }

  return Array.from(counts.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
};

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function hexToRgba(hex, alpha = 1) {
  const safe = String(hex || "").trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(safe)) {
    return `rgba(255,255,255,${alpha})`;
  }

  let value = safe.slice(1);
  if (value.length === 3) {
    value = value
      .split("")
      .map((x) => x + x)
      .join("");
  }

  const num = Number.parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildSafeUiConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    panelBg:
      typeof cfg.panelBg === "string" && cfg.panelBg.trim()
        ? cfg.panelBg
        : "#ffffff",
    panelBorderColor:
      typeof cfg.panelBorderColor === "string" && cfg.panelBorderColor.trim()
        ? cfg.panelBorderColor
        : "#ead7aa",
    panelTitleColor:
      typeof cfg.panelTitleColor === "string" && cfg.panelTitleColor.trim()
        ? cfg.panelTitleColor
        : "#111827",
    panelSubtitleColor:
      typeof cfg.panelSubtitleColor === "string" && cfg.panelSubtitleColor.trim()
        ? cfg.panelSubtitleColor
        : "#6b7280",
    sectionHeaderBg:
      typeof cfg.sectionHeaderBg === "string" && cfg.sectionHeaderBg.trim()
        ? cfg.sectionHeaderBg
        : "#fff8fb",
    sectionHeaderTextColor:
      typeof cfg.sectionHeaderTextColor === "string" &&
      cfg.sectionHeaderTextColor.trim()
        ? cfg.sectionHeaderTextColor
        : "#1f2937",
    accentColor:
      typeof cfg.accentColor === "string" && cfg.accentColor.trim()
        ? cfg.accentColor
        : "#ec4899",
    accentColor2:
      typeof cfg.accentColor2 === "string" && cfg.accentColor2.trim()
        ? cfg.accentColor2
        : "#d4af37",
    chipBg:
      typeof cfg.chipBg === "string" && cfg.chipBg.trim()
        ? cfg.chipBg
        : "#ffffff",
    chipTextColor:
      typeof cfg.chipTextColor === "string" && cfg.chipTextColor.trim()
        ? cfg.chipTextColor
        : "#374151",
    radiusPx: clampNumber(cfg.radiusPx, 8, 40, 22),
    sectionRadiusPx: clampNumber(cfg.sectionRadiusPx, 6, 32, 18),
    borderWidthPx: clampNumber(cfg.borderWidthPx, 1, 4, 1),
    shadowStyle:
      cfg.shadowStyle === "none" ||
      cfg.shadowStyle === "soft" ||
      cfg.shadowStyle === "medium" ||
      cfg.shadowStyle === "strong"
        ? cfg.shadowStyle
        : "soft",
    sectionGapPx: clampNumber(cfg.sectionGapPx, 8, 40, 20),
    colorDotSizePx: clampNumber(cfg.colorDotSizePx, 16, 40, 26),
    titleSizePx: clampNumber(cfg.titleSizePx, 16, 32, 22),
    sectionTitleSizePx: clampNumber(cfg.sectionTitleSizePx, 13, 24, 17),
    contentTextSizePx: clampNumber(cfg.contentTextSizePx, 11, 20, 14),
    animation:
      cfg.animation === "none" ||
      cfg.animation === "soft" ||
      cfg.animation === "fade" ||
      cfg.animation === "slide"
        ? cfg.animation
        : "soft",
    showSectionIcons: cfg.showSectionIcons !== false,
    showCounters: cfg.showCounters !== false,
    showSelectedSummary: cfg.showSelectedSummary !== false,
    categoriesSearchEnabled: cfg.categoriesSearchEnabled !== false,
    stickyHeader: cfg.stickyHeader === true,
  };
}

function getShadowClass(style) {
  if (style === "none") return "";
  if (style === "medium") return "shadow-md";
  if (style === "strong") return "shadow-xl";
  return "shadow-sm";
}

function getSectionAnimationClass(animation) {
  if (animation === "none") return "";
  if (animation === "fade") return "animate-[fadeIn_220ms_ease]";
  if (animation === "slide") return "animate-[slideIn_220ms_ease]";
  return "transition-all duration-300 ease-out";
}

function FilterSection({
  title,
  icon = null,
  isOpen,
  onToggle,
  children,
  ui,
  badge = null,
  isMobile = false,
}) {
  return (
    <div
      className={`overflow-hidden ${getShadowClass(ui.shadowStyle)}`}
      style={{
        borderRadius: `${isMobile ? Math.max(ui.sectionRadiusPx - 2, 16) : ui.sectionRadiusPx}px`,
        border: `${ui.borderWidthPx}px solid ${hexToRgba(ui.panelBorderColor, 0.95)}`,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        boxShadow:
          ui.shadowStyle === "none"
            ? "none"
            : "0 12px 24px rgba(0,0,0,0.04), 0 2px 10px rgba(236,72,153,0.04)",
      }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 sm:px-4 text-left transition duration-200 hover:brightness-[0.99]"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(
            ui.sectionHeaderBg,
            0.95
          )} 0%, rgba(255,255,255,0.96) 100%)`,
          color: ui.sectionHeaderTextColor,
        }}
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {ui.showSectionIcons && icon ? (
            <span
              className="inline-flex shrink-0 items-center justify-center rounded-full"
              style={{
                width: isMobile ? "38px" : "38px",
                height: isMobile ? "38px" : "38px",
                background: `linear-gradient(135deg, ${hexToRgba(
                  ui.accentColor2,
                  0.18
                )}, ${hexToRgba(ui.accentColor, 0.16)})`,
                color: ui.accentColor,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.8)`,
              }}
            >
              {icon}
            </span>
          ) : null}

          <div className="min-w-0">
            <div
              className="truncate font-semibold tracking-[0.01em]"
              style={{
                fontSize: `${isMobile ? Math.max(ui.sectionTitleSizePx - 1, 14) : ui.sectionTitleSizePx}px`,
              }}
            >
              {title}
            </div>
            {badge ? (
              <div
                className="mt-0.5 text-[11px] sm:text-xs"
                style={{ color: ui.panelSubtitleColor }}
              >
                {badge}
              </div>
            ) : null}
          </div>
        </div>

        <ChevronDown
          className={`h-5 w-5 shrink-0 transform transition duration-300 ${
            isOpen ? "" : "rotate-180"
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`px-3 pb-3 pt-3 sm:px-4 sm:pb-4 ${getSectionAnimationClass(
            ui.animation
          )}`}
          style={{
            fontSize: `${isMobile ? Math.max(ui.contentTextSizePx - 1, 12) : ui.contentTextSizePx}px`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function FilterSidebar({
  selectedCategories = [],
  onCategoryChange = () => {},
  selectedColors = [],
  onColorChange = () => {},
  priceRange = [MIN_PRICE, MAX_PRICE],
  onPriceChange = () => {},
  filterUiConfig = {},
}) {
  const ui = useMemo(() => buildSafeUiConfig(filterUiConfig), [filterUiConfig]);

  const [openCats, setOpenCats] = useState(true);
  const [openColors, setOpenColors] = useState(true);
  const [openPrice, setOpenPrice] = useState(true);

  const [availableColors, setAvailableColors] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const fetchMeta = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/products/meta`, {
        params: { _: Date.now() },
      });
      setAvailableColors(
        Array.isArray(data?.colors) ? data.colors : []
      );
      setAvailableCategories(
        normalizeFilterCategories(data?.categories)
      );
    } catch (error) {
      console.error("Error cargando metadatos del filtro:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  const refreshOnOpen = (setter, current) => {
    const willOpen = !current;
    setter(willOpen);
    if (willOpen) fetchMeta();
  };

  const paletteToUse = buildPalette([
    ...(availableColors || []),
    ...COLORS_FALLBACK,
  ]);

  const toggleCategory = (name) => {
    const val = String(name || "").trim();
    if (!val) return;
    const key = val.toLowerCase();
    const exists = selectedCategories.some((c) => c.toLowerCase() === key);
    const next = exists
      ? selectedCategories.filter((c) => c.toLowerCase() !== key)
      : [...selectedCategories, val];
    onCategoryChange(next);
  };

  const toggleColor = (c) => {
    const normalized = normalizeToCss(c);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    const exists = selectedColors.some((s) => s.toLowerCase() === key);
    const next = exists
      ? selectedColors.filter((x) => x.toLowerCase() !== key)
      : [...selectedColors, normalized];
    onColorChange(next);
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const safeRange = useMemo(() => {
    const base =
      Array.isArray(priceRange) && priceRange.length === 2
        ? priceRange
        : [MIN_PRICE, MAX_PRICE];
    let [a, b] = base.map((v) => clamp(Number(v || 0), MIN_PRICE, MAX_PRICE));
    if (a > b) [a, b] = [b, a];
    return [a, b];
  }, [priceRange]);

  const handleMin = (v) =>
    onPriceChange([
      clamp(Number(v || 0), MIN_PRICE, safeRange[1]),
      safeRange[1],
    ]);

  const handleMax = (v) =>
    onPriceChange([
      safeRange[0],
      clamp(Number(v || 0), safeRange[0], MAX_PRICE),
    ]);

  const filteredCategories = useMemo(() => {
    const query = String(categorySearch || "").trim().toLowerCase();
    if (!query) return availableCategories;
    return availableCategories.filter(({ name }) =>
      String(name || "").toLowerCase().includes(query)
    );
  }, [availableCategories, categorySearch]);

  const TICKS = [0, 1_000_000, 5_000_000, MAX_PRICE];
  const activeCount = selectedCategories.length + selectedColors.length;
  const dotSize = isMobile
    ? Math.max(ui.colorDotSizePx - 2, 20)
    : Math.max(ui.colorDotSizePx, 24);

  return (
    <div
      className={`space-y-4 sm:space-y-5 ${ui.stickyHeader ? "md:sticky md:top-24" : ""}`}
      style={{
        gap: `${isMobile ? Math.max(ui.sectionGapPx - 6, 12) : ui.sectionGapPx}px`,
      }}
    >
      <div
        className={`overflow-hidden ${getShadowClass(ui.shadowStyle)}`}
        style={{
          borderRadius: `${isMobile ? Math.max(ui.radiusPx - 2, 20) : ui.radiusPx}px`,
          border: `${ui.borderWidthPx}px solid ${hexToRgba(ui.panelBorderColor, 0.95)}`,
          background: `linear-gradient(145deg, rgba(255,255,255,0.97) 0%, ${hexToRgba(
            ui.accentColor2,
            0.10
          )} 40%, ${hexToRgba(ui.accentColor, 0.08)} 100%)`,
          boxShadow:
            "0 16px 34px rgba(180,150,60,0.08), 0 6px 18px rgba(236,72,153,0.05)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="px-3 py-4 sm:px-4 sm:py-4">
          <div className="flex items-start gap-3">
            <div
              className="inline-flex shrink-0 items-center justify-center rounded-[18px]"
              style={{
                width: isMobile ? "44px" : "48px",
                height: isMobile ? "44px" : "48px",
                background: `linear-gradient(135deg, ${ui.accentColor2}, ${ui.accentColor})`,
                color: "#fff",
                boxShadow: `0 10px 22px ${hexToRgba(ui.accentColor, 0.18)}`,
              }}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2
                className="font-bold tracking-tight"
                style={{
                  color: ui.panelTitleColor,
                  fontSize: `${isMobile ? Math.max(ui.titleSizePx - 2, 19) : ui.titleSizePx}px`,
                  lineHeight: 1.05,
                }}
              >
                Filtros
              </h2>
              <p
                className="mt-1 leading-5"
                style={{
                  color: ui.panelSubtitleColor,
                  fontSize: `${isMobile ? 12 : Math.max(ui.contentTextSizePx - 1, 11)}px`,
                }}
              >
                Ajusta categorías, colores y precio para descubrir tu estilo.
              </p>
            </div>
          </div>

          {ui.showSelectedSummary && (
            <div className="mt-4 flex flex-wrap gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-medium"
                style={{
                  background: `linear-gradient(135deg, ${hexToRgba(
                    ui.accentColor,
                    0.12
                  )}, ${hexToRgba(ui.accentColor2, 0.14)})`,
                  color: ui.accentColor,
                  border: `1px solid ${hexToRgba(ui.accentColor, 0.12)}`,
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {activeCount > 0
                  ? `${activeCount} filtros activos`
                  : "Sin filtros activos"}
              </span>

              <span
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-medium"
                style={{
                  background: "rgba(255,255,255,0.76)",
                  color: ui.sectionHeaderTextColor,
                  border: `1px solid ${hexToRgba(ui.panelBorderColor, 0.9)}`,
                }}
              >
                ${formatMoney(safeRange[0])} — ${formatMoney(safeRange[1])}
              </span>
            </div>
          )}
        </div>
      </div>

      <FilterSection
        title="Categorías"
        icon={<Search className="h-4 w-4" />}
        isOpen={openCats}
        onToggle={() => refreshOnOpen(setOpenCats, openCats)}
        ui={ui}
        badge={ui.showCounters ? `${availableCategories.length} disponibles` : null}
        isMobile={isMobile}
      >
        {ui.categoriesSearchEnabled && (
          <div className="mb-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: ui.panelSubtitleColor }}
              />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Buscar categoría..."
                className="w-full rounded-[18px] border bg-white/90 py-3 pl-10 pr-3 outline-none transition focus:ring-2"
                style={{
                  borderColor: hexToRgba(ui.panelBorderColor, 0.95),
                  fontSize: `${isMobile ? 13 : ui.contentTextSizePx}px`,
                  boxShadow: `0 6px 18px rgba(0,0,0,0.03)`,
                }}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-[18px] bg-gray-100"
              />
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div
            className="rounded-[18px] border border-dashed px-4 py-5 text-center"
            style={{
              borderColor: ui.panelBorderColor,
              color: ui.panelSubtitleColor,
            }}
          >
            No hay categorías para mostrar.
          </div>
        ) : (
          <ul className="max-h-60 sm:max-h-72 space-y-2 overflow-auto pr-1">
            {filteredCategories.map(({ name, count }) => {
              const checked = selectedCategories.some(
                (c) => c.toLowerCase() === name.toLowerCase()
              );
              const safeId = `cat-${name
                .replace(/\s+/g, "-")
                .replace(/[^a-zA-Z0-9_-]/g, "")
                .toLowerCase()}`;

              return (
                <li key={name}>
                  <label
                    htmlFor={safeId}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-[18px] border px-3 py-2.5 transition duration-200 hover:-translate-y-[1px]"
                    style={{
                      borderColor: checked
                        ? hexToRgba(ui.accentColor, 0.55)
                        : hexToRgba(ui.panelBorderColor, 0.92),
                      background: checked
                        ? `linear-gradient(135deg, ${hexToRgba(
                            ui.accentColor,
                            0.09
                          )} 0%, ${hexToRgba(ui.accentColor2, 0.10)} 100%)`
                        : "rgba(255,255,255,0.9)",
                      color: ui.chipTextColor,
                      boxShadow: checked
                        ? `0 10px 20px ${hexToRgba(ui.accentColor, 0.08)}`
                        : "0 4px 12px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <input
                        id={safeId}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(name)}
                        className="h-4 w-4 shrink-0 accent-pink-500"
                      />
                      <span className="truncate text-[13px] sm:text-[14px]">
                        {name}
                      </span>
                    </div>

                    {ui.showCounters && typeof count === "number" ? (
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                        style={{
                          background: checked
                            ? hexToRgba(ui.accentColor, 0.14)
                            : hexToRgba(ui.accentColor2, 0.14),
                          color: ui.sectionHeaderTextColor,
                        }}
                      >
                        {count}
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </FilterSection>

      <FilterSection
        title="Color"
        icon={<Palette className="h-4 w-4" />}
        isOpen={openColors}
        onToggle={() => refreshOnOpen(setOpenColors, openColors)}
        ui={ui}
        badge={ui.showCounters ? `${paletteToUse.length} tonos disponibles` : null}
        isMobile={isMobile}
      >
        {loading ? (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-full bg-gray-200"
                style={{
                  width: `${dotSize}px`,
                  height: `${dotSize}px`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-6">
            {paletteToUse.map((c, i) => {
              const isSelected = selectedColors.some(
                (s) => s.toLowerCase() === String(c).toLowerCase()
              );

              return (
                <button
                  key={`${c}-${i}`}
                  type="button"
                  title={prettyColor(c)}
                  onClick={() => toggleColor(c)}
                  className={`relative mx-auto rounded-full border transition-all duration-200 ${
                    isSelected
                      ? "scale-110 shadow-md"
                      : "opacity-95 hover:scale-110 hover:shadow-sm"
                  }`}
                  style={{
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                    backgroundColor: c,
                    borderColor: isSelected ? ui.accentColor : "#d1d5db",
                    boxShadow: isSelected
                      ? `0 0 0 5px ${hexToRgba(ui.accentColor, 0.16)}`
                      : c.toLowerCase() === "#ffffff"
                        ? "inset 0 0 0 1px #d1d5db"
                        : "0 6px 14px rgba(0,0,0,0.04)",
                  }}
                  aria-label={prettyColor(c)}
                />
              );
            })}
          </div>
        )}
      </FilterSection>

      <FilterSection
        title="Precio"
        icon={<BadgeDollarSign className="h-4 w-4" />}
        isOpen={openPrice}
        onToggle={() => setOpenPrice(!openPrice)}
        ui={ui}
        badge={`De ${formatMoney(safeRange[0])} a ${formatMoney(safeRange[1])}`}
        isMobile={isMobile}
      >
        <div className="px-0.5 pt-1">
          <div className="relative rounded-[18px] border bg-white/72 px-2 py-1 sm:px-3">
            <Range
              step={STEP_PRICE}
              min={MIN_PRICE}
              max={MAX_PRICE}
              values={safeRange}
              onChange={(vals) => {
                const a = Math.max(MIN_PRICE, Math.min(MAX_PRICE, vals[0]));
                const b = Math.max(MIN_PRICE, Math.min(MAX_PRICE, vals[1]));
                onPriceChange(a <= b ? [a, b] : [b, a]);
              }}
              renderTrack={({ props, children }) => {
                const { key, ...rest } = props;
                const leftPct = (safeRange[0] / MAX_PRICE) * 100;
                const rightPct = 100 - (safeRange[1] / MAX_PRICE) * 100;

                return (
                  <div key={key} {...rest} className="relative h-14 select-none">
                    <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gray-200" />
                    <div
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${leftPct}%`,
                        right: `${rightPct}%`,
                        background: `linear-gradient(90deg, ${ui.accentColor2}, ${ui.accentColor})`,
                        transition: "left 180ms ease, right 180ms ease",
                        boxShadow: `0 4px 14px ${hexToRgba(ui.accentColor, 0.18)}`,
                      }}
                    />
                    <div className="absolute inset-x-0 top-[calc(50%+16px)] text-[10px] text-gray-500">
                      {TICKS.map((t) => {
                        const left = (t / MAX_PRICE) * 100;
                        return (
                          <div
                            key={t}
                            className="absolute -translate-x-1/2"
                            style={{ left: `${left}%` }}
                          >
                            <div className="mx-auto h-2 w-px bg-gray-300" />
                            <div className="mt-1">
                              {t === 0
                                ? "0"
                                : t === MAX_PRICE
                                  ? "10M"
                                  : t === 1_000_000
                                    ? "1M"
                                    : "5M"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {children}
                  </div>
                );
              }}
              renderThumb={({ props, isDragged, index }) => {
                const { key, ...rest } = props;
                const value = safeRange[index];

                return (
                  <div
                    key={key}
                    {...rest}
                    className={`relative rounded-full border-2 bg-white shadow-md transition-transform duration-200 ${
                      isDragged ? "scale-110" : "hover:scale-110"
                    }`}
                    style={{
                      width: isMobile ? "20px" : "22px",
                      height: isMobile ? "20px" : "22px",
                      borderColor: ui.accentColor2,
                      boxShadow: `0 8px 18px ${hexToRgba(ui.accentColor, 0.14)}`,
                    }}
                  >
                    {isDragged && (
                      <span
                        className="absolute inset-0 animate-ping rounded-full"
                        style={{ background: hexToRgba(ui.accentColor, 0.28) }}
                      />
                    )}

                    <div
                      className={`absolute left-1/2 top-[-40px] -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium text-white shadow transition-all duration-150 ${
                        isDragged
                          ? "translate-y-0 opacity-100"
                          : "pointer-events-none -translate-y-1 opacity-0"
                      }`}
                      style={{
                        background: `linear-gradient(90deg, ${ui.accentColor2}, ${ui.accentColor})`,
                      }}
                    >
                      ${formatMoney(value)}
                    </div>
                  </div>
                );
              }}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className="rounded-[18px] border px-3 py-2.5 focus-within:ring-2"
              style={{
                borderColor: hexToRgba(ui.panelBorderColor, 0.95),
                background: "rgba(255,255,255,0.9)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.03)",
              }}
            >
              <div
                className="mb-1 text-[11px] font-medium uppercase tracking-wide"
                style={{ color: ui.panelSubtitleColor }}
              >
                Desde
              </div>
              <div className="flex items-center gap-1">
                <span style={{ color: ui.panelSubtitleColor }}>$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  value={safeRange[0]}
                  onChange={(e) => handleMin(e.target.value)}
                  className="w-full bg-transparent outline-none text-[13px] sm:text-[14px]"
                  style={{ color: ui.chipTextColor }}
                />
              </div>
            </div>

            <div
              className="rounded-[18px] border px-3 py-2.5 focus-within:ring-2"
              style={{
                borderColor: hexToRgba(ui.panelBorderColor, 0.95),
                background: "rgba(255,255,255,0.9)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.03)",
              }}
            >
              <div
                className="mb-1 text-[11px] font-medium uppercase tracking-wide"
                style={{ color: ui.panelSubtitleColor }}
              >
                Hasta
              </div>
              <div className="flex items-center gap-1">
                <span style={{ color: ui.panelSubtitleColor }}>$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  value={safeRange[1]}
                  onChange={(e) => handleMax(e.target.value)}
                  className="w-full bg-transparent outline-none text-[13px] sm:text-[14px]"
                  style={{ color: ui.chipTextColor }}
                />
              </div>
            </div>
          </div>
        </div>
      </FilterSection>
    </div>
  );
}
