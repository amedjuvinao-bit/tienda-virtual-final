'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const {
  buildScopedOrderFilter,
} = require('../services/orderAdminScopeService');
const {
  hydrateOrderInventoryAllocations,
} = require('../services/orderInventoryAllocationService');
const {
  initializeOrderLogistics,
  logisticsView,
  updateOrderShipment,
} = require('../services/orderLogisticsService');
const {
  cancelOrderShipmentLabel,
  confirmOrderShipmentDropoff,
  generateOrderShipmentLabel,
  quoteOrderShipment,
  scheduleOrderShipmentPickup,
  syncOrderShipmentTracking,
  testOrderShipmentWebhook,
} = require('../services/orderShippingIntegrationService');
const {
  getShippingProviderStatus,
} = require('../services/shippingProviderService');

function buildAccess(req, options = {}) {
  const orderId = String(req.params?.id || '').trim();
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_ORDER_ID',
      message: 'El identificador de la orden no es válido.',
    };
  }
  return buildScopedOrderFilter(
    req,
    { _id: new mongoose.Types.ObjectId(orderId) },
    { ...options, requestedBranchId: '' }
  );
}

function sendAccessError(res, access) {
  return res.status(access.status || 403).json({
    ok: false,
    error: access.error || 'ORDER_BRANCH_ACCESS_DENIED',
    message:
      access.message ||
      'No tienes permiso para operar órdenes de esa sede.',
  });
}

function actorFromRequest(req) {
  return {
    id: req.adminUserId || req.user?._id || req.user?.id || null,
    displayName:
      req.adminDisplayName ||
      req.adminUsername ||
      req.user?.name ||
      'admin',
    role: req.adminRole || req.user?.role || '',
    source: 'admin_logistics',
  };
}

function serviceScope(access) {
  return {
    authorizedBranchIds: access.branchIds || [],
    allowAllBranches: access.mode === 'all',
  };
}

function sendServiceError(res, error) {
  return res.status(error?.statusCode || error?.status || 500).json({
    ok: false,
    error: error?.code || 'ORDER_LOGISTICS_FAILED',
    message:
      error?.message ||
      'No fue posible completar la operación logística.',
    details: error?.details || undefined,
  });
}

async function getOrderLogistics(req, res) {
  try {
    const access = buildAccess(req);
    if (!access.ok) return sendAccessError(res, access);
    const order = await Order.findOne(access.filter).lean();
    if (!order) {
      return res.status(404).json({
        ok: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Orden no encontrada dentro de tus sedes autorizadas.',
      });
    }
    await hydrateOrderInventoryAllocations(order);
    return res.json({
      ok: true,
      ...logisticsView(order, new Date(), serviceScope(access)),
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function initializeLogistics(req, res) {
  try {
    const access = buildAccess(req, {
      requiredCapability: 'canManageInventory',
    });
    if (!access.ok) return sendAccessError(res, access);
    const result = await initializeOrderLogistics(
      {
        orderFilter: access.filter,
        actor: actorFromRequest(req),
        ...serviceScope(access),
      },
      { OrderEventModel: OrderEvent }
    );
    return res.status(201).json({
      ok: true,
      orderStatus: result.orderStatus,
      fulfillmentStatus: result.fulfillmentStatus,
      summary: result.summary,
      eligibility: result.eligibility,
      shipments: result.shipments,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function updateShipment(req, res) {
  try {
    const access = buildAccess(req, {
      requiredCapability: 'canManageInventory',
    });
    if (!access.ok) return sendAccessError(res, access);
    const result = await updateOrderShipment(
      {
        orderFilter: access.filter,
        shipmentId: req.params.shipmentId,
        action: req.body?.action,
        expectedRevision: req.body?.expectedRevision,
        payload: req.body || {},
        actor: actorFromRequest(req),
        ...serviceScope(access),
      },
      { OrderEventModel: OrderEvent }
    );
    return res.json({
      ok: true,
      orderStatus: result.orderStatus,
      fulfillmentStatus: result.fulfillmentStatus,
      summary: result.summary,
      shipment: result.shipment,
      shipments: result.shipments,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function shippingProviders(_req, res) {
  try {
    return res.json({
      ok: true,
      providers: await getShippingProviderStatus(),
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function runShippingOperation(req, res, operation) {
  try {
    const access = buildAccess(req, {
      requiredCapability: 'canManageInventory',
    });
    if (!access.ok) return sendAccessError(res, access);
    const result = await operation({
      orderFilter: access.filter,
      shipmentId: req.params.shipmentId,
      expectedRevision: req.body?.expectedRevision,
      provider: req.body?.provider || 'envia',
      rate: req.body?.rate,
      pickupDate: req.body?.pickupDate,
      pickupTimeStart: req.body?.pickupTimeStart,
      pickupTimeEnd: req.body?.pickupTimeEnd,
      pickupInstructions: req.body?.pickupInstructions,
      webhookStatus: req.body?.status,
      now: new Date(),
      idempotencyKey:
        req.get('Idempotency-Key') || req.body?.idempotencyKey,
      ...serviceScope(access),
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function quoteShipment(req, res) {
  return runShippingOperation(req, res, quoteOrderShipment);
}

async function generateShipmentLabel(req, res) {
  return runShippingOperation(req, res, generateOrderShipmentLabel);
}

async function syncShipmentTracking(req, res) {
  return runShippingOperation(req, res, syncOrderShipmentTracking);
}

async function scheduleShipmentPickup(req, res) {
  return runShippingOperation(req, res, scheduleOrderShipmentPickup);
}

async function testShipmentWebhook(req, res) {
  return runShippingOperation(req, res, testOrderShipmentWebhook);
}

async function confirmShipmentDropoff(req, res) {
  return runShippingOperation(req, res, confirmOrderShipmentDropoff);
}

async function cancelShipmentLabel(req, res) {
  return runShippingOperation(req, res, cancelOrderShipmentLabel);
}

module.exports = {
  cancelShipmentLabel,
  confirmShipmentDropoff,
  generateShipmentLabel,
  getOrderLogistics,
  initializeLogistics,
  quoteShipment,
  scheduleShipmentPickup,
  shippingProviders,
  syncShipmentTracking,
  testShipmentWebhook,
  updateShipment,
};
