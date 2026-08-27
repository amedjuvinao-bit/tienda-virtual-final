'use strict';

const {
  ACTIVE_LOGISTICS_STATUSES,
  DISPATCHED_LOGISTICS_STATUSES,
} = require('./constants');
const {
  asPlain,
  cleanLower,
  cleanText,
  idValue,
} = require('./support');

function isPaymentConfirmed(order) {
  const paymentStatus = cleanLower(order?.payment?.status);
  const orderStatus = cleanLower(order?.status);
  return (
    paymentStatus === 'paid' ||
    ['paid', 'shipped', 'delivered', 'refunded'].includes(orderStatus)
  );
}

function hasIncompleteVirtualFulfillment(order) {
  const digital = Array.isArray(order?.fulfillment?.digitalDeliveries)
    ? order.fulfillment.digitalDeliveries
    : [];
  const services = Array.isArray(order?.fulfillment?.services)
    ? order.fulfillment.services
    : [];

  return (
    digital.some((item) => cleanLower(item?.status) !== 'ready') ||
    services.some(
      (item) => !['completed', 'cancelled'].includes(cleanLower(item?.status))
    )
  );
}

function getRelevantDueAt(shipment) {
  const status = cleanLower(shipment?.status);
  if (['ready_to_pick', 'picking'].includes(status)) {
    return shipment?.sla?.pickingDueAt || null;
  }
  if (['picked', 'packing', 'packed'].includes(status)) {
    return shipment?.sla?.dispatchDueAt || null;
  }
  if (['dispatched', 'in_transit'].includes(status)) {
    return shipment?.sla?.deliveryDueAt || null;
  }
  return null;
}

function evaluateShipmentSla(shipment, now = new Date()) {
  if (!shipment?.sla) shipment.sla = {};
  shipment.sla.lastEvaluatedAt = now;
  const dueAt = getRelevantDueAt(shipment);
  if (dueAt && new Date(dueAt).getTime() < now.getTime()) {
    shipment.sla.breachedAt = shipment.sla.breachedAt || now;
  }
  return shipment;
}

function summarizeShipments(shipments = [], now = new Date()) {
  const list = Array.isArray(shipments) ? shipments : [];
  list.forEach((shipment) => evaluateShipmentSla(shipment, now));
  const statusCounts = (status) =>
    list.filter((shipment) => cleanLower(shipment?.status) === status).length;
  const deliveredCount = statusCounts('delivered');
  const exceptionCount = statusCounts('exception');
  const cancelledCount = statusCounts('cancelled');
  const dispatchedCount = list.filter((shipment) =>
    DISPATCHED_LOGISTICS_STATUSES.has(cleanLower(shipment?.status))
  ).length;
  const relevantDates = list
    .map(getRelevantDueAt)
    .filter(Boolean)
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left - right);

  let status = 'not_initialized';
  if (list.length && cancelledCount === list.length) status = 'cancelled';
  else if (exceptionCount > 0) status = 'exception';
  else if (list.length && deliveredCount === list.length) status = 'delivered';
  else if (deliveredCount > 0) status = 'partially_delivered';
  else if (list.length && dispatchedCount === list.length) status = 'dispatched';
  else if (dispatchedCount > 0) status = 'partially_dispatched';
  else if (
    list.some((shipment) =>
      ACTIVE_LOGISTICS_STATUSES.has(cleanLower(shipment?.status))
    )
  ) {
    status = 'in_progress';
  } else if (list.length) status = 'ready';

  return {
    status,
    shipmentCount: list.length,
    readyCount: statusCounts('ready_to_pick'),
    activeCount: list.filter((shipment) =>
      ACTIVE_LOGISTICS_STATUSES.has(cleanLower(shipment?.status))
    ).length,
    dispatchedCount,
    deliveredCount,
    exceptionCount,
    slaBreachedCount: list.filter((shipment) => Boolean(shipment?.sla?.breachedAt))
      .length,
    nextDueAt: relevantDates[0] || null,
    updatedAt: now,
  };
}

function activeAllocationQuantity(allocation) {
  return Math.max(
    0,
    Number(allocation?.soldQuantity || 0) -
      Number(allocation?.returnedQuantity || 0)
  );
}

function buildShipmentGroups(order) {
  const allocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const groups = new Map();

  for (const allocation of allocations) {
    const quantity = activeAllocationQuantity(allocation);
    const branchId = idValue(allocation?.branch);
    if (!quantity || !branchId || !allocation?._id) continue;
    const current = groups.get(branchId) || {
      branch: allocation.branch,
      branchSnapshot: asPlain(allocation.branchSnapshot),
      allocationIds: [],
      quantity: 0,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      shippedAt: null,
      deliveredAt: null,
    };
    current.allocationIds.push(allocation._id);
    current.quantity += quantity;
    current.shippedQuantity += Math.min(
      quantity,
      Number(allocation?.shippedQuantity || 0)
    );
    current.deliveredQuantity += Math.min(
      quantity,
      Number(allocation?.deliveredQuantity || 0)
    );
    current.shippedAt = current.shippedAt || allocation?.shippedAt || null;
    current.deliveredAt = current.deliveredAt || allocation?.deliveredAt || null;
    groups.set(branchId, current);
  }

  return [...groups.values()];
}

function logisticsEligibility(
  order,
  { authorizedBranchIds = [], allowAllBranches = true } = {}
) {
  const unavailable = (code, message, blockingMessage) => ({
    canInitialize: false,
    code,
    message,
    blockingMessage,
    branchCount: 0,
    soldQuantity: 0,
  });

  if (!isPaymentConfirmed(order)) {
    return unavailable(
      'ORDER_PAYMENT_REQUIRED_FOR_LOGISTICS',
      'Disponible cuando el pago esté confirmado y exista inventario vendido.',
      'La logística solo puede iniciar después de confirmar el pago.'
    );
  }

  if (['cancelled', 'failed', 'refunded'].includes(cleanLower(order?.status))) {
    return unavailable(
      'ORDER_STATUS_BLOCKS_LOGISTICS',
      'El estado comercial actual de la orden no permite preparar logística.',
      'El estado comercial de la orden no permite iniciar logística.'
    );
  }

  const allowedBranches = new Set(
    (Array.isArray(authorizedBranchIds) ? authorizedBranchIds : [])
      .map(idValue)
      .filter(Boolean)
  );
  const groups = buildShipmentGroups(order).filter(
    (group) => allowAllBranches || allowedBranches.has(idValue(group.branch))
  );

  if (!groups.length) {
    return unavailable(
      'ORDER_LOGISTICS_ALLOCATIONS_REQUIRED',
      'Disponible cuando el pago esté confirmado y exista inventario vendido.',
      'La orden no tiene asignaciones físicas vendidas para preparar.'
    );
  }

  return {
    canInitialize: true,
    code: null,
    message: 'Pago confirmado e inventario vendido disponibles para preparar.',
    blockingMessage: '',
    branchCount: groups.length,
    soldQuantity: groups.reduce(
      (total, group) => total + Number(group?.quantity || 0),
      0
    ),
  };
}

function logisticsView(order, now = new Date(), scope = {}) {
  const allShipments = Array.isArray(order?.fulfillment?.shipments)
    ? order.fulfillment.shipments
    : [];
  const allowedBranches = new Set(
    (Array.isArray(scope.authorizedBranchIds)
      ? scope.authorizedBranchIds
      : scope.authorizedBranchIds instanceof Set
        ? [...scope.authorizedBranchIds]
        : []
    )
      .map(idValue)
      .filter(Boolean)
  );
  const allowAllBranches = scope.allowAllBranches !== false;
  const shipments = allowAllBranches
    ? allShipments
    : allShipments.filter((shipment) =>
        allowedBranches.has(idValue(shipment?.branch))
      );
  return {
    orderId: order?._id || null,
    orderNumber: cleanText(order?.orderNumber, 120),
    orderStatus: cleanLower(order?.status),
    fulfillmentStatus: cleanLower(order?.fulfillmentStatus),
    summary: summarizeShipments(shipments, now),
    eligibility: logisticsEligibility(order, scope),
    shipments,
  };
}

function reconcileOrderFromLogistics(order, now = new Date()) {
  const shipments = Array.isArray(order?.fulfillment?.shipments)
    ? order.fulfillment.shipments
    : [];
  const summary = summarizeShipments(shipments, now);
  order.fulfillment.logisticsSummary = summary;

  if (summary.status === 'exception') {
    order.fulfillment.status = 'action_required';
    order.fulfillmentStatus = 'processing';
    return summary;
  }

  const activeShipments = shipments.filter(
    (shipment) => cleanLower(shipment?.status) !== 'cancelled'
  );
  const allDispatched =
    activeShipments.length > 0 &&
    activeShipments.every((shipment) =>
      DISPATCHED_LOGISTICS_STATUSES.has(cleanLower(shipment?.status))
    );
  const allDelivered =
    activeShipments.length > 0 &&
    activeShipments.every(
      (shipment) => cleanLower(shipment?.status) === 'delivered'
    );
  const virtualPending = hasIncompleteVirtualFulfillment(order);

  if (allDelivered && !virtualPending) {
    if (!['cancelled', 'refunded'].includes(cleanLower(order.status))) {
      order.status = 'delivered';
    }
    order.fulfillmentStatus = 'delivered';
    order.fulfillment.status = 'delivered';
  } else if (allDelivered) {
    order.fulfillmentStatus = 'partially_delivered';
    order.fulfillment.status = 'partially_delivered';
  } else {
    if (
      allDispatched &&
      !['cancelled', 'failed', 'refunded', 'delivered'].includes(
        cleanLower(order.status)
      )
    ) {
      order.status = 'shipped';
    }
    order.fulfillmentStatus = 'processing';
    order.fulfillment.status = 'processing';
  }

  return summary;
}

module.exports = {
  summarizeShipments,
  logisticsView,
  logisticsEligibility,
  reconcileOrderFromLogistics,
  buildShipmentGroups,
  evaluateShipmentSla,
};
