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
  cityCode: '',
  department: '',
  departmentCode: '',
  country: 'CO',
  timezone: 'America/Bogota',
  locale: 'es-CO',
  customerServiceHours: '',
  weeklySchedule: null,
});

const SUPPORTED_LOCALES = new Set(['es-CO', 'en-US']);
const WEEK_DAYS = Object.freeze([
  ['monday', 'Lunes'],
  ['tuesday', 'Martes'],
  ['wednesday', 'Miércoles'],
  ['thursday', 'Jueves'],
  ['friday', 'Viernes'],
  ['saturday', 'Sábado'],
  ['sunday', 'Domingo'],
]);

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

function normalizeTime(value) {
  const time = cleanText(value, 5);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '';
}

function normalizeWeeklySchedule(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.days)) return null;

  const sourceDays = new Map(
    value.days
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => [cleanText(entry.day, 12).toLowerCase(), entry])
  );

  return {
    version: 1,
    days: WEEK_DAYS.map(([day]) => {
      const source = sourceDays.get(day) || {};
      const enabled = source.enabled === true;
      const intervals = enabled && Array.isArray(source.intervals)
        ? source.intervals.slice(0, 2).map((interval) => ({
            open: normalizeTime(interval?.open),
            close: normalizeTime(interval?.close),
          }))
        : [];
      return { day, enabled, intervals };
    }),
  };
}

function timeLabel(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return '';
  const suffix = hours >= 12 ? 'p. m.' : 'a. m.';
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function scheduleSummary(schedule) {
  if (!schedule) return '';
  const openDays = schedule.days.filter((entry) => entry.enabled && entry.intervals.length);
  if (!openDays.length) return 'Cerrado todos los días';

  const groups = [];
  const intervalKey = (entry) => entry.intervals
    .map(({ open, close }) => `${open}-${close}`)
    .join('|');
  openDays.forEach((entry) => {
    const previous = groups[groups.length - 1];
    const previousDay = previous?.[previous.length - 1]?.day;
    const previousIndex = WEEK_DAYS.findIndex(([day]) => day === previousDay);
    const currentIndex = WEEK_DAYS.findIndex(([day]) => day === entry.day);
    if (
      previous &&
      previousIndex + 1 === currentIndex &&
      intervalKey(previous[0]) === intervalKey(entry)
    ) {
      previous.push(entry);
    } else {
      groups.push([entry]);
    }
  });

  return groups.map((group) => {
    const firstLabel = WEEK_DAYS.find(([day]) => day === group[0].day)?.[1] || group[0].day;
    const lastEntry = group[group.length - 1];
    const lastLabel = WEEK_DAYS.find(([day]) => day === lastEntry.day)?.[1] || lastEntry.day;
    const dayLabel = group.length === 1 ? firstLabel : `${firstLabel} a ${lastLabel.toLowerCase()}`;
    const intervals = group[0].intervals
      .map(({ open, close }) => `${timeLabel(open)} – ${timeLabel(close)}`)
      .join(' y ');
    return `${dayLabel}: ${intervals}`;
  }).join('; ');
}

function validateWeeklySchedule(schedule, details) {
  if (!schedule) return;

  schedule.days.forEach((entry) => {
    if (!entry.enabled) return;
    if (!entry.intervals.length) {
      details.push({
        field: 'weeklySchedule',
        message: 'Cada día activo debe tener al menos un horario.',
      });
      return;
    }

    entry.intervals.forEach((interval) => {
      if (!interval.open || !interval.close || interval.open >= interval.close) {
        details.push({
          field: 'weeklySchedule',
          message: 'La hora de cierre debe ser posterior a la hora de apertura.',
        });
      }
    });

    if (
      entry.intervals.length === 2 &&
      entry.intervals[0].close > entry.intervals[1].open
    ) {
      details.push({
        field: 'weeklySchedule',
        message: 'Los turnos de un mismo día no pueden superponerse.',
      });
    }
  });
}

function normalizeStoreSettings(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : {};

  const weeklySchedule = normalizeWeeklySchedule(source.weeklySchedule);

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
    cityCode: cleanText(source.cityCode, 20),
    department: cleanText(source.department, 100),
    departmentCode: cleanText(source.departmentCode, 20),
    country: cleanText(source.country || STORE_DEFAULTS.country, 2).toUpperCase(),
    timezone: cleanText(source.timezone || STORE_DEFAULTS.timezone, 80),
    locale: cleanText(source.locale || STORE_DEFAULTS.locale, 12),
    customerServiceHours: weeklySchedule
      ? cleanText(scheduleSummary(weeklySchedule), 1000)
      : cleanText(source.customerServiceHours, 1000),
    weeklySchedule,
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
  if (store.country === 'CO' && !/^\d{2}$/.test(store.departmentCode)) {
    details.push({ field: 'departmentCode', message: 'Selecciona un departamento del catálogo.' });
  }
  if (store.country === 'CO' && !/^\d{5}$/.test(store.cityCode)) {
    details.push({ field: 'cityCode', message: 'Selecciona un municipio del catálogo.' });
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
  validateWeeklySchedule(store.weeklySchedule, details);

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
  normalizeWeeklySchedule,
  scheduleSummary,
  updateStoreSettings,
  validateStoreSettings,
};
