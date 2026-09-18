import {
  CURATED_LOGIN_THEME_IDS,
  DEFAULT_LOGIN_LAYOUT_ID,
  DEFAULT_LOGIN_THEME_ID,
  getLoginThemeCustomization,
  LOGIN_GALLERY_IMAGE_TONES,
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

const LOGIN_THEME_MIGRATIONS = Object.freeze({
  orbit3d: 'liquidGlass',
  neonPortal: 'liquidGlass',
  editorialMotion: 'liquidGlass',
  architectMono: 'liquidGlass',
  roseLuxuryLight: 'immersiveGallery',
  noirGallery: 'smokeGlass',
});

function supportedThemeId(value) {
  if (CURATED_LOGIN_THEME_IDS.includes(value)) return value;
  return LOGIN_THEME_MIGRATIONS[value] || DEFAULT_LOGIN_SETTINGS.theme;
}

function customizationInput(input, themeId) {
  if (input?.[themeId]) return input[themeId];
  if (themeId === 'immersiveGallery') return input?.roseLuxuryLight || {};
  if (themeId === 'smokeGlass') return input?.noirGallery || {};
  return input?.liquidGlass || {};
}

function defaultCustomizations() {
  return Object.fromEntries(
    CURATED_LOGIN_THEME_IDS.map((themeId) => [themeId, getLoginThemeCustomization(themeId)])
  );
}

const DEFAULT_LOGIN_BACKGROUND = Object.freeze({
  mode: 'theme',
  color: '#07132f',
  image: '',
  imageOpacity: 0.35,
  overlay: 0.35,
  glassTransparency: 0.35,
});

const DEFAULT_LOGIN_BACKGROUNDS = Object.freeze(Object.fromEntries(
  CURATED_LOGIN_THEME_IDS.map((themeId) => [themeId, DEFAULT_LOGIN_BACKGROUND])
));

export const DEFAULT_LOGIN_SETTINGS = Object.freeze({
  theme: DEFAULT_LOGIN_THEME_ID,
  layout: DEFAULT_LOGIN_LAYOUT_ID,
  customizations: Object.freeze(defaultCustomizations()),
  background: DEFAULT_LOGIN_BACKGROUND,
  backgrounds: DEFAULT_LOGIN_BACKGROUNDS,
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

  if (themeId === 'immersiveGallery') {
    normalized.imageTone = LOGIN_GALLERY_IMAGE_TONES.some(({ id }) => id === input.imageTone)
      ? input.imageTone
      : defaults.imageTone;
  }

  return normalized;
}

export function normalizeLoginCustomizations(input = {}) {
  return Object.fromEntries(
    CURATED_LOGIN_THEME_IDS.map((themeId) => [
      themeId,
      normalizeThemeCustomization(themeId, customizationInput(input, themeId)),
    ])
  );
}

function normalizeBackground(input = {}) {
  const mode = ['theme', 'color', 'image'].includes(input.mode)
    ? input.mode
    : DEFAULT_LOGIN_BACKGROUND.mode;
  const color = /^#[0-9a-f]{6}$/i.test(String(input.color || ''))
    ? String(input.color).toLowerCase()
    : DEFAULT_LOGIN_BACKGROUND.color;

  return {
    mode,
    color,
    image: safeLoginImageUrl(input.image),
    imageOpacity: numberInRange(input.imageOpacity, 0.1, 1, DEFAULT_LOGIN_BACKGROUND.imageOpacity),
    overlay: numberInRange(input.overlay, 0, 0.85, DEFAULT_LOGIN_BACKGROUND.overlay),
    glassTransparency: numberInRange(
      input.glassTransparency,
      0,
      1,
      DEFAULT_LOGIN_BACKGROUND.glassTransparency
    ),
  };
}

export function normalizeLoginSettings(input = {}) {
  const theme = supportedThemeId(input.theme);
  const layout = LOGIN_LAYOUTS[input.layout] ? input.layout : DEFAULT_LOGIN_SETTINGS.layout;
  const suppliedBackgrounds = input?.backgrounds && typeof input.backgrounds === 'object'
    ? input.backgrounds
    : {};
  const backgrounds = Object.fromEntries(CURATED_LOGIN_THEME_IDS.map((themeId) => {
    const supplied = Object.prototype.hasOwnProperty.call(suppliedBackgrounds, themeId)
      ? suppliedBackgrounds[themeId]
      : themeId === theme
        ? input?.background
        : DEFAULT_LOGIN_BACKGROUND;
    return [themeId, normalizeBackground(supplied || DEFAULT_LOGIN_BACKGROUND)];
  }));

  return {
    theme,
    layout,
    customizations: normalizeLoginCustomizations(input.customizations),
    background: backgrounds[theme],
    backgrounds,
  };
}

export function loginSettingsEqual(left, right) {
  return JSON.stringify(normalizeLoginSettings(left)) === JSON.stringify(normalizeLoginSettings(right));
}
