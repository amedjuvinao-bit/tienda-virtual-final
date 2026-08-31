'use strict';

const StoreCredit = require('../../models/StoreCredit');
const StoreCreditUsage = require('../../models/StoreCreditUsage');
const {
  cleanLower,
  cleanMoney,
  cleanText,
  storeCreditError,
} = require('./normalization');

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

module.exports = {
  applyUsageSnapshotToOrder,
  consumeReservedStoreCreditForOrder,
  releaseReservedStoreCreditForOrder,
};
