'use strict';

const OrderEvent = require('../models/OrderEvent');
const {
  processOrderRefund,
} = require('../services/orderRefundService');
const {
  confirmRefundPaymentReversal,
  listOrderRefunds,
} = require('../services/orderRefundReconciliationService');
const {
  automateOrderRefund,
} = require('../services/orderRefundAutomationService');
const {
  ensureOrderOperationAccess,
  FINANCIAL_ORDER_ACCESS,
} = require('../services/orderRouteAccessService');

async function requireFinancialOrderAccess(req, res) {
  return ensureOrderOperationAccess(
    req,
    res,
    req.params.id,
    FINANCIAL_ORDER_ACCESS
  );
}

function adminIdFromRequest(req) {
  return req.adminUserId || req.user?._id || req.user?.id || null;
}

function adminLabelFromRequest(req) {
  return (
    req.adminDisplayName ||
    req.adminUsername ||
    req.user?.displayName ||
    req.user?.username ||
    'admin'
  );
}

async function createOrderRefund(req, res) {
  try {
    if (!(await requireFinancialOrderAccess(req, res))) return;

    const result = await processOrderRefund(
      {
        orderId: req.params.id,
        amount: req.body?.amount,
        reason: req.body?.reason,
        items: req.body?.items,
        idempotencyKey:
          req.headers['x-idempotency-key'] || req.body?.idempotencyKey || '',
        adminId: adminIdFromRequest(req),
        adminLabel: adminLabelFromRequest(req),
      },
      {
        OrderEventModel: OrderEvent,
        // El endpoint financiero no acredita que la mercancía fue recibida e
        // inspeccionada. La reposición física pertenece exclusivamente al RMA.
        allowInventoryRestock: false,
      }
    );

    return res.status(result.idempotent ? 200 : 201).json({
      ok: true,
      idempotent: result.idempotent,
      refund: result.refund,
    });
  } catch (error) {
    console.error('POST /orders/:id/refund', error);
    return res.status(Number(error.statusCode || 500)).json({
      error: error.code || 'ORDER_REFUND_FAILED',
      message:
        error.statusCode && error.message
          ? error.message
          : 'No se pudo procesar el reembolso.',
      details: error.details || undefined,
    });
  }
}

async function getOrderRefunds(req, res) {
  try {
    if (!(await requireFinancialOrderAccess(req, res))) return;
    const refunds = await listOrderRefunds(req.params.id);
    return res.json({ ok: true, refunds });
  } catch (error) {
    return res.status(Number(error?.statusCode || 500)).json({
      ok: false,
      error: error?.code || 'ORDER_REFUNDS_LIST_FAILED',
      message: error?.message || 'No se pudieron consultar las devoluciones.',
    });
  }
}

async function confirmOrderRefundPayment(req, res) {
  try {
    if (!(await requireFinancialOrderAccess(req, res))) return;
    const refund = await confirmRefundPaymentReversal({
      orderId: req.params.id,
      refundId: req.params.refundId,
      reference: req.body?.reference,
      adminLabel: adminLabelFromRequest(req),
    });

    return res.json({
      ok: true,
      message: 'Devolución del dinero confirmada y conciliación actualizada.',
      refund,
    });
  } catch (error) {
    return res.status(Number(error?.statusCode || 500)).json({
      ok: false,
      error: error?.code || 'PAYMENT_REVERSAL_CONFIRMATION_FAILED',
      message: error?.message || 'No se pudo confirmar la devolución del dinero.',
      details: error?.details || undefined,
    });
  }
}

async function automateOrderRefundReconciliation(req, res) {
  try {
    if (!(await requireFinancialOrderAccess(req, res))) return;
    const result = await automateOrderRefund(
      {
        orderId: req.params.id,
        refundId: req.params.refundId,
        adminLabel: adminLabelFromRequest(req),
      },
      { OrderEventModel: OrderEvent }
    );

    return res.status(result.completed ? 200 : 202).json({
      ok: true,
      message: result.completed
        ? 'Reembolso conciliado automáticamente.'
        : 'La automatización avanzó y dejó visibles las acciones que aún requieren intervención.',
      ...result,
    });
  } catch (error) {
    return res.status(Number(error?.statusCode || 500)).json({
      ok: false,
      error: error?.code || 'ORDER_REFUND_AUTOMATION_FAILED',
      message: error?.message || 'No se pudo automatizar el cierre del reembolso.',
      details: error?.details || undefined,
    });
  }
}

module.exports = {
  adminIdFromRequest,
  adminLabelFromRequest,
  automateOrderRefundReconciliation,
  confirmOrderRefundPayment,
  createOrderRefund,
  getOrderRefunds,
  requireFinancialOrderAccess,
};
