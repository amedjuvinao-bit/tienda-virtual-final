'use strict';

const IdempotencyKey = require('../models/IdempotencyKey');
const Order = require('../models/Order');

const ORDER_CREATION_ENDPOINT = 'POST /orders';
const IDEMPOTENCY_STALE_MS = 2 * 60 * 1000;

function isIdempotencyRecordStale(record) {
  if (!record) return false;

  const updatedAt = record.updatedAt ? new Date(record.updatedAt).getTime() : 0;
  const createdAt = record.createdAt ? new Date(record.createdAt).getTime() : 0;
  const baseTime = updatedAt || createdAt;

  return Boolean(baseTime) && Date.now() - baseTime > IDEMPOTENCY_STALE_MS;
}

function isDuplicateKeyError(error) {
  return String(error?.code || '') === '11000';
}

function isDuplicateOrderNumberError(error) {
  if (!isDuplicateKeyError(error)) return false;

  const keyPattern =
    error?.keyPattern && typeof error.keyPattern === 'object'
      ? error.keyPattern
      : {};
  const keyValue =
    error?.keyValue && typeof error.keyValue === 'object'
      ? error.keyValue
      : {};

  if (keyPattern.orderNumber === 1) return true;
  if (Object.prototype.hasOwnProperty.call(keyValue, 'orderNumber')) return true;
  return /orderNumber/i.test(String(error?.message || ''));
}

function canReuseMutableOrderData(order) {
  const status = String(order?.status || '').trim().toLowerCase();
  const paymentStatus = String(order?.payment?.status || '')
    .trim()
    .toLowerCase();

  if (status === 'paid' || paymentStatus === 'paid') return false;
  return status === 'pending' || status === 'processing';
}

async function syncExistingOrderForRetry(
  orderId,
  _cleaned,
  { session, OrderModel = Order } = {}
) {
  const order = await OrderModel.findById(orderId).session(session);
  if (!order) return null;
  // Una repetición idempotente devuelve la fotografía original. Nunca mezcla
  // datos de una solicitud posterior con una orden ya persistida.
  return typeof order.toObject === 'function' ? order.toObject() : order;
}

async function inspectExistingIdempotency(
  { key, requestHash },
  { IdempotencyModel = IdempotencyKey } = {}
) {
  const record = await IdempotencyModel.findOne({
    key,
    endpoint: ORDER_CREATION_ENDPOINT,
  });
  if (!record) return { action: 'continue' };

  const sameRequestHash =
    String(record.requestHash || '') === String(requestHash || '');

  if (record.status === 'completed' && record.orderId) {
    if (!sameRequestHash) {
      return {
        action: 'conflict',
        message: 'La clave de idempotencia ya fue usada con otro payload.',
      };
    }
    return { action: 'reuse', orderId: record.orderId };
  }

  if (record.status === 'processing') {
    if (!sameRequestHash) {
      return {
        action: 'conflict',
        message:
          'La clave de idempotencia ya está siendo usada con otro payload.',
      };
    }

    if (!isIdempotencyRecordStale(record)) {
      return { action: 'in_progress' };
    }

    record.status = 'failed';
    await record.save();
  }

  if (record.status === 'failed') {
    if (!sameRequestHash) {
      return {
        action: 'conflict',
        message:
          'La clave de idempotencia fallida pertenece a otro payload.',
      };
    }
    await IdempotencyModel.deleteOne({ _id: record._id });
  }

  return { action: 'continue' };
}

async function beginIdempotencyRecord({ key, requestHash, session }) {
  if (!key) return null;

  try {
    const documents = await IdempotencyKey.create(
      [
        {
          key,
          endpoint: ORDER_CREATION_ENDPOINT,
          requestHash,
          status: 'processing',
          createdAt: new Date(),
        },
      ],
      { session }
    );
    return Array.isArray(documents) ? documents[0] : null;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw Object.assign(new Error('IDEMPOTENT_IN_PROGRESS'), {
        code: 'IDEMPOTENT_IN_PROGRESS',
      });
    }
    throw error;
  }
}

async function completeIdempotencyRecord(
  record,
  { order, reservation, pricing },
  { session } = {}
) {
  if (!record) {
    throw Object.assign(
      new Error('No se pudo finalizar el registro de idempotencia.'),
      { code: 'IDEMPOTENCY_FINALIZATION_FAILED' }
    );
  }

  record.status = 'completed';
  record.orderId = order._id;
  record.response = {
    _id: order._id,
    orderNumber: order.orderNumber,
    reservationId: reservation?._id || null,
    reservationCode: reservation?.reservationCode || '',
    subtotal: pricing.subtotal,
    discount: pricing.totalDiscount,
    tax: pricing.tax.amount,
    shipping: pricing.shipping,
    total: pricing.total,
  };
  record.completedAt = new Date();
  await record.save({ session });

  if (record.status !== 'completed') {
    throw Object.assign(
      new Error('El registro de idempotencia no quedó completado.'),
      { code: 'IDEMPOTENCY_FINALIZATION_FAILED' }
    );
  }
}

async function markIdempotencyFailed(key) {
  if (!key) return;
  await IdempotencyKey.updateOne(
    { key, endpoint: ORDER_CREATION_ENDPOINT, status: 'processing' },
    { $set: { status: 'failed' } }
  );
}

async function findCompletedOrder(key) {
  return IdempotencyKey.findOne({
    key,
    endpoint: ORDER_CREATION_ENDPOINT,
  }).lean();
}

module.exports = {
  ORDER_CREATION_ENDPOINT,
  beginIdempotencyRecord,
  canReuseMutableOrderData,
  completeIdempotencyRecord,
  findCompletedOrder,
  inspectExistingIdempotency,
  isDuplicateKeyError,
  isDuplicateOrderNumberError,
  isIdempotencyRecordStale,
  markIdempotencyFailed,
  syncExistingOrderForRetry,
};
