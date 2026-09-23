// src/admin/theme/adminTheme.js

import {
  applyAdminTypography,
  DEFAULT_ADMIN_FONT_PRESET,
  normalizeAdminFontPreset,
} from './adminTypography';
import azureHorizonDashboard from '../../assets/admin/azure-horizon-dashboard.webp';

const ADMIN_PANEL_RADIUS = 18;

const ADMIN_THEME_BACKGROUNDS = Object.freeze({
  azureHorizonLight: azureHorizonDashboard,
});

export function getAdminThemeBuiltInBackground(preset) {
  return ADMIN_THEME_BACKGROUNDS[preset] || '';
}

const ADMIN_THEME_SIGNATURES = Object.freeze({
  systemDefault: {
    style: 'classic',
    pattern: 'linear-gradient(135deg, transparent 0 48%, color-mix(in srgb, var(--admin-primary) 7%, transparent) 48% 52%, transparent 52% 100%)',
    headerSheen: 'linear-gradient(118deg, rgba(255,255,255,.28), transparent 34%, color-mix(in srgb, var(--admin-primary) 12%, transparent))',
    navMarker: '4px',
    headingSpacing: '-0.02em',
  },
  roseLuxuryLight: {
    style: 'couture',
    pattern: 'radial-gradient(ellipse at 12% 8%, color-mix(in srgb, var(--admin-primary) 20%, transparent), transparent 34%), linear-gradient(128deg, transparent 0 70%, rgba(255,255,255,.24) 70% 72%, transparent 72%)',
    headerSheen: 'linear-gradient(112deg, rgba(255,255,255,.48), transparent 38%, color-mix(in srgb, var(--admin-primary) 16%, transparent))',
    navMarker: '7px',
    headingSpacing: '-0.035em',
  },
  goldBoutiqueLight: {
    style: 'gilded',
    pattern: 'repeating-linear-gradient(135deg, transparent 0 24px, color-mix(in srgb, var(--admin-primary) 8%, transparent) 24px 25px)',
    headerSheen: 'linear-gradient(105deg, rgba(255,255,255,.44), transparent 32%, color-mix(in srgb, var(--admin-primary) 22%, transparent))',
    navMarker: '5px',
    headingSpacing: '-0.018em',
  },
  glassPastel: {
    style: 'aero',
    pattern: 'radial-gradient(circle at 18% 18%, rgba(255,255,255,.52), transparent 25%), radial-gradient(circle at 82% 22%, color-mix(in srgb, var(--admin-primary) 18%, transparent), transparent 28%)',
    headerSheen: 'linear-gradient(125deg, rgba(255,255,255,.58), transparent 42%, color-mix(in srgb, var(--admin-primary) 14%, transparent))',
    navMarker: '8px',
    headingSpacing: '-0.03em',
  },
  pearlFuture: {
    style: 'technical',
    pattern: 'linear-gradient(color-mix(in srgb, var(--admin-primary) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--admin-primary) 7%, transparent) 1px, transparent 1px)',
    headerSheen: 'linear-gradient(132deg, rgba(255,255,255,.40), transparent 45%, color-mix(in srgb, var(--admin-primary) 12%, transparent))',
    navMarker: '3px',
    headingSpacing: '-0.012em',
  },
  neonRoseLight: {
    style: 'pulse',
    pattern: 'radial-gradient(circle at 14% 16%, color-mix(in srgb, var(--admin-primary) 24%, transparent), transparent 26%), linear-gradient(118deg, transparent 0 64%, color-mix(in srgb, var(--admin-primary) 10%, transparent) 64% 66%, transparent 66%)',
    headerSheen: 'linear-gradient(112deg, rgba(255,255,255,.42), transparent 34%, color-mix(in srgb, var(--admin-primary) 22%, transparent))',
    navMarker: '8px',
    headingSpacing: '-0.028em',
  },
  minimalPro: {
    style: 'minimal',
    pattern: 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--admin-primary) 3%, transparent))',
    headerSheen: 'linear-gradient(180deg, rgba(255,255,255,.12), transparent)',
    navMarker: '3px',
    headingSpacing: '-0.015em',
  },
  electricNeon: {
    style: 'electric',
    pattern: 'linear-gradient(color-mix(in srgb, var(--admin-primary) 10%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--admin-primary) 10%, transparent) 1px, transparent 1px), radial-gradient(circle at 82% 12%, color-mix(in srgb, var(--admin-primary) 20%, transparent), transparent 30%)',
    headerSheen: 'linear-gradient(112deg, rgba(255,255,255,.08), transparent 34%, color-mix(in srgb, var(--admin-primary) 28%, transparent))',
    navMarker: '6px',
    headingSpacing: '-0.018em',
  },
  darkCyber: {
    style: 'cyber',
    pattern: 'repeating-linear-gradient(180deg, transparent 0 7px, rgba(255,255,255,.025) 7px 8px), radial-gradient(circle at 18% 16%, color-mix(in srgb, var(--admin-primary) 24%, transparent), transparent 30%)',
    headerSheen: 'linear-gradient(118deg, rgba(255,255,255,.07), transparent 38%, color-mix(in srgb, var(--admin-primary) 30%, transparent))',
    navMarker: '7px',
    headingSpacing: '-0.025em',
  },
  azureHorizonLight: {
    style: 'azure',
    pattern: 'radial-gradient(ellipse at 14% 8%, rgba(255,255,255,.62), transparent 31%), linear-gradient(126deg, transparent 0 58%, color-mix(in srgb, var(--admin-primary) 9%, transparent) 58% 60%, transparent 60%)',
    headerSheen: 'linear-gradient(112deg, rgba(255,255,255,.78), transparent 36%, color-mix(in srgb, var(--admin-primary) 14%, transparent))',
    navMarker: '5px',
    headingSpacing: '-0.026em',
  },
});

// 🎨 Tema por defecto del panel admin
export const ADMIN_THEME_DEFAULT = {
  preset: 'systemDefault',
  fontPreset: DEFAULT_ADMIN_FONT_PRESET,
  radius: ADMIN_PANEL_RADIUS,

  layout: {
    radius: ADMIN_PANEL_RADIUS,
  },

  primary: '#ec4899',
  primaryHover: '#db2777',

  primarySoftBg: '#fdf2f8',
  primarySoftHover: '#fce7f3',
  primarySoftBorder: '#fbcfe8',
  primarySoftText: '#be185d',

  activeNavBg: '#fce7f3',
  activeNavText: '#be185d',

  sidebarBg: '#ffffff',
  headerBg: '#ffffff',
  pageBg: '#f3f4f6',

  cardBg: '#ffffff',
  cardHeaderBg: '#fdf2f8',
  cardBorder: '#fbcfe8',
  cardText: '#111827',
  cardMutedText: '#6b7280',

  tableHeadBg: '#f9fafb',
  tableBorder: '#e5e7eb',
  tableText: '#111827',
  tableMutedText: '#6b7280',
  tableRowHover: '#fdf2f8',

  buttonBg: '#ec4899',
  buttonHover: '#db2777',
  buttonText: '#ffffff',
  buttonSoftBg: '#fdf2f8',
  buttonSoftText: '#be185d',
  buttonSoftBorder: '#fbcfe8',

  disabledBg: '#fdf2f8',
  disabledText: '#be185d',
  disabledBorder: '#fbcfe8',

  inputBg: '#ffffff',
  inputBorder: '#d1d5db',
  inputText: '#111827',
  inputPlaceholder: '#9ca3af',
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
};

function normalizeAdminThemeRadius(theme) {
  const safeTheme = theme && typeof theme === 'object' ? theme : {};
  const safeLayout =
    safeTheme.layout && typeof safeTheme.layout === 'object'
      ? safeTheme.layout
      : {};

  const requestedRadius = Number(safeLayout.radius ?? safeTheme.radius);
  const radius = Number.isFinite(requestedRadius)
    ? Math.min(32, Math.max(10, requestedRadius))
    : ADMIN_PANEL_RADIUS;

  return {
    ...safeTheme,
    radius,
    layout: {
      ...safeLayout,
      radius,
    },
  };
}

function hexToRgb(hex) {
  const clean = String(hex || '').trim();

  if (!clean.startsWith('#')) return null;

  const short = clean.length === 4;
  const full = clean.length === 7;

  if (!short && !full) return null;

  const r = short ? clean[1] + clean[1] : clean.slice(1, 3);
  const g = short ? clean[2] + clean[2] : clean.slice(3, 5);
  const b = short ? clean[3] + clean[3] : clean.slice(5, 7);

  const rgb = {
    r: Number.parseInt(r, 16),
    g: Number.parseInt(g, 16),
    b: Number.parseInt(b, 16),
  };

  if (
    Number.isNaN(rgb.r) ||
    Number.isNaN(rgb.g) ||
    Number.isNaN(rgb.b)
  ) {
    return null;
  }

  return rgb;
}

function rgbStringToRgb(color) {
  const clean = String(color || '').trim();

  const match = clean.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)$/i
  );

  if (!match) return null;

  const rgb = {
    r: Math.max(0, Math.min(255, Number(match[1]))),
    g: Math.max(0, Math.min(255, Number(match[2]))),
    b: Math.max(0, Math.min(255, Number(match[3]))),
  };

  if (
    Number.isNaN(rgb.r) ||
    Number.isNaN(rgb.g) ||
    Number.isNaN(rgb.b)
  ) {
    return null;
  }

  return rgb;
}

function colorToRgb(color) {
  return hexToRgb(color) || rgbStringToRgb(color);
}

function rgbToCss(rgb, alpha = 1) {
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function getColorLuminance(color) {
  const rgb = colorToRgb(color);
  if (!rgb) return 1;

  const srgb = [rgb.r, rgb.g, rgb.b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function getContrastRatio(colorA, colorB) {
  const lumA = getColorLuminance(colorA);
  const lumB = getColorLuminance(colorB);

  const light = Math.max(lumA, lumB);
  const dark = Math.min(lumA, lumB);

  return (light + 0.05) / (dark + 0.05);
}

// 🔥 Contraste automático obligatorio
function getContrastText(bgColor) {
  const darkText = '#111827';
  const lightText = '#ffffff';

  const darkRatio = getContrastRatio(bgColor, darkText);
  const lightRatio = getContrastRatio(bgColor, lightText);

  return darkRatio >= lightRatio ? darkText : lightText;
}

function getPreferredContrastText(bgColor, preferredText, minimumRatio = 4.5) {
  if (
    colorToRgb(preferredText) &&
    getContrastRatio(bgColor, preferredText) >= minimumRatio
  ) {
    return preferredText;
  }

  return getContrastText(bgColor);
}

function getMutedContrastText(bgColor) {
  const baseText = getContrastText(bgColor);
  return baseText === '#ffffff' ? '#cbd5e1' : '#6b7280';
}

function getPlaceholderContrastText(bgColor) {
  const baseText = getContrastText(bgColor);
  return baseText === '#ffffff' ? '#94a3b8' : '#9ca3af';
}

function detectAdminThemeMode(theme) {
  const pageLum = getColorLuminance(theme.pageBg);
  const cardLum = getColorLuminance(theme.cardBg);
  const sidebarLum = getColorLuminance(theme.sidebarBg);

  const darkVotes = [pageLum, cardLum, sidebarLum].filter((lum) => lum < 0.35).length;

  return darkVotes >= 2 ? 'dark' : 'light';
}

// 🧠 Aplica el tema al DOM (global)
export function applyAdminTheme(theme) {
  const normalizedTheme = normalizeAdminThemeRadius(theme);

  const t = {
    ...ADMIN_THEME_DEFAULT,
    ...normalizedTheme,
    radius: normalizedTheme.radius,
    layout: {
      ...(ADMIN_THEME_DEFAULT.layout || {}),
      ...(normalizedTheme.layout || {}),
      radius: normalizedTheme.layout?.radius ?? normalizedTheme.radius,
    },
  };

  const root = document.documentElement;
  const preset = ADMIN_THEME_SIGNATURES[t.preset]
    ? t.preset
    : ADMIN_THEME_DEFAULT.preset;
  const signature = ADMIN_THEME_SIGNATURES[preset];
  const fontPreset = normalizeAdminFontPreset(t.fontPreset);
  const mode = detectAdminThemeMode(t);
  const isDark = mode === 'dark';
  const themeBackground = getAdminThemeBuiltInBackground(preset);

  root.dataset.adminThemeMode = mode;
  root.dataset.adminThemePreset = preset;
  root.dataset.adminThemeStyle = signature.style;
  root.dataset.adminThemeBackground = themeBackground ? 'image' : 'none';
  applyAdminTypography(fontPreset);

  if (mode === 'dark') {
    root.classList.add('admin-theme-dark');
    root.classList.remove('admin-theme-light');
  } else {
    root.classList.add('admin-theme-light');
    root.classList.remove('admin-theme-dark');
  }

  root.style.setProperty('--admin-theme-mode', mode);
  root.style.setProperty('--admin-is-dark', mode === 'dark' ? '1' : '0');
  root.style.setProperty('--admin-is-light', mode === 'light' ? '1' : '0');

  root.style.setProperty('--admin-radius', `${t.layout.radius}px`);
  root.style.setProperty('--admin-theme-pattern', signature.pattern);
  root.style.setProperty('--admin-theme-header-sheen', signature.headerSheen);
  root.style.setProperty('--admin-theme-nav-marker', signature.navMarker);
  root.style.setProperty('--admin-theme-heading-spacing', signature.headingSpacing);
  root.style.setProperty(
    '--admin-theme-background-image',
    themeBackground ? `url("${themeBackground}")` : 'none'
  );

  const pageTextAuto = getContrastText(t.pageBg);
  const pageMutedTextAuto = getMutedContrastText(t.pageBg);

  const sidebarTextAuto = getContrastText(t.sidebarBg);
  const sidebarMutedTextAuto = getMutedContrastText(t.sidebarBg);

  const headerTextAuto = getContrastText(t.headerBg);
  const headerMutedTextAuto = getMutedContrastText(t.headerBg);

  const cardTextAuto = getContrastText(t.cardBg);
  const cardMutedTextAuto = getMutedContrastText(t.cardBg);

  const cardHeaderTextAuto = getContrastText(t.cardHeaderBg);
  const cardHeaderMutedTextAuto = getMutedContrastText(t.cardHeaderBg);

  const tableHeadTextAuto = getContrastText(t.tableHeadBg);
  const tableTextAuto = getContrastText(t.cardBg);
  const tableMutedTextAuto = getMutedContrastText(t.cardBg);

  const buttonTextAuto = getPreferredContrastText(t.buttonBg, t.buttonText, 3);
  const buttonHoverTextAuto = getPreferredContrastText(t.buttonHover, t.buttonText, 3);
  const buttonSoftTextAuto = getPreferredContrastText(t.buttonSoftBg, t.buttonSoftText);

  const hasDisabledBg = Object.prototype.hasOwnProperty.call(normalizedTheme, 'disabledBg');
  const hasDisabledText = Object.prototype.hasOwnProperty.call(normalizedTheme, 'disabledText');
  const hasDisabledBorder = Object.prototype.hasOwnProperty.call(normalizedTheme, 'disabledBorder');
  const disabledBg = hasDisabledBg ? t.disabledBg : t.buttonSoftBg;
  const disabledText = hasDisabledText ? t.disabledText : t.buttonSoftText;
  const disabledBorder = hasDisabledBorder ? t.disabledBorder : t.buttonSoftBorder;
  const disabledTextAuto = getPreferredContrastText(disabledBg, disabledText);

  const inputTextAuto = getContrastText(t.inputBg);
  const inputPlaceholderAuto = getPlaceholderContrastText(t.inputBg);

  const modalTextAuto = getContrastText(t.modalBg);
  const modalMutedTextAuto = getMutedContrastText(t.modalBg);

  const lightPanelTextAuto = getContrastText('#ffffff');
  const lightPanelMutedTextAuto = getMutedContrastText('#ffffff');
  const lightPanelBorderAuto = '#e5e7eb';
  const lightPanelSoftBgAuto = '#f9fafb';

  const activeNavTextAuto = getContrastText(t.activeNavBg);
  const primaryTextAuto = getContrastText(t.primary);
  const primarySoftTextAuto = getContrastText(t.primarySoftBg);

  const dangerTextAuto = getContrastText(t.dangerSoftBg);
  const dangerButtonTextAuto = getContrastText(t.danger);
  const warningTextAuto = getContrastText(t.warningSoftBg);
  const warningButtonTextAuto = getContrastText(t.warning);

  const primaryRgb = colorToRgb(t.primary);
  const cardRgb = colorToRgb(t.cardBg);
  const pageRgb = colorToRgb(t.pageBg);

  const glassBg = isDark
    ? `linear-gradient(145deg, ${rgbToCss(cardRgb, 0.66)}, ${rgbToCss(primaryRgb, 0.16)})`
    : `linear-gradient(145deg, ${rgbToCss(cardRgb, 0.62)}, ${rgbToCss(primaryRgb, 0.10)})`;

  const glassStrongBg = isDark
    ? `linear-gradient(145deg, ${rgbToCss(cardRgb, 0.78)}, ${rgbToCss(primaryRgb, 0.22)})`
    : `linear-gradient(145deg, ${rgbToCss(cardRgb, 0.76)}, ${rgbToCss(primaryRgb, 0.14)})`;

  const glassSoftBg = isDark
    ? `linear-gradient(145deg, ${rgbToCss(cardRgb, 0.48)}, ${rgbToCss(primaryRgb, 0.13)})`
    : `linear-gradient(145deg, ${rgbToCss(cardRgb, 0.42)}, ${rgbToCss(primaryRgb, 0.08)})`;

  const glassBorder = isDark
    ? `color-mix(in srgb, ${t.primary} 42%, rgba(255,255,255,0.16))`
    : `color-mix(in srgb, ${t.cardBorder} 62%, rgba(255,255,255,0.68))`;

  const glassShadow = isDark
    ? `0 24px 70px rgba(0,0,0,0.48), 0 14px 34px ${rgbToCss(primaryRgb, 0.16)}, inset 0 1px 0 rgba(255,255,255,0.10)`
    : `0 22px 60px rgba(15,23,42,0.11), 0 12px 30px ${rgbToCss(primaryRgb, 0.13)}, inset 0 1px 0 rgba(255,255,255,0.58)`;

  const glassShadowHover = isDark
    ? `0 30px 84px rgba(0,0,0,0.56), 0 18px 42px ${rgbToCss(primaryRgb, 0.22)}, inset 0 1px 0 rgba(255,255,255,0.13)`
    : `0 28px 74px rgba(15,23,42,0.15), 0 16px 38px ${rgbToCss(primaryRgb, 0.18)}, inset 0 1px 0 rgba(255,255,255,0.70)`;

  const glassHighlight = isDark
    ? 'rgba(255,255,255,0.10)'
    : 'rgba(255,255,255,0.68)';

  const glassOverlay = isDark
    ? `radial-gradient(circle at 12% 16%, ${rgbToCss(primaryRgb, 0.20)}, transparent 32%), radial-gradient(circle at 88% 12%, rgba(255,255,255,0.07), transparent 34%)`
    : `radial-gradient(circle at 12% 16%, ${rgbToCss(primaryRgb, 0.18)}, transparent 30%), radial-gradient(circle at 88% 12%, rgba(255,255,255,0.62), transparent 34%)`;

  const pageGlassOverlay = isDark
    ? `radial-gradient(circle at 8% 16%, ${rgbToCss(primaryRgb, 0.28)}, transparent 34%), radial-gradient(circle at 92% 10%, rgba(120,160,255,0.13), transparent 36%), radial-gradient(circle at 78% 88%, ${rgbToCss(primaryRgb, 0.17)}, transparent 40%), linear-gradient(135deg, ${rgbToCss(pageRgb, 0.92)}, rgba(2,6,23,0.92))`
    : `radial-gradient(circle at 5% 12%, ${rgbToCss(primaryRgb, 0.24)}, transparent 32%), radial-gradient(circle at 95% 8%, rgba(130,190,255,0.22), transparent 34%), radial-gradient(circle at 15% 90%, ${rgbToCss(primaryRgb, 0.13)}, transparent 36%), linear-gradient(135deg, ${rgbToCss(pageRgb, 0.82)}, rgba(255,255,255,0.78))`;

  const buttonGlassBg = isDark
    ? `linear-gradient(145deg, ${rgbToCss(primaryRgb, 0.42)}, ${rgbToCss(cardRgb, 0.50)})`
    : `linear-gradient(145deg, ${rgbToCss(primaryRgb, 0.18)}, ${rgbToCss(cardRgb, 0.68)})`;

  const buttonGlassText = isDark ? cardTextAuto : getContrastText(t.cardBg);

  root.style.setProperty('--admin-primary', t.primary);
  root.style.setProperty('--admin-primary-hover', t.primaryHover);
  root.style.setProperty('--admin-primary-text', primaryTextAuto);
  root.style.setProperty('--admin-accent', t.primary);
  root.style.setProperty('--admin-accent-text', primaryTextAuto);

  root.style.setProperty('--admin-primary-soft-bg', t.primarySoftBg);
  root.style.setProperty('--admin-primary-soft-hover', t.primarySoftHover);
  root.style.setProperty('--admin-primary-soft-border', t.primarySoftBorder);
  root.style.setProperty('--admin-primary-soft-text', primarySoftTextAuto);

  root.style.setProperty('--admin-active-nav-bg', t.activeNavBg);
  root.style.setProperty('--admin-active-nav-text', activeNavTextAuto);

  root.style.setProperty('--admin-sidebar-bg', t.sidebarBg);
  root.style.setProperty('--admin-sidebar-text', sidebarTextAuto);
  root.style.setProperty('--admin-sidebar-muted-text', sidebarMutedTextAuto);

  root.style.setProperty('--admin-header-bg', t.headerBg);
  root.style.setProperty('--admin-header-text', headerTextAuto);
  root.style.setProperty('--admin-header-muted-text', headerMutedTextAuto);

  root.style.setProperty('--admin-page-bg', t.pageBg);
  root.style.setProperty('--admin-page-text', pageTextAuto);
  root.style.setProperty('--admin-page-muted-text', pageMutedTextAuto);

  /* Keep the opaque theme colors available as immutable sources. Widget
     textures may temporarily replace the public surface variables and must
     be able to restore them without losing the selected color theme. */
  root.style.setProperty('--admin-theme-card-bg', t.cardBg);
  root.style.setProperty('--admin-theme-card-header-bg', t.cardHeaderBg);
  root.style.setProperty('--admin-theme-card-border', t.cardBorder);
  root.style.setProperty('--admin-card-bg', t.cardBg);
  root.style.setProperty('--admin-card-header-bg', t.cardHeaderBg);
  root.style.setProperty('--admin-card-header-text', cardHeaderTextAuto);
  root.style.setProperty('--admin-card-header-muted-text', cardHeaderMutedTextAuto);
  root.style.setProperty('--admin-card-border', t.cardBorder);
  root.style.setProperty('--admin-card-text', cardTextAuto);
  root.style.setProperty('--admin-card-muted-text', cardMutedTextAuto);

  root.style.setProperty('--admin-theme-light-panel-bg', '#ffffff');
  root.style.setProperty('--admin-light-panel-bg', '#ffffff');
  root.style.setProperty('--admin-light-panel-soft-bg', lightPanelSoftBgAuto);
  root.style.setProperty('--admin-light-panel-border', lightPanelBorderAuto);
  root.style.setProperty('--admin-light-panel-text', lightPanelTextAuto);
  root.style.setProperty('--admin-light-panel-muted-text', lightPanelMutedTextAuto);

  root.style.setProperty('--admin-glass-bg', glassBg);
  root.style.setProperty('--admin-glass-strong-bg', glassStrongBg);
  root.style.setProperty('--admin-glass-soft-bg', glassSoftBg);
  root.style.setProperty('--admin-glass-border', glassBorder);
  root.style.setProperty('--admin-glass-shadow', glassShadow);
  root.style.setProperty('--admin-glass-shadow-hover', glassShadowHover);
  root.style.setProperty('--admin-glass-highlight', glassHighlight);
  root.style.setProperty('--admin-glass-overlay', glassOverlay);
  root.style.setProperty('--admin-glass-blur', isDark ? '26px' : '24px');
  root.style.setProperty('--admin-glass-saturation', isDark ? '1.42' : '1.55');

  root.style.setProperty('--admin-page-glass-overlay', pageGlassOverlay);
  root.style.setProperty('--admin-page-glass-blur', isDark ? '2px' : '1.5px');

  root.style.setProperty('--admin-button-glass-bg', buttonGlassBg);
  root.style.setProperty('--admin-button-glass-text', buttonGlassText);
  root.style.setProperty('--admin-button-glass-border', glassBorder);
  root.style.setProperty('--admin-widget-glass-bg', glassBg);
  root.style.setProperty('--admin-widget-glass-border', glassBorder);
  root.style.setProperty('--admin-widget-glass-shadow', glassShadow);

  root.style.setProperty('--admin-theme-table-head-bg', t.tableHeadBg);
  root.style.setProperty('--admin-theme-table-border', t.tableBorder);
  root.style.setProperty('--admin-table-head-bg', t.tableHeadBg);
  root.style.setProperty('--admin-table-head-text', tableHeadTextAuto);
  root.style.setProperty('--admin-table-border', t.tableBorder);
  root.style.setProperty('--admin-table-text', tableTextAuto);
  root.style.setProperty('--admin-table-muted-text', tableMutedTextAuto);
  root.style.setProperty('--admin-table-row-hover', t.tableRowHover);

  root.style.setProperty('--admin-button-bg', t.buttonBg);
  root.style.setProperty('--admin-button-hover', t.buttonHover);
  root.style.setProperty('--admin-button-text', buttonTextAuto);
  root.style.setProperty('--admin-button-hover-text', buttonHoverTextAuto);
  root.style.setProperty('--admin-button-soft-bg', t.buttonSoftBg);
  root.style.setProperty('--admin-button-soft-text', buttonSoftTextAuto);
  root.style.setProperty('--admin-button-soft-border', t.buttonSoftBorder);
  root.style.setProperty('--admin-soft-bg', t.buttonSoftBg);
  root.style.setProperty('--admin-soft-text', buttonSoftTextAuto);

  root.style.setProperty('--admin-disabled-bg', disabledBg);
  root.style.setProperty('--admin-disabled-text', disabledTextAuto);
  root.style.setProperty('--admin-disabled-border', disabledBorder);

  root.style.setProperty('--admin-theme-input-bg', t.inputBg);
  root.style.setProperty('--admin-theme-input-border', t.inputBorder);
  root.style.setProperty('--admin-input-bg', t.inputBg);
  root.style.setProperty('--admin-input-border', t.inputBorder);
  root.style.setProperty('--admin-input-text', inputTextAuto);
  root.style.setProperty('--admin-input-placeholder', inputPlaceholderAuto);
  root.style.setProperty('--admin-input-focus', t.inputFocus);

  root.style.setProperty('--admin-theme-modal-bg', t.modalBg);
  root.style.setProperty('--admin-theme-modal-overlay', t.modalOverlay);
  root.style.setProperty('--admin-modal-bg', t.modalBg);
  root.style.setProperty('--admin-modal-text', modalTextAuto);
  root.style.setProperty('--admin-modal-muted-text', modalMutedTextAuto);
  root.style.setProperty('--admin-modal-overlay', t.modalOverlay);

  root.style.setProperty('--admin-danger', t.danger);
  root.style.setProperty('--admin-danger-hover', t.dangerHover);
  root.style.setProperty('--admin-danger-text-on-bg', dangerButtonTextAuto);
  root.style.setProperty('--admin-danger-soft-bg', t.dangerSoftBg);
  root.style.setProperty('--admin-danger-text', dangerTextAuto);

  root.style.setProperty('--admin-warning', t.warning);
  root.style.setProperty('--admin-warning-text-on-bg', warningButtonTextAuto);
  root.style.setProperty('--admin-warning-soft-bg', t.warningSoftBg);
  root.style.setProperty('--admin-warning-text', warningTextAuto);
}

// 💾 Compatibilidad: ya NO guarda en localStorage.
export function saveAdminTheme(theme) {
  const normalizedTheme = normalizeAdminThemeRadius(theme);

  return {
    ...ADMIN_THEME_DEFAULT,
    ...normalizedTheme,
    fontPreset: normalizeAdminFontPreset(normalizedTheme.fontPreset),
    radius: normalizedTheme.radius,
    layout: {
      ...(ADMIN_THEME_DEFAULT.layout || {}),
      ...(normalizedTheme.layout || {}),
      radius: normalizedTheme.layout?.radius ?? normalizedTheme.radius,
    },
  };
}

// 📥 Compatibilidad: ya NO carga desde localStorage.
export function loadAdminTheme(theme) {
  const normalizedTheme = normalizeAdminThemeRadius(theme);

  return {
    ...ADMIN_THEME_DEFAULT,
    ...normalizedTheme,
    fontPreset: normalizeAdminFontPreset(normalizedTheme.fontPreset),
    radius: normalizedTheme.radius,
    layout: {
      ...(ADMIN_THEME_DEFAULT.layout || {}),
      ...(normalizedTheme.layout || {}),
      radius: normalizedTheme.layout?.radius ?? normalizedTheme.radius,
    },
  };
}
