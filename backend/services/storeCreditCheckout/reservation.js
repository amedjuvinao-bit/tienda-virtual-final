'use strict';

const mongoose = require('mongoose');

const StoreCredit = require('../../models/StoreCredit');
const StoreCreditUsage = require('../../models/StoreCreditUsage');
const { getCartAccessSecret } = require('../cartAccessService');
const { verifyStoreCreditAccess } = require('./access');
const { STORE_CREDIT_RESERVATION_TTL_MS } = require('./constants');
const {
  cleanMoney,
  cleanText,
  cleanUpper,
  customerKey,
  idValue,
  storeCreditError,
} = require('./normalization');

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
    const after = cleanMoney(before - take);
    const updated = await StoreCreditModel.findOneAndUpdate(
      {
        _id: credit._id,
        status: 'active',
        expiresAt: { $gt: now },
        balance: before,
      },
      {
        $set: { balance: after },
        $inc: { revision: 1 },
      },
      { new: true, session, runValidators: true }
    );
    if (!updated) {
      throw storeCreditError(
        'Tu saldo cambió mientras se reservaba. Intenta nuevamente.',
        'STORE_CREDIT_CONCURRENT_CHANGE',
        409
      );
    }
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

module.exports = { reserveStoreCreditForOrder };
