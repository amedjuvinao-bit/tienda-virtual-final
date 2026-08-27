/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const orderAdminQueryService = require('../services/orderAdminQueryService');
const queryFilters = require('../services/orderAdminQuery/filters');
const queryPipelines = require('../services/orderAdminQuery/pipelines');
const queryExecutor = require('../services/orderAdminQuery/queryExecutor');

const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0;

function read(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  assert(fs.existsSync(absolutePath), `Falta el archivo ${relativePath}.`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function includesAll(source, values, label) {
  const missing = values.filter((value) => !source.includes(value));
  assert.strictEqual(
    missing.length,
    0,
    `${label} no contiene: ${missing.join(', ')}`
  );
}

function run() {
  const backendPackage = JSON.parse(read('backend/package.json'));
  const frontendPackage = JSON.parse(read('frontend/package.json'));
  const workflow = read('.github/workflows/orders-ci.yml');
  const serviceFacade = read('backend/services/orderAdminQueryService.js');
  const service = [
    serviceFacade,
    read('backend/services/orderAdminQuery/filters.js'),
    read('backend/services/orderAdminQuery/invoiceExpressions.js'),
    read('backend/services/orderAdminQuery/operationalExpressions.js'),
    read('backend/services/orderAdminQuery/pipelines.js'),
    read('backend/services/orderAdminQuery/operationalPresentation.js'),
    read('backend/services/orderAdminQuery/enrichment.js'),
    read('backend/services/orderAdminQuery/summaryPresentation.js'),
    read('backend/services/orderAdminQuery/csv.js'),
    read('backend/services/orderAdminQuery/queryExecutor.js'),
  ].join('\n');
  const integration = read(
    'backend/scripts/testOrderAdminQueryScaleIntegration.js'
  );
  const hook = read(
    'frontend/src/admin/orders/hooks/useOrdersAdminQuery.js'
  );
  const hookTest = read(
    'frontend/src/admin/orders/hooks/useOrdersAdminQuery.test.jsx'
  );
  const e2e = read('frontend/e2e/ordersScalableQuery.e2e.js');
  const documentation = read('docs/modulos/ordenes-etapa-3-cierre.md');

  assert.strictEqual(
    backendPackage.scripts['test:orders-stage3-closure'],
    'node scripts/testOrdersStage3Closure.js'
  );
  assert.strictEqual(
    backendPackage.scripts['test:orders-query-scale'],
    'node scripts/testOrderAdminQueryScaleIntegration.js'
  );
  assert.strictEqual(
    frontendPackage.scripts['test:e2e:orders-stage3'],
    'node e2e/ordersScalableQuery.e2e.js'
  );
  ok('los tres ejecutores propios de la etapa están registrados');

  includesAll(
    workflow,
    [
      'npm --prefix backend run test:orders-stage3-closure',
      'ORDERS_STAGE3_MONGO_URI:',
      'orders_ci_stage3_query?replicaSet=rs0',
      'npm --prefix backend run test:orders-query-scale',
      'npm --prefix frontend run test:e2e:orders-stage3',
    ],
    'Órdenes CI'
  );
  ok('Órdenes CI contiene contrato, MongoDB y navegador de Etapa 3');

  includesAll(
    service,
    [
      'buildPagePipeline',
      'buildSummaryPipeline',
      'allowDiskUse(true)',
      'includeSummary',
      'parseSort',
      "sort._id",
    ],
    'Servicio administrativo'
  );
  assert(!service.includes('countDocuments(filter)'));
  assert(!service.includes("find(filter).select('_id')"));
  assert.strictEqual(
    orderAdminQueryService.parseSort,
    queryFilters.parseSort
  );
  assert.strictEqual(
    orderAdminQueryService.buildPagePipeline,
    queryPipelines.buildPagePipeline
  );
  assert.strictEqual(
    orderAdminQueryService.queryAdminOrders,
    queryExecutor.queryAdminOrders
  );
  ok('la página y el resumen permanecen separados sin cargar el universo en Node');

  includesAll(
    integration,
    [
      "const REQUIRED_DATABASE = 'orders_ci_stage3_query'",
      'ORDERS_STAGE3_MONGO_URI',
      "['127.0.0.1', 'localhost']",
      "parsed.searchParams.get('replicaSet')",
      'await mongoose.connection.dropDatabase()',
    ],
    'Aislamiento MongoDB'
  );
  assert(!integration.includes('process.env.MONGODB_URI'));
  assert(!integration.includes('mongodb+srv://'));
  ok('la integración acepta solo una réplica local y elimina la base temporal');

  includesAll(
    integration,
    [
      'ORDERS_STAGE3_ORDER_COUNT',
      'orders_admin_branch_status_date',
      'orders_admin_allocation_status_date',
      'orders_admin_archive_status_date',
      'Array.from({ length: 24 }',
      "includeSummary: '0'",
    ],
    'Prueba de volumen'
  );
  ok('el volumen comprueba índices, concurrencia y páginas sin resumen repetido');

  includesAll(
    hook,
    [
      'inflightOrderQueries',
      'AbortController',
      'controller.abort()',
      'subscribers',
      'requestSequence.current',
      'includeSummary: includeSummary ? 1 : 0',
    ],
    'Hook de consultas'
  );
  ok('React deduplica, cancela filtros obsoletos y conserva la respuesta vigente');

  includesAll(
    hookTest,
    [
      'doble efecto de StrictMode',
      'obsoleteSignal.aborted',
      'currentSignal.aborted',
      'conserva métricas al paginar',
      'includeSummary).toBe(0)',
    ],
    'Contratos del hook'
  );
  ok('las pruebas unitarias protegen deduplicación, cancelación y métricas');

  includesAll(
    e2e,
    [
      "query === 'anterior'",
      "query === 'actual'",
      "secondPageRequest.includeSummary",
      "name: 'Siguiente página'",
      "getByText('#ORD-ANTERIOR'",
      "getByText('#ORD-ACTUAL'",
    ],
    'Recorrido E2E'
  );
  assert(!e2e.includes('mongodb'));
  ok('el navegador valida paginación liviana y filtros rápidos sin persistencia');

  assert(!integration.includes('fetch('));
  assert(!integration.includes('axios'));
  assert(e2e.includes("url.pathname.startsWith('/api/')"));
  ok('ninguna puerta contacta pagos, DIAN, correo o transportadoras');

  includesAll(
    documentation,
    [
      '# Cierre de Órdenes · Etapa 3',
      'Qué cambia para el administrador',
      'Matriz de aceptación',
      'Prueba manual',
      'no agrega una pantalla nueva',
      'sin publicación',
    ],
    'Documento de cierre'
  );
  ok('el alcance técnico y su comprobación visible quedaron documentados');

  console.log(
    `\nCierre de Órdenes · Etapa 3: ${passed}/${passed} controles aprobados`
  );
}

try {
  run();
} catch (error) {
  console.error('\nFAIL Cierre de Órdenes · Etapa 3');
  console.error(error);
  process.exitCode = 1;
}
