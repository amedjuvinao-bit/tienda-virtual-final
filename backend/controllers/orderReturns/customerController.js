'use strict';

const mongoose = require('mongoose');

const OrderReturn = require('../../models/OrderReturn');
const {
  createOrderReturn,
  listCustomerOrderReturns,
  updateOrderReturn,
} = require('../../services/orderReturnService');
const {
  SAFE_RETURN_ACCESS_ERROR,
} = require('../../services/orderReturnAccessService');
const {
  buildPublicAccess,
  customerActor,
  customerSnapshot,
  orderEventModel,
  returnCreationIdempotencyKey,
  sendServiceError,
} = require('./shared');

async function getCustomerOrderReturns(req, res) {
  try {
    const access = await buildPublicAccess(req, req.params.id);
    if (!access.allowed) return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    const result = await listCustomerOrderReturns({
      orderFilter: { _id: access.order._id },
    });
    if (!result.policy.enabled || !result.policy.customerPortalEnabled) {
      return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    }
    return res.json({
      ok: true,
      order: {
        id: String(access.order._id),
        orderNumber: access.order.orderNumber || '',
      },
      ...result,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function postCustomerOrderReturn(req, res) {
  try {
    const access = await buildPublicAccess(req, req.params.id);
    if (!access.allowed) return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    const returnCase = await createOrderReturn(
      {
        orderFilter: { _id: access.order._id },
        items: req.body?.items,
        requestedResolution: req.body?.requestedResolution,
        reasonSummary: req.body?.reasonSummary,
        overrideEligibility: false,
        actor: customerActor(access.order),
        requestSource: 'customer',
        customerSnapshot: customerSnapshot(access.order),
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

async function cancelCustomerOrderReturn(req, res) {
  try {
    const access = await buildPublicAccess(req, req.params.id);
    if (!access.allowed) return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    if (!mongoose.Types.ObjectId.isValid(String(req.params.returnId || ''))) {
      return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    }
    const customerReturn = await OrderReturn.exists({
      _id: req.params.returnId,
      order: access.order._id,
      requestSource: 'customer',
    });
    if (!customerReturn) return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    const returnCase = await updateOrderReturn(
      {
        orderFilter: { _id: access.order._id },
        returnId: req.params.returnId,
        action: 'cancel',
        expectedRevision: req.body?.expectedRevision,
        payload: {
          reason:
            String(req.body?.reason || '').trim() ||
            'Cancelado por solicitud del cliente.',
        },
        actor: customerActor(access.order),
      },
      { OrderEventModel: orderEventModel() }
    );
    return res.json({ ok: true, returnCase });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

module.exports = {
  cancelCustomerOrderReturn,
  getCustomerOrderReturns,
  postCustomerOrderReturn,
};
