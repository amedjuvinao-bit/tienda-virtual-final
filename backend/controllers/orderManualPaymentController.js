'use strict';

const {
  confirmManualPayment,
} = require('../services/manualPaymentConfirmationService');
const {
  ensureOrderOperationAccess,
  FINANCIAL_ORDER_ACCESS,
} = require('../services/orderRouteAccessService');

function presentManualPaymentOrder(order = {}) {
  return {
    id: String(order?._id || ''),
    orderNumber: String(order?.orderNumber || ''),
    status: String(order?.status || ''),
    paymentStatus: String(order?.payment?.status || ''),
    paymentProvider: String(order?.payment?.provider || ''),
    total: Number(order?.total || 0),
    updatedAt: order?.updatedAt || null,
  };
}

function getManualPaymentActor(req) {
  return {
    id: req.adminUserId || req.user?._id || req.user?.id || '',
    label:
      req.adminDisplayName ||
      req.adminUsername ||
      req.user?.displayName ||
      req.user?.username ||
      '',
    role: req.adminRole || req.user?.adminRole || req.user?.role || '',
    source: 'admin_manual_payment',
  };
}

function manualPaymentErrorResponse(error) {
  const requestedStatus = Number(error?.statusCode || error?.status || 500);
  const status = requestedStatus >= 400 && requestedStatus < 600
    ? requestedStatus
    : 500;
  const domainError = status < 500 && /^[A-Z0-9_]{3,100}$/.test(
    String(error?.code || '')
  );

  return {
    status,
    payload: domainError
      ? {
          error: error.code,
          code: error.code,
          message:
            error.message || 'No fue posible confirmar el pago manual de la orden.',
          details: error.details || undefined,
        }
      : {
          error: 'MANUAL_PAYMENT_CONFIRMATION_FAILED',
          code: 'MANUAL_PAYMENT_CONFIRMATION_FAILED',
          message: 'No fue posible confirmar el pago manual de la orden.',
        },
  };
}

async function confirmOrderManualPayment(req, res) {
  try {
    if (!(await ensureOrderOperationAccess(
      req,
      res,
      req.params.id,
      FINANCIAL_ORDER_ACCESS
    ))) return;

    const result = await confirmManualPayment({
      orderId: req.params.id,
      payment: req.body || {},
      actor: getManualPaymentActor(req),
    });

    return res.status(result.duplicate ? 200 : 201).json({
      ok: true,
      confirmed: result.confirmed,
      duplicate: result.duplicate,
      order: presentManualPaymentOrder(result.order),
      evidence: result.evidence,
      postCommit: result.postCommit,
      postCommitWarning: result.postCommitWarning,
    });
  } catch (error) {
    console.error('POST /orders/:id/payments/manual-confirmation', {
      code: error?.code || 'MANUAL_PAYMENT_CONFIRMATION_FAILED',
      message: error?.message || '',
    });
    const response = manualPaymentErrorResponse(error);
    return res.status(response.status).json(response.payload);
  }
}

module.exports = {
  confirmOrderManualPayment,
  getManualPaymentActor,
  manualPaymentErrorResponse,
  presentManualPaymentOrder,
};
