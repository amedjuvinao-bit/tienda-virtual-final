// src/admin/AppearancePage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSiteSettings, saveSiteSettings } from "../lib/siteSettingsApi";
import { applyTheme } from "../theme/applyTheme";
import GeneralPanel from "./appearance/general/GeneralPanel";
import HeaderPanel from "./appearance/header/HeaderPanel";
import { normalizeGlobalConfig } from "./appearance/general/generalHelpers";
import { API_BASE_URL } from "../config/apiBaseUrl";

// ✅ Banner separado
import BannerPanel from "./appearance/banner/BannerPanel";
import SectionsPanel from "./appearance/sections/SectionsPanel";
import FooterPanel from "./appearance/footer/FooterPanel";
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

      fontPreset: "",
      fontFamily: "",
      fontSizePx: 16,

      logoLight: "",
      logoDark: "",
      logoHeightPx: 80,

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
  const [loading, setLoading] = useState(true);
  const [serverSnapshot, setServerSnapshot] = useState(null);

  const [activeTab, setActiveTab] = useState("general");
  const [theme, setTheme] = useState(buildThemeFromServer(null));

  // ✅ Menú editable (Header)
  const [menus, setMenus] = useState(buildMenusFromServer(null));
  const [menusSnapshot, setMenusSnapshot] = useState(buildMenusFromServer(null));

  // ✅ Upload state (LOGO)
  const [logoLightFile, setLogoLightFile] = useState(null);
  const [logoDarkFile, setLogoDarkFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // ✅ Páginas dinámicas para rutas del Header
  const [dynamicPages, setDynamicPages] = useState([]);

  // ✅ Rutas reales (según tu App.jsx) + páginas dinámicas
  const routeOptions = useMemo(
    () => ({
      public: [
        { label: "Home", value: "/" },
        { label: "Lo Nuevo", value: "/lo-nuevo" },
        { label: "Carrito", value: "/carrito" },
        { label: "Favoritos", value: "/favoritos" },
        { label: "Checkout", value: "/checkout" },
        { label: "Gracias", value: "/gracias" },
        { label: "Producto (por id o slug)", value: "/producto/:id" },
        { label: "Producto corto (por id o slug)", value: "/p/:id" },

        ...dynamicPages.map((page) => ({
          label: `Página · ${page.name}`,
          value: `/pagina/${page.slug}`,
        })),
      ],
      admin: [
        { label: "Login admin", value: "/admin/login" },
        { label: "Admin · Dashboard", value: "/admin/dashboard" },
        { label: "Admin · Productos", value: "/admin/productos" },
        { label: "Admin · Productos (nuevo)", value: "/admin/productos/nuevo" },
        { label: "Admin · Productos (editar)", value: "/admin/productos/editar/:id" },
        { label: "Admin · Carritos", value: "/admin/carritos" },
        { label: "Admin · Favoritos", value: "/admin/favoritos" },
        { label: "Admin · Órdenes", value: "/admin/ordenes" },
        { label: "Admin · Apariencia", value: "/admin/apariencia" },
      ],
      util: [{ label: "Probe Site Settings", value: "/probe-site-settings" }],
    }),
    [dynamicPages]
  );

  useEffect(() => {
    (async () => {
      try {
        const settings = await fetchSiteSettings();
        const merged = buildThemeFromServer(settings?.theme);
        setTheme(merged);
        setServerSnapshot(merged);
        applyTheme(merged);

        const mergedMenus = buildMenusFromServer(settings?.menus);
        setMenus(mergedMenus);
        setMenusSnapshot(mergedMenus);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pages`);
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
    if (serverSnapshot) {
      const merged = buildThemeFromServer(serverSnapshot);
      setTheme(merged);
      applyTheme(merged);
    }
    if (menusSnapshot) {
      const mm = buildMenusFromServer(menusSnapshot);
      setMenus(mm);
    }
    setLogoLightFile(null);
    setLogoDarkFile(null);
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
    const url = `${API_BASE}/api/uploads`;
    const form = new FormData();
    form.append(fieldName, file);

    const res = await fetch(url, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Error subiendo archivo: HTTP ${res.status} ${t}`);
    }

    const data = await res.json();
    if (!data?.url) throw new Error("El backend no devolvió { url }");
    return data.url;
  };

  const onUploadLogo = async (which) => {
    try {
      const file = which === "light" ? logoLightFile : logoDarkFile;
      if (!file) {
        alert("Selecciona una imagen primero.");
        return;
      }

      setUploading(true);
      const uploadedUrl = await uploadToCloudinaryViaBackend(file, "image");

      if (which === "light") {
        setPath("header.logoLight", uploadedUrl);
        setLogoLightFile(null);
      } else {
        setPath("header.logoDark", uploadedUrl);
        setLogoDarkFile(null);
      }

      applyTheme({
        ...theme,
        header: {
          ...(theme.header || {}),
          [which === "light" ? "logoLight" : "logoDark"]: uploadedUrl,
        },
      });

      alert("Logo subido a Cloudinary ✅ (ahora dale Guardar para dejarlo fijo)");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error subiendo logo");
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    try {
      const hexOk = (v) => !v || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

      const c = theme.colors || {};
      if (![c.primary, c.secondary, c.text, c.background, c.accent].every(hexOk)) {
        alert("Revisa que todos los colores generales sean hex válidos (#RRGGBB).");
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

      if (!headerColorList.every(hexOk)) {
        alert("Revisa que los colores del Header sean hex válidos (#RRGGBB).");
        return;
      }

      const op = Number(h.bgOpacity);
      if (Number.isNaN(op) || op < 0 || op > 1) {
        alert("La transparencia del header debe estar entre 0 y 1.");
        return;
      }

      const mobileOverlayOpacity = Number(h.mobileMenuOverlayOpacity);
      if (
        Number.isNaN(mobileOverlayOpacity) ||
        mobileOverlayOpacity < 0 ||
        mobileOverlayOpacity > 1
      ) {
        alert("La opacidad del overlay del menú móvil debe estar entre 0 y 1.");
        return;
      }

      const lh = Number(h.logoHeightPx);
      if (Number.isNaN(lh) || lh < 30 || lh > 160) {
        alert("El tamaño del logo debe estar entre 30 y 160 px.");
        return;
      }

      const mobileAnimDuration = Number(h.mobileMenuAnimationDurationMs);
      if (
        Number.isNaN(mobileAnimDuration) ||
        mobileAnimDuration < 120 ||
        mobileAnimDuration > 1200
      ) {
        alert("La duración de animación del menú móvil debe estar entre 120 y 1200 ms.");
        return;
      }

      const mobileWidth = Number(h.mobileMenuWidthPercent);
      if (Number.isNaN(mobileWidth) || mobileWidth < 60 || mobileWidth > 100) {
        alert("El ancho del menú móvil debe estar entre 60% y 100%.");
        return;
      }

      // ✅ Validación básica banner (tipo + altura + sliderInterval)
      const b = theme.banner || {};
      const bannerType = String(b.type || "slider");
      if (!["slider", "image", "video"].includes(bannerType)) {
        alert("El tipo de banner debe ser: slider, image o video.");
        return;
      }
      const hm = String(b.heightMode || "auto");
      if (!["auto", "fullscreen"].includes(hm)) {
        alert("heightMode debe ser: auto o fullscreen.");
        return;
      }
      if (hm === "auto") {
        const hp = Number(b.heightPx);
        if (Number.isNaN(hp) || hp < 240 || hp > 1200) {
          alert("La altura del banner (px) debe estar entre 240 y 1200.");
          return;
        }
      }
      if (bannerType === "slider") {
        const iv = Number(b.sliderIntervalMs);
        if (Number.isFinite(iv) && (iv < 1000 || iv > 15000)) {
          alert("En slider: el intervalo (ms) debe estar entre 1000 y 15000.");
          return;
        }
        const slides = Array.isArray(b.slides) ? b.slides : [];
        const bad = slides.find((s) => s && s.image === "");
        if (bad) {
          alert("En slider: cada slide debe tener una imagen (o elimina el slide vacío).");
          return;
        }
      }

      const cleanedHeaderMenu = (menus?.header || []).map((it) => ({
        ...it,
        title: String(it?.title || "").trim(),
        type: String(it?.type || "url").trim(),
        ref: String(it?.ref || "").trim(),
        children: Array.isArray(it?.children) ? it.children : [],
      }));

      const payload = {
        theme: normalizeThemeForSave(theme), // ✅ FIX CLAVE
        menus: {
          ...(menus || {}),
          header: cleanedHeaderMenu,
        },
      };

      const saved = await saveSiteSettings(payload);

      const merged = buildThemeFromServer(saved?.theme || theme);
      setServerSnapshot(merged);
      setTheme(merged);
      applyTheme(merged);

      const mergedMenus = buildMenusFromServer(saved?.menus || payload.menus);
      setMenus(mergedMenus);
      setMenusSnapshot(mergedMenus);

      // ✅ avisar al banner (CarouselBanner.jsx) que recargue settings
      try {
        localStorage.setItem(RB_SETTINGS_TICK_KEY, String(Date.now()));
        window.dispatchEvent(new Event("rb_site_settings_updated"));
      } catch (_) {}

      alert("Apariencia guardada ✅");
    } catch (err) {
      console.error("❌ Error guardando apariencia:", err);
      alert(err.userMessage || "Error al guardar apariencia.");
    }
  };

  if (loading) return <div className="p-6">Cargando apariencia…</div>;

  // ✅ Tabs: reemplazado Home/Body por Secciones
  const tabs = [
    { id: "general", label: "General" },
    { id: "header", label: "Header" },
    { id: "banner", label: "Banner" },
    { id: "sections", label: "Secciones" },
    { id: "footer", label: "Footer" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Encabezado + Acciones */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-pink-700">Apariencia del sitio</h1>
          <p className="text-sm text-gray-600 mt-1">
            Ajusta el tema y guarda. Usa <span className="font-medium">Aplicar</span> para
            previsualizar sin guardar.
          </p>
        </div>

        <div className="hidden md:flex gap-2">
          <button
            onClick={onPreview}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200"
            type="button"
          >
            Aplicar
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700"
            type="button"
          >
            Guardar
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50"
            type="button"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Tabs arriba */}
      <div className="mb-4">
        <div className="rounded-2xl border bg-white shadow-sm p-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={
                  "px-4 py-2 rounded-xl text-sm font-medium transition " +
                  (activeTab === tab.id
                    ? "bg-pink-50 text-pink-700 border border-pink-200"
                    : "text-gray-600 hover:text-pink-600 hover:bg-gray-50 border border-transparent")
                }
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Acciones mobile */}
        <div className="md:hidden mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={onPreview}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm"
            type="button"
          >
            Aplicar
          </button>
          <button
            onClick={onSave}
            className="px-3 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 text-sm"
            type="button"
          >
            Guardar
          </button>
          <button
            onClick={onReset}
            className="px-3 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm"
            type="button"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Contenido */}
      <main className="rounded-2xl border bg-white shadow-sm min-w-0">
        <div className="p-4 md:p-5 min-w-0">
          {/* GENERAL */}
          {activeTab === "general" && <GeneralPanel theme={theme} setPath={setPath} />}

          {/* HEADER */}
          {activeTab === "header" && (
            <HeaderPanel
              theme={theme}
              setPath={setPath}
              menus={menus}
              routeOptions={routeOptions}
              uploading={uploading}
              onPreview={onPreview}
              onUploadLogo={onUploadLogo}
              setLogoLightFile={setLogoLightFile}
              setLogoDarkFile={setLogoDarkFile}
              addHeaderMenuItem={addHeaderMenuItem}
              removeHeaderMenuItem={removeHeaderMenuItem}
              moveHeaderMenuItem={moveHeaderMenuItem}
              setHeaderMenuItem={setHeaderMenuItem}
            />
          )}

          {/* ✅ BANNER */}
          {activeTab === "banner" && (
            <BannerPanel
              theme={theme}
              setPath={setPath}
              uploading={uploading}
              setUploading={setUploading}
              uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
              onPreview={onPreview}
            />
          )}

          {/* ✅ SECCIONES (reemplaza Home/Body) */}
          {activeTab === "sections" && (
            <SectionsPanel
              theme={theme}
              setPath={setPath}
              uploading={uploading}
              setUploading={setUploading}
              uploadToCloudinary={uploadToCloudinaryViaBackend}
            />
          )}

          {/* ✅ FOOTER separado */}
          {activeTab === "footer" && (
            <FooterPanel
              theme={theme}
              setPath={setPath}
              uploading={uploading}
              setUploading={setUploading}
              uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
            />
          )}
        </div>

        {/* Barra inferior sticky */}
        <div className="border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="p-3 flex flex-col md:flex-row gap-2 md:gap-3 md:items-center md:justify-end">
            <div className="text-xs text-gray-500 md:mr-auto">
              Consejo: usa <span className="font-medium">Ver cambios</span> para previsualizar y
              luego <span className="font-medium">Guardar</span>.
            </div>

            <div className="flex gap-2">
              <button
                onClick={onPreview}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200"
                type="button"
              >
                Aplicar (vista previa)
              </button>
              <button
                onClick={onSave}
                className="px-4 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700"
                type="button"
              >
                Guardar cambios
              </button>
              <button
                onClick={onReset}
                className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50"
                type="button"
              >
                Reset a valores del servidor
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
