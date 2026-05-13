/**
 * sectionHelpers.js
 * ✅ Compatible con SectionsPanel actual
 * - Soporta clampNumber con 2 firmas:
 *     clampNumber(value, { min, max, fallback })
 *     clampNumber(value, min, max)
 * - Preserva campos de watermark libre
 * - Unifica watermarkPosition con el formato que usa SectionsPanel.jsx:
 *     br | tr | bl | tl
 */

// ============================================
// ✅ Defaults del estilo general de secciones
// ============================================
export const DEFAULT_STYLE = {
  bgColor: "#ffffff",
  textColor: "#111827",
  accentColor: "#d4af37",

  titleSizePx: 42,
  subtitleSizePx: 16,

  titleWeight: 800,
  subtitleWeight: 400,

  cardRadiusPx: 18,
  imageHeightPx: 260,
  spacingPx: 16,

  cardTextFontFamily: "",
  cardTextColor: "",
  cardTextSizePx: 14,
  cardTextWeight: 700,
  cardTextItalic: false,
  cardTextUnderline: false,
};

// ============================================
// ✅ Defaults de Tendencia (config)
// ============================================
export const DEFAULT_TENDENCIA_CONFIG = {
  maxItems: 4,
  products: [],
  titleImage: "",

  actions: {
    favoritesEnabled: true,
    favoritesRoute: "/favoritos",
    cartEnabled: true,
    cartRoute: "/carrito",
  },

  watermarkImage: "",
  watermarkSizePx: 199,
  watermarkOpacity: 0.48,

  // ✅ Formato correcto que usa SectionsPanel.jsx
  watermarkPosition: "br", // br | tr | bl | tl
  watermarkOffsetXPx: -57,
  watermarkOffsetYPx: -60,

  // ✅ Campos que faltaban para modo libre
  watermarkFree: false,
  watermarkPosXPct: 88,
  watermarkPosYPct: 86,
  watermarkRotateDeg: 0,
};

// ============================================
// ✅ Helpers básicos
// ============================================
export function isHexColor(value) {
  const v = String(value || "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

/**
 * ✅ Compatible con:
 * clampNumber(value, {min,max,fallback})
 * clampNumber(value, min, max)
 */
export function clampNumber(value, arg2, arg3) {
  const n = Number(value);

  // Firma 1: clampNumber(value, {min,max,fallback})
  if (typeof arg2 === "object" && arg2 !== null) {
    const { min = -Infinity, max = Infinity, fallback = 0 } = arg2;
    if (!Number.isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  // Firma 2: clampNumber(value, min, max)
  if (typeof arg2 === "number" && typeof arg3 === "number") {
    if (!Number.isFinite(n)) return arg2;
    if (n < arg2) return arg2;
    if (n > arg3) return arg3;
    return n;
  }

  return Number.isFinite(n) ? n : 0;
}

export function buildSectionHref(id) {
  const safe = String(id || "").trim();
  return safe ? `/#${safe}` : "/#";
}

// ============================================
// ✅ Normalizador de config de Tendencia
// ============================================
export function normalizeTendenciaConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};

  const out = {
    ...DEFAULT_TENDENCIA_CONFIG,
    ...src,
  };

  // maxItems
  out.maxItems = clampNumber(out.maxItems, { min: 1, max: 24, fallback: 4 });

  // titleImage
  out.titleImage = typeof out.titleImage === "string" ? out.titleImage : "";

  // watermark image
  out.watermarkImage =
    typeof out.watermarkImage === "string" ? out.watermarkImage : "";

  out.watermarkSizePx = clampNumber(out.watermarkSizePx, 40, 320);
  out.watermarkOpacity = clampNumber(out.watermarkOpacity, 0, 1);

  // ✅ Unificar formatos viejos y nuevos
  const positionMap = {
    "bottom-right": "br",
    "top-right": "tr",
    "bottom-left": "bl",
    "top-left": "tl",
    br: "br",
    tr: "tr",
    bl: "bl",
    tl: "tl",
  };

  const rawPos = String(out.watermarkPosition || "").trim();
  out.watermarkPosition = positionMap[rawPos] || "br";

  out.watermarkOffsetXPx = clampNumber(out.watermarkOffsetXPx, -200, 200);
  out.watermarkOffsetYPx = clampNumber(out.watermarkOffsetYPx, -200, 200);

  // ✅ Preservar modo libre
  out.watermarkFree =
    typeof out.watermarkFree === "boolean" ? out.watermarkFree : false;

  out.watermarkPosXPct = clampNumber(out.watermarkPosXPct, { min: 0, max: 100, fallback: 88 });
  out.watermarkPosYPct = clampNumber(out.watermarkPosYPct, { min: 0, max: 100, fallback: 86 });
  out.watermarkRotateDeg = clampNumber(out.watermarkRotateDeg, { min: -180, max: 180, fallback: 0 });

  // ============================================
  // ✅ NORMALIZAR ACTIONS
  // ============================================
  const acts = out.actions && typeof out.actions === "object"
    ? out.actions
    : {};

  out.actions = {
    favoritesEnabled:
      typeof acts.favoritesEnabled === "boolean"
        ? acts.favoritesEnabled
        : true,

    favoritesRoute:
      typeof acts.favoritesRoute === "string" && acts.favoritesRoute.trim()
        ? acts.favoritesRoute.trim()
        : "/favoritos",

    cartEnabled:
      typeof acts.cartEnabled === "boolean"
        ? acts.cartEnabled
        : true,

    cartRoute:
      typeof acts.cartRoute === "string" && acts.cartRoute.trim()
        ? acts.cartRoute.trim()
        : "/carrito",
  };

  // ============================================
  // ✅ NORMALIZAR PRODUCTS
  // ============================================
  const arr = Array.isArray(out.products) ? out.products : [];

  out.products = arr
    .map((p) => {
      const obj = p && typeof p === "object" ? p : {};
      const productId = String(obj.productId || "").trim();

      return {
        ...obj,
        productId,
        mainImage: typeof obj.mainImage === "string" ? obj.mainImage : "",
        hoverImage: typeof obj.hoverImage === "string" ? obj.hoverImage : "",
        price: Number(obj.price) || 0,
        finalPrice: Number(obj.finalPrice) || 0,
        hasDiscount: !!obj.hasDiscount,
      };
    })
    .filter((x) => x.productId);

  if (out.products.length > out.maxItems) {
    out.products = out.products.slice(0, out.maxItems);
  }

  return out;
}