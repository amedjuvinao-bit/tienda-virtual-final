// backend/scripts/testOrdersStage1Closure.js
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
let passed = 0;

function absolute(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

function read(relativePath) {
  const fullPath = absolute(relativePath);
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
  const frontendPackage = JSON.parse(read('frontend/package.json'));
  const workflow = read('.github/workflows/orders-ci.yml');
  const ordersRoute = read('backend/routes/orders.js');
  const ordersAdmin = read('frontend/src/admin/OrdersAdmin.jsx');
  const ordersTable = read('frontend/src/admin/orders/components/OrdersTable.jsx');
  const e2e = read('frontend/e2e/ordersOperationalConsole.e2e.js');
  const closureDocument = read('docs/modulos/ordenes-etapa-1-cierre.md');

  assert(
    backendPackage.scripts?.['test:orders-stage1-closure'] ===
      'node scripts/testOrdersStage1Closure.js',
    'El contrato de cierre no está registrado en backend/package.json.'
  );
  assert(
    frontendPackage.scripts?.['test:e2e:orders-stage1'] ===
      'node e2e/ordersOperationalConsole.e2e.js',
    'El recorrido E2E de la etapa 1 no está registrado en frontend/package.json.'
  );
  ok('Los ejecutores de cierre están registrados');

  assertIncludes(
    workflow,
    [
      'name: Órdenes CI',
      '- feature/ordenes-admin-avanzado',
      'pull_request:',
      'workflow_dispatch:',
      'contents: read',
      'persist-credentials: false',
      'orders-contracts:',
      'orders-mongodb:',
      'orders-ui:',
    ],
    'Protección y estructura de Órdenes CI'
  );
  ok('El CI dedicado protege rama, PR y main con permisos mínimos');

  const requiredBackendSuites = [
    'test:orders-stage1-closure',
    'test:orders-security',
    'test:orders-architecture',
    'test:orders-logistics',
    'test:shipping-providers',
    'test:shipping-settings',
    'test:orders-returns',
    'test:orders-operations',
    'test:orders-observability',
    'test:orders-whatsapp-assisted',
    'test:orders-customer-connection',
    'test:orders-billing-municipality',
    'test:orders-manual-invoice',
    'test:billing-invoice-preflight',
    'test:orders-stress-plan',
    'test:order-refund-contract',
    'test:order-commercial-reconciliation',
    'test:order-refund-automation',
    'test:order-bulk-status-contract',
    'test:order-multi-branch-contract',
    'test:complete-sale-contract',
    'test:order-refund-inventory',
    'test:order-bulk-status-inventory',
    'test:order-multi-branch-inventory',
    'test:orders-stress',
    'test:complete-sale-integration',
  ];
  const missingBackendSuites = requiredBackendSuites.filter(
    (script) =>
      !backendPackage.scripts?.[script] ||
      !workflow.includes(`npm --prefix backend run ${script}`)
  );
  assert(
    missingBackendSuites.length === 0,
    `Faltan suites backend en Órdenes CI: ${missingBackendSuites.join(', ')}`
  );
  ok(`El CI ejecuta ${requiredBackendSuites.length} contratos e integraciones backend`);

  const requiredFrontendSuites = [
    'test:orders-security',
    'test:orders-architecture',
    'test:orders-operations',
    'test:orders-detail-story',
    'test:orders-keyboard',
    'test:orders-logistics',
    'test:shipping-settings-ui',
    'test:orders-returns',
    'test:orders-whatsapp-assisted',
    'test:orders-customer-connection',
    'test:billing-invoice-preflight',
    'test:e2e:orders-stage1',
    'test:e2e:orders-billing-phase1',
  ];
  const missingFrontendSuites = requiredFrontendSuites.filter(
    (script) =>
      !frontendPackage.scripts?.[script] ||
      !workflow.includes(`npm --prefix frontend run ${script}`)
  );
  assert(
    missingFrontendSuites.length === 0,
    `Faltan suites frontend en Órdenes CI: ${missingFrontendSuites.join(', ')}`
  );
  assertIncludes(
    workflow,
    [
      'npm --prefix frontend run build',
      'node frontend/node_modules/playwright/cli.js install --with-deps chromium',
    ],
    'Compilación y navegador'
  );
  ok(`El CI ejecuta ${requiredFrontendSuites.length} suites visuales y recorridos E2E`);

  assertIncludes(
    workflow,
    [
      '--name orders-mongodb',
      '--replSet rs0',
      'orders_ci_refund_inventory?replicaSet=rs0',
      'orders_ci_bulk_status?replicaSet=rs0',
      'orders_ci_multi_branch?replicaSet=rs0',
      'orders_ci_stress?replicaSet=rs0',
      'orders_ci_complete_sale?replicaSet=rs0',
      'docker rm --force orders-mongodb',
    ],
    'Aislamiento transaccional'
  );
  ok('Cada integración usa una base temporal aislada y limpieza obligatoria');

  const workflowCommands = Array.from(
    workflow.matchAll(/npm --prefix (?:backend|frontend) run ([^\s]+)/g),
    (match) => match[1]
  );
  const unsafeCommands = workflowCommands.filter(
    (script) =>
      script.startsWith('demo:') ||
      script.includes(':live') ||
      script.includes('reconcile:apply')
  );
  assert(
    unsafeCommands.length === 0,
    `Órdenes CI incluye comandos externos o persistentes: ${unsafeCommands.join(', ')}`
  );
  assert(!workflow.includes('mongodb+srv'), 'El CI no puede apuntar a MongoDB remoto.');
  ok('El cierre automático excluye servicios reales y escrituras persistentes');

  assert(
    !ordersRoute.includes("console.log('🧾 MODO FACTURACIÓN:'"),
    'Quedó un log de depuración de facturación dentro de la creación de órdenes.'
  );
  assert(
    !fs.existsSync(absolute('frontend/src/admin/orders/components/OrderRow.jsx')),
    'El componente OrderRow legado sigue presente aunque no es la autoridad visual.'
  );
  ok('Se retiraron el log temporal y el componente visual legado');

  const fixedPinkPatterns = [
    'bg-pink-',
    'text-pink-',
    'border-pink-',
    'accent-pink-',
    "backgroundColor: '#ec4899'",
  ];
  const fixedPink = fixedPinkPatterns.filter(
    (pattern) => ordersAdmin.includes(pattern) || ordersTable.includes(pattern)
  );
  assert(
    fixedPink.length === 0,
    `La consola todavía fija colores ajenos al tema: ${fixedPink.join(', ')}`
  );
  assertIncludes(
    `${ordersAdmin}\n${ordersTable}`,
    ['var(--admin-primary)', 'var(--admin-primary-text)', 'var(--admin-primary-soft-bg)'],
    'Herencia visual de la consola'
  );
  ok('Selección y acciones masivas heredan el tema administrativo');

  assertIncludes(
    e2e,
    [
      'ownerDesktopScenario',
      'warehouseMobileScenario',
      'readOnlyMobileScenario',
      "permissions: ['orders:view', 'orders:fulfillment', 'orders:returns']",
      "permissions: ['orders:view']",
      "viewport: { width: 390, height: 844 }",
      'assertNoDocumentOverflow',
      "getByRole('tab').count()",
    ],
    'Cobertura E2E por rol y dispositivo'
  );
  ok('El recorrido E2E cubre propietario, bodega y solo lectura en escritorio y móvil');

  assertIncludes(
    closureDocument,
    [
      '# Cierre de Órdenes · Etapa 1',
      'Matriz de aceptación',
      'Propietario',
      'Bodega',
      'Facturación',
      'Solo lectura',
      'HTTPS permanente',
      'No forma parte de esta etapa',
    ],
    'Documento de aceptación'
  );
  ok('Alcance, roles y dependencias externas quedaron documentados');

  console.log(`\nCierre de Órdenes · Etapa 1: ${passed}/${passed} controles aprobados`);
}

try {
  run();
} catch (error) {
  console.error('FAIL Cierre de Órdenes · Etapa 1');
  console.error(error);
  process.exitCode = 1;
}
