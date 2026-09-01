'use strict';

const crypto = require('crypto');

const IdempotencyKey = require('../models/IdempotencyKey');

const POS_SALE_ENDPOINT = 'POST /api/admin/pos/sales';
const POS_IDEMPOTENCY_KEY_MIN_LENGTH = 12;
const POS_IDEMPOTENCY_KEY_MAX_LENGTH = 200;

function cleanText(value, maximum = POS_IDEMPOTENCY_KEY_MAX_LENGTH) {
  return String(value || '').trim().slice(0, maximum);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function stableHash(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function createPosIdempotencyError(
  message,
  code = 'POS_IDEMPOTENCY_ERROR',
  statusCode = 409,
  details = {}
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function normalizePosIdempotencyKey(value) {
  const key = String(value || '').trim();

  if (!key) {
    throw createPosIdempotencyError(
      'La venta POS requiere la cabecera Idempotency-Key.',
      'POS_IDEMPOTENCY_KEY_REQUIRED',
      400
    );
  }

  if (
    key.length < POS_IDEMPOTENCY_KEY_MIN_LENGTH ||
    key.length > POS_IDEMPOTENCY_KEY_MAX_LENGTH ||
    !/^[A-Za-z0-9._:-]+$/.test(key)
  ) {
    throw createPosIdempotencyError(
      'La cabecera Idempotency-Key no tiene un formato válido.',
      'POS_IDEMPOTENCY_KEY_INVALID',
      400
    );
  }

  return key;
}

function buildPosSaleRequestHash(payload = {}, admin = {}) {
  return stableHash({
    version: 1,
    actor: {
      id: cleanText(admin.id || admin._id || admin.adminUserId || '', 80),
      username: cleanText(admin.username || admin.adminUsername || '', 80).toLowerCase(),
    },
    payload,
  });
}

function buildPosSaleIdempotency({ key, payload = {}, admin = {} } = {}) {
  const normalizedKey = normalizePosIdempotencyKey(key);
  return {
    key: normalizedKey,
    endpoint: POS_SALE_ENDPOINT,
    requestHash: buildPosSaleRequestHash(payload, admin),
    paymentTransactionId: `POS-${stableHash(normalizedKey).slice(0, 24).toUpperCase()}`,
  };
}

function isDuplicateKeyError(error) {
  return String(error?.code || '') === '11000';
}

async function resolveQuery(query) {
  return typeof query?.exec === 'function' ? query.exec() : query;
}

async function inspectPosSaleIdempotency(
  descriptor,
  { IdempotencyModel = IdempotencyKey } = {}
) {
  let query = IdempotencyModel.findOne({
    key: descriptor.key,
    endpoint: POS_SALE_ENDPOINT,
  });
  if (typeof query?.lean === 'function') query = query.lean();
  const record = await resolveQuery(query);

  if (!record) return { action: 'continue' };

  if (String(record.requestHash || '') !== descriptor.requestHash) {
    return {
      action: 'conflict',
      record,
      message: 'La clave de idempotencia ya fue usada con otra venta POS.',
    };
  }

  if (record.status === 'completed' && record.orderId) {
    return { action: 'reuse', record, orderId: record.orderId };
  }

  return {
    action: 'in_progress',
    record,
    message: 'La misma venta POS todavía está siendo procesada.',
  };
}

async function beginPosSaleIdempotency(
  descriptor,
  { session = null, IdempotencyModel = IdempotencyKey } = {}
) {
  try {
    const documents = await IdempotencyModel.create(
      [
        {
          key: descriptor.key,
          endpoint: POS_SALE_ENDPOINT,
          requestHash: descriptor.requestHash,
          status: 'processing',
        },
      ],
      { session }
    );
    return documents[0];
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw createPosIdempotencyError(
        'La misma venta POS ya está siendo procesada.',
        'POS_IDEMPOTENT_IN_PROGRESS',
        409
      );
    }
    throw error;
  }
}

async function completePosSaleIdempotency(
  record,
  descriptor,
  result = {},
  { session = null, IdempotencyModel = IdempotencyKey } = {}
) {
  if (!record?._id || !result?.order?._id) {
    throw createPosIdempotencyError(
      'No fue posible finalizar la protección idempotente de la venta.',
      'POS_IDEMPOTENCY_FINALIZATION_FAILED',
      500
    );
  }

  const update = await IdempotencyModel.updateOne(
    {
      _id: record._id,
      key: descriptor.key,
      endpoint: POS_SALE_ENDPOINT,
      requestHash: descriptor.requestHash,
      status: 'processing',
    },
    {
      $set: {
        status: 'completed',
        orderId: result.order._id,
        response: {
          orderId: result.order._id,
          orderNumber: result.order.orderNumber || '',
          cashSessionId: result.cashSession?._id || null,
          cashRegisterCode: result.cashRegisterCode || '',
        },
        completedAt: new Date(),
      },
    },
    { session }
  );

  if (Number(update?.matchedCount || update?.n || 0) !== 1) {
    throw createPosIdempotencyError(
      'No fue posible confirmar la protección idempotente de la venta.',
      'POS_IDEMPOTENCY_FINALIZATION_FAILED',
      500
    );
  }

  return true;
}

module.exports = {
  POS_IDEMPOTENCY_KEY_MAX_LENGTH,
  POS_IDEMPOTENCY_KEY_MIN_LENGTH,
  POS_SALE_ENDPOINT,
  beginPosSaleIdempotency,
  buildPosSaleIdempotency,
  buildPosSaleRequestHash,
  canonicalize,
  completePosSaleIdempotency,
  createPosIdempotencyError,
  inspectPosSaleIdempotency,
  isDuplicateKeyError,
  normalizePosIdempotencyKey,
  stableHash,
};
