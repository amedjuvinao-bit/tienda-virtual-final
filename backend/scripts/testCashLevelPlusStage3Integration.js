'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const CashSession = require('../models/CashSession');
const Order = require('../models/Order');
const {
  closeCashSession,
  openCashSession,
} = require('../services/cashSessionService');
const { buildCashJourneySummary } = require('../services/cashReconciliationService');

const MONGO_URI = String(process.env.CASH_STAGE3_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'cash_stage3_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) throw new Error('CASH_STAGE3_MONGO_URI es obligatoria.');
  if (uri.split('?')[0].split('/').pop() !== EXPECTED_DATABASE) throw new Error(`La prueba solo puede ejecutarse en la base aislada ${EXPECTED_DATABASE}.`);
}

async function insertPosOrder({ branch, cashSession, total, method, number }) {
  await Order.collection.insertOne({
    orderNumber: number,
    source: 'pos',
    status: 'paid',
    branch: branch._id,
    cashSession: cashSession._id,
    subtotal: total,
    total,
    items: [{ quantity: 1, price: total, title: `Producto ${number}` }],
    payment: { method, amount: total, status: 'approved' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function main() {
  assertDedicatedDatabase(MONGO_URI);
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  try {
    await mongoose.connection.dropDatabase();
    await Promise.all([Branch.createIndexes(), CashSession.createIndexes()]);
    const branch = await Branch.create({
      name: 'Sede Caja Etapa 3 CI', code: 'CASH-STAGE3', type: 'store',
      status: 'active', active: true,
      settings: { allowPosSales: true, requireCashSessionForPos: true },
    });
    const cashier = { id: new mongoose.Types.ObjectId(), username: 'cajero.stage3', displayName: 'Cajero Etapa 3', role: 'cashier', adminRole: 'cashier' };
    const cashierAccess = { admin: cashier, branchIds: [branch._id], canSupervise: false };

    const first = await openCashSession({ branchId: branch._id, cashRegisterCode: 'CAJA POS', openingAmount: 50000 }, { admin: cashier });
    await insertPosOrder({ branch, cashSession: first, total: 30000, method: 'cash', number: 'POS-STAGE3-001' });
    await insertPosOrder({ branch, cashSession: first, total: 20000, method: 'transfer', number: 'POS-STAGE3-002' });
    const closed = await closeCashSession(first._id, {
      countedCash: 80000,
      denominations: [{ value: 20000, quantity: 4 }],
      closingNotes: 'Cierre conciliado Etapa 3',
    }, cashierAccess);
    assert.equal(closed.status, 'closed');
    assert.equal(closed.reconciliation.status, 'balanced');
    assert.equal(closed.reconciliation.paymentTotal, 50000);
    assert.equal(closed.reconciliation.cashSales, 30000);
    console.log('OK 01 el cierre persiste la conciliación de ventas y pagos');

    const stored = await CashSession.findById(first._id).lean();
    assert.equal(stored.reconciliation.version, 'cash-reconciliation-v1');
    assert.equal(stored.reconciliation.serverAuthoritative, true);
    assert.equal(stored.reconciliation.checks.every((item) => item.status === 'ok'), true);
    console.log('OK 02 la instantánea queda almacenada con controles auditables');

    const summary = await buildCashJourneySummary({
      branchId: branch._id,
      branchIds: [branch._id],
      range: 'today',
      toleranceAmount: 1000,
    });
    assert.equal(summary.totals.sessionsCount, 1);
    assert.equal(summary.totals.ordersCount, 2);
    assert.equal(summary.totals.netSales, 50000);
    assert.equal(summary.totals.paymentTotals.cash, 30000);
    assert.equal(summary.totals.paymentTotals.transfer, 20000);
    assert.equal(summary.status, 'healthy');
    console.log('OK 03 el consolidado diario suma sesiones, órdenes y medios de pago');

    await assert.rejects(
      () => buildCashJourneySummary({ branchId: branch._id, branchIds: [new mongoose.Types.ObjectId()] }),
      (error) => error.code === 'CASH_BRANCH_FORBIDDEN'
    );
    console.log('OK 04 el consolidado respeta el alcance de sede');

    const second = await openCashSession({ branchId: branch._id, cashRegisterCode: 'CAJA POS', openingAmount: 10000 }, { admin: cashier });
    const openSummary = await buildCashJourneySummary({ branchId: branch._id, branchIds: [branch._id], range: 'today', toleranceAmount: 1000 });
    assert.equal(openSummary.totals.openSessionsCount, 1);
    assert.equal(openSummary.status, 'attention');
    assert.equal(openSummary.sessions.some((row) => String(row.id) === String(second._id) && row.reconciliationStatus === 'in_progress'), true);
    console.log('OK 05 una jornada abierta se presenta como trabajo en curso');

    console.log('\nIntegración Etapa 3 Caja: 5/5 controles superados.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('FAIL integración Etapa 3 Caja');
  console.error(error);
  process.exitCode = 1;
});
