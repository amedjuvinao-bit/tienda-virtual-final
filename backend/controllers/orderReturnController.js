'use strict';

const mongoose = require('mongoose');

const {
  buildScopedOrderFilter,
} = require('../services/orderAdminScopeService');
const {
  createOrderReturn,
  listOrderReturns,
  resolveOrderReturnExchange,
  resolveOrderReturnRefund,
  updateOrderReturn,
} = require('../services/orderReturnService');

function buildAccess(req, rawOrderId) {
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
    { requestedBranchId: '' }
  );
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
  return mongoose.models.OrderEvent || null;
}

async function getOrderReturns(req, res) {
  try {
    const access = buildAccess(req, req.params.id);
    if (!access.ok) return sendAccessError(res, access);
    const result = await listOrderReturns({ orderFilter: access.filter });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function postOrderReturn(req, res) {
  try {
    const access = buildAccess(req, req.params.id);
    if (!access.ok) return sendAccessError(res, access);
    const returnCase = await createOrderReturn(
      {
        orderFilter: access.filter,
        items: req.body?.items,
        requestedResolution: req.body?.requestedResolution,
        reasonSummary: req.body?.reasonSummary,
        overrideEligibility: req.body?.overrideEligibility === true,
        overrideReason: req.body?.overrideReason,
        actor: actorFromRequest(req),
      },
      { OrderEventModel: orderEventModel() }
    );
    return res.status(201).json({ ok: true, returnCase });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function patchOrderReturn(req, res) {
  try {
    const access = buildAccess(req, req.params.id);
    if (!access.ok) return sendAccessError(res, access);
    const returnCase = await updateOrderReturn(
      {
        orderFilter: access.filter,
        returnId: req.params.returnId,
        action: req.body?.action,
        expectedRevision: req.body?.expectedRevision,
        payload: req.body || {},
        actor: actorFromRequest(req),
      },
      { OrderEventModel: orderEventModel() }
    );
    return res.json({ ok: true, returnCase });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function postReturnRefund(req, res) {
  try {
    const access = buildAccess(req, req.params.id);
    if (!access.ok) return sendAccessError(res, access);
    const result = await resolveOrderReturnRefund(
      {
        orderFilter: access.filter,
        returnId: req.params.returnId,
        expectedRevision: req.body?.expectedRevision,
        amount: req.body?.amount,
        actor: actorFromRequest(req),
      },
      { OrderEventModel: orderEventModel() }
    );
    return res.status(result.idempotent ? 200 : 201).json({ ok: true, ...result });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function postReturnExchange(req, res) {
  try {
    const access = buildAccess(req, req.params.id);
    if (!access.ok) return sendAccessError(res, access);
    const replacementAccess = buildAccess(req, req.body?.replacementOrderId);
    if (!replacementAccess.ok) return sendAccessError(res, replacementAccess);
    const returnCase = await resolveOrderReturnExchange(
      {
        orderFilter: access.filter,
        replacementOrderFilter: replacementAccess.filter,
        returnId: req.params.returnId,
        expectedRevision: req.body?.expectedRevision,
        reference: req.body?.reference,
        actor: actorFromRequest(req),
      },
      { OrderEventModel: orderEventModel() }
    );
    return res.json({ ok: true, returnCase });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

module.exports = {
  getOrderReturns,
  patchOrderReturn,
  postOrderReturn,
  postReturnExchange,
  postReturnRefund,
};
