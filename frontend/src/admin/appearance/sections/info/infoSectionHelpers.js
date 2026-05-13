// src/admin/appearance/sections/info/infoSectionHelpers.js

export const INFO_SECTION_ID = "informacion";

// 🎨 Gradientes predefinidos
export const INFO_GRADIENT_OPTIONS = [
  { value: "none", label: "Sin degradado" },
  {
    value: "pink",
    label: "Rosa elegante",
    css: "linear-gradient(135deg, #f9a8d4, #f472b6)",
  },
  {
    value: "soft-pink",
    label: "Rosa suave",
    css: "linear-gradient(135deg, #fbcfe8, #f9a8d4)",
  },
  {
    value: "rose-gold",
    label: "Rosa dorado",
    css: "linear-gradient(135deg, #fda4af, #fcd34d)",
  },
  {
    value: "peach",
    label: "Durazno",
    css: "linear-gradient(135deg, #fecdd3, #fde68a)",
  },
  {
    value: "lavender",
    label: "Lavanda",
    css: "linear-gradient(135deg, #e9d5ff, #fbcfe8)",
  },
];

// 🎬 Animaciones de entrada
export const INFO_ANIMATION_OPTIONS = [
  { value: "none", label: "Sin animación" },
  { value: "fade-in", label: "Aparecer suave" },
  { value: "fade-up", label: "Subir y aparecer" },
  { value: "zoom-in", label: "Zoom de entrada" },
  { value: "slide-left", label: "Entrar desde la izquierda" },
  { value: "slide-right", label: "Entrar desde la derecha" },
];

// 🎯 Íconos disponibles
export const INFO_ICON_OPTIONS = [
  { value: "truck", label: "Camión" },
  { value: "headset", label: "Atención" },
  { value: "store", label: "Tienda" },
];

// 🎨 Fuentes
export const INFO_FONT_OPTIONS = [
  { label: "Usar por defecto", value: "" },
  { label: "Inter", value: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Poppins", value: 'Poppins, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Montserrat", value: 'Montserrat, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Raleway", value: 'Raleway, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Nunito", value: 'Nunito, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Playfair Display", value: '"Playfair Display", Georgia, serif' },
  { label: "DM Serif Display", value: '"DM Serif Display", Georgia, serif' },
  { label: "Cormorant Garamond", value: '"Cormorant Garamond", Georgia, serif' },
  { label: "Lora", value: '"Lora", Georgia, serif' },
];

// 📦 Config por defecto
export const INFO_SECTION_DEFAULTS = {
  id: INFO_SECTION_ID,
  type: INFO_SECTION_ID,
  name: "Información",
  label: "Sección informativa",
  enabled: true,

  config: {
    // CONTENEDOR
    containerMaxWidth: 1200,
    containerMinHeight: 250,
    paddingY: 48,
    paddingX: 24,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: "#ffffff",
    shadow: true,

    // FONDO
    backgroundColor: "#f9a8d4",
    backgroundGradient: "pink",

    // ANIMACIÓN
    entranceAnimation: "none",

    // TÍTULO
    titleText: "¡Te acompañamos en cada etapa de su historia!",
    titleColor: "#ffffff",
    titleFontSize: 32,
    titleFontFamily: "",
    titleFontWeight: 700,

    // BLOQUES
    cards: [
      {
        id: "card_1",
        iconType: "lucide",
        icon: "truck",
        iconUrl: "",
        iconColor: "#ffffff",
        iconBgColor: "rgba(255,255,255,0.30)",
        iconSize: 32,
        text: "¡La magia de cada look! Directo a tu puerta, envíos a toda Colombia para acompañar cada etapa de tu princesa.",
        textColor: "#ffffff",
        textFontSize: 18,
        textFontFamily: "",
      },
      {
        id: "card_2",
        iconType: "lucide",
        icon: "headset",
        iconUrl: "",
        iconColor: "#ffffff",
        iconBgColor: "rgba(255,255,255,0.30)",
        iconSize: 32,
        text: "Te asesoramos con cariño en cada detalle. Escríbenos y hagamos magia juntas.",
        textColor: "#ffffff",
        textFontSize: 18,
        textFontFamily: "",
      },
      {
        id: "card_3",
        iconType: "lucide",
        icon: "store",
        iconUrl: "",
        iconColor: "#ffffff",
        iconBgColor: "rgba(255,255,255,0.30)",
        iconSize: 32,
        text: "¡Conoce en persona cada detalle encantador de nuestros looks!",
        textColor: "#ffffff",
        textFontSize: 18,
        textFontFamily: "",
      },
    ],
  },
};

// 🧠 Seguridad de números
export function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// 🔍 Ayuda a detectar la sección aunque venga como info o informacion
export function isInfoSection(section) {
  const id = typeof section?.id === "string" ? section.id.trim().toLowerCase() : "";
  const type = typeof section?.type === "string" ? section.type.trim().toLowerCase() : "";
  return id === "informacion" || type === "informacion" || id === "info" || type === "info";
}

// 🔧 Normalizador
export function normalizeInfoSection(section) {
  const base = structuredClone(INFO_SECTION_DEFAULTS);
  if (!section || typeof section !== "object") return base;

  const incomingConfig =
    section.config && typeof section.config === "object" ? section.config : {};

  const incomingCards = Array.isArray(incomingConfig.cards)
    ? incomingConfig.cards
    : base.config.cards;

  const validAnimationValues = INFO_ANIMATION_OPTIONS.map((item) => item.value);
  const safeAnimation = validAnimationValues.includes(incomingConfig.entranceAnimation)
    ? incomingConfig.entranceAnimation
    : base.config.entranceAnimation;

  return {
    ...base,
    ...section,
    id: isInfoSection(section) ? INFO_SECTION_ID : base.id,
    type: isInfoSection(section) ? INFO_SECTION_ID : base.type,
    name:
      typeof section.name === "string" && section.name.trim()
        ? section.name
        : base.name,
    enabled: typeof section.enabled === "boolean" ? section.enabled : base.enabled,
    config: {
      ...base.config,
      ...incomingConfig,
      containerMaxWidth: clampNumber(
        incomingConfig.containerMaxWidth ?? base.config.containerMaxWidth,
        600,
        2000
      ),
      containerMinHeight: clampNumber(
        incomingConfig.containerMinHeight ?? base.config.containerMinHeight,
        100,
        1000
      ),
      paddingY: clampNumber(incomingConfig.paddingY ?? base.config.paddingY, 0, 200),
      paddingX: clampNumber(incomingConfig.paddingX ?? base.config.paddingX, 0, 200),
      borderRadius: clampNumber(
        incomingConfig.borderRadius ?? base.config.borderRadius,
        0,
        80
      ),
      borderWidth: clampNumber(
        incomingConfig.borderWidth ?? base.config.borderWidth,
        0,
        20
      ),
      titleFontSize: clampNumber(
        incomingConfig.titleFontSize ?? base.config.titleFontSize,
        16,
        80
      ),
      titleFontWeight: clampNumber(
        incomingConfig.titleFontWeight ?? base.config.titleFontWeight,
        300,
        900
      ),
      entranceAnimation: safeAnimation,
      cards: incomingCards.slice(0, 3).map((c, i) => ({
        ...base.config.cards[i],
        ...(c || {}),
        iconSize: clampNumber(c?.iconSize ?? base.config.cards[i].iconSize, 16, 100),
        textFontSize: clampNumber(
          c?.textFontSize ?? base.config.cards[i].textFontSize,
          10,
          40
        ),
      })),
    },
  };
}

// 🎨 Obtener CSS del fondo
export function getInfoBackground(config) {
  const gradient = INFO_GRADIENT_OPTIONS.find(
    (g) => g.value === config?.backgroundGradient
  );

  if (gradient && gradient.css && config?.backgroundGradient !== "none") {
    return gradient.css;
  }

  return config?.backgroundColor || "#f9a8d4";
}