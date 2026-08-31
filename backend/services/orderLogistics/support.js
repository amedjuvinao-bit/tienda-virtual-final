'use strict';

const mongoose = require('mongoose');

const {
  MAX_PACKAGES,
  MAX_SHIPMENT_HISTORY,
} = require('./constants');

function cleanText(value, maxLength = 240) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function cleanLower(value, maxLength = 80) {
  return cleanText(value, maxLength).toLowerCase();
}

function idValue(value) {
  return String(value?._id || value || '').trim();
}

function asPlain(value) {
  if (!value) return {};
  return typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true })
    : { ...value };
}

function createLogisticsError(message, code, statusCode = 409, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function actorSnapshot(actor = {}) {
  const rawId = idValue(actor.id || actor.admin);
  return {
    admin: mongoose.Types.ObjectId.isValid(rawId) ? rawId : null,
    displayName: cleanText(actor.displayName || actor.label || actor.username, 120),
    role: cleanLower(actor.role, 80),
    source: cleanLower(actor.source || 'admin', 80),
  };
}

function parseOptionalDate(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createLogisticsError(
      `La fecha ${field} no es válida.`,
      'INVALID_LOGISTICS_DATE',
      400,
      { field }
    );
  }
  return parsed;
}

function normalizeTrackingUrl(value) {
  const url = cleanText(value, 1000);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('protocol');
    }
    return parsed.toString();
  } catch {
    throw createLogisticsError(
      'La URL de seguimiento debe usar HTTP o HTTPS.',
      'INVALID_TRACKING_URL',
      400
    );
  }
}

function normalizePackages(input, shipmentCode) {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_PACKAGES) {
    throw createLogisticsError(
      `Debes registrar entre 1 y ${MAX_PACKAGES} paquetes.`,
      'INVALID_SHIPMENT_PACKAGES',
      400
    );
  }

  const seen = new Set();
  return input.map((item, index) => {
    const code = cleanText(
      item?.code || `${shipmentCode}-P${String(index + 1).padStart(2, '0')}`,
      80
    ).toUpperCase();
    if (!code || seen.has(code)) {
      throw createLogisticsError(
        'Cada paquete debe tener un código único.',
        'DUPLICATE_PACKAGE_CODE',
        400,
        { code }
      );
    }
    seen.add(code);

    const boundedNumber = (value, max) => {
      const number = Number(value || 0);
      if (!Number.isFinite(number) || number < 0 || number > max) {
        throw createLogisticsError(
          `Las medidas del paquete ${code} no son válidas.`,
          'INVALID_PACKAGE_MEASUREMENT',
          400,
          { code }
        );
      }
      return number;
    };

    return {
      code,
      weightGrams: boundedNumber(item?.weightGrams, 1000000),
      lengthCm: boundedNumber(item?.lengthCm, 1000),
      widthCm: boundedNumber(item?.widthCm, 1000),
      heightCm: boundedNumber(item?.heightCm, 1000),
      labelReference: cleanText(item?.labelReference, 240),
      sealedAt: item?.sealedAt
        ? parseOptionalDate(item.sealedAt, 'sellado')
        : null,
    };
  });
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function appendShipmentHistory(shipment, entry) {
  const history = Array.isArray(shipment.history) ? shipment.history : [];
  history.push(entry);
  shipment.history = history.slice(-MAX_SHIPMENT_HISTORY);
}

module.exports = {
  cleanText,
  cleanLower,
  idValue,
  asPlain,
  createLogisticsError,
  actorSnapshot,
  parseOptionalDate,
  normalizeTrackingUrl,
  normalizePackages,
  addHours,
  appendShipmentHistory,
};
