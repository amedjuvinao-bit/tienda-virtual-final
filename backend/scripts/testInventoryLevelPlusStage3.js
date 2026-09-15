/* eslint-disable no-console */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildStaleStockItems,
  buildTransferRecommendations,
} = require('../services/inventoryOperationalIntelligence');

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function stock({
  id,
  productId = 'product-a',
  branchId,
  branchName,
  availableStock,
  reorderPoint = 5,
  variantKey = 'size:2kg|formula:adulto',
  lastMovementAt = '2026-09-10T12:00:00.000Z',
}) {
  return {
    _id: id,
    active: true,
    product: {
      _id: productId,
      title: 'Alimento Premium',
      sku: 'ALIMENTO-2KG',
      reorderPoint,
    },
    branch: {
      _id: branchId,
      name: branchName,
      code: branchId.toUpperCase(),
    },
    variantKey,
    variant: {
      label: '2 kg / Adulto',
      attributes: [
        { key: 'size', value: '2 kg' },
        { key: 'formula', value: 'Adulto' },
      ],
    },
    stock: availableStock,
    reservedStock: 0,
    availableStock,
    reorderPoint,
    lastMovementAt,
  };
}

function main() {
  const rows = [
    stock({
      id: 'stock-origin',
      branchId: 'branch-a',
      branchName: 'Sede Norte',
      availableStock: 20,
    }),
    stock({
      id: 'stock-target',
      branchId: 'branch-b',
      branchName: 'Sede Sur',
      availableStock: 0,
    }),
  ];

  const recommendations = buildTransferRecommendations(rows);
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].sourceStockId, 'stock-origin');
  assert.equal(recommendations[0].destinationStockId, 'stock-target');
  assert.equal(recommendations[0].quantity, 10);
  assert.equal(recommendations[0].source.remainingAfterTransfer, 10);
  assert.equal(recommendations[0].destination.expectedAvailableStock, 10);
  ok('recomienda una reposición entre sedes para la misma variante');

  const differentVariant = stock({
    id: 'stock-other-variant',
    branchId: 'branch-a',
    branchName: 'Sede Norte',
    availableStock: 20,
    variantKey: 'size:10kg|formula:adulto',
  });
  assert.equal(
    buildTransferRecommendations([differentVariant, rows[1]]).length,
    0
  );
  ok('nunca mezcla presentaciones diferentes del mismo producto');

  const protectedOrigin = stock({
    id: 'stock-protected',
    branchId: 'branch-a',
    branchName: 'Sede Norte',
    availableStock: 5,
  });
  assert.equal(
    buildTransferRecommendations([protectedOrigin, rows[1]]).length,
    0
  );
  ok('protege el punto mínimo de la sede que entrega inventario');

  const limitedOrigin = stock({
    id: 'stock-limited',
    branchId: 'branch-a',
    branchName: 'Sede Norte',
    availableStock: 15,
  });
  const emptySouth = stock({
    id: 'stock-south',
    branchId: 'branch-b',
    branchName: 'Sede Sur',
    availableStock: 0,
  });
  const emptyWest = stock({
    id: 'stock-west',
    branchId: 'branch-c',
    branchName: 'Sede Occidente',
    availableStock: 0,
  });
  const sharedRecommendations = buildTransferRecommendations([
    limitedOrigin,
    emptySouth,
    emptyWest,
  ]);
  assert.equal(
    sharedRecommendations.reduce((total, item) => total + item.quantity, 0),
    10
  );
  assert.ok(
    sharedRecommendations.every((item) => item.source.remainingAfterTransfer >= 5)
  );
  ok('varias sugerencias no comprometen dos veces el mismo excedente');

  const staleRows = [
    stock({
      id: 'stock-stale',
      branchId: 'branch-a',
      branchName: 'Sede Norte',
      availableStock: 12,
      lastMovementAt: '2026-01-01T12:00:00.000Z',
    }),
    stock({
      id: 'stock-recent',
      branchId: 'branch-b',
      branchName: 'Sede Sur',
      availableStock: 8,
      lastMovementAt: '2026-09-10T12:00:00.000Z',
    }),
  ];
  const stale = buildStaleStockItems(staleRows, {
    now: new Date('2026-09-14T12:00:00.000Z'),
    staleDays: 90,
  });
  assert.deepEqual(stale.map((item) => item.id), ['stock-stale']);
  assert.equal(stale[0].inactiveDays, 256);
  ok('detecta inventario disponible sin rotación y excluye actividad reciente');

  const routeSource = read('routes/adminInventory.js');
  assert.match(routeSource, /buildTransferRecommendations\(stockRows/);
  assert.match(routeSource, /buildStaleStockItems\(stockRows/);
  assert.match(routeSource, /buildScopedInventoryMovementFilter/);
  assert.match(routeSource, /\.populate\('requestedBy'/);
  assert.match(routeSource, /\.populate\('reviewedBy'/);
  ok('la API calcula inteligencia operativa dentro del alcance autorizado');

  assert.match(routeSource, /transferRecommendations,/);
  assert.match(routeSource, /staleStockItems,/);
  assert.match(routeSource, /recentTransfers,/);
  ok('el contrato de alertas entrega prioridades, reposición y trazabilidad');

  const adminSource = read('../frontend/src/admin/InventoryAdmin.jsx');
  const alertsSource = read('../frontend/src/admin/inventory/components/InventoryAlertsPanel.jsx');
  const transferSource = read('../frontend/src/admin/inventory/components/InventoryTransferModal.jsx');
  assert.match(adminSource, /Centro de control/);
  assert.match(alertsSource, /Reposición entre sedes/);
  assert.match(alertsSource, /Trazabilidad/);
  assert.match(alertsSource, /Preparar traslado/);
  ok('el panel divide la operación en tres vistas comprensibles');

  assert.match(alertsSource, /Aplicado directamente/);
  assert.match(alertsSource, /item\?\.status === 'posted' && !reviewedAt/);
  assert.doesNotMatch(alertsSource, /reviewedAt \|\| item\?\.postedAt/);
  ok('un traslado directo no atribuye una revisión que nunca ocurrió');

  assert.match(adminSource, /onPrepareTransfer=\{openSuggestedTransfer\}/);
  assert.match(transferSource, /initialSuggestion/);
  assert.match(transferSource, /postNow:\s*hasSuggestion \? false/);
  ok('una sugerencia abre el traslado diligenciado y sujeto a aprobación');

  const kardexSource = read('../frontend/src/admin/inventory/components/InventoryKardexModal.jsx');
  assert.match(kardexSource, /Trazabilidad administrativa/);
  assert.match(kardexSource, /movement\.requestedBy/);
  assert.match(kardexSource, /movement\.reviewedBy/);
  ok('el Kardex conserva responsables y decisión administrativa');

  console.log(`\nInventario Nivel Plus Etapa 3: ${passed}/11 controles aprobados.`);
}

try {
  main();
} catch (error) {
  console.error('\nFALLO Inventario Nivel Plus Etapa 3:', error);
  process.exitCode = 1;
}
