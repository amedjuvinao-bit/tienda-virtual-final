'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const Order = require('../models/Order');
const StoreCredit = require('../models/StoreCredit');
const StoreCreditUsage = require('../models/StoreCreditUsage');
const { getCartAccessSecret } = require('./cartAccessService');

const STORE_CREDIT_ACCESS_VERSION = 1;
const STORE_CREDIT_ACCESS_TTL_MS = 10 * 60 * 1000;
const STORE_CREDIT_RESERVATION_TTL_MS = 20 * 60 * 1000;

function cleanText(value, maximum = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanLower(value, maximum = 500) {
  return cleanText(value, maximum).toLowerCase();
}

function cleanUpper(value, maximum = 500) {
  return cleanText(value, maximum).toUpperCase();
}

function onlyDigits(value) {
  return cleanText(value, 100).replace(/\D/g, '');
}

function cleanPhone(value) {
  return cleanText(value, 100).replace(/[^0-9+]/g, '');
}

function cleanMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function customerKey(customerId) {
  return `customer:${idValue(customerId)}`;
}

function storeCreditError(message, code, statusCode = 409, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return Boolean(
    leftBuffer.length &&
      leftBuffer.length === rightBuffer.length &&
      crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function signAccessPayload(encoded, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`store-credit-access:v${STORE_CREDIT_ACCESS_VERSION}|${encoded}`)
    .digest('base64url');
}

function customerAccessFingerprint(customerId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`store-credit-customer|${idValue(customerId)}`)
    .digest('base64url');
}

function issueStoreCreditAccess(
  { customerId, sessionId, currency = 'COP', expiresAt } = {},
  { secret = getCartAccessSecret() } = {}
) {
  const customer = idValue(customerId);
  const safeSessionId = cleanText(sessionId, 120);
  const expiry = new Date(expiresAt || Date.now() + STORE_CREDIT_ACCESS_TTL_MS);
  if (
    !mongoose.Types.ObjectId.isValid(customer) ||
    !safeSessionId ||
    Number.isNaN(expiry.getTime())
  ) {
    throw new TypeError('No fue posible autorizar la consulta del saldo.');
  }
  const encoded = encodePayload({
    v: STORE_CREDIT_ACCESS_VERSION,
    customer: customerAccessFingerprint(customer, secret),
    sessionId: safeSessionId,
    currency: cleanUpper(currency || 'COP', 12) || 'COP',
    expiresAt: expiry.toISOString(),
  });
  return `sc1_${encoded}.${signAccessPayload(encoded, secret)}`;
}

function verifyStoreCreditAccess(
  token,
  { customerId, sessionId, currency = 'COP', now = new Date() } = {},
  { secret = getCartAccessSecret() } = {}
) {
  const match = /^sc1_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(
    cleanText(token, 2000)
  );
  if (!match) return { valid: false, reason: 'format' };
  const payload = decodePayload(match[1]);
  const expiresAt = new Date(payload?.expiresAt || 0);
  const valid = Boolean(
    payload?.v === STORE_CREDIT_ACCESS_VERSION &&
      safeEqual(
        payload?.customer,
        customerAccessFingerprint(customerId, secret)
      ) &&
      cleanText(payload.sessionId, 120) === cleanText(sessionId, 120) &&
      cleanUpper(payload.currency, 12) === cleanUpper(currency || 'COP', 12) &&
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt > new Date(now) &&
      safeEqual(match[2], signAccessPayload(match[1], secret))
  );
  return { valid, reason: valid ? '' : 'invalid', payload: valid ? payload : null };
}

function contactFilters({ emailOrPhone = '', phone = '' } = {}) {
  const rawContact = cleanText(emailOrPhone, 220);
  const email = rawContact.includes('@') ? cleanLower(rawContact, 220) : '';
  const normalizedPhone = cleanPhone(phone || (!email ? rawContact : ''));
  return [
    email ? { normalizedEmail: email } : null,
    normalizedPhone && normalizedPhone.replace(/\D/g, '').length >= 7
      ? { normalizedPhone }
      : null,
  ].filter(Boolean);
}

async function previewCustomerStoreCredit(
  {
    documentNumber,
    emailOrPhone,
    phone,
    sessionId,
    currency = 'COP',
    now = new Date(),
  } = {},
  {
    CustomerModel = Customer,
    StoreCreditModel = StoreCredit,
    secret = getCartAccessSecret(),
  } = {}
) {
  const document = onlyDigits(documentNumber);
  const contacts = contactFilters({ emailOrPhone, phone });
  const safeCurrency = cleanUpper(currency || 'COP', 12) || 'COP';
  if (document.length < 4 || !contacts.length) {
    return { eligible: false, balance: 0, currency: safeCurrency };
  }

  const customer = await CustomerModel.findOne({
    normalizedDocument: document,
    deletedAt: null,
    active: true,
    $or: contacts,
  }).lean();
  if (!customer) {
    return { eligible: false, balance: 0, currency: safeCurrency };
  }

  const credits = await StoreCreditModel.find({
    customerKey: customerKey(customer._id),
    currency: safeCurrency,
    status: 'active',
    balance: { $gt: 0 },
    expiresAt: { $gt: now },
  })
    .sort({ expiresAt: 1, issuedAt: 1 })
    .select('balance expiresAt')
    .lean();
  const balance = cleanMoney(
    credits.reduce((sum, credit) => sum + cleanMoney(credit.balance), 0)
  );
  if (balance <= 0) {
    return { eligible: false, balance: 0, currency: safeCurrency };
  }

  const expiresAt = new Date(now.getTime() + STORE_CREDIT_ACCESS_TTL_MS);
  return {
    eligible: true,
    balance,
    currency: safeCurrency,
    accessToken: issueStoreCreditAccess(
      { customerId: customer._id, sessionId, currency: safeCurrency, expiresAt },
      { secret }
    ),
    accessExpiresAt: expiresAt,
    nearestCreditExpiration: credits[0]?.expiresAt || null,
  };
}

async function reserveStoreCreditForOrder(
  {
    order,
    customerId,
    sessionId,
    currency = 'COP',
    requestedAmount,
    orderTotal,
    accessToken,
    expiresAt,
    now = new Date(),
  } = {},
  {
    session,
    StoreCreditModel = StoreCredit,
    StoreCreditUsageModel = StoreCreditUsage,
    secret = getCartAccessSecret(),
  } = {}
) {
  if (!session) throw new TypeError('La reserva de saldo exige una transacción.');
  const orderId = idValue(order?._id || order);
  const safeCustomerId = idValue(customerId);
  const safeCurrency = cleanUpper(currency || 'COP', 12) || 'COP';
  const amount = cleanMoney(requestedAmount);
  const total = cleanMoney(orderTotal);
  if (
    !mongoose.Types.ObjectId.isValid(orderId) ||
    !mongoose.Types.ObjectId.isValid(safeCustomerId)
  ) {
    throw storeCreditError(
      'No fue posible vincular el saldo con el cliente y la orden.',
      'STORE_CREDIT_CUSTOMER_REQUIRED',
      422
    );
  }
  if (amount <= 0 || amount > total) {
    throw storeCreditError(
      'El saldo solicitado no es válido para esta compra.',
      'STORE_CREDIT_AMOUNT_INVALID',
      422,
      { requestedAmount: amount, orderTotal: total }
    );
  }
  const access = verifyStoreCreditAccess(
    accessToken,
    {
      customerId: safeCustomerId,
      sessionId,
      currency: safeCurrency,
      now,
    },
    { secret }
  );
  if (!access.valid) {
    throw storeCreditError(
      'Vuelve a comprobar tu saldo antes de utilizarlo.',
      'STORE_CREDIT_ACCESS_EXPIRED',
      409
    );
  }

  const existing = await StoreCreditUsageModel.findOne({ order: orderId }).session(
    session
  );
  if (existing) return existing;

  const credits = await StoreCreditModel.find({
    customerKey: customerKey(safeCustomerId),
    currency: safeCurrency,
    status: 'active',
    balance: { $gt: 0 },
    expiresAt: { $gt: now },
  })
    .sort({ expiresAt: 1, issuedAt: 1 })
    .session(session);
  const available = cleanMoney(
    credits.reduce((sum, credit) => sum + cleanMoney(credit.balance), 0)
  );
  if (available < amount) {
    throw storeCreditError(
      'Tu saldo cambió. Vuelve a consultarlo antes de pagar.',
      'STORE_CREDIT_BALANCE_CHANGED',
      409,
      { availableBalance: available }
    );
  }

  let remaining = amount;
  const allocations = [];
  let nearestExpiration = null;
  for (const credit of credits) {
    if (remaining <= 0) break;
    const before = cleanMoney(credit.balance);
    const take = cleanMoney(Math.min(before, remaining));
    if (take <= 0) continue;
    const updated = await StoreCreditModel.findOneAndUpdate(
      {
        _id: credit._id,
        status: 'active',
        expiresAt: { $gt: now },
        balance: { $gte: take },
      },
      { $inc: { balance: -take, revision: 1 } },
      { new: true, session, runValidators: true }
    );
    if (!updated) {
      throw storeCreditError(
        'Tu saldo cambió mientras se reservaba. Intenta nuevamente.',
        'STORE_CREDIT_CONCURRENT_CHANGE',
        409
      );
    }
    const after = cleanMoney(updated.balance);
    if (after <= 0) {
      updated.status = 'depleted';
      await updated.save({ session });
    }
    allocations.push({
      credit: credit._id,
      creditNumber: credit.creditNumber,
      amount: take,
      balanceBefore: before,
      balanceAfter: after,
    });
    remaining = cleanMoney(remaining - take);
    const creditExpiry = new Date(credit.expiresAt);
    if (!nearestExpiration || creditExpiry < nearestExpiration) {
      nearestExpiration = creditExpiry;
    }
  }
  if (remaining > 0) {
    throw storeCreditError(
      'No fue posible reservar todo el saldo solicitado.',
      'STORE_CREDIT_RESERVATION_INCOMPLETE',
      409
    );
  }

  const requestedExpiry = new Date(
    expiresAt || now.getTime() + STORE_CREDIT_RESERVATION_TTL_MS
  );
  const reservationExpiry = new Date(
    Math.min(
      requestedExpiry.getTime(),
      nearestExpiration?.getTime?.() || requestedExpiry.getTime()
    )
  );
  const [usage] = await StoreCreditUsageModel.create(
    [
      {
        order: orderId,
        orderNumber: cleanUpper(order?.orderNumber, 90),
        customer: safeCustomerId,
        customerKey: customerKey(safeCustomerId),
        sessionId: cleanText(sessionId, 120),
        currency: safeCurrency,
        amount,
        status: 'reserved',
        allocations,
        reservedAt: now,
        expiresAt: reservationExpiry,
      },
    ],
    { session }
  );
  return usage;
}

function applyUsageSnapshotToOrder(order, usage, status = usage?.status || 'reserved') {
  if (!order || !usage) return;
  order.storeCredit = {
    applied: true,
    usage: usage._id,
    amount: cleanMoney(usage.amount),
    currency: usage.currency || 'COP',
    status,
    references: (usage.allocations || []).map((item) => item.creditNumber),
    reservedAt: usage.reservedAt || null,
    expiresAt: usage.expiresAt || null,
    consumedAt: usage.consumedAt || null,
    releasedAt: usage.releasedAt || null,
    releaseReason: usage.releaseReason || '',
  };
}

async function consumeReservedStoreCreditForOrder(
  order,
  {
    session,
    now = new Date(),
    StoreCreditUsageModel = StoreCreditUsage,
  } = {}
) {
  if (!order?._id || !session) return { consumed: false, reason: 'not_available' };
  const usage = await StoreCreditUsageModel.findOne({ order: order._id }).session(
    session
  );
  if (!usage) return { consumed: false, reason: 'not_applied' };
  if (usage.status === 'consumed') {
    applyUsageSnapshotToOrder(order, usage, 'consumed');
    return { consumed: true, duplicate: true, usage };
  }
  if (usage.status !== 'reserved') {
    throw storeCreditError(
      'El saldo reservado ya no está disponible para esta orden.',
      'STORE_CREDIT_NOT_RESERVED',
      409
    );
  }
  usage.status = 'consumed';
  usage.consumedAt = now;
  usage.revision += 1;
  await usage.save({ session });
  applyUsageSnapshotToOrder(order, usage, 'consumed');
  return { consumed: true, duplicate: false, usage };
}

async function releaseReservedStoreCreditForOrder(
  order,
  {
    session,
    reason = 'La orden no completó el pago.',
    now = new Date(),
    StoreCreditModel = StoreCredit,
    StoreCreditUsageModel = StoreCreditUsage,
  } = {}
) {
  if (!order?._id || !session) return { released: false, reason: 'not_available' };
  const usage = await StoreCreditUsageModel.findOne({ order: order._id }).session(
    session
  );
  if (!usage) return { released: false, reason: 'not_applied' };
  if (usage.status === 'released') {
    applyUsageSnapshotToOrder(order, usage, 'released');
    return { released: true, duplicate: true, usage };
  }
  if (usage.status === 'consumed') {
    return { released: false, reason: 'already_consumed', usage };
  }
  for (const allocation of usage.allocations || []) {
    const credit = await StoreCreditModel.findById(allocation.credit).session(session);
    if (!credit) continue;
    credit.balance = cleanMoney(credit.balance + cleanMoney(allocation.amount));
    if (credit.status !== 'cancelled') {
      credit.status = new Date(credit.expiresAt) > now ? 'active' : 'expired';
    }
    credit.revision += 1;
    await credit.save({ session });
  }
  usage.status = 'released';
  usage.releasedAt = now;
  usage.releaseReason = cleanText(reason, 500);
  usage.revision += 1;
  await usage.save({ session });
  applyUsageSnapshotToOrder(order, usage, 'released');
  if (order.payment && cleanLower(order.payment.status, 40) !== 'paid') {
    const fullAmount = cleanMoney(order.total);
    const externalSplit = Array.isArray(order.payment.splitPayments)
      ? order.payment.splitPayments.find(
          (item) => cleanLower(item?.method, 40) !== 'store_credit'
        )
      : null;
    order.payment.amount = fullAmount;
    order.payment.amountInCents = Math.round(fullAmount * 100);
    order.payment.splitPayments = externalSplit
      ? [
          {
            method: externalSplit.method,
            methodLabel:
              externalSplit.methodLabel || order.payment.providerLabel || '',
            amount: fullAmount,
            reference:
              externalSplit.reference || `ORDER-${order.orderNumber || ''}`,
          },
        ]
      : [];
    if (cleanLower(order.payment.method, 40) === 'mixed') {
      order.payment.method = cleanLower(order.payment.provider, 40);
      order.payment.methodType = cleanLower(order.payment.provider, 40);
      order.payment.methodLabel = order.payment.providerLabel || '';
    }
  }
  return { released: true, duplicate: false, usage };
}

async function releaseExpiredStoreCreditReservations(
  { limit = 50, now = new Date() } = {},
  {
    OrderModel = Order,
    StoreCreditModel = StoreCredit,
    StoreCreditUsageModel = StoreCreditUsage,
  } = {}
) {
  const usages = await StoreCreditUsageModel.find({
    status: 'reserved',
    expiresAt: { $lte: now },
  })
    .sort({ expiresAt: 1 })
    .limit(Math.max(1, Number(limit || 50)))
    .lean();
  let count = 0;
  for (const candidate of usages) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const usage = await StoreCreditUsageModel.findOne({
          _id: candidate._id,
          status: 'reserved',
        }).session(session);
        if (!usage) return;
        const order = await OrderModel.findById(usage.order).session(session);
        if (!order) return;
        if (cleanLower(order.payment?.status, 40) === 'paid') {
          await consumeReservedStoreCreditForOrder(order, {
            session,
            now,
            StoreCreditUsageModel,
          });
        } else {
          await releaseReservedStoreCreditForOrder(order, {
            session,
            now,
            reason: 'Reserva de saldo vencida antes de completar el pago.',
            StoreCreditModel,
            StoreCreditUsageModel,
          });
        }
        await order.save({ session });
        count += 1;
      });
    } finally {
      await session.endSession();
    }
  }
  return { count };
}

module.exports = {
  STORE_CREDIT_ACCESS_TTL_MS,
  STORE_CREDIT_ACCESS_VERSION,
  STORE_CREDIT_RESERVATION_TTL_MS,
  applyUsageSnapshotToOrder,
  consumeReservedStoreCreditForOrder,
  issueStoreCreditAccess,
  previewCustomerStoreCredit,
  releaseExpiredStoreCreditReservations,
  releaseReservedStoreCreditForOrder,
  reserveStoreCreditForOrder,
  verifyStoreCreditAccess,
};
