// src/admin/configuracion/sections/PanelAdminSection.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Eye,
  Gem,
  Image as ImageIcon,
  ImageOff,
  LayoutDashboard,
  LoaderCircle,
  PanelLeft,
  RotateCcw,
  Save,
  Sparkles,
  Type,
  Undo2,
  UploadCloud,
} from 'lucide-react';
import api from '../../../lib/api';
import {
  applyAdminTheme,
  ADMIN_THEME_DEFAULT,
  getAdminThemeBuiltInBackground,
} from '../../theme/adminTheme';
import { applyAdminLayoutStyles } from '../../theme/adminLayoutStyles';
import {
  applyAdminPanelBackground,
  DEFAULT_ADMIN_PANEL_BACKGROUND,
  normalizeAdminPanelBackground,
} from '../../theme/adminPanelBackground';
import {
  ADMIN_WIDGET_TEXTURES,
  DEFAULT_ADMIN_WIDGET_TEXTURE,
  normalizeAdminWidgetTexture,
} from '../../theme/adminWidgetTexture';
import {
  ADMIN_FONT_PRESETS,
  DEFAULT_ADMIN_FONT_PRESET,
  getAdminFontPreset,
  normalizeAdminFontPreset,
} from '../../theme/adminTypography';
import './PanelAdminSection.css';

const ADMIN_THEME_PRESETS = {
  electricNeon: {
    preset: 'electricNeon',
    layout: {
      radius: 18,
      blur: 24,
      shadow: '0 20px 70px rgba(0,229,255,0.16)',
      sidebarWidth: 270,
      headerHeight: 76,
      density: 'comfortable',
    },
    primary: '#00e5ff',
    primaryHover: '#00b8d4',
    primarySoftBg: '#061826',
    primarySoftHover: '#0b2a3d',
    primarySoftBorder: '#00e5ff',
    primarySoftText: '#67e8f9',
    activeNavBg: '#083344',
    activeNavText: '#67e8f9',
    sidebarBg: '#020617',
    headerBg: '#07111f',
    pageBg: '#0f172a',
    cardBg: '#07111f',
    cardHeaderBg: '#061826',
    cardBorder: '#00e5ff',
    cardText: '#e0faff',
    cardMutedText: '#67e8f9',
    tableHeadBg: '#061826',
    tableBorder: '#0e7490',
    tableText: '#e0faff',
    tableMutedText: '#67e8f9',
    tableRowHover: '#0b2a3d',
    buttonBg: '#00e5ff',
    buttonHover: '#00b8d4',
    buttonText: '#020617',
    buttonSoftBg: '#061826',
    buttonSoftText: '#67e8f9',
    buttonSoftBorder: '#00e5ff',
    inputBg: '#020617',
    inputBorder: '#0e7490',
    inputText: '#e0faff',
    inputPlaceholder: '#67e8f9',
    inputFocus: '#00e5ff',
    modalBg: '#07111f',
    modalOverlay: 'rgba(0, 0, 0, 0.65)',
    danger: '#ff4d6d',
    dangerHover: '#ff1744',
    dangerSoftBg: '#2a0814',
    dangerText: '#ff8fa3',
    warning: '#facc15',
    warningSoftBg: '#2a2205',
    warningText: '#fde68a',
  },

  darkCyber: {
    preset: 'darkCyber',
    layout: {
      radius: 30,
      blur: 5,
      shadow: '0 5px 20px rgba(0,0,0,0.8)',
      sidebarWidth: 180,
      headerHeight: 64,
      density: 'compact',
    },
    primary: '#a855f7',
    primaryHover: '#9333ea',
    primarySoftBg: '#181026',
    primarySoftHover: '#2e1747',
    primarySoftBorder: '#7e22ce',
    primarySoftText: '#d8b4fe',
    activeNavBg: '#2e1065',
    activeNavText: '#f5d0fe',
    sidebarBg: '#09090b',
    headerBg: '#18181b',
    pageBg: '#030712',
    cardBg: '#111827',
    cardHeaderBg: '#181026',
    cardBorder: '#7e22ce',
    cardText: '#f9fafb',
    cardMutedText: '#d8b4fe',
    tableHeadBg: '#181026',
    tableBorder: '#4c1d95',
    tableText: '#f9fafb',
    tableMutedText: '#d8b4fe',
    tableRowHover: '#2e1747',
    buttonBg: '#a855f7',
    buttonHover: '#9333ea',
    buttonText: '#ffffff',
    buttonSoftBg: '#181026',
    buttonSoftText: '#d8b4fe',
    buttonSoftBorder: '#7e22ce',
    inputBg: '#09090b',
    inputBorder: '#4c1d95',
    inputText: '#f9fafb',
    inputPlaceholder: '#c084fc',
    inputFocus: '#a855f7',
    modalBg: '#111827',
    modalOverlay: 'rgba(0, 0, 0, 0.68)',
    danger: '#f43f5e',
    dangerHover: '#e11d48',
    dangerSoftBg: '#2a0f1c',
    dangerText: '#fda4af',
    warning: '#f59e0b',
    warningSoftBg: '#241806',
    warningText: '#fcd34d',
  },

  roseLuxuryLight: {
    preset: 'roseLuxuryLight',
    layout: {
      radius: 30,
      blur: 24,
      shadow: '0 24px 70px rgba(236,72,153,0.12)',
      sidebarWidth: 300,
      headerHeight: 82,
      density: 'spacious',
    },
    primary: '#ec4899',
    primaryHover: '#db2777',
    primarySoftBg: '#fdf2f8',
    primarySoftHover: '#fce7f3',
    primarySoftBorder: '#fbcfe8',
    primarySoftText: '#be185d',
    activeNavBg: '#fce7f3',
    activeNavText: '#be185d',
    sidebarBg: '#fff7fb',
    headerBg: '#ffffff',
    pageBg: '#fff1f7',
    cardBg: '#ffffff',
    cardHeaderBg: '#fdf2f8',
    cardBorder: '#fbcfe8',
    cardText: '#111827',
    cardMutedText: '#be185d',
    tableHeadBg: '#fdf2f8',
    tableBorder: '#fbcfe8',
    tableText: '#111827',
    tableMutedText: '#be185d',
    tableRowHover: '#fce7f3',
    buttonBg: '#ec4899',
    buttonHover: '#db2777',
    buttonText: '#ffffff',
    buttonSoftBg: '#fdf2f8',
    buttonSoftText: '#be185d',
    buttonSoftBorder: '#fbcfe8',
    inputBg: '#ffffff',
    inputBorder: '#fbcfe8',
    inputText: '#111827',
    inputPlaceholder: '#be185d',
    inputFocus: '#ec4899',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.4)',
    danger: '#ef4444',
    dangerHover: '#dc2626',
    dangerSoftBg: '#fef2f2',
    dangerText: '#b91c1c',
    warning: '#d97706',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },

  goldBoutiqueLight: {
    preset: 'goldBoutiqueLight',
    layout: {
      radius: 28,
      blur: 18,
      shadow: '0 22px 65px rgba(212,175,55,0.16)',
      sidebarWidth: 286,
      headerHeight: 78,
      density: 'comfortable',
    },
    primary: '#d4af37',
    primaryHover: '#b88912',
    primarySoftBg: '#fffbeb',
    primarySoftHover: '#fef3c7',
    primarySoftBorder: '#fde68a',
    primarySoftText: '#92400e',
    activeNavBg: '#fef3c7',
    activeNavText: '#92400e',
    sidebarBg: '#fffdf5',
    headerBg: '#ffffff',
    pageBg: '#fffbeb',
    cardBg: '#ffffff',
    cardHeaderBg: '#fffbeb',
    cardBorder: '#fde68a',
    cardText: '#111827',
    cardMutedText: '#92400e',
    tableHeadBg: '#fffbeb',
    tableBorder: '#fde68a',
    tableText: '#111827',
    tableMutedText: '#92400e',
    tableRowHover: '#fef3c7',
    buttonBg: '#d4af37',
    buttonHover: '#b88912',
    buttonText: '#ffffff',
    buttonSoftBg: '#fffbeb',
    buttonSoftText: '#92400e',
    buttonSoftBorder: '#fde68a',
    inputBg: '#ffffff',
    inputBorder: '#fde68a',
    inputText: '#111827',
    inputPlaceholder: '#92400e',
    inputFocus: '#d4af37',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.38)',
    danger: '#b91c1c',
    dangerHover: '#991b1b',
    dangerSoftBg: '#fef2f2',
    dangerText: '#991b1b',
    warning: '#d4af37',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },

  glassPastel: {
    preset: 'glassPastel',
    layout: {
      radius: 30,
      blur: 32,
      shadow: '0 24px 80px rgba(251,113,133,0.14)',
      sidebarWidth: 290,
      headerHeight: 80,
      density: 'spacious',
    },
    primary: '#fb7185',
    primaryHover: '#f43f5e',
    primarySoftBg: '#fff1f2',
    primarySoftHover: '#ffe4e6',
    primarySoftBorder: '#fecdd3',
    primarySoftText: '#be123c',
    activeNavBg: '#ffe4e6',
    activeNavText: '#be123c',
    sidebarBg: '#fff7fb',
    headerBg: '#ffffff',
    pageBg: '#fdf2f8',
    cardBg: '#ffffff',
    cardHeaderBg: '#fff1f2',
    cardBorder: '#fecdd3',
    cardText: '#111827',
    cardMutedText: '#be123c',
    tableHeadBg: '#fff1f2',
    tableBorder: '#fecdd3',
    tableText: '#111827',
    tableMutedText: '#be123c',
    tableRowHover: '#ffe4e6',
    buttonBg: '#fb7185',
    buttonHover: '#f43f5e',
    buttonText: '#ffffff',
    buttonSoftBg: '#fff1f2',
    buttonSoftText: '#be123c',
    buttonSoftBorder: '#fecdd3',
    inputBg: '#ffffff',
    inputBorder: '#fecdd3',
    inputText: '#111827',
    inputPlaceholder: '#be123c',
    inputFocus: '#fb7185',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.36)',
    danger: '#f43f5e',
    dangerHover: '#e11d48',
    dangerSoftBg: '#fff1f2',
    dangerText: '#be123c',
    warning: '#d97706',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },

  pearlFuture: {
    preset: 'pearlFuture',
    layout: {
      radius: 22,
      blur: 20,
      shadow: '0 20px 60px rgba(100,116,139,0.14)',
      sidebarWidth: 270,
      headerHeight: 74,
      density: 'comfortable',
    },
    primary: '#64748b',
    primaryHover: '#475569',
    primarySoftBg: '#f8fafc',
    primarySoftHover: '#e2e8f0',
    primarySoftBorder: '#cbd5e1',
    primarySoftText: '#334155',
    activeNavBg: '#e2e8f0',
    activeNavText: '#334155',
    sidebarBg: '#ffffff',
    headerBg: '#f8fafc',
    pageBg: '#eef2ff',
    cardBg: '#ffffff',
    cardHeaderBg: '#f8fafc',
    cardBorder: '#cbd5e1',
    cardText: '#111827',
    cardMutedText: '#334155',
    tableHeadBg: '#f8fafc',
    tableBorder: '#cbd5e1',
    tableText: '#111827',
    tableMutedText: '#334155',
    tableRowHover: '#e2e8f0',
    buttonBg: '#64748b',
    buttonHover: '#475569',
    buttonText: '#ffffff',
    buttonSoftBg: '#f8fafc',
    buttonSoftText: '#334155',
    buttonSoftBorder: '#cbd5e1',
    inputBg: '#ffffff',
    inputBorder: '#cbd5e1',
    inputText: '#111827',
    inputPlaceholder: '#64748b',
    inputFocus: '#64748b',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(15, 23, 42, 0.36)',
    danger: '#dc2626',
    dangerHover: '#b91c1c',
    dangerSoftBg: '#fef2f2',
    dangerText: '#991b1b',
    warning: '#ca8a04',
    warningSoftBg: '#fefce8',
    warningText: '#854d0e',
  },

  neonRoseLight: {
    preset: 'neonRoseLight',
    layout: {
      radius: 30,
      blur: 26,
      shadow: '0 24px 80px rgba(255,45,149,0.18)',
      sidebarWidth: 300,
      headerHeight: 84,
      density: 'spacious',
    },
    primary: '#ff2d95',
    primaryHover: '#e60073',
    primarySoftBg: '#fff0f8',
    primarySoftHover: '#ffd6ec',
    primarySoftBorder: '#ff9bd2',
    primarySoftText: '#c2186a',
    activeNavBg: '#ffd6ec',
    activeNavText: '#c2186a',
    sidebarBg: '#fff5fb',
    headerBg: '#ffffff',
    pageBg: '#ffeaf5',
    cardBg: '#ffffff',
    cardHeaderBg: '#fff0f8',
    cardBorder: '#ff9bd2',
    cardText: '#111827',
    cardMutedText: '#c2186a',
    tableHeadBg: '#fff0f8',
    tableBorder: '#ff9bd2',
    tableText: '#111827',
    tableMutedText: '#c2186a',
    tableRowHover: '#ffd6ec',
    buttonBg: '#ff2d95',
    buttonHover: '#e60073',
    buttonText: '#ffffff',
    buttonSoftBg: '#fff0f8',
    buttonSoftText: '#c2186a',
    buttonSoftBorder: '#ff9bd2',
    inputBg: '#ffffff',
    inputBorder: '#ff9bd2',
    inputText: '#111827',
    inputPlaceholder: '#c2186a',
    inputFocus: '#ff2d95',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.38)',
    danger: '#ff2d55',
    dangerHover: '#e60033',
    dangerSoftBg: '#fff0f3',
    dangerText: '#c2183f',
    warning: '#f59e0b',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },

  minimalPro: {
    preset: 'minimalPro',
    layout: {
      radius: 12,
      blur: 8,
      shadow: '0 10px 30px rgba(17,24,39,0.08)',
      sidebarWidth: 245,
      headerHeight: 64,
      density: 'compact',
    },
    primary: '#111827',
    primaryHover: '#374151',
    primarySoftBg: '#f3f4f6',
    primarySoftHover: '#e5e7eb',
    primarySoftBorder: '#d1d5db',
    primarySoftText: '#111827',
    activeNavBg: '#e5e7eb',
    activeNavText: '#111827',
    sidebarBg: '#ffffff',
    headerBg: '#ffffff',
    pageBg: '#f3f4f6',
    cardBg: '#ffffff',
    cardHeaderBg: '#f9fafb',
    cardBorder: '#d1d5db',
    cardText: '#111827',
    cardMutedText: '#6b7280',
    tableHeadBg: '#f9fafb',
    tableBorder: '#d1d5db',
    tableText: '#111827',
    tableMutedText: '#6b7280',
    tableRowHover: '#f3f4f6',
    buttonBg: '#111827',
    buttonHover: '#374151',
    buttonText: '#ffffff',
    buttonSoftBg: '#f3f4f6',
    buttonSoftText: '#111827',
    buttonSoftBorder: '#d1d5db',
    inputBg: '#ffffff',
    inputBorder: '#d1d5db',
    inputText: '#111827',
    inputPlaceholder: '#6b7280',
    inputFocus: '#111827',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.36)',
    danger: '#ef4444',
    dangerHover: '#dc2626',
    dangerSoftBg: '#fef2f2',
    dangerText: '#b91c1c',
    warning: '#d97706',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },

  azureHorizonLight: {
    preset: 'azureHorizonLight',
    layout: {
      radius: 24,
      blur: 26,
      shadow: '0 24px 70px rgba(37,99,235,0.15)',
      sidebarWidth: 278,
      headerHeight: 76,
      density: 'comfortable',
    },
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primarySoftBg: '#eff6ff',
    primarySoftHover: '#dbeafe',
    primarySoftBorder: '#bfdbfe',
    primarySoftText: '#1e40af',
    activeNavBg: '#dbeafe',
    activeNavText: '#1e3a8a',
    sidebarBg: '#f7fbff',
    headerBg: '#f8fbff',
    pageBg: '#eaf5ff',
    cardBg: '#f9fcff',
    cardHeaderBg: '#eff6ff',
    cardBorder: '#b9ddff',
    cardText: '#0f2742',
    cardMutedText: '#49677f',
    tableHeadBg: '#eaf4ff',
    tableBorder: '#b9ddff',
    tableText: '#0f2742',
    tableMutedText: '#49677f',
    tableRowHover: '#e0efff',
    buttonBg: '#2563eb',
    buttonHover: '#1d4ed8',
    buttonText: '#ffffff',
    buttonSoftBg: '#eff6ff',
    buttonSoftText: '#1e40af',
    buttonSoftBorder: '#bfdbfe',
    inputBg: '#fafdff',
    inputBorder: '#b9ddff',
    inputText: '#0f2742',
    inputPlaceholder: '#66839c',
    inputFocus: '#2563eb',
    modalBg: '#f8fbff',
    modalOverlay: 'rgba(15, 55, 95, 0.28)',
    danger: '#e11d48',
    dangerHover: '#be123c',
    dangerSoftBg: '#fff1f2',
    dangerText: '#9f1239',
    warning: '#d97706',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },
};

const DEFAULT_PANEL_SELECTION = Object.freeze({
  preset: 'systemDefault',
  sidebar: 'expanded',
  widgetTexture: DEFAULT_ADMIN_WIDGET_TEXTURE,
  fontPreset: DEFAULT_ADMIN_FONT_PRESET,
  background: DEFAULT_ADMIN_PANEL_BACKGROUND,
});

const ADMIN_BACKGROUND_MAX_BYTES = 8 * 1024 * 1024;
const ADMIN_BACKGROUND_FORMATS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function inspectImageDimensions(file) {
  if (
    typeof globalThis.Image !== 'function' ||
    typeof globalThis.URL?.createObjectURL !== 'function'
  ) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const objectUrl = globalThis.URL.createObjectURL(file);
    const image = new globalThis.Image();
    const finish = (dimensions) => {
      globalThis.URL.revokeObjectURL(objectUrl);
      resolve(dimensions);
    };

    image.onload = () =>
      finish({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => finish(null);
    image.src = objectUrl;
  });
}

const ADMIN_THEME_OPTIONS = [
  {
    value: 'systemDefault',
    label: 'Clásico del sistema',
    description: 'Geometría equilibrada, jerarquía limpia y navegación familiar.',
  },
  {
    value: 'roseLuxuryLight',
    label: 'Rosa luxury',
    description: 'Composición editorial, curvas couture y brillo de boutique.',
  },
  {
    value: 'goldBoutiqueLight',
    label: 'Dorado boutique',
    description: 'Marcos interiores, ritmo clásico y detalles tipo joyería.',
  },
  {
    value: 'glassPastel',
    label: 'Glass pastel',
    description: 'Capas flotantes, profundidad aérea y superficies luminosas.',
  },
  {
    value: 'pearlFuture',
    label: 'Perla futurista',
    description: 'Retícula técnica, precisión visual y lectura enfocada.',
  },
  {
    value: 'neonRoseLight',
    label: 'Rosa neón',
    description: 'Navegación con pulso, halos activos y energía controlada.',
  },
  {
    value: 'minimalPro',
    label: 'Minimal pro',
    description: 'Volumen reducido, líneas finas y máxima densidad útil.',
  },
  {
    value: 'electricNeon',
    label: 'Neón eléctrico',
    description: 'Retícula digital, bordes luminosos y profundidad eléctrica.',
  },
  {
    value: 'darkCyber',
    label: 'Oscuro cyber',
    description: 'Trama escaneada, bordes laterales y capas violetas profundas.',
  },
  {
    value: 'azureHorizonLight',
    label: 'Horizonte azul',
    description: 'Arquitectura cristalina, curvas fluidas y profundidad serena.',
  },
];

const SIDEBAR_OPTIONS = [
  {
    value: 'compact',
    label: 'Compacto',
    description: 'Más espacio para tablas y operaciones.',
  },
  {
    value: 'balanced',
    label: 'Equilibrado',
    description: 'Proporción cómoda para la mayoría de pantallas.',
  },
  {
    value: 'expanded',
    label: 'Amplio',
    description: 'Mayor separación y lectura más descansada.',
  },
];

function buildThemeWithSidebar(baseTheme, sidebarStyle) {
  const safeTheme = baseTheme || ADMIN_THEME_DEFAULT;
  const baseLayout = safeTheme.layout || {};

  if (sidebarStyle === 'compact') {
    return {
      ...safeTheme,
      layout: {
        ...baseLayout,
        sidebarWidth: 220,
        density: 'compact',
      },
    };
  }

  if (sidebarStyle === 'expanded') {
    return {
      ...safeTheme,
      layout: {
        ...baseLayout,
        sidebarWidth: 310,
        density: 'spacious',
      },
    };
  }

  if (sidebarStyle === 'balanced') {
    return {
      ...safeTheme,
      layout: {
        ...baseLayout,
        sidebarWidth: 270,
        density: 'comfortable',
      },
    };
  }

  return safeTheme;
}

function resolveTheme(
  preset,
  sidebar,
  widgetTexture = DEFAULT_ADMIN_WIDGET_TEXTURE,
  fontPreset = DEFAULT_ADMIN_FONT_PRESET
) {
  const baseTheme =
    preset === 'systemDefault'
      ? ADMIN_THEME_DEFAULT
      : ADMIN_THEME_PRESETS[preset] || ADMIN_THEME_DEFAULT;

  return {
    ...buildThemeWithSidebar(baseTheme, sidebar),
    preset,
    widgetTexture: normalizeAdminWidgetTexture(widgetTexture),
    fontPreset: normalizeAdminFontPreset(fontPreset),
  };
}

function applySelection(selection) {
  const nextTheme = resolveTheme(
    selection.preset,
    selection.sidebar,
    selection.widgetTexture,
    selection.fontPreset
  );
  applyAdminTheme(nextTheme);
  applyAdminLayoutStyles(nextTheme);
  applyAdminPanelBackground(selection.background);
  return nextTheme;
}

function applyThemeObject(theme, background = DEFAULT_ADMIN_PANEL_BACKGROUND) {
  applyAdminTheme(theme);
  applyAdminLayoutStyles(theme);
  applyAdminPanelBackground(background);
}

function selectionFromAdmin(admin = {}) {
  const savedPreset = admin?.theme?.preset;
  const preset = ADMIN_THEME_OPTIONS.some((item) => item.value === savedPreset)
    ? savedPreset
    : DEFAULT_PANEL_SELECTION.preset;
  const sidebar = SIDEBAR_OPTIONS.some((item) => item.value === admin?.sidebar)
    ? admin.sidebar
    : DEFAULT_PANEL_SELECTION.sidebar;
  const widgetTexture = normalizeAdminWidgetTexture(admin?.theme?.widgetTexture);
  const fontPreset = normalizeAdminFontPreset(admin?.theme?.fontPreset);
  const background = normalizeAdminPanelBackground(admin?.background);

  return { preset, sidebar, widgetTexture, fontPreset, background };
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.userMessage ||
    error?.message ||
    'No fue posible guardar la apariencia. Inténtalo nuevamente.'
  );
}

export default function PanelAdminSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [savedSelection, setSavedSelection] = useState(DEFAULT_PANEL_SELECTION);
  const [draftSelection, setDraftSelection] = useState(DEFAULT_PANEL_SELECTION);
  const [feedback, setFeedback] = useState(null);
  const savedSelectionRef = useRef(DEFAULT_PANEL_SELECTION);
  const savedThemeRef = useRef(
    resolveTheme(
      DEFAULT_PANEL_SELECTION.preset,
      DEFAULT_PANEL_SELECTION.sidebar,
      DEFAULT_PANEL_SELECTION.widgetTexture,
      DEFAULT_PANEL_SELECTION.fontPreset
    )
  );

  const dirty =
    draftSelection.preset !== savedSelection.preset ||
    draftSelection.sidebar !== savedSelection.sidebar ||
    draftSelection.widgetTexture !== savedSelection.widgetTexture ||
    draftSelection.fontPreset !== savedSelection.fontPreset ||
    draftSelection.background.enabled !== savedSelection.background.enabled ||
    draftSelection.background.image !== savedSelection.background.image;

  const selectedThemeOption = useMemo(
    () =>
      ADMIN_THEME_OPTIONS.find((item) => item.value === draftSelection.preset) ||
      ADMIN_THEME_OPTIONS[0],
    [draftSelection.preset]
  );

  const selectedTheme = useMemo(
    () =>
      resolveTheme(
        draftSelection.preset,
        draftSelection.sidebar,
        draftSelection.widgetTexture,
        draftSelection.fontPreset
      ),
    [draftSelection]
  );

  const selectedThemeBackground = getAdminThemeBuiltInBackground(
    draftSelection.preset
  );

  const selectedTextureOption = useMemo(
    () =>
      ADMIN_WIDGET_TEXTURES.find(
        (item) => item.value === draftSelection.widgetTexture
      ) || ADMIN_WIDGET_TEXTURES[0],
    [draftSelection.widgetTexture]
  );

  const selectedFontOption = useMemo(
    () => getAdminFontPreset(draftSelection.fontPreset),
    [draftSelection.fontPreset]
  );

  useEffect(() => {
    let active = true;

    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await api.get('/api/site-settings/admin');

        if (!active) return;

        const admin = res?.data?.admin || {};
        const selection = selectionFromAdmin(admin);
        const persistedTheme =
          admin?.theme && Object.keys(admin.theme).length
            ? admin.theme
            : resolveTheme(
                selection.preset,
                selection.sidebar,
                selection.widgetTexture,
                selection.fontPreset
              );

        setSavedSelection(selection);
        setDraftSelection(selection);
        savedSelectionRef.current = selection;
        savedThemeRef.current = persistedTheme;
        applyThemeObject(persistedTheme, selection.background);
      } catch (error) {
        if (!active) return;
        setFeedback({ type: 'error', text: getErrorMessage(error) });
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchSettings();

    return () => {
      active = false;
      applyThemeObject(
        savedThemeRef.current,
        savedSelectionRef.current.background
      );
    };
  }, []);

  const previewSelection = (nextSelection) => {
    setDraftSelection(nextSelection);
    setFeedback(null);
    applySelection(nextSelection);
  };

  const handleBackgroundUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ADMIN_BACKGROUND_FORMATS.has(file.type)) {
      setFeedback({
        type: 'error',
        text: 'Formato no permitido. Usa una imagen JPG, PNG o WebP.',
      });
      return;
    }

    if (file.size > ADMIN_BACKGROUND_MAX_BYTES) {
      setFeedback({
        type: 'error',
        text: 'La imagen supera 8 MB. Optimízala antes de volver a cargarla.',
      });
      return;
    }

    try {
      setUploadingBackground(true);
      setFeedback({ type: 'info', text: 'Subiendo fondo seguro a Cloudinary…' });
      const dimensions = await inspectImageDimensions(file);
      const form = new FormData();
      form.append('image', file);
      const response = await api.post(
        '/api/uploads?profile=admin-panel-background',
        form,
        { timeout: 60000 }
      );
      const background = normalizeAdminPanelBackground({
        enabled: true,
        image: response?.data?.url,
      });

      if (!background.image) {
        throw new Error('El servidor no devolvió una URL válida de Cloudinary.');
      }

      previewSelection({ ...draftSelection, background });

      const lowResolution =
        dimensions && (dimensions.width < 1920 || dimensions.height < 1080);
      setFeedback({
        type: lowResolution ? 'info' : 'success',
        text: dimensions
          ? lowResolution
            ? `Fondo cargado (${dimensions.width} × ${dimensions.height} px). Se verá mejor con mínimo 1920 × 1080 px. Guarda para aplicarlo definitivamente.`
            : `Fondo cargado (${dimensions.width} × ${dimensions.height} px). Guarda para aplicarlo definitivamente.`
          : 'Fondo cargado en Cloudinary. Guarda para aplicarlo definitivamente.',
      });
    } catch (error) {
      setFeedback({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleBackgroundRemove = () => {
    previewSelection({
      ...draftSelection,
      background: DEFAULT_ADMIN_PANEL_BACKGROUND,
    });
    setFeedback({
      type: 'info',
      text: 'El fondo se quitó de la vista previa. Guarda para confirmar el cambio.',
    });
  };

  const handleSave = async () => {
    if (!dirty || saving) return;

    const previousSelection = savedSelection;
    const requestedTheme = resolveTheme(
      draftSelection.preset,
      draftSelection.sidebar,
      draftSelection.widgetTexture,
      draftSelection.fontPreset
    );

    try {
      setSaving(true);
      setFeedback({ type: 'info', text: 'Guardando apariencia…' });
      const response = await api.put('/api/site-settings', {
        admin: {
          theme: requestedTheme,
          sidebar: draftSelection.sidebar,
          background: draftSelection.background,
        },
      });

      const confirmedAdmin = response?.data?.admin || {};
      const confirmedTheme = confirmedAdmin.theme || requestedTheme;
      const confirmedSelection = selectionFromAdmin({
        theme: confirmedTheme,
        sidebar: confirmedAdmin.sidebar || draftSelection.sidebar,
        background: confirmedAdmin.background || draftSelection.background,
      });

      setSavedSelection(confirmedSelection);
      setDraftSelection(confirmedSelection);
      savedSelectionRef.current = confirmedSelection;
      savedThemeRef.current = confirmedTheme;
      applyThemeObject(confirmedTheme, confirmedSelection.background);
      setFeedback({
        type: 'success',
        text: 'Apariencia guardada y aplicada en todo el panel.',
      });
    } catch (error) {
      setDraftSelection(previousSelection);
      applyThemeObject(savedThemeRef.current, previousSelection.background);
      setFeedback({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraftSelection(savedSelection);
    applyThemeObject(savedThemeRef.current, savedSelection.background);
    setFeedback({ type: 'info', text: 'Vista previa descartada.' });
  };

  const handleRestore = () => {
    previewSelection({
      ...DEFAULT_PANEL_SELECTION,
      background: { ...DEFAULT_ADMIN_PANEL_BACKGROUND },
    });
    setFeedback({
      type: 'info',
      text: 'Configuración predeterminada preparada. Guárdala para aplicarla.',
    });
  };

  return (
    <section className="panel-admin-level-plus" aria-labelledby="panel-admin-title">
      <header className="panel-admin-hero">
        <div className="panel-admin-hero__icon" aria-hidden="true">
          <Sparkles size={23} />
        </div>
        <div className="panel-admin-hero__copy">
          <span>Experiencia del equipo</span>
          <h2 id="panel-admin-title">Diseña un panel cómodo para trabajar</h2>
          <p>
            Combina el tema, la amplitud de navegación y la textura de los widgets
            antes de guardar. Estos cambios solo afectan el panel administrativo.
          </p>
        </div>
        <div className={`panel-admin-sync panel-admin-sync--${dirty ? 'dirty' : 'saved'}`}>
          {loading ? (
            <><LoaderCircle className="panel-admin-spin" size={16} /> Cargando</>
          ) : dirty ? (
            <><Eye size={16} /> Vista previa sin guardar</>
          ) : (
            <><Check size={16} /> Configuración sincronizada</>
          )}
        </div>
      </header>

      {feedback && (
        <div className={`panel-admin-feedback panel-admin-feedback--${feedback.type}`} role="status">
          {feedback.text}
        </div>
      )}

      <div
        className="panel-admin-workspace"
        aria-busy={loading || saving || uploadingBackground}
      >
        <div className="panel-admin-settings">
          <div className="panel-admin-section-heading">
            <div>
              <span>01 · Estilo visual</span>
              <h3>Elige una personalidad</h3>
            </div>
            <p>{ADMIN_THEME_OPTIONS.length} estilos disponibles</p>
          </div>

          <div className="panel-admin-theme-grid" role="group" aria-label="Temas del panel">
            {ADMIN_THEME_OPTIONS.map((option) => {
              const palette =
                option.value === 'systemDefault'
                  ? ADMIN_THEME_DEFAULT
                  : ADMIN_THEME_PRESETS[option.value];
              const selected = draftSelection.preset === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`panel-admin-theme-card${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  disabled={loading || saving || uploadingBackground}
                  onClick={() =>
                    previewSelection({ ...draftSelection, preset: option.value })
                  }
                >
                  <span className="panel-admin-theme-card__palette" aria-hidden="true">
                    {[palette.primary, palette.pageBg, palette.cardBg].map((color, index) => (
                      <i key={`${color}-${index}`} style={{ background: color }} />
                    ))}
                  </span>
                  <span className="panel-admin-theme-card__copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <span className="panel-admin-theme-card__check" aria-hidden="true">
                    <Check size={15} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="panel-admin-section-heading panel-admin-section-heading--layout">
            <div>
              <span>02 · Navegación</span>
              <h3>Ajusta el espacio del menú</h3>
            </div>
          </div>

          <div className="panel-admin-sidebar-grid" role="group" aria-label="Amplitud del menú lateral">
            {SIDEBAR_OPTIONS.map((option) => {
              const selected = draftSelection.sidebar === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`panel-admin-sidebar-option${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  disabled={loading || saving || uploadingBackground}
                  onClick={() =>
                    previewSelection({ ...draftSelection, sidebar: option.value })
                  }
                >
                  <PanelLeft size={19} />
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                </button>
              );
            })}
          </div>

          <div className="panel-admin-section-heading panel-admin-section-heading--texture">
            <div>
              <span>03 · Textura de widgets</span>
              <h3>Elige el acabado de las superficies</h3>
            </div>
            <p>Se combina con cualquier estilo</p>
          </div>

          <div
            className="panel-admin-texture-grid"
            role="group"
            aria-label="Textura de los widgets"
          >
            {ADMIN_WIDGET_TEXTURES.map((option) => {
              const selected = draftSelection.widgetTexture === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  data-texture={option.value}
                  className={`panel-admin-texture-option${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  disabled={loading || saving || uploadingBackground}
                  onClick={() =>
                    previewSelection({
                      ...draftSelection,
                      widgetTexture: option.value,
                    })
                  }
                >
                  <span className="panel-admin-texture-option__sample" aria-hidden="true">
                    <i />
                    <i />
                  </span>
                  <span className="panel-admin-texture-option__copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <span className="panel-admin-texture-option__check" aria-hidden="true">
                    <Check size={14} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="panel-admin-section-heading panel-admin-section-heading--typography">
            <div>
              <span>04 · Tipografía</span>
              <h3>Elige la voz visual del panel</h3>
            </div>
            <p>Lectura clara con títulos elegantes</p>
          </div>

          <div
            className="panel-admin-font-grid"
            role="group"
            aria-label="Tipografía del panel"
          >
            {ADMIN_FONT_PRESETS.map((option) => {
              const selected = draftSelection.fontPreset === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`panel-admin-font-option${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  disabled={loading || saving || uploadingBackground}
                  onClick={() =>
                    previewSelection({
                      ...draftSelection,
                      fontPreset: option.value,
                    })
                  }
                >
                  <span
                    className="panel-admin-font-option__sample"
                    aria-hidden="true"
                    style={{
                      fontFamily: option.heading,
                      fontWeight: option.headingWeight,
                    }}
                  >
                    {option.sample}
                  </span>
                  <span className="panel-admin-font-option__copy">
                    <strong
                      style={{
                        fontFamily: option.heading,
                        fontWeight: option.headingWeight,
                      }}
                    >
                      {option.label}
                    </strong>
                    <small style={{ fontFamily: option.body }}>{option.description}</small>
                  </span>
                  <span className="panel-admin-font-option__check" aria-hidden="true">
                    <Check size={14} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="panel-admin-section-heading panel-admin-section-heading--background">
            <div>
              <span>05 · Fondo general</span>
              <h3>Personaliza todo el panel con tu imagen</h3>
            </div>
            <p>Se mantiene fija mientras navegas</p>
          </div>

          <div className="panel-admin-background-editor">
            <div
              className={`panel-admin-background-preview${
                draftSelection.background.enabled ? ' has-image' : ''
              }`}
              style={
                draftSelection.background.enabled
                  ? {
                      backgroundImage: `linear-gradient(135deg, rgba(15,23,42,.18), rgba(255,255,255,.08)), url("${draftSelection.background.image}")`,
                    }
                  : undefined
              }
            >
              {draftSelection.background.enabled ? (
                <div className="panel-admin-background-preview__status">
                  <Check size={16} /> Imagen lista para usar
                </div>
              ) : (
                <div className="panel-admin-background-preview__empty">
                  <ImageIcon size={30} />
                  <strong>Fondo del tema actual</strong>
                  <span>Sube una imagen para verla aquí y en todo el panel.</span>
                </div>
              )}
            </div>

            <div className="panel-admin-background-guide">
              <div className="panel-admin-background-guide__heading">
                <ImageIcon size={18} />
                <div>
                  <strong>Cómo debe ser la imagen</strong>
                  <span>Estas medidas evitan pixelación y recortes incómodos.</span>
                </div>
              </div>
              <ul>
                <li><b>Ideal:</b> 2560 × 1440 px, formato horizontal 16:9.</li>
                <li><b>Mínimo:</b> 1920 × 1080 px.</li>
                <li><b>Formatos:</b> WebP recomendado; también JPG o PNG.</li>
                <li><b>Peso máximo:</b> 8 MB. Evita texto importante en los bordes.</li>
              </ul>
              <div className="panel-admin-background-actions">
                <label
                  className={`panel-admin-button panel-admin-button--primary panel-admin-upload-button${
                    uploadingBackground ? ' is-disabled' : ''
                  }`}
                >
                  {uploadingBackground ? (
                    <LoaderCircle className="panel-admin-spin" size={17} />
                  ) : (
                    <UploadCloud size={17} />
                  )}
                  {uploadingBackground
                    ? 'Subiendo a Cloudinary…'
                    : draftSelection.background.enabled
                      ? 'Cambiar imagen'
                      : 'Subir imagen'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Seleccionar imagen de fondo del panel"
                    disabled={loading || saving || uploadingBackground}
                    onChange={handleBackgroundUpload}
                  />
                </label>
                <button
                  type="button"
                  className="panel-admin-button panel-admin-button--danger-soft"
                  disabled={
                    !draftSelection.background.enabled ||
                    loading ||
                    saving ||
                    uploadingBackground
                  }
                  onClick={handleBackgroundRemove}
                >
                  <ImageOff size={17} /> Quitar fondo
                </button>
              </div>
              <small>
                La carga se guarda en Cloudinary. El panel conserva una capa de
                contraste para que menús y textos sigan siendo legibles.
              </small>
            </div>
          </div>
        </div>

        <aside className="panel-admin-preview" aria-label="Vista previa del panel">
          <div className="panel-admin-preview__heading">
            <div>
              <span><Eye size={15} /> Vista previa en vivo</span>
              <h3>{selectedThemeOption.label}</h3>
            </div>
            <span className="panel-admin-preview__badge">
              {SIDEBAR_OPTIONS.find((item) => item.value === draftSelection.sidebar)?.label}
            </span>
          </div>

          <div
            className="panel-admin-preview__canvas"
            data-widget-texture={draftSelection.widgetTexture}
            data-theme-preset={draftSelection.preset}
            style={{
              '--preview-primary': selectedTheme.primary,
              '--preview-page': selectedTheme.pageBg,
              '--preview-card': selectedTheme.cardBg,
              '--preview-text': selectedTheme.cardText,
              '--preview-muted': selectedTheme.cardMutedText,
              '--preview-sidebar': selectedTheme.sidebarBg,
              '--preview-radius': `${selectedTheme.layout?.radius || 18}px`,
              '--preview-font-body': selectedFontOption.body,
              '--preview-font-heading': selectedFontOption.heading,
              '--preview-background-image': draftSelection.background.enabled
                ? `url("${draftSelection.background.image}")`
                : selectedThemeBackground
                  ? `url("${selectedThemeBackground}")`
                  : 'none',
            }}
          >
            <div className={`panel-admin-preview__sidebar is-${draftSelection.sidebar}`}>
              <i /><i /><i /><i />
            </div>
            <div className="panel-admin-preview__content">
              <div className="panel-admin-preview__topbar" />
              <div className="panel-admin-preview__title"><i /><span /></div>
              <div className="panel-admin-preview__metrics"><i /><i /><i /></div>
              <div className="panel-admin-preview__table"><i /><i /><i /></div>
            </div>
          </div>

          <ul className="panel-admin-preview__summary">
            <li><LayoutDashboard size={16} /><span><strong>Tema</strong>{selectedThemeOption.label}</span></li>
            <li><PanelLeft size={16} /><span><strong>Navegación</strong>{SIDEBAR_OPTIONS.find((item) => item.value === draftSelection.sidebar)?.label}</span></li>
            <li><Gem size={16} /><span><strong>Textura</strong>{selectedTextureOption.label}</span></li>
            <li><Type size={16} /><span><strong>Tipografía</strong>{selectedFontOption.label}</span></li>
            <li><ImageIcon size={16} /><span><strong>Fondo</strong>{draftSelection.background.enabled ? 'Imagen personalizada' : selectedThemeBackground ? 'Horizonte cristalino' : 'Color del tema'}</span></li>
            <li><Check size={16} /><span><strong>Alcance</strong>Todo el panel administrativo</span></li>
          </ul>
        </aside>
      </div>

      <footer className="panel-admin-actions">
        <div className="panel-admin-actions__note">
          <Check size={16} />
          <span>El cambio queda protegido por permisos y registrado en la auditoría.</span>
        </div>
        <div className="panel-admin-actions__buttons">
          <button type="button" className="panel-admin-button panel-admin-button--ghost" onClick={handleRestore} disabled={loading || saving || uploadingBackground}>
            <RotateCcw size={16} /> Restaurar predeterminado
          </button>
          <button type="button" className="panel-admin-button panel-admin-button--secondary" onClick={handleCancel} disabled={!dirty || saving || uploadingBackground}>
            <Undo2 size={16} /> Cancelar
          </button>
          <button type="button" className="panel-admin-button panel-admin-button--primary" onClick={handleSave} disabled={!dirty || loading || saving || uploadingBackground}>
            {saving ? <LoaderCircle className="panel-admin-spin" size={17} /> : <Save size={17} />}
            {saving ? 'Guardando…' : 'Guardar apariencia'}
            {!saving && <ChevronRight size={16} />}
          </button>
        </div>
      </footer>
    </section>
  );
}
