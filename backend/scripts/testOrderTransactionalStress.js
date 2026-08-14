'use strict';

/* eslint-disable no-console */

const assert = require('assert');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const {
  queryAdminOrders,
} = require('../services/orderAdminQueryService');
const {
  initializeOrderLogistics,
  updateOrderShipment,
} = require('../services/orderLogisticsService');
const {
  createOrderOperationalMonitoringService,
} = require('../services/orderOperationalMonitoringService');

const VALIDATE_PLAN_ONLY = process.argv.includes('--validate-plan');
const DATABASE_NAME_PATTERN = /^orders_ci_stress(?:_[a-z0-9_-]+)?$/i;
const LOCAL_MONGO_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const SCENARIOS = Object.freeze([
  'pending_payment',
  'payment_failed',
  'stale_prepare',
  'picking_risk',
  'stale_transit',
  'critical_incident',
  'delivered',
]);
const ORDER_COUNT = boundedInteger(
  process.env.ORDERS_STRESS_ORDER_COUNT,
  350,
  70,
  2000
);
const QUERY_REQUEST_COUNT = boundedInteger(
  process.env.ORDERS_STRESS_QUERY_REQUESTS,
  140,
  40,
  1000
);
const QUERY_CONCURRENCY = boundedInteger(
  process.env.ORDERS_STRESS_QUERY_CONCURRENCY,
  14,
  2,
  50
);
const MAX_P95_QUERY_MS = boundedInteger(
  process.env.ORDERS_STRESS_MAX_P95_QUERY_MS,
  2500,
  100,
  30000
);
const MAX_TOTAL_DURATION_MS = boundedInteger(
  process.env.ORDERS_STRESS_MAX_DURATION_MS,
  120000,
  10000,
  600000
);
const MAX_HEAP_DELTA_MB = boundedInteger(
  process.env.ORDERS_STRESS_MAX_HEAP_MB,
  256,
  32,
  1024
);
const NOW = new Date('2026-08-14T18:00:00.000Z');
const RUN_ID = new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase();
const PREFIX = `ORDER-STRESS-${RUN_ID}`;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

function scenarioForIndex(index) {
  return SCENARIOS[index % SCENARIOS.length];
}

function scenarioCounts(orderCount = ORDER_COUNT) {
  const counts = Object.fromEntries(SCENARIOS.map((scenario) => [scenario, 0]));
  for (let index = 0; index < orderCount; index += 1) {
    counts[scenarioForIndex(index)] += 1;
  }
  return counts;
}

function buildPlan() {
  return {
    database: 'MongoDB 7 local con replicaSet y nombre orders_ci_stress',
    isolation: {
      acceptsRemoteHosts: false,
      acceptsProductionDatabaseNames: false,
      dropsTemporaryDatabaseAtEnd: true,
    },
    externalSystems: {
      gateways: false,
      dian: false,
      email: false,
      carriers: false,
    },
    orders: ORDER_COUNT,
    scenarios: scenarioCounts(),
    queryRequests: QUERY_REQUEST_COUNT,
    queryConcurrency: QUERY_CONCURRENCY,
    transactionalChecks: [
      'rollback completo si falla la auditoría del evento',
      'inicialización logística idempotente bajo concurrencia',
      'control de revisión optimista con un único ganador',
      'recorrido logístico hasta entrega con asignaciones coherentes',
      'autoprueba del auditor con corrupción controlada y restaurada',
    ],
    thresholds: {
      maxP95QueryMs: MAX_P95_QUERY_MS,
      maxTotalDurationMs: MAX_TOTAL_DURATION_MS,
      maxHeapDeltaMb: MAX_HEAP_DELTA_MB,
    },
  };
}

function validatePlan(plan) {
  assert.strictEqual(plan.orders, ORDER_COUNT);
  assert.strictEqual(
    Object.values(plan.scenarios).reduce((total, count) => total + count, 0),
    ORDER_COUNT
  );
  assert.strictEqual(plan.isolation.acceptsRemoteHosts, false);
  assert.strictEqual(plan.isolation.acceptsProductionDatabaseNames, false);
  assert.strictEqual(plan.isolation.dropsTemporaryDatabaseAtEnd, true);
  assert.ok(Object.values(plan.externalSystems).every((value) => value === false));
  assert.ok(plan.queryRequests >= 40);
  assert.ok(plan.queryConcurrency >= 2);
  return plan;
}

function assertIsolatedMongoUri(rawUri) {
  assert(rawUri, 'ORDERS_STRESS_MONGO_URI no está configurado.');

  let parsed;
  try {
    parsed = new URL(rawUri);
  } catch {
    throw new Error('ORDERS_STRESS_MONGO_URI no es una URI MongoDB válida.');
  }

  assert.ok(
    ['mongodb:', 'mongodb+srv:'].includes(parsed.protocol),
    'La prueba exige una URI MongoDB.'
  );
  assert.strictEqual(
    parsed.protocol,
    'mongodb:',
    'La prueba de estrés no acepta clústeres remotos mongodb+srv.'
  );
  assert.ok(
    LOCAL_MONGO_HOSTS.has(parsed.hostname),
    `La prueba solo acepta MongoDB local; se recibió ${parsed.hostname}.`
  );

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  assert.ok(
    DATABASE_NAME_PATTERN.test(databaseName),
    `La base temporal debe llamarse orders_ci_stress; se recibió ${databaseName || '(vacía)'}.`
  );
  assert.ok(
    parsed.searchParams.get('replicaSet'),
    'La URI debe declarar replicaSet para validar transacciones reales.'
  );

  return { databaseName, uri: parsed.toString() };
}

function shipmentForScenario({ scenario, branchId, allocationId, index }) {
  const base = {
    code: `${PREFIX}-${String(index + 1).padStart(5, '0')}-SHP`,
    branch: branchId,
    branchSnapshot: {
      name: 'Sede temporal de estrés',
      code: 'STRESS',
      type: 'warehouse',
    },
    allocationIds: [allocationId],
    quantity: 1,
    initializationSource: 'inventory_allocations',
    resumeStatus: 'ready_to_pick',
    priority: 'normal',
    revision: 1,
    packages: [
      {
        code: `${PREFIX}-${String(index + 1).padStart(5, '0')}-P01`,
      },
    ],
    incidents: [],
    history: [],
    sla: {
      pickingDueAt: new Date(NOW.getTime() + 12 * 60 * 60 * 1000),
      dispatchDueAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
      deliveryDueAt: new Date(NOW.getTime() + 72 * 60 * 60 * 1000),
      lastEvaluatedAt: NOW,
    },
    updatedAt: NOW,
  };

  if (scenario === 'picking_risk') {
    return {
      ...base,
      status: 'picking',
      resumeStatus: 'picking',
      startedAt: new Date(NOW.getTime() - 30 * 60 * 1000),
    };
  }

  if (scenario === 'stale_transit') {
    return {
      ...base,
      status: 'in_transit',
      resumeStatus: 'in_transit',
      carrier: {
        name: 'Transportadora simulada',
        trackingNumber: `${PREFIX}-TRACK-${index + 1}`,
      },
      dispatchEvidence: {
        reference: `${PREFIX}-DISPATCH-${index + 1}`,
        recordedAt: new Date(NOW.getTime() - 54 * 60 * 60 * 1000),
      },
      dispatchedAt: new Date(NOW.getTime() - 54 * 60 * 60 * 1000),
      inTransitAt: new Date(NOW.getTime() - 52 * 60 * 60 * 1000),
      updatedAt: new Date(NOW.getTime() - 50 * 60 * 60 * 1000),
      sla: {
        ...base.sla,
        deliveryDueAt: new Date(NOW.getTime() + 12 * 60 * 60 * 1000),
      },
    };
  }

  if (scenario === 'critical_incident') {
    return {
      ...base,
      status: 'exception',
      resumeStatus: 'picking',
      incidents: [
        {
          status: 'open',
          type: 'damage',
          severity: 'critical',
          description: 'Incidencia controlada de la prueba aislada.',
          openedAt: new Date(NOW.getTime() - 30 * 60 * 1000),
        },
      ],
      sla: {
        ...base.sla,
        pickingDueAt: new Date(NOW.getTime() - 60 * 60 * 1000),
        breachedAt: new Date(NOW.getTime() - 30 * 60 * 1000),
      },
    };
  }

  if (scenario === 'delivered') {
    return {
      ...base,
      status: 'delivered',
      resumeStatus: 'delivered',
      carrier: {
        name: 'Transportadora simulada',
        trackingNumber: `${PREFIX}-TRACK-${index + 1}`,
      },
      dispatchEvidence: {
        reference: `${PREFIX}-DISPATCH-${index + 1}`,
        recordedAt: new Date(NOW.getTime() - 6 * 60 * 60 * 1000),
      },
      deliveryEvidence: {
        reference: `${PREFIX}-DELIVERY-${index + 1}`,
        recipient: 'Receptor de prueba',
        recordedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      },
      dispatchedAt: new Date(NOW.getTime() - 6 * 60 * 60 * 1000),
      deliveredAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
    };
  }

  return null;
}

function buildOrderPayload(index, scenario = scenarioForIndex(index)) {
  const branchId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const inventoryStockId = new mongoose.Types.ObjectId();
  const allocationId = new mongoose.Types.ObjectId();
  const itemId = new mongoose.Types.ObjectId();
  const isPaid = !['pending_payment', 'payment_failed'].includes(scenario);
  const isShipped = ['stale_transit', 'delivered'].includes(scenario);
  const isDelivered = scenario === 'delivered';
  const shipment = shipmentForScenario({
    scenario,
    branchId,
    allocationId,
    index,
  });
  const createdAt =
    scenario === 'stale_prepare'
      ? new Date(NOW.getTime() - 3 * 60 * 60 * 1000)
      : new Date(NOW.getTime() - (index % 60) * 60 * 1000);
  const status =
    scenario === 'pending_payment'
      ? 'pending'
      : scenario === 'payment_failed'
        ? 'failed'
        : isDelivered
          ? 'delivered'
          : isShipped
            ? 'shipped'
            : 'paid';
  const paymentStatus =
    scenario === 'pending_payment'
      ? 'pending_gateway'
      : scenario === 'payment_failed'
        ? 'failed'
        : 'paid';

  return {
    sessionId: `${PREFIX}-SESSION-${String(index + 1).padStart(5, '0')}`,
    orderNumber: `${PREFIX}-${String(index + 1).padStart(5, '0')}`,
    status,
    fulfillmentStatus: isDelivered ? 'delivered' : isPaid ? 'processing' : 'reserved',
    source: 'system',
    channel: 'system',
    saleType: 'system_order',
    tags: ['orders-stress'],
    branch: branchId,
    branchSnapshot: {
      name: 'Sede temporal de estrés',
      code: 'STRESS',
      type: 'warehouse',
    },
    items: [
      {
        _id: itemId,
        product: productId,
        productId: String(productId),
        title: `Producto aislado ${index + 1}`,
        productType: 'physical',
        requiresShipping: true,
        fulfillmentKind: 'shipment',
        variantKey: 'stress__default',
        variantLabel: 'Stress / Default',
        quantity: 1,
        qty: 1,
        price: 100000,
        unitPrice: 100000,
        lineSubtotal: 100000,
        taxableBase: 100000,
        lineTotal: 100000,
      },
    ],
    subtotal: 100000,
    total: 100000,
    payment: {
      provider: 'manual',
      providerLabel: 'Prueba aislada',
      mode: 'sandbox',
      currency: 'COP',
      status: paymentStatus,
      amount: 100000,
      amountInCents: 10000000,
      transactionId: `${PREFIX}-TX-${index + 1}`,
      reference: `${PREFIX}-REF-${index + 1}`,
      paidAt: isPaid ? createdAt : null,
    },
    inventoryAllocations: [
      {
        _id: allocationId,
        orderItem: itemId,
        inventoryStock: inventoryStockId,
        branch: branchId,
        branchSnapshot: {
          name: 'Sede temporal de estrés',
          code: 'STRESS',
          type: 'warehouse',
        },
        product: productId,
        productSnapshot: {
          title: `Producto aislado ${index + 1}`,
          sku: `${PREFIX}-SKU-${index + 1}`,
        },
        variantKey: 'stress__default',
        quantity: 1,
        reservedQuantity: 1,
        soldQuantity: isPaid ? 1 : 0,
        shippedQuantity: isShipped ? 1 : 0,
        deliveredQuantity: isDelivered ? 1 : 0,
        status: isDelivered
          ? 'delivered'
          : isShipped
            ? 'shipped'
            : isPaid
              ? 'sold'
              : 'reserved',
        reservedAt: createdAt,
        soldAt: isPaid ? createdAt : null,
        shippedAt: isShipped ? createdAt : null,
        deliveredAt: isDelivered ? createdAt : null,
      },
    ],
    inventoryAllocationSummary: {
      allocationCount: 1,
      branchCount: 1,
      branchIds: [branchId],
      totalQuantity: 1,
      reservedQuantity: 1,
      activeReservedQuantity: isPaid ? 0 : 1,
      soldQuantity: isPaid ? 1 : 0,
      shippedQuantity: isShipped ? 1 : 0,
      deliveredQuantity: isDelivered ? 1 : 0,
      updatedAt: createdAt,
    },
    fulfillment: {
      status:
        scenario === 'critical_incident'
          ? 'action_required'
          : isDelivered
            ? 'delivered'
            : isPaid
              ? 'processing'
              : 'pending',
      shipments: shipment ? [shipment] : [],
    },
    createdAt,
    updatedAt:
      scenario === 'payment_failed'
        ? new Date(NOW.getTime() - 30 * 60 * 1000)
        : createdAt,
  };
}

function expectedViewTotals(counts) {
  return {
    all: ORDER_COUNT,
    awaiting_payment: counts.pending_payment,
    prepare: counts.stale_prepare + counts.picking_risk,
    transit: counts.stale_transit,
    incidents: counts.critical_incident,
    sla_risk:
      counts.picking_risk +
      counts.stale_transit +
      counts.critical_incident,
    completed: counts.delivered,
    attention:
      counts.payment_failed +
      counts.picking_risk +
      counts.stale_transit +
      counts.critical_incident,
  };
}

async function executeConcurrentQueries() {
  const counts = scenarioCounts();
  const expected = expectedViewTotals(counts);
  const views = Object.keys(expected);
  const durations = [];
  let completed = 0;

  const tasks = Array.from({ length: QUERY_REQUEST_COUNT }, (_, index) => {
    const view = views[index % views.length];
    return async () => {
      const startedAt = performance.now();
      const result = await queryAdminOrders(
        {
          adminRole: 'owner',
          query: {
            page: (index % 3) + 1,
            limit: 20,
            includeSummary: 1,
            operationalView: view,
            sort: index % 2 === 0 ? 'createdAt:desc' : 'total:asc',
            tags: 'orders-stress',
          },
        },
        {
          OrderModel: Order,
          ElectronicInvoiceModel: ElectronicInvoice,
        }
      );
      const durationMs = performance.now() - startedAt;
      durations.push(durationMs);
      assert.strictEqual(result.total, expected[view]);
      assert.strictEqual(result.operationalSummary.total, ORDER_COUNT);
      assert.ok(result.data.length <= 20);
      assert.ok(result.data.every((order) => order.operational));
      completed += 1;
    };
  });

  for (let offset = 0; offset < tasks.length; offset += QUERY_CONCURRENCY) {
    const batch = tasks.slice(offset, offset + QUERY_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((task) => task()));
    const rejected = settled.filter((result) => result.status === 'rejected');
    if (rejected.length) throw rejected[0].reason;
  }

  const stableRequest = {
    adminRole: 'owner',
    query: {
      page: 1,
      limit: 20,
      includeSummary: 0,
      tags: 'orders-stress',
      sort: 'createdAt:desc',
    },
  };
  const [first, second] = await Promise.all([
    queryAdminOrders(stableRequest, {
      OrderModel: Order,
      ElectronicInvoiceModel: ElectronicInvoice,
    }),
    queryAdminOrders(stableRequest, {
      OrderModel: Order,
      ElectronicInvoiceModel: ElectronicInvoice,
    }),
  ]);
  assert.deepStrictEqual(
    first.data.map((order) => String(order._id)),
    second.data.map((order) => String(order._id))
  );

  return {
    completed,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    maxMs: Math.max(...durations),
  };
}

async function createTransactionalProbe() {
  const payload = buildOrderPayload(ORDER_COUNT + 100, 'stale_prepare');
  payload.orderNumber = `${PREFIX}-TRANSACTIONAL`;
  payload.sessionId = `${PREFIX}-TRANSACTIONAL-SESSION`;
  payload.tags = ['orders-stress', 'transactional-probe'];
  payload.createdAt = NOW;
  payload.updatedAt = NOW;
  const order = await Order.create(payload);
  return order;
}

async function validateTransactionalConcurrency(order) {
  const actor = {
    displayName: 'CI Órdenes',
    role: 'owner',
    source: 'orders_stress',
  };
  const scope = {
    authorizedBranchIds: [],
    allowAllBranches: true,
  };
  const controlledRollback = {
    create: async () => {
      throw new Error('ORDER_STRESS_CONTROLLED_EVENT_FAILURE');
    },
  };

  await assert.rejects(
    initializeOrderLogistics(
      {
        orderFilter: { _id: order._id },
        actor,
        now: NOW,
        ...scope,
      },
      { OrderModel: Order, OrderEventModel: controlledRollback }
    ),
    /ORDER_STRESS_CONTROLLED_EVENT_FAILURE/
  );
  let stored = await Order.findById(order._id).lean();
  assert.strictEqual(stored.fulfillment.shipments.length, 0);
  assert.strictEqual(stored.timeline.length, 0);

  const initializationAttempts = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      initializeOrderLogistics(
        {
          orderFilter: { _id: order._id },
          actor,
          now: NOW,
          ...scope,
        },
        { OrderModel: Order }
      )
    )
  );
  const initializationFailures = initializationAttempts.filter(
    (result) => result.status === 'rejected'
  );
  assert.deepStrictEqual(
    initializationFailures.map((result) => result.reason?.code),
    []
  );

  stored = await Order.findById(order._id);
  assert.strictEqual(stored.fulfillment.shipments.length, 1);
  const shipmentId = stored.fulfillment.shipments[0]._id;

  const revisionAttempts = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      updateOrderShipment(
        {
          orderFilter: { _id: order._id },
          shipmentId,
          action: 'start_picking',
          expectedRevision: 0,
          actor,
          now: new Date(NOW.getTime() + 1000),
          ...scope,
        },
        { OrderModel: Order }
      )
    )
  );
  const revisionSuccesses = revisionAttempts.filter(
    (result) => result.status === 'fulfilled'
  );
  const revisionFailures = revisionAttempts.filter(
    (result) => result.status === 'rejected'
  );
  assert.strictEqual(revisionSuccesses.length, 1);
  assert.ok(
    revisionFailures.every(
      (result) => result.reason?.code === 'LOGISTICS_REVISION_CONFLICT'
    )
  );

  const transitions = [
    ['complete_picking', {}],
    ['start_packing', {}],
    ['complete_packing', {}],
    [
      'dispatch',
      {
        carrier: {
          name: 'Transportadora simulada',
          trackingNumber: `${PREFIX}-TRANSACTIONAL-TRACK`,
        },
        dispatchReference: `${PREFIX}-TRANSACTIONAL-DISPATCH`,
        packages: [
          {
            code: `${PREFIX}-TRANSACTIONAL-P01`,
            weightGrams: 500,
          },
        ],
      },
    ],
    ['mark_in_transit', {}],
    [
      'deliver',
      {
        deliveryReference: `${PREFIX}-TRANSACTIONAL-DELIVERY`,
        recipient: 'Receptor de prueba',
      },
    ],
  ];

  let revision = 1;
  for (const [action, payload] of transitions) {
    const result = await updateOrderShipment(
      {
        orderFilter: { _id: order._id },
        shipmentId,
        action,
        expectedRevision: revision,
        payload,
        actor,
        now: new Date(NOW.getTime() + (revision + 1) * 1000),
        ...scope,
      },
      { OrderModel: Order }
    );
    revision = Number(result.shipment.revision);
  }

  stored = await Order.findById(order._id).lean();
  assert.strictEqual(stored.status, 'delivered');
  assert.strictEqual(stored.fulfillmentStatus, 'delivered');
  assert.strictEqual(stored.fulfillment.shipments[0].status, 'delivered');
  assert.strictEqual(stored.inventoryAllocations[0].shippedQuantity, 1);
  assert.strictEqual(stored.inventoryAllocations[0].deliveredQuantity, 1);

  return {
    rollbackVerified: true,
    initializationAttempts: initializationAttempts.length,
    shipmentCount: stored.fulfillment.shipments.length,
    revisionAttempts: revisionAttempts.length,
    revisionWinners: revisionSuccesses.length,
    revisionConflicts: revisionFailures.length,
    finalRevision: revision,
    finalStatus: stored.status,
  };
}

async function auditIntegrity() {
  const orders = await Order.find({ tags: 'orders-stress' }).lean();
  const findings = [];
  const numbers = new Set();

  for (const order of orders) {
    if (numbers.has(order.orderNumber)) {
      findings.push({
        code: 'DUPLICATE_ORDER_NUMBER',
        orderNumber: order.orderNumber,
      });
    }
    numbers.add(order.orderNumber);

    const allocations = order.inventoryAllocations || [];
    for (const allocation of allocations) {
      const sold = Number(allocation.soldQuantity || 0);
      const shipped = Number(allocation.shippedQuantity || 0);
      const delivered = Number(allocation.deliveredQuantity || 0);
      const returned = Number(allocation.returnedQuantity || 0);
      if (delivered > shipped || shipped > sold || returned > sold) {
        findings.push({
          code: 'ALLOCATION_QUANTITY_ORDER',
          orderNumber: order.orderNumber,
        });
      }
    }

    if (order.status === 'delivered') {
      const activeShipments = (order.fulfillment?.shipments || []).filter(
        (shipment) => shipment.status !== 'cancelled'
      );
      if (
        !activeShipments.length ||
        activeShipments.some(
          (shipment) =>
            shipment.status !== 'delivered' ||
            !shipment.deliveryEvidence?.reference
        )
      ) {
        findings.push({
          code: 'DELIVERED_WITHOUT_EVIDENCE',
          orderNumber: order.orderNumber,
        });
      }
      if (
        allocations.some(
          (allocation) =>
            Number(allocation.deliveredQuantity || 0) <
            Math.max(
              0,
              Number(allocation.soldQuantity || 0) -
                Number(allocation.returnedQuantity || 0)
            )
        )
      ) {
        findings.push({
          code: 'DELIVERED_ALLOCATION_MISMATCH',
          orderNumber: order.orderNumber,
        });
      }
    }
  }

  return { findings, orderCount: orders.length };
}

async function proveAuditorDetectsCorruption(orderId) {
  await Order.collection.updateOne(
    { _id: orderId },
    { $set: { 'inventoryAllocations.0.deliveredQuantity': 0 } }
  );
  const corrupted = await auditIntegrity();
  assert.ok(
    corrupted.findings.some(
      (finding) => finding.code === 'DELIVERED_ALLOCATION_MISMATCH'
    )
  );
  await Order.collection.updateOne(
    { _id: orderId },
    { $set: { 'inventoryAllocations.0.deliveredQuantity': 1 } }
  );
  return corrupted.findings.length;
}

async function run() {
  const plan = validatePlan(buildPlan());
  if (VALIDATE_PLAN_ONLY) {
    console.log('\nPLAN TRANSACCIONAL Y DE ESTRÉS DE ÓRDENES: VALIDADO');
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const mongo = assertIsolatedMongoUri(
    String(process.env.ORDERS_STRESS_MONGO_URI || '').trim()
  );
  const totalStartedAt = performance.now();
  const heapBefore = process.memoryUsage().heapUsed;
  let cleanupError = null;

  console.log('\nPRUEBA TRANSACCIONAL Y DE ESTRÉS — ÓRDENES');
  console.log('No llama pasarelas, DIAN, correo ni transportadoras.');
  console.log(`Base temporal aislada: ${mongo.databaseName}`);
  console.log(
    `Plan: ${ORDER_COUNT} órdenes, ${QUERY_REQUEST_COUNT} consultas, concurrencia ${QUERY_CONCURRENCY}.`
  );

  await mongoose.connect(mongo.uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: Math.max(20, QUERY_CONCURRENCY + 5),
  });

  try {
    assert.ok(DATABASE_NAME_PATTERN.test(mongoose.connection.name));
    await Order.createIndexes();

    const payloads = Array.from({ length: ORDER_COUNT }, (_, index) =>
      buildOrderPayload(index)
    );
    await Order.insertMany(payloads, { ordered: true });
    assert.strictEqual(
      await Order.countDocuments({ tags: 'orders-stress' }),
      ORDER_COUNT
    );
    console.log(`OK  ${ORDER_COUNT} órdenes operativas aisladas creadas`);

    const queryMetrics = await executeConcurrentQueries();
    assert.strictEqual(queryMetrics.completed, QUERY_REQUEST_COUNT);
    assert.ok(
      queryMetrics.p95Ms <= MAX_P95_QUERY_MS,
      `El p95 fue ${queryMetrics.p95Ms.toFixed(2)} ms; máximo ${MAX_P95_QUERY_MS} ms.`
    );
    console.log(
      `OK  ${queryMetrics.completed} consultas concurrentes con p95 ${queryMetrics.p95Ms.toFixed(2)} ms`
    );

    const transactionalOrder = await createTransactionalProbe();
    const transactionMetrics = await validateTransactionalConcurrency(
      transactionalOrder
    );
    console.log(
      `OK  rollback, idempotencia y revisión optimista (${transactionMetrics.revisionConflicts} conflictos controlados)`
    );

    const monitoring = createOrderOperationalMonitoringService({
      OrderModel: Order,
      now: () => NOW,
      thresholds: {
        queryLatencyWarningMs: MAX_P95_QUERY_MS,
        queryLatencyCriticalMs: MAX_P95_QUERY_MS * 2,
      },
    });
    const health = await monitoring.getOperationalHealth({
      filter: { tags: 'orders-stress' },
    });
    const counts = scenarioCounts();
    assert.strictEqual(health.metrics.totalOrders, ORDER_COUNT + 1);
    assert.strictEqual(
      health.metrics.recentPaymentFailures,
      counts.payment_failed
    );
    assert.strictEqual(
      health.metrics.stuckPreparation,
      counts.stale_prepare
    );
    assert.strictEqual(
      health.metrics.criticalIncidentOrders,
      counts.critical_incident
    );
    assert.strictEqual(
      health.metrics.staleTransitOrders,
      counts.stale_transit
    );
    assert.strictEqual(health.status, 'critical');
    assert.ok(health.alerts.length >= 4);
    console.log(
      `OK  monitoreo detectó ${health.alerts.length} alertas esperadas sin exponer órdenes individuales`
    );

    const corruptionSignals = await proveAuditorDetectsCorruption(
      transactionalOrder._id
    );
    assert.ok(corruptionSignals > 0);
    const finalAudit = await auditIntegrity();
    assert.strictEqual(finalAudit.orderCount, ORDER_COUNT + 1);
    assert.deepStrictEqual(finalAudit.findings, []);
    console.log('OK  el auditor detectó la corrupción controlada y confirmó la restauración');

    const totalDurationMs = performance.now() - totalStartedAt;
    const heapAfter = process.memoryUsage().heapUsed;
    const heapDeltaMb = (heapAfter - heapBefore) / 1024 / 1024;
    assert.ok(
      totalDurationMs <= MAX_TOTAL_DURATION_MS,
      `La prueba tardó ${totalDurationMs.toFixed(2)} ms; máximo ${MAX_TOTAL_DURATION_MS} ms.`
    );
    assert.ok(
      heapDeltaMb <= MAX_HEAP_DELTA_MB,
      `El heap creció ${heapDeltaMb.toFixed(2)} MB; máximo ${MAX_HEAP_DELTA_MB} MB.`
    );

    console.log('\nMÉTRICAS PROFESIONALES');
    console.log(`  Órdenes verificadas: ${finalAudit.orderCount}`);
    console.log(`  Consultas concurrentes: ${queryMetrics.completed}`);
    console.log(`  Latencia p50: ${queryMetrics.p50Ms.toFixed(2)} ms`);
    console.log(`  Latencia p95: ${queryMetrics.p95Ms.toFixed(2)} ms`);
    console.log(`  Latencia máxima: ${queryMetrics.maxMs.toFixed(2)} ms`);
    console.log(`  Variación de heap: ${heapDeltaMb.toFixed(2)} MB`);
    console.log(`  Duración total: ${totalDurationMs.toFixed(2)} ms`);
    console.log(`  Inconsistencias finales: ${finalAudit.findings.length}`);
    console.log(`  Ganadores de revisión: ${transactionMetrics.revisionWinners}`);
    console.log(`  Conflictos controlados: ${transactionMetrics.revisionConflicts}`);
    console.log(`  Alertas operativas esperadas: ${health.alerts.length}`);
  } finally {
    try {
      if (mongoose.connection.readyState !== 0) {
        assert.ok(DATABASE_NAME_PATTERN.test(mongoose.connection.name));
        await mongoose.connection.dropDatabase();
        console.log(
          `\nLimpieza: base temporal ${mongoose.connection.name} eliminada.`
        );
      }
    } catch (error) {
      cleanupError = error;
    } finally {
      await mongoose.disconnect();
    }
  }

  if (cleanupError) throw cleanupError;
  console.log('\nDICTAMEN: APROBADO');
  console.log(
    'Transacciones, concurrencia, rendimiento, métricas, alertas e integridad quedaron verificadas.'
  );
}

run().catch((error) => {
  console.error('\nDICTAMEN: NO APROBADO');
  console.error(error);
  process.exitCode = 1;
});
