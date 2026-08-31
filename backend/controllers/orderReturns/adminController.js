'use strict';

const {
  createOrderReturn,
  listOrderReturns,
  resolveOrderReturnAutomaticExchange,
  resolveOrderReturnExchange,
  resolveOrderReturnRefund,
  resolveOrderReturnStoreCredit,
  updateOrderReturn,
} = require('../../services/orderReturnService');
const {
  actorFromRequest,
  buildAccess,
  orderEventModel,
  returnCreationIdempotencyKey,
  sendAccessError,
  sendServiceError,
  wholeOrderAccessOptions,
} = require('./shared');

async function getOrderReturns(req, res) {
  try {
    const access = buildAccess(req, req.params.id, wholeOrderAccessOptions());
    if (!access.ok) return sendAccessError(res, access);
    const result = await listOrderReturns({ orderFilter: access.filter });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function postOrderReturn(req, res) {
  try {
    const access = buildAccess(req, req.params.id, wholeOrderAccessOptions());
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
        idempotencyKey: returnCreationIdempotencyKey(req),
      },
      { OrderEventModel: orderEventModel() }
    );
    return res.status(returnCase.idempotent ? 200 : 201).json({
      ok: true,
      idempotent: returnCase.idempotent === true,
      returnCase,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function patchOrderReturn(req, res) {
  try {
    const action = String(req.body?.action || '').trim().toLowerCase();
    const access = buildAccess(
      req,
      req.params.id,
      wholeOrderAccessOptions(
        action === 'inspect' ? 'canManageInventory' : ''
      )
    );
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
    const access = buildAccess(
      req,
      req.params.id,
      wholeOrderAccessOptions('canInvoice')
    );
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
    const accessOptions = wholeOrderAccessOptions('canManageInventory');
    const access = buildAccess(req, req.params.id, accessOptions);
    if (!access.ok) return sendAccessError(res, access);
    const replacementAccess = buildAccess(
      req,
      req.body?.replacementOrderId,
      accessOptions
    );
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

async function postReturnAutomaticExchange(req, res) {
  try {
    const access = buildAccess(
      req,
      req.params.id,
      wholeOrderAccessOptions('canManageInventory')
    );
    if (!access.ok) return sendAccessError(res, access);
    const result = await resolveOrderReturnAutomaticExchange(
      {
        orderFilter: access.filter,
        returnId: req.params.returnId,
        expectedRevision: req.body?.expectedRevision,
        reference: req.body?.reference,
        actor: actorFromRequest(req),
        authorizedBranchIds: access.branchIds || [],
        allowAllBranches: access.mode === 'all',
      },
      { OrderEventModel: orderEventModel() }
    );
    return res.status(result.idempotent ? 200 : 201).json({ ok: true, ...result });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function postReturnStoreCredit(req, res) {
  try {
    const access = buildAccess(
      req,
      req.params.id,
      wholeOrderAccessOptions('canInvoice')
    );
    if (!access.ok) return sendAccessError(res, access);
    const result = await resolveOrderReturnStoreCredit(
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

module.exports = {
  getOrderReturns,
  patchOrderReturn,
  postOrderReturn,
  postReturnAutomaticExchange,
  postReturnExchange,
  postReturnRefund,
  postReturnStoreCredit,
};
