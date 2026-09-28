'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Order = require('../models/Order');
const OrderReturn = require('../models/OrderReturn');
const OrderRefund = require('../models/OrderRefund');
const FinanceExpense = require('../models/FinanceExpense');
const FinanceBudget = require('../models/FinanceBudget');
const FinancePeriodClose = require('../models/FinancePeriodClose');
const { getBranchOperationSummary, hasBranchOperation } = require('../services/branchOperationProtectionService');

async function main() {
  const uri = process.env.BRANCH_PROTECTION_TEST_MONGO_URI || '';
  assert(/\/orders_ci_branch_protection(?:\?|$)/.test(uri),
    'La integración solo puede usar la base aislada orders_ci_branch_protection.');
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    const branch = new mongoose.Types.ObjectId();
    const order = new mongoose.Types.ObjectId();
    const returnCase = new mongoose.Types.ObjectId();
    const refund = new mongoose.Types.ObjectId();
    const expense = new mongoose.Types.ObjectId();
    const budget = new mongoose.Types.ObjectId();
    const close = new mongoose.Types.ObjectId();
    const db = mongoose.connection.db;
    await db.collection(Branch.collection.name).insertOne({ _id: branch, code: 'QA-ISOLATED', active: true });
    await db.collection(Order.collection.name).insertOne({ _id: order, branch, status: 'delivered', fulfillmentStatus: 'delivered' });
    const empty = await getBranchOperationSummary(branch);
    assert.equal(hasBranchOperation(empty), false, 'Una orden entregada permite desactivar.');

    await db.collection(OrderReturn.collection.name).insertOne({ _id: returnCase, order, status: 'requested' });
    assert.equal((await getBranchOperationSummary(branch)).pendingReturnsCount, 1);
    await db.collection(OrderReturn.collection.name).updateOne({ _id: returnCase },
      { $set: { status: 'resolved', resolution: { state: 'completed' } } });
    assert.equal((await getBranchOperationSummary(branch)).pendingReturnsCount, 0);

    await db.collection(OrderRefund.collection.name).insertOne({
      _id: refund, order, status: 'processed', reconciliation: { state: 'action_required' },
    });
    assert.equal((await getBranchOperationSummary(branch)).pendingRefundsCount, 1);
    await db.collection(OrderRefund.collection.name).updateOne({ _id: refund },
      { $set: { 'reconciliation.state': 'completed' } });
    assert.equal((await getBranchOperationSummary(branch)).pendingRefundsCount, 0);

    await db.collection(FinanceExpense.collection.name).insertOne({
      _id: expense, branch, deletedAt: null, status: 'paid', settlement: { status: 'partial' },
    });
    assert.equal((await getBranchOperationSummary(branch)).pendingExpensesCount, 1);
    await db.collection(FinanceExpense.collection.name).updateOne({ _id: expense },
      { $set: { 'settlement.status': 'paid' } });
    assert.equal((await getBranchOperationSummary(branch)).pendingExpensesCount, 0);

    await db.collection(FinanceBudget.collection.name).insertOne({ _id: budget, branch, status: 'active' });
    assert.equal((await getBranchOperationSummary(branch)).activeBudgetsCount, 1);
    await db.collection(FinanceBudget.collection.name).updateOne({ _id: budget }, { $set: { status: 'inactive' } });

    await db.collection(FinancePeriodClose.collection.name).insertOne({ _id: close, branch, status: 'provisional' });
    assert.equal((await getBranchOperationSummary(branch)).provisionalPeriodClosesCount, 1);
    await db.collection(FinancePeriodClose.collection.name).updateOne({ _id: close }, { $set: { status: 'certified' } });

    assert.equal(hasBranchOperation(await getBranchOperationSummary(branch)), false,
      'El historial cerrado no impide desactivar.');
    const deletion = await getBranchOperationSummary(branch, { action: 'delete' });
    for (const key of ['historicalOrdersCount', 'historicalReturnsCount', 'historicalRefundsCount',
      'historicalExpensesCount', 'historicalBudgetsCount', 'historicalPeriodClosesCount']) {
      assert.equal(deletion[key], 1, `${key} impide eliminar.`);
    }
    console.log('MongoDB: devoluciones, reembolsos, finanzas e historial de sede verificados.');
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
