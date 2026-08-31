'use strict';

const {
  applyReservationToOrderDocument,
  advanceOrderInventoryAllocations,
  hydrateOrderInventoryAllocations,
} = require('../orderInventoryAllocationService');
const {
  cleanText,
  createTransitionError,
} = require('./stateMachine');

function getReservationIdentifier(order) {
  return (
    order?.inventoryControl?.reservationId ||
    cleanText(order?.orderNumber) ||
    null
  );
}

function assertReservationIdentifier(order, reservationIdentifier) {
  if (reservationIdentifier) return;

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

async function confirmPaidInventory(
  { order, actor, session },
  { confirmReservation }
) {
  const reservationIdentifier = getReservationIdentifier(order);
  assertReservationIdentifier(order, reservationIdentifier);

  const reservation = await confirmReservation(
    reservationIdentifier,
    {
      order: order._id,
      orderNumber: order.orderNumber,
      paymentReference: order.payment?.reference || '',
      paymentTransactionId: order.payment?.transactionId || '',
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

  return {
    orderId: order._id,
    type: 'inventory_reservation_confirmed',
    message: 'Reserva de inventario confirmada por cambio administrativo.',
    meta: {
      by: actor.source || 'admin',
      reservationId: reservation?._id || null,
      reservationCode: reservation?.reservationCode || '',
      bulk: actor.bulk === true,
    },
  };
}

async function releaseTerminalInventory(
  { order, targetStatus, actor, session, now },
  { releaseReservation }
) {
  const reservationIdentifier = getReservationIdentifier(order);
  assertReservationIdentifier(order, reservationIdentifier);

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

  return {
    orderId: order._id,
    type: 'inventory_reservation_released',
    message: 'Reserva de inventario liberada por cambio administrativo.',
    meta: {
      by: actor.source || 'admin',
      reservationId: reservation?._id || null,
      reservationCode: reservation?.reservationCode || '',
      targetStatus,
      bulk: actor.bulk === true,
    },
  };
}

async function applyInventoryEffects(context, dependencies) {
  const { order, targetStatus } = context;
  const reservationRequired =
    order.inventoryControl?.reservationRequired === true;
  const events = [];

  if (targetStatus === 'paid' && reservationRequired) {
    events.push(await confirmPaidInventory(context, dependencies));
  }

  if (
    ['cancelled', 'failed'].includes(targetStatus) &&
    reservationRequired
  ) {
    events.push(await releaseTerminalInventory(context, dependencies));
  }

  return events;
}

async function applyPaymentAndFulfillmentEffects({
  order,
  targetStatus,
  session,
  now,
}) {
  if (!order.payment || typeof order.payment !== 'object') {
    order.payment = {};
  }

  if (targetStatus === 'paid') {
    if (cleanText(order.payment.status).toLowerCase() !== 'paid') {
      throw createTransitionError(
        'El cambio de estado no puede confirmar un pago. Registra primero la evidencia mediante el flujo de pago autorizado.',
        'ORDER_PAYMENT_CONFIRMATION_REQUIRED',
        409
      );
    }
    return;
  }

  if (targetStatus === 'cancelled') {
    order.payment.status = 'cancelled';
    order.payment.paidAt = null;
    order.fulfillmentStatus = 'cancelled';
    return;
  }

  if (targetStatus === 'failed') {
    order.payment.status = 'failed';
    order.payment.paidAt = null;
    order.fulfillmentStatus = 'cancelled';
    return;
  }

  if (targetStatus === 'delivered') {
    await hydrateOrderInventoryAllocations(order, { session });
    advanceOrderInventoryAllocations(order, targetStatus, now);
    order.fulfillmentStatus = 'delivered';
    if (order.fulfillment) {
      order.fulfillment.status = 'delivered';
    }
    return;
  }

  if (targetStatus === 'shipped') {
    await hydrateOrderInventoryAllocations(order, { session });
    advanceOrderInventoryAllocations(order, targetStatus, now);
    if (order.fulfillmentStatus === 'pending') {
      order.fulfillmentStatus = 'processing';
    }
  }
}

async function applyOperationalEffects(context, dependencies) {
  if (
    context.targetStatus === 'paid' &&
    cleanText(context.order?.payment?.status).toLowerCase() !== 'paid'
  ) {
    throw createTransitionError(
      'El cambio de estado no puede confirmar un pago. Registra primero la evidencia mediante el flujo de pago autorizado.',
      'ORDER_PAYMENT_CONFIRMATION_REQUIRED',
      409
    );
  }
  const events = await applyInventoryEffects(context, dependencies);
  await applyPaymentAndFulfillmentEffects(context);
  return events;
}

async function processPaidFulfillment(
  transactionResult,
  fulfillmentProcessor
) {
  if (
    !transactionResult.changed ||
    transactionResult.targetStatus !== 'paid'
  ) {
    return {
      fulfillment: null,
      fulfillmentWarning: null,
    };
  }

  try {
    return {
      fulfillment: await fulfillmentProcessor({
        orderId: transactionResult.orderId,
      }),
      fulfillmentWarning: null,
    };
  } catch (error) {
    return {
      fulfillment: null,
      fulfillmentWarning: {
        code: error.code || 'ORDER_FULFILLMENT_FAILED',
        message:
          error.message ||
          'La orden quedó pagada, pero su cumplimiento requiere revisión.',
      },
    };
  }
}

module.exports = {
  applyOperationalEffects,
  processPaidFulfillment,
};
