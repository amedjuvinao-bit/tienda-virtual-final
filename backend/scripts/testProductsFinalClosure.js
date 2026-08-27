// backend/scripts/testProductsFinalClosure.js
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
  assert(
    missing.length === 0,
    `${label} no contiene: ${missing.join(', ')}`
  );
}

function ok(message) {
  passed += 1;
  console.log(`OK  ${message}`);
}

function run() {
  const backendPackage = JSON.parse(read('backend/package.json'));
  const workflow = read('.github/workflows/products-ci.yml');
  const index = read('backend/index.js');
  const publicView = read(
    'backend/lib/products/productPublicView.js'
  );
  const permissionCatalog = read(
    'backend/security/adminPermissionCatalog.js'
  );
  const permissionMap = read(
    'backend/security/adminRoutePermissionMap.js'
  );
  const deliveryRoutes = read(
    'backend/routes/digitalDeliveries.js'
  );
  const fulfillmentService = read(
    'backend/services/orderFulfillmentService.js'
  );
  const digitalAccessService = read(
    'backend/services/orderFulfillment/digitalAccess.js'
  );

  const requiredSuites = [
    'test:products-integrity',
    'test:products-public-security',
    'test:products-catalog-operations',
    'test:products-commercial-catalog',
    'test:products-fulfillment',
    'test:products-module',
    'test:product-inventory-sync',
    'test:product-inventory-transaction-contract',
    'test:product-inventory-transaction',
    'test:product-advanced-variants',
    'test:order-refund-contract',
    'test:order-refund-inventory',
    'test:order-multi-branch-contract',
    'test:order-multi-branch-inventory',
    'test:complete-sale-contract',
    'test:complete-sale-integration',
    'test:demo-sales-plan',
    'test:product-archive',
    'test:products-catalog-scale',
    'test:product-taxonomy',
    'test:product-fulfillment-integration',
    'test:products-demo-catalog',
  ];

  const missingScripts = requiredSuites.filter(
    (script) => !backendPackage.scripts?.[script]
  );
  assert(
    missingScripts.length === 0,
    `Faltan scripts de cierre: ${missingScripts.join(', ')}`
  );
  ok('Las 22 suites funcionales están registradas en backend');

  const suitesOutsideCi = requiredSuites.filter(
    (script) =>
      !workflow.includes(`npm --prefix backend run ${script}`)
  );
  assert(
    suitesOutsideCi.length === 0,
    `Suites fuera de Productos CI: ${suitesOutsideCi.join(', ')}`
  );
  ok('Productos CI ejecuta las 22 suites funcionales');

  assertIncludes(
    workflow,
    [
      '- main',
      '- feature/productos-comercial-avanzado',
      'pull_request:',
      'workflow_dispatch:',
    ],
    'Disparadores de Productos CI'
  );
  ok('El CI protege la rama de trabajo, los PR y main');

  assertIncludes(
    workflow,
    [
      'node .github/scripts/audit-production-dependencies.cjs backend',
      'node .github/scripts/audit-production-dependencies.cjs frontend',
      'npm --prefix frontend run build',
    ],
    'Seguridad y compilación'
  );
  ok('Dependencias y compilación forman parte del cierre');

  assertIncludes(
    workflow,
    [
      '--name productos-mongodb',
      '--replSet rs0',
      'PRODUCTS_TEST_MONGO_URI: mongodb://127.0.0.1:27017/productos_ci',
      'DIGITAL_DELIVERY_TOKEN_SECRET: NOT_A_SECRET_TEST_ONLY_${{ github.run_id }}_${{ github.run_attempt }}',
      'PUBLIC_BACKEND_URL: https://backend.example',
    ],
    'Entorno de integración'
  );
  ok('MongoDB y la entrega digital usan un entorno temporal y ficticio');

  assertIncludes(
    workflow,
    [
      'permissions:',
      'contents: read',
      'persist-credentials: false',
      'test:products-final-closure',
    ],
    'Protección del flujo'
  );
  ok('El flujo aplica permisos mínimos y valida su propio contrato');

  assertIncludes(
    index,
    [
      "tryRequire('./routes/digitalDeliveries')",
      "app.use('/api/digital-deliveries', digitalDeliveryRoutes)",
    ],
    'Montaje de descargas'
  );
  assertIncludes(
    deliveryRoutes,
    [
      "'Cache-Control': 'no-store, max-age=0'",
      "'Referrer-Policy': 'no-referrer'",
      "'X-Content-Type-Options': 'nosniff'",
      'consumeDigitalDeliveryAccess',
    ],
    'Ruta de descarga'
  );
  assertIncludes(
    `${fulfillmentService}\n${digitalAccessService}`,
    [
      'DIGITAL_DELIVERY_TOKEN_SECRET',
      ".createHmac('sha256'",
      'crypto.timingSafeEqual',
    ],
    'Tokens de descarga'
  );
  ok('Las descargas exigen token firmado y respuestas sin caché');

  assertIncludes(
    publicView,
    [
      'PUBLIC_PRODUCT_PRIVATE_FIELDS',
      'serializePublicProduct',
      'buildPublicProductFilter',
    ],
    'Vista pública de productos'
  );
  assertIncludes(
    permissionCatalog,
    [
      "'products:view'",
      "'products:create'",
      "'products:update'",
      "'products:delete'",
    ],
    'Catálogo de permisos'
  );
  assertIncludes(
    permissionMap,
    [
      "'/api/products/admin/list'",
      "'/api/products/admin/bulk/update'",
      "'/api/products/admin/bulk/archive'",
      "'/api/products/admin/taxonomy'",
    ],
    'Mapa de permisos'
  );
  ok('La privacidad pública y las operaciones administrativas siguen protegidas');

  console.log(
    `\nCierre final de Productos: ${passed}/${passed} controles aprobados`
  );
}

try {
  run();
} catch (error) {
  console.error('FAIL Cierre final de Productos');
  console.error(error);
  process.exitCode = 1;
}
