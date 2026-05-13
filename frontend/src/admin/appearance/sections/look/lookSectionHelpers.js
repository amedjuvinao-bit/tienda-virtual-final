// src/admin/appearance/sections/look/lookSectionHelpers.js

export const LOOK_SECTION_ID = "look";

export const LOOK_MAX_PRODUCTS = 6;

export const LOOK_SECTION_DEFAULTS = {
  id: LOOK_SECTION_ID,
  type: "look",
  name: "Look Section",
  label: "Look",
  enabled: true,

  config: {
    titleImage: "/ImgSEccionLook/Titulo.png",
    titleText: "",
    description:
      "¡Descubre nuestros looks pensados para bautizos, celebraciones y recuerdos eternos!",
    maxItems: 6,
    selectedProductId: "",
    products: [],
    actions: {
      favorite: {
        enabled: true,
      },
      cart: {
        enabled: true,
      },
    },
  },

  style: {
    sectionPaddingTopPx: 48,
    sectionPaddingBottomPx: 48,
    sectionPaddingXPx: 16,

    contentMaxWidthPx: 1152,
    contentGapPx: 24,

    desktopLeftRatio: 2,
    desktopRightRatio: 1,

    titleAlign: "center",
    titleImageWidthPx: 520,
    titleGapPx: 8,

    titleFontFamily: "",
    titleColor: "#374151",
    titleSizePx: 28,
    titleWeight: 700,
    titleItalic: false,
    titleUnderline: false,

    descFontFamily: "",
    descColor: "#374151",
    descSizePx: 14,
    descWeight: 400,
    descItalic: false,
    descUnderline: false,

    mainImageAspect: "3/4",
    mainImageRadiusPx: 32,
    mainImageBorderPx: 4,
    mainImageBorderColor: "#fecdd3",
    mainImageShadow: true,

    thumbGridColsDesktop: 3,
    thumbGridColsMobile: 2,
    thumbGapPx: 20,
    thumbSizePreset: "md",

    thumbRadiusPx: 16,
    thumbHoverScale: 1.05,
    thumbHoverRotateDeg: 1.5,
    thumbShadow: true,

    thumbTitleFontFamily: "",
    thumbTitleColor: "#1f2937",
    thumbTitleSizePx: 14,
    thumbTitleWeight: 500,
    thumbTitleItalic: false,
    thumbTitleUnderline: false,

    thumbPriceFontFamily: "",
    thumbPriceColor: "#e11d48",
    thumbPriceSizePx: 14,
    thumbPriceWeight: 500,
    thumbPriceItalic: false,
    thumbPriceUnderline: false,

    colorDotSizePx: 20,
    colorDotBorderColor: "#d1d5db",

    actionButtonBg: "#ffffff",
    actionButtonBorderColor: "#e5e7eb",
    actionFavoriteColor: "#ec4899",
    actionCartColor: "#eab308",
    actionTooltipBg: "rgba(236,72,153,0.5)",
    actionTooltipTextColor: "#ffffff",

    mobileSliderGapPx: 12,
    mobileSliderControlMarginTopPx: 16,
    mobileSliderControlBg: "#ffffff",
    mobileSliderControlBorderColor: "#9f496d",
    mobileSliderControlIconColor: "#c26a8f",
    mobileSliderControlSeparatorColor: "#e5bfd0",
    mobileSliderControlRadiusPx: 999,
    mobileSliderControlButtonWidthPx: 48,
    mobileSliderControlButtonHeightPx: 44,
    mobileSliderControlSeparatorWidthPx: 1,
  },
};

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeTextStyle(style = {}, prefix, fallback = {}) {
  return {
    [`${prefix}FontFamily`]: asString(
      style?.[`${prefix}FontFamily`],
      fallback[`${prefix}FontFamily`] || ""
    ),
    [`${prefix}Color`]: asString(
      style?.[`${prefix}Color`],
      fallback[`${prefix}Color`] || ""
    ),
    [`${prefix}SizePx`]: clampNumber(
      style?.[`${prefix}SizePx`],
      8,
      120,
      Number(fallback[`${prefix}SizePx`]) || 14
    ),
    [`${prefix}Weight`]: clampNumber(
      style?.[`${prefix}Weight`],
      100,
      900,
      Number(fallback[`${prefix}Weight`]) || 400
    ),
    [`${prefix}Italic`]: asBool(
      style?.[`${prefix}Italic`],
      !!fallback[`${prefix}Italic`]
    ),
    [`${prefix}Underline`]: asBool(
      style?.[`${prefix}Underline`],
      !!fallback[`${prefix}Underline`]
    ),
  };
}

function normalizeColorItem(color) {
  if (typeof color === "string") {
    return color.trim();
  }

  if (color && typeof color === "object") {
    return {
      ...color,
      hex: asString(color.hex, "").trim(),
      value: asString(color.value, "").trim(),
      color: asString(color.color, "").trim(),
      name: asString(color.name, "").trim(),
      label: asString(color.label, "").trim(),
    };
  }

  return null;
}

function normalizeProducts(products) {
  const list = Array.isArray(products) ? products : [];

  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const productId = asString(item.productId).trim();
      if (!productId) return null;

      const mainImage = asString(item.mainImage, "").trim();
      const hoverImage = asString(item.hoverImage, "").trim();

      const title = asString(
        item.title,
        asString(item.name, asString(item.productTitle, ""))
      ).trim();

      const priceNumber = Number(item.price);
      const price = Number.isFinite(priceNumber) ? priceNumber : 0;

      const colors = Array.isArray(item.colors)
        ? item.colors.map(normalizeColorItem).filter(Boolean)
        : [];

      return {
        productId,
        title,
        price,
        colors,
        mainImage,
        hoverImage: hoverImage || mainImage,
      };
    })
    .filter(Boolean)
    .slice(0, LOOK_MAX_PRODUCTS);
}

export function normalizeLookSectionConfig(input = {}) {
  const base = LOOK_SECTION_DEFAULTS.config;
  const actions = input?.actions && typeof input.actions === "object" ? input.actions : {};

  const products = normalizeProducts(input?.products);
  const productIds = products.map((p) => p.productId);

  let selectedProductId = asString(input?.selectedProductId, base.selectedProductId).trim();
  if (selectedProductId && !productIds.includes(selectedProductId)) {
    selectedProductId = "";
  }

  if (!selectedProductId && products.length > 0) {
    selectedProductId = products[0].productId;
  }

  return {
    titleImage: asString(input?.titleImage, base.titleImage).trim() || base.titleImage,
    titleText: asString(input?.titleText, base.titleText),
    description: asString(input?.description, base.description),
    maxItems: clampNumber(input?.maxItems, 1, LOOK_MAX_PRODUCTS, base.maxItems),
    selectedProductId,
    products,
    actions: {
      favorite: {
        enabled: asBool(actions?.favorite?.enabled, base.actions.favorite.enabled),
      },
      cart: {
        enabled: asBool(actions?.cart?.enabled, base.actions.cart.enabled),
      },
    },
  };
}

export function normalizeLookSectionStyle(input = {}) {
  const base = LOOK_SECTION_DEFAULTS.style;

  const normalized = {
    sectionPaddingTopPx: clampNumber(input?.sectionPaddingTopPx, 0, 300, base.sectionPaddingTopPx),
    sectionPaddingBottomPx: clampNumber(
      input?.sectionPaddingBottomPx,
      0,
      300,
      base.sectionPaddingBottomPx
    ),
    sectionPaddingXPx: clampNumber(input?.sectionPaddingXPx, 0, 120, base.sectionPaddingXPx),

    contentMaxWidthPx: clampNumber(input?.contentMaxWidthPx, 320, 1800, base.contentMaxWidthPx),
    contentGapPx: clampNumber(input?.contentGapPx, 0, 120, base.contentGapPx),

    desktopLeftRatio: clampNumber(input?.desktopLeftRatio, 1, 4, base.desktopLeftRatio),
    desktopRightRatio: clampNumber(input?.desktopRightRatio, 1, 4, base.desktopRightRatio),

    titleAlign: ["left", "center", "right"].includes(input?.titleAlign)
      ? input.titleAlign
      : base.titleAlign,
    titleImageWidthPx: clampNumber(input?.titleImageWidthPx, 80, 1000, base.titleImageWidthPx),
    titleGapPx: clampNumber(input?.titleGapPx, 0, 80, base.titleGapPx),

    ...normalizeTextStyle(input, "title", base),
    ...normalizeTextStyle(input, "desc", base),
    ...normalizeTextStyle(input, "thumbTitle", base),
    ...normalizeTextStyle(input, "thumbPrice", base),

    mainImageAspect: ["1/1", "3/4", "4/5", "16/9"].includes(input?.mainImageAspect)
      ? input.mainImageAspect
      : base.mainImageAspect,
    mainImageRadiusPx: clampNumber(input?.mainImageRadiusPx, 0, 80, base.mainImageRadiusPx),
    mainImageBorderPx: clampNumber(input?.mainImageBorderPx, 0, 20, base.mainImageBorderPx),
    mainImageBorderColor: asString(input?.mainImageBorderColor, base.mainImageBorderColor),
    mainImageShadow: asBool(input?.mainImageShadow, base.mainImageShadow),

    thumbGridColsDesktop: clampNumber(
      input?.thumbGridColsDesktop,
      1,
      4,
      base.thumbGridColsDesktop
    ),
    thumbGridColsMobile: clampNumber(
      input?.thumbGridColsMobile,
      1,
      3,
      base.thumbGridColsMobile
    ),
    thumbGapPx: clampNumber(input?.thumbGapPx, 0, 60, base.thumbGapPx),
    thumbSizePreset: ["sm", "md", "lg"].includes(asString(input?.thumbSizePreset).trim().toLowerCase())
      ? asString(input?.thumbSizePreset).trim().toLowerCase()
      : base.thumbSizePreset,

    thumbRadiusPx: clampNumber(input?.thumbRadiusPx, 0, 40, base.thumbRadiusPx),
    thumbHoverScale: clampNumber(input?.thumbHoverScale, 1, 1.2, base.thumbHoverScale),
    thumbHoverRotateDeg: clampNumber(
      input?.thumbHoverRotateDeg,
      0,
      10,
      base.thumbHoverRotateDeg
    ),
    thumbShadow: asBool(input?.thumbShadow, base.thumbShadow),

    colorDotSizePx: clampNumber(input?.colorDotSizePx, 8, 40, base.colorDotSizePx),
    colorDotBorderColor: asString(input?.colorDotBorderColor, base.colorDotBorderColor),

    actionButtonBg: asString(input?.actionButtonBg, base.actionButtonBg),
    actionButtonBorderColor: asString(
      input?.actionButtonBorderColor,
      base.actionButtonBorderColor
    ),
    actionFavoriteColor: asString(input?.actionFavoriteColor, base.actionFavoriteColor),
    actionCartColor: asString(input?.actionCartColor, base.actionCartColor),
    actionTooltipBg: asString(input?.actionTooltipBg, base.actionTooltipBg),
    actionTooltipTextColor: asString(
      input?.actionTooltipTextColor,
      base.actionTooltipTextColor
    ),

    mobileSliderGapPx: clampNumber(
      input?.mobileSliderGapPx,
      0,
      40,
      base.mobileSliderGapPx
    ),
    mobileSliderControlMarginTopPx: clampNumber(
      input?.mobileSliderControlMarginTopPx,
      0,
      60,
      base.mobileSliderControlMarginTopPx
    ),
    mobileSliderControlBg: asString(
      input?.mobileSliderControlBg,
      base.mobileSliderControlBg
    ),
    mobileSliderControlBorderColor: asString(
      input?.mobileSliderControlBorderColor,
      base.mobileSliderControlBorderColor
    ),
    mobileSliderControlIconColor: asString(
      input?.mobileSliderControlIconColor,
      base.mobileSliderControlIconColor
    ),
    mobileSliderControlSeparatorColor: asString(
      input?.mobileSliderControlSeparatorColor,
      base.mobileSliderControlSeparatorColor
    ),
    mobileSliderControlRadiusPx: clampNumber(
      input?.mobileSliderControlRadiusPx,
      0,
      999,
      base.mobileSliderControlRadiusPx
    ),
    mobileSliderControlButtonWidthPx: clampNumber(
      input?.mobileSliderControlButtonWidthPx,
      24,
      120,
      base.mobileSliderControlButtonWidthPx
    ),
    mobileSliderControlButtonHeightPx: clampNumber(
      input?.mobileSliderControlButtonHeightPx,
      24,
      120,
      base.mobileSliderControlButtonHeightPx
    ),
    mobileSliderControlSeparatorWidthPx: clampNumber(
      input?.mobileSliderControlSeparatorWidthPx,
      1,
      8,
      base.mobileSliderControlSeparatorWidthPx
    ),
  };

  return normalized;
}

export function normalizeLookSection(section = {}) {
  const base = LOOK_SECTION_DEFAULTS;

  return {
    ...base,
    ...section,
    id: LOOK_SECTION_ID,
    type: "look",
    name: asString(section?.name, base.name),
    label: asString(section?.label, base.label),
    enabled: asBool(section?.enabled, base.enabled),
    config: normalizeLookSectionConfig(section?.config),
    style: normalizeLookSectionStyle(section?.style),
  };
}