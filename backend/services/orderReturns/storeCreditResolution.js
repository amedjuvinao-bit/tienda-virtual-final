'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const Order = require('../../models/Order');
const OrderReturn = require('../../models/OrderReturn');
const StoreCredit = require('../../models/StoreCredit');
const { getOrderReturnPolicy } = require('../orderReturnPolicyService');
const { createOrderEvent } = require('./events');
const {
  actorSnapshot,
  cleanLower,
  cleanText,
  createReturnError,
  idValue,
  objectId,
  toMoney,
  toQuantity,
} = require('./normalization');
const {
  safeReturnView,
  safeStoreCreditView,
} = require('./presentation');
const { assertExpectedRevision } = require('./validation');

function customerStoreCreditKey(order = {}) {
  const customerId = idValue(order.customer?.customerId);
  if (customerId) return `customer:${customerId}`;
  const identity = [
    cleanLower(order.customer?.email || order.customer?.emailOrPhone, 220),
    cleanText(order.customer?.phone, 80),
    cleanText(order.customer?.id, 100),
  ].join('|');
  return `guest:${crypto.createHash('sha256').update(identity).digest('hex')}`;
}

function customerEmailHash(order = {}) {
  const email = cleanLower(order.customer?.email || order.customer?.emailOrPhone, 220);
  return email.includes('@')
    ? crypto.createHash('sha256').update(email).digest('hex')
    : '';
}

async function resolveOrderReturnStoreCredit(
  {
    orderFilter,
    returnId,
    expectedRevision,
    amount,
    actor = {},
    now = new Date(),
  } = {},
  { OrderEventModel = null } = {}
) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne(orderFilter).session(session);
      if (!order) throw createReturnError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
      const returnCase = await OrderReturn.findOne({
        _id: objectId(returnId, 'El RMA'),
        order: order._id,
      }).session(session);
      if (!returnCase) throw createReturnError('RMA no encontrado.', 'RETURN_NOT_FOUND', 404);

      const existingCredit = await StoreCredit.findOne({
        sourceReturn: returnCase._id,
      }).session(session);
      if (
        returnCase.status === 'resolved' &&
        returnCase.resolution?.type === 'store_credit' &&
        existingCredit
      ) {
        result = {
          returnCase: safeReturnView(returnCase),
          storeCredit: safeStoreCreditView(existingCredit),
          idempotent: true,
        };
        return;
      }

      assertExpectedRevision(returnCase, expectedRevision);
      if (
        returnCase.status !== 'resolution_required' ||
        returnCase.requestedResolution !== 'store_credit'
      ) {
        throw createReturnError(
          'El RMA no está listo para saldo a favor.',
          'RETURN_STORE_CREDIT_NOT_READY',
          409
        );
      }
      const policy = await getOrderReturnPolicy({ session });
      if (!policy.storeCreditEnabled) {
        throw createReturnError(
          'El saldo a favor está desactivado en la política.',
          'RETURN_STORE_CREDIT_DISABLED',
          409
        );
      }
      const maximum = toMoney(
        returnCase.items.reduce(
          (sum, item) =>
            sum + toMoney(item.unitAmount) * toQuantity(item.acceptedQuantity),
          0
        )
      );
      const creditAmount = amount === undefined || amount === null || amount === ''
        ? maximum
        : toMoney(amount);
      if (creditAmount <= 0 || creditAmount > maximum) {
        throw createReturnError(
          'El saldo debe ser mayor a cero y no superar el valor aceptado.',
          'RETURN_STORE_CREDIT_AMOUNT_INVALID',
          400,
          { maximum, requestedAmount: creditAmount }
        );
      }
      const expiresAt = new Date(
        now.getTime() + policy.storeCreditExpirationDays * 24 * 60 * 60 * 1000
      );
      const [storeCredit] = await StoreCredit.create(
        [
          {
            creditNumber: `SC-${returnCase.returnNumber}-${crypto
              .randomBytes(3)
              .toString('hex')
              .toUpperCase()}`,
            customer: order.customer?.customerId || null,
            customerKey: customerStoreCreditKey(order),
            customerEmailHash: customerEmailHash(order),
            currency: order.payment?.currency || 'COP',
            originalAmount: creditAmount,
            balance: creditAmount,
            status: 'active',
            expiresAt,
            sourceOrder: order._id,
            sourceOrderNumber: order.orderNumber,
            sourceReturn: returnCase._id,
            issuedAt: now,
            issuedBy: actorSnapshot(actor),
          },
        ],
        { session }
      );
      returnCase.status = 'resolved';
      returnCase.resolvedAt = now;
      returnCase.resolvedBy = actorSnapshot(actor);
      returnCase.resolution = {
        type: 'store_credit',
        state: 'completed',
        amount: creditAmount,
        reference: storeCredit.creditNumber,
        storeCredit: storeCredit._id,
        storeCreditNumber: storeCredit.creditNumber,
        completedAt: now,
      };
      returnCase.revision += 1;
      await returnCase.save({ session });
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: 'return_resolved_store_credit',
          message: `RMA ${returnCase.returnNumber} resuelto con saldo a favor ${storeCredit.creditNumber}.`,
          meta: {
            returnId: returnCase._id,
            storeCreditId: storeCredit._id,
            storeCreditNumber: storeCredit.creditNumber,
            amount: creditAmount,
            expiresAt,
            revision: returnCase.revision,
            by: actorSnapshot(actor),
          },
        },
        session
      );
      result = {
        returnCase: safeReturnView(returnCase),
        storeCredit: safeStoreCreditView(storeCredit),
        idempotent: false,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { resolveOrderReturnStoreCredit };
