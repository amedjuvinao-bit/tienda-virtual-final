import { normalizeGlobalConfig } from "./general/generalHelpers";
import { LOOK_SECTION_DEFAULTS, normalizeLookSection } from "./sections/look/lookSectionHelpers";

export const buildDefaultButton = () => ({
  enabled: true,
  kind: "image", // image | text
  imageUrl: "/ImgBotones/VerMas2.png",
  text: "",
  link: "",
  posX: 50,
  posY: 92,
  widthPx: 200,

  // animación (solo config)
  anim: "inherit", // inherit | none | fade | slideup | pop | glow | ...
  animDurationMs: 600,
  animDelayMs: 0,
});

export const DEFAULT_SECTION_STYLE = {
  bgColor: "#ffffff",
  textColor: "#111111",
  accentColor: "#d4af37",
  titleSizePx: 42,
  subtitleSizePx: 16,
  cardRadiusPx: 18,
  imageHeightPx: 260,
  spacingPx: 16,
  titleWeight: 800,
  subtitleWeight: 400,
};

export const BASE_SECTIONS = [
  { id: "tendencia", name: "En tendencia", title: "EN TENDENCIA", subtitle: "" },
  { id: "look", name: "Looks", title: "LOOKS", subtitle: "" },
  { id: "complementos", name: "Complementos", title: "COMPLEMENTOS", subtitle: "" },
  { id: "categorias", name: "Categorías", title: "CATEGORÍAS", subtitle: "" },
  { id: "instagram", name: "Instagram", title: "INSTAGRAM", subtitle: "" },
  { id: "tiktok", name: "TikTok", title: "TIKTOK", subtitle: "" },
  { id: "informacion", name: "Información", title: "INFORMACIÓN", subtitle: "" },
];

export function buildBaseSection(base) {
  if (base.id === "look") {
    return normalizeLookSection({
      ...LOOK_SECTION_DEFAULTS,
      id: "look",
      name: base.name,
      label: base.name,
      title: base.title,
      subtitle: base.subtitle,
      enabled: true,
    });
  }

  return {
    id: base.id,
    enabled: true,
    name: base.name,
    title: base.title,
    subtitle: base.subtitle,
    titleImage: "",
    style: { ...DEFAULT_SECTION_STYLE },
    items: [],
  };
}

export function ensureBaseSections(inputSections) {
  const arr = Array.isArray(inputSections) ? inputSections : [];
  const byId = new Map(
    arr
      .filter((s) => s && typeof s === "object")
      .map((s) => [String(s.id || "").trim(), s])
      .filter(([id]) => !!id)
  );

  const result = [];

  // 1) Garantiza las base en el orden correcto
  for (const base of BASE_SECTIONS) {
    const existing = byId.get(base.id);
    if (existing) {
      if (base.id === "look") {
        result.push(
          normalizeLookSection({
            ...existing,
            id: "look",
            name:
              typeof existing?.name === "string" && existing.name.trim()
                ? existing.name
                : base.name,
            label:
              typeof existing?.label === "string" && existing.label.trim()
                ? existing.label
                : base.name,
            title: typeof existing?.title === "string" ? existing.title : base.title,
            subtitle:
              typeof existing?.subtitle === "string" ? existing.subtitle : base.subtitle,
          })
        );
      } else {
        result.push(existing); // respeta lo guardado en BD
      }
    } else {
      result.push(buildBaseSection(base));
    }
  }

  // 2) Agrega secciones extra (si el usuario crea nuevas) sin borrarlas
  for (const s of arr) {
    const id = String(s?.id || "").trim();
    if (!id) continue;
    const isBase = BASE_SECTIONS.some((b) => b.id === id);
    if (!isBase) result.push(s);
  }

  return result;
}

export function buildThemeFromServer(themeRaw) {
  const t = themeRaw || {};

  const bannerRaw = t?.banner || {};

  const normalizedSlides = Array.isArray(bannerRaw?.slides)
    ? bannerRaw.slides.map((s) => ({
        image: "",
        link: "",
        posX: 50,
        posY: 50,
        fit: "cover",
        ...(s || {}),
        button: {
          ...buildDefaultButton(),
          ...(s?.button || {}),
        },
      }))
    : [];

  const normalizedImagePosX = Number.isFinite(Number(bannerRaw?.imagePosX))
    ? Number(bannerRaw.imagePosX)
    : 50;

  const normalizedImagePosY = Number.isFinite(Number(bannerRaw?.imagePosY))
    ? Number(bannerRaw.imagePosY)
    : 50;

  const normalizedImageFit = bannerRaw?.imageFit === "contain" ? "contain" : "cover";

  const bannerDefaults = {
    type: "slider", // slider | image | video
    slides: [],
    imageUrl: "",
    imageLink: "",
    videoUrl: "",
    videoAutoplay: true,
    videoMuted: true,
    videoLoop: true,
    heightMode: "auto", // auto | fullscreen
    heightPx: 520,
    tabletHeightMode: "fullscreen",
    tabletHeightPx: 1180,
    mobileHeightMode: "fullscreen",
    mobileHeightPx: 844,

    imagePosX: 50,
    imagePosY: 50,
    imageFit: "cover",

    imageButton: buildDefaultButton(),
    videoButton: buildDefaultButton(),

    sliderIntervalMs: 3500,
    sliderShowProgress: true,
    sliderShowCounter: false,
    sliderShowControls: true,
    sliderControlColor: "#ffffff",
    sliderControlTheme: "minimal",
    sliderControlPosition: "right",
    sliderControlSize: 100,
  };

  return {
    colors: {
      primary: "",
      secondary: "",
      text: "",
      background: "",
      accent: "",
      ...(t.colors || {}),
    },
    fonts: {
      base: "",
      headings: "",
      fontSize: 16,
      lineHeight: 1.6,
      ...(t.fonts || {}),
    },
    radius: {
      sm: 6,
      md: 10,
      lg: 14,
      ...(t.radius || {}),
    },
    spacing: {
      base: 8,
      ...(t.spacing || {}),
    },
    logo: {
      light: "",
      dark: "",
      ...(t.logo || {}),
    },
    favicon: t.favicon || "",
    global: normalizeGlobalConfig(t.global),

    header: {
      bgColor: "",
      bgOpacity: 1,

      textColor: "",
      linkColor: "",
      metallicMenuText: false,
      searchBgColor: "",
      searchTextColor: "",
      searchAccentColor: "",
      searchBorderColor: "",
      menuAnimation: "soft",

      iconColor: "",
      iconHoverColor: "",
      iconAnimation: "soft",
      iconImages: { account: "", favorites: "", cart: "" },
      iconSizePx: 34,

      fontPreset: "",
      fontFamily: "",
      fontSizePx: 16,

      logoLight: "",
      logoDark: "",
      logoMode: "auto",
      logoHeightPx: 80,
      surfaceShape: "attached",
      cornerRadiusPx: 16,
      liquidGlassEnabled: false,
      glassStrength: 75,

      // ✅ NUEVO: menú móvil premium
      mobileMenuBgColor: "#fff4f3",
      mobileMenuTextColor: "#4e1e39",
      mobileMenuBorderColor: "#e7c2cf",
      mobileMenuItemBorderColor: "#d2a997",
      mobileMenuAccentColor: "#ac7950",
      mobileMenuMutedColor: "#815269",
      mobileMenuTitleColor: "#1f1f1f",

      mobileMenuButtonBg: "#d8b2bf",
      mobileMenuButtonTextColor: "#7b4f5f",
      mobileMenuSecondaryButtonBg: "#ffffff",
      mobileMenuSecondaryButtonTextColor: "#9d6275",

      mobileMenuSocialBg: "#c98ea2",
      mobileMenuSocialIconColor: "#ffffff",

      mobileMenuOverlayColor: "#54233d",
      mobileMenuOverlayOpacity: 0.22,

      mobileMenuFontFamily: "",
      mobileMenuAnimation: "slide-left",
      mobileMenuAnimationDurationMs: 300,
      mobileMenuTriggerIcon: 'classic',
      mobileMenuTriggerAnimation: 'glide',
      mobileMenuTriggerBgOpacity: 30,
      mobileMenuTriggerMotionDurationMs: 440,
      mobileMenuWidthPercent: 88,
      mobileMenuLayout: 'atelier-sheet',

      ...(t.header || {}),
      iconSet: ['gold', 'wine', 'satin', 'porcelain'].includes(t.header?.iconSet) ? t.header.iconSet : 'gold',
      iconOverrides: {
        ...(t.header?.iconOverrides || {}),
        ...(t.header?.iconSet === 'custom' ? { gold: { ...(t.header?.iconImages || {}), ...(t.header?.iconOverrides?.gold || {}) } } : {}),
      },
    },

    // ✅ SECCIONES (Estrategia B)
    // - siempre existen las “base”
    // - si el usuario creó nuevas, también quedan guardadas
    sections: ensureBaseSections(t.sections),

    footer: {
      bgColor: "",
      textColor: "",
      ...(t.footer || {}),
    },

    banner: {
      ...bannerDefaults,
      ...(bannerRaw || {}),

      slides: normalizedSlides,
      imagePosX: normalizedImagePosX,
      imagePosY: normalizedImagePosY,
      imageFit: normalizedImageFit,

      imageButton: {
        ...buildDefaultButton(),
        ...(bannerRaw?.imageButton || {}),
      },
      videoButton: {
        ...buildDefaultButton(),
        ...(bannerRaw?.videoButton || {}),
      },

      sliderIntervalMs: Number.isFinite(Number(bannerRaw?.sliderIntervalMs))
        ? Number(bannerRaw.sliderIntervalMs)
        : Number.isFinite(Number(bannerRaw?.autoplayMs))
          ? Number(bannerRaw.autoplayMs)
          : bannerDefaults.sliderIntervalMs,
      sliderShowProgress: bannerRaw?.sliderShowProgress !== false,
      sliderShowCounter: bannerRaw?.sliderShowCounter === true,
      sliderShowControls: bannerRaw?.sliderShowControls !== false,
      sliderControlColor: /^#[0-9a-fA-F]{6}$/.test(bannerRaw?.sliderControlColor || '') ? bannerRaw.sliderControlColor : '#ffffff',
      sliderControlTheme: ['minimal', 'petal', 'orbit', 'editorial'].includes(bannerRaw?.sliderControlTheme) ? bannerRaw.sliderControlTheme : 'minimal',
      sliderControlPosition: ['right', 'left', 'bottom'].includes(bannerRaw?.sliderControlPosition) ? bannerRaw.sliderControlPosition : 'right',
      sliderControlSize: Number.isFinite(Number(bannerRaw?.sliderControlSize)) ? Math.max(80, Math.min(140, Number(bannerRaw.sliderControlSize))) : 100,
    },
  };
}

export function buildMenusFromServer(menusRaw) {
  const m = menusRaw || {};
  return {
    header: Array.isArray(m.header) ? m.header : [],
    footer: Array.isArray(m.footer) ? m.footer : [],
  };
}

export function normalizeThemeForSave(theme) {
  const draft = structuredClone(theme || {});
  if (!draft.banner) return draft;

  draft.sections = ensureBaseSections(draft.sections).map((section) => {
    const id = String(section?.id || "").trim().toLowerCase();
    if (id === "look") return normalizeLookSection(section);
    return section;
  });

  const b = draft.banner || {};
  const type = String(b.type || "slider");

  // ✅ FIX CLAVE (REAL): el schema de Mongo exige slides[].image (NO imageUrl)
  if (Array.isArray(b.slides)) {
    b.slides = b.slides.map((s) => {
      const slide = s || {};
      const img = slide.image || slide.imageUrl || slide.url || slide.src || "";
      const link = slide.link || slide.href || slide.to || "";
      const cleaned = { ...slide, image: img, link };

      // opcional: limpiar alias para no mandar basura (no afecta el render)
      delete cleaned.imageUrl;
      delete cleaned.url;
      delete cleaned.src;
      delete cleaned.imageURL;

      return cleaned;
    });
  }

  // UI -> Backend (el backend suele usar autoplayMs)
  const uiInterval = Number(b.sliderIntervalMs);
  if (Number.isFinite(uiInterval) && uiInterval > 0) {
    b.autoplayMs = uiInterval;
  }

  // No mandes campos solo-UI al backend (evita inconsistencias)
  delete b.sliderIntervalMs;

  // Asegura imageUrl si el tipo es imagen (por si algún panel guardó en otro nombre)
  if (type === "image") {
    if (!b.imageUrl || String(b.imageUrl).trim() === "") {
      const fallback = b.image || b.url || b.imageSrc || b.imageURL || "";
      if (fallback) b.imageUrl = fallback;
    }
  }

  // Asegura videoUrl si el tipo es video
  if (type === "video") {
    if (!b.videoUrl || String(b.videoUrl).trim() === "") {
      const fallback = b.video || b.url || b.videoSrc || b.videoURL || "";
      if (fallback) b.videoUrl = fallback;
    }
  }

  draft.banner = b;
  return draft;
}

export function getValueAtPath(obj, path) {
  const keys = String(path || "").split(".");
  let ref = obj;
  for (const key of keys) {
    if (ref == null) return undefined;
    ref = ref[key];
  }
  return ref;
}

export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return false;
  }
}
