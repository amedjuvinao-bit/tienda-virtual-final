'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const {
  confirmInventoryReservation,
  releaseInventoryReservation,
} = require('../inventoryReservationService');
const {
  processOrderFulfillmentAfterPayment,
} = require('../orderFulfillmentService');
const {
  applyCustomerStatsForOrder,
} = require('../customerOrderLinkService');
const {
  applyOperationalEffects,
  processPaidFulfillment,
} = require('./operationalEffects');
const {
  needsOperationalReconciliation,
  validateOrderStatusTransition,
} = require('./operationalValidation');
const {
  cleanText,
  createTransitionError,
  getAllowedOrderStatuses,
  normalizeCurrentStatus,
  normalizeOrderStatus,
} = require('./stateMachine');

function getActorLabel(actor = {}) {
  return (
    cleanText(actor.label) ||
    cleanText(actor.id) ||
    cleanText(actor.source) ||
    'admin'
  );
}

function buildOrderSnapshot(order) {
  if (!order) return null;

  return {
    _id: String(order._id),
    orderNumber: cleanText(order.orderNumber),
    status: normalizeCurrentStatus(order.status),
    paymentStatus: cleanText(order.payment?.status).toLowerCase(),
    fulfillmentStatus: cleanText(order.fulfillmentStatus).toLowerCase(),
  };
}

async function createEvents(OrderEventModel, events, session) {
  if (!OrderEventModel || !events.length) return;
  await OrderEventModel.create(events, {
    session,
    ordered: true,
  });
}

async function runInTransaction(work, externalSession = null) {
  if (externalSession) return work(externalSession);

  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function transitionOrderStatus(
  {
    orderId,
    orderFilter = null,
    status,
    actor = {},
    session: externalSession = null,
  } = {},
  {
    OrderModel = Order,
    OrderEventModel = null,
    confirmReservation = confirmInventoryReservation,
    releaseReservation = releaseInventoryReservation,
    fulfillmentProcessor = processOrderFulfillmentAfterPayment,
    customerStatsApplier = applyCustomerStatsForOrder,
  } = {}
) {
  const targetStatus = normalizeOrderStatus(status);

  if (!targetStatus) {
    throw createTransitionError(
      'El estado solicitado no es válido.',
      'INVALID_ORDER_STATUS',
      400,
      {
        received: cleanText(status),
        allowed: getAllowedOrderStatuses(),
      }
    );
  }

  if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) {
    throw createTransitionError(
      'La orden no tiene un identificador válido.',
      'INVALID_ORDER_ID',
      400,
      { orderId: cleanText(orderId) }
    );
  }

  const transactionResult = await runInTransaction(
    async (session) => {
      const orderQuery = orderFilter
        ? OrderModel.findOne({ ...orderFilter, _id: orderId })
        : OrderModel.findById(orderId);
      const order = await orderQuery.session(session);

      if (!order) {
        throw createTransitionError(
          'Orden no encontrada.',
          'ORDER_NOT_FOUND',
          404,
          { orderId: String(orderId) }
        );
      }

      const validation = validateOrderStatusTransition(order, targetStatus);
      const reconciliationRequired =
        validation.unchanged &&
        needsOperationalReconciliation(order, targetStatus);

      if (validation.unchanged && !reconciliationRequired) {
        return {
          changed: false,
          statusChanged: false,
          reconciled: false,
          previousStatus: validation.currentStatus,
          targetStatus,
          orderId: order._id,
        };
      }

      const now = new Date();
      const events = await applyOperationalEffects(
        {
          order,
          targetStatus,
          actor,
          session,
          now,
        },
        {
          confirmReservation,
          releaseReservation,
        }
      );

      const previousStatus = validation.currentStatus;
      const statusChanged = !validation.unchanged;

      if (statusChanged) {
        order.status = targetStatus;
        order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
        order.timeline.push({
          type: 'status',
          statusFrom: previousStatus,
          statusTo: targetStatus,
          message: `Estado: ${previousStatus || '—'} -> ${targetStatus}`,
          by: getActorLabel(actor),
          at: now,
        });
      }

      await order.save({ session });
      await customerStatsApplier(order, { session });

      events.push(
        statusChanged
          ? {
              orderId: order._id,
              type: 'status_changed',
              message: `Estado: ${previousStatus || '—'} -> ${targetStatus}`,
              meta: {
                from: previousStatus || null,
                to: targetStatus,
                ip: cleanText(actor.ip),
                by: actor.source || getActorLabel(actor),
                adminId: actor.id || null,
                adminLabel: getActorLabel(actor),
                bulk: actor.bulk === true,
              },
            }
          : {
              orderId: order._id,
              type: 'status_reconciled',
              message:
                `Estado ${targetStatus} conciliado con pago, inventario y cumplimiento.`,
              meta: {
                status: targetStatus,
                ip: cleanText(actor.ip),
                by: actor.source || getActorLabel(actor),
                adminId: actor.id || null,
                adminLabel: getActorLabel(actor),
                bulk: actor.bulk === true,
              },
            }
      );

      await createEvents(OrderEventModel, events, session);

      return {
        changed: statusChanged || reconciliationRequired,
        statusChanged,
        reconciled: reconciliationRequired,
        previousStatus,
        targetStatus,
        orderId: order._id,
      };
    },
    externalSession
  );

  const { fulfillment, fulfillmentWarning } =
    await processPaidFulfillment(
      transactionResult,
      fulfillmentProcessor
    );

  const refreshedOrder = await OrderModel.findById(
    transactionResult.orderId
  ).lean();

  return {
    ...transactionResult,
    order: refreshedOrder,
    snapshot: buildOrderSnapshot(refreshedOrder),
    fulfillment,
    fulfillmentWarning,
  };
}

module.exports = {
  transitionOrderStatus,
};
