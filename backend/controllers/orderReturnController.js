'use strict';

const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

const Order = require('../models/Order');
const OrderReturn = require('../models/OrderReturn');

const {
  buildScopedOrderFilter,
} = require('../services/orderAdminScopeService');
const {
  createOrderReturn,
  listCustomerOrderReturns,
  listOrderReturns,
  resolveOrderReturnAutomaticExchange,
  resolveOrderReturnExchange,
  resolveOrderReturnRefund,
  resolveOrderReturnStoreCredit,
  updateOrderReturn,
} = require('../services/orderReturnService');
const {
  getOrderReturnPolicy,
  updateOrderReturnPolicy,
} = require('../services/orderReturnPolicyService');
const {
  SAFE_RETURN_ACCESS_ERROR,
  resolveAuthorizedPublicReturnOrder,
} = require('../services/orderReturnAccessService');

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

async function getReturnPolicy(_req, res) {
  try {
    return res.json({ ok: true, policy: await getOrderReturnPolicy() });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function putReturnPolicy(req, res) {
  try {
    const policy = await updateOrderReturnPolicy({
      payload: req.body || {},
      actor: actorFromRequest(req),
    });
    return res.json({ ok: true, policy });
  } catch (error) {
    return sendServiceError(res, error);
  }
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

async function postReturnAutomaticExchange(req, res) {
  try {
    const access = buildAccess(req, req.params.id);
    if (!access.ok) return sendAccessError(res, access);
    const result = await resolveOrderReturnAutomaticExchange(
      {
        orderFilter: access.filter,
        returnId: req.params.returnId,
        expectedRevision: req.body?.expectedRevision,
        reference: req.body?.reference,
        actor: actorFromRequest(req),
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
    const access = buildAccess(req, req.params.id);
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
      },
      { OrderEventModel: orderEventModel() }
    );
    return res.status(201).json({ ok: true, returnCase });
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

function drawReturnLabel(res, order, returnCase) {
  const doc = new PDFDocument({ size: 'A6', margin: 26 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${returnCase.returnNumber || 'RMA'}.pdf"`
  );
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(17).text('AUTORIZACIÓN DE DEVOLUCIÓN');
  doc.moveDown(0.6);
  doc.fontSize(13).text(returnCase.returnNumber || 'RMA');
  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(9);
  doc.text(`Orden original: ${order.orderNumber || '—'}`);
  doc.text(`Destino: ${order.branchSnapshot?.name || 'Sede asignada'}`);
  doc.text(`Unidades autorizadas: ${(returnCase.items || []).reduce(
    (sum, item) => sum + Number(item.authorizedQuantity || 0),
    0
  )}`);
  if (returnCase.shipping?.carrierName) {
    doc.text(`Transportadora: ${returnCase.shipping.carrierName}`);
  }
  if (returnCase.shipping?.trackingNumber) {
    doc.text(`Guía: ${returnCase.shipping.trackingNumber}`);
  }
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').text('Instrucciones');
  doc.font('Helvetica').text(
    returnCase.shipping?.instructions ||
      'Adjunta este documento al paquete y conserva el comprobante de entrega.'
  );
  doc.moveDown(0.8);
  doc.fontSize(7).fillColor('#555555').text(
    'Este documento identifica el expediente RMA. Solo es una guía de transportadora cuando incluye empresa y número de seguimiento.'
  );
  doc.end();
}

async function getCustomerReturnLabel(req, res) {
  try {
    const access = await buildPublicAccess(req, req.params.id);
    if (!access.allowed) return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    if (!mongoose.Types.ObjectId.isValid(String(req.params.returnId || ''))) {
      return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    }
    const returnCase = await OrderReturn.findOne({
      _id: req.params.returnId,
      order: access.order._id,
      status: { $in: ['authorized', 'in_transit', 'received', 'resolution_required', 'resolved'] },
    }).lean();
    if (!returnCase) return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    if (/^https:\/\//i.test(String(returnCase.shipping?.labelUrl || ''))) {
      return res.redirect(302, returnCase.shipping.labelUrl);
    }
    return drawReturnLabel(res, access.order, returnCase);
  } catch (error) {
    return sendServiceError(res, error);
  }
}

module.exports = {
  cancelCustomerOrderReturn,
  getCustomerOrderReturns,
  getCustomerReturnLabel,
  getReturnPolicy,
  getOrderReturns,
  patchOrderReturn,
  postCustomerOrderReturn,
  postOrderReturn,
  postReturnAutomaticExchange,
  postReturnExchange,
  postReturnRefund,
  postReturnStoreCredit,
  putReturnPolicy,
};
