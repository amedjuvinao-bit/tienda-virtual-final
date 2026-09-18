'use strict';

const SiteSettings = require('../models/SiteSettings');

const LOGIN_THEMES = Object.freeze([
  { value: 'liquidGlass', label: 'Cristal Líquido', description: 'Volúmenes translúcidos, reflejos suaves y profundidad fluida.' },
  { value: 'immersiveGallery', label: 'Galería Inmersiva', description: 'Una imagen protagonista de la tienda con acceso flotante.' },
  { value: 'smokeGlass', label: 'Cristal Perla', description: 'Vidrio óptico claro, bordes suaves y composición central.' },
]);

const LOGIN_THEME_CUSTOMIZATIONS = Object.freeze({
  liquidGlass: Object.freeze({
    primary: '#16324a', secondary: '#876fd4', accent: '#ff8f70', surface: '#f8fdff',
    eyebrow: 'ESPACIO DE GESTIÓN', headline: 'Claridad que fluye.', highlight: 'Control sin esfuerzo.',
    description: 'Una experiencia ligera y luminosa para administrar cualquier tipo de tienda.',
    welcomeTitle: 'Hola de nuevo', welcomeSubtitle: 'Tu espacio de trabajo está listo.', buttonText: 'Continuar',
  }),
  immersiveGallery: Object.freeze({
    primary: '#111827', secondary: '#44546a', accent: '#e7d7bd', surface: '#f8fafc', imageTone: 'black',
    eyebrow: 'TU NEGOCIO, EN PRIMER PLANO', headline: 'Una entrada visual.', highlight: 'Tu identidad primero.',
    description: 'Presenta la esencia de tu tienda con una imagen propia y un acceso limpio.',
    welcomeTitle: 'Bienvenido', welcomeSubtitle: 'Ingresa para gestionar tu tienda.', buttonText: 'Ingresar',
  }),
  smokeGlass: Object.freeze({
    primary: '#102a3b', secondary: '#718896', accent: '#315d73', surface: '#f8fbfd',
    eyebrow: 'GESTIÓN PRIVADA', headline: 'Todo en orden.', highlight: 'Siempre claro.',
    description: 'Un acceso limpio y sereno para administrar tu tienda.',
    welcomeTitle: 'Bienvenido', welcomeSubtitle: 'Ingresa para gestionar tu tienda.', buttonText: 'Ingresar',
  }),
});

const LOGIN_THEME_MIGRATIONS = Object.freeze({
  orbit3d: 'liquidGlass',
  neonPortal: 'liquidGlass',
  editorialMotion: 'liquidGlass',
  architectMono: 'liquidGlass',
  roseLuxuryLight: 'immersiveGallery',
  noirGallery: 'smokeGlass',
});

const LOGIN_COLOR_FIELDS = Object.freeze(['primary', 'secondary', 'accent', 'surface']);
const LOGIN_GALLERY_IMAGE_TONES = Object.freeze(['black', 'roseGold', 'lightBlue']);
const LOGIN_TEXT_LIMITS = Object.freeze({
  eyebrow: 48,
  headline: 48,
  highlight: 48,
  description: 180,
  welcomeTitle: 48,
  welcomeSubtitle: 100,
  buttonText: 32,
});

const LOGIN_LAYOUTS = Object.freeze([
  { value: 'centeredCard', label: 'Tarjeta centrada', description: 'Acceso directo y equilibrado.' },
  { value: 'splitPanel', label: 'Panel dividido', description: 'Marca a la izquierda y acceso a la derecha.' },
  { value: 'glassFloating', label: 'Cristal flotante', description: 'Tarjeta translúcida con profundidad.' },
  { value: 'luxuryBoutique', label: 'Boutique editorial', description: 'Composición refinada y minimalista.' },
  { value: 'cyberPortal', label: 'Portal seguro', description: 'Marco tecnológico y luminoso.' },
  { value: 'electricCircle', label: 'Círculo eléctrico', description: 'Acceso dentro de un aro luminoso.' },
]);

const DEFAULT_LOGIN_BACKGROUND = Object.freeze({
  mode: 'theme',
  color: '#07132f',
  image: '',
  imageOpacity: 0.35,
  overlay: 0.35,
  glassTransparency: 0.35,
});

const DEFAULT_LOGIN_BACKGROUNDS = Object.freeze(Object.fromEntries(
  LOGIN_THEMES.map(({ value }) => [value, DEFAULT_LOGIN_BACKGROUND])
));

const DEFAULT_LOGIN_SETTINGS = Object.freeze({
  theme: 'liquidGlass',
  layout: 'centeredCard',
  customizations: LOGIN_THEME_CUSTOMIZATIONS,
  background: DEFAULT_LOGIN_BACKGROUND,
  backgrounds: DEFAULT_LOGIN_BACKGROUNDS,
});

class LoginSettingsError extends Error {
  constructor(message, code, status = 400, details = []) {
    super(message);
    this.name = 'LoginSettingsError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanText(value, maxLength = 2048) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function revisionNumber(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

function numberInRange(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function optionExists(options, value) {
  return options.some((option) => option.value === value);
}

function supportedThemeId(value) {
  if (optionExists(LOGIN_THEMES, value)) return value;
  return LOGIN_THEME_MIGRATIONS[value] || DEFAULT_LOGIN_SETTINGS.theme;
}

function customizationInput(input, themeId) {
  if (input?.[themeId]) return input[themeId];
  if (themeId === 'immersiveGallery') return input?.roseLuxuryLight || {};
  if (themeId === 'smokeGlass') return input?.noirGallery || {};
  return input?.liquidGlass || {};
}

function validHex(value) {
  return /^#[0-9a-f]{6}$/i.test(cleanText(value, 20));
}

function normalizeThemeCustomization(themeId, input = {}) {
  const defaults = LOGIN_THEME_CUSTOMIZATIONS[themeId] || LOGIN_THEME_CUSTOMIZATIONS.liquidGlass;
  const normalized = {};

  LOGIN_COLOR_FIELDS.forEach((field) => {
    normalized[field] = validHex(input[field])
      ? cleanText(input[field], 20).toLowerCase()
      : defaults[field];
  });

  Object.entries(LOGIN_TEXT_LIMITS).forEach(([field, maxLength]) => {
    normalized[field] = cleanText(input[field], maxLength) || defaults[field];
  });

  if (themeId === 'immersiveGallery') {
    normalized.imageTone = LOGIN_GALLERY_IMAGE_TONES.includes(input.imageTone)
      ? input.imageTone
      : defaults.imageTone;
  }

  return normalized;
}

function normalizeCustomizations(input = {}) {
  return Object.fromEntries(
    LOGIN_THEMES.map(({ value }) => [
      value,
      normalizeThemeCustomization(value, customizationInput(input, value)),
    ])
  );
}

function safeImageUrl(value) {
  const image = cleanText(value);
  if (!image) return '';
  if (image.startsWith('/') && !image.startsWith('//')) return image;
  try {
    const parsed = new URL(image);
    return ['https:', 'http:'].includes(parsed.protocol) ? image : '';
  } catch {
    return '';
  }
}

function normalizeBackground(input = {}) {
  const mode = cleanText(input.mode, 20);
  return {
    mode: ['theme', 'color', 'image'].includes(mode)
      ? mode
      : DEFAULT_LOGIN_BACKGROUND.mode,
    color: /^#[0-9a-f]{6}$/i.test(cleanText(input.color, 20))
      ? cleanText(input.color, 20).toLowerCase()
      : DEFAULT_LOGIN_BACKGROUND.color,
    image: safeImageUrl(input.image),
    imageOpacity: numberInRange(input.imageOpacity, 0.1, 1, DEFAULT_LOGIN_BACKGROUND.imageOpacity),
    overlay: numberInRange(input.overlay, 0, 0.85, DEFAULT_LOGIN_BACKGROUND.overlay),
    glassTransparency: numberInRange(
      input.glassTransparency,
      0,
      0.9,
      DEFAULT_LOGIN_BACKGROUND.glassTransparency
    ),
  };
}

function normalizeLoginSettings(input = {}) {
  const theme = cleanText(input.theme, 80);
  const layout = cleanText(input.layout, 80);
  const normalizedTheme = supportedThemeId(theme);
  const suppliedBackgrounds = input?.backgrounds && typeof input.backgrounds === 'object'
    ? input.backgrounds
    : {};
  const backgrounds = Object.fromEntries(LOGIN_THEMES.map(({ value: themeId }) => {
    const supplied = Object.prototype.hasOwnProperty.call(suppliedBackgrounds, themeId)
      ? suppliedBackgrounds[themeId]
      : themeId === normalizedTheme
        ? input?.background
        : DEFAULT_LOGIN_BACKGROUND;
    return [themeId, normalizeBackground(supplied || DEFAULT_LOGIN_BACKGROUND)];
  }));

  return {
    theme: normalizedTheme,
    layout: optionExists(LOGIN_LAYOUTS, layout) ? layout : DEFAULT_LOGIN_SETTINGS.layout,
    customizations: normalizeCustomizations(input.customizations),
    background: backgrounds[normalizedTheme],
    backgrounds,
  };
}

function validateBackground(background = {}, fieldPrefix = 'background') {
  const details = [];
  const mode = cleanText(background.mode, 20);
  if (!['theme', 'color', 'image'].includes(mode)) {
    details.push({ field: `${fieldPrefix}.mode`, message: 'Selecciona un tipo de fondo válido.' });
  }
  if (mode === 'color' && !/^#[0-9a-f]{6}$/i.test(cleanText(background.color, 20))) {
    details.push({ field: `${fieldPrefix}.color`, message: 'Selecciona un color hexadecimal válido.' });
  }
  if (mode === 'image' && !safeImageUrl(background.image)) {
    details.push({ field: `${fieldPrefix}.image`, message: 'Sube una imagen o escribe una URL válida.' });
  }
  return details;
}

function validateLoginSettings(input = {}) {
  const details = [];
  const theme = cleanText(input.theme, 80);
  const layout = cleanText(input.layout, 80);

  if (!optionExists(LOGIN_THEMES, theme) && !LOGIN_THEME_MIGRATIONS[theme]) {
    details.push({ field: 'theme', message: 'Selecciona un tema disponible.' });
  }
  if (!optionExists(LOGIN_LAYOUTS, layout)) {
    details.push({ field: 'layout', message: 'Selecciona una estructura disponible.' });
  }
  const suppliedBackgrounds = input?.backgrounds && typeof input.backgrounds === 'object'
    ? input.backgrounds
    : null;
  if (suppliedBackgrounds) {
    const normalizedTheme = supportedThemeId(theme);
    for (const { value: themeId } of LOGIN_THEMES) {
      if (Object.prototype.hasOwnProperty.call(suppliedBackgrounds, themeId)) {
        details.push(...validateBackground(suppliedBackgrounds[themeId], `backgrounds.${themeId}`));
      }
    }
    if (
      !Object.prototype.hasOwnProperty.call(suppliedBackgrounds, normalizedTheme)
      && input?.background
    ) {
      details.push(...validateBackground(input.background));
    }
  } else {
    details.push(...validateBackground(input?.background || {}));
  }

  for (const { value: themeId } of LOGIN_THEMES) {
    const customization = input?.customizations?.[themeId];
    if (!customization) continue;

    for (const field of LOGIN_COLOR_FIELDS) {
      if (customization[field] !== undefined && !validHex(customization[field])) {
        details.push({
          field: `customizations.${themeId}.${field}`,
          message: 'Selecciona un color válido.',
        });
      }
    }

    for (const [field, maxLength] of Object.entries(LOGIN_TEXT_LIMITS)) {
      if (String(customization[field] || '').trim().length > maxLength) {
        details.push({
          field: `customizations.${themeId}.${field}`,
          message: `Usa máximo ${maxLength} caracteres.`,
        });
      }
    }

    if (
      themeId === 'immersiveGallery'
      && customization.imageTone !== undefined
      && !LOGIN_GALLERY_IMAGE_TONES.includes(customization.imageTone)
    ) {
      details.push({
        field: 'customizations.immersiveGallery.imageTone',
        message: 'Selecciona una tonalidad disponible.',
      });
    }
  }

  return details;
}

function plain(value) {
  if (!value) return {};
  return typeof value.toObject === 'function' ? value.toObject() : { ...value };
}

function storeIdentity(document = {}) {
  const raw = plain(document);
  const store = plain(raw.store);
  const theme = plain(raw.theme);
  const header = plain(theme.header);
  const logo = plain(theme.logo);
  return {
    name: cleanText(store.name, 120) || 'Tu tienda',
    logo: cleanText(header.logoLight || header.logoDark || logo.light || logo.dark, 2048),
  };
}

function buildResponse(document) {
  const raw = plain(document);
  return {
    ok: true,
    settings: normalizeLoginSettings(raw.loginAdmin || {}),
    revision: revisionNumber(raw.loginAdminRevision),
    updatedAt: raw.updatedAt || null,
    updatedBy: cleanText(raw.updatedBy, 120) || null,
    store: storeIdentity(raw),
    meta: {
      themes: LOGIN_THEMES,
      layouts: LOGIN_LAYOUTS,
      backgroundModes: [
        { value: 'theme', label: 'Fondo del tema' },
        { value: 'color', label: 'Color sólido' },
        { value: 'image', label: 'Imagen personalizada' },
      ],
      defaults: DEFAULT_LOGIN_SETTINGS,
    },
  };
}

async function getDocument(Model = SiteSettings) {
  let document = await Model.findOne();
  if (!document) document = await Model.create({});
  return document;
}

async function getLoginSettings(options = {}) {
  const Model = options.SiteSettingsModel || SiteSettings;
  return buildResponse(await getDocument(Model));
}

async function updateLoginSettings(input = {}, options = {}) {
  const Model = options.SiteSettingsModel || SiteSettings;
  const document = await getDocument(Model);
  const currentRevision = revisionNumber(document.loginAdminRevision);
  const requestedRevision = Number(input.revision);

  if (!Number.isInteger(requestedRevision) || requestedRevision !== currentRevision) {
    throw new LoginSettingsError(
      'La configuración cambió en otra sesión. Recarga antes de guardar.',
      'LOGIN_SETTINGS_CONFLICT',
      409,
      [{ currentRevision }]
    );
  }

  const requestedSettings = input.settings || input.loginAdmin || {};
  const details = validateLoginSettings(requestedSettings);
  if (details.length) {
    throw new LoginSettingsError(
      'Revisa los campos marcados antes de guardar.',
      'LOGIN_SETTINGS_INVALID',
      422,
      details
    );
  }

  const normalized = normalizeLoginSettings(requestedSettings);
  const query = { _id: document._id };
  if (currentRevision === 0) {
    query.$or = [
      { loginAdminRevision: 0 },
      { loginAdminRevision: { $exists: false } },
    ];
  } else {
    query.loginAdminRevision = currentRevision;
  }

  const updated = await Model.findOneAndUpdate(
    query,
    {
      $set: {
        loginAdmin: normalized,
        updatedBy: cleanText(options.actor, 120) || 'admin',
      },
      $inc: { loginAdminRevision: 1 },
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new LoginSettingsError(
      'La configuración cambió en otra sesión. Recarga antes de guardar.',
      'LOGIN_SETTINGS_CONFLICT',
      409
    );
  }

  const response = buildResponse(updated);
  response.message = 'El diseño del acceso administrativo quedó guardado para todos los dispositivos.';
  return response;
}

module.exports = {
  DEFAULT_LOGIN_SETTINGS,
  LOGIN_LAYOUTS,
  LOGIN_THEMES,
  LOGIN_THEME_CUSTOMIZATIONS,
  LoginSettingsError,
  buildResponse,
  getLoginSettings,
  normalizeLoginSettings,
  safeImageUrl,
  updateLoginSettings,
  validateLoginSettings,
};
