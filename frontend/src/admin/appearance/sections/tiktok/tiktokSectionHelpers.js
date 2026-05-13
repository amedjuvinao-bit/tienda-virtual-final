// src/admin/appearance/sections/tiktok/tiktokSectionHelpers.js

export const TIKTOK_SECTION_ID = "tiktok";

export const TIKTOK_GALLERY_MODE_OPTIONS = [
  { value: "flex-hover", label: "Galería expandible al pasar mouse" },
  { value: "grid", label: "Cuadrícula normal" },
];

export const TIKTOK_HOVER_LOGO_STYLE_OPTIONS = [
  { value: "glyph", label: "Ícono simple" },
  { value: "outline", label: "Contorno" },
  { value: "square", label: "Logo cuadrado" },
  { value: "custom-image", label: "Imagen personalizada" },
];

export const TIKTOK_LOGO_ANIMATION_OPTIONS = [
  { value: "none", label: "Sin animación" },
  { value: "pulse", label: "Pulse" },
  { value: "float", label: "Flotar" },
  { value: "bounce", label: "Bounce suave" },
  { value: "spin-slow", label: "Giro suave" },
  { value: "breathing", label: "Respiración" },
];

export const TIKTOK_WATERMARK_POSITION_OPTIONS = [
  { value: "custom", label: "Personalizada" },
  { value: "center", label: "Centro" },
  { value: "top-left", label: "Superior izquierda" },
  { value: "top-center", label: "Superior centro" },
  { value: "top-right", label: "Superior derecha" },
  { value: "middle-left", label: "Centro izquierda" },
  { value: "middle-right", label: "Centro derecha" },
  { value: "bottom-left", label: "Inferior izquierda" },
  { value: "bottom-center", label: "Inferior centro" },
  { value: "bottom-right", label: "Inferior derecha" },
];

export const TIKTOK_HOVER_LOGO_POSITION_OPTIONS = [
  { value: "center", label: "Centro" },
  { value: "top-left", label: "Superior izquierda" },
  { value: "top-center", label: "Superior centro" },
  { value: "top-right", label: "Superior derecha" },
  { value: "middle-left", label: "Centro izquierda" },
  { value: "middle-right", label: "Centro derecha" },
  { value: "bottom-left", label: "Inferior izquierda" },
  { value: "bottom-center", label: "Inferior centro" },
  { value: "bottom-right", label: "Inferior derecha" },
  { value: "custom", label: "Personalizada" },
];

export const TIKTOK_BIG_LOGO_POSITION_OPTIONS = [
  { value: "center", label: "Centro" },
  { value: "top", label: "Arriba" },
  { value: "bottom", label: "Abajo" },
  { value: "left", label: "Izquierda" },
  { value: "right", label: "Derecha" },
  { value: "top-left", label: "Superior izquierda" },
  { value: "top-right", label: "Superior derecha" },
  { value: "bottom-left", label: "Inferior izquierda" },
  { value: "bottom-right", label: "Inferior derecha" },
  { value: "custom", label: "Personalizada" },
];

export const TIKTOK_SECTION_DEFAULTS = {
  id: TIKTOK_SECTION_ID,
  type: "tiktok",
  name: "TikTok",
  label: "TikTok",
  enabled: true,

  config: {
    layout: "media-left-logo-right",

    titleText: "Síguenos en TikTok",
    titleImage: "/SeccionTikTok/tituloTIKTOK.png",
    titleAlt: "Título sección TikTok",

    titleTextColor: "#111111",
    titleFontFamily: "",
    titleFontSizePx: 28,
    titleFontWeight: 700,

    profileLink: "https://www.tiktok.com",
    profileUser: "@usuario",

    userTextColor: "#111111",
    userFontFamily: "",
    userFontSizePx: 14,
    userFontWeight: 700,

    tiktokLogo: "/SeccionTikTok/LogoTiktok.svg",
    logoSizePx: 180,

    logoAnimation: "pulse",
    logoAnimationDuration: 2.4,
    logoShrinkOnHover: true,
    logoShrinkScale: 0.88,

    bigLogoPosition: "center",
    bigLogoXPercent: 50,
    bigLogoYPercent: 50,
    bigLogoOffsetXPx: 0,
    bigLogoOffsetYPx: 0,

    columns: 3,
    gapPx: 24,
    imageHeightPx: 512,
    imageWidthPx: 288,
    borderRadiusPx: 24,

    cardBorderColor: "#D4AF37",
    cardBorderWidthPx: 2,

    overlayEnabled: true,
    overlayOpacity: 0.3,
    overlayColor: "#000000",

    hoverEffect: "zoom",
    hoverScale: 1.05,

    animation: "fade",
    animationDuration: 0.6,

    galleryMode: "grid",
    hoverExpandRatio: 3.2,
    baseCardFlex: 1,
    hoverTransitionMs: 380,
    flexMinWidthPx: 72,

    baseCardWidthPx: 288,
    hoveredCardWidthPx: 340,

    hoverLogoEnabled: true,
    hoverLogoStyle: "custom-image",
    hoverLogoImage: "/icons/Tiktok.svg",
    hoverLogoColor: "#ffffff",
    hoverLogoOpacity: 0.8,
    hoverLogoSizePx: 64,
    hoverLogoPosition: "center",
    hoverLogoXPercent: 50,
    hoverLogoYPercent: 50,

    watermarkEnabled: false,
    watermarkImage: "",
    watermarkOpacity: 0.12,
    watermarkWidthPx: 320,
    watermarkHeightPx: 320,
    watermarkSizeMode: "contain",
    watermarkPosition: "custom",
    watermarkXPercent: 50,
    watermarkYPercent: 50,
    watermarkRotateDeg: 0,
    watermarkRepeat: false,

    posts: [
      {
        id: "post_1",
        image: "",
        thumb: "",
        link: "",
        videoUrl: "",
        enabled: true,
      },
      {
        id: "post_2",
        image: "",
        thumb: "",
        link: "",
        videoUrl: "",
        enabled: true,
      },
      {
        id: "post_3",
        image: "",
        thumb: "",
        link: "",
        videoUrl: "",
        enabled: true,
      },
    ],
  },
};

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeGalleryMode(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const exists = TIKTOK_GALLERY_MODE_OPTIONS.some((opt) => opt.value === raw);
  return exists ? raw : "grid";
}

function normalizeHoverLogoStyle(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const exists = TIKTOK_HOVER_LOGO_STYLE_OPTIONS.some((opt) => opt.value === raw);
  return exists ? raw : "glyph";
}

function normalizeLogoAnimation(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const exists = TIKTOK_LOGO_ANIMATION_OPTIONS.some((opt) => opt.value === raw);
  return exists ? raw : "none";
}

function normalizeWatermarkPosition(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const exists = TIKTOK_WATERMARK_POSITION_OPTIONS.some((opt) => opt.value === raw);
  return exists ? raw : "custom";
}

function normalizeHoverLogoPosition(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const exists = TIKTOK_HOVER_LOGO_POSITION_OPTIONS.some((opt) => opt.value === raw);
  return exists ? raw : "center";
}

function normalizeBigLogoPosition(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  const exists = TIKTOK_BIG_LOGO_POSITION_OPTIONS.some((opt) => opt.value === raw);
  return exists ? raw : "center";
}

function normalizeWatermarkSizeMode(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return raw === "cover" ? "cover" : "contain";
}

export function normalizeTiktokSection(section) {
  const base = TIKTOK_SECTION_DEFAULTS;

  if (!section) return base;

  const cfg = section.config || {};

  return {
    ...base,
    ...section,

    config: {
      ...base.config,
      ...cfg,

      layout:
        typeof cfg.layout === "string" && cfg.layout.trim()
          ? cfg.layout
          : base.config.layout,

      titleText:
        typeof cfg.titleText === "string"
          ? cfg.titleText
          : base.config.titleText,

      titleImage:
        typeof cfg.titleImage === "string"
          ? cfg.titleImage
          : base.config.titleImage,

      titleAlt:
        typeof cfg.titleAlt === "string"
          ? cfg.titleAlt
          : base.config.titleAlt,

      titleTextColor:
        typeof cfg.titleTextColor === "string" && cfg.titleTextColor.trim()
          ? cfg.titleTextColor
          : base.config.titleTextColor,

      titleFontFamily:
        typeof cfg.titleFontFamily === "string"
          ? cfg.titleFontFamily
          : base.config.titleFontFamily,

      titleFontSizePx: clampNumber(
        cfg.titleFontSizePx,
        12,
        80,
        base.config.titleFontSizePx
      ),

      titleFontWeight: clampNumber(
        cfg.titleFontWeight,
        200,
        900,
        base.config.titleFontWeight
      ),

      profileLink:
        typeof cfg.profileLink === "string" && cfg.profileLink.trim()
          ? cfg.profileLink
          : base.config.profileLink,

      profileUser:
        typeof cfg.profileUser === "string"
          ? cfg.profileUser
          : base.config.profileUser,

      userTextColor:
        typeof cfg.userTextColor === "string" && cfg.userTextColor.trim()
          ? cfg.userTextColor
          : base.config.userTextColor,

      userFontFamily:
        typeof cfg.userFontFamily === "string"
          ? cfg.userFontFamily
          : base.config.userFontFamily,

      userFontSizePx: clampNumber(
        cfg.userFontSizePx,
        10,
        40,
        base.config.userFontSizePx
      ),

      userFontWeight: clampNumber(
        cfg.userFontWeight,
        200,
        900,
        base.config.userFontWeight
      ),

      tiktokLogo:
        typeof cfg.tiktokLogo === "string"
          ? cfg.tiktokLogo
          : base.config.tiktokLogo,

      logoSizePx: clampNumber(
        cfg.logoSizePx,
        24,
        420,
        base.config.logoSizePx
      ),

      logoAnimation: normalizeLogoAnimation(cfg.logoAnimation),

      logoAnimationDuration: clampNumber(
        cfg.logoAnimationDuration,
        0.6,
        8,
        base.config.logoAnimationDuration
      ),

      logoShrinkOnHover:
        typeof cfg.logoShrinkOnHover === "boolean"
          ? cfg.logoShrinkOnHover
          : base.config.logoShrinkOnHover,

      logoShrinkScale: clampNumber(
        cfg.logoShrinkScale,
        0.35,
        1,
        base.config.logoShrinkScale
      ),

      bigLogoPosition: normalizeBigLogoPosition(cfg.bigLogoPosition),

      bigLogoXPercent: clampNumber(
        cfg.bigLogoXPercent,
        0,
        100,
        base.config.bigLogoXPercent
      ),

      bigLogoYPercent: clampNumber(
        cfg.bigLogoYPercent,
        0,
        100,
        base.config.bigLogoYPercent
      ),

      bigLogoOffsetXPx: clampNumber(
        cfg.bigLogoOffsetXPx,
        -500,
        500,
        base.config.bigLogoOffsetXPx
      ),

      bigLogoOffsetYPx: clampNumber(
        cfg.bigLogoOffsetYPx,
        -500,
        500,
        base.config.bigLogoOffsetYPx
      ),

      columns: clampNumber(
        cfg.columns,
        1,
        6,
        base.config.columns
      ),

      gapPx: clampNumber(
        cfg.gapPx,
        0,
        80,
        base.config.gapPx
      ),

      imageHeightPx: clampNumber(
        cfg.imageHeightPx,
        120,
        2000,
        base.config.imageHeightPx
      ),

      imageWidthPx: clampNumber(
        cfg.imageWidthPx,
        40,
        1200,
        base.config.imageWidthPx
      ),

      borderRadiusPx: clampNumber(
        cfg.borderRadiusPx,
        0,
        80,
        base.config.borderRadiusPx
      ),

      cardBorderColor:
        typeof cfg.cardBorderColor === "string" && cfg.cardBorderColor.trim()
          ? cfg.cardBorderColor
          : base.config.cardBorderColor,

      cardBorderWidthPx: clampNumber(
        cfg.cardBorderWidthPx,
        0,
        20,
        base.config.cardBorderWidthPx
      ),

      overlayEnabled:
        typeof cfg.overlayEnabled === "boolean"
          ? cfg.overlayEnabled
          : base.config.overlayEnabled,

      overlayOpacity: clampNumber(
        cfg.overlayOpacity,
        0,
        1,
        base.config.overlayOpacity
      ),

      overlayColor:
        typeof cfg.overlayColor === "string" && cfg.overlayColor.trim()
          ? cfg.overlayColor
          : base.config.overlayColor,

      hoverEffect:
        typeof cfg.hoverEffect === "string" && cfg.hoverEffect.trim()
          ? cfg.hoverEffect
          : base.config.hoverEffect,

      hoverScale: clampNumber(
        cfg.hoverScale,
        1,
        1.3,
        base.config.hoverScale
      ),

      animation:
        typeof cfg.animation === "string" && cfg.animation.trim()
          ? cfg.animation
          : base.config.animation,

      animationDuration: clampNumber(
        cfg.animationDuration,
        0.1,
        3,
        base.config.animationDuration
      ),

      galleryMode: normalizeGalleryMode(cfg.galleryMode),

      hoverExpandRatio: clampNumber(
        cfg.hoverExpandRatio,
        1.2,
        8,
        base.config.hoverExpandRatio
      ),

      baseCardFlex: clampNumber(
        cfg.baseCardFlex,
        0.4,
        4,
        base.config.baseCardFlex
      ),

      hoverTransitionMs: clampNumber(
        cfg.hoverTransitionMs,
        120,
        1200,
        base.config.hoverTransitionMs
      ),

      flexMinWidthPx: clampNumber(
        cfg.flexMinWidthPx,
        40,
        320,
        base.config.flexMinWidthPx
      ),

      baseCardWidthPx: clampNumber(
        cfg.baseCardWidthPx,
        40,
        1200,
        base.config.baseCardWidthPx
      ),

      hoveredCardWidthPx: clampNumber(
        cfg.hoveredCardWidthPx,
        80,
        1400,
        base.config.hoveredCardWidthPx
      ),

      hoverLogoEnabled:
        typeof cfg.hoverLogoEnabled === "boolean"
          ? cfg.hoverLogoEnabled
          : base.config.hoverLogoEnabled,

      hoverLogoStyle: normalizeHoverLogoStyle(cfg.hoverLogoStyle),

      hoverLogoImage:
        typeof cfg.hoverLogoImage === "string"
          ? cfg.hoverLogoImage
          : base.config.hoverLogoImage,

      hoverLogoColor:
        typeof cfg.hoverLogoColor === "string" && cfg.hoverLogoColor.trim()
          ? cfg.hoverLogoColor
          : base.config.hoverLogoColor,

      hoverLogoOpacity: clampNumber(
        cfg.hoverLogoOpacity,
        0.05,
        1,
        base.config.hoverLogoOpacity
      ),

      hoverLogoSizePx: clampNumber(
        cfg.hoverLogoSizePx,
        20,
        220,
        base.config.hoverLogoSizePx
      ),

      hoverLogoPosition: normalizeHoverLogoPosition(cfg.hoverLogoPosition),

      hoverLogoXPercent: clampNumber(
        cfg.hoverLogoXPercent,
        0,
        100,
        base.config.hoverLogoXPercent
      ),

      hoverLogoYPercent: clampNumber(
        cfg.hoverLogoYPercent,
        0,
        100,
        base.config.hoverLogoYPercent
      ),

      watermarkEnabled:
        typeof cfg.watermarkEnabled === "boolean"
          ? cfg.watermarkEnabled
          : base.config.watermarkEnabled,

      watermarkImage:
        typeof cfg.watermarkImage === "string"
          ? cfg.watermarkImage
          : base.config.watermarkImage,

      watermarkOpacity: clampNumber(
        cfg.watermarkOpacity,
        0,
        1,
        base.config.watermarkOpacity
      ),

      watermarkWidthPx: clampNumber(
        cfg.watermarkWidthPx,
        40,
        2400,
        base.config.watermarkWidthPx
      ),

      watermarkHeightPx: clampNumber(
        cfg.watermarkHeightPx,
        40,
        2400,
        base.config.watermarkHeightPx
      ),

      watermarkSizeMode: normalizeWatermarkSizeMode(cfg.watermarkSizeMode),

      watermarkPosition: normalizeWatermarkPosition(cfg.watermarkPosition),

      watermarkXPercent: clampNumber(
        cfg.watermarkXPercent,
        0,
        100,
        base.config.watermarkXPercent
      ),

      watermarkYPercent: clampNumber(
        cfg.watermarkYPercent,
        0,
        100,
        base.config.watermarkYPercent
      ),

      watermarkRotateDeg: clampNumber(
        cfg.watermarkRotateDeg,
        -360,
        360,
        base.config.watermarkRotateDeg
      ),

      watermarkRepeat:
        typeof cfg.watermarkRepeat === "boolean"
          ? cfg.watermarkRepeat
          : base.config.watermarkRepeat,

      posts: Array.isArray(cfg.posts)
        ? cfg.posts.map((p, i) => ({
            id: p?.id || `post_${i + 1}`,
            image: p?.image || p?.thumb || "",
            thumb: p?.thumb || p?.image || "",
            link: p?.link || "",
            videoUrl: p?.videoUrl || "",
            enabled: p?.enabled !== false,
          }))
        : base.config.posts,
    },
  };
}