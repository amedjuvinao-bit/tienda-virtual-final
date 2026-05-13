// src/admin/appearance/sections/categorias/categoriasSectionHelpers.js

export const CATEGORIAS_SECTION_ID = "categorias";

export const CATEGORIAS_SECTION_DEFAULTS = {
  id: CATEGORIAS_SECTION_ID,
  type: "categorias",
  name: "Categorías",
  label: "Categorías",
  enabled: true,

  config: {
    titleImage: "/SeccionCategoria/TituloCate.png",
    titleText: "Categorías",
    titleAlt: "Título de categorías",

    slides: [
      {
        id: "cat_1",
        image: "/SeccionCategoria/complementos.jpg",
        title: "Complementos",
        subtitle: "",
        review: "",
        badge: "",
        buttonImg: "/SeccionCategoria/Complementos.png",
        buttonText: "Ver más",
        href: "/complementos",
        enabled: true,
      },
      {
        id: "cat_2",
        image: "/SeccionCategoria/lo-nuevo.jpg",
        title: "Lo nuevo",
        subtitle: "",
        review: "",
        badge: "",
        buttonImg: "/SeccionCategoria/lo-nuevo.png",
        buttonText: "Ver más",
        href: "/lo-nuevo",
        enabled: true,
      },
      {
        id: "cat_3",
        image: "/SeccionCategoria/bebe.jpg",
        title: "0-12 meses",
        subtitle: "",
        review: "",
        badge: "",
        buttonImg: "/SeccionCategoria/0-12mese.png",
        buttonText: "Ver más",
        href: "/categoria/bebe",
        enabled: true,
      },
      {
        id: "cat_4",
        image: "/SeccionCategoria/niña2-8.jpg",
        title: "2-8 Años",
        subtitle: "",
        review: "",
        badge: "",
        buttonImg: "/SeccionCategoria/2-8anos.png",
        buttonText: "Ver más",
        href: "/categoria/2-8",
        enabled: true,
      },
      {
        id: "cat_5",
        image: "/SeccionCategoria/niña9-12.jpg",
        title: "9-12 Años",
        subtitle: "",
        review: "",
        badge: "",
        buttonImg: "/SeccionCategoria/9-12anos.png",
        buttonText: "Ver más",
        href: "/categoria/9-12",
        enabled: true,
      },
    ],
  },

  style: {
    sectionMaxWidthPx: 1280,
    sectionPaddingTopPx: 64,
    sectionPaddingBottomPx: 24,
    sectionPaddingXPx: 12,

    titleMaxWidthPx: 640,
    titleMarginBottomPx: 20,

    sliderPerViewDesktop: 4,
    sliderPerViewTablet: 3,
    sliderPerViewMobile: 2,
    sliderSpacingPx: 10,
    autoplayMs: 3200,

    cardRadiusPx: 12,
    cardBorderPx: 2,
    cardBorderColor: "#d4af3769",
    cardShadow: true,
    cardBgFrom: "#fff8e1",
    cardBgTo: "#ffeaa7",

    imageAspectRatio: "3/4",
    imageObjectFit: "cover",

    cardHoverScale: 1.04,
    activeCardScale: 1.06,
    inactiveCardOpacity: 0.92,

    heroWidthPx: 1280,
    heroHeightPx: 470,
    heroRadiusPx: 24,
    heroBorderPx: 0,
    heroBorderColor: "#f9a8d4",

    heroImagePosXPercent: 50,
    heroImagePosYPercent: 50,
    heroImageScale: 1.02,

    heroOverlayStart: "rgba(0,0,0,0.34)",
    heroOverlayMiddle: "rgba(0,0,0,0.14)",
    heroOverlayEnd: "rgba(0,0,0,0.28)",

    heroContentPosXPercent: 8,
    heroContentPosYPercent: 10,

    thumbsPosXPercent: 68,
    thumbsPosYPercent: 50,
    thumbWidthPx: 140,
    thumbHeightPx: 190,
    thumbGapPx: 14,
    thumbTiltDeg: 8,

    showReview: true,
    showBadge: true,

    buttonOverlayBg: "rgba(255,255,255,0.72)",
    buttonOverlayHoverBg: "rgba(255,255,255,0.90)",
    buttonOverlayPaddingYPx: 10,
    buttonAnimation: "none",

    buttonTextColor: "#111827",
    buttonTextHoverColor: "#111827",
    buttonFontSizePx: 14,
    buttonFontWeight: "600",
    buttonRadiusPx: 12,
    buttonShape: "rounded",

    buttonImageWidthPx: 180,
    buttonImageWidthMobilePx: 130,

    showArrows: true,
    arrowStyle: "luxury",
    arrowBg: "rgba(255,255,255,0.88)",
    arrowColor: "#5b3a2e",
    arrowBorderColor: "#e8d7ad",
    arrowSizePx: 42,

    showDots: false,
    sliderStyle: "coverflow-soft",
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

function normalizeSlide(raw = {}, index = 0) {
  const base =
    CATEGORIAS_SECTION_DEFAULTS.config.slides[index] || {
      id: `cat_${index + 1}`,
      image: "",
      title: "",
      subtitle: "",
      review: "",
      badge: "",
      buttonImg: "",
      buttonText: "Ver más",
      href: "/",
      enabled: true,
    };

  return {
    id: asString(raw?.id, base.id).trim() || base.id,
    image: asString(raw?.image, base.image).trim(),
    title: asString(raw?.title, base.title).trim(),
    subtitle: asString(raw?.subtitle, base.subtitle).trim(),
    review: asString(raw?.review, base.review).trim(),
    badge: asString(raw?.badge, base.badge).trim(),
    buttonImg: asString(raw?.buttonImg, base.buttonImg).trim(),
    buttonText: asString(raw?.buttonText, base.buttonText).trim() || "Ver más",
    href: asString(raw?.href, base.href).trim() || "/",
    enabled: asBool(raw?.enabled, base.enabled),
  };
}

export function normalizeCategoriasSectionConfig(input = {}) {
  const base = CATEGORIAS_SECTION_DEFAULTS.config;
  const rawSlides = Array.isArray(input?.slides) ? input.slides : base.slides;

  return {
    titleImage: asString(input?.titleImage, base.titleImage).trim(),
    titleText: asString(input?.titleText, base.titleText).trim() || base.titleText,
    titleAlt: asString(input?.titleAlt, base.titleAlt).trim() || base.titleAlt,
    slides: rawSlides.map((slide, index) => normalizeSlide(slide, index)),
  };
}

export function normalizeCategoriasSectionStyle(input = {}) {
  const base = CATEGORIAS_SECTION_DEFAULTS.style;

  return {
    sectionMaxWidthPx: clampNumber(
      input?.sectionMaxWidthPx,
      480,
      1800,
      base.sectionMaxWidthPx
    ),
    sectionPaddingTopPx: clampNumber(
      input?.sectionPaddingTopPx,
      0,
      200,
      base.sectionPaddingTopPx
    ),
    sectionPaddingBottomPx: clampNumber(
      input?.sectionPaddingBottomPx,
      0,
      160,
      base.sectionPaddingBottomPx
    ),
    sectionPaddingXPx: clampNumber(
      input?.sectionPaddingXPx,
      0,
      80,
      base.sectionPaddingXPx
    ),

    titleMaxWidthPx: clampNumber(
      input?.titleMaxWidthPx,
      160,
      1200,
      base.titleMaxWidthPx
    ),
    titleMarginBottomPx: clampNumber(
      input?.titleMarginBottomPx,
      0,
      80,
      base.titleMarginBottomPx
    ),

    sliderPerViewDesktop: clampNumber(
      input?.sliderPerViewDesktop,
      1,
      6,
      base.sliderPerViewDesktop
    ),
    sliderPerViewTablet: clampNumber(
      input?.sliderPerViewTablet,
      1,
      5,
      base.sliderPerViewTablet
    ),
    sliderPerViewMobile: clampNumber(
      input?.sliderPerViewMobile,
      1,
      3,
      base.sliderPerViewMobile
    ),
    sliderSpacingPx: clampNumber(
      input?.sliderSpacingPx,
      0,
      40,
      base.sliderSpacingPx
    ),
    autoplayMs: clampNumber(
      input?.autoplayMs,
      1000,
      10000,
      base.autoplayMs
    ),

    cardRadiusPx: clampNumber(
      input?.cardRadiusPx,
      0,
      40,
      base.cardRadiusPx
    ),
    cardBorderPx: clampNumber(
      input?.cardBorderPx,
      0,
      8,
      base.cardBorderPx
    ),
    cardBorderColor: asString(input?.cardBorderColor, base.cardBorderColor),
    cardShadow: asBool(input?.cardShadow, base.cardShadow),
    cardBgFrom: asString(input?.cardBgFrom, base.cardBgFrom),
    cardBgTo: asString(input?.cardBgTo, base.cardBgTo),

    imageAspectRatio: ["3/4", "4/5", "1/1", "16/9"].includes(
      asString(input?.imageAspectRatio).trim()
    )
      ? asString(input?.imageAspectRatio).trim()
      : base.imageAspectRatio,

    imageObjectFit: ["cover", "contain", "fill"].includes(
      asString(input?.imageObjectFit).trim()
    )
      ? asString(input?.imageObjectFit).trim()
      : base.imageObjectFit,

    cardHoverScale: clampNumber(
      input?.cardHoverScale,
      1,
      1.15,
      base.cardHoverScale
    ),
    activeCardScale: clampNumber(
      input?.activeCardScale,
      1,
      1.2,
      base.activeCardScale
    ),
    inactiveCardOpacity: clampNumber(
      input?.inactiveCardOpacity,
      0.3,
      1,
      base.inactiveCardOpacity
    ),

    heroWidthPx: clampNumber(
      input?.heroWidthPx,
      320,
      1800,
      base.heroWidthPx
    ),
    heroHeightPx: clampNumber(
      input?.heroHeightPx,
      280,
      900,
      base.heroHeightPx
    ),
    heroRadiusPx: clampNumber(
      input?.heroRadiusPx,
      0,
      50,
      base.heroRadiusPx
    ),
    heroBorderPx: clampNumber(
      input?.heroBorderPx,
      0,
      10,
      base.heroBorderPx
    ),
    heroBorderColor: asString(input?.heroBorderColor, base.heroBorderColor),

    heroImagePosXPercent: clampNumber(
      input?.heroImagePosXPercent,
      0,
      100,
      base.heroImagePosXPercent
    ),
    heroImagePosYPercent: clampNumber(
      input?.heroImagePosYPercent,
      0,
      100,
      base.heroImagePosYPercent
    ),
    heroImageScale: clampNumber(
      input?.heroImageScale,
      1,
      2,
      base.heroImageScale
    ),

    heroOverlayStart: asString(input?.heroOverlayStart, base.heroOverlayStart),
    heroOverlayMiddle: asString(input?.heroOverlayMiddle, base.heroOverlayMiddle),
    heroOverlayEnd: asString(input?.heroOverlayEnd, base.heroOverlayEnd),

    heroContentPosXPercent: clampNumber(
      input?.heroContentPosXPercent,
      0,
      100,
      base.heroContentPosXPercent
    ),
    heroContentPosYPercent: clampNumber(
      input?.heroContentPosYPercent,
      0,
      100,
      base.heroContentPosYPercent
    ),

    thumbsPosXPercent: clampNumber(
      input?.thumbsPosXPercent,
      0,
      100,
      base.thumbsPosXPercent
    ),
    thumbsPosYPercent: clampNumber(
      input?.thumbsPosYPercent,
      0,
      100,
      base.thumbsPosYPercent
    ),
    thumbWidthPx: clampNumber(
      input?.thumbWidthPx,
      70,
      260,
      base.thumbWidthPx
    ),
    thumbHeightPx: clampNumber(
      input?.thumbHeightPx,
      100,
      320,
      base.thumbHeightPx
    ),
    thumbGapPx: clampNumber(
      input?.thumbGapPx,
      0,
      40,
      base.thumbGapPx
    ),
    thumbTiltDeg: clampNumber(
      input?.thumbTiltDeg,
      0,
      25,
      base.thumbTiltDeg
    ),

    showReview: asBool(input?.showReview, base.showReview),
    showBadge: asBool(input?.showBadge, base.showBadge),

    buttonOverlayBg: asString(input?.buttonOverlayBg, base.buttonOverlayBg),
    buttonOverlayHoverBg: asString(
      input?.buttonOverlayHoverBg,
      base.buttonOverlayHoverBg
    ),
    buttonOverlayPaddingYPx: clampNumber(
      input?.buttonOverlayPaddingYPx,
      0,
      40,
      base.buttonOverlayPaddingYPx
    ),
    buttonAnimation: ["none", "pulse", "soft-float", "hover-bounce"].includes(
      asString(input?.buttonAnimation).trim()
    )
      ? asString(input?.buttonAnimation).trim()
      : base.buttonAnimation,

    buttonTextColor: asString(input?.buttonTextColor, base.buttonTextColor),
    buttonTextHoverColor: asString(
      input?.buttonTextHoverColor,
      base.buttonTextHoverColor
    ),
    buttonFontSizePx: clampNumber(
      input?.buttonFontSizePx,
      10,
      32,
      base.buttonFontSizePx
    ),
    buttonFontWeight: ["400", "500", "600", "700", "800"].includes(
      asString(input?.buttonFontWeight).trim()
    )
      ? asString(input?.buttonFontWeight).trim()
      : base.buttonFontWeight,
    buttonRadiusPx: clampNumber(
      input?.buttonRadiusPx,
      0,
      999,
      base.buttonRadiusPx
    ),
    buttonShape: ["rounded", "pill", "square"].includes(
      asString(input?.buttonShape).trim()
    )
      ? asString(input?.buttonShape).trim()
      : base.buttonShape,

    buttonImageWidthPx: clampNumber(
      input?.buttonImageWidthPx,
      60,
      360,
      base.buttonImageWidthPx
    ),
    buttonImageWidthMobilePx: clampNumber(
      input?.buttonImageWidthMobilePx,
      50,
      240,
      base.buttonImageWidthMobilePx
    ),

    showArrows: asBool(input?.showArrows, base.showArrows),
    arrowStyle: ["luxury", "minimal", "glass", "outline"].includes(
      asString(input?.arrowStyle).trim()
    )
      ? asString(input?.arrowStyle).trim()
      : base.arrowStyle,
    arrowBg: asString(input?.arrowBg, base.arrowBg),
    arrowColor: asString(input?.arrowColor, base.arrowColor),
    arrowBorderColor: asString(
      input?.arrowBorderColor,
      base.arrowBorderColor
    ),
    arrowSizePx: clampNumber(
      input?.arrowSizePx,
      28,
      72,
      base.arrowSizePx
    ),

    showDots: asBool(input?.showDots, base.showDots),

    sliderStyle: ["classic", "coverflow-soft", "spotlight"].includes(
      asString(input?.sliderStyle).trim()
    )
      ? asString(input?.sliderStyle).trim()
      : base.sliderStyle,
  };
}

export function normalizeCategoriasSection(section = {}) {
  const base = CATEGORIAS_SECTION_DEFAULTS;

  return {
    ...base,
    ...section,
    id: CATEGORIAS_SECTION_ID,
    type: "categorias",
    name: asString(section?.name, base.name) || base.name,
    label: asString(section?.label, base.label) || base.label,
    enabled: asBool(section?.enabled, base.enabled),
    config: normalizeCategoriasSectionConfig(section?.config),
    style: normalizeCategoriasSectionStyle(section?.style),
  };
}