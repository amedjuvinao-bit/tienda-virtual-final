// src/admin/appearance/sections/complementos/complementosSectionHelpers.js
export const COMPLEMENTOS_SECTION_ID = "complementos";

export const COMPLEMENTOS_SECTION_DEFAULTS = {
  id: COMPLEMENTOS_SECTION_ID,
  type: "complementos",
  name: "Complementos Section",
  label: "Complementos",
  enabled: true,

  config: {
    imageSrc: "/ImgComplementos/ComplementosBanner.png",
    imageAlt: "Complementos",
    linkHref: "/complementos",
    buttonText: "Conócelos",
    buttonEnabled: true,

    // ✅ Ayuda para el usuario en el panel
    recommendedImageNote:
      "Tamaño recomendado: 1600 x 500 px. Usa una imagen horizontal tipo banner.",
  },

  style: {
    sectionMarginTopPx: 48,
    sectionPaddingXPx: 16,
    contentMaxWidthPx: 1152,

    imageRadiusPx: 24,
    imageBorderPx: 4,
    imageBorderColor: "#ffffff",
    imageShadow: true,

    ringWidthPx: 4,
    ringColor: "#e9d5ff",

    // ✅ Controles de tamaño de imagen
    imageWidthPercent: 100,
    imageHeightPx: 320,
    imageObjectFit: "cover",

    buttonPosXPercent: 20,
    buttonPosYPercent: 60,

    buttonBg: "rgba(255,255,255,0.85)",
    buttonTextColor: "#70464b",
    buttonRadiusPx: 12,
    buttonShadow: true,

    buttonFontSizePx: 16,
    buttonFontWeight: 600,
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

    buttonAnimation: "soft-float",
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

  return {
    imageSrc: asString(input?.imageSrc, base.imageSrc).trim() || base.imageSrc,
    imageAlt: asString(input?.imageAlt, base.imageAlt).trim() || base.imageAlt,
    linkHref: asString(input?.linkHref, base.linkHref).trim() || base.linkHref,
    buttonText: asString(input?.buttonText, base.buttonText).trim() || base.buttonText,
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

    buttonAnimation: ["none", "soft-float", "pulse"].includes(
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