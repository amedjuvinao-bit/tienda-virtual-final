'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const OrderEvent = require('../../models/OrderEvent');
const {
  buildScopedOrderFilter,
} = require('../../services/orderAdminScopeService');
const {
  resolveAuthorizedPublicReturnOrder,
} = require('../../services/orderReturnAccessService');

function buildAccess(req, rawOrderId, options = {}) {
  const orderId = String(rawOrderId || '').trim();
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

function wholeOrderAccessOptions(requiredCapability = '') {
  return {
    requireWholeOrder: true,
    ...(requiredCapability ? { requiredCapability } : {}),
  };
}

function actorFromRequest(req) {
  return {
    id: req.adminUserId || req.user?._id || req.user?.id || null,
    displayName:
      req.adminDisplayName ||
      req.adminUsername ||
      req.user?.displayName ||
      req.user?.username ||
      'admin',
    role: req.adminRole || req.user?.role || '',
  };
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

function sendServiceError(res, error) {
  return res.status(Number(error?.statusCode || error?.status || 500)).json({
    ok: false,
    error: error?.code || 'ORDER_RETURN_FAILED',
    message:
      error?.statusCode && error?.message
        ? error.message
        : 'No fue posible completar la operación de devolución.',
    details: error?.details || undefined,
  });
}

function orderEventModel() {
  return OrderEvent;
}

async function buildPublicAccess(req, rawOrderId) {
  const orderId = String(rawOrderId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(orderId)) return { allowed: false };
  return resolveAuthorizedPublicReturnOrder({ req, OrderModel: Order, orderId });
}

function customerActor(order = {}) {
  const customer = order.customer || {};
  return {
    id: null,
    displayName:
      [customer.name, customer.lastname].filter(Boolean).join(' ').trim() ||
      'Cliente',
    role: 'customer',
  };
}

function customerSnapshot(order = {}) {
  const customer = order.customer || {};
  return {
    customer: customer.customerId || null,
    name: [customer.name, customer.lastname].filter(Boolean).join(' ').trim(),
    email: customer.email || customer.emailOrPhone || '',
    phone: customer.phone || '',
  };
}

function returnCreationIdempotencyKey(req = {}) {
  return String(
    req.headers?.['idempotency-key'] ||
      req.headers?.['x-idempotency-key'] ||
      req.body?.idempotencyKey ||
      ''
  ).trim();
}

module.exports = {
  actorFromRequest,
  buildAccess,
  buildPublicAccess,
  customerActor,
  customerSnapshot,
  orderEventModel,
  returnCreationIdempotencyKey,
  sendAccessError,
  sendServiceError,
  wholeOrderAccessOptions,
};
