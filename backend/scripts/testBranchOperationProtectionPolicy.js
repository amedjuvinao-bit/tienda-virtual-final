'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryMovement = require('../models/InventoryMovement');
const CashSession = require('../models/CashSession');
const Order = require('../models/Order');
const OrderReturn = require('../models/OrderReturn');
const OrderRefund = require('../models/OrderRefund');
const PosHeldSale = require('../models/PosHeldSale');
const FinanceExpense = require('../models/FinanceExpense');
const FinanceBudget = require('../models/FinanceBudget');
const FinancePeriodClose = require('../models/FinancePeriodClose');

const { getBranchOperationSummary, hasBranchOperation } =
  require('../services/branchOperationProtectionService');

const branchId = new mongoose.Types.ObjectId();
const models = [InventoryStock, InventoryReservation, InventoryMovement, CashSession, Order, PosHeldSale,
  FinanceExpense, FinanceBudget, FinancePeriodClose];
const originalCounters = models.map((model) => model.countDocuments);
const relatedModels = [OrderReturn, OrderRefund];
const originalAggregates = relatedModels.map((model) => model.aggregate);
const originalFindOne = Branch.findOne;
let scenario = {};

function setScenario(values = {}) {
  scenario = values;
}

function fakeCount(model, filter) {
  if (model === InventoryStock) {
    assert.equal(String(filter.branch), String(branchId));
    if (!filter.stock && !filter.reservedStock) return scenario.historicalStockRowsCount || 0;
    assert.equal(filter.deletedAt, null);
    assert.equal(filter.active, undefined); // El stock persiste aunque la fila esté inactiva.
    return filter.stock ? scenario.activeStockCount || 0 : scenario.reservedStockCount || 0;
  }
  if (model === InventoryReservation) {
    return filter.status === 'pending'
      ? scenario.pendingReservationsCount || 0
      : scenario.historicalReservationsCount || 0;
  }
  if (model === InventoryMovement) {
    if (filter.status === 'draft') assert.equal(filter.deletedAt, null);
    assert.equal(String(filter.$or[0].branchFrom), String(branchId));
    assert.equal(String(filter.$or[1].branchTo), String(branchId));
    return filter.status === 'draft'
      ? scenario.pendingMovementsCount || 0
      : scenario.historicalMovementsCount || 0;
  }
  if (model === CashSession) {
    assert.equal(String(filter.branch), String(branchId));
    return filter.status === 'open'
      ? scenario.openCashSessionsCount || 0
      : scenario.historicalCashSessionsCount || 0;
  }
  if (model === Order) {
    assert.deepEqual(filter.$or.map((entry) => Object.keys(entry)[0]), [
      'branch', 'inventoryAllocations.branch', 'fulfillment.shipments.branch',
    ]);
    assert(filter.$or.every((entry) => String(Object.values(entry)[0]) === String(branchId)));
    if (!filter.status) return scenario.historicalOrdersCount || 0;
    assert(filter.status.$in.includes('shipped'));
    assert(filter.fulfillmentStatus.$nin.includes('delivered'));
    return scenario.pendingOrdersCount || 0;
  }
  if (model === FinanceExpense) {
    assert.equal(String(filter.branch), String(branchId));
    if (!filter.$or) return scenario.historicalExpensesCount || 0;
    assert.equal(filter.deletedAt, null);
    assert(filter.$or.some((entry) => entry.status === 'paid' &&
      entry['settlement.status'].$in.includes('partial')));
    return scenario.pendingExpensesCount || 0;
  }
  if (model === FinanceBudget) {
    assert.equal(String(filter.branch), String(branchId));
    return filter.status === 'active'
      ? scenario.activeBudgetsCount || 0 : scenario.historicalBudgetsCount || 0;
  }
  if (model === FinancePeriodClose) {
    assert.equal(String(filter.branch), String(branchId));
    return filter.status === 'provisional'
      ? scenario.provisionalPeriodClosesCount || 0 : scenario.historicalPeriodClosesCount || 0;
  }
  assert.equal(String(filter.branch), String(branchId));
  return filter.status === 'active'
    ? scenario.heldSalesCount || 0
    : scenario.historicalHeldSalesCount || 0;
}

async function request(server, path, method, body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  models.forEach((model) => {
    model.countDocuments = async (filter) => fakeCount(model, filter);
  });
  relatedModels.forEach((model, index) => {
    model.aggregate = async (pipeline) => {
      assert.equal(pipeline[1].$lookup.from, Order.collection.name);
      assert.equal(pipeline[1].$lookup.localField, 'order');
      assert.equal(String(pipeline[3].$match.$or[0]['linkedOrder.branch']), String(branchId));
      assert.equal(String(pipeline[3].$match.$or[3]['inventoryRestorations.branch']), String(branchId));
      const kind = index === 0 ? 'Returns' : 'Refunds';
      const count = scenario[pipeline[0].$match.$or ? `pending${kind}Count` : `historical${kind}Count`] || 0;
      return count ? [{ count }] : [];
    };
  });
  Branch.findOne = () => ({
    select() { return this; },
    async lean() { return { _id: branchId, active: true, status: 'active' }; },
  });

  // Las rutas se ejecutan con autenticación simulada, sin escribir en MongoDB.
  const adminPath = require.resolve('../middleware/requireAdmin');
  const permissionPath = require.resolve('../middleware/requirePermission');
  require(adminPath);
  require(permissionPath);
  const originalAdmin = require.cache[adminPath].exports;
  const originalPermission = require.cache[permissionPath].exports;
  let server;

  try {
    require.cache[adminPath].exports = (_req, _res, next) => next();
    require.cache[permissionPath].exports = () => (_req, _res, next) => next();
    const router = require('../routes/adminBranchProtection');
    const app = express();
    app.use(express.json());
    app.use('/api/admin/branches', router);
    app.use((_req, res) => res.json({ ok: true }));
    server = app.listen(0, '127.0.0.1');

    const path = `/api/admin/branches/${branchId}`;
    const disable = { active: false, status: 'inactive' };

    // Una venta cerrada, una caja cerrada y un movimiento aplicado son historial.
    setScenario({
      historicalStockRowsCount: 1,
      historicalReservationsCount: 1,
      historicalMovementsCount: 1,
      historicalCashSessionsCount: 1,
      historicalOrdersCount: 1,
      historicalHeldSalesCount: 1,
      historicalReturnsCount: 1,
      historicalRefundsCount: 1,
      historicalExpensesCount: 1,
      historicalBudgetsCount: 1,
      historicalPeriodClosesCount: 1,
    });
    const summary = await getBranchOperationSummary(branchId);
    assert.equal(hasBranchOperation(summary), false);
    assert.equal((await request(server, `${path}/status`, 'PATCH', disable)).status, 200);
    assert.equal((await request(server, path, 'PUT', disable)).status, 200);
    const deletion = await request(server, path, 'DELETE');
    assert.equal(deletion.status, 409);
    assert.equal(deletion.body.operationSummary.historicalOrdersCount, 1);
    assert.equal(deletion.body.operationSummary.historicalReservationsCount, 1);
    assert.equal(deletion.body.operationSummary.historicalExpensesCount, 1);
    assert.equal(deletion.body.operationSummary.historicalReturnsCount, 1);

    // Una sola tarea pendiente de cualquiera de los procesos debe bloquear.
    for (const key of [
      'activeStockCount', 'reservedStockCount', 'pendingReservationsCount',
      'pendingMovementsCount', 'openCashSessionsCount', 'pendingOrdersCount',
      'heldSalesCount',
      'pendingReturnsCount', 'pendingRefundsCount', 'pendingExpensesCount',
      'activeBudgetsCount', 'provisionalPeriodClosesCount',
    ]) {
      setScenario({ [key]: 1 });
      const result = await request(server, `${path}/status`, 'PATCH', disable);
      assert.equal(result.status, 409, key);
      assert.equal(result.body.code, 'BRANCH_HAS_OPERATION');
      assert.equal(result.body.operationSummary[key], 1);
    }

    setScenario({ openCashSessionsCount: 1, pendingOrdersCount: 1 });
    const editResult = await request(server, path, 'PUT', disable);
    assert.equal(editResult.status, 409);
    assert.equal(editResult.body.operationSummary.openCashSessionsCount, 1);
    assert.equal(editResult.body.operationSummary.pendingOrdersCount, 1);

    console.log('Sedes: el historial permite desactivar, impide eliminar y las operaciones pendientes bloquean ambos cambios.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    models.forEach((model, index) => { model.countDocuments = originalCounters[index]; });
    relatedModels.forEach((model, index) => { model.aggregate = originalAggregates[index]; });
    Branch.findOne = originalFindOne;
    require.cache[adminPath].exports = originalAdmin;
    require.cache[permissionPath].exports = originalPermission;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
