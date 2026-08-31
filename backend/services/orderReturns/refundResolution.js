'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const OrderRefund = require('../../models/OrderRefund');
const OrderReturn = require('../../models/OrderReturn');
const { processOrderRefund } = require('../orderRefundService');
const { loadReturnUsage } = require('./eligibility');
const { createOrderEvent } = require('./events');
const {
  actorSnapshot,
  createReturnError,
  objectId,
  toMoney,
  toQuantity,
} = require('./normalization');
const { safeReturnView } = require('./presentation');
const { assertExpectedRevision } = require('./validation');

async function resolveOrderReturnRefund(
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
      if (
        returnCase.status === 'resolved' &&
        returnCase.resolution?.type === 'refund' &&
        returnCase.resolution?.refund
      ) {
        const requestedAmount = amount === undefined || amount === null || amount === ''
          ? Number(returnCase.resolution.amount || 0)
          : toMoney(amount);
        if (requestedAmount !== toMoney(returnCase.resolution.amount)) {
          throw createReturnError(
            'El RMA ya fue resuelto con un monto diferente.',
            'RETURN_ALREADY_RESOLVED',
            409
          );
        }
        const existingRefund = await OrderRefund.findById(
          returnCase.resolution.refund
        ).session(session).lean();
        result = {
          returnCase: safeReturnView(returnCase),
          refund: existingRefund,
          idempotent: true,
        };
        return;
      }
      assertExpectedRevision(returnCase, expectedRevision);
      if (returnCase.status !== 'resolution_required' || returnCase.requestedResolution !== 'refund') {
        throw createReturnError('El RMA no está listo para reembolso.', 'RETURN_REFUND_NOT_READY', 409);
      }
      const maximum = toMoney(
        returnCase.items.reduce(
          (sum, item) => sum + toMoney(item.unitAmount) * toQuantity(item.acceptedQuantity),
          0
        )
      );
      const refundAmount = amount === undefined || amount === null || amount === ''
        ? maximum
        : toMoney(amount);
      if (refundAmount <= 0 || refundAmount > maximum) {
        throw createReturnError(
          'El monto debe ser mayor a cero y no superar el valor aceptado en la inspección.',
          'RETURN_REFUND_AMOUNT_INVALID',
          400,
          { maximum, requestedAmount: refundAmount }
        );
      }
      const usage = await loadReturnUsage(order._id, {
        session,
        excludeReturnId: returnCase._id,
      });
      const refundResult = await processOrderRefund(
        {
          orderId: order._id,
          amount: refundAmount,
          reason: `Resolución ${returnCase.returnNumber}`,
          items: returnCase.items
            .filter((item) => item.acceptedQuantity > 0)
            .map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.acceptedQuantity,
              restockQuantity: 0,
            })),
          idempotencyKey: `rma:${returnCase._id}:refund`,
          adminId: actorSnapshot(actor).id,
          adminLabel: actorSnapshot(actor).label,
          returnCaseId: returnCase._id,
        },
        {
          session,
          OrderEventModel,
          additionalReturnedByLine: usage.unrefundedReturnByLine,
        }
      );
      returnCase.status = 'resolved';
      returnCase.resolvedAt = now;
      returnCase.resolvedBy = actorSnapshot(actor);
      returnCase.resolution = {
        type: 'refund',
        state:
          refundResult.refund?.reconciliation?.state === 'completed'
            ? 'completed'
            : 'action_required',
        amount: refundAmount,
        reference: refundResult.refund?.refundNumber || '',
        refund: refundResult.refund?._id || null,
        completedAt:
          refundResult.refund?.reconciliation?.state === 'completed'
            ? now
            : null,
      };
      returnCase.revision += 1;
      await returnCase.save({ session });
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: 'return_resolved_refund',
          message: `RMA ${returnCase.returnNumber} resuelto con reembolso ${refundResult.refund?.refundNumber || ''}.`,
          meta: {
            returnId: returnCase._id,
            refundId: refundResult.refund?._id,
            amount: refundAmount,
            revision: returnCase.revision,
            by: actorSnapshot(actor),
          },
        },
        session
      );
      result = {
        returnCase: safeReturnView(returnCase),
        refund: refundResult.refund,
        idempotent: refundResult.idempotent,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { resolveOrderReturnRefund };
