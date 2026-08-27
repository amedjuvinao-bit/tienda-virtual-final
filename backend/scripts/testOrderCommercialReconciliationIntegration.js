/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const CashSession = require('../models/CashSession');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const {
  confirmRefundPaymentReversal,
  linkRefundCreditNote,
  refreshOrderRefundReconciliation,
} = require('../services/orderRefundReconciliationService');

const REQUIRED_DATABASE = 'orders_ci_stage2_reconciliation';
const MONGO_URI = process.env.ORDERS_STAGE2_MONGO_URI || '';
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function assertSafeMongoUri(value) {
  assert(value, 'ORDERS_STAGE2_MONGO_URI no está configurado.');

  const parsed = new URL(value);
  assert(
    ['mongodb:', 'mongodb+srv:'].includes(parsed.protocol),
    'La URI de Etapa 2 debe ser de MongoDB.'
  );
  assert.strictEqual(
    parsed.protocol,
    'mongodb:',
    'La integración de Etapa 2 no acepta Atlas ni mongodb+srv.'
  );
  assert(
    ['127.0.0.1', 'localhost'].includes(parsed.hostname),
    'La integración de Etapa 2 solo acepta MongoDB local.'
  );
  assert.strictEqual(
    parsed.pathname.replace(/^\//, ''),
    REQUIRED_DATABASE,
    `La base temporal debe llamarse ${REQUIRED_DATABASE}.`
  );
  assert.strictEqual(
    parsed.searchParams.get('replicaSet'),
    'rs0',
    'La integración de Etapa 2 exige replicaSet=rs0.'
  );
}

function baseOrder({
  orderNumber,
  cashSession = null,
  total = 100000,
} = {}) {
  const productId = new mongoose.Types.ObjectId();
  return {
    orderNumber,
    sessionId: `${orderNumber}-SESSION`,
    source: cashSession ? 'pos' : 'online',
    status: 'delivered',
    subtotal: total,
    total,
    cashSession,
    payment: {
      provider: 'manual',
      method: cashSession ? 'cash' : 'transfer',
      status: 'paid',
      amount: total,
      currency: 'COP',
      paidAt: new Date(),
    },
    items: [
      {
        product: productId,
        productId: String(productId),
        title: 'Producto temporal de conciliación',
        productType: 'physical',
        variantKey: 'default__default',
        quantity: 5,
        qty: 5,
        price: total / 5,
        unitPrice: total / 5,
        lineTotal: total,
      },
    ],
  };
}

async function createProcessedRefund(
  order,
  { number, amount, returnedQuantity } = {}
) {
  const orderItem = order.items[0];
  const refund = await OrderRefund.create({
    refundNumber: number,
    order: order._id,
    orderNumber: order.orderNumber,
    idempotencyKey: `${number}-IDEMPOTENCY`,
    requestHash: `${number}-REQUEST-HASH`.toLowerCase(),
    status: 'processed',
    amount,
    currency: 'COP',
    reason: 'Prueba aislada de conciliación comercial',
    items: [
      {
        orderItemId: orderItem._id,
        product: orderItem.product,
        title: orderItem.title,
        productType: orderItem.productType,
        variantKey: orderItem.variantKey,
        purchasedQuantity: orderItem.quantity,
        returnedQuantity,
      },
    ],
    processedAt: new Date(),
    reconciliation: {
      inventory: { state: 'pending' },
      payment: { state: 'action_required' },
      cash: { state: order.cashSession ? 'pending' : 'not_required' },
      billing: { state: 'pending' },
    },
  });

  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        'refundControl.totalAmount': amount,
        'refundControl.transactionCount': 1,
        'refundControl.lastRefund': refund._id,
        'refundControl.lastRefundAt': refund.processedAt,
      },
    }
  );

  return refund;
}

async function runFullRefundScenario() {
  const branchId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const cashSession = await CashSession.create({
    sessionCode: 'CAJA-STAGE2-TOTAL',
    status: 'open',
    branch: branchId,
    branchSnapshot: {
      name: 'Sede temporal',
      code: 'STAGE2',
      type: 'store',
    },
    cashRegisterCode: 'CAJA STAGE2',
    cashier: adminId,
    cashierSnapshot: {
      username: 'ci-stage2',
      displayName: 'CI Etapa 2',
      role: 'owner',
      adminRole: 'owner',
    },
    openingAmount: 5000,
  });

  const order = await Order.create(
    baseOrder({
      orderNumber: 'ORD-STAGE2-TOTAL',
      cashSession: cashSession._id,
    })
  );
  const invoice = await ElectronicInvoice.create({
    orderId: order._id,
    orderNumber: order.orderNumber,
    idempotencyKey: 'invoice-stage2-total',
    required: true,
    status: 'accepted',
    invoiceNumber: 'FV-STAGE2-001',
    provider: {
      name: 'factus',
      number: 'FV-STAGE2-001',
      isValidated: true,
    },
  });
  const refund = await createProcessedRefund(order, {
    number: 'RF-STAGE2-TOTAL',
    amount: 100000,
    returnedQuantity: 5,
  });

  const pending = await refreshOrderRefundReconciliation(refund._id);
  assert.strictEqual(pending.reconciliation.state, 'action_required');
  assert.strictEqual(pending.reconciliation.inventory.state, 'completed');
  assert.strictEqual(pending.reconciliation.payment.state, 'action_required');
  assert.strictEqual(pending.reconciliation.cash.state, 'completed');
  assert.strictEqual(pending.reconciliation.billing.state, 'action_required');

  let persistedOrder = await Order.findById(order._id).lean();
  assert.strictEqual(persistedOrder.status, 'delivered');
  assert.deepStrictEqual(
    [...persistedOrder.refundControl.pendingActions].sort(),
    ['confirm_payment_reversal', 'issue_credit_note']
  );

  let persistedCash = await CashSession.findById(cashSession._id).lean();
  assert.strictEqual(persistedCash.salesSummary.refunds, 100000);
  assert.strictEqual(persistedCash.salesSummary.netSales, 0);
  assert.strictEqual(persistedCash.salesSummary.paymentTotals.cash, 100000);
  assert.strictEqual(persistedCash.expectedCash, 105000);
  ok('la devolución registrada no finge que el dinero ya salió de caja');

  const paymentConfirmed = await confirmRefundPaymentReversal({
    orderId: order._id,
    refundId: refund._id,
    reference: 'REVERSO-STAGE2-001',
    adminLabel: 'CI Etapa 2',
  });
  assert.strictEqual(paymentConfirmed.reconciliation.payment.state, 'completed');
  assert.strictEqual(paymentConfirmed.reconciliation.state, 'action_required');

  persistedCash = await CashSession.findById(cashSession._id).lean();
  assert.strictEqual(persistedCash.salesSummary.paymentTotals.cash, 0);
  assert.strictEqual(persistedCash.expectedCash, 5000);
  persistedOrder = await Order.findById(order._id).lean();
  assert.strictEqual(persistedOrder.status, 'delivered');
  assert.deepStrictEqual(persistedOrder.refundControl.pendingActions, [
    'issue_credit_note',
  ]);
  ok('confirmar el reverso recalcula caja pero no omite la obligación fiscal');

  const creditNoteId = new mongoose.Types.ObjectId();
  invoice.creditNotes.push({
    _id: creditNoteId,
    idempotencyKey: 'credit-note-stage2-total',
    type: 'total',
    status: 'validated',
    referenceCode: 'NC-STAGE2-001',
    totalAmount: 100000,
    provider: {
      name: 'factus',
      number: 'NC-STAGE2-001',
      isValidated: true,
    },
    validatedAt: new Date(),
  });
  await invoice.save();
  const creditNote = invoice.creditNotes.id(creditNoteId);
  assert(creditNote, 'La nota crédito ficticia no quedó persistida en la factura temporal.');
  const completed = await linkRefundCreditNote({
    orderId: order._id,
    refundId: refund._id,
    invoice,
    creditNote,
    adminLabel: 'CI Etapa 2',
  });

  assert.strictEqual(completed.reconciliation.state, 'completed');
  assert.strictEqual(completed.reconciliation.billing.state, 'completed');
  assert.strictEqual(
    String(completed.reconciliation.electronicInvoice),
    String(invoice._id)
  );
  assert.strictEqual(
    String(completed.reconciliation.creditNoteId),
    String(creditNoteId)
  );

  persistedOrder = await Order.findById(order._id).lean();
  assert.strictEqual(persistedOrder.status, 'refunded');
  assert.strictEqual(persistedOrder.refundControl.reconciliationState, 'completed');
  assert.deepStrictEqual(persistedOrder.refundControl.pendingActions, []);
  ok('la devolución total cierra solo con inventario, dinero, caja y nota crédito completos');

  await confirmRefundPaymentReversal({
    orderId: order._id,
    refundId: refund._id,
    reference: 'REVERSO-STAGE2-001',
    adminLabel: 'CI Etapa 2',
  });
  await assert.rejects(
    () =>
      confirmRefundPaymentReversal({
        orderId: order._id,
        refundId: refund._id,
        reference: 'OTRO-REVERSO-STAGE2',
        adminLabel: 'CI Etapa 2',
      }),
    (error) => error?.code === 'PAYMENT_REVERSAL_ALREADY_CONFIRMED'
  );
  ok('la confirmación monetaria es idempotente y no acepta otra referencia');
}

async function runPartialRefundScenario() {
  const order = await Order.create(
    baseOrder({ orderNumber: 'ORD-STAGE2-PARTIAL', total: 100000 })
  );
  const refund = await createProcessedRefund(order, {
    number: 'RF-STAGE2-PARTIAL',
    amount: 40000,
    returnedQuantity: 2,
  });

  const pending = await refreshOrderRefundReconciliation(refund._id);
  assert.strictEqual(pending.reconciliation.billing.state, 'not_required');
  assert.strictEqual(pending.reconciliation.cash.state, 'not_required');

  const completed = await confirmRefundPaymentReversal({
    orderId: order._id,
    refundId: refund._id,
    reference: 'TRANSFERENCIA-STAGE2-002',
    adminLabel: 'CI Etapa 2',
  });
  assert.strictEqual(completed.reconciliation.state, 'completed');

  const persistedOrder = await Order.findById(order._id).lean();
  assert.strictEqual(persistedOrder.refundControl.reconciliationState, 'completed');
  assert.strictEqual(persistedOrder.status, 'delivered');
  ok('una devolución parcial conciliada no marca toda la orden como reembolsada');
}

async function main() {
  assertSafeMongoUri(MONGO_URI);
  await mongoose.connect(MONGO_URI);

  try {
    await mongoose.connection.dropDatabase();
    await Promise.all([
      CashSession.syncIndexes(),
      ElectronicInvoice.syncIndexes(),
      Order.syncIndexes(),
      OrderRefund.syncIndexes(),
    ]);
    await runFullRefundScenario();
    await runPartialRefundScenario();
    console.log(
      `\nIntegración comercial de Órdenes · Etapa 2: ${passed}/${passed} controles aprobados.`
    );
  } finally {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error('\nFALLO integración comercial de Órdenes · Etapa 2:', error);
  process.exitCode = 1;
});
