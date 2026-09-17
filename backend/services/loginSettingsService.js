'use strict';

const SiteSettings = require('../models/SiteSettings');

const LOGIN_THEMES = Object.freeze([
  { value: 'roseLuxuryLight', label: 'Rosa Signature', description: 'Tema insignia de alta costura creado para la marca.' },
  { value: 'noirGallery', label: 'Noir Gallery', description: 'Galería nocturna, luz escultórica y lujo silencioso.' },
  { value: 'auroraMotion', label: 'Aurora Motion', description: 'Interfaz cinética, órbitas de luz y precisión tecnológica.' },
  { value: 'paperStudio', label: 'Paper Studio', description: 'Editorial audaz, geometría gráfica y movimiento creativo.' },
]);

const LOGIN_THEME_CUSTOMIZATIONS = Object.freeze({
  roseLuxuryLight: Object.freeze({
    primary: '#5c1733', secondary: '#8f3154', accent: '#f0d69f', surface: '#fffaf5',
    eyebrow: 'ADMINISTRACIÓN PRIVADA', headline: 'Tu universo,', highlight: 'bajo control.',
    description: 'Una entrada creada para dirigir cada detalle de la tienda con precisión, carácter y absoluta confianza.',
    welcomeTitle: 'Bienvenido', welcomeSubtitle: 'Ingresa al espacio privado de la tienda.', buttonText: 'Entrar al panel',
  }),
  noirGallery: Object.freeze({
    primary: '#0a0a0c', secondary: '#1b1b21', accent: '#f0c87c', surface: '#f3eee4',
    eyebrow: 'DIRECCIÓN CREATIVA', headline: 'El negocio,', highlight: 'en primer plano.',
    description: 'Una sala privada para observar la operación completa y decidir con absoluta claridad.',
    welcomeTitle: 'Sala privada', welcomeSubtitle: 'Identifícate para abrir la galería de control.', buttonText: 'Abrir la galería',
  }),
  auroraMotion: Object.freeze({
    primary: '#041724', secondary: '#0b3850', accent: '#64f0d1', surface: '#eafcff',
    eyebrow: 'CENTRO DE MANDO', headline: 'Decide hoy.', highlight: 'Avanza primero.',
    description: 'Toda la energía de la tienda converge en un espacio ágil, seguro y preparado para actuar.',
    welcomeTitle: 'Sincroniza tu acceso', welcomeSubtitle: 'Conecta con el centro operativo de la tienda.', buttonText: 'Iniciar conexión',
  }),
  paperStudio: Object.freeze({
    primary: '#1226aa', secondary: '#f04d2f', accent: '#f4dd52', surface: '#f7f0de',
    eyebrow: 'ESTUDIO DE OPERACIONES', headline: 'Ideas claras.', highlight: 'Decisiones rápidas.',
    description: 'Una entrada gráfica para administrar la tienda sin ruido, con ritmo y una visión completamente clara.',
    welcomeTitle: 'Entra al estudio', welcomeSubtitle: 'Tu mesa de trabajo está preparada.', buttonText: 'Comenzar ahora',
  }),
});

const LOGIN_COLOR_FIELDS = Object.freeze(['primary', 'secondary', 'accent', 'surface']);
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

const DEFAULT_LOGIN_SETTINGS = Object.freeze({
  theme: 'roseLuxuryLight',
  layout: 'centeredCard',
  customizations: LOGIN_THEME_CUSTOMIZATIONS,
  background: Object.freeze({
    mode: 'theme',
    color: '#fff7fb',
    image: '',
    imageOpacity: 0.35,
    overlay: 0.35,
  }),
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

function validHex(value) {
  return /^#[0-9a-f]{6}$/i.test(cleanText(value, 20));
}

function normalizeThemeCustomization(themeId, input = {}) {
  const defaults = LOGIN_THEME_CUSTOMIZATIONS[themeId] || LOGIN_THEME_CUSTOMIZATIONS.roseLuxuryLight;
  const normalized = {};

  LOGIN_COLOR_FIELDS.forEach((field) => {
    normalized[field] = validHex(input[field])
      ? cleanText(input[field], 20).toLowerCase()
      : defaults[field];
  });

  Object.entries(LOGIN_TEXT_LIMITS).forEach(([field, maxLength]) => {
    normalized[field] = cleanText(input[field], maxLength) || defaults[field];
  });

  return normalized;
}

function normalizeCustomizations(input = {}) {
  return Object.fromEntries(
    LOGIN_THEMES.map(({ value }) => [
      value,
      normalizeThemeCustomization(value, input?.[value] || {}),
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

function normalizeLoginSettings(input = {}) {
  const background = input?.background || {};
  const theme = cleanText(input.theme, 80);
  const layout = cleanText(input.layout, 80);
  const mode = cleanText(background.mode, 20);

  return {
    theme: optionExists(LOGIN_THEMES, theme) ? theme : DEFAULT_LOGIN_SETTINGS.theme,
    layout: optionExists(LOGIN_LAYOUTS, layout) ? layout : DEFAULT_LOGIN_SETTINGS.layout,
    customizations: normalizeCustomizations(input.customizations),
    background: {
      mode: ['theme', 'color', 'image'].includes(mode)
        ? mode
        : DEFAULT_LOGIN_SETTINGS.background.mode,
      color: /^#[0-9a-f]{6}$/i.test(cleanText(background.color, 20))
        ? cleanText(background.color, 20).toLowerCase()
        : DEFAULT_LOGIN_SETTINGS.background.color,
      image: safeImageUrl(background.image),
      imageOpacity: numberInRange(background.imageOpacity, 0.1, 1, DEFAULT_LOGIN_SETTINGS.background.imageOpacity),
      overlay: numberInRange(background.overlay, 0, 0.85, DEFAULT_LOGIN_SETTINGS.background.overlay),
    },
  };
}

function validateLoginSettings(input = {}) {
  const details = [];
  const theme = cleanText(input.theme, 80);
  const layout = cleanText(input.layout, 80);
  const background = input?.background || {};
  const mode = cleanText(background.mode, 20);

  if (!optionExists(LOGIN_THEMES, theme)) {
    details.push({ field: 'theme', message: 'Selecciona un tema disponible.' });
  }
  if (!optionExists(LOGIN_LAYOUTS, layout)) {
    details.push({ field: 'layout', message: 'Selecciona una estructura disponible.' });
  }
  if (!['theme', 'color', 'image'].includes(mode)) {
    details.push({ field: 'background.mode', message: 'Selecciona un tipo de fondo válido.' });
  }
  if (mode === 'color' && !/^#[0-9a-f]{6}$/i.test(cleanText(background.color, 20))) {
    details.push({ field: 'background.color', message: 'Selecciona un color hexadecimal válido.' });
  }
  if (mode === 'image' && !safeImageUrl(background.image)) {
    details.push({ field: 'background.image', message: 'Sube una imagen o escribe una URL válida.' });
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
    logo: cleanText(header.logoLight || logo.light || logo.dark, 2048),
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
