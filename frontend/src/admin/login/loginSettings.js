import {
  DEFAULT_LOGIN_LAYOUT_ID,
  DEFAULT_LOGIN_THEME_ID,
  LOGIN_LAYOUTS,
  LOGIN_THEMES,
} from './loginThemes';

export const DEFAULT_LOGIN_SETTINGS = Object.freeze({
  theme: DEFAULT_LOGIN_THEME_ID,
  layout: DEFAULT_LOGIN_LAYOUT_ID,
  background: Object.freeze({
    mode: 'theme',
    color: '#fff7fb',
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

export function normalizeLoginSettings(input = {}) {
  const background = input?.background || {};
  const theme = LOGIN_THEMES[input.theme] ? input.theme : DEFAULT_LOGIN_SETTINGS.theme;
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
