import { Image, Layers3, MoonStar } from "lucide-react";

function theme({ id, name, description, icon, pageBg, colors, copy }) {
  return {
    id,
    name,
    description,
    icon,
    pageBg,
    customization: { ...colors, ...copy },
  };
}

export const LOGIN_THEMES = {
  liquidGlass: theme({
    id: "liquidGlass",
    name: "Cristal Líquido",
    icon: Layers3,
    description: "Cristal luminoso, formas orgánicas y profundidad suave.",
    pageBg: "linear-gradient(145deg, #dff7ff 0%, #eee7ff 46%, #fff0e7 100%)",
    colors: { primary: "#16324a", secondary: "#876fd4", accent: "#ff8f70", surface: "#f8fdff" },
    copy: {
      eyebrow: "ESPACIO DE GESTIÓN",
      headline: "Claridad que fluye.",
      highlight: "Control sin esfuerzo.",
      description: "Una experiencia ligera y luminosa para administrar cualquier tipo de tienda.",
      welcomeTitle: "Hola de nuevo",
      welcomeSubtitle: "Tu espacio de trabajo está listo.",
      buttonText: "Continuar",
    },
  }),
  immersiveGallery: theme({
    id: "immersiveGallery",
    name: "Galería Inmersiva",
    icon: Image,
    description: "Una imagen protagonista de la tienda con acceso flotante.",
    pageBg: "linear-gradient(120deg, #111827 0%, #283548 46%, #0b1018 100%)",
    colors: { primary: "#111827", secondary: "#44546a", accent: "#e7d7bd", surface: "#f8fafc" },
    copy: {
      eyebrow: "TU NEGOCIO, EN PRIMER PLANO",
      headline: "Una entrada visual.",
      highlight: "Tu identidad primero.",
      description: "Presenta la esencia de tu tienda con una imagen propia y un acceso limpio.",
      welcomeTitle: "Bienvenido",
      welcomeSubtitle: "Ingresa para gestionar tu tienda.",
      buttonText: "Ingresar",
    },
  }),
  smokeGlass: theme({
    id: "smokeGlass",
    name: "Cristal Humo",
    icon: MoonStar,
    description: "Vidrio oscuro sobrio, reflejos discretos y acabado elegante.",
    pageBg: "linear-gradient(145deg, #07090c 0%, #161b22 48%, #050607 100%)",
    colors: { primary: "#090b0e", secondary: "#242a31", accent: "#aab8c8", surface: "#f5f7fa" },
    copy: {
      eyebrow: "COMERCIO SIN LÍMITES",
      headline: "Tu tienda,",
      highlight: "más lejos.",
      description: "Administra, crece y haz que cada decisión cuente.",
      welcomeTitle: "Acceso administrativo",
      welcomeSubtitle: "Identifícate para continuar.",
      buttonText: "Ingresar",
    },
  }),
};

export const LOGIN_LAYOUTS = {
  centeredCard: {
    id: "centeredCard",
    name: "Composición del tema",
    description: "Cada tema incluye su propia estructura.",
  },
};

export const DEFAULT_LOGIN_THEME_ID = "liquidGlass";
export const DEFAULT_LOGIN_LAYOUT_ID = "centeredCard";
export const CURATED_LOGIN_THEME_IDS = Object.freeze([
  "liquidGlass",
  "immersiveGallery",
  "smokeGlass",
]);

export function getLoginThemeCustomization(themeId) {
  const selected = LOGIN_THEMES[themeId] || LOGIN_THEMES[DEFAULT_LOGIN_THEME_ID];
  return { ...selected.customization };
}
