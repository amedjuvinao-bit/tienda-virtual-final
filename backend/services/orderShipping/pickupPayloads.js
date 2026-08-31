'use strict';

const { createLogisticsError } = require('../orderLogisticsService');
const { clean } = require('./shared');

function pickupOnGeneratePayload(payload, requestedDate) {
  const packages = Array.isArray(payload?.packages) ? payload.packages : [];
  const totalPackages = packages.reduce(
    (total, item) => total + Math.max(1, Number(item?.amount || 1)),
    0
  );
  const totalWeight = packages.reduce(
    (total, item) => total + (Math.max(0, Number(item?.weight || 0)) * Math.max(1, Number(item?.amount || 1))),
    0
  );
  return {
    ...payload,
    shipment: {
      ...(payload.shipment || {}),
      pickup: {
        date: requestedDate,
        totalPackages: Math.max(1, totalPackages),
        totalWeight: Number(totalWeight.toFixed(3)),
      },
    },
  };
}

function pickupDate(value, now = new Date()) {
  const normalized = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createLogisticsError(
      'Selecciona una fecha válida para la recolección.',
      'SHIPPING_PICKUP_DATE_INVALID',
      422
    );
  }
  const parsed = new Date(`${normalized}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw createLogisticsError(
      'Selecciona una fecha válida para la recolección.',
      'SHIPPING_PICKUP_DATE_INVALID',
      422
    );
  }
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  if (normalized < today) {
    throw createLogisticsError(
      'La recolección no puede programarse en una fecha anterior a hoy.',
      'SHIPPING_PICKUP_DATE_PAST',
      422
    );
  }
  return normalized;
}

function pickupTime(value, field) {
  const normalized = clean(value, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw createLogisticsError(
      `Selecciona una hora válida para ${field}.`,
      'SHIPPING_PICKUP_TIME_INVALID',
      422,
      { field }
    );
  }
  return normalized;
}

function pickupHour(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number((hours + (minutes / 60)).toFixed(2));
}

function pickupDisplayTime(value, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue >= 24) {
    return clean(value || fallback, 20);
  }
  const totalMinutes = Math.round(numericValue * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function pickupPackageTotals(packages = []) {
  return (Array.isArray(packages) ? packages : []).reduce(
    (totals, item) => {
      const amount = Math.max(1, Number(item?.amount || 1));
      totals.totalPackages += amount;
      totals.totalWeight += Math.max(0, Number(item?.weight || 0)) * amount;
      return totals;
    },
    { totalPackages: 0, totalWeight: 0 }
  );
}

function buildStandalonePickupPayload({
  shipmentPayload,
  carrier,
  trackingNumber,
  requestedDate,
  timeFrom,
  timeTo,
  instructions,
} = {}) {
  const packageTotals = pickupPackageTotals(shipmentPayload?.packages);
  return {
    origin: shipmentPayload?.origin || {},
    shipment: {
      type: 1,
      carrier,
      pickup: {
        weightUnit: 'KG',
        totalWeight: Number(packageTotals.totalWeight.toFixed(3)),
        totalPackages: Math.max(1, packageTotals.totalPackages),
        date: requestedDate,
        timeFrom: pickupHour(timeFrom),
        timeTo: pickupHour(timeTo),
        carrier,
        trackingNumbers: [trackingNumber],
        ...(clean(instructions, 500)
          ? { instructions: clean(instructions, 500) }
          : {}),
      },
    },
  };
}

function pickupConfirmation(result = {}) {
  const nested = result.pickup || result.pickupResponse || result.pickupData || {};
  return clean(
    result.confirmation ||
    result.confirmationNumber ||
    result.pickupConfirmation ||
    result.pickupNumber ||
    result.folio ||
    result.id ||
    nested.confirmation ||
    nested.confirmationNumber ||
    nested.pickupConfirmation ||
    nested.pickupNumber ||
    nested.folio ||
    nested.id,
    180
  );
}

module.exports = {
  buildStandalonePickupPayload,
  pickupConfirmation,
  pickupDate,
  pickupDisplayTime,
  pickupOnGeneratePayload,
  pickupTime,
};
