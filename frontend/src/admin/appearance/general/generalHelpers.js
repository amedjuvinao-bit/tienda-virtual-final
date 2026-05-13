// src/admin/appearance/general/generalHelpers.js

// ==============================
// ✅ DEFAULTS GLOBAL CONFIG
// ==============================

export const GLOBAL_DEFAULTS = {
  whatsapp: {
    enabled: true,
    phone: "",
    message: "",
    position: "right", // right | left
    bottomPx: 24,
    sizePx: 56,
    bgColor: "#25D366",

    // ✅ personalización visual
    useCustomImage: false,
    imageUrl: "",
    iconSizePercent: 80,
    borderRadiusPx: 999,
    borderWidthPx: 0,
    borderColor: "#25D366",
    shadow: "soft", // none | soft | strong
    animation: "none", // none | pulse | float | bounce
  },

  scrollButtons: {
    enabled: true,
    showUp: true,
    showDown: true,
    offsetTopPx: 80, // 🔥 compensación header fijo
    behavior: "smooth", // smooth | auto

    // ✅ estilo general
    position: "center", // left | center | right
    bottomPx: 24,
    gapPx: 16,
    buttonSizePx: 44,
    bgColor: "rgba(252, 231, 243, 0.5)",
    iconColor: "#D4AF37",
    borderWidthPx: 2,
    borderColor: "#D4AF37",
    borderRadiusPx: 999,
    shadow: "soft", // none | soft | strong

    // ✅ animaciones
    upAnimation: "moveUp", // none | moveUp | pulse | bounce
    downAnimation: "moveDown", // none | moveDown | pulse | bounce

    // ✅ imagen personalizada botón subir
    upUseCustomImage: false,
    upImageUrl: "",
    upImageSizePercent: 70,

    // ✅ imagen personalizada botón bajar
    downUseCustomImage: false,
    downImageUrl: "",
    downImageSizePercent: 70,
  },

  // ✅ 🔥 LOADER GLOBAL COMPLETO (CORREGIDO)
  loader: {
    enabled: true,

    // tipo y estilo
    type: "spinner", // spinner | ring | dual-ring | dots | bars | pulse | diamond | orbit
    icon: "none",

    // colores
    color: "#ec4899",
    secondaryColor: "#f9a8d4",
    backgroundColor: "#ffffff",
    textColor: "#111827",
    overlayOpacity: 100,

    // tamaño y forma
    sizePx: 64,
    strokeWidth: 4,
    shape: "circle", // circle | rounded | square
    borderRadiusPx: 999,
    gapPx: 16,

    // animación
    animation: "spin", // spin | pulse | float | bounce | breath | wave | orbit | shimmer
    speed: "normal", // slow | normal | fast
    durationMs: 1200,

    // contenido
    showLogo: false,
    logoUrl: "",
    logoSizePx: 72,

    showText: true,
    text: "Cargando...",

    // apariencia avanzada
    visualStyle: "soft", // minimal | soft | luxury | glass | dark
    shadow: "soft", // none | soft | strong | glow
  },

  layout: {
    maxWidthPx: 1280,
    sectionSpacingPx: 40,
    borderRadiusPx: 16,
  },
};

// ==============================
// ✅ SECCIONES BASE (NAVEGACIÓN)
// ==============================

export const DEFAULT_SECTION_IDS = [
  "header",
  "banner",
  "tendencia",
  "look",
  "complementos",
  "categorias",
  "instagram",
  "tiktok",
  "informacion",
  "footer",
];

// ==============================
// ✅ NORMALIZADOR GLOBAL (FIX CLAVE)
// ==============================

export function normalizeGlobalConfig(globalRaw) {
  const g = globalRaw || {};

  return {
    whatsapp: {
      ...GLOBAL_DEFAULTS.whatsapp,
      ...(typeof g.whatsapp === "object" && g.whatsapp !== null ? g.whatsapp : {}),
    },

    scrollButtons: {
      ...GLOBAL_DEFAULTS.scrollButtons,
      ...(typeof g.scrollButtons === "object" && g.scrollButtons !== null ? g.scrollButtons : {}),
    },

    loader: {
      ...GLOBAL_DEFAULTS.loader,
      ...(typeof g.loader === "object" && g.loader !== null ? g.loader : {}),
    },

    layout: {
      ...GLOBAL_DEFAULTS.layout,
      ...(typeof g.layout === "object" && g.layout !== null ? g.layout : {}),
    },
  };
}

// ==============================
// ✅ SCROLL PRECISO (IMPORTANTE)
// ==============================

export function scrollToSectionById(id, options = {}) {
  const el = document.getElementById(id);
  if (!el) return;

  const offsetTopPx = Number.isFinite(Number(options.offsetTopPx))
    ? Number(options.offsetTopPx)
    : 0;

  const behavior = options.behavior === "auto" ? "auto" : "smooth";

  const y = el.getBoundingClientRect().top + window.pageYOffset - offsetTopPx;

  window.scrollTo({
    top: y,
    behavior,
  });
}

// ==============================
// ✅ DETECTAR SECCIÓN ACTUAL
// ==============================

export function getCurrentSectionIndex(sectionIds = DEFAULT_SECTION_IDS) {
  const mid = window.scrollY + window.innerHeight / 2;

  let index = 0;

  sectionIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el && mid >= el.offsetTop) {
      index = i;
    }
  });

  return index;
}

// ==============================
// ✅ NAVEGACIÓN ENTRE SECCIONES
// ==============================

export function getNextSectionIndex(currentIndex, sectionIds) {
  return (currentIndex + 1) % sectionIds.length;
}

export function getPrevSectionIndex(currentIndex, sectionIds) {
  return (currentIndex - 1 + sectionIds.length) % sectionIds.length;
}