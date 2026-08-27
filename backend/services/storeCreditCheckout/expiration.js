'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const StoreCredit = require('../../models/StoreCredit');
const StoreCreditUsage = require('../../models/StoreCreditUsage');
const { cleanLower } = require('./normalization');
const {
  consumeReservedStoreCreditForOrder,
  releaseReservedStoreCreditForOrder,
} = require('./usageLifecycle');

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

module.exports = { releaseExpiredStoreCreditReservations };
