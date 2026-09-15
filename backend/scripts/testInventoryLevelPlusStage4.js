/* eslint-disable no-console */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildBranchAlertSummaries,
  buildCoverageEstimates,
  buildInventoryAnomalies,
  buildStuckReservationItems,
} = require('../services/inventoryOperationalIntelligence');

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function stock(overrides = {}) {
  return {
    _id: overrides._id || 'stock-a',
    active: true,
    product: {
      _id: overrides.productId || 'product-a',
      title: overrides.title || 'Alimento Premium',
      sku: overrides.sku || 'ALI-2KG',
    },
    branch: {
      _id: overrides.branchId || 'branch-a',
      name: overrides.branchName || 'Sede Principal',
      code: overrides.branchCode || 'PRINCIPAL',
    },
    variantKey: overrides.variantKey || 'size:2kg|formula:adulto',
    variant: { label: '2 kg / Adulto' },
    stock: overrides.stock ?? 12,
    reservedStock: overrides.reservedStock ?? 2,
    availableStock: overrides.availableStock ?? 10,
  };
}

function saleMovement(overrides = {}) {
  return {
    _id: overrides._id || 'movement-sale-a',
    status: 'posted',
    type: 'sale_out',
    quantity: overrides.quantity ?? 15,
    product: { _id: overrides.productId || 'product-a' },
    branchFrom: { _id: overrides.branchId || 'branch-a' },
    variantKey: overrides.variantKey || 'size:2kg|formula:adulto',
    postedAt: overrides.postedAt || '2026-09-10T12:00:00.000Z',
  };
}

function reservation(overrides = {}) {
  return {
    _id: overrides._id || 'reservation-a',
    reservationCode: overrides.code || 'RES-STUCK-001',
    status: 'pending',
    createdAt: overrides.createdAt || '2026-09-14T11:00:00.000Z',
    expiresAt: overrides.expiresAt || '2026-09-14T13:00:00.000Z',
    totalQuantity: 2,
    items: [
      {
        product: { _id: 'product-a', title: 'Alimento Premium', sku: 'ALI-2KG' },
        branch: { _id: 'branch-a', name: 'Sede Principal', code: 'PRINCIPAL' },
        variantKey: 'size:2kg|formula:adulto',
        variantLabel: '2 kg / Adulto',
      },
    ],
  };
}

function main() {
  const now = new Date('2026-09-14T12:00:00.000Z');
  const coverage = buildCoverageEstimates(
    [stock()],
    [saleMovement()],
    { now, windowDays: 30 }
  );

  assert.equal(coverage.length, 1);
  assert.equal(coverage[0].soldQuantity, 15);
  assert.equal(coverage[0].dailyDemand, 0.5);
  assert.equal(coverage[0].coverageDays, 20);
  assert.equal(coverage[0].severity, 'healthy');
  ok('calcula cobertura explicable con ventas aplicadas de 30 días');

  const urgentCoverage = buildCoverageEstimates(
    [stock({ stock: 3, reservedStock: 0, availableStock: 3 })],
    [saleMovement({ quantity: 30 })],
    { now, windowDays: 30 }
  );
  assert.equal(urgentCoverage[0].coverageDays, 3);
  assert.equal(urgentCoverage[0].severity, 'critical');
  ok('clasifica como crítica una cobertura inferior a siete días');

  assert.equal(
    buildCoverageEstimates(
      [stock()],
      [saleMovement({ postedAt: '2026-07-01T12:00:00.000Z' })],
      { now }
    ).length,
    0
  );
  ok('excluye ventas fuera de la ventana de análisis');

  const stuck = buildStuckReservationItems([reservation()], {
    now,
    thresholdMinutes: 30,
  });
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].ageMinutes, 60);
  assert.equal(stuck[0].severity, 'warning');
  ok('detecta reservas pendientes con demora inusual');

  const overdue = buildStuckReservationItems([
    reservation({ expiresAt: '2026-09-14T11:30:00.000Z' }),
  ], { now });
  assert.equal(overdue[0].overdue, true);
  assert.equal(overdue[0].severity, 'critical');
  ok('prioriza reservas que siguen pendientes después de vencer');

  assert.equal(
    buildStuckReservationItems([
      reservation({ createdAt: '2026-09-14T11:50:00.000Z' }),
    ], { now }).length,
    0
  );
  ok('no marca como atascada una reserva reciente y vigente');

  const anomalies = buildInventoryAnomalies([
    stock({ availableStock: 99 }),
  ], []);
  assert.equal(anomalies[0].code, 'AVAILABLE_MISMATCH');
  assert.equal(anomalies[0].severity, 'critical');
  ok('detecta diferencias entre stock físico, reservado y disponible');

  const transferAnomalies = buildInventoryAnomalies([], [{
    _id: 'transfer-invalid',
    movementNumber: 'IM-INVALID',
    status: 'posted',
    type: 'transfer',
    product: { _id: 'product-a', title: 'Alimento Premium' },
    branchFrom: { _id: 'branch-a', name: 'Sede Principal' },
    branchTo: { _id: 'branch-a', name: 'Sede Principal' },
    variantKey: 'size:2kg|formula:adulto',
  }]);
  assert.ok(transferAnomalies.some((item) => item.code === 'INVALID_TRANSFER_ROUTE'));
  assert.ok(transferAnomalies.some((item) => item.code === 'POSTED_WITHOUT_DATE'));
  ok('detecta traslados aplicados con ruta o fecha inválidas');

  const branchAlerts = buildBranchAlertSummaries({
    coverageEstimates: urgentCoverage,
    stuckReservations: overdue,
    anomalies,
  });
  assert.equal(branchAlerts.length, 1);
  assert.equal(branchAlerts[0].id, 'branch-a');
  assert.ok(branchAlerts[0].critical >= 3);
  ok('consolida los riesgos por sede sin mezclar ubicaciones');

  const routeSource = read('routes/adminInventory.js');
  assert.match(routeSource, /buildCoverageEstimates/);
  assert.match(routeSource, /buildStuckReservationItems/);
  assert.match(routeSource, /buildInventoryAnomalies/);
  assert.match(routeSource, /buildBranchAlertSummaries/);
  assert.match(routeSource, /buildScopedInventoryMovementFilter/);
  ok('la API calcula inteligencia dentro del alcance de sedes autorizado');

  assert.match(routeSource, /requirePermission\('inventory:export'\)/);
  assert.match(routeSource, /if \(\/\^\[=\+\\-@\]\//);
  assert.match(routeSource, /stockStatus/);
  ok('la exportación exige permiso, conserva filtros y neutraliza fórmulas CSV');

  const adminSource = read('../frontend/src/admin/InventoryAdmin.jsx');
  assert.match(adminSource, /\/api\/admin\/inventory\/export/);
  assert.match(adminSource, /responseType: 'blob'/);
  assert.match(adminSource, /Preparando archivo/);
  assert.doesNotMatch(adminSource, /function downloadVisibleInventoryCsv/);
  ok('el panel descarga la exportación segura preparada por el backend');

  const panelSource = read('../frontend/src/admin/inventory/components/InventoryAlertsPanel.jsx');
  assert.match(panelSource, /label="Inteligencia"/);
  assert.match(panelSource, /Cobertura estimada/);
  assert.match(panelSource, /Reservas atascadas/);
  assert.match(panelSource, /Anomalías operativas/);
  assert.match(panelSource, /Alertas por sede/);
  ok('la interfaz organiza la inteligencia en una vista independiente y comprensible');

  console.log(`\nInventario Nivel Plus Etapa 4: ${passed}/${passed} controles aprobados.`);
}

try {
  main();
} catch (error) {
  console.error('\nFALLO Inventario Nivel Plus Etapa 4:', error);
  process.exitCode = 1;
}
