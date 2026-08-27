'use strict';

const ElectronicInvoice = require('../../models/ElectronicInvoice');
const Order = require('../../models/Order');
const OrderRefund = require('../../models/OrderRefund');
const {
  deriveReconciliationState,
  refreshOrderRefundReconciliation,
} = require('../orderRefundReconciliationService');
const { executeWompiAutomaticRefund } = require('../wompiRefundGatewayService');
const {
  assertRefundAmountMatchesItems,
  assertSupportedRefundPaymentSources,
} = require('../orderRefunds/refundPaymentIntegrity');
const { automateBilling } = require('./billingStage');
const { cleanText, createAutomationError, safeRefundView } = require('./helpers');
const { automatePayment } = require('./paymentStage');

async function recordEvent(OrderEventModel, payload = {}) {
  if (!OrderEventModel) return;
  try {
    await OrderEventModel.create(payload);
  } catch (_error) {
    // La auditoría complementaria no puede invalidar una operación externa ya realizada.
  }
}

async function defaultPaymentGateway({ order, refund, execute }) {
  if (execute) {
    return executeWompiAutomaticRefund({ order, refund });
  }

  // La consulta de capacidad usa la política pura del adaptador. La ejecución
  // externa solo ocurre después de tomar el bloqueo persistente.
  const {
    getActivePaymentsConfig,
  } = require('../paymentConfigurationAuthorityService');
  const {
    resolveWompiRefundCapability,
  } = require('../wompiRefundGatewayService');
  const config = await getActivePaymentsConfig();
  const capability = resolveWompiRefundCapability({ order, refund, config });
  return capability.automatic
    ? { completed: false, manualRequired: false, capability }
    : { completed: false, manualRequired: true, capability };
}

async function automateOrderRefund(
  { orderId, refundId, adminLabel = '' } = {},
  {
    OrderEventModel = null,
    paymentGateway = null,
  } = {}
) {
  let refund = await OrderRefund.findOne({ _id: refundId, order: orderId });
  if (!refund) {
    throw createAutomationError(
      'El reembolso no pertenece a la orden.',
      'ORDER_REFUND_NOT_FOUND',
      404
    );
  }
  if (refund.status !== 'processed') {
    throw createAutomationError(
      'El reembolso todavía no terminó su operación transaccional de inventario.',
      'ORDER_REFUND_NOT_PROCESSED',
      409
    );
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw createAutomationError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
  }
  assertSupportedRefundPaymentSources(order);
  assertRefundAmountMatchesItems({
    order,
    amount: refund.amount,
    items: refund.items,
  });

  refund = await refreshOrderRefundReconciliation(refund._id);
  const invoice = await ElectronicInvoice.findOne({ orderId: order._id })
    .sort({ createdAt: -1 });
  const gateway = paymentGateway || defaultPaymentGateway;

  const paymentOutcome = await automatePayment({
    order,
    refund,
    adminLabel,
    gateway,
  });
  refund = await refreshOrderRefundReconciliation(refund._id);
  const billingOutcome = await automateBilling({
    order,
    refund,
    invoice,
    adminLabel,
  });
  refund = await refreshOrderRefundReconciliation(refund._id);

  const finalState = deriveReconciliationState(refund.reconciliation || {});
  await recordEvent(OrderEventModel, {
    orderId: order._id,
    type: 'refund_automation_finished',
    message:
      finalState === 'completed'
        ? `Reembolso ${refund.refundNumber} conciliado automáticamente.`
        : `Automatización de ${refund.refundNumber} ejecutada con acciones pendientes.`,
    meta: {
      refundId: refund._id,
      refundNumber: refund.refundNumber,
      finalState,
      payment: paymentOutcome,
      billing: billingOutcome,
      by: cleanText(adminLabel || 'admin', 160),
    },
  });

  return {
    completed: finalState === 'completed',
    state: finalState,
    refund: safeRefundView(refund),
    outcomes: {
      payment: paymentOutcome,
      billing: billingOutcome,
    },
  };
}

module.exports = { automateOrderRefund };
