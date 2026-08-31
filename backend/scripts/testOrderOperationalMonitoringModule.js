'use strict';

/* eslint-disable no-console */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Order = require('../models/Order');
const { hasExactIndex } = require('./lib/orderSchemaContract');

const {
  buildOrderHealthPipeline,
  createOrderOperationalMonitoringService,
} = require('../services/orderOperationalMonitoringService');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const ROOT = path.resolve(__dirname, '..', '..');
const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function ok(message) {
  checks.push(message);
  console.log(`OK  ${message}`);
}

function createAggregateModel(row, calls) {
  return {
    aggregate(pipeline) {
      const call = { pipeline, allowDiskUse: false };
      calls.push(call);
      return {
        allowDiskUse(value) {
          call.allowDiskUse = value;
          return Promise.resolve([row]);
        },
      };
    },
  };
}

function validateStaticContract() {
  const routes = read('backend/routes/orders.js');
  const controller = read(
    'backend/controllers/orderOperationalMonitoringController.js'
  );
  const serviceFacade = read(
    'backend/services/orderOperationalMonitoringService.js'
  );
  const serviceModules = [
    'constants.js',
    'metricsPipeline.js',
    'mongoExpressions.js',
    'operationalChecks.js',
    'service.js',
  ]
    .map((name) =>
      read(`backend/services/orderOperationalMonitoring/${name}`)
    )
    .join('\n');
  const service = `${serviceFacade}\n${serviceModules}`;
  const packageJson = JSON.parse(read('backend/package.json'));
  const workflow = read('.github/workflows/products-ci.yml');
  const stress = read('backend/scripts/testOrderTransactionalStress.js');
  const logisticsTransaction = read(
    'backend/services/orderLogistics/transactionSupport.js'
  );

  assert.ok(
    routes.includes(
      "router.get('/admin/operations/health', getOrderOperationalHealth)"
    )
  );
  assert.ok(controller.includes("res.setHeader('Cache-Control', 'private, no-store')"));
  assert.ok(controller.includes('buildScopedOrderFilter(req, {})'));
  assert.ok(controller.includes('getOperationalHealth({ filter: access.filter })'));
  ok('el diagnóstico es privado, no cacheable y respeta el alcance por sede');

  const permission = findAdminRoutePermission(
    'GET',
    '/api/orders/admin/operations/health'
  );
  assert.strictEqual(permission?.permission, 'orders:view');
  assert.strictEqual(permission?.audit, true);
  ok('la ruta exige orders:view y deja auditoría administrativa');

  assert.ok(service.includes('$facet'));
  assert.ok(service.includes('buildOperationalSummaryPipeline(now)'));
  assert.ok(service.includes('allowDiskUse(true)'));
  assert.ok(!service.includes('.find('));
  assert.ok(!service.includes('countDocuments('));
  ok('métricas y alertas se calculan en una agregación acotada de MongoDB');

  for (const signal of [
    'recentPaymentFailures',
    'stuckPreparation',
    'openIncidentOrders',
    'criticalIncidentOrders',
    'slaBreachedOrders',
    'slaRiskOrders',
    'staleTransitOrders',
    'queryDurationMs',
  ]) {
    assert.ok(service.includes(signal), `Falta la señal ${signal}.`);
  }
  ok('el diagnóstico cubre pagos, preparación, incidencias, SLA, tránsito y latencia');

  assert.ok(
    ![
      'wompi.co',
      'factus',
      'nodemailer',
      'axios.',
      'fetch(',
      'syncIndexes(',
    ].some((needle) => service.toLowerCase().includes(needle.toLowerCase()))
  );
  ok('la observabilidad no llama pasarelas, DIAN, correo ni altera índices');

  assert.ok(
    hasExactIndex(
      Order.schema,
      {
        'fulfillment.shipments.branch': 1,
        'fulfillment.shipments.status': 1,
        'fulfillment.shipments.sla.dispatchDueAt': 1,
      },
      'orders_logistics_branch_status_sla'
    )
  );
  assert.ok(
    hasExactIndex(Order.schema, {
      'payment.status': 1,
      createdAt: -1,
    })
  );
  assert.ok(
    hasExactIndex(
      Order.schema,
      { branch: 1, status: 1, createdAt: -1 },
      'orders_admin_branch_status_date'
    )
  );
  ok('las consultas operativas reutilizan índices comerciales y logísticos existentes');

  assert.strictEqual(
    packageJson.scripts['test:orders-observability'],
    'node scripts/testOrderOperationalMonitoringModule.js'
  );
  assert.strictEqual(
    packageJson.scripts['test:orders-stress-plan'],
    'node scripts/testOrderTransactionalStress.js --validate-plan'
  );
  assert.strictEqual(
    packageJson.scripts['test:orders-stress'],
    'node scripts/testOrderTransactionalStress.js'
  );
  assert.ok(workflow.includes('test:orders-observability'));
  assert.ok(workflow.includes('test:orders-stress-plan'));
  assert.ok(workflow.includes('test:orders-stress'));
  ok('package.json y CI protegen el contrato, el plan seguro y la prueba transaccional');

  assert.ok(stress.includes("process.argv.includes('--validate-plan')"));
  assert.ok(stress.includes('assertIsolatedMongoUri'));
  assert.ok(stress.includes('initializeOrderLogistics'));
  assert.ok(stress.includes('updateOrderShipment'));
  assert.ok(logisticsTransaction.includes('withTransaction'));
  assert.ok(stress.includes('dropDatabase'));
  assert.ok(stress.includes('Promise.allSettled'));
  assert.ok(stress.includes('LOGISTICS_REVISION_CONFLICT'));
  assert.ok(stress.includes('controlledRollback'));
  assert.ok(!stress.includes("require('../routes/payments')"));
  ok('el stress exige réplica aislada, prueba rollback y concurrencia sin gateways');
}

function validatePipeline() {
  const branchId = '64c000000000000000000001';
  const now = new Date('2026-08-14T18:00:00.000Z');
  const pipeline = buildOrderHealthPipeline(
    { branch: branchId, archived: { $ne: true } },
    now
  );

  assert.deepStrictEqual(pipeline[0], {
    $match: { branch: branchId, archived: { $ne: true } },
  });
  assert.ok(pipeline[1].$facet.operational);
  assert.ok(pipeline[1].$facet.metrics);
  assert.ok(
    JSON.stringify(pipeline).includes('$$shipment.sla.deliveryDueAt')
  );
  assert.ok(JSON.stringify(pipeline).includes('$$incident.severity'));
  ok('el pipeline conserva el alcance y evalúa fechas e incidencias dentro del servidor');
}

async function validateCriticalSnapshot() {
  const calls = [];
  const clockValues = [100, 3100];
  const service = createOrderOperationalMonitoringService({
    OrderModel: createAggregateModel(
      {
        operational: {
          total: 80,
          attention: 18,
          awaitingPayment: 7,
          prepare: 22,
          transit: 9,
          incidents: 3,
          slaRisk: 5,
        },
        metrics: {
          totalOrders: 80,
          recentPaymentFailures: 12,
          stuckPreparation: 23,
          openIncidentOrders: 3,
          criticalIncidentOrders: 1,
          slaBreachedOrders: 2,
          slaRiskOrders: 5,
          staleTransitOrders: 4,
        },
      },
      calls
    ),
    now: () => new Date('2026-08-14T18:00:00.000Z'),
    clock: () => clockValues.shift(),
  });

  const snapshot = await service.getOperationalHealth({
    filter: { branch: '64c000000000000000000001' },
  });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].allowDiskUse, true);
  assert.strictEqual(snapshot.status, 'critical');
  assert.strictEqual(snapshot.severity, 'critical');
  assert.strictEqual(snapshot.metrics.totalOrders, 80);
  assert.strictEqual(snapshot.operational.prepare, 22);
  assert.strictEqual(snapshot.performance.queryDurationMs, 3000);
  assert.ok(snapshot.alerts.length >= 5);
  assert.ok(
    snapshot.checks.some(
      (check) =>
        check.code === 'ORDER_LOGISTICS_INCIDENTS' &&
        check.severity === 'critical'
    )
  );
  assert.ok(
    snapshot.checks.some(
      (check) =>
        check.code === 'ORDER_MONITORING_LATENCY' &&
        check.severity === 'critical'
    )
  );
  ok('un escenario crítico eleva alertas independientes y conserva métricas cuantificadas');
}

async function validateHealthySnapshot() {
  const calls = [];
  const clockValues = [10, 35];
  const service = createOrderOperationalMonitoringService({
    OrderModel: createAggregateModel(
      {
        operational: {
          total: 14,
          completed: 14,
        },
        metrics: {
          totalOrders: 14,
        },
      },
      calls
    ),
    now: () => new Date('2026-08-14T18:00:00.000Z'),
    clock: () => clockValues.shift(),
  });

  const snapshot = await service.getOperationalHealth();
  assert.strictEqual(snapshot.status, 'healthy');
  assert.strictEqual(snapshot.severity, 'ok');
  assert.strictEqual(snapshot.alerts.length, 0);
  assert.ok(snapshot.checks.every((check) => check.severity === 'ok'));
  assert.deepStrictEqual(snapshot.window, {
    startedAt: new Date('2026-08-13T18:00:00.000Z'),
    endedAt: new Date('2026-08-14T18:00:00.000Z'),
    hours: 24,
  });
  ok('un escenario sin desvíos produce estado healthy y cero alertas');
}

async function main() {
  validateStaticContract();
  validatePipeline();
  await validateCriticalSnapshot();
  await validateHealthySnapshot();

  console.log(
    `\nObservabilidad operativa de Órdenes: ${checks.length}/${checks.length} controles superados.`
  );
}

main().catch((error) => {
  console.error('\nFALLO observabilidad operativa de Órdenes:', error);
  process.exitCode = 1;
});
