'use strict';

const crypto = require('crypto');

const ShippingOperation = require('../../models/ShippingOperation');
const { createLogisticsError } = require('../orderLogisticsService');
const { clean, idValue } = require('./shared');

function stableHash(value) {
  const canonicalize = (item) => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.keys(item).sort().map((key) => [key, canonicalize(item[key])])
      );
    }
    return item;
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function operationIdentity({ order, shipment, provider, type } = {}) {
  return {
    orderId: idValue(order?._id),
    shipmentId: idValue(shipment?._id),
    provider: clean(provider?.key, 80).toLowerCase(),
    providerMode: clean(provider?.mode, 40).toLowerCase(),
    operationType: clean(type, 80).toLowerCase(),
  };
}

function operationRequestHash(input = {}) {
  return stableHash({
    version: 2,
    ...operationIdentity(input),
    requestPayload: input.requestPayload,
  });
}

function persistedOperationMatches(existing, input = {}) {
  const expected = operationIdentity(input);
  return (
    idValue(existing?.order) === expected.orderId &&
    idValue(existing?.shipmentId) === expected.shipmentId &&
    clean(existing?.provider, 80).toLowerCase() === expected.provider &&
    clean(existing?.mode, 40).toLowerCase() === expected.providerMode &&
    clean(existing?.type, 80).toLowerCase() === expected.operationType
  );
}

function requestMatches(existing, input, requestHash, legacyRequestHash) {
  if (clean(existing?.requestHash, 180) === requestHash) return true;

  // Compatibilidad segura con operaciones creadas antes de que la huella
  // incorporara el alcance. El hash antiguo solo se acepta si la identidad
  // persistida completa coincide con la operación actual.
  return (
    clean(existing?.requestHash, 180) === legacyRequestHash &&
    persistedOperationMatches(existing, input)
  );
}

async function inspectReservedOperation(
  existing,
  input,
  requestHash,
  legacyRequestHash
) {
  if (!requestMatches(existing, input, requestHash, legacyRequestHash)) {
    throw createLogisticsError(
      'La clave de idempotencia ya fue usada con otros datos.',
      'SHIPPING_IDEMPOTENCY_CONFLICT',
      409
    );
  }
  if (existing.status === 'succeeded') {
    return { operation: existing, replay: true };
  }
  if (existing.status === 'failed') {
    existing.status = 'processing';
    existing.attempts = Number(existing.attempts || 1) + 1;
    existing.error = {};
    existing.requestHash = requestHash;
    await existing.save();
    return { operation: existing, replay: false };
  }
  throw createLogisticsError(
    'La operación externa ya existe y requiere revisión antes de reintentar.',
    'SHIPPING_OPERATION_ALREADY_EXISTS',
    409,
    { operationId: idValue(existing._id), status: existing.status }
  );
}

async function reserveOperation(
  { order, shipment, provider, type, idempotencyKey, requestPayload },
  { OperationModel = ShippingOperation } = {}
) {
  const key = clean(idempotencyKey, 180);
  if (key.length < 12) {
    throw createLogisticsError(
      'La operación externa requiere una clave de idempotencia de al menos 12 caracteres.',
      'SHIPPING_IDEMPOTENCY_KEY_REQUIRED',
      400
    );
  }
  const identityInput = {
    order,
    shipment,
    provider,
    type,
    requestPayload,
  };
  const requestHash = operationRequestHash(identityInput);
  const legacyRequestHash = stableHash(requestPayload);
  let existing = await OperationModel.findOne({ idempotencyKey: key });
  if (existing) {
    return inspectReservedOperation(
      existing,
      identityInput,
      requestHash,
      legacyRequestHash
    );
  }
  try {
    existing = await OperationModel.create({
      order: order._id,
      shipmentId: shipment._id,
      provider: provider.key,
      mode: provider.mode,
      type,
      idempotencyKey: key,
      requestHash,
      status: 'processing',
    });
  } catch (error) {
    if (error?.code === 11000) {
      const concurrent = await OperationModel.findOne({ idempotencyKey: key });
      if (concurrent) {
        return inspectReservedOperation(
          concurrent,
          identityInput,
          requestHash,
          legacyRequestHash
        );
      }
      throw createLogisticsError(
        'La operación externa ya está siendo procesada.',
        'SHIPPING_OPERATION_IN_PROGRESS',
        409
      );
    }
    throw error;
  }
  return { operation: existing, replay: false };
}

async function recordOperationFailure(operation, error, ambiguousCodes) {
  operation.status = operation.result || ambiguousCodes.has(error?.code)
    ? 'action_required'
    : 'failed';
  operation.error = {
    code: clean(error?.code, 100),
    message: clean(error?.message, 500),
  };
  await operation.save().catch(() => {});
}

module.exports = {
  operationIdentity,
  operationRequestHash,
  persistedOperationMatches,
  recordOperationFailure,
  reserveOperation,
  stableHash,
};
