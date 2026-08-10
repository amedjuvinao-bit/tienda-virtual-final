// frontend/src/admin/pages/CatalogPageEditor.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const API_BASE = API_BASE_URL;

const EDITOR_TABS = [
  { id: "general", label: "General" },
  { id: "header", label: "Encabezado" },
  { id: "products", label: "Productos" },
  { id: "visual", label: "Visual" },
  { id: "grid", label: "Grilla y filtros" },
  { id: "empty", label: "Estado vacío" },
];

const PRODUCT_SUBTABS = [
  { id: "universe", label: "Universo" },
  { id: "categories", label: "Categorías" },
  { id: "manual", label: "Selección manual" },
];

const VISUAL_SUBTABS = [
  { id: "layout", label: "Estructura" },
  { id: "filter-style", label: "Estilo del filtro" },
  { id: "card-style", label: "Estilo de cards" },
];

const SHADOW_OPTIONS = [
  { value: "none", label: "Sin sombra" },
  { value: "soft", label: "Suave" },
  { value: "medium", label: "Media" },
  { value: "strong", label: "Fuerte" },
];

const FILTER_ANIMATION_OPTIONS = [
  { value: "none", label: "Sin animación" },
  { value: "soft", label: "Suave" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Deslizamiento" },
];

const CARD_IMAGE_FIT_OPTIONS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
];

const FAVORITE_ICON_OPTIONS = [
  { value: "star", label: "Estrella" },
  { value: "heart", label: "Corazón" },
  { value: "sparkles", label: "Destello" },
];

const CART_ICON_OPTIONS = [
  { value: "shopping-cart", label: "Carrito clásico" },
  { value: "shopping-bag", label: "Bolsa" },
  { value: "bag-heart", label: "Bolsa con corazón" },
];

const FONT_FAMILY_OPTIONS = [
  { value: "inherit", label: "Heredada del diseño" },
  { value: "jost", label: "Jost" },
  { value: "cormorant", label: "Cormorant Garamond" },
  { value: "playfair", label: "Playfair Display" },
  { value: "inter", label: "Inter" },
];

const Input = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <input
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    />
  </label>
);

const Textarea = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <textarea
      className="min-h-[110px] w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    />
  </label>
);

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
    <span className="text-sm text-gray-700">{label}</span>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 shrink-0 accent-pink-600"
    />
  </label>
);

const Select = ({ label, children, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <select
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    >
      {children}
    </select>
  </label>
);

const ColorInput = ({ label, value, onChange }) => {
  const safeValue = isHexColor(value) ? value : "#ec4899";

  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>

      <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2.5">
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange({ target: { value: e.target.value } })}
          className="h-10 w-12 cursor-pointer rounded border border-gray-200 bg-white"
        />

        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange({ target: { value: e.target.value } })}
          className="w-full min-w-0 bg-transparent text-sm text-gray-800 outline-none"
          placeholder="#ec4899"
        />
      </div>
    </label>
  );
};

const InfoCard = ({ title, text }) => (
  <div className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 px-4 py-3">
    <div className="text-sm font-semibold text-pink-700">{title}</div>
    <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
  </div>
);

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim());
}

function normalizeCsvText(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function parseCsvArray(value) {
  return normalizeCsvText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeCaseInsensitive(list) {
  const out = [];
  const seen = new Set();

  for (const item of Array.isArray(list) ? list : []) {
    const clean = String(item || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }

  return out;
}

function listToCsv(list) {
  return dedupeCaseInsensitive(list).join(", ");
}

function buildSafeFilterUiConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    panelBg: typeof cfg.panelBg === "string" ? cfg.panelBg : "#ffffff",
    panelBorderColor:
      typeof cfg.panelBorderColor === "string" ? cfg.panelBorderColor : "#ead7aa",
    panelTitleColor:
      typeof cfg.panelTitleColor === "string" ? cfg.panelTitleColor : "#111827",
    panelSubtitleColor:
      typeof cfg.panelSubtitleColor === "string" ? cfg.panelSubtitleColor : "#6b7280",
    sectionHeaderBg:
      typeof cfg.sectionHeaderBg === "string" ? cfg.sectionHeaderBg : "#fff8fb",
    sectionHeaderTextColor:
      typeof cfg.sectionHeaderTextColor === "string"
        ? cfg.sectionHeaderTextColor
        : "#1f2937",
    accentColor:
      typeof cfg.accentColor === "string" ? cfg.accentColor : "#ec4899",
    accentColor2:
      typeof cfg.accentColor2 === "string" ? cfg.accentColor2 : "#d4af37",
    chipBg: typeof cfg.chipBg === "string" ? cfg.chipBg : "#ffffff",
    chipTextColor:
      typeof cfg.chipTextColor === "string" ? cfg.chipTextColor : "#374151",
    radiusPx: clampInt(cfg.radiusPx, 8, 40, 22),
    sectionRadiusPx: clampInt(cfg.sectionRadiusPx, 6, 32, 18),
    borderWidthPx: clampInt(cfg.borderWidthPx, 1, 4, 1),
    shadowStyle:
      cfg.shadowStyle === "none" ||
      cfg.shadowStyle === "soft" ||
      cfg.shadowStyle === "medium" ||
      cfg.shadowStyle === "strong"
        ? cfg.shadowStyle
        : "soft",
    sectionGapPx: clampInt(cfg.sectionGapPx, 8, 40, 20),
    colorDotSizePx: clampInt(cfg.colorDotSizePx, 16, 40, 26),
    titleSizePx: clampInt(cfg.titleSizePx, 16, 32, 22),
    sectionTitleSizePx: clampInt(cfg.sectionTitleSizePx, 13, 24, 17),
    contentTextSizePx: clampInt(cfg.contentTextSizePx, 11, 20, 14),
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

function buildSafeCardUiConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    cardBg: typeof cfg.cardBg === "string" ? cfg.cardBg : "#ffffff",
    cardBorderColor:
      typeof cfg.cardBorderColor === "string" ? cfg.cardBorderColor : "#ecdcb6",
    cardBorderWidthPx: clampInt(cfg.cardBorderWidthPx, 0, 6, 1),
    cardRadiusPx: clampInt(cfg.cardRadiusPx, 8, 40, 28),
    cardPaddingPx: clampInt(cfg.cardPaddingPx, 0, 40, 12),
    cardShadowStyle:
      cfg.cardShadowStyle === "none" ||
      cfg.cardShadowStyle === "soft" ||
      cfg.cardShadowStyle === "medium" ||
      cfg.cardShadowStyle === "strong"
        ? cfg.cardShadowStyle
        : "soft",

    imageBg: typeof cfg.imageBg === "string" ? cfg.imageBg : "#faf8f3",
    imageRadiusPx: clampInt(cfg.imageRadiusPx, 0, 40, 24),
    imageFit:
      cfg.imageFit === "cover" || cfg.imageFit === "contain" ? cfg.imageFit : "cover",

    titleColor: typeof cfg.titleColor === "string" ? cfg.titleColor : "#2f3440",
    priceColor: typeof cfg.priceColor === "string" ? cfg.priceColor : "#e54497",
    oldPriceColor:
      typeof cfg.oldPriceColor === "string" ? cfg.oldPriceColor : "#9ca3af",
    metaColor: typeof cfg.metaColor === "string" ? cfg.metaColor : "#6b7280",

    buttonBg: typeof cfg.buttonBg === "string" ? cfg.buttonBg : "#ffffff",
    favoriteButtonBg:
      typeof cfg.favoriteButtonBg === "string" ? cfg.favoriteButtonBg : "#ffffff",
    cartButtonBg:
      typeof cfg.cartButtonBg === "string" ? cfg.cartButtonBg : "#ffffff",

    favoriteButtonOpacity: clampNumber(cfg.favoriteButtonOpacity, 0, 1, 1),
    cartButtonOpacity: clampNumber(cfg.cartButtonOpacity, 0, 1, 1),

    buttonTextColor:
      typeof cfg.buttonTextColor === "string" ? cfg.buttonTextColor : "#ffffff",
    actionButtonBorderColor:
      typeof cfg.actionButtonBorderColor === "string"
        ? cfg.actionButtonBorderColor
        : "#ffffff",
    actionButtonBorderWidthPx: clampInt(cfg.actionButtonBorderWidthPx, 0, 4, 1),

    cartIconColor:
      typeof cfg.cartIconColor === "string" ? cfg.cartIconColor : "#D4AF37",

    favoriteIconColor:
      typeof cfg.favoriteIconColor === "string" ? cfg.favoriteIconColor : "#d946ef",
    favoriteActiveColor:
      typeof cfg.favoriteActiveColor === "string"
        ? cfg.favoriteActiveColor
        : "#D4AF37",

    favoriteIconName:
      cfg.favoriteIconName === "heart" ||
      cfg.favoriteIconName === "sparkles" ||
      cfg.favoriteIconName === "star"
        ? cfg.favoriteIconName
        : "star",

    cartIconName:
      cfg.cartIconName === "shopping-bag" ||
      cfg.cartIconName === "bag-heart" ||
      cfg.cartIconName === "shopping-cart"
        ? cfg.cartIconName
        : "shopping-cart",

    titleFontFamily:
      cfg.titleFontFamily === "jost" ||
      cfg.titleFontFamily === "cormorant" ||
      cfg.titleFontFamily === "playfair" ||
      cfg.titleFontFamily === "inter" ||
      cfg.titleFontFamily === "inherit"
        ? cfg.titleFontFamily
        : "inherit",

    priceFontFamily:
      cfg.priceFontFamily === "jost" ||
      cfg.priceFontFamily === "cormorant" ||
      cfg.priceFontFamily === "playfair" ||
      cfg.priceFontFamily === "inter" ||
      cfg.priceFontFamily === "inherit"
        ? cfg.priceFontFamily
        : "inherit",

    metaFontFamily:
      cfg.metaFontFamily === "jost" ||
      cfg.metaFontFamily === "cormorant" ||
      cfg.metaFontFamily === "playfair" ||
      cfg.metaFontFamily === "inter" ||
      cfg.metaFontFamily === "inherit"
        ? cfg.metaFontFamily
        : "inherit",

    showBorder: cfg.showBorder !== false,
    showShadow: cfg.showShadow !== false,
    showImageBg: cfg.showImageBg !== false,
  };
}

function buildSafeColumnControlsUiConfig(raw) {
   const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    buttonBgColor:
      typeof cfg.buttonBgColor === "string" ? cfg.buttonBgColor : "#ffffff",
    buttonBorderColor:
      typeof cfg.buttonBorderColor === "string" ? cfg.buttonBorderColor : "#e8e7eb",
    buttonIconColor:
      typeof cfg.buttonIconColor === "string" ? cfg.buttonIconColor : "#D4AF37",

    hoverButtonBgColor:
      typeof cfg.hoverButtonBgColor === "string"
        ? cfg.hoverButtonBgColor
        : "#ffffff",
    hoverButtonBorderColor:
      typeof cfg.hoverButtonBorderColor === "string"
        ? cfg.hoverButtonBorderColor
        : "#D4AF37",
    hoverButtonIconColor:
      typeof cfg.hoverButtonIconColor === "string"
        ? cfg.hoverButtonIconColor
        : "#D4AF37",

    activeButtonBgColor:
      typeof cfg.activeButtonBgColor === "string"
        ? cfg.activeButtonBgColor
        : "#fff5fa",
    activeButtonBorderColor:
      typeof cfg.activeButtonBorderColor === "string"
        ? cfg.activeButtonBorderColor
        : "#ec4899",
    activeButtonIconColor:
      typeof cfg.activeButtonIconColor === "string"
        ? cfg.activeButtonIconColor
        : "#ec4899",

    buttonRadiusPx: clampInt(cfg.buttonRadiusPx, 8, 24, 12),
    buttonBorderWidthPx: clampInt(cfg.buttonBorderWidthPx, 1, 4, 1),
  };
}

function buildSafeCatalogConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};

  return {
    title: typeof cfg.title === "string" ? cfg.title : "",
    subtitle: typeof cfg.subtitle === "string" ? cfg.subtitle : "",
    description: typeof cfg.description === "string" ? cfg.description : "",
    titleMode:
      cfg.titleMode === "image" || cfg.titleMode === "text" ? cfg.titleMode : "text",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt: typeof cfg.titleImageAlt === "string" ? cfg.titleImageAlt : "",
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showFilters: cfg.showFilters !== false,
    showToolbar: cfg.showToolbar !== false,
    showFilterFab: cfg.showFilterFab !== false,
    showResultCount: cfg.showResultCount !== false,
    columnsDesktop: clampInt(cfg.columnsDesktop, 1, 6, 4),
    columnsTablet: clampInt(cfg.columnsTablet, 1, 4, 3),
    columnsMobile: clampInt(cfg.columnsMobile, 1, 2, 2),
    defaultColsDesktop: clampInt(
      cfg.defaultColsDesktop ?? cfg.columnsDesktop,
      1,
      6,
      clampInt(cfg.columnsDesktop, 1, 6, 4)
    ),
    defaultColsMobile: clampInt(
      cfg.defaultColsMobile ?? cfg.columnsMobile,
      1,
      2,
      clampInt(cfg.columnsMobile, 1, 2, 2)
    ),
    limit: clampInt(cfg.limit, 0, 200, 0),

    sourceMode:
      cfg.sourceMode === "categories" || cfg.sourceMode === "manual"
        ? cfg.sourceMode
        : "all",

    allowedCategoriesText:
      typeof cfg.allowedCategoriesText === "string"
        ? normalizeCsvText(cfg.allowedCategoriesText)
        : "",

    manualProductIdsText:
      typeof cfg.manualProductIdsText === "string"
        ? normalizeCsvText(cfg.manualProductIdsText)
        : "",

    onlyActive: cfg.onlyActive !== false,

    initialCategoriesText:
      typeof cfg.initialCategoriesText === "string"
        ? normalizeCsvText(cfg.initialCategoriesText)
        : "",
    initialColorsText:
      typeof cfg.initialColorsText === "string"
        ? normalizeCsvText(cfg.initialColorsText)
        : "",
    initialMinPrice: clampNumber(cfg.initialMinPrice, 0, 10000000, 0),
    initialMaxPrice: clampNumber(cfg.initialMaxPrice, 0, 10000000, 10000000),
    emptyTitle:
      typeof cfg.emptyTitle === "string" && cfg.emptyTitle.trim()
        ? cfg.emptyTitle
        : "No se encontraron productos",
    emptyText:
      typeof cfg.emptyText === "string" && cfg.emptyText.trim()
        ? cfg.emptyText
        : "Intenta cambiar los filtros para ver más resultados.",
    filterUiConfig: buildSafeFilterUiConfig(cfg.filterUiConfig),
    cardUiConfig: buildSafeCardUiConfig(cfg.cardUiConfig),
    columnControlsUiConfig: buildSafeColumnControlsUiConfig(
      cfg.columnControlsUiConfig
    ),
  };
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
        active
          ? "border-pink-500 bg-pink-600 text-white shadow-sm"
          : "border-pink-100 bg-white text-pink-700 hover:border-pink-200 hover:bg-pink-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MiniTabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-xs font-semibold transition",
        active
          ? "border-pink-500 bg-pink-50 text-pink-700"
          : "border-gray-200 bg-white text-gray-600 hover:border-pink-200 hover:text-pink-600",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SectionCard({ title, text, children, className = "" }) {
  return (
    <section
      className={`space-y-4 rounded-3xl border border-gray-200 bg-white p-4 md:p-5 ${className}`}
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {text ? <p className="mt-1 text-sm text-gray-500">{text}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CategoryPicker({
  label,
  helper,
  options = [],
  selected = [],
  onToggle = () => {},
  onClear = () => {},
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {helper ? <p className="mt-1 text-xs text-gray-500">{helper}</p> : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
        {selected.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {selected.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onToggle(item)}
                className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-medium text-pink-700 hover:bg-pink-100"
              >
                {item}
                <span className="text-sm leading-none">×</span>
              </button>
            ))}

            <button
              type="button"
              onClick={onClear}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Limpiar
            </button>
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-3 text-sm text-gray-500">
            No hay categorías seleccionadas todavía.
          </div>
        )}

        <div className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap gap-2">
            {options.length === 0 ? (
              <div className="text-sm text-gray-500">
                No se encontraron categorías en productos.
              </div>
            ) : (
              options.map((option) => {
                const selectedNow = selected.some(
                  (item) => item.toLowerCase() === option.toLowerCase()
                );

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onToggle(option)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      selectedNow
                        ? "border-pink-500 bg-pink-600 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-pink-200 hover:bg-pink-50",
                    ].join(" ")}
                  >
                    {option}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualProductsPicker({
  allProducts = [],
  selectedKeys = [],
  onAdd = () => {},
  onRemove = () => {},
  onSearch = () => {},
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return undefined;
    const timer = window.setTimeout(() => onSearch(cleanQuery), 300);
    return () => window.clearTimeout(timer);
  }, [query, onSearch]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return allProducts.slice(0, 20);

    return allProducts
      .filter((product) => {
        const title = String(product?.title || product?.name || "").toLowerCase();
        const slug = String(product?.slug || "").toLowerCase();
        const id = String(product?._id || "").toLowerCase();
        return title.includes(q) || slug.includes(q) || id.includes(q);
      })
      .slice(0, 20);
  }, [allProducts, query]);

  const selectedProducts = useMemo(() => {
    const lowerSet = new Set(selectedKeys.map((item) => String(item).toLowerCase()));
    return allProducts.filter((product) => {
      const id = String(product?._id || "").toLowerCase();
      const slug = String(product?.slug || "").toLowerCase();
      return lowerSet.has(id) || lowerSet.has(slug);
    });
  }, [allProducts, selectedKeys]);

  return (
    <div className="space-y-4">
      <Input
        label="Buscar productos"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busca por nombre, slug o id"
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-3 text-sm font-semibold text-gray-800">Resultados</div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
                No se encontraron productos.
              </div>
            ) : (
              filtered.map((product) => {
                const productId = String(product?._id || "");
                const selectedNow = selectedKeys.some(
                  (item) => item.toLowerCase() === productId.toLowerCase()
                );

                return (
                  <div
                    key={productId || product?.slug}
                    className="rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <div className="text-sm font-semibold text-gray-800">
                      {product?.title || product?.name || "Producto sin nombre"}
                    </div>
                    <div className="mt-1 break-all text-xs text-gray-500">
                      ID: {productId || "—"}
                    </div>
                    <div className="mt-1 break-all text-xs text-gray-500">
                      Slug: {product?.slug || "—"}
                    </div>

                    <button
                      type="button"
                      onClick={() => onAdd(product)}
                      className={[
                        "mt-3 rounded-xl px-3 py-2 text-xs font-semibold transition",
                        selectedNow
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-pink-600 text-white hover:bg-pink-700",
                      ].join(" ")}
                    >
                      {selectedNow ? "Ya agregado" : "Agregar"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-3 text-sm font-semibold text-gray-800">
            Seleccionados
          </div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {selectedProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
                No hay productos seleccionados.
              </div>
            ) : (
              selectedProducts.map((product) => (
                <div
                  key={String(product?._id || product?.slug)}
                  className="rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="text-sm font-semibold text-gray-800">
                    {product?.title || product?.name || "Producto sin nombre"}
                  </div>
                  <div className="mt-1 break-all text-xs text-gray-500">
                    ID: {product?._id || "—"}
                  </div>
                  <div className="mt-1 break-all text-xs text-gray-500">
                    Slug: {product?.slug || "—"}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(String(product?._id || product?.slug || ""))}
                    className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    Quitar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CatalogPageEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const titleImageInputRef = useRef(null);

  const [page, setPage] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [productsSubtab, setProductsSubtab] = useState("universe");
  const [visualSubtab, setVisualSubtab] = useState("layout");

  const [allProducts, setAllProducts] = useState([]);
  const [availableProductCategories, setAvailableProductCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [titleImageFile, setTitleImageFile] = useState(null);
  const [titleImagePreview, setTitleImagePreview] = useState("");
  const [uploadingTitleImage, setUploadingTitleImage] = useState(false);

  const previewUrl = useMemo(() => {
    const slug = String(form?.slug || page?.slug || "").trim();
    if (!slug) return "";
    return `/pagina/${slug}`;
  }, [form?.slug, page?.slug]);

  const allCategoryOptions = useMemo(() => {
    const collected = [];

    for (const product of allProducts) {
      const cats =
        Array.isArray(product?.categories) && product.categories.length
          ? product.categories
          : product?.category
          ? [product.category]
          : [];

      for (const item of cats) {
        collected.push(item);
      }
    }

    return dedupeCaseInsensitive([
      ...availableProductCategories,
      ...collected,
    ]).sort((a, b) => a.localeCompare(b));
  }, [allProducts, availableProductCategories]);

  const selectedAllowedCategories = useMemo(
    () => parseCsvArray(form?.catalogConfig?.allowedCategoriesText || ""),
    [form?.catalogConfig?.allowedCategoriesText]
  );

  const selectedInitialCategories = useMemo(
    () => parseCsvArray(form?.catalogConfig?.initialCategoriesText || ""),
    [form?.catalogConfig?.initialCategoriesText]
  );

  const selectedManualKeys = useMemo(
    () => parseCsvArray(form?.catalogConfig?.manualProductIdsText || ""),
    [form?.catalogConfig?.manualProductIdsText]
  );

  const fetchPage = async () => {
    try {
      setLoading(true);
      setNotFound(false);

      const res = await fetch(`${API_BASE}/api/pages/${id}`);

      if (res.status === 404) {
        setPage(null);
        setForm(null);
        setNotFound(true);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const safeCatalogConfig = buildSafeCatalogConfig(data?.catalogConfig);

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "",
        slug: typeof data?.slug === "string" ? data.slug : "",
        pageType: "catalog",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        catalogConfig: safeCatalogConfig,
      });
      setTitleImagePreview(String(safeCatalogConfig?.titleImage || ""));
      setTitleImageFile(null);
    } catch (error) {
      console.error("Error cargando página catálogo:", error);
      setPage(null);
      setForm(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = useCallback(async (query = '', productKeys = []) => {
    try {
      setLoadingProducts(true);
      const params = new URLSearchParams({
        page: '1',
        limit: query ? '20' : '40',
        sort: 'title',
      });
      if (query) params.set('q', query);
      productKeys.forEach((value) => params.append('productKeys', value));
      const [productsResponse, metaResponse] = await Promise.all([
        fetch(`${API_BASE}/api/products?${params.toString()}`),
        query || productKeys.length
          ? Promise.resolve(null)
          : fetch(`${API_BASE}/api/products/meta`),
      ]);
      if (!productsResponse.ok) throw new Error(`HTTP ${productsResponse.status}`);
      const data = await productsResponse.json();
      const incoming = Array.isArray(data?.products) ? data.products : [];
      setAllProducts((current) => {
        const byId = new Map(
          [...current, ...incoming].map((product) => [
            String(product?._id || product?.slug || ''),
            product,
          ])
        );
        byId.delete('');
        return [...byId.values()];
      });
      if (metaResponse?.ok) {
        const meta = await metaResponse.json();
        setAvailableProductCategories(
          Array.isArray(meta?.categories) ? meta.categories : []
        );
      }
    } catch (error) {
      console.error("Error cargando productos del editor catálogo:", error);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchPage();
    }
  }, [id]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (selectedManualKeys.length) {
      fetchProducts('', selectedManualKeys);
    }
  }, [fetchProducts, selectedManualKeys]);

  const updateRoot = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateCatalogConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      catalogConfig: {
        ...(prev?.catalogConfig || {}),
        ...patch,
      },
    }));
  };

  const updateFilterUiConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      catalogConfig: {
        ...(prev?.catalogConfig || {}),
        filterUiConfig: {
          ...buildSafeFilterUiConfig(prev?.catalogConfig?.filterUiConfig),
          ...patch,
        },
      },
    }));
  };

  const updateCardUiConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      catalogConfig: {
        ...(prev?.catalogConfig || {}),
        cardUiConfig: {
          ...buildSafeCardUiConfig(prev?.catalogConfig?.cardUiConfig),
          ...patch,
        },
      },
    }));
  };

  const updateColumnControlsUiConfig = (patch) => {
    setForm((prev) => ({
      ...prev,
      catalogConfig: {
        ...(prev?.catalogConfig || {}),
        columnControlsUiConfig: {
          ...buildSafeColumnControlsUiConfig(
            prev?.catalogConfig?.columnControlsUiConfig
          ),
          ...patch,
        },
      },
    }));
  };

  const handleNameChange = (value) => {
    setForm((prev) => {
      const currentSlug = String(prev?.slug || "").trim();
      const autoSlug = slugify(value);

      return {
        ...prev,
        name: value,
        slug: currentSlug ? currentSlug : autoSlug,
      };
    });
  };

  const toggleCsvCategoryField = (fieldName, category) => {
    const current = parseCsvArray(form?.catalogConfig?.[fieldName] || "");
    const exists = current.some(
      (item) => item.toLowerCase() === String(category || "").toLowerCase()
    );
    const next = exists
      ? current.filter(
          (item) => item.toLowerCase() !== String(category || "").toLowerCase()
        )
      : [...current, category];

    updateCatalogConfig({
      [fieldName]: listToCsv(next),
    });
  };

  const clearCsvCategoryField = (fieldName) => {
    updateCatalogConfig({ [fieldName]: "" });
  };

  const addManualProduct = (product) => {
    const productId = String(product?._id || "").trim();
    if (!productId) return;

    const current = parseCsvArray(form?.catalogConfig?.manualProductIdsText || "");
    const exists = current.some(
      (item) => item.toLowerCase() === productId.toLowerCase()
    );
    if (exists) return;

    updateCatalogConfig({
      manualProductIdsText: listToCsv([...current, productId]),
    });
  };

  const removeManualProduct = (keyToRemove) => {
    const current = parseCsvArray(form?.catalogConfig?.manualProductIdsText || "");
    const lowerKey = String(keyToRemove || "").toLowerCase();

    const next = current.filter((item) => {
      const safeItem = String(item || "").toLowerCase();
      if (safeItem === lowerKey) return false;

      const product = allProducts.find((p) => {
        const idMatch = String(p?._id || "").toLowerCase() === safeItem;
        const slugMatch = String(p?.slug || "").toLowerCase() === safeItem;
        return idMatch || slugMatch;
      });

      if (!product) return true;

      const productId = String(product?._id || "").toLowerCase();
      const productSlug = String(product?.slug || "").toLowerCase();

      return !(productId === lowerKey || productSlug === lowerKey);
    });

    updateCatalogConfig({
      manualProductIdsText: listToCsv(next),
    });
  };

  const handlePickTitleImage = () => {
    titleImageInputRef.current?.click();
  };

  const handleTitleImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTitleImageFile(file);

    const localUrl = URL.createObjectURL(file);
    setTitleImagePreview(localUrl);
  };

  const handleUploadTitleImage = async () => {
    if (!titleImageFile) {
      alert("Primero selecciona una imagen.");
      return;
    }

    try {
      setUploadingTitleImage(true);

      const body = new FormData();
      body.append("file", titleImageFile);

      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen.");
      }

      updateCatalogConfig({ titleImage: data.url, titleMode: "image" });
      setTitleImagePreview(data.url);
      setTitleImageFile(null);

      if (titleImageInputRef.current) {
        titleImageInputRef.current.value = "";
      }

      alert("Imagen subida correctamente ✅");
    } catch (error) {
      console.error("Error subiendo imagen de título:", error);
      alert(error.message || "No se pudo subir la imagen a Cloudinary.");
    } finally {
      setUploadingTitleImage(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;

    const name = String(form.name || "").trim();
    const slug = slugify(form.slug || form.name);

    if (!name) {
      alert("El nombre de la página es obligatorio.");
      return;
    }

    if (!slug) {
      alert("El slug de la página es obligatorio.");
      return;
    }

    try {
      setSaving(true);

      const safeCatalogConfig = buildSafeCatalogConfig(form.catalogConfig);

      if (safeCatalogConfig.initialMinPrice > safeCatalogConfig.initialMaxPrice) {
        alert("El precio mínimo inicial no puede ser mayor que el precio máximo inicial.");
        return;
      }

      const payload = {
        name,
        slug,
        pageType: "catalog",
        enabled: form.enabled !== false,
        useHeader: form.useHeader !== false,
        useFooter: form.useFooter !== false,
        blocks: Array.isArray(page?.blocks) ? page.blocks : [],
        catalogConfig: safeCatalogConfig,
      };

      const res = await fetch(`${API_BASE}/api/pages/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      setPage(data);
      setForm({
        name: typeof data?.name === "string" ? data.name : "",
        slug: typeof data?.slug === "string" ? data.slug : "",
        pageType: "catalog",
        enabled: data?.enabled !== false,
        useHeader: data?.useHeader !== false,
        useFooter: data?.useFooter !== false,
        catalogConfig: buildSafeCatalogConfig(data?.catalogConfig),
      });

      alert("Página catálogo guardada correctamente ✅");
    } catch (error) {
      console.error("Error guardando página catálogo:", error);
      alert(error.message || "No se pudo guardar la página catálogo.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPreview = () => {
    if (!previewUrl) {
      alert("La página todavía no tiene un slug válido para vista previa.");
      return;
    }

    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando página catálogo...</div>;
  }

  if (notFound || !page || !form) {
    return <div className="p-6 text-red-500">Página catálogo no encontrada</div>;
  }

  if (String(page?.pageType || "custom").toLowerCase() !== "catalog") {
    return (
      <div className="space-y-4 p-6">
        <div className="text-red-500">Esta página no es de tipo catálogo.</div>

        <button
          type="button"
          onClick={() => navigate("/admin/paginas")}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
        >
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate("/admin/paginas")}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
          >
            ← Volver
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Editor de página catálogo
            </h1>
            <p className="text-sm text-gray-500">
              Configura una página tipo catálogo, separada del editor por bloques.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="inline-flex items-center gap-2 rounded-xl border border-pink-300 bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-100"
          >
            Vista previa
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <InfoCard
        title="Control del catálogo"
        text="Aquí el usuario ya puede controlar estructura, filtros, columnas, comportamiento inicial, contenido vacío, universo base, imagen de título, estilo visual del filtro y ahora también la base editable del estilo de las cards del catálogo."
      />

      <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-white to-pink-50/60 p-3 md:p-4">
        <div className="flex flex-wrap gap-2">
          {EDITOR_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
      </div>

      {activeTab === "general" && (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <SectionCard
            title="Configuración general"
            text="Datos principales de la página catálogo."
            className="bg-gray-50"
          >
            <Input
              label="Nombre de la página"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Lo Nuevo"
            />

            <Input
              label="Slug / ruta"
              value={form.slug}
              onChange={(e) => updateRoot({ slug: slugify(e.target.value) })}
              placeholder="Ej: lo-nuevo"
            />

            <Toggle
              label="Página activa"
              checked={form.enabled}
              onChange={(value) => updateRoot({ enabled: value })}
            />

            <Toggle
              label="Usar header"
              checked={form.useHeader}
              onChange={(value) => updateRoot({ useHeader: value })}
            />

            <Toggle
              label="Usar footer"
              checked={form.useFooter}
              onChange={(value) => updateRoot({ useFooter: value })}
            />
          </SectionCard>

          <SectionCard
            title="Resumen rápido"
            text="Datos clave del catálogo para validar antes de guardar."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Ruta pública
                </div>
                <div className="mt-2 break-all text-sm text-gray-800">
                  {previewUrl || "Todavía no disponible"}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tipo de página
                </div>
                <div className="mt-2 text-sm text-gray-800">Catálogo</div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Estado
                </div>
                <div className="mt-2 text-sm text-gray-800">
                  {form.enabled ? "Activa" : "Inactiva"}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Header / Footer
                </div>
                <div className="mt-2 text-sm text-gray-800">
                  {form.useHeader ? "Header activo" : "Sin header"} ·{" "}
                  {form.useFooter ? "Footer activo" : "Sin footer"}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "header" && (
        <SectionCard
          title="Encabezado del catálogo"
          text="Título, subtítulo, descripción e imagen de título."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle
              label="Usar título en texto"
              checked={form.catalogConfig.titleMode === "text"}
              onChange={(value) =>
                updateCatalogConfig({ titleMode: value ? "text" : "image" })
              }
            />

            <Toggle
              label="Usar imagen de título"
              checked={form.catalogConfig.titleMode === "image"}
              onChange={(value) =>
                updateCatalogConfig({ titleMode: value ? "image" : "text" })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Título del catálogo"
              value={form.catalogConfig.title}
              onChange={(e) => updateCatalogConfig({ title: e.target.value })}
              placeholder="Ej: Lo Nuevo"
            />

            <Input
              label="Subtítulo"
              value={form.catalogConfig.subtitle}
              onChange={(e) => updateCatalogConfig({ subtitle: e.target.value })}
              placeholder="Ej: Descubre nuestras novedades"
            />
          </div>

          <Textarea
            label="Descripción"
            value={form.catalogConfig.description}
            onChange={(e) => updateCatalogConfig({ description: e.target.value })}
            placeholder="Texto descriptivo del catálogo"
          />

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <Input
                label="URL de imagen de título"
                value={form.catalogConfig.titleImage}
                onChange={(e) => updateCatalogConfig({ titleImage: e.target.value })}
                placeholder="https://... o /ruta/imagen.png"
              />

              <Input
                label="Alt de la imagen de título"
                value={form.catalogConfig.titleImageAlt}
                onChange={(e) =>
                  updateCatalogConfig({ titleImageAlt: e.target.value })
                }
                placeholder="Texto alternativo"
              />

              <input
                ref={titleImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleTitleImageSelected}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePickTitleImage}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  Escoger imagen
                </button>

                <button
                  type="button"
                  onClick={handleUploadTitleImage}
                  disabled={uploadingTitleImage || !titleImageFile}
                  className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-700 disabled:opacity-50"
                >
                  {uploadingTitleImage ? "Subiendo..." : "Subir a Cloudinary"}
                </button>
              </div>

              {titleImageFile ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Archivo listo para subir: <strong>{titleImageFile.name}</strong>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-gray-800">
                Vista previa de imagen
              </div>

              <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                {titleImagePreview || form.catalogConfig.titleImage ? (
                  <img
                    src={titleImagePreview || form.catalogConfig.titleImage}
                    alt={form.catalogConfig.titleImageAlt || "Vista previa"}
                    className="max-h-[220px] max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-sm text-gray-500">
                    Aún no hay imagen seleccionada.
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              {PRODUCT_SUBTABS.map((tab) => (
                <MiniTabButton
                  key={tab.id}
                  active={productsSubtab === tab.id}
                  onClick={() => setProductsSubtab(tab.id)}
                >
                  {tab.label}
                </MiniTabButton>
              ))}
            </div>
          </div>

          {productsSubtab === "universe" && (
            <SectionCard
              title="Universo base del catálogo"
              text="Define qué conjunto de productos puede mostrar esta página antes de aplicar filtros del cliente."
            >
              <Select
                label="Origen de productos"
                value={form.catalogConfig.sourceMode}
                onChange={(e) =>
                  updateCatalogConfig({ sourceMode: e.target.value })
                }
              >
                <option value="all">Todos los productos</option>
                <option value="categories">Solo categorías permitidas</option>
                <option value="manual">Selección manual</option>
              </Select>

              <Toggle
                label="Mostrar solo productos activos"
                checked={form.catalogConfig.onlyActive}
                onChange={(value) => updateCatalogConfig({ onlyActive: value })}
              />
            </SectionCard>
          )}

          {productsSubtab === "categories" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <SectionCard
                title="Categorías permitidas"
                text="El usuario selecciona las categorías reales ya existentes en productos."
              >
                {loadingProducts ? (
                  <div className="text-sm text-gray-500">Cargando categorías...</div>
                ) : (
                  <>
                    <CategoryPicker
                      label="Selecciona categorías permitidas"
                      helper="Esto reemplaza el texto manual. Sigue guardando en allowedCategoriesText sin romper tu estructura."
                      options={allCategoryOptions}
                      selected={selectedAllowedCategories}
                      onToggle={(category) =>
                        toggleCsvCategoryField("allowedCategoriesText", category)
                      }
                      onClear={() => clearCsvCategoryField("allowedCategoriesText")}
                    />

                    <Textarea
                      label="Valor guardado (avanzado)"
                      value={form.catalogConfig.allowedCategoriesText}
                      onChange={(e) =>
                        updateCatalogConfig({
                          allowedCategoriesText: normalizeCsvText(e.target.value),
                        })
                      }
                      placeholder="Ej: Bautizos, Zapatos, Accesorios"
                    />
                  </>
                )}
              </SectionCard>

              <SectionCard
                title="Categorías iniciales"
                text="Con qué categorías debe abrir el catálogo cuando entre el usuario."
              >
                {loadingProducts ? (
                  <div className="text-sm text-gray-500">Cargando categorías...</div>
                ) : (
                  <>
                    <CategoryPicker
                      label="Selecciona categorías iniciales"
                      helper="También sigue guardando el CSV original en initialCategoriesText."
                      options={allCategoryOptions}
                      selected={selectedInitialCategories}
                      onToggle={(category) =>
                        toggleCsvCategoryField("initialCategoriesText", category)
                      }
                      onClear={() => clearCsvCategoryField("initialCategoriesText")}
                    />

                    <Textarea
                      label="Valor guardado (avanzado)"
                      value={form.catalogConfig.initialCategoriesText}
                      onChange={(e) =>
                        updateCatalogConfig({
                          initialCategoriesText: normalizeCsvText(e.target.value),
                        })
                      }
                      placeholder="Ej: Vestidos cortos, Jeans, Accesorios"
                    />
                  </>
                )}
              </SectionCard>
            </div>
          )}

          {productsSubtab === "manual" && (
            <SectionCard
              title="Selección manual de productos"
              text="Busca productos y agrégalos visualmente. Se sigue guardando manualProductIdsText."
            >
              {loadingProducts ? (
                <div className="text-sm text-gray-500">Cargando productos...</div>
              ) : (
                <>
                  <ManualProductsPicker
                    allProducts={allProducts}
                    selectedKeys={selectedManualKeys}
                    onAdd={addManualProduct}
                    onRemove={removeManualProduct}
                    onSearch={fetchProducts}
                  />

                  <Textarea
                    label="IDs o slugs manuales (avanzado)"
                    value={form.catalogConfig.manualProductIdsText}
                    onChange={(e) =>
                      updateCatalogConfig({
                        manualProductIdsText: normalizeCsvText(e.target.value),
                      })
                    }
                    placeholder="Ej: 67a1bc..., vestido-luna-dorada, 67f9de..."
                  />
                </>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {activeTab === "visual" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              {VISUAL_SUBTABS.map((tab) => (
                <MiniTabButton
                  key={tab.id}
                  active={visualSubtab === tab.id}
                  onClick={() => setVisualSubtab(tab.id)}
                >
                  {tab.label}
                </MiniTabButton>
              ))}
            </div>
          </div>

          {visualSubtab === "layout" && (
            <SectionCard
              title="Estructura visual"
              text="Activa u oculta partes del catálogo."
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Toggle
                  label="Mostrar breadcrumb"
                  checked={form.catalogConfig.showBreadcrumb}
                  onChange={(value) =>
                    updateCatalogConfig({ showBreadcrumb: value })
                  }
                />

                <Toggle
                  label="Mostrar filtros"
                  checked={form.catalogConfig.showFilters}
                  onChange={(value) => updateCatalogConfig({ showFilters: value })}
                />

                <Toggle
                  label="Mostrar toolbar"
                  checked={form.catalogConfig.showToolbar}
                  onChange={(value) => updateCatalogConfig({ showToolbar: value })}
                />

                <Toggle
                  label="Mostrar botón flotante de filtros"
                  checked={form.catalogConfig.showFilterFab}
                  onChange={(value) =>
                    updateCatalogConfig({ showFilterFab: value })
                  }
                />

                <Toggle
                  label="Mostrar contador de resultados"
                  checked={form.catalogConfig.showResultCount}
                  onChange={(value) =>
                    updateCatalogConfig({ showResultCount: value })
                  }
                />
              </div>
            </SectionCard>
          )}

          {visualSubtab === "filter-style" && (
            <SectionCard
              title="Estilo profesional del filtro"
              text="Todo lo que ves en el filtro lateral ahora queda manipulable por el usuario desde el panel."
            >
              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-800">
                    Colores principales
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ColorInput
                      label="Fondo del panel"
                      value={form.catalogConfig.filterUiConfig.panelBg}
                      onChange={(e) =>
                        updateFilterUiConfig({ panelBg: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color de borde del panel"
                      value={form.catalogConfig.filterUiConfig.panelBorderColor}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          panelBorderColor: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Color título principal"
                      value={form.catalogConfig.filterUiConfig.panelTitleColor}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          panelTitleColor: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Color subtítulo principal"
                      value={form.catalogConfig.filterUiConfig.panelSubtitleColor}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          panelSubtitleColor: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Fondo cabecera secciones"
                      value={form.catalogConfig.filterUiConfig.sectionHeaderBg}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          sectionHeaderBg: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Texto cabecera secciones"
                      value={form.catalogConfig.filterUiConfig.sectionHeaderTextColor}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          sectionHeaderTextColor: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Color acento 1"
                      value={form.catalogConfig.filterUiConfig.accentColor}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          accentColor: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Color acento 2"
                      value={form.catalogConfig.filterUiConfig.accentColor2}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          accentColor2: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Fondo chips / items"
                      value={form.catalogConfig.filterUiConfig.chipBg}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          chipBg: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Texto chips / items"
                      value={form.catalogConfig.filterUiConfig.chipTextColor}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          chipTextColor: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-800">
                    Tamaños, bordes y comportamiento
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Radio panel (px)"
                      type="number"
                      min="8"
                      max="40"
                      value={form.catalogConfig.filterUiConfig.radiusPx}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          radiusPx: clampInt(e.target.value, 8, 40, 22),
                        })
                      }
                    />

                    <Input
                      label="Radio secciones (px)"
                      type="number"
                      min="6"
                      max="32"
                      value={form.catalogConfig.filterUiConfig.sectionRadiusPx}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          sectionRadiusPx: clampInt(e.target.value, 6, 32, 18),
                        })
                      }
                    />

                    <Input
                      label="Ancho borde (px)"
                      type="number"
                      min="1"
                      max="4"
                      value={form.catalogConfig.filterUiConfig.borderWidthPx}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          borderWidthPx: clampInt(e.target.value, 1, 4, 1),
                        })
                      }
                    />

                    <Input
                      label="Separación entre bloques (px)"
                      type="number"
                      min="8"
                      max="40"
                      value={form.catalogConfig.filterUiConfig.sectionGapPx}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          sectionGapPx: clampInt(e.target.value, 8, 40, 20),
                        })
                      }
                    />

                    <Input
                      label="Tamaño bolitas color (px)"
                      type="number"
                      min="16"
                      max="40"
                      value={form.catalogConfig.filterUiConfig.colorDotSizePx}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          colorDotSizePx: clampInt(e.target.value, 16, 40, 26),
                        })
                      }
                    />

                    <Input
                      label="Tamaño título panel (px)"
                      type="number"
                      min="16"
                      max="32"
                      value={form.catalogConfig.filterUiConfig.titleSizePx}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          titleSizePx: clampInt(e.target.value, 16, 32, 22),
                        })
                      }
                    />

                    <Input
                      label="Tamaño título secciones (px)"
                      type="number"
                      min="13"
                      max="24"
                      value={form.catalogConfig.filterUiConfig.sectionTitleSizePx}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          sectionTitleSizePx: clampInt(e.target.value, 13, 24, 17),
                        })
                      }
                    />

                    <Input
                      label="Tamaño texto contenido (px)"
                      type="number"
                      min="11"
                      max="20"
                      value={form.catalogConfig.filterUiConfig.contentTextSizePx}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          contentTextSizePx: clampInt(e.target.value, 11, 20, 14),
                        })
                      }
                    />

                    <Select
                      label="Tipo de sombra"
                      value={form.catalogConfig.filterUiConfig.shadowStyle}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          shadowStyle: e.target.value,
                        })
                      }
                    >
                      {SHADOW_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Animación"
                      value={form.catalogConfig.filterUiConfig.animation}
                      onChange={(e) =>
                        updateFilterUiConfig({
                          animation: e.target.value,
                        })
                      }
                    >
                      {FILTER_ANIMATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Toggle
                      label="Mostrar íconos en secciones"
                      checked={form.catalogConfig.filterUiConfig.showSectionIcons}
                      onChange={(value) =>
                        updateFilterUiConfig({ showSectionIcons: value })
                      }
                    />

                    <Toggle
                      label="Mostrar contadores"
                      checked={form.catalogConfig.filterUiConfig.showCounters}
                      onChange={(value) =>
                        updateFilterUiConfig({ showCounters: value })
                      }
                    />

                    <Toggle
                      label="Mostrar resumen de filtros activos"
                      checked={form.catalogConfig.filterUiConfig.showSelectedSummary}
                      onChange={(value) =>
                        updateFilterUiConfig({ showSelectedSummary: value })
                      }
                    />

                    <Toggle
                      label="Buscador de categorías"
                      checked={
                        form.catalogConfig.filterUiConfig.categoriesSearchEnabled
                      }
                      onChange={(value) =>
                        updateFilterUiConfig({
                          categoriesSearchEnabled: value,
                        })
                      }
                    />

                    <Toggle
                      label="Cabecera sticky en desktop"
                      checked={form.catalogConfig.filterUiConfig.stickyHeader}
                      onChange={(value) =>
                        updateFilterUiConfig({ stickyHeader: value })
                      }
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {visualSubtab === "card-style" && (
            <SectionCard
              title="Estilo editable de cards"
              text="Aquí dejamos solo controles seguros para personalizar botones, íconos, tipografías y bordes sin perder la estructura base bonita de la card."
            >
              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-800">
                    Colores y tipografía
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ColorInput
                      label="Fondo de card"
                      value={form.catalogConfig.cardUiConfig.cardBg}
                      onChange={(e) =>
                        updateCardUiConfig({ cardBg: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color de borde"
                      value={form.catalogConfig.cardUiConfig.cardBorderColor}
                      onChange={(e) =>
                        updateCardUiConfig({
                          cardBorderColor: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Fondo del contenedor de imagen"
                      value={form.catalogConfig.cardUiConfig.imageBg}
                      onChange={(e) =>
                        updateCardUiConfig({ imageBg: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color del título"
                      value={form.catalogConfig.cardUiConfig.titleColor}
                      onChange={(e) =>
                        updateCardUiConfig({ titleColor: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color del precio"
                      value={form.catalogConfig.cardUiConfig.priceColor}
                      onChange={(e) =>
                        updateCardUiConfig({ priceColor: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color del precio anterior"
                      value={form.catalogConfig.cardUiConfig.oldPriceColor}
                      onChange={(e) =>
                        updateCardUiConfig({ oldPriceColor: e.target.value })
                      }
                    />

                    <ColorInput
                      label="Color de metadatos"
                      value={form.catalogConfig.cardUiConfig.metaColor}
                      onChange={(e) =>
                        updateCardUiConfig({ metaColor: e.target.value })
                      }
                    />

                    <Select
                      label="Fuente del título"
                      value={form.catalogConfig.cardUiConfig.titleFontFamily}
                      onChange={(e) =>
                        updateCardUiConfig({ titleFontFamily: e.target.value })
                      }
                    >
                      {FONT_FAMILY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Fuente del precio"
                      value={form.catalogConfig.cardUiConfig.priceFontFamily}
                      onChange={(e) =>
                        updateCardUiConfig({ priceFontFamily: e.target.value })
                      }
                    >
                      {FONT_FAMILY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Fuente de metadatos"
                      value={form.catalogConfig.cardUiConfig.metaFontFamily}
                      onChange={(e) =>
                        updateCardUiConfig({ metaFontFamily: e.target.value })
                      }
                    >
                      {FONT_FAMILY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-800">
                    Botones, íconos y bordes
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ColorInput
                      label="Fondo botón favorito"
                      value={form.catalogConfig.cardUiConfig.favoriteButtonBg}
                      onChange={(e) =>
                        updateCardUiConfig({
                          favoriteButtonBg: e.target.value,
                        })
                      }
                    />
                    <Input
                      label="Transparencia botón favorito"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={form.catalogConfig.cardUiConfig.favoriteButtonOpacity ?? 1}
                      onChange={(e) =>
                        updateCardUiConfig({
                          favoriteButtonOpacity: clampNumber(e.target.value, 0, 1, 1),
                        })
                      }
                    />
                    <Input
                      label="Transparencia botón carrito"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={form.catalogConfig.cardUiConfig.cartButtonOpacity ?? 1}
                      onChange={(e) =>
                        updateCardUiConfig({
                          cartButtonOpacity: clampNumber(e.target.value, 0, 1, 1),
                        })
                      }
                    />

                    <ColorInput
                      label="Fondo botón carrito"
                      value={form.catalogConfig.cardUiConfig.cartButtonBg}
                      onChange={(e) =>
                        updateCardUiConfig({
                          cartButtonBg: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Borde botones"
                      value={form.catalogConfig.cardUiConfig.actionButtonBorderColor}
                      onChange={(e) =>
                        updateCardUiConfig({
                          actionButtonBorderColor: e.target.value,
                        })
                      }
                    />

                    <Input
                      label="Grosor borde botones (px)"
                      type="number"
                      min="0"
                      max="4"
                      value={
                        form.catalogConfig.cardUiConfig.actionButtonBorderWidthPx
                      }
                      onChange={(e) =>
                        updateCardUiConfig({
                          actionButtonBorderWidthPx: clampInt(
                            e.target.value,
                            0,
                            4,
                            1
                          ),
                        })
                      }
                    />

                    <ColorInput
                      label="Ícono carrito"
                      value={form.catalogConfig.cardUiConfig.cartIconColor}
                      onChange={(e) =>
                        updateCardUiConfig({
                          cartIconColor: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Favorito normal"
                      value={form.catalogConfig.cardUiConfig.favoriteIconColor}
                      onChange={(e) =>
                        updateCardUiConfig({
                          favoriteIconColor: e.target.value,
                        })
                      }
                    />

                    <ColorInput
                      label="Favorito activo"
                      value={form.catalogConfig.cardUiConfig.favoriteActiveColor}
                      onChange={(e) =>
                        updateCardUiConfig({
                          favoriteActiveColor: e.target.value,
                        })
                      }
                    />

                    <Select
                      label="Ícono de favorito"
                      value={form.catalogConfig.cardUiConfig.favoriteIconName}
                      onChange={(e) =>
                        updateCardUiConfig({
                          favoriteIconName: e.target.value,
                        })
                      }
                    >
                      {FAVORITE_ICON_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Ícono de carrito"
                      value={form.catalogConfig.cardUiConfig.cartIconName}
                      onChange={(e) =>
                        updateCardUiConfig({
                          cartIconName: e.target.value,
                        })
                      }
                    >
                      {CART_ICON_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Input
                      label="Ancho borde card (px)"
                      type="number"
                      min="0"
                      max="6"
                      value={form.catalogConfig.cardUiConfig.cardBorderWidthPx}
                      onChange={(e) =>
                        updateCardUiConfig({
                          cardBorderWidthPx: clampInt(e.target.value, 0, 6, 1),
                        })
                      }
                    />

                    <Input
                      label="Radio card (px)"
                      type="number"
                      min="8"
                      max="40"
                      value={form.catalogConfig.cardUiConfig.cardRadiusPx}
                      onChange={(e) =>
                        updateCardUiConfig({
                          cardRadiusPx: clampInt(e.target.value, 8, 40, 28),
                        })
                      }
                    />

                    <Input
                      label="Radio imagen (px)"
                      type="number"
                      min="0"
                      max="40"
                      value={form.catalogConfig.cardUiConfig.imageRadiusPx}
                      onChange={(e) =>
                        updateCardUiConfig({
                          imageRadiusPx: clampInt(e.target.value, 0, 40, 24),
                        })
                      }
                    />

                    <Select
                      label="Sombra de card"
                      value={form.catalogConfig.cardUiConfig.cardShadowStyle}
                      onChange={(e) =>
                        updateCardUiConfig({
                          cardShadowStyle: e.target.value,
                        })
                      }
                    >
                      {SHADOW_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Ajuste de imagen"
                      value={form.catalogConfig.cardUiConfig.imageFit}
                      onChange={(e) =>
                        updateCardUiConfig({
                          imageFit: e.target.value,
                        })
                      }
                    >
                      {CARD_IMAGE_FIT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Toggle
                      label="Mostrar borde"
                      checked={form.catalogConfig.cardUiConfig.showBorder}
                      onChange={(value) =>
                        updateCardUiConfig({ showBorder: value })
                      }
                    />

                    <Toggle
                      label="Mostrar sombra"
                      checked={form.catalogConfig.cardUiConfig.showShadow}
                      onChange={(value) =>
                        updateCardUiConfig({ showShadow: value })
                      }
                    />

                    <Toggle
                      label="Usar fondo en imagen"
                      checked={form.catalogConfig.cardUiConfig.showImageBg}
                      onChange={(value) =>
                        updateCardUiConfig({ showImageBg: value })
                      }
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {activeTab === "grid" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard
            title="Grilla del catálogo"
            text="Control de columnas y límite inicial."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Máximo columnas desktop"
                type="number"
                min="1"
                max="6"
                value={form.catalogConfig.columnsDesktop}
                onChange={(e) =>
                  updateCatalogConfig({
                    columnsDesktop: clampInt(e.target.value, 1, 6, 4),
                  })
                }
              />

              <Input
                label="Máximo columnas tablet"
                type="number"
                min="1"
                max="4"
                value={form.catalogConfig.columnsTablet}
                onChange={(e) =>
                  updateCatalogConfig({
                    columnsTablet: clampInt(e.target.value, 1, 4, 3),
                  })
                }
              />

              <Input
                label="Máximo columnas móvil"
                type="number"
                min="1"
                max="2"
                value={form.catalogConfig.columnsMobile}
                onChange={(e) =>
                  updateCatalogConfig({
                    columnsMobile: clampInt(e.target.value, 1, 2, 2),
                  })
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Columnas iniciales desktop"
                type="number"
                min="1"
                max="6"
                value={form.catalogConfig.defaultColsDesktop}
                onChange={(e) =>
                  updateCatalogConfig({
                    defaultColsDesktop: clampInt(e.target.value, 1, 6, 4),
                  })
                }
              />

              <Input
                label="Columnas iniciales móvil"
                type="number"
                min="1"
                max="2"
                value={form.catalogConfig.defaultColsMobile}
                onChange={(e) =>
                  updateCatalogConfig({
                    defaultColsMobile: clampInt(e.target.value, 1, 2, 2),
                  })
                }
              />
            </div>

            <Input
              label="Límite inicial de productos (0 = sin límite)"
              type="number"
              min="0"
              max="200"
              value={form.catalogConfig.limit}
              onChange={(e) =>
                updateCatalogConfig({
                  limit: clampInt(e.target.value, 0, 200, 0),
                })
              }
            />
          </SectionCard>

          <SectionCard
            title="Botones de columnas"
            text="Aquí se controla el color de los botones de vista de columnas sin afectar la estructura de la card."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ColorInput
                label="Fondo botón normal"
                value={form.catalogConfig.columnControlsUiConfig.buttonBgColor}
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    buttonBgColor: e.target.value,
                  })
                }
              />

              <ColorInput
                label="Borde botón normal"
                value={
                  form.catalogConfig.columnControlsUiConfig.buttonBorderColor
                }
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    buttonBorderColor: e.target.value,
                  })
                }
              />

              <ColorInput
                label="Ícono botón normal"
                value={form.catalogConfig.columnControlsUiConfig.buttonIconColor}
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    buttonIconColor: e.target.value,
                  })
                }
              />

              <ColorInput
                label="Fondo botón hover"
                value={form.catalogConfig.columnControlsUiConfig.hoverButtonBgColor}
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    hoverButtonBgColor: e.target.value,
                  })
                }
              />

              <ColorInput
                label="Borde botón hover"
                value={form.catalogConfig.columnControlsUiConfig.hoverButtonBorderColor}
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    hoverButtonBorderColor: e.target.value,
                  })
                }
              />

              <ColorInput
                label="Ícono botón hover"
                value={form.catalogConfig.columnControlsUiConfig.hoverButtonIconColor}
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    hoverButtonIconColor: e.target.value,
                  })
                }
              />

              <ColorInput
                label="Fondo botón activo"
                value={
                  form.catalogConfig.columnControlsUiConfig.activeButtonBgColor
                }
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    activeButtonBgColor: e.target.value,
                  })
                }
              />

              <ColorInput
                label="Borde botón activo"
                value={
                  form.catalogConfig.columnControlsUiConfig
                    .activeButtonBorderColor
                }
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    activeButtonBorderColor: e.target.value,
                  })
                }
              />

              <ColorInput
                label="Ícono botón activo"
                value={
                  form.catalogConfig.columnControlsUiConfig.activeButtonIconColor
                }
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    activeButtonIconColor: e.target.value,
                  })
                }
              />

              <Input
                label="Radio botón columnas (px)"
                type="number"
                min="8"
                max="24"
                value={form.catalogConfig.columnControlsUiConfig.buttonRadiusPx}
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    buttonRadiusPx: clampInt(e.target.value, 8, 24, 12),
                  })
                }
              />

              <Input
                label="Grosor borde botón columnas (px)"
                type="number"
                min="1"
                max="4"
                value={
                  form.catalogConfig.columnControlsUiConfig.buttonBorderWidthPx
                }
                onChange={(e) =>
                  updateColumnControlsUiConfig({
                    buttonBorderWidthPx: clampInt(e.target.value, 1, 4, 1),
                  })
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Filtros iniciales"
            text="Estado inicial con el que debe abrir la página catálogo."
          >
            <Textarea
              label="Colores iniciales (separados por coma)"
              value={form.catalogConfig.initialColorsText}
              onChange={(e) =>
                updateCatalogConfig({
                  initialColorsText: normalizeCsvText(e.target.value),
                })
              }
              placeholder="Ej: #ffffff, dorado, rosa"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Precio mínimo inicial"
                type="number"
                min="0"
                max="10000000"
                value={form.catalogConfig.initialMinPrice}
                onChange={(e) =>
                  updateCatalogConfig({
                    initialMinPrice: clampNumber(e.target.value, 0, 10000000, 0),
                  })
                }
              />

              <Input
                label="Precio máximo inicial"
                type="number"
                min="0"
                max="10000000"
                value={form.catalogConfig.initialMaxPrice}
                onChange={(e) =>
                  updateCatalogConfig({
                    initialMaxPrice: clampNumber(
                      e.target.value,
                      0,
                      10000000,
                      10000000
                    ),
                  })
                }
              />
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "empty" && (
        <SectionCard
          title="Estado vacío"
          text="Mensajes para cuando no haya productos visibles."
        >
          <Input
            label="Título cuando no hay resultados"
            value={form.catalogConfig.emptyTitle}
            onChange={(e) =>
              updateCatalogConfig({ emptyTitle: e.target.value })
            }
            placeholder="Ej: No se encontraron productos"
          />

          <Textarea
            label="Texto cuando no hay resultados"
            value={form.catalogConfig.emptyText}
            onChange={(e) =>
              updateCatalogConfig({ emptyText: e.target.value })
            }
            placeholder="Ej: Intenta cambiar los filtros para ver más resultados."
          />
        </SectionCard>
      )}
    </div>
  );
}
