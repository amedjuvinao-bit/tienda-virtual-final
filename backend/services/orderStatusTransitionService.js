'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const {
  confirmInventoryReservation,
  releaseInventoryReservation,
} = require('./inventoryReservationService');
const {
  processOrderFulfillmentAfterPayment,
} = require('./orderFulfillmentService');
const {
  applyReservationToOrderDocument,
  advanceOrderInventoryAllocations,
  hydrateOrderInventoryAllocations,
} = require('./orderInventoryAllocationService');
const {
  applyCustomerStatsForOrder,
} = require('./customerOrderLinkService');

const MAX_BULK_ORDERS = 100;

const STATUS_ALIASES = new Map([
  ['pendiente', 'pending'],
  ['pending', 'pending'],
  ['procesando', 'processing'],
  ['processing', 'processing'],
  ['pagado', 'paid'],
  ['paid', 'paid'],
  ['fallido', 'failed'],
  ['rechazado', 'failed'],
  ['failed', 'failed'],
  ['enviado', 'shipped'],
  ['shipped', 'shipped'],
  ['entregado', 'delivered'],
  ['entregada', 'delivered'],
  ['delivered', 'delivered'],
  ['cancelado', 'cancelled'],
  ['cancelada', 'cancelled'],
  ['cancelled', 'cancelled'],
  ['canceled', 'cancelled'],
  ['reembolsado', 'refunded'],
  ['reembolsada', 'refunded'],
  ['refunded', 'refunded'],
]);

const ALLOWED_TRANSITIONS = new Map([
  ['pending', new Set(['processing', 'paid', 'cancelled', 'failed'])],
  ['processing', new Set(['pending', 'paid', 'cancelled', 'failed'])],
  ['paid', new Set(['shipped', 'delivered'])],
  ['shipped', new Set(['delivered'])],
  ['delivered', new Set()],
  ['cancelled', new Set()],
  ['failed', new Set()],
  ['refunded', new Set()],
]);

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function createTransitionError(
  message,
  code,
  statusCode = 409,
  details = {}
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function normalizeOrderStatus(value) {
  return STATUS_ALIASES.get(cleanText(value).toLowerCase()) || '';
}

function normalizeCurrentStatus(value) {
  const normalized = normalizeOrderStatus(value);
  return normalized || cleanText(value).toLowerCase();
}

function getAllowedOrderStatuses() {
  return Array.from(new Set(STATUS_ALIASES.values()));
}

function isPaymentConfirmed(order) {
  const paymentStatus = cleanText(order?.payment?.status).toLowerCase();
  const orderStatus = normalizeCurrentStatus(order?.status);

  return (
    paymentStatus === 'paid' ||
    ['paid', 'shipped', 'delivered', 'refunded'].includes(orderStatus)
  );
}

function hasShippableItems(order) {
  return (Array.isArray(order?.items) ? order.items : []).some((item) => {
    const productType = cleanText(item?.productType).toLowerCase();

    if (['digital', 'service'].includes(productType)) return false;
    return item?.requiresShipping !== false;
  });
}

function getPhysicalShipments(order) {
  return Array.isArray(order?.fulfillment?.shipments)
    ? order.fulfillment.shipments
    : [];
}

function hasIncompleteVirtualFulfillment(order) {
  const digitalDeliveries = Array.isArray(
    order?.fulfillment?.digitalDeliveries
  )
    ? order.fulfillment.digitalDeliveries
    : [];
  const services = Array.isArray(order?.fulfillment?.services)
    ? order.fulfillment.services
    : [];

  const pendingDigital = digitalDeliveries.some(
    (delivery) =>
      !['ready'].includes(cleanText(delivery?.status).toLowerCase())
  );
  const pendingServices = services.some(
    (service) =>
      !['completed', 'cancelled'].includes(
        cleanText(service?.status).toLowerCase()
      )
  );

  return pendingDigital || pendingServices;
}

function hasVirtualFulfillmentItems(order) {
  return (Array.isArray(order?.items) ? order.items : []).some((item) => {
    const productType = cleanText(item?.productType).toLowerCase();

    if (['digital', 'service'].includes(productType)) return true;
    if (productType !== 'bundle') return false;

    return (
      item?.fulfillmentSnapshot?.bundle?.components || []
    ).some((component) =>
      ['digital', 'service'].includes(
        cleanText(component?.productType).toLowerCase()
      )
    );
  });
}

function needsOperationalReconciliation(order, targetStatus) {
  if (targetStatus === 'paid') {
    const paymentIsPaid =
      cleanText(order?.payment?.status).toLowerCase() === 'paid';
    const inventoryIsConfirmed =
      order?.inventoryControl?.reservationRequired !== true ||
      (
        order?.inventoryControl?.discountedAtCheckout === true &&
        order?.inventoryControl?.restockedOnFailure !== true
      );
    const fulfillmentIsProcessed =
      !hasVirtualFulfillmentItems(order) ||
      Boolean(order?.fulfillment?.processedAt);

    return !(
      paymentIsPaid &&
      inventoryIsConfirmed &&
      fulfillmentIsProcessed
    );
  }

  if (['cancelled', 'failed'].includes(targetStatus)) {
    const paymentMatches =
      cleanText(order?.payment?.status).toLowerCase() ===
      targetStatus;
    const inventoryIsReleased =
      order?.inventoryControl?.reservationRequired !== true ||
      (
        order?.inventoryControl?.discountedAtCheckout === false &&
        order?.inventoryControl?.restockedOnFailure === true
      );

    return !(paymentMatches && inventoryIsReleased);
  }

  return false;
}

function validateOrderStatusTransition(order, targetStatus) {
  const currentStatus = normalizeCurrentStatus(order?.status);

  if (currentStatus === targetStatus && targetStatus === 'refunded') {
    return {
      currentStatus,
      unchanged: true,
    };
  }

  if (targetStatus === 'refunded') {
    throw createTransitionError(
      'Una orden solo puede marcarse como reembolsada mediante el flujo de devolución.',
      'ORDER_REFUND_REQUIRED',
      409,
      {
        currentStatus,
        targetStatus,
      }
    );
  }

  if (['cancelled', 'failed'].includes(targetStatus) && isPaymentConfirmed(order)) {
    throw createTransitionError(
      'La orden ya está pagada. Debes usar el flujo de devolución para reintegrar dinero e inventario.',
      'ORDER_REFUND_REQUIRED',
      409,
      {
        currentStatus,
        targetStatus,
      }
    );
  }

  if (currentStatus === targetStatus) {
    return {
      currentStatus,
      unchanged: true,
    };
  }

  const allowed = ALLOWED_TRANSITIONS.get(currentStatus);

  if (!allowed || !allowed.has(targetStatus)) {
    throw createTransitionError(
      `No se permite cambiar una orden de ${currentStatus || 'sin estado'} a ${targetStatus}.`,
      'ORDER_STATUS_TRANSITION_NOT_ALLOWED',
      409,
      {
        currentStatus,
        targetStatus,
        allowed: allowed ? Array.from(allowed) : [],
      }
    );
  }

  if (['shipped', 'delivered'].includes(targetStatus) && !isPaymentConfirmed(order)) {
    throw createTransitionError(
      'La orden debe tener el pago confirmado antes de enviarse o entregarse.',
      'ORDER_PAYMENT_NOT_CONFIRMED',
      409,
      {
        currentStatus,
        targetStatus,
      }
    );
  }

  if (targetStatus === 'shipped' && !hasShippableItems(order)) {
    throw createTransitionError(
      'Esta orden no contiene productos que requieran envío físico.',
      'ORDER_SHIPMENT_NOT_REQUIRED',
      409,
      {
        currentStatus,
        targetStatus,
      }
    );
  }

  const physicalShipments = getPhysicalShipments(order);
  if (
    targetStatus === 'shipped' &&
    physicalShipments.length > 0 &&
    !physicalShipments.every((shipment) =>
      ['dispatched', 'in_transit', 'delivered'].includes(
        cleanText(shipment?.status).toLowerCase()
      )
    )
  ) {
    throw createTransitionError(
      'Completa picking, packing y despacho desde el flujo logístico antes de marcar la orden como enviada.',
      'ORDER_LOGISTICS_DISPATCH_REQUIRED',
      409,
      { currentStatus, targetStatus }
    );
  }

  if (
    targetStatus === 'delivered' &&
    physicalShipments.length > 0 &&
    !physicalShipments.every(
      (shipment) => cleanText(shipment?.status).toLowerCase() === 'delivered'
    )
  ) {
    throw createTransitionError(
      'Todos los envíos físicos deben tener evidencia de entrega antes de cerrar la orden.',
      'ORDER_LOGISTICS_DELIVERY_REQUIRED',
      409,
      { currentStatus, targetStatus }
    );
  }

  if (targetStatus === 'delivered' && hasIncompleteVirtualFulfillment(order)) {
    throw createTransitionError(
      'La orden todavía tiene entregas digitales o servicios pendientes.',
      'ORDER_FULFILLMENT_INCOMPLETE',
      409,
      {
        currentStatus,
        targetStatus,
      }
    );
  }

  return {
    currentStatus,
    unchanged: false,
  };
}

function getReservationIdentifier(order) {
  return (
    order?.inventoryControl?.reservationId ||
    cleanText(order?.orderNumber) ||
    null
  );
}

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
      {
        orderId: cleanText(orderId),
      }
    );
  }

  const transactionResult = await runInTransaction(
    async (session) => {
      const order = await OrderModel.findById(orderId).session(session);

      if (!order) {
        throw createTransitionError(
          'Orden no encontrada.',
          'ORDER_NOT_FOUND',
          404,
          {
            orderId: String(orderId),
          }
        );
      }

      const validation = validateOrderStatusTransition(
        order,
        targetStatus
      );
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
      const reservationRequired =
        order.inventoryControl?.reservationRequired === true;
      const reservationIdentifier = getReservationIdentifier(order);
      const events = [];

      if (targetStatus === 'paid' && reservationRequired) {
        if (!reservationIdentifier) {
          throw createTransitionError(
            'La orden requiere inventario, pero no tiene una reserva asociada.',
            'ORDER_RESERVATION_REQUIRED',
            409,
            {
              orderId: String(order._id),
              orderNumber: cleanText(order.orderNumber),
            }
          );
        }

        const reservation = await confirmReservation(
          reservationIdentifier,
          {
            order: order._id,
            orderNumber: order.orderNumber,
            paymentReference: order.payment?.reference || '',
            paymentTransactionId:
              order.payment?.transactionId || '',
          },
          {
            session,
            syncOrderAllocations: false,
          }
        );

        applyReservationToOrderDocument(order, reservation);
        order.inventoryControl.discountedAtCheckout = true;
        order.inventoryControl.restockedOnFailure = false;
        order.inventoryControl.restockedAt = null;

        events.push({
          orderId: order._id,
          type: 'inventory_reservation_confirmed',
          message:
            'Reserva de inventario confirmada por cambio administrativo.',
          meta: {
            by: actor.source || 'admin',
            reservationId: reservation?._id || null,
            reservationCode: reservation?.reservationCode || '',
            bulk: actor.bulk === true,
          },
        });
      }

      if (
        ['cancelled', 'failed'].includes(targetStatus) &&
        reservationRequired
      ) {
        if (!reservationIdentifier) {
          throw createTransitionError(
            'La orden requiere inventario, pero no tiene una reserva asociada.',
            'ORDER_RESERVATION_REQUIRED',
            409,
            {
              orderId: String(order._id),
              orderNumber: cleanText(order.orderNumber),
            }
          );
        }

        const reservation = await releaseReservation(
          reservationIdentifier,
          {
            status: targetStatus,
            releaseReason:
              targetStatus === 'cancelled'
                ? 'Orden cancelada desde administración'
                : 'Orden fallida desde administración',
          },
          {
            session,
            syncOrderAllocations: false,
          }
        );

        applyReservationToOrderDocument(order, reservation);
        order.inventoryControl.discountedAtCheckout = false;
        order.inventoryControl.restockedOnFailure = true;
        order.inventoryControl.restockedAt = now;

        events.push({
          orderId: order._id,
          type: 'inventory_reservation_released',
          message:
            'Reserva de inventario liberada por cambio administrativo.',
          meta: {
            by: actor.source || 'admin',
            reservationId: reservation?._id || null,
            reservationCode: reservation?.reservationCode || '',
            targetStatus,
            bulk: actor.bulk === true,
          },
        });
      }

      if (!order.payment || typeof order.payment !== 'object') {
        order.payment = {};
      }

      if (targetStatus === 'paid') {
        order.payment.status = 'paid';
        order.payment.paidAt = order.payment.paidAt || now;
      } else if (targetStatus === 'cancelled') {
        order.payment.status = 'cancelled';
        order.payment.paidAt = null;
        order.fulfillmentStatus = 'cancelled';
      } else if (targetStatus === 'failed') {
        order.payment.status = 'failed';
        order.payment.paidAt = null;
        order.fulfillmentStatus = 'cancelled';
      } else if (targetStatus === 'delivered') {
        await hydrateOrderInventoryAllocations(order, {
          session,
        });
        advanceOrderInventoryAllocations(
          order,
          targetStatus,
          now
        );
        order.fulfillmentStatus = 'delivered';
        if (order.fulfillment) {
          order.fulfillment.status = 'delivered';
        }
      } else if (
        targetStatus === 'shipped' &&
        order.fulfillmentStatus === 'pending'
      ) {
        await hydrateOrderInventoryAllocations(order, {
          session,
        });
        advanceOrderInventoryAllocations(
          order,
          targetStatus,
          now
        );
        order.fulfillmentStatus = 'processing';
      } else if (targetStatus === 'shipped') {
        await hydrateOrderInventoryAllocations(order, {
          session,
        });
        advanceOrderInventoryAllocations(
          order,
          targetStatus,
          now
        );
      }

      const previousStatus = validation.currentStatus;
      const statusChanged = !validation.unchanged;

      if (statusChanged) {
        order.status = targetStatus;
        order.timeline = Array.isArray(order.timeline)
          ? order.timeline
          : [];
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

  let fulfillment = null;
  let fulfillmentWarning = null;

  if (
    transactionResult.changed &&
    transactionResult.targetStatus === 'paid'
  ) {
    try {
      fulfillment = await fulfillmentProcessor({
        orderId: transactionResult.orderId,
      });
    } catch (error) {
      fulfillmentWarning = {
        code: error.code || 'ORDER_FULFILLMENT_FAILED',
        message:
          error.message ||
          'La orden quedó pagada, pero su cumplimiento requiere revisión.',
      };
    }
  }

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

function serializeTransitionError(error, orderId) {
  return {
    orderId: String(orderId || ''),
    ok: false,
    changed: false,
    code: error?.code || 'ORDER_STATUS_TRANSITION_FAILED',
    message:
      error?.message || 'No se pudo cambiar el estado de la orden.',
    statusCode: Number(error?.statusCode || error?.status || 500),
    details: error?.details || undefined,
  };
}

async function processBulkOrderStatusTransitions(
  {
    orderIds = [],
    status,
    actor = {},
  } = {},
  dependencies = {}
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

  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(orderIds) ? orderIds : [])
        .map((orderId) => String(orderId || '').trim())
        .filter(Boolean)
    )
  );

  if (!uniqueIds.length) {
    throw createTransitionError(
      'Debes seleccionar al menos una orden.',
      'IDS_REQUIRED',
      400
    );
  }

  if (uniqueIds.length > MAX_BULK_ORDERS) {
    throw createTransitionError(
      `Solo puedes actualizar hasta ${MAX_BULK_ORDERS} órdenes por operación.`,
      'BULK_ORDER_LIMIT_EXCEEDED',
      400,
      {
        max: MAX_BULK_ORDERS,
        received: uniqueIds.length,
      }
    );
  }

  const invalidIds = uniqueIds.filter(
    (orderId) => !mongoose.Types.ObjectId.isValid(orderId)
  );

  if (invalidIds.length) {
    throw createTransitionError(
      'La selección contiene identificadores de orden inválidos.',
      'INVALID_ORDER_IDS',
      400,
      {
        invalidIds,
      }
    );
  }

  const results = [];

  for (const orderId of uniqueIds) {
    try {
      const result = await transitionOrderStatus(
        {
          orderId,
          status: targetStatus,
          actor: {
            ...actor,
            bulk: true,
            source: actor.source || 'admin_bulk',
          },
        },
        dependencies
      );

      results.push({
        orderId,
        orderNumber: result.snapshot?.orderNumber || '',
        ok: true,
        changed: result.changed,
        statusChanged: result.statusChanged === true,
        reconciled: result.reconciled === true,
        status: result.snapshot?.status || targetStatus,
        paymentStatus: result.snapshot?.paymentStatus || '',
        fulfillmentStatus:
          result.snapshot?.fulfillmentStatus || '',
        fulfillmentWarning: result.fulfillmentWarning,
      });
    } catch (error) {
      results.push(serializeTransitionError(error, orderId));
    }
  }

  const modified = results.filter(
    (result) => result.ok && result.changed
  ).length;
  const unchanged = results.filter(
    (result) => result.ok && !result.changed
  ).length;
  const failed = results.filter((result) => !result.ok).length;

  return {
    ok: failed === 0,
    requested: uniqueIds.length,
    modified,
    unchanged,
    failed,
    targetStatus,
    results,
  };
}

module.exports = {
  MAX_BULK_ORDERS,
  normalizeOrderStatus,
  getAllowedOrderStatuses,
  validateOrderStatusTransition,
  needsOperationalReconciliation,
  transitionOrderStatus,
  processBulkOrderStatusTransitions,
  createTransitionError,
};
