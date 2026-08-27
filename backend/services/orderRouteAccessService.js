'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const { buildScopedOrderFilter } = require('./orderAdminScopeService');

const MAX_ORDER_SELECTION_SIZE = 500;
const INVOICE_DOCUMENT_ORDER_ACCESS = Object.freeze({
  requiredCapability: 'canInvoice',
  requireWholeOrder: true,
});
const FINANCIAL_ORDER_ACCESS = Object.freeze({
  requiredCapability: 'canInvoice',
  requireWholeOrder: true,
});

function asObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function parseSelectedOrderIds(ids, maximum = MAX_ORDER_SELECTION_SIZE) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );
  const objectIds = uniqueIds.map(asObjectId).filter(Boolean);

  return {
    objectIds,
    valid: objectIds.length === uniqueIds.length,
    tooMany: uniqueIds.length > maximum,
    count: uniqueIds.length,
    maximum,
  };
}

function sendOrderScopeError(res, access) {
  return res.status(access.status || 403).json({
    error: access.error || 'ORDER_BRANCH_ACCESS_DENIED',
    message:
      access.message ||
      'No tienes permiso para operar órdenes de esa sede.',
  });
}

function buildOrderOperationFilter(req, orderId, options = {}) {
  const objectId = asObjectId(orderId);

  if (!objectId) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_ORDER_ID',
      message: 'El identificador de la orden no es válido.',
      filter: null,
    };
  }

  return buildScopedOrderFilter(
    req,
    { _id: objectId },
    { ...options, requestedBranchId: '' }
  );
}

async function ensureOrderOperationAccess(req, res, orderId, options = {}) {
  const access = buildOrderOperationFilter(req, orderId, options);

  if (!access.ok) {
    sendOrderScopeError(res, access);
    return false;
  }

  const exists = await Order.exists(access.filter);

  if (!exists) {
    res.status(404).json({
      error: 'ORDER_NOT_FOUND',
      message: 'Orden no encontrada dentro de tus sedes autorizadas.',
    });
    return false;
  }

  return true;
}

async function buildAuthorizedSelectionFilter(
  req,
  res,
  orderIds,
  options = {}
) {
  const access = buildScopedOrderFilter(
    req,
    { _id: { $in: orderIds } },
    { ...options, requestedBranchId: '' }
  );

  if (!access.ok) {
    sendOrderScopeError(res, access);
    return null;
  }

  const allowedIds = await Order.distinct('_id', access.filter);

  if (allowedIds.length !== orderIds.length) {
    res.status(403).json({
      error: 'ORDER_SELECTION_OUT_OF_SCOPE',
      message: 'La selección contiene órdenes fuera de tus sedes autorizadas.',
    });
    return null;
  }

  return access.filter;
}

module.exports = {
  FINANCIAL_ORDER_ACCESS,
  INVOICE_DOCUMENT_ORDER_ACCESS,
  MAX_ORDER_SELECTION_SIZE,
  asObjectId,
  buildAuthorizedSelectionFilter,
  buildOrderOperationFilter,
  ensureOrderOperationAccess,
  parseSelectedOrderIds,
  sendOrderScopeError,
};
