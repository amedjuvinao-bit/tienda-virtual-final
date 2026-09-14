/* eslint-disable no-console */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertInventoryMovementAccess,
  buildInventoryBranchAccess,
  buildScopedInventoryMovementFilter,
  buildScopedInventoryReservationFilter,
  buildScopedInventoryStockFilter,
} = require('../services/adminInventoryAccessService');
const {
  applyAvailableStockOut,
  getStockAvailability,
} = require('../services/inventoryStockPolicy');

const BRANCH_A = '64b000000000000000000101';
const BRANCH_B = '64b000000000000000000102';
const BRANCH_C = '64b000000000000000000103';

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function request({ role = 'warehouse', branches = [], query = {} } = {}) {
  return {
    adminRole: role,
    adminAuthType: 'db',
    adminBranches: branches,
    query,
  };
}

function assignment(branch, canManageInventory = false) {
  return { branch, canManageInventory };
}

function ids(values = []) {
  return values.map(String).sort();
}

function findClause(filter, predicate) {
  return (filter.$and || []).find(predicate);
}

function main() {
  const ownerAccess = buildInventoryBranchAccess(request({ role: 'owner' }));
  assert.equal(ownerAccess.ok, true);
  assert.equal(ownerAccess.mode, 'all');
  ok('propietario conserva acceso global al inventario');

  const warehouseRequest = request({
    branches: [assignment(BRANCH_A, true), assignment(BRANCH_B, false)],
  });
  const warehouseAccess = buildInventoryBranchAccess(warehouseRequest);
  assert.equal(warehouseAccess.ok, true);
  assert.equal(warehouseAccess.mode, 'assigned');
  assert.deepEqual(ids(warehouseAccess.branchIds), ids([BRANCH_A, BRANCH_B]));
  ok('consulta de bodega queda limitada a sus sedes asignadas');

  const managedAccess = buildInventoryBranchAccess(warehouseRequest, {
    requireManage: true,
  });
  assert.deepEqual(managedAccess.branchIds, [BRANCH_A]);
  ok('escritura exige canManageInventory por sede');

  const forbidden = buildInventoryBranchAccess(warehouseRequest, {
    requestedBranchId: BRANCH_C,
  });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.error, 'INVENTORY_BRANCH_FORBIDDEN');
  ok('una sede ajena se rechaza explícitamente');

  const noBranches = buildInventoryBranchAccess(request({ role: 'viewer' }));
  assert.equal(noBranches.ok, false);
  assert.equal(noBranches.status, 403);
  ok('un usuario sin sedes no recibe inventario global por omisión');

  const stockScope = buildScopedInventoryStockFilter(warehouseRequest, {
    deletedAt: null,
  });
  assert.deepEqual(ids(stockScope.filter.branch.$in), ids([BRANCH_A, BRANCH_B]));
  ok('existencias se filtran en MongoDB por sedes autorizadas');

  const reservationScope = buildScopedInventoryReservationFilter(
    warehouseRequest,
    { status: 'pending' }
  );
  const reservationVisible = findClause(
    reservationScope.filter,
    (clause) => clause['items.branch']
  );
  const reservationWhole = findClause(
    reservationScope.filter,
    (clause) => clause.items?.$not?.$elemMatch
  );
  assert.deepEqual(
    ids(reservationVisible['items.branch'].$in),
    ids([BRANCH_A, BRANCH_B])
  );
  assert.deepEqual(
    ids(reservationWhole.items.$not.$elemMatch.branch.$nin),
    ids([BRANCH_A, BRANCH_B])
  );
  ok('reservas multisede no exponen líneas de sedes ajenas');

  const movementScope = buildScopedInventoryMovementFilter(
    warehouseRequest,
    { deletedAt: null }
  );
  const movementClause = findClause(
    movementScope.filter,
    (clause) => Array.isArray(clause.$and)
  );
  assert.ok(movementClause);
  assert.equal(movementClause.$and.length, 3);
  ok('movimientos y traslados ocultan extremos fuera del alcance');

  const allowedAdjustment = assertInventoryMovementAccess(
    warehouseRequest,
    { type: 'adjustment_out', branch: BRANCH_A },
    { requireManage: true }
  );
  assert.equal(allowedAdjustment.ok, true);
  ok('ajuste autorizado funciona en una sede administrable');

  const forbiddenAdjustment = assertInventoryMovementAccess(
    warehouseRequest,
    { type: 'adjustment_out', branch: BRANCH_B },
    { requireManage: true }
  );
  assert.equal(forbiddenAdjustment.ok, false);
  assert.equal(forbiddenAdjustment.status, 403);
  ok('ajuste queda bloqueado en una sede solo consultable');

  const forbiddenTransfer = assertInventoryMovementAccess(
    warehouseRequest,
    { type: 'transfer', branchFrom: BRANCH_A, branchTo: BRANCH_B },
    { requireManage: true }
  );
  assert.equal(forbiddenTransfer.ok, false);
  assert.deepEqual(forbiddenTransfer.forbiddenBranchIds, [BRANCH_B]);
  ok('traslado exige autorización tanto en origen como en destino');

  const availability = getStockAvailability({ stock: 10, reservedStock: 7 });
  assert.deepEqual(availability, {
    stock: 10,
    reservedStock: 7,
    availableStock: 3,
  });
  ok('disponibilidad se calcula desde stock físico menos reservado');

  const protectedStock = { stock: 10, reservedStock: 7, availableStock: 3 };
  assert.throws(
    () => applyAvailableStockOut(protectedStock, 4),
    (error) =>
      error.code === 'INSUFFICIENT_AVAILABLE_STOCK' &&
      error.statusCode === 409 &&
      error.details?.availableStock === 3
  );
  assert.deepEqual(protectedStock, {
    stock: 10,
    reservedStock: 7,
    availableStock: 3,
  });
  ok('una salida no puede consumir unidades reservadas');

  const exactStock = { stock: 10, reservedStock: 7, availableStock: 3 };
  const impact = applyAvailableStockOut(exactStock, 3);
  assert.deepEqual(impact, { before: 10, quantity: 3, after: 7 });
  assert.deepEqual(exactStock, {
    stock: 7,
    reservedStock: 7,
    availableStock: 0,
  });
  ok('una salida exacta conserva íntegra la reserva pendiente');

  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'adminInventory.js'),
    'utf8'
  );
  assert.match(routeSource, /buildScopedInventoryStockFilter/);
  assert.match(routeSource, /buildScopedInventoryReservationFilter/);
  assert.match(routeSource, /buildScopedInventoryMovementFilter/);
  assert.match(routeSource, /assertInventoryMovementAccess/);
  assert.match(
    routeSource,
    /router\.get\('\/export', requirePermission\('inventory:export'\)/
  );
  ok('rutas administrativas aplican alcance y permiso específico de exportación');

  assert.match(routeSource, /ADMIN_INVENTORY_MOVEMENT_TYPE_FORBIDDEN/);
  assert.doesNotMatch(routeSource, /INVENTORY_DRAFT_WORKFLOW_UNAVAILABLE/);
  assert.match(routeSource, /postNow:\s*req\.body\?\.postNow !== false/);
  ok('la API bloquea tipos internos y permite borradores solo mediante el flujo de aprobación');

  const inventoryServiceSource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'inventoryService.js'),
    'utf8'
  );
  assert.match(inventoryServiceSource, /INVALID_INVENTORY_MOVEMENT_TYPE/);
  assert.match(inventoryServiceSource, /INVENTORY_MOVEMENT_WITHOUT_STOCK_IMPACT/);
  ok('el servicio rechaza movimientos desconocidos o sin impacto real');

  const posSource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'adminPosService.js'),
    'utf8'
  );
  assert.doesNotMatch(
    posSource,
    /allowNegativeStock === true\s*\?\s*\{\}/
  );
  ok('POS tampoco puede saltarse la disponibilidad reservada');

  console.log(`\nInventario Nivel Plus Etapa 1: ${passed}/18 controles aprobados.`);
}

try {
  main();
} catch (error) {
  console.error('\nFALLO Inventario Nivel Plus Etapa 1:', error);
  process.exitCode = 1;
}
