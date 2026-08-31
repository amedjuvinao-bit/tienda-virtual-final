/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const {
  buildCashSessionSalesSummary,
} = require('../services/cashSessionService');
const {
  deriveReconciliationState,
  isFullRefund,
  pendingActions,
} = require('../services/orderRefundReconciliationService');

let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function order(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    source: 'pos',
    status: 'delivered',
    subtotal: 100000,
    total: 100000,
    discount: { amount: 0 },
    items: [{ quantity: 2 }],
    payment: { method: 'cash', amount: 100000 },
    ...overrides,
  };
}

function refund(orderId, amount, paymentState = 'action_required') {
  return {
    order: orderId,
    amount,
    status: 'processed',
    reconciliation: { payment: { state: paymentState } },
  };
}

function run() {
  assert(OrderRefund.schema.path('reconciliation.state'));
  assert(OrderRefund.schema.path('reconciliation.payment.state'));
  assert(OrderRefund.schema.path('reconciliation.billing.state'));
  assert(Order.schema.path('refundControl.reconciliationState'));
  assert(Order.schema.path('refundControl.pendingActions'));
  ok('modelo registra conciliación de inventario, dinero, caja y documento fiscal');

  assert.strictEqual(
    deriveReconciliationState({
      inventory: { state: 'completed' },
      payment: { state: 'completed' },
      cash: { state: 'not_required' },
      billing: { state: 'completed' },
    }),
    'completed'
  );
  assert.strictEqual(
    deriveReconciliationState({
      inventory: { state: 'completed' },
      payment: { state: 'action_required' },
      cash: { state: 'completed' },
      billing: { state: 'not_required' },
    }),
    'action_required'
  );
  ok('una devolución no queda cerrada mientras exista una obligación pendiente');

  assert.deepStrictEqual(
    pendingActions({
      payment: { state: 'action_required' },
      cash: { state: 'failed' },
      billing: { state: 'action_required' },
    }),
    ['confirm_payment_reversal', 'issue_credit_note', 'retry_cash_reconciliation']
  );
  ok('las acciones pendientes son explícitas y utilizables por la interfaz');

  assert.strictEqual(isFullRefund({ total: 100000 }, 99999), false);
  assert.strictEqual(isFullRefund({ total: 100000 }, 100000), true);
  ok('el estado reembolsado exige cubrir el total comercial de la orden');

  const cashOrder = order();
  const pendingSummary = buildCashSessionSalesSummary(
    [cashOrder],
    [refund(cashOrder._id, 30000)]
  );
  assert.strictEqual(pendingSummary.refunds, 30000);
  assert.strictEqual(pendingSummary.netSales, 70000);
  assert.strictEqual(pendingSummary.paymentTotals.cash, 100000);
  assert.strictEqual(pendingSummary.refundedOrdersCount, 1);
  ok('caja muestra la devolución registrada sin fingir que el dinero ya salió');

  const confirmedSummary = buildCashSessionSalesSummary(
    [cashOrder],
    [refund(cashOrder._id, 30000, 'completed')]
  );
  assert.strictEqual(confirmedSummary.paymentTotals.cash, 70000);
  assert.strictEqual(confirmedSummary.paymentTotals.total, 70000);
  ok('caja descuenta el reintegro solo después de confirmar su referencia');

  const mixedOrder = order({
    payment: {
      method: 'mixed',
      amount: 100000,
      splitPayments: [
        { method: 'cash', amount: 40000 },
        { method: 'card', amount: 60000 },
      ],
    },
  });
  const mixedSummary = buildCashSessionSalesSummary(
    [mixedOrder],
    [refund(mixedOrder._id, 50000, 'completed')]
  );
  assert.strictEqual(mixedSummary.paymentTotals.cash, 20000);
  assert.strictEqual(mixedSummary.paymentTotals.card, 30000);
  assert.strictEqual(mixedSummary.paymentTotals.total, 50000);
  ok('devoluciones de pagos mixtos se distribuyen sin generar saldos negativos');

  const ordersRoute = source('routes/orders.js');
  const refundController = source('controllers/orderRefundController.js');
  assert(ordersRoute.includes("'/:id/refunds/:refundId/confirm-payment'"));
  assert(ordersRoute.includes("requirePermission('orders:refund')"));
  assert(ordersRoute.includes('confirmOrderRefundPayment'));
  assert(refundController.includes('confirmRefundPaymentReversal'));
  const reconciliationSource = source('services/orderRefundReconciliationService.js');
  assert(reconciliationSource.includes('PAYMENT_REVERSAL_REFERENCE_REQUIRED'));
  const automationSource = source('services/orderRefundAutomationService.js');
  const gatewaySource = source('services/wompiRefundGatewayService.js');
  assert(ordersRoute.includes("'/:id/refunds/:refundId/automate'"));
  assert(ordersRoute.includes("requirePermission('billing:credit_note')"));
  assert(ordersRoute.includes('automateOrderRefundReconciliation'));
  assert(refundController.includes('automateOrderRefund'));
  assert(automationSource.includes('claimStage'));
  assert(gatewaySource.includes('/void'));
  assert(gatewaySource.includes('manualRequired'));
  ok('el reverso automático usa bloqueo persistente y conserva confirmación manual cuando no aplica');

  const paymentsRoute = source('routes/payments.js');
  const paymentFiscalController = source(
    'controllers/paymentFiscalAdminController.js'
  );
  assert(paymentsRoute.includes("requirePermission('billing:credit_note')"));
  assert(paymentFiscalController.includes('linkRefundCreditNote'));
  assert(paymentFiscalController.includes('req.body?.refundId'));
  ok('la nota crédito oficial se vincula al reembolso con permiso fiscal independiente');

  assert(reconciliationSource.includes("orderUpdate.status = 'refunded'"));
  assert(reconciliationSource.includes('allResolved && isFullRefund'));
  ok('la orden cambia a reembolsada únicamente cuando la conciliación completa termina');

  console.log(`\nConciliación comercial de órdenes: ${passed}/10 controles superados.`);
}

run();
