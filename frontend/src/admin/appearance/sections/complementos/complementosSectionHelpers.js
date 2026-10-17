// src/admin/appearance/sections/complementos/complementosSectionHelpers.js
export const COMPLEMENTOS_SECTION_ID = "complementos";

export const COMPLEMENTOS_SECTION_DEFAULTS = {
  id: COMPLEMENTOS_SECTION_ID,
  type: "complementos",
  name: "Complementos Section",
  label: "Complementos",
  enabled: true,

  config: {
    imageSrc: "/complementos/cristal-floral-desktop.webp",
    mobileImageSrc: "/complementos/cristal-floral-mobile.webp",
    title: "Complementos",
    subtitle: "Detalles que hacen más especial cada historia",
    titleEnabled: true,
    subtitleEnabled: true,
    dividerEnabled: true,
    imageAlt: "Complementos",
    linkHref: "/complementos",
    buttonText: "Explorar complementos",
    buttonEnabled: true,

    // ✅ Ayuda para el usuario en el panel
    recommendedImageNote:
      "Tamaño recomendado: 1600 x 500 px. Usa una imagen horizontal tipo banner.",
  },

  style: {
    sectionMarginTopPx: 48,
    sectionPaddingXPx: 16,
    contentMaxWidthPx: 1440,
    layout: "frame",
    titleColor: "#701b37",
    subtitleColor: "#793249",
    titleFontFamily: "Georgia, serif",
    titleFontSizePx: 64,
    titleWeight: 400,
    subtitleFontSizePx: 14,
    subtitleLetterSpacingPx: 2,
    contentPosition: "left",
    contentAlign: "center",
    contentWidthPercent: 48,
    contentPaddingPx: 36,
    contentGapPx: 16,
    imagePositionX: 50,
    imagePositionY: 50,
    mobileImagePositionX: 50,
    mobileImagePositionY: 35,
    mobileHeightPx: 600,
    mobileTitleFontSizePx: 36,
    mobileSubtitleFontSizePx: 12,
    mobileButtonFontSizePx: 16,
    mobileContentPaddingPx: 24,
    mobileContentPosition: "bottom",
    mobileImageObjectFit: "cover",
    mobileSectionPaddingXPx: 12,
    mobileImageRadiusPx: 24,
    bannerBg: "#f3c8d0",
    frameEnabled: true,
    frameInsetPx: 18,
    frameColor: "#fff3ed",
    frameWidthPx: 1,
    frameOpacity: 85,
    panelTintPercent: 9,
    panelBlurPx: 4,
    overlayColor: "#f6d9df",
    overlayOpacity: 0,
    buttonTintPercent: 8,
    buttonBlurPx: 2,
    buttonBorderColor: "#fff4ee",
    buttonBorderPx: 1,

    imageRadiusPx: 24,
    imageBorderPx: 0,
    imageBorderColor: "#ffffff",
    imageShadow: true,

    ringWidthPx: 0,
    ringColor: "#e9d5ff",

    // ✅ Controles de tamaño de imagen
    imageWidthPercent: 100,
    imageHeightPx: 440,
    imageObjectFit: "cover",

    buttonPosXPercent: 20,
    buttonPosYPercent: 60,

    buttonBg: "#ffffff",
    buttonTextColor: "#70464b",
    buttonRadiusPx: 32,
    buttonShadow: true,

    buttonFontSizePx: 16,
    buttonFontWeight: 400,
    buttonPx: 24,
    buttonPy: 10,
    buttonGapPx: 8,

    // ✅ Hover del botón
    buttonHoverBg: "#ffffff",
    buttonHoverTextColor: "#4b2e33",
    buttonHoverScale: 1.05,
    buttonHoverShadow: true,

    // ✅ Flecha configurable
    buttonArrowStyle: "arrow-right",

    buttonAnimation: "glint",
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

export function normalizeComplementosSectionConfig(input = {}) {
  const base = COMPLEMENTOS_SECTION_DEFAULTS.config;

  const oldDefaults = ["/ImgComplementos/ComplementosBanner.png", "/SeccionComplementos/Complementos.png"];
  const source = asString(input?.imageSrc, base.imageSrc).trim() || base.imageSrc;
  const migratedDefault = oldDefaults.includes(source);
  return {
    imageSrc: migratedDefault ? base.imageSrc : source,
    mobileImageSrc: asString(input?.mobileImageSrc,
      source === base.imageSrc || migratedDefault ? base.mobileImageSrc : "").trim(),
    title: asString(input?.title, base.title),
    subtitle: asString(input?.subtitle, base.subtitle),
    titleEnabled: asBool(input?.titleEnabled, base.titleEnabled),
    subtitleEnabled: asBool(input?.subtitleEnabled, base.subtitleEnabled),
    dividerEnabled: asBool(input?.dividerEnabled, base.dividerEnabled),
    imageAlt: asString(input?.imageAlt, base.imageAlt),
    linkHref: asString(input?.linkHref, base.linkHref),
    buttonText: asString(input?.buttonText, base.buttonText),
    buttonEnabled: asBool(input?.buttonEnabled, base.buttonEnabled),

    // ✅ Texto de ayuda editable / persistente
    recommendedImageNote:
      asString(input?.recommendedImageNote, base.recommendedImageNote).trim() ||
      base.recommendedImageNote,
  };
}

export function normalizeComplementosSectionStyle(input = {}) {
  const base = COMPLEMENTOS_SECTION_DEFAULTS.style;

  return {
    ...normalizeFloralStyle(input),
    sectionMarginTopPx: clampNumber(
      input?.sectionMarginTopPx,
      0,
      200,
      base.sectionMarginTopPx
    ),
    sectionPaddingXPx: clampNumber(
      input?.sectionPaddingXPx,
      0,
      80,
      base.sectionPaddingXPx
    ),
    contentMaxWidthPx: clampNumber(
      input?.contentMaxWidthPx,
      320,
      1800,
      base.contentMaxWidthPx
    ),

    imageRadiusPx: clampNumber(
      input?.imageRadiusPx,
      0,
      48,
      base.imageRadiusPx
    ),
    imageBorderPx: clampNumber(
      input?.imageBorderPx,
      0,
      16,
      base.imageBorderPx
    ),
    imageBorderColor: asString(
      input?.imageBorderColor,
      base.imageBorderColor
    ),
    imageShadow: asBool(input?.imageShadow, base.imageShadow),

    ringWidthPx: clampNumber(
      input?.ringWidthPx,
      0,
      16,
      base.ringWidthPx
    ),
    ringColor: asString(input?.ringColor, base.ringColor),

    // ✅ Controles para manipular tamaño real de la imagen
    imageWidthPercent: clampNumber(
      input?.imageWidthPercent,
      20,
      100,
      base.imageWidthPercent
    ),
    imageHeightPx: clampNumber(
      input?.imageHeightPx,
      120,
      800,
      base.imageHeightPx
    ),
    imageObjectFit: ["cover", "contain", "fill"].includes(
      asString(input?.imageObjectFit).trim()
    )
      ? asString(input?.imageObjectFit).trim()
      : base.imageObjectFit,

    buttonPosXPercent: clampNumber(
      input?.buttonPosXPercent,
      0,
      100,
      base.buttonPosXPercent
    ),
    buttonPosYPercent: clampNumber(
      input?.buttonPosYPercent,
      0,
      100,
      base.buttonPosYPercent
    ),

    buttonBg: asString(input?.buttonBg, base.buttonBg),
    buttonTextColor: asString(
      input?.buttonTextColor,
      base.buttonTextColor
    ),
    buttonRadiusPx: clampNumber(
      input?.buttonRadiusPx,
      0,
      32,
      base.buttonRadiusPx
    ),
    buttonShadow: asBool(input?.buttonShadow, base.buttonShadow),

    buttonFontSizePx: clampNumber(
      input?.buttonFontSizePx,
      10,
      32,
      base.buttonFontSizePx
    ),
    buttonFontWeight: clampNumber(
      input?.buttonFontWeight,
      100,
      900,
      base.buttonFontWeight
    ),
    buttonPx: clampNumber(input?.buttonPx, 8, 48, base.buttonPx),
    buttonPy: clampNumber(input?.buttonPy, 6, 32, base.buttonPy),
    buttonGapPx: clampNumber(input?.buttonGapPx, 0, 24, base.buttonGapPx),

    // ✅ Hover del botón
    buttonHoverBg: asString(input?.buttonHoverBg, base.buttonHoverBg),
    buttonHoverTextColor: asString(
      input?.buttonHoverTextColor,
      base.buttonHoverTextColor
    ),
    buttonHoverScale: clampNumber(
      input?.buttonHoverScale,
      1,
      1.3,
      base.buttonHoverScale
    ),
    buttonHoverShadow: asBool(
      input?.buttonHoverShadow,
      base.buttonHoverShadow
    ),

    // ✅ Flecha configurable
    buttonArrowStyle: [
      "none",
      "arrow-right",
      "long-arrow",
      "chevron-right",
      "double-chevron",
      "spark-arrow",
      "minimal-line",
    ].includes(asString(input?.buttonArrowStyle).trim())
      ? asString(input?.buttonArrowStyle).trim()
      : base.buttonArrowStyle,

    buttonAnimation: ["none", "soft-float", "pulse", "glint"].includes(
      asString(input?.buttonAnimation).trim()
    )
      ? asString(input?.buttonAnimation).trim()
      : base.buttonAnimation,
  };
}

export function normalizeComplementosSection(section = {}) {
  const base = COMPLEMENTOS_SECTION_DEFAULTS;

  return {
    ...base,
    ...section,
    id: COMPLEMENTOS_SECTION_ID,
    type: "complementos",
    name: asString(section?.name, base.name),
    label: asString(section?.label, base.label),
    enabled: asBool(section?.enabled, base.enabled),
    config: normalizeComplementosSectionConfig(section?.config),
    style: normalizeComplementosSectionStyle(section?.style),
  };
}

// Keep navigation within a normal web URL; reject executable and protocol-relative URLs.
export function safeComplementosHref(value) {
  const href = typeof value === "string" ? value.trim() : "";
  if (/^\/(?![\/\\])[^\\\s]*$/.test(href) || /^https?:\/\/[^\s]+$/i.test(href)) return href;
  return "/complementos";
}

const FLORAL_RANGES = {
  titleFontSizePx: [20, 100], titleWeight: [100, 900], subtitleFontSizePx: [10, 28],
  subtitleLetterSpacingPx: [0, 6], contentWidthPercent: [25, 70], contentPaddingPx: [16, 80],
  contentGapPx: [4, 40], imagePositionX: [0, 100], imagePositionY: [0, 100],
  mobileImagePositionX: [0, 100], mobileImagePositionY: [0, 100], mobileHeightPx: [360, 900],
  mobileTitleFontSizePx: [20, 64], mobileSubtitleFontSizePx: [10, 24],
  mobileButtonFontSizePx: [12, 24], mobileContentPaddingPx: [16, 48],
  mobileSectionPaddingXPx: [0, 32], mobileImageRadiusPx: [0, 48],
  frameInsetPx: [0, 48], frameWidthPx: [0, 4], frameOpacity: [0, 100],
  panelTintPercent: [0, 70], panelBlurPx: [0, 20], overlayOpacity: [0, 80],
  buttonTintPercent: [0, 85], buttonBlurPx: [0, 20], buttonBorderPx: [0, 4],
};
function normalizeFloralStyle(input) {
  const base = COMPLEMENTOS_SECTION_DEFAULTS.style;
  const output = {};
  for (const [key, [min, max]] of Object.entries(FLORAL_RANGES)) {
    const value = input?.[key];
    output[key] = value == null || value === "" ? base[key] : clampNumber(value, min, max, base[key]);
  }
  for (const key of ["titleColor", "subtitleColor", "titleFontFamily", "bannerBg", "frameColor", "overlayColor", "buttonBorderColor"]) {
    output[key] = asString(input?.[key], base[key]) || base[key];
  }
  for (const [key, options] of Object.entries({
    layout: ["frame", "immersive", "floating"], contentPosition: ["left", "center", "right"],
    contentAlign: ["left", "center", "right"], mobileContentPosition: ["top", "bottom"],
    mobileImageObjectFit: ["cover", "contain"],
  })) output[key] = options.includes(input?.[key]) ? input[key] : base[key];
  output.frameEnabled = asBool(input?.frameEnabled, base.frameEnabled);
  return output;
}
