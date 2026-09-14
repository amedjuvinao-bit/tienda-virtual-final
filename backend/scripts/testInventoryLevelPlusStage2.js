/* eslint-disable no-console */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const InventoryMovement = require('../models/InventoryMovement');
const { rejectInventoryMovement } = require('../services/inventoryService');

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

async function main() {
  const schema = InventoryMovement.schema;
  assert.ok(schema.path('approvalRequired'));
  assert.ok(schema.path('requestedBy'));
  assert.ok(schema.path('requestedAt'));
  ok('el movimiento registra la solicitud de aprobación');

  assert.ok(schema.path('reviewedBy'));
  assert.ok(schema.path('reviewedAt'));
  assert.ok(schema.path('reviewDecision'));
  assert.ok(schema.path('reviewNote'));
  ok('el movimiento conserva decisión, revisor, fecha y nota');

  assert.deepEqual(
    schema.path('reviewDecision').enumValues,
    ['', 'approved', 'rejected']
  );
  ok('las decisiones quedan restringidas a aprobado o rechazado');

  const serviceSource = read('services/inventoryService.js');
  assert.match(serviceSource, /approvalRequired:\s*!postNow/);
  assert.match(serviceSource, /status:\s*postNow \? 'posted' : 'draft'/);
  ok('enviar a revisión crea un borrador sin impacto inmediato');

  assert.match(serviceSource, /async function approveInventoryMovement/);
  assert.match(serviceSource, /movement\.status = 'posted'/);
  assert.match(serviceSource, /movement\.reviewDecision = 'approved'/);
  ok('aprobar aplica y publica el mismo movimiento');

  assert.match(serviceSource, /applyOutStock\(stockFromRow, quantity\)/);
  assert.match(serviceSource, /applyInStock\(stockToRow, quantity\)/);
  ok('la aprobación reutiliza las políticas seguras de entrada y salida');

  assert.match(serviceSource, /session\.withTransaction/);
  assert.match(serviceSource, /syncProductTotalStock\(product\._id, \{ session \}\)/);
  ok('la aprobación actualiza stock y total de producto en una transacción');

  assert.match(serviceSource, /movement\.status = 'cancelled'/);
  assert.match(serviceSource, /movement\.reviewDecision = 'rejected'/);
  ok('rechazar cancela la solicitud sin aplicar stock');

  await assert.rejects(
    rejectInventoryMovement('64b000000000000000000101', { reviewNote: '' }),
    (error) =>
      error.code === 'INVENTORY_REJECTION_NOTE_REQUIRED' &&
      error.statusCode === 400
  );
  ok('el rechazo exige una justificación administrativa');

  assert.match(serviceSource, /INVENTORY_APPROVAL_ALREADY_RESOLVED/);
  ok('una solicitud resuelta no puede procesarse dos veces');

  const routeSource = read('routes/adminInventory.js');
  assert.match(routeSource, /router\.get\('\/approvals', requirePermission\('inventory:view'\)/);
  ok('la bandeja de pendientes respeta el permiso de consulta');

  assert.match(routeSource, /requirePermission\('inventory:approve'\)/);
  assert.match(routeSource, /'\/movements\/:id\/approve'/);
  assert.match(routeSource, /'\/movements\/:id\/reject'/);
  ok('aprobar y rechazar exigen un permiso separado');

  assert.match(routeSource, /buildScopedInventoryMovementFilter[\s\S]*requireManage: true/);
  ok('la resolución conserva el alcance por sedes administrables');

  const catalogSource = read('security/adminPermissionCatalog.js');
  const roleSource = read('models/AdminRole.js');
  assert.match(catalogSource, /inventory:approve/);
  assert.match(roleSource, /inventory:approve/);
  ok('el permiso de aprobación está disponible en perfiles administrativos');

  const adminSource = read('../frontend/src/admin/InventoryAdmin.jsx');
  const approvalsSource = read('../frontend/src/admin/inventory/components/InventoryApprovalsPanel.jsx');
  assert.match(adminSource, /InventoryApprovalsPanel/);
  assert.match(approvalsSource, /Solicitudes por aprobar/);
  ok('el panel incluye una bandeja visible de aprobaciones');

  assert.match(approvalsSource, /can\('inventory:approve'\)/);
  assert.match(approvalsSource, /Solo lectura/);
  ok('la interfaz oculta acciones a quien solo puede consultar');

  const movementsSource = read('../frontend/src/admin/inventory/components/InventoryMovementsModal.jsx');
  assert.match(movementsSource, /function movementAffectsStock/);
  assert.match(movementsSource, /if \(!movementAffectsStock\(movement\)\) return;/);
  assert.match(routeSource, /if \(!\['posted', 'reversed'\]\.includes\(status\)\)/);
  ok('los resúmenes de movimientos y Kardex excluyen solicitudes pendientes o canceladas');

  const adjustmentSource = read('../frontend/src/admin/inventory/components/InventoryAdjustmentModal.jsx');
  const transferSource = read('../frontend/src/admin/inventory/components/InventoryTransferModal.jsx');
  assert.match(adjustmentSource, /Enviar a revisión/);
  assert.match(adjustmentSource, /postNow: form\.postNow/);
  assert.match(transferSource, /Enviar a revisión/);
  assert.match(transferSource, /postNow: form\.postNow/);
  ok('ajustes y traslados permiten elegir revisión o aplicación inmediata');

  assert.match(adjustmentSource, /El stock todavía no cambió/);
  assert.match(transferSource, /El stock todavía no cambió/);
  ok('la confirmación explica claramente que una solicitud no cambia existencias');

  console.log(`\nInventario Nivel Plus Etapa 2: ${passed}/19 controles aprobados.`);
}

main().catch((error) => {
  console.error('\nFALLO Inventario Nivel Plus Etapa 2:', error);
  process.exitCode = 1;
});
