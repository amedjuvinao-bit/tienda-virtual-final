import { normalizeCategoriasSection } from "./categorias/categoriasSectionHelpers";
import { normalizeComplementosSection } from "./complementos/complementosSectionHelpers";
import { normalizeTrendingPresentation } from "../../../components/trendingPresentation";
import { DEFAULT_STYLE, DEFAULT_TENDENCIA_CONFIG, clampNumber, normalizeTendenciaConfig } from "./ui/sectionHelpers";

export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@300;400;500;600;700;800;900",
    "family=Poppins:wght@300;400;500;600;700;800;900",
    "family=Montserrat:wght@300;400;500;600;700;800;900",
    "family=Playfair+Display:wght@400;500;600;700;800;900",
    "family=DM+Serif+Display:ital@0;1",
    "family=Cormorant+Garamond:wght@300;400;500;600;700;800;900",
    "family=Lora:wght@300;400;500;600;700",
    "family=Nunito:wght@300;400;500;600;700;800;900",
    "family=Raleway:wght@300;400;500;600;700;800;900",
  ].join("&") +
  "&display=swap";

export function ensureGoogleFontsLoaded() {
  try {
    const id = "rb-google-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_HREF;
    document.head.appendChild(link);
  } catch (_) {}
}

export const CARD_FONT_OPTIONS = [
  { label: "Usar por defecto", value: "" },

  { label: "Inter (moderna)", value: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Poppins (moderna)", value: 'Poppins, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Montserrat (moderna)", value: 'Montserrat, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Raleway (moderna)", value: 'Raleway, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Nunito (suave)", value: 'Nunito, system-ui, -apple-system, "Segoe UI", sans-serif' },

  { label: "Playfair Display (elegante)", value: '"Playfair Display", Georgia, serif' },
  { label: "DM Serif Display (elegante)", value: '"DM Serif Display", Georgia, serif' },
  { label: "Cormorant Garamond (lujo)", value: '"Cormorant Garamond", Georgia, serif' },
  { label: "Lora (editorial)", value: '"Lora", Georgia, serif' },
];

export const SECTION_CATALOG = [
  { id: "tendencia", label: "En tendencia — tendencia" },
  { id: "look", label: "Look — look" },
  { id: "complementos", label: "Complementos — complementos" },
  { id: "categorias", label: "Categorías — categorias" },
  { id: "instagram", label: "Instagram — instagram" },
  { id: "tiktok", label: "TikTok — tiktok" },
  { id: "informacion", label: "Información — informacion" },
];

export function moneyCOP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

export function calcFinalPriceByPercent(price, percent) {
  const p = Number(price);
  const d = Number(percent);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (!Number.isFinite(d) || d <= 0) return Math.round(p);
  const pct = clampNumber(d, 0, 95);
  const final = p * (1 - pct / 100);
  return Math.max(0, Math.round(final));
}

export function normalizeDiscountFields(item) {
  const price = Number(item?.price ?? 0) || 0;
  const hasDiscount = typeof item?.hasDiscount === "boolean" ? item.hasDiscount : false;

  const discountPercentRaw = Number(item?.discountPercent);
  const discountPercent = Number.isFinite(discountPercentRaw)
    ? clampNumber(discountPercentRaw, 0, 95)
    : 0;

  const finalPriceRaw = Number(item?.finalPrice);
  const finalFromItem = Number.isFinite(finalPriceRaw) ? finalPriceRaw : price;

  if (!hasDiscount) {
    return {
      ...item,
      price,
      hasDiscount: false,
      discountPercent: 0,
      finalPrice: price,
    };
  }

  if (discountPercent > 0) {
    return {
      ...item,
      price,
      hasDiscount: true,
      discountPercent,
      finalPrice: calcFinalPriceByPercent(price, discountPercent),
    };
  }

  if (finalFromItem < price && price > 0) {
    const inferred = Math.round(((price - finalFromItem) / price) * 100);
    const safeInf = clampNumber(inferred, 1, 95);
    return {
      ...item,
      price,
      hasDiscount: true,
      discountPercent: safeInf,
      finalPrice: calcFinalPriceByPercent(price, safeInf),
    };
  }

  return {
    ...item,
    price,
    hasDiscount: true,
    discountPercent: 10,
    finalPrice: calcFinalPriceByPercent(price, 10),
  };
}

export function normalizeTendenciaConfigPlus(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const base = normalizeTendenciaConfig({
    ...DEFAULT_TENDENCIA_CONFIG,
    ...src,
  });

  const titleImage = typeof src.titleImage === "string" ? src.titleImage : "";
  const watermarkImage = typeof src.watermarkImage === "string" ? src.watermarkImage : "";

  const watermarkSizePx = Number.isFinite(Number(src.watermarkSizePx))
    ? Number(src.watermarkSizePx)
    : 140;
  const watermarkOpacity = Number.isFinite(Number(src.watermarkOpacity))
    ? Number(src.watermarkOpacity)
    : 0.12;

  const posRaw = typeof src.watermarkPosition === "string" ? src.watermarkPosition : "br";
  const watermarkPosition = ["br", "tr", "bl", "tl"].includes(posRaw) ? posRaw : "br";

  const watermarkOffsetXPx = Number.isFinite(Number(src.watermarkOffsetXPx))
    ? Number(src.watermarkOffsetXPx)
    : 0;
  const watermarkOffsetYPx = Number.isFinite(Number(src.watermarkOffsetYPx))
    ? Number(src.watermarkOffsetYPx)
    : 0;

  const watermarkFree = typeof src.watermarkFree === "boolean" ? src.watermarkFree : false;
  const watermarkPosXPct = Number.isFinite(Number(src.watermarkPosXPct))
    ? Number(src.watermarkPosXPct)
    : 88;
  const watermarkPosYPct = Number.isFinite(Number(src.watermarkPosYPct))
    ? Number(src.watermarkPosYPct)
    : 86;
  const watermarkRotateDeg = Number.isFinite(Number(src.watermarkRotateDeg))
    ? Number(src.watermarkRotateDeg)
    : 0;

  return {
    ...base,
    titleImage,
    watermarkImage,
    watermarkSizePx,
    watermarkOpacity,
    watermarkPosition,
    watermarkOffsetXPx,
    watermarkOffsetYPx,
    watermarkFree,
    watermarkPosXPct: clampNumber(watermarkPosXPct, 0, 100),
    watermarkPosYPct: clampNumber(watermarkPosYPct, 0, 100),
    watermarkRotateDeg: clampNumber(watermarkRotateDeg, -180, 180),
    presentation: normalizeTrendingPresentation(src.presentation),
  };
}

export function inferTypeFromId(id) {
  const hit = SECTION_CATALOG.find((s) => s.id === id);
  return hit ? hit.id : id || "tendencia";
}

export function inferNameFromId(id) {
  const hit = SECTION_CATALOG.find((s) => s.id === id);
  if (hit) return hit.label.split("—")[0].trim();
  if (!id) return "Sección";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function normalizeSection(raw, index) {
  const safe = raw && typeof raw === "object" ? raw : {};
  const id =
    (typeof safe.id === "string" && safe.id.trim()) ||
    (typeof safe.type === "string" && safe.type.trim()) ||
    `section_${index + 1}`;

  const type = inferTypeFromId(safe.type || id);
  const name = (typeof safe.name === "string" && safe.name.trim()) || inferNameFromId(id);
  const enabled = typeof safe.enabled === "boolean" ? safe.enabled : true;

  if (type === "categorias") return normalizeCategoriasSection({ ...safe, id, type, name, enabled });
  if (type === "complementos") return normalizeComplementosSection({ ...safe, id, type, name, enabled });

  const style = {
    ...DEFAULT_STYLE,
    ...(safe.style && typeof safe.style === "object" ? safe.style : {}),
  };

  let config = safe.config && typeof safe.config === "object" ? safe.config : {};

  if (type === "tendencia") {
    config = normalizeTendenciaConfigPlus({
      ...DEFAULT_TENDENCIA_CONFIG,
      ...config,
    });

    if (Array.isArray(config.products)) {
      config = {
        ...config,
        products: config.products.map((p) => normalizeDiscountFields(p)),
      };
    }
  }

  return { id, type, name, enabled, style, config };
}

export function normalizeSectionsArray(theme) {
  const list = theme && theme.sections && Array.isArray(theme.sections) ? theme.sections : [];

  if (!list.length) {
    return [
      normalizeSection(
        {
          id: "tendencia",
          type: "tendencia",
          name: "En tendencia",
          config: DEFAULT_TENDENCIA_CONFIG,
        },
        0
      ),
    ];
  }

  return list.map((s, idx) => normalizeSection(s, idx));
}

export function cloneSections(sections) {
  return sections.map((sec) => {
    const base = {
      ...sec,
      style: { ...sec.style },
      config:
        sec.type === "tendencia"
          ? normalizeTendenciaConfigPlus(sec.config)
          : { ...(sec.config || {}) },
    };

    if (base.type === "tendencia") {
      const cfg = normalizeTendenciaConfigPlus(base.config);
      const products = Array.isArray(cfg.products)
        ? cfg.products.map((p) => normalizeDiscountFields(p))
        : [];
      return { ...base, config: { ...cfg, products } };
    }

    return base;
  });
}

export function extractAllImagesFromProduct(product) {
  if (!product || typeof product !== "object") return [];
  const images = new Set();

  if (typeof product.image === "string" && product.image.trim()) images.add(product.image.trim());

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

  if (typeof product.image1 === "string" && product.image1.trim()) images.add(product.image1.trim());
  if (typeof product.image2 === "string" && product.image2.trim()) images.add(product.image2.trim());

  return Array.from(images);
}

export function buildTendenciaProductFromBackend(product) {
  if (!product || typeof product !== "object") return null;

  const images = extractAllImagesFromProduct(product);
  if (!images.length) return null;

  const price = Number(product.price ?? 0) || 0;

  const backendFinal = Number(product.finalPrice);
  const hasBackendFinal = Number.isFinite(backendFinal) && backendFinal > 0;
  const finalPrice = hasBackendFinal ? backendFinal : price;

  const base = {
    productId: String(product._id || product.id || ""),
    name: String(product.title || product.name || "").trim(),
    images,
    mainImage: images[0],
    hoverImage: images[1] || images[0],
    price,
    finalPrice,
    hasDiscount: false,
    discountPercent: 0,
  };

  const withBackendDiscount =
    price > 0 && finalPrice > 0 && finalPrice < price
      ? { ...base, hasDiscount: true, finalPrice }
      : base;

  return normalizeDiscountFields(withBackendDiscount);
}
