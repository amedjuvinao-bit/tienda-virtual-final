'use strict';

const SiteSettings = require('../models/SiteSettings');
const {
  cleanText,
  normalizeShippingRates,
  normalizeText,
} = require('../lib/shipping/shippingRateRules');

class ShippingRatesError extends Error {
  constructor(message, code, status = 400, details = []) {
    super(message);
    this.name = 'ShippingRatesError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function revisionNumber(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

function locationKey(zone) {
  return [
    zone.countryCode || normalizeText(zone.country),
    zone.departmentCode || normalizeText(zone.department),
    zone.cityCode || normalizeText(zone.city),
  ].join('|');
}

function validateShippingRates(input = {}) {
  const settings = normalizeShippingRates(input);
  const details = [];

  if (Array.isArray(input?.zones) && input.zones.length > 100) {
    details.push({ field: 'zones', message: 'Solo se permiten hasta 100 reglas de destino.' });
  }

  if (settings.freeShipping.enabled && !(settings.freeShipping.minimum > 0)) {
    details.push({
      field: 'freeShipping.minimum',
      message: 'Define una compra mínima mayor que cero para habilitar el envío gratis.',
    });
  }

  if (settings.active && settings.mode === 'fixed' && !(settings.fixedPrice > 0)) {
    details.push({
      field: 'fixedPrice',
      message: 'La tarifa fija debe ser mayor que cero. Para envío gratuito, desactiva el cobro.',
    });
  }

  const locations = new Set();
  settings.zones.forEach((zone, index) => {
    const prefix = `zones.${index}`;
    if (!zone.countryCode && !zone.country) {
      details.push({ field: `${prefix}.countryCode`, message: 'Selecciona el país.' });
    }
    if (!zone.departmentCode && !zone.department) {
      details.push({ field: `${prefix}.departmentCode`, message: 'Selecciona el departamento o región.' });
    }
    if (!zone.cityCode && !zone.city) {
      details.push({ field: `${prefix}.cityCode`, message: 'Selecciona el municipio o ciudad.' });
    }
    if (zone.countryCode === 'CO' && !/^\d{2}$/.test(zone.departmentCode)) {
      details.push({ field: `${prefix}.departmentCode`, message: 'Selecciona un departamento colombiano válido.' });
    }
    if (zone.countryCode === 'CO' && !/^\d{5}$/.test(zone.cityCode)) {
      details.push({ field: `${prefix}.cityCode`, message: 'Selecciona un municipio colombiano válido.' });
    }
    if (!(zone.price > 0)) {
      details.push({ field: `${prefix}.price`, message: 'La tarifa del destino debe ser mayor que cero.' });
    }

    const key = locationKey(zone);
    if (locations.has(key)) {
      details.push({ field: `${prefix}.cityCode`, message: 'Este destino ya tiene una tarifa configurada.' });
    }
    locations.add(key);
  });

  if (settings.active && settings.mode === 'zones') {
    if (!settings.zones.length) {
      details.push({ field: 'zones', message: 'Agrega al menos un destino con tarifa especial.' });
    }
    if (!(settings.fallback.price > 0)) {
      details.push({
        field: 'fallback.price',
        message: 'La tarifa de respaldo debe ser mayor que cero para evitar envíos gratuitos accidentales.',
      });
    }
  }

  if (details.length) {
    throw new ShippingRatesError(
      'Revisa las tarifas marcadas antes de guardar.',
      'INVALID_SHIPPING_RATES',
      422,
      details
    );
  }
  return settings;
}

function buildReadiness(settings, store = {}) {
  const rates = normalizeShippingRates(settings);
  const originReady = Boolean(
    cleanText(store.address) &&
    cleanText(store.city) &&
    cleanText(store.department) &&
    cleanText(store.country)
  );
  const ratesReady = !rates.active || (
    rates.mode === 'fixed'
      ? rates.fixedPrice > 0
      : rates.zones.length > 0 && rates.fallback.price > 0
  );
  const freeShippingReady = !rates.freeShipping.enabled || rates.freeShipping.minimum > 0;
  return {
    ready: ratesReady && freeShippingReady,
    ratesReady,
    freeShippingReady,
    originReady,
    zoneCount: rates.zones.length,
  };
}

function buildShippingRatesResponse(document) {
  const settings = normalizeShippingRates(document?.theme?.global?.envios || {});
  const store = document?.store || {};
  return {
    ok: true,
    settings,
    revision: revisionNumber(document?.shippingRatesRevision),
    readiness: buildReadiness(settings, store),
    store: {
      name: cleanText(store.name, 120),
      address: cleanText(store.address, 220),
      city: cleanText(store.city, 100),
      cityCode: cleanText(store.cityCode, 20),
      department: cleanText(store.department, 100),
      departmentCode: cleanText(store.departmentCode, 20),
      country: cleanText(store.country, 2).toUpperCase(),
    },
    updatedAt: document?.updatedAt || null,
    updatedBy: cleanText(document?.updatedBy, 180),
  };
}

async function ensureShippingRatesDocument({ SiteSettingsModel = SiteSettings } = {}) {
  let document = await SiteSettingsModel.findOne()
    .select('theme.global.envios shippingRatesRevision store updatedAt updatedBy')
    .lean();
  if (!document) {
    document = await SiteSettingsModel.create({
      theme: { global: { envios: normalizeShippingRates({}) } },
      shippingRatesRevision: 0,
      updatedBy: 'system',
    });
    return document.toObject ? document.toObject() : document;
  }
  return document;
}

async function getShippingRates(dependencies = {}) {
  return buildShippingRatesResponse(await ensureShippingRatesDocument(dependencies));
}

async function updateShippingRates(input = {}, options = {}) {
  const SiteSettingsModel = options.SiteSettingsModel || SiteSettings;
  const rawRevision = input.revision;
  const expectedRevision = rawRevision === '' || rawRevision === null || rawRevision === undefined
    ? Number.NaN
    : Number(rawRevision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new ShippingRatesError(
      'Recarga las tarifas antes de guardar.',
      'SHIPPING_RATES_REVISION_REQUIRED',
      409
    );
  }

  const current = await ensureShippingRatesDocument({ SiteSettingsModel });
  const currentRevision = revisionNumber(current.shippingRatesRevision);
  if (expectedRevision !== currentRevision) {
    throw new ShippingRatesError(
      'Otra persona actualizó las tarifas. Recarga la versión más reciente.',
      'SHIPPING_RATES_CONFLICT',
      409,
      [{ currentRevision }]
    );
  }

  const settings = validateShippingRates(input.settings);
  const revisionFilter = current.shippingRatesRevision === undefined
    ? { $or: [{ shippingRatesRevision: { $exists: false } }, { shippingRatesRevision: 0 }] }
    : { shippingRatesRevision: currentRevision };
  const updated = await SiteSettingsModel.findOneAndUpdate(
    { _id: current._id, ...revisionFilter },
    {
      $set: {
        'theme.global.envios': settings,
        updatedBy: cleanText(options.actor, 180) || 'admin',
      },
      $inc: { shippingRatesRevision: 1 },
    },
    { new: true, runValidators: false, strict: false }
  )
    .select('theme.global.envios shippingRatesRevision store updatedAt updatedBy')
    .lean();

  if (!updated) {
    const latest = await SiteSettingsModel.findOne().select('shippingRatesRevision').lean();
    throw new ShippingRatesError(
      'Otra persona actualizó las tarifas. Recarga para continuar.',
      'SHIPPING_RATES_CONFLICT',
      409,
      [{ currentRevision: revisionNumber(latest?.shippingRatesRevision) }]
    );
  }
  return buildShippingRatesResponse(updated);
}

module.exports = {
  ShippingRatesError,
  buildReadiness,
  buildShippingRatesResponse,
  getShippingRates,
  updateShippingRates,
  validateShippingRates,
};
