'use strict';

const {
  ALLOWED_TRANSITIONS,
  cleanText,
  createTransitionError,
  normalizeCurrentStatus,
} = require('./stateMachine');

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

    return (item?.fulfillmentSnapshot?.bundle?.components || []).some(
      (component) =>
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
      (order?.inventoryControl?.discountedAtCheckout === true &&
        order?.inventoryControl?.restockedOnFailure !== true);
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
      cleanText(order?.payment?.status).toLowerCase() === targetStatus;
    const inventoryIsReleased =
      order?.inventoryControl?.reservationRequired !== true ||
      (order?.inventoryControl?.discountedAtCheckout === false &&
        order?.inventoryControl?.restockedOnFailure === true);

    return !(paymentMatches && inventoryIsReleased);
  }

  return false;
}

function validateOrderStatusTransition(order, targetStatus) {
  const currentStatus = normalizeCurrentStatus(order?.status);

  if (
    targetStatus === 'paid' &&
    cleanText(order?.payment?.status).toLowerCase() !== 'paid'
  ) {
    throw createTransitionError(
      'El cambio de estado no puede confirmar un pago. Registra primero la evidencia mediante el flujo de pago autorizado.',
      'ORDER_PAYMENT_CONFIRMATION_REQUIRED',
      409,
      {
        currentStatus,
        targetStatus,
        paymentStatus:
          cleanText(order?.payment?.status).toLowerCase() || 'unknown',
      }
    );
  }

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
      { currentStatus, targetStatus }
    );
  }

  if (
    ['cancelled', 'failed'].includes(targetStatus) &&
    isPaymentConfirmed(order)
  ) {
    throw createTransitionError(
      'La orden ya está pagada. Debes usar el flujo de devolución para reintegrar dinero e inventario.',
      'ORDER_REFUND_REQUIRED',
      409,
      { currentStatus, targetStatus }
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

  if (
    ['shipped', 'delivered'].includes(targetStatus) &&
    !isPaymentConfirmed(order)
  ) {
    throw createTransitionError(
      'La orden debe tener el pago confirmado antes de enviarse o entregarse.',
      'ORDER_PAYMENT_NOT_CONFIRMED',
      409,
      { currentStatus, targetStatus }
    );
  }

  if (targetStatus === 'shipped' && !hasShippableItems(order)) {
    throw createTransitionError(
      'Esta orden no contiene productos que requieran envío físico.',
      'ORDER_SHIPMENT_NOT_REQUIRED',
      409,
      { currentStatus, targetStatus }
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
      (shipment) =>
        cleanText(shipment?.status).toLowerCase() === 'delivered'
    )
  ) {
    throw createTransitionError(
      'Todos los envíos físicos deben tener evidencia de entrega antes de cerrar la orden.',
      'ORDER_LOGISTICS_DELIVERY_REQUIRED',
      409,
      { currentStatus, targetStatus }
    );
  }

  if (
    targetStatus === 'delivered' &&
    hasIncompleteVirtualFulfillment(order)
  ) {
    throw createTransitionError(
      'La orden todavía tiene entregas digitales o servicios pendientes.',
      'ORDER_FULFILLMENT_INCOMPLETE',
      409,
      { currentStatus, targetStatus }
    );
  }

  return {
    currentStatus,
    unchanged: false,
  };
}

module.exports = {
  needsOperationalReconciliation,
  validateOrderStatusTransition,
};
