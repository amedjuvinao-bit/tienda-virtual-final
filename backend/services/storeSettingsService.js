'use strict';

const SiteSettings = require('../models/SiteSettings');

const STORE_DEFAULTS = Object.freeze({
  name: '',
  businessName: '',
  email: '',
  phone: '',
  whatsapp: '',
  supportEmail: '',
  website: '',
  address: '',
  city: '',
  department: '',
  country: 'CO',
  timezone: 'America/Bogota',
  locale: 'es-CO',
  customerServiceHours: '',
});

const SUPPORTED_LOCALES = new Set(['es-CO', 'en-US']);

class StoreSettingsError extends Error {
  constructor(message, code, status = 400, details = []) {
    super(message);
    this.name = 'StoreSettingsError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanText(value, maxLength = 180) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function normalizeEmail(value) {
  return cleanText(value, 180).toLowerCase();
}

function normalizePhone(value) {
  const source = cleanText(value, 40);
  if (!source) return '';
  const hasLeadingPlus = source.startsWith('+');
  const digits = source.replace(/\D/g, '').slice(0, 18);
  return `${hasLeadingPlus ? '+' : ''}${digits}`;
}

function normalizeWebsite(value) {
  const source = cleanText(value, 240);
  if (!source) return '';

  try {
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol)) return source;
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return source;
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function isValidPhone(value) {
  return /^\+?\d{7,18}$/.test(String(value || ''));
}

function hasValidPhoneCharacters(value) {
  return /^[+\d\s().-]*$/.test(String(value ?? ''));
}

function isValidWebsite(value) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat('es-CO', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function normalizeStoreSettings(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : {};

  return {
    name: cleanText(source.name, 120),
    businessName: cleanText(source.businessName, 180),
    email: normalizeEmail(source.email),
    phone: normalizePhone(source.phone),
    whatsapp: normalizePhone(source.whatsapp),
    supportEmail: normalizeEmail(source.supportEmail),
    website: normalizeWebsite(source.website),
    address: cleanText(source.address, 220),
    city: cleanText(source.city, 100),
    department: cleanText(source.department, 100),
    country: cleanText(source.country || STORE_DEFAULTS.country, 2).toUpperCase(),
    timezone: cleanText(source.timezone || STORE_DEFAULTS.timezone, 80),
    locale: cleanText(source.locale || STORE_DEFAULTS.locale, 12),
    customerServiceHours: cleanText(source.customerServiceHours, 160),
  };
}

function validateStoreSettings(input = {}) {
  const store = normalizeStoreSettings(input);
  const details = [];

  if (store.name.length < 2) {
    details.push({ field: 'name', message: 'Escribe el nombre comercial de la tienda.' });
  }
  if (!isValidEmail(store.email)) {
    details.push({ field: 'email', message: 'Escribe un correo principal válido.' });
  }
  if (!hasValidPhoneCharacters(input?.phone) || !isValidPhone(store.phone)) {
    details.push({ field: 'phone', message: 'Escribe un teléfono principal válido.' });
  }
  if (
    store.whatsapp &&
    (!hasValidPhoneCharacters(input?.whatsapp) || !isValidPhone(store.whatsapp))
  ) {
    details.push({ field: 'whatsapp', message: 'Escribe un número de WhatsApp válido.' });
  }
  if (store.supportEmail && !isValidEmail(store.supportEmail)) {
    details.push({ field: 'supportEmail', message: 'Escribe un correo de atención válido.' });
  }
  if (!isValidWebsite(store.website)) {
    details.push({ field: 'website', message: 'La página web debe comenzar por http:// o https://.' });
  }
  if (store.address.length < 5) {
    details.push({ field: 'address', message: 'Escribe la dirección principal de la tienda.' });
  }
  if (store.city.length < 2) {
    details.push({ field: 'city', message: 'Escribe la ciudad principal.' });
  }
  if (store.department.length < 2) {
    details.push({ field: 'department', message: 'Escribe el departamento o región.' });
  }
  if (!/^[A-Z]{2}$/.test(store.country)) {
    details.push({ field: 'country', message: 'Selecciona un país válido.' });
  }
  if (!isValidTimezone(store.timezone)) {
    details.push({ field: 'timezone', message: 'Selecciona una zona horaria válida.' });
  }
  if (!SUPPORTED_LOCALES.has(store.locale)) {
    details.push({ field: 'locale', message: 'Selecciona un idioma regional válido.' });
  }

  if (details.length) {
    throw new StoreSettingsError(
      'Revisa los datos marcados antes de guardar.',
      'INVALID_STORE_SETTINGS',
      422,
      details
    );
  }

  return store;
}

function revisionNumber(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

function buildStoreSettingsResponse(settings) {
  return {
    ok: true,
    store: normalizeStoreSettings(settings?.store || STORE_DEFAULTS),
    revision: revisionNumber(settings?.storeRevision),
    updatedAt: settings?.updatedAt || null,
    updatedBy: cleanText(settings?.updatedBy, 180),
  };
}

async function ensureStoreSettingsDocument() {
  let settings = await SiteSettings.findOne()
    .select('store storeRevision updatedAt updatedBy')
    .lean();

  if (!settings) {
    settings = await SiteSettings.create({
      store: STORE_DEFAULTS,
      storeRevision: 0,
      updatedBy: 'system',
    });
    return settings.toObject ? settings.toObject() : settings;
  }

  return settings;
}

async function getStoreSettings() {
  return buildStoreSettingsResponse(await ensureStoreSettingsDocument());
}

async function updateStoreSettings(input, options = {}) {
  const store = validateStoreSettings(input?.store);
  const rawRevision = input?.revision;
  const expectedRevision =
    rawRevision === null || rawRevision === undefined || rawRevision === ''
      ? Number.NaN
      : Number(rawRevision);

  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new StoreSettingsError(
      'Recarga la configuración antes de guardar.',
      'STORE_REVISION_REQUIRED',
      409
    );
  }

  const current = await ensureStoreSettingsDocument();
  const currentRevision = revisionNumber(current?.storeRevision);

  if (expectedRevision !== currentRevision) {
    throw new StoreSettingsError(
      'Otra persona actualizó los datos de la tienda. Recarga para ver la versión más reciente.',
      'STORE_SETTINGS_CONFLICT',
      409,
      [{ currentRevision }]
    );
  }

  const revisionFilter = current?.storeRevision === undefined
    ? { $or: [{ storeRevision: { $exists: false } }, { storeRevision: 0 }] }
    : { storeRevision: currentRevision };
  const updated = await SiteSettings.findOneAndUpdate(
    { _id: current._id, ...revisionFilter },
    {
      $set: {
        store,
        updatedBy: cleanText(options.actor, 180) || 'admin',
      },
      $inc: { storeRevision: 1 },
    },
    { new: true, runValidators: true }
  )
    .select('store storeRevision updatedAt updatedBy')
    .lean();

  if (!updated) {
    const latest = await SiteSettings.findOne()
      .select('store storeRevision updatedAt updatedBy')
      .lean();
    throw new StoreSettingsError(
      'Otra persona actualizó los datos de la tienda. Recarga para continuar.',
      'STORE_SETTINGS_CONFLICT',
      409,
      [{ currentRevision: revisionNumber(latest?.storeRevision) }]
    );
  }

  return buildStoreSettingsResponse(updated);
}

module.exports = {
  STORE_DEFAULTS,
  SUPPORTED_LOCALES,
  StoreSettingsError,
  buildStoreSettingsResponse,
  getStoreSettings,
  normalizeStoreSettings,
  updateStoreSettings,
  validateStoreSettings,
};
