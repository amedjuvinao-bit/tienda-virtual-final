import api, { adminFetch } from '../lib/api';
// src/admin/AppearancePage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Image, LayoutTemplate, Palette, RotateCcw, Rows3, Save, Type } from "lucide-react";
import { fetchAppearanceSettings, saveSiteSettings } from "../lib/siteSettingsApi";
import { applyTheme } from "../theme/applyTheme";
import GeneralPanel from "./appearance/general/GeneralPanel";
import HeaderPanel from "./appearance/header/HeaderPanel";
import { validateHeaderMenu } from '../components/headerPresentation';
import { normalizeGlobalConfig } from "./appearance/general/generalHelpers";
import { API_BASE_URL } from "../config/apiBaseUrl";

// ✅ Banner separado
import BannerPanel from "./appearance/banner/BannerPanel";
import SectionsPanel from "./appearance/sections/SectionsPanel";
import FooterPanel from "./appearance/footer/FooterPanel";
import "./appearance/appearanceWorkspace.css";
import useAdminPermissions from './security/useAdminPermissions';
import AdminLoadingScreen from './loading/AdminLoadingScreen';
import { getRememberedAdminLoader } from './loading/adminLoaderConfig';
import {
  LOOK_SECTION_DEFAULTS,
  normalizeLookSection,
} from "./appearance/sections/look/lookSectionHelpers";

const API_BASE = API_BASE_URL;

// ✅ clave para “avisar” al frontend (CarouselBanner) que recargue settings
const RB_SETTINGS_TICK_KEY = "rb_site_settings_tick";

const Input = ({ label, ...rest }) => (
  <label className="block mb-3 min-w-0">
    <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
    <input
      className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
      {...rest}
    />
  </label>
);

const Select = ({ label, children, ...rest }) => (
  <label className="block mb-3 min-w-0">
    <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
    <select
      className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
      {...rest}
    >
      {children}
    </select>
  </label>
);

// 🔹 ColorInput seguro: nunca manda "" al input type="color"
const ColorInput = ({ value, onChange }) => {
  const isHex = (v) =>
    typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

  const safeColor = isHex(value) ? value : "#ffffff";

  return (
    <div className="grid grid-cols-[56px_1fr] gap-3 w-full min-w-0">
      <input
        type="color"
        className="h-10 w-14 rounded border"
        value={safeColor}
        onChange={onChange}
      />
      <input
        className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
        value={value || ""}
        onChange={onChange}
        placeholder="#FFFFFF"
      />
    </div>
  );
};

// ✅ botón default del banner (lo usa el normalizador)
const buildDefaultButton = () => ({
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

// ==============================
// ✅ SECCIONES BASE (Estrategia B)
// - Siempre existen estas secciones “diseñadas”
// - Si faltan en BD, se crean automáticamente
// - Si existen en BD, se respetan y NO se pisan
// - Si el usuario crea más, se permiten y quedan después
// Nota: Para “link” profesional sin rutas, usa anclas por id: #tendencia, #look, etc.
// (⚠️ Banner NO va aquí: el banner se configura por su pestaña aparte)
// ==============================
const DEFAULT_SECTION_STYLE = {
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

const BASE_SECTIONS = [
  { id: "tendencia", name: "En tendencia", title: "EN TENDENCIA", subtitle: "" },
  { id: "look", name: "Looks", title: "LOOKS", subtitle: "" },
  { id: "complementos", name: "Complementos", title: "COMPLEMENTOS", subtitle: "" },
  { id: "categorias", name: "Categorías", title: "CATEGORÍAS", subtitle: "" },
  { id: "instagram", name: "Instagram", title: "INSTAGRAM", subtitle: "" },
  { id: "tiktok", name: "TikTok", title: "TIKTOK", subtitle: "" },
  { id: "informacion", name: "Información", title: "INFORMACIÓN", subtitle: "" },
];

function buildBaseSection(base) {
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

function ensureBaseSections(inputSections) {
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

// 🔹 Normalizador: garantiza que siempre existan colors, fonts, header, footer, banner y sections
function buildThemeFromServer(themeRaw) {
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

    imagePosX: 50,
    imagePosY: 50,
    imageFit: "cover",

    imageButton: buildDefaultButton(),
    videoButton: buildDefaultButton(),

    sliderIntervalMs: 3500,
    sliderShowProgress: true,
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
      menuAnimation: "soft",

      iconColor: "",
      iconHoverColor: "",
      iconAnimation: "soft",
      iconSet: "rose",
      iconImages: { account: "", favorites: "", cart: "" },

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
      mobileMenuBgColor: "#fffdfd",
      mobileMenuTextColor: "#1f1f1f",
      mobileMenuBorderColor: "#e7c2cf",
      mobileMenuAccentColor: "#b76e79",
      mobileMenuMutedColor: "#8a6b74",
      mobileMenuTitleColor: "#1f1f1f",

      mobileMenuButtonBg: "#d8b2bf",
      mobileMenuButtonTextColor: "#7b4f5f",
      mobileMenuSecondaryButtonBg: "#ffffff",
      mobileMenuSecondaryButtonTextColor: "#9d6275",

      mobileMenuSocialBg: "#c98ea2",
      mobileMenuSocialIconColor: "#ffffff",

      mobileMenuOverlayColor: "#000000",
      mobileMenuOverlayOpacity: 0.35,

      mobileMenuFontFamily: "",
      mobileMenuAnimation: "slide-left",
      mobileMenuAnimationDurationMs: 300,
      mobileMenuWidthPercent: 88,

      ...(t.header || {}),
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
        : bannerDefaults.sliderIntervalMs,
      sliderShowProgress: bannerRaw?.sliderShowProgress !== false,
    },
  };
}

// ✅ Normalizador de menús
function buildMenusFromServer(menusRaw) {
  const m = menusRaw || {};
  return {
    header: Array.isArray(m.header) ? m.header : [],
    footer: Array.isArray(m.footer) ? m.footer : [],
  };
}

// ✅ FIX: normaliza banner antes de guardar (evita que se “pierda” al guardar secciones)
function normalizeThemeForSave(theme) {
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
  delete b.sliderShowProgress;

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

function getValueAtPath(obj, path) {
  const keys = String(path || "").split(".");
  let ref = obj;
  for (const key of keys) {
    if (ref == null) return undefined;
    ref = ref[key];
  }
  return ref;
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return false;
  }
}

export default function AppearancePage() {
  const { can } = useAdminPermissions();
  const canEditAppearance = can('appearance:update');
  const canEditSections = can('appearance:sections');
  const canEditMenus = can('appearance:menus');
  const canEditAny = canEditAppearance || canEditSections || canEditMenus;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [serverSnapshot, setServerSnapshot] = useState(null);
  const [appearanceRevision, setAppearanceRevision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const savingRef = useRef(false);

  const [activeTab, setActiveTab] = useState("general");
  const [theme, setTheme] = useState(buildThemeFromServer(null));

  // ✅ Menú editable (Header)
  const [menus, setMenus] = useState(buildMenusFromServer(null));
  const [menusSnapshot, setMenusSnapshot] = useState(buildMenusFromServer(null));

  const changedAreas = useMemo(() => {
    if (!serverSnapshot) return [];
    const current = normalizeThemeForSave(theme);
    const original = normalizeThemeForSave(serverSnapshot);
    const changed = new Set();
    for (const key of Object.keys(current)) {
      if (!deepEqual(current[key], original[key])) {
        changed.add(['header', 'banner', 'sections', 'footer'].includes(key) ? key : 'general');
      }
    }
    if (!deepEqual(menus.header, menusSnapshot.header)) changed.add('header');
    if (!deepEqual(menus.footer, menusSnapshot.footer)) changed.add('footer');
    return [...changed];
  }, [theme, serverSnapshot, menus, menusSnapshot]);

  useEffect(() => {
    if (changedAreas.length && saveMessage?.type === 'success') setSaveMessage(null);
  }, [changedAreas.length, saveMessage]);

  useEffect(() => {
    if (!changedAreas.length) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changedAreas.length]);

  const [uploading, setUploading] = useState(false);

  // ✅ Páginas dinámicas para rutas del Header
  const [dynamicPages, setDynamicPages] = useState([]);

  // ✅ Rutas reales (según tu App.jsx) + páginas dinámicas
  const routeOptions = useMemo(
    () => ({
      public: [
        { label: "Inicio", value: "/" },
        { label: "Lo Nuevo", value: "/lo-nuevo" },
        { label: "Carrito", value: "/carrito" },
        { label: "Favoritos", value: "/favoritos" },

        ...dynamicPages.map((page) => ({
          label: `Página · ${page.name}`,
          value: `/pagina/${page.slug}`,
        })),
      ],
    }),
    [dynamicPages]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const settings = await fetchAppearanceSettings();
        if (!settings?.theme || !settings?.menus ||
          !Number.isSafeInteger(settings.appearanceRevision) || settings.appearanceRevision < 0) {
          throw new Error("La configuración de apariencia llegó incompleta.");
        }
        if (cancelled) return;
        const merged = buildThemeFromServer(settings?.theme);
        setTheme(merged);
        setServerSnapshot(merged);
        setAppearanceRevision(settings.appearanceRevision);
        setSaveConflict(false);
        setSaveMessage(null);
        applyTheme(merged);

        const mergedMenus = buildMenusFromServer(settings?.menus);
        setMenus(mergedMenus);
        setMenusSnapshot(mergedMenus);
      } catch (error) {
        if (!cancelled) {
          console.error("No se pudo cargar Apariencia:", error);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadAttempt]);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch(`${API_BASE}/api/pages`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const safePages = Array.isArray(data)
          ? data
              .filter((page) => page && page.enabled !== false)
              .map((page) => ({
                _id: String(page?._id || "").trim(),
                name: String(page?.name || "").trim(),
                slug: String(page?.slug || "").trim(),
              }))
              .filter((page) => page.name && page.slug)
          : [];

        setDynamicPages(safePages);
      } catch (error) {
        console.error("❌ Error cargando páginas dinámicas para Header:", error);
        setDynamicPages([]);
      }
    })();
  }, []);

  // ✅ FIX CLAVE:
  // 1) useCallback => referencia estable para que SectionsPanel no dispare effects por identidad nueva
  // 2) no-op si el valor realmente no cambió => evita rerenders del padre innecesarios
  const setPath = useCallback((path, value) => {
    setTheme((prev) => {
      const currentValue = getValueAtPath(prev, path);
      if (deepEqual(currentValue, value)) {
        return prev;
      }

      const draft = structuredClone(prev);
      const keys = String(path || "").split(".");
      let ref = draft;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!ref[keys[i]] || typeof ref[keys[i]] !== "object") {
          ref[keys[i]] = {};
        }
        ref = ref[keys[i]];
      }

      ref[keys.at(-1)] = value;
      return draft;
    });
  }, []);

  const onPreview = () => applyTheme(theme);

  const onReset = () => {
    if (savingRef.current || saveConflict) return;
    if (serverSnapshot) {
      const merged = buildThemeFromServer(serverSnapshot);
      setTheme(merged);
      applyTheme(merged);
    }
    if (menusSnapshot) {
      const mm = buildMenusFromServer(menusSnapshot);
      setMenus(mm);
    }
    setSaveMessage(null);
  };

  // ✅ Helpers del menú header
  const setHeaderMenuItem = (index, patch) => {
    setMenus((prev) => {
      const draft = structuredClone(prev);
      if (!Array.isArray(draft.header)) draft.header = [];
      if (!draft.header[index]) return draft;
      draft.header[index] = { ...draft.header[index], ...patch };
      return draft;
    });
  };

  const addHeaderMenuItem = () => {
    setMenus((prev) => {
      const draft = structuredClone(prev);
      if (!Array.isArray(draft.header)) draft.header = [];
      draft.header.push({
        title: "Nuevo botón",
        type: "url",
        ref: "/",
        children: [],
      });
      return draft;
    });
  };

  const removeHeaderMenuItem = (index) => {
    setMenus((prev) => {
      const draft = structuredClone(prev);
      if (!Array.isArray(draft.header)) draft.header = [];
      draft.header.splice(index, 1);
      return draft;
    });
  };

  const moveHeaderMenuItem = (from, to) => {
    setMenus((prev) => {
      const draft = structuredClone(prev);
      if (!Array.isArray(draft.header)) draft.header = [];
      if (to < 0 || to >= draft.header.length) return draft;
      const item = draft.header.splice(from, 1)[0];
      draft.header.splice(to, 0, item);
      return draft;
    });
  };

  // ✅ Subir archivo a Cloudinary usando tu backend (campo por defecto: "image")
  const uploadToCloudinaryViaBackend = async (file, fieldName = "image") => {
    const form = new FormData();
    form.append(fieldName, file);

    let data;
    try {
      ({ data } = await api.post('/api/uploads', form));
    } catch (error) {
      throw new Error(error?.userMessage || error?.response?.data?.message || error?.response?.data?.error || 'No se pudo subir la imagen. Inténtalo de nuevo.');
    }

    if (!data?.url) throw new Error("El backend no devolvió { url }");
    return data.url;
  };

  const onSave = async () => {
    if (savingRef.current || saveConflict || serverSnapshot === null || appearanceRevision === null || uploading) return;
    savingRef.current = true;
    setSaving(true);
    setSaveConflict(false);
    setSaveMessage(null);
    const showValidation = (message) => setSaveMessage({ type: 'error', text: message });
    try {
      const normalizedTheme = normalizeThemeForSave(theme);
      const originalTheme = normalizeThemeForSave(serverSnapshot);
      const changedTheme = {};
      for (const key of Object.keys(normalizedTheme)) {
        if (!deepEqual(normalizedTheme[key], originalTheme[key])) {
          changedTheme[key] = normalizedTheme[key];
        }
      }

      const changedMenus = {};
      if (!deepEqual(menus.header, menusSnapshot.header)) {
        changedMenus.header = (menus.header || []).map((it) => ({
          ...it,
          title: String(it?.title || '').trim(),
          type: String(it?.type || 'url').trim(),
          ref: String(it?.ref || '').trim(),
          children: Array.isArray(it?.children) ? it.children : [],
        }));
      }
      if (!deepEqual(menus.footer, menusSnapshot.footer)) changedMenus.footer = menus.footer;

      const payload = { appearanceRevision };
      if (Object.keys(changedTheme).length) payload.theme = changedTheme;
      if (Object.keys(changedMenus).length) payload.menus = changedMenus;
      if (!payload.theme && !payload.menus) {
        setSaveMessage({ type: 'info', text: 'No hay cambios por guardar.' });
        return;
      }

      if (changedMenus.header) {
        const menuError = validateHeaderMenu(changedMenus.header);
        if (menuError) { showValidation(menuError); return; }
      }

      const hexOk = (v) => !v || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

      const c = theme.colors || {};
      if (changedTheme.colors && ![c.primary, c.secondary, c.text, c.background, c.accent].every(hexOk)) {
        showValidation("Revisa que todos los colores generales sean hex válidos (#RRGGBB).");
        return;
      }

      const h = theme.header || {};
      const headerColorList = [
        h.bgColor,
        h.textColor,
        h.linkColor,
        h.iconColor,
        h.iconHoverColor,
        h.mobileMenuBgColor,
        h.mobileMenuTextColor,
        h.mobileMenuBorderColor,
        h.mobileMenuAccentColor,
        h.mobileMenuMutedColor,
        h.mobileMenuTitleColor,
        h.mobileMenuButtonBg,
        h.mobileMenuButtonTextColor,
        h.mobileMenuSecondaryButtonBg,
        h.mobileMenuSecondaryButtonTextColor,
        h.mobileMenuSocialBg,
        h.mobileMenuSocialIconColor,
        h.mobileMenuOverlayColor,
      ];

      if (changedTheme.header && !headerColorList.every(hexOk)) {
        showValidation("Revisa que los colores del Header sean hex válidos (#RRGGBB).");
        return;
      }

      if (changedTheme.header && !['classic', 'boutique', 'atelier', 'silk', 'editorial', 'essence', 'rose', 'noir', 'custom'].includes(h.iconSet)) {
        showValidation('Selecciona un modelo válido para los íconos.');
        return;
      }
      if (changedTheme.header && h.iconSet === 'custom' && !['account', 'favorites', 'cart'].every((kind) =>
        /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(h.iconImages?.[kind] || '')
      )) {
        showValidation('Carga las tres imágenes de los iconos en Cloudinary antes de guardar.');
        return;
      }

      const op = Number(h.bgOpacity);
      if (changedTheme.header && (Number.isNaN(op) || op < 0 || op > 1)) {
        showValidation("La transparencia del header debe estar entre 0 y 1.");
        return;
      }

      const mobileOverlayOpacity = Number(h.mobileMenuOverlayOpacity);
      if (changedTheme.header && (
        Number.isNaN(mobileOverlayOpacity) ||
        mobileOverlayOpacity < 0 ||
        mobileOverlayOpacity > 1
      )) {
        showValidation("La opacidad del overlay del menú móvil debe estar entre 0 y 1.");
        return;
      }

      const lh = Number(h.logoHeightPx);
      if (changedTheme.header && (Number.isNaN(lh) || lh < 30 || lh > 160)) {
        showValidation("El tamaño del logo debe estar entre 30 y 160 px.");
        return;
      }

      if (changedTheme.header && !['attached', 'floating'].includes(h.surfaceShape)) {
        showValidation('Elige una forma válida para el encabezado.');
        return;
      }
      if (changedTheme.header && (h.liquidGlassEnabled !== true && h.liquidGlassEnabled !== false)) {
        showValidation('Revisa la opción de vidrio líquido.');
        return;
      }
      const cornerRadius = Number(h.cornerRadiusPx);
      const glassStrength = Number(h.glassStrength);
      if (changedTheme.header && (!Number.isFinite(cornerRadius) || cornerRadius < 0 || cornerRadius > 48 || !Number.isFinite(glassStrength) || glassStrength < 0 || glassStrength > 100)) {
        showValidation('El redondeo debe estar entre 0 y 48 px y la intensidad del vidrio entre 0 y 100%.');
        return;
      }

      const mobileAnimDuration = Number(h.mobileMenuAnimationDurationMs);
      if (changedTheme.header && (
        Number.isNaN(mobileAnimDuration) ||
        mobileAnimDuration < 120 ||
        mobileAnimDuration > 1200
      )) {
        showValidation("La duración de animación del menú móvil debe estar entre 120 y 1200 ms.");
        return;
      }

      const mobileWidth = Number(h.mobileMenuWidthPercent);
      if (changedTheme.header && (Number.isNaN(mobileWidth) || mobileWidth < 60 || mobileWidth > 100)) {
        showValidation("El ancho del menú móvil debe estar entre 60% y 100%.");
        return;
      }

      // ✅ Validación básica banner (tipo + altura + sliderInterval)
      const b = theme.banner || {};
      const bannerType = String(b.type || "slider");
      if (changedTheme.banner && !["slider", "image", "video"].includes(bannerType)) {
        showValidation("El tipo de banner debe ser: slider, image o video.");
        return;
      }
      const hm = String(b.heightMode || "auto");
      if (changedTheme.banner && !["auto", "fullscreen"].includes(hm)) {
        showValidation("El modo de altura del banner debe ser automático o pantalla completa.");
        return;
      }
      if (changedTheme.banner && hm === "auto") {
        const hp = Number(b.heightPx);
        if (Number.isNaN(hp) || hp < 240 || hp > 1200) {
          showValidation("La altura del banner debe estar entre 240 y 1200 px.");
          return;
        }
      }
      if (changedTheme.banner && bannerType === "slider") {
        const iv = Number(b.sliderIntervalMs);
        if (Number.isFinite(iv) && (iv < 1000 || iv > 15000)) {
          showValidation("El intervalo entre diapositivas debe estar entre 1000 y 15000 ms.");
          return;
        }
        const slides = Array.isArray(b.slides) ? b.slides : [];
        const bad = slides.find((s) => s && s.image === "");
        if (bad) {
          showValidation("Cada diapositiva debe tener una imagen; elimina las que estén vacías.");
          return;
        }
      }

      const saved = await saveSiteSettings(payload);
      if (!Number.isSafeInteger(saved?.appearanceRevision)) {
        throw new Error('La respuesta de guardado no incluyó la revisión de Apariencia. Recarga antes de guardar de nuevo.');
      }

      const merged = buildThemeFromServer(saved?.theme || theme);
      setServerSnapshot(merged);
      setAppearanceRevision(saved.appearanceRevision);
      setTheme(merged);
      applyTheme(merged);

      const mergedMenus = buildMenusFromServer(saved?.menus || menus);
      setMenus(mergedMenus);
      setMenusSnapshot(mergedMenus);

      // ✅ avisar al banner (CarouselBanner.jsx) que recargue settings
      try {
        localStorage.setItem(RB_SETTINGS_TICK_KEY, String(Date.now()));
        window.dispatchEvent(new Event("rb_site_settings_updated"));
      } catch (_) {}

      setSaveMessage({ type: 'success', text: 'Cambios guardados. La tienda pública ya usa esta configuración.' });
    } catch (err) {
      console.error("❌ Error guardando apariencia:", err);
      if (['APPEARANCE_REVISION_CONFLICT', 'APPEARANCE_REVISION_REQUIRED'].includes(err?.response?.data?.error)) {
        setSaveConflict(true);
      } else {
        setSaveMessage({ type: 'error', text: err.userMessage || err.message || 'Error al guardar apariencia.' });
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingScreen compact model={getRememberedAdminLoader()} message="Cargando Apariencia…" />;
  if (loadError) {
    return (
      <div className="admin-widget-surface mx-auto max-w-xl rounded-2xl p-6" role="alert">
        <h1 className="text-xl font-semibold">No se pudo cargar Apariencia</h1>
        <p className="mt-2 text-sm">La configuración guardada no está disponible. Vuelve a intentar para editarla sin perder el diseño vigente.</p>
        <button type="button" className="mt-4 rounded-xl px-4 py-2 font-semibold" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
          Reintentar carga
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "general", label: "General", detail: "WhatsApp y carga", icon: Palette, help: "Configura WhatsApp, navegación y pantalla de carga." },
    { id: "header", label: "Encabezado", detail: "Logo y menú", icon: LayoutTemplate, help: "Configura el logo y los enlaces del menú." },
    { id: "banner", label: "Portada", detail: "Imagen o video", icon: Image, help: "Configura la primera imagen o video que ve el cliente." },
    { id: "sections", label: "Secciones", detail: "Página de inicio", icon: Rows3, help: "Organiza el contenido debajo de la portada." },
    { id: "footer", label: "Pie de página", detail: "Datos y enlaces", icon: Type, help: "Configura la información del final de la tienda." },
  ];
  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const canEditCurrentArea = activeTab === 'sections'
    ? canEditSections
    : activeTab === 'header'
      ? canEditAppearance || canEditMenus
      : canEditAppearance;

  return (
    <div className="appearance-workspace mx-auto max-w-6xl p-4 md:p-6">
      {saveConflict && (
        <div className="admin-widget-surface rounded-2xl p-4" role="alert">
          <p>La Apariencia guardada cambió mientras editabas. Tus cambios siguen en este panel; no se sobrescribió la versión guardada.</p>
          <button type="button" className="mt-3 rounded-xl border px-4 py-2" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Cargar versión actual y descartar mis cambios
          </button>
        </div>
      )}
      <header className="appearance-workspace__header">
        <div>
          <h1>Apariencia de la tienda</h1>
          <p>{currentTab.help}</p>
        </div>
      </header>
        <nav className="appearance-navigation" aria-label="Áreas de apariencia">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="appearance-navigation__item"
                data-active={selected}
                aria-pressed={selected}
                type="button"
              >
                <TabIcon size={18} aria-hidden="true" />
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.detail}</small>
                </span>
                {changedAreas.includes(tab.id) && <span className="appearance-navigation__pending" aria-label="Cambios sin guardar" title="Cambios sin guardar" />}
              </button>
            );
          })}
        </nav>
      <div className="appearance-action-bar">
        <div className="appearance-action-bar__inner">
          <div className="appearance-action-bar__status" data-feedback={saveMessage?.type || ''} role="status" aria-live="polite">
            <span className="appearance-action-bar__marker" data-dirty={changedAreas.length > 0} />
            <div>
              <strong>{saving ? 'Guardando…' : changedAreas.length ? `${changedAreas.length} ${changedAreas.length === 1 ? 'área pendiente' : 'áreas pendientes'} por guardar` : 'Todo está guardado'}</strong>
              <small>{saveMessage ? saveMessage.text : !canEditCurrentArea ? 'Esta área es de solo lectura para tu perfil.' : changedAreas.length ? `Pendiente: ${tabs.filter((tab) => changedAreas.includes(tab.id)).map((tab) => tab.label).join(', ')}.` : 'Los cambios se publican al guardar.'}</small>
            </div>
          </div>
          <div className="appearance-action-bar__buttons">
            <button onClick={onPreview} disabled={saving || !changedAreas.length} className="appearance-action appearance-action--secondary" type="button" title="Aplica el diseño en esta pantalla sin guardarlo"><Eye size={17} /> Aplicar aquí</button>
            <button onClick={onReset} disabled={saving || saveConflict || !changedAreas.length} className="appearance-action appearance-action--secondary" type="button"><RotateCcw size={17} /> Descartar cambios</button>
            <button onClick={onSave} disabled={saving || uploading || saveConflict || !canEditAny || !changedAreas.length} className="appearance-action appearance-action--primary" type="button"><Save size={17} /> {saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <main className="appearance-workspace__editor min-w-0">
        <fieldset disabled={saving} className="min-w-0">
        <div className="min-w-0">
          {/* GENERAL */}
          {activeTab === "general" && <fieldset disabled={!canEditAppearance}><GeneralPanel
            theme={theme} setPath={setPath} uploading={uploading} setUploading={setUploading}
            savedRevision={appearanceRevision}
            uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
          /></fieldset>}

          {/* HEADER */}
          {activeTab === "header" && (
            <HeaderPanel
              theme={theme}
              setPath={setPath}
              menus={menus}
              routeOptions={routeOptions}
              uploading={uploading}
              setUploading={setUploading}
              savedRevision={appearanceRevision}
              uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
              addHeaderMenuItem={addHeaderMenuItem}
              removeHeaderMenuItem={removeHeaderMenuItem}
              moveHeaderMenuItem={moveHeaderMenuItem}
              setHeaderMenuItem={setHeaderMenuItem}
              canEditTheme={canEditAppearance}
              canEditMenus={canEditMenus}
            />
          )}

          {/* ✅ BANNER */}
          {activeTab === "banner" && (
            <fieldset disabled={!canEditAppearance}>
            <BannerPanel
              theme={theme}
              setPath={setPath}
              uploading={uploading}
              setUploading={setUploading}
              uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
              onPreview={onPreview}
            />
            </fieldset>
          )}

          {/* ✅ SECCIONES (reemplaza Home/Body) */}
          {activeTab === "sections" && (
            <fieldset disabled={!canEditSections}>
            <SectionsPanel
              theme={theme}
              setPath={setPath}
              uploading={uploading}
              setUploading={setUploading}
              uploadToCloudinary={uploadToCloudinaryViaBackend}
            />
            </fieldset>
          )}

          {/* ✅ FOOTER separado */}
          {activeTab === "footer" && (
            <fieldset disabled={!canEditAppearance}>
            <FooterPanel
              theme={theme}
              setPath={setPath}
              uploading={uploading}
              setUploading={setUploading}
              uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
            />
            </fieldset>
          )}
        </div>
        </fieldset>
      </main>
    </div>
  );
}
