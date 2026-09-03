'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const CashSession = require('../models/CashSession');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const PosHeldSale = require('../models/PosHeldSale');
const { buildPosShiftSummary } = require('../services/posShiftReportService');

const MONGO_URI = String(process.env.POS_STAGE4_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'pos_stage4_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error('POS_STAGE4_MONGO_URI es obligatoria.');
  }
  const database = uri.split('?')[0].split('/').pop();
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`La prueba solo puede ejecutarse en la base aislada ${EXPECTED_DATABASE}.`);
  }
}

async function main() {
  assertDedicatedDatabase(MONGO_URI);
  await mongoose.connect(MONGO_URI, { autoIndex: true });

  try {
    const now = new Date('2026-09-03T20:00:00.000Z');
    const cashier = new mongoose.Types.ObjectId();
    const [branch, otherBranch] = await Branch.create([
      {
        name: 'Sede CI Etapa 4',
        code: 'POS-STAGE4',
        type: 'store',
        status: 'active',
        active: true,
        settings: { allowPosSales: true, requireCashSessionForPos: true },
      },
      {
        name: 'Otra sede CI Etapa 4',
        code: 'POS-STAGE4-B',
        type: 'store',
        status: 'active',
        active: true,
        settings: { allowPosSales: true, requireCashSessionForPos: true },
      },
    ]);
    const cashSessionId = new mongoose.Types.ObjectId();

    await CashSession.collection.insertOne({
      _id: cashSessionId,
      __v: 0,
      sessionCode: 'CAJA-20260903-STAGE4',
      status: 'open',
      branch: branch._id,
      branchSnapshot: { name: branch.name, code: branch.code, type: branch.type },
      cashRegisterCode: 'CAJA POS',
      cashRegisterName: 'Caja POS',
      cashier,
      cashierSnapshot: { username: 'cajero.stage4', displayName: 'Cajero Etapa 4', role: 'seller', adminRole: 'seller' },
      openedBy: cashier,
      openedAt: new Date('2026-09-03T13:00:00.000Z'),
      openingAmount: 50000,
      expectedCash: 50000,
      countedCash: 0,
      differenceAmount: 0,
      cashMovements: [
        { type: 'cash_in', direction: 'in', amount: 5000, reason: 'Cambio adicional', createdAt: now },
        { type: 'cash_out', direction: 'out', amount: 2000, reason: 'Retiro', createdAt: now },
      ],
      salesSummary: {},
      createdAt: new Date('2026-09-03T13:00:00.000Z'),
      updatedAt: now,
    });

    const cashOrderId = new mongoose.Types.ObjectId();
    const mixedOrderId = new mongoose.Types.ObjectId();
    await Order.collection.insertMany([
      {
        _id: cashOrderId,
        sessionId: 'pos-stage4-cash',
        orderNumber: 'STAGE4-CASH',
        source: 'pos',
        status: 'paid',
        branch: branch._id,
        cashSession: cashSessionId,
        subtotal: 30000,
        total: 28500,
        discount: { amount: 1500 },
        items: [{ quantity: 1 }],
        payment: { method: 'cash', amount: 28500 },
        paymentProcessing: { invoice: { status: 'pending' } },
        refundControl: { totalAmount: 0, reconciliationState: 'not_started' },
        createdAt: new Date('2026-09-03T14:00:00.000Z'),
        updatedAt: now,
      },
      {
        _id: mixedOrderId,
        sessionId: 'pos-stage4-mixed',
        orderNumber: 'STAGE4-MIXED',
        source: 'pos',
        status: 'refunded',
        branch: branch._id,
        cashSession: cashSessionId,
        subtotal: 50000,
        total: 50000,
        discount: { amount: 0 },
        items: [{ quantity: 2 }],
        payment: {
          method: 'mixed',
          amount: 50000,
          splitPayments: [
            { method: 'cash', amount: 20000 },
            { method: 'card', amount: 30000 },
          ],
        },
        paymentProcessing: { invoice: { status: 'not_required' } },
        refundControl: { totalAmount: 10000, reconciliationState: 'completed' },
        createdAt: new Date('2026-09-03T15:00:00.000Z'),
        updatedAt: now,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        sessionId: 'pos-stage4-other-branch',
        orderNumber: 'STAGE4-OTHER-BRANCH',
        source: 'pos',
        status: 'paid',
        branch: otherBranch._id,
        subtotal: 999999,
        total: 999999,
        items: [{ quantity: 20 }],
        payment: { method: 'cash', amount: 999999 },
        createdAt: new Date('2026-09-03T16:00:00.000Z'),
        updatedAt: now,
      },
    ]);

    await OrderRefund.collection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      order: mixedOrderId,
      amount: 10000,
      status: 'processed',
      reconciliation: { payment: { state: 'completed' } },
      createdAt: now,
      updatedAt: now,
    });

    await ElectronicInvoice.collection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      orderId: mixedOrderId,
      orderNumber: 'STAGE4-MIXED',
      required: true,
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
    });

    await PosHeldSale.collection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      code: 'ESPERA-STAGE4',
      status: 'active',
      branch: branch._id,
      subtotalSnapshot: 12000,
      items: [{ product: new mongoose.Types.ObjectId(), productId: 'p1', title: 'Producto', quantity: 1, unitPrice: 12000 }],
      createdAt: now,
      updatedAt: now,
    });

    const report = await buildPosShiftSummary({
      branch,
      branchIds: [String(branch._id)],
      range: 'current_shift',
      cashRegisterCode: 'CAJA POS',
      billingActive: true,
      now,
    });

    assert.equal(report.period.effectiveRange, 'current_shift');
    assert.equal(report.metrics.ordersCount, 2);
    assert.equal(report.metrics.itemsCount, 3);
    assert.equal(report.metrics.grossSales, 80000);
    assert.equal(report.metrics.discounts, 1500);
    assert.equal(report.metrics.refunds, 10000);
    assert.equal(report.metrics.netSales, 68500);
    console.log('OK 01 las métricas de jornada se calculan desde ventas POS de la sede');

    assert.equal(report.paymentBreakdown.cash, 48500);
    assert.equal(report.paymentBreakdown.card, 30000);
    assert.equal(report.paymentBreakdown.total, 78500);
    console.log('OK 02 el pago mixto se desglosa por medio sin perder el total cobrado');

    assert.equal(report.reconciliation.cashSales, 44500);
    assert.equal(report.reconciliation.cashIn, 5000);
    assert.equal(report.reconciliation.cashOut, 2000);
    assert.equal(report.reconciliation.expectedCash, 97500);
    console.log('OK 03 la caja descuenta el reembolso confirmado y concilia movimientos');

    assert.equal(report.heldSales.activeCount, 1);
    assert.equal(report.heldSales.activeValue, 12000);
    assert.ok(report.alerts.some((alert) => alert.code === 'held_sales'));
    assert.ok(report.alerts.some((alert) => alert.code === 'invoice_pending'));
    assert.equal(report.status, 'attention');
    console.log('OK 04 el control operativo expone espera y facturación pendiente');

    assert.ok(report.serverAuthoritative);
    assert.equal(report.branch.id, String(branch._id));
    assert.notEqual(report.metrics.netSales, 1068499);
    console.log('OK 05 la respuesta es autoritativa y aísla completamente otra sede');

    await CashSession.deleteOne({ _id: cashSessionId });
    const fallback = await buildPosShiftSummary({
      branch,
      branchIds: [String(branch._id)],
      range: 'current_shift',
      cashRegisterCode: 'CAJA POS',
      billingActive: true,
      now,
    });
    assert.equal(fallback.period.fallback, true);
    assert.equal(fallback.period.effectiveRange, 'today');
    assert.ok(fallback.alerts.some((alert) => alert.code === 'cash_session_required'));
    assert.equal(fallback.status, 'critical');
    console.log('OK 06 sin caja abierta el reporte vuelve a hoy y bloquea el estado saludable');

    console.log('\nIntegración Etapa 4 POS: 6/6 controles superados.');
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('FAIL integración Etapa 4 POS');
  console.error(error);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => null);
  process.exitCode = 1;
});
