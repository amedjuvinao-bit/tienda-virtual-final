'use strict';

const SiteSettings = require('../models/SiteSettings');

const LOGIN_THEMES = Object.freeze([
  { value: 'roseLuxuryLight', label: 'Rosa luxury claro', description: 'Claro, elegante y boutique.' },
  { value: 'goldBoutiqueLight', label: 'Dorado boutique claro', description: 'Crema y dorado con lujo suave.' },
  { value: 'glassPastel', label: 'Glass pastel', description: 'Cristal moderno y delicado.' },
  { value: 'pearlFuture', label: 'Perla futurista', description: 'Blanco perla con brillo azul.' },
  { value: 'neonRoseLight', label: 'Rosa neón claro', description: 'Fucsia luminoso y moderno.' },
  { value: 'minimalPro', label: 'Minimal profesional', description: 'Limpio, serio y corporativo.' },
  { value: 'electricNeon', label: 'Neón eléctrico', description: 'Oscuro tecnológico con brillo azul.' },
  { value: 'darkCyber', label: 'Oscuro cyber', description: 'Profundo, elegante y tecnológico.' },
]);

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
  LoginSettingsError,
  buildResponse,
  getLoginSettings,
  normalizeLoginSettings,
  safeImageUrl,
  updateLoginSettings,
  validateLoginSettings,
};
