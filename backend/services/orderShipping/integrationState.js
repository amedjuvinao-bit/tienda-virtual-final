'use strict';

const Order = require('../../models/Order');
const Branch = require('../../models/Branch');
const {
  logisticsView,
  createLogisticsError,
  reconcileOrderFromLogistics,
} = require('../orderLogisticsService');
const { getShippingProviderStatus } = require('../shippingProviderService');
const { clean, idValue } = require('./shared');

function ensureShipmentAccess(shipment, { authorizedBranchIds = [], allowAllBranches = false } = {}) {
  if (allowAllBranches) return;
  const allowed = new Set((authorizedBranchIds || []).map(idValue).filter(Boolean));
  if (!allowed.has(idValue(shipment?.branch))) {
    throw createLogisticsError(
      'No tienes permiso para operar el envío de esa sede.',
      'SHIPMENT_BRANCH_FORBIDDEN',
      403
    );
  }
}

function ensureExpectedRevision(shipment, expectedRevision) {
  const received = Number(expectedRevision);
  if (!Number.isInteger(received) || received < 0) {
    throw createLogisticsError(
      'Debes enviar la revisión logística visible.',
      'LOGISTICS_REVISION_REQUIRED',
      428
    );
  }
  if (received !== Number(shipment?.revision || 0)) {
    throw createLogisticsError(
      'El envío cambió mientras lo estabas revisando. Recarga el detalle.',
      'LOGISTICS_REVISION_CONFLICT',
      409,
      { expected: received, current: Number(shipment?.revision || 0) }
    );
  }
}

async function loadContext(
  { orderFilter, shipmentId, expectedRevision, authorizedBranchIds, allowAllBranches },
  { OrderModel = Order, BranchModel = Branch } = {}
) {
  const order = await OrderModel.findOne(orderFilter);
  if (!order) {
    throw createLogisticsError(
      'Orden no encontrada dentro de tus sedes autorizadas.',
      'ORDER_NOT_FOUND',
      404
    );
  }
  const shipment = order.fulfillment?.shipments?.id(shipmentId);
  if (!shipment) {
    throw createLogisticsError('Envío logístico no encontrado.', 'SHIPMENT_NOT_FOUND', 404);
  }
  ensureShipmentAccess(shipment, { authorizedBranchIds, allowAllBranches });
  ensureExpectedRevision(shipment, expectedRevision);
  const branchQuery = BranchModel.findById(shipment.branch);
  const branch = typeof branchQuery?.lean === 'function'
    ? await branchQuery.lean()
    : await branchQuery;
  if (!branch) {
    throw createLogisticsError(
      'La sede de origen ya no está disponible.',
      'SHIPPING_ORIGIN_BRANCH_NOT_FOUND',
      409
    );
  }
  return {
    order,
    shipment,
    branch,
    scope: { authorizedBranchIds, allowAllBranches },
  };
}

function providerIntegration(shipment) {
  if (!shipment.shippingIntegration) shipment.shippingIntegration = {};
  return shipment.shippingIntegration;
}

function appendIntegrationHistory(shipment, action, note, now) {
  shipment.history = Array.isArray(shipment.history) ? shipment.history : [];
  shipment.history.push({
    action,
    statusFrom: shipment.status,
    statusTo: shipment.status,
    note: clean(note, 1000),
    actor: { source: 'shipping_provider', displayName: 'Envia.com' },
    at: now,
  });
  shipment.history = shipment.history.slice(-100);
}

async function persistIntegration(
  order,
  shipment,
  now = new Date(),
  scope = {}
) {
  shipment.revision = Number(shipment.revision || 0) + 1;
  shipment.updatedAt = now;
  reconcileOrderFromLogistics(order, now);
  await order.save();
  return {
    ...logisticsView(order, now, scope),
    shippingProviders: await getShippingProviderStatus(),
    shipment,
  };
}

async function integrationResponse(order, shipment, extra = {}, scope = {}) {
  return {
    ...logisticsView(order, new Date(), scope),
    shippingProviders: await getShippingProviderStatus(),
    shipment,
    ...extra,
  };
}

module.exports = {
  appendIntegrationHistory,
  ensureExpectedRevision,
  ensureShipmentAccess,
  integrationResponse,
  loadContext,
  persistIntegration,
  providerIntegration,
};
