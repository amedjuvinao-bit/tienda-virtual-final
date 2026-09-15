// backend/scripts/testInventoryFinalClosure.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
let passed = 0;

function read(relativePath) {
  const fullPath = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Falta el archivo requerido: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, values, label) {
  const missing = values.filter((value) => !source.includes(value));
  assert(missing.length === 0, `${label} no contiene: ${missing.join(', ')}`);
}

function ok(message) {
  passed += 1;
  console.log(`OK  ${message}`);
}

function run() {
  const backendPackage = JSON.parse(read('backend/package.json'));
  const workflow = read('.github/workflows/orders-ci.yml');
  const index = read('backend/index.js');
  const routes = read('backend/routes/adminInventory.js');
  const inventoryService = read('backend/services/inventoryService.js');
  const accessService = read('backend/services/adminInventoryAccessService.js');
  const intelligenceService = read('backend/services/inventoryOperationalIntelligence.js');
  const permissionCatalog = read('backend/security/adminPermissionCatalog.js');
  const permissionMap = read('backend/security/adminRoutePermissionMap.js');
  const app = read('frontend/src/App.jsx');
  const frontendPermissions = read('frontend/src/admin/security/adminPermissions.js');
  const inventoryPage = read('frontend/src/admin/InventoryAdmin.jsx');
  const adjustmentModal = read('frontend/src/admin/inventory/components/InventoryAdjustmentModal.jsx');
  const approvalsPanel = read('frontend/src/admin/inventory/components/InventoryApprovalsPanel.jsx');
  const alertsPanel = read('frontend/src/admin/inventory/components/InventoryAlertsPanel.jsx');

  const requiredSuites = [
    'test:inventory-admin',
    'test:inventory-level-plus-stage1',
    'test:inventory-level-plus-stage2',
    'test:inventory-level-plus-stage3',
    'test:inventory-level-plus-stage4',
    'test:inventory-final-closure',
  ];

  const missingScripts = requiredSuites.filter(
    (script) => !backendPackage.scripts?.[script]
  );
  assert(
    missingScripts.length === 0,
    `Faltan scripts de cierre: ${missingScripts.join(', ')}`
  );
  ok('Las seis suites administrativas y de cierre están registradas');

  const ciSuites = requiredSuites.filter((script) => script !== 'test:inventory-admin');
  const suitesOutsideCi = ciSuites.filter(
    (script) => !workflow.includes(`npm --prefix backend run ${script}`)
  );
  assert(
    suitesOutsideCi.length === 0,
    `Suites fuera de Órdenes CI: ${suitesOutsideCi.join(', ')}`
  );
  ok('CI ejecuta las cuatro etapas y valida el contrato final');

  assertIncludes(
    workflow,
    [
      '- main',
      '- feature/inventario-nivel-plus-etapa-5',
      'pull_request:',
      'workflow_dispatch:',
      'npm --prefix frontend run build',
    ],
    'Disparadores y compilación de CI'
  );
  ok('CI protege Etapa 5, pull requests, main y la compilación frontend');

  assertIncludes(
    index,
    [
      "tryRequire('./routes/adminInventory')",
      "app.use('/api/admin/inventory', adminInventoryRoutes)",
    ],
    'Montaje backend de Inventario'
  );
  assertIncludes(
    routes,
    [
      "router.get('/stock'",
      "router.get('/export'",
      "router.get('/reservations'",
      "router.get('/alerts'",
      "router.get('/kardex'",
      "router.get('/movements'",
      "router.post('/movements'",
      "router.get('/approvals'",
      "requirePermission('inventory:approve')",
    ],
    'Rutas operativas de Inventario'
  );
  ok('Backend expone existencias, movimientos, aprobaciones, alertas y exportación');

  assertIncludes(
    inventoryService,
    [
      'createInventoryMovement',
      'approveInventoryMovement',
      'rejectInventoryMovement',
      'syncProductTotalStock',
    ],
    'Servicio transaccional de Inventario'
  );
  assertIncludes(
    accessService,
    [
      'buildInventoryBranchAccess',
      'buildScopedInventoryStockFilter',
      'buildScopedInventoryMovementFilter',
      'assertInventoryMovementAccess',
    ],
    'Alcance multisede de Inventario'
  );
  assertIncludes(
    intelligenceService,
    [
      'buildTransferRecommendations',
      'buildStaleStockItems',
      'buildCoverageEstimates',
      'buildStuckReservationItems',
      'buildInventoryAnomalies',
      'buildBranchAlertSummaries',
    ],
    'Inteligencia operativa de Inventario'
  );
  ok('Servicios conservan transacciones, aislamiento multisede e inteligencia operativa');

  assertIncludes(
    permissionCatalog,
    [
      "'inventory:view'",
      "'inventory:adjust'",
      "'inventory:approve'",
      "'inventory:transfer'",
      "'inventory:export'",
    ],
    'Catálogo de permisos de Inventario'
  );
  assertIncludes(
    permissionMap,
    [
      "'/api/admin/inventory/stock'",
      "'/api/admin/inventory/movements'",
      "'/api/admin/inventory/approvals'",
    ],
    'Mapa de permisos de Inventario'
  );
  ok('Permisos administrativos sensibles siguen registrados y auditables');

  assertIncludes(
    app,
    [
      "const InventoryAdmin = lazy(() => import('./admin/InventoryAdmin'))",
      'path="inventario"',
      'protectAdminContent(<InventoryAdmin />)',
    ],
    'Ruta frontend de Inventario'
  );
  assertIncludes(
    frontendPermissions,
    ["inventario: ['inventory:view']"],
    'Permiso frontend de Inventario'
  );
  ok('La pantalla de Inventario mantiene carga diferida y acceso protegido');

  assertIncludes(
    inventoryPage,
    [
      "{ id: 'summary', label: 'Resumen'",
      "{ id: 'stock', label: 'Existencias'",
      "{ id: 'movements', label: 'Movimientos'",
      "{ id: 'alerts', label: 'Alertas'",
      'InventoryApprovalsPanel',
      'InventoryAdjustmentModal',
      'InventoryTransferModal',
      'InventoryKardexModal',
      "api.get('/api/admin/inventory/export'",
    ],
    'Centro operativo frontend'
  );
  assertIncludes(
    approvalsPanel,
    [
      "api.get('/api/admin/inventory/approvals'",
      "selection.action === 'reject'",
      'Aprobar y aplicar',
    ],
    'Bandeja de aprobaciones'
  );
  assertIncludes(
    alertsPanel,
    [
      "setActiveTab('priorities')",
      "setActiveTab('replenishment')",
      "setActiveTab('traceability')",
      "setActiveTab('intelligence')",
    ],
    'Centro de alertas e inteligencia'
  );
  ok('La interfaz conserva vistas guiadas, aprobaciones, Kardex e inteligencia');

  assertIncludes(
    adjustmentModal,
    [
      'Movimiento guardado. El inventario ya fue actualizado.',
      'Revisa el resultado y cierra cuando estés listo.',
      'Cerrar y volver',
      'Resultado previsto',
    ],
    'Cierre manual del asistente de ajustes'
  );
  assert(
    !adjustmentModal.includes('window.setTimeout(() => {\n        onClose();'),
    'El modal volvió a cerrarse automáticamente después de guardar.'
  );
  ok('El ajuste permanece abierto tras guardar y muestra un cierre explícito');

  console.log(`\nCierre final de Inventario: ${passed}/${passed} controles aprobados`);
}

try {
  run();
} catch (error) {
  console.error('FAIL Cierre final de Inventario');
  console.error(error);
  process.exitCode = 1;
}
