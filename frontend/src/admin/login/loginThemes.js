import { Blocks, Orbit, ScanLine, Type, Waves } from "lucide-react";

function theme({ id, name, description, icon, pageBg, colors, copy }) {
  return {
    id, name, description, icon, pageBg,
    titleColor: colors.surface, textColor: colors.surface, mutedColor: colors.surface,
    cardBg: colors.secondary, cardBorder: colors.accent,
    cardShadow: `0 32px 90px ${colors.primary}55`, inputBg: `${colors.surface}12`,
    inputBorder: `${colors.accent}66`, inputText: colors.surface,
    inputIconBg: `${colors.accent}22`, inputIconColor: colors.accent,
    buttonBg: colors.accent, buttonText: colors.primary,
    buttonShadow: `0 18px 45px ${colors.accent}33`, brandBadgeBg: `${colors.accent}22`,
    brandBadgeColor: colors.accent, glowColor: colors.accent, glowSoft: `${colors.accent}33`,
    glowStrong: `${colors.accent}66`, deco1: `${colors.accent}30`, deco2: `${colors.secondary}45`,
    customization: { ...colors, ...copy },
  };
}

export const LOGIN_THEMES = {
  orbit3d: theme({
    id: "orbit3d", name: "Órbita 3D", icon: Orbit,
    description: "Esferas en profundidad y movimiento espacial elegante.",
    pageBg: "radial-gradient(circle at 70% 25%, #203b73 0%, #09142f 42%, #030817 100%)",
    colors: { primary: "#07132f", secondary: "#183b73", accent: "#64f5d2", surface: "#f2fbff" },
    copy: { eyebrow: "CENTRO DE OPERACIONES", headline: "Todo tu negocio.", highlight: "En una sola órbita.", description: "Controla la operación de tu tienda desde un espacio visual, seguro y conectado.", welcomeTitle: "Acceso administrativo", welcomeSubtitle: "Ingresa para continuar gestionando tu comercio.", buttonText: "Entrar al panel" },
  }),
  liquidGlass: theme({
    id: "liquidGlass", name: "Cristal Líquido", icon: Waves,
    description: "Volúmenes translúcidos, reflejos suaves y profundidad fluida.",
    pageBg: "linear-gradient(145deg, #dff7ff 0%, #eee7ff 46%, #fff0e7 100%)",
    colors: { primary: "#16324a", secondary: "#876fd4", accent: "#ff8f70", surface: "#f8fdff" },
    copy: { eyebrow: "ESPACIO DE GESTIÓN", headline: "Claridad que fluye.", highlight: "Control sin esfuerzo.", description: "Una experiencia ligera y luminosa para administrar cualquier tipo de tienda.", welcomeTitle: "Hola de nuevo", welcomeSubtitle: "Tu espacio de trabajo está listo.", buttonText: "Continuar" },
  }),
  neonPortal: theme({
    id: "neonPortal", name: "Portal Neón", icon: ScanLine,
    description: "Umbral de luz, energía digital y acceso inmersivo.",
    pageBg: "radial-gradient(circle at center, #15204c 0%, #07091d 54%, #02030a 100%)",
    colors: { primary: "#06091c", secondary: "#30236b", accent: "#56e7ff", surface: "#f5f3ff" },
    copy: { eyebrow: "PORTAL SEGURO", headline: "Cruza al centro.", highlight: "Activa el control.", description: "Una entrada inmersiva diseñada para operaciones rápidas y decisiones precisas.", welcomeTitle: "Validar identidad", welcomeSubtitle: "Acceso exclusivo para el equipo autorizado.", buttonText: "Abrir portal" },
  }),
  editorialMotion: theme({
    id: "editorialMotion", name: "Editorial Motion", icon: Type,
    description: "Tipografía protagonista, ritmo gráfico y movimiento expresivo.",
    pageBg: "#f3eddf",
    colors: { primary: "#111111", secondary: "#d7432f", accent: "#f4d84c", surface: "#f3eddf" },
    copy: { eyebrow: "ADMINISTRACIÓN EN MOVIMIENTO", headline: "Haz que ocurra.", highlight: "Dirige con intención.", description: "Un acceso gráfico, directo y memorable para equipos que trabajan con ritmo.", welcomeTitle: "Entra al estudio", welcomeSubtitle: "Continúa construyendo tu próxima gran venta.", buttonText: "Comenzar ahora" },
  }),
  architectMono: theme({
    id: "architectMono", name: "Arquitectura Mono", icon: Blocks,
    description: "Planos, bloques flotantes y precisión minimalista.",
    pageBg: "linear-gradient(135deg, #f4f4f1 0%, #dedfd9 100%)",
    colors: { primary: "#181a18", secondary: "#5c625d", accent: "#b6ff45", surface: "#f5f5ef" },
    copy: { eyebrow: "SISTEMA DE CONTROL", headline: "Orden visible.", highlight: "Decisiones simples.", description: "Una estructura limpia y precisa que pone la operación por encima del ruido.", welcomeTitle: "Acceso al sistema", welcomeSubtitle: "Identifícate para abrir tu espacio de gestión.", buttonText: "Ingresar" },
  }),
};

export const LOGIN_LAYOUTS = {
  centeredCard: { id: "centeredCard", name: "Composición del tema", description: "Cada tema incluye su propia estructura." },
};

export const DEFAULT_LOGIN_THEME_ID = "orbit3d";
export const DEFAULT_LOGIN_LAYOUT_ID = "centeredCard";
export const CURATED_LOGIN_THEME_IDS = Object.freeze(["orbit3d", "liquidGlass", "neonPortal", "editorialMotion", "architectMono"]);

export function getLoginThemeCustomization(themeId) {
  const selected = LOGIN_THEMES[themeId] || LOGIN_THEMES[DEFAULT_LOGIN_THEME_ID];
  return { ...selected.customization };
}
