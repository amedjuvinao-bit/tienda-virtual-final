import {
  CURATED_LOGIN_THEME_IDS,
  DEFAULT_LOGIN_LAYOUT_ID,
  DEFAULT_LOGIN_THEME_ID,
  getLoginThemeCustomization,
  LOGIN_LAYOUTS,
} from './loginThemes';

export const LOGIN_COLOR_FIELDS = Object.freeze(['primary', 'secondary', 'accent', 'surface']);
export const LOGIN_TEXT_LIMITS = Object.freeze({
  eyebrow: 48,
  headline: 48,
  highlight: 48,
  description: 180,
  welcomeTitle: 48,
  welcomeSubtitle: 100,
  buttonText: 32,
});

function defaultCustomizations() {
  return Object.fromEntries(
    CURATED_LOGIN_THEME_IDS.map((themeId) => [themeId, getLoginThemeCustomization(themeId)])
  );
}

export const DEFAULT_LOGIN_SETTINGS = Object.freeze({
  theme: DEFAULT_LOGIN_THEME_ID,
  layout: DEFAULT_LOGIN_LAYOUT_ID,
  customizations: Object.freeze(defaultCustomizations()),
  background: Object.freeze({
    mode: 'theme',
    color: '#07132f',
    image: '',
    imageOpacity: 0.35,
    overlay: 0.35,
  }),
});

function numberInRange(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function safeLoginImageUrl(value) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (image.startsWith('/') && !image.startsWith('//')) return image;
  try {
    const parsed = new URL(image);
    return ['https:', 'http:'].includes(parsed.protocol) ? image : '';
  } catch {
    return '';
  }
}

function normalizeThemeCustomization(themeId, input = {}) {
  const defaults = getLoginThemeCustomization(themeId);
  const normalized = {};

  LOGIN_COLOR_FIELDS.forEach((field) => {
    normalized[field] = /^#[0-9a-f]{6}$/i.test(String(input[field] || ''))
      ? String(input[field]).toLowerCase()
      : defaults[field];
  });

  Object.entries(LOGIN_TEXT_LIMITS).forEach(([field, maxLength]) => {
    normalized[field] = String(input[field] || '').trim().slice(0, maxLength) || defaults[field];
  });

  return normalized;
}

export function normalizeLoginCustomizations(input = {}) {
  return Object.fromEntries(
    CURATED_LOGIN_THEME_IDS.map((themeId) => [
      themeId,
      normalizeThemeCustomization(themeId, input?.[themeId] || {}),
    ])
  );
}

export function normalizeLoginSettings(input = {}) {
  const background = input?.background || {};
  const theme = CURATED_LOGIN_THEME_IDS.includes(input.theme)
    ? input.theme
    : DEFAULT_LOGIN_SETTINGS.theme;
  const layout = LOGIN_LAYOUTS[input.layout] ? input.layout : DEFAULT_LOGIN_SETTINGS.layout;
  const mode = ['theme', 'color', 'image'].includes(background.mode)
    ? background.mode
    : DEFAULT_LOGIN_SETTINGS.background.mode;
  const color = /^#[0-9a-f]{6}$/i.test(String(background.color || ''))
    ? String(background.color).toLowerCase()
    : DEFAULT_LOGIN_SETTINGS.background.color;

  return {
    theme,
    layout,
    customizations: normalizeLoginCustomizations(input.customizations),
    background: {
      mode,
      color,
      image: safeLoginImageUrl(background.image),
      imageOpacity: numberInRange(background.imageOpacity, 0.1, 1, DEFAULT_LOGIN_SETTINGS.background.imageOpacity),
      overlay: numberInRange(background.overlay, 0, 0.85, DEFAULT_LOGIN_SETTINGS.background.overlay),
    },
  };
}

export function loginSettingsEqual(left, right) {
  return JSON.stringify(normalizeLoginSettings(left)) === JSON.stringify(normalizeLoginSettings(right));
}
