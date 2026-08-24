/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const {
  queryAdminOrders,
} = require('../services/orderAdminQueryService');

const REQUIRED_DATABASE = 'orders_ci_stage3_query';
const MONGO_URI = process.env.ORDERS_STAGE3_MONGO_URI || '';
const ORDER_COUNT = Math.min(
  3000,
  Math.max(400, Number(process.env.ORDERS_STAGE3_ORDER_COUNT || 1200))
);
const PAGE_SIZE = 25;
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function assertSafeMongoUri(value) {
  assert(value, 'ORDERS_STAGE3_MONGO_URI no está configurado.');

  const parsed = new URL(value);
  assert.strictEqual(
    parsed.protocol,
    'mongodb:',
    'La integración de Etapa 3 no acepta Atlas ni mongodb+srv.'
  );
  assert(
    ['127.0.0.1', 'localhost'].includes(parsed.hostname),
    'La integración de Etapa 3 solo acepta MongoDB local.'
  );
  assert.strictEqual(
    parsed.pathname.replace(/^\//, ''),
    REQUIRED_DATABASE,
    `La base temporal debe llamarse ${REQUIRED_DATABASE}.`
  );
  assert.strictEqual(
    parsed.searchParams.get('replicaSet'),
    'rs0',
    'La integración de Etapa 3 exige replicaSet=rs0.'
  );
}

function compareStableDescending(left, right) {
  const dateDifference = right.createdAt.getTime() - left.createdAt.getTime();
  if (dateDifference !== 0) return dateDifference;
  return String(right._id).localeCompare(String(left._id));
}

function belongsToBranch(order, branchId) {
  return (
    String(order.branch) === String(branchId) ||
    order.inventoryAllocations.some(
      (allocation) => String(allocation.branch) === String(branchId)
    )
  );
}

function buildFixture() {
  const branchA = new mongoose.Types.ObjectId();
  const branchB = new mongoose.Types.ObjectId();
  const statuses = [
    'paid',
    'pending',
    'delivered',
    'cancelled',
    'failed',
    'processing',
  ];
  const baseDate = new Date('2026-08-24T15:00:00.000Z');
  const orders = [];
  const invoices = [];
  const invoiceState = new Map();

  for (let index = 0; index < ORDER_COUNT; index += 1) {
    const _id = new mongoose.Types.ObjectId();
    const status = statuses[index % statuses.length];
    const principalBranch = index % 2 === 0 ? branchA : branchB;
    const allocationBranch = index % 5 === 0
      ? principalBranch === branchA
        ? branchB
        : branchA
      : principalBranch;
    const createdAt = new Date(
      baseDate.getTime() - Math.floor(index / 10) * 60 * 1000
    );
    const total = 50000 + (index % 17) * 1000;
    const order = {
      _id,
      sessionId: `STAGE3-SESSION-${index}`,
      orderNumber: `ORD-STAGE3-${String(index).padStart(5, '0')}`,
      status,
      source: 'online',
      archived: index % 11 === 0,
      printed: index % 3 === 0,
      tags: index % 7 === 0 ? ['prioridad'] : ['normal'],
      branch: principalBranch,
      branchSnapshot: {
        name: principalBranch === branchA ? 'Sede A' : 'Sede B',
        code: principalBranch === branchA ? 'STAGE3-A' : 'STAGE3-B',
      },
      customer: {
        name: 'Cliente',
        lastname: `Etapa ${index}`,
        email: `stage3-${index}@example.invalid`,
      },
      payment: {
        status: ['paid', 'delivered'].includes(status) ? 'paid' : 'pending',
        provider: 'manual',
      },
      items: [
        {
          productId: String(new mongoose.Types.ObjectId()),
          title: `Producto Etapa 3 ${index}`,
          quantity: 1,
          price: total,
        },
      ],
      inventoryAllocations: [
        {
          branch: allocationBranch,
          soldQuantity: 1,
          returnedQuantity: 0,
        },
      ],
      fulfillment: { shipments: [] },
      subtotal: total,
      total,
      createdAt,
      updatedAt: createdAt,
    };
    orders.push(order);

    if (index % 3 === 0) {
      const validated = index % 6 === 0;
      invoiceState.set(String(_id), { validated });
      invoices.push({
        _id: new mongoose.Types.ObjectId(),
        orderId: _id,
        orderNumber: order.orderNumber,
        idempotencyKey: `stage3-invoice-${index}`,
        required: true,
        status: validated ? 'validated' : 'pending',
        ...(validated
          ? {
              invoiceNumber: `STAGE3-${index}`,
              cufe: `stage3-cufe-${index}`,
              validatedAt: createdAt,
              provider: {
                name: 'factus',
                number: `STAGE3-${index}`,
                isValidated: true,
              },
            }
          : { provider: { name: 'factus', status: 'pending' } }),
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  return { branchA, branchB, invoiceState, invoices, orders };
}

function countingOrderModel(counter) {
  return {
    aggregate(pipeline) {
      counter.calls += 1;
      return Order.aggregate(pipeline);
    },
  };
}

async function run() {
  assertSafeMongoUri(MONGO_URI);
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();

  const fixture = buildFixture();
  await Order.collection.insertMany(fixture.orders, { ordered: true });
  await ElectronicInvoice.collection.insertMany(fixture.invoices, {
    ordered: true,
  });
  ok(`${ORDER_COUNT} órdenes y ${fixture.invoices.length} facturas temporales creadas`);

  await Promise.all([Order.createIndexes(), ElectronicInvoice.createIndexes()]);
  const physicalIndexes = await Order.collection.indexes();
  const indexNames = new Set(physicalIndexes.map((index) => index.name));
  for (const requiredIndex of [
    'orders_admin_branch_status_date',
    'orders_admin_allocation_status_date',
    'orders_admin_archive_status_date',
  ]) {
    assert(indexNames.has(requiredIndex), `No se creó el índice ${requiredIndex}.`);
  }
  ok('los tres índices administrativos existen físicamente en MongoDB');

  const expected = fixture.orders
    .filter(
      (order) =>
        order.status === 'paid' &&
        order.archived !== true &&
        belongsToBranch(order, fixture.branchA)
    )
    .sort(compareStableDescending);
  const expectedWithInvoice = expected.filter((order) =>
    fixture.invoiceState.has(String(order._id))
  );
  const expectedValidated = expected.filter(
    (order) => fixture.invoiceState.get(String(order._id))?.validated
  );
  const expectedSales = expected.reduce((sum, order) => sum + order.total, 0);
  const summaryCounter = { calls: 0 };
  const commonQuery = {
    branchId: String(fixture.branchA),
    status: 'paid',
    archived: '0',
    limit: PAGE_SIZE,
    sort: 'createdAt:-1',
  };
  const firstPage = await queryAdminOrders(
    {
      adminRole: 'owner',
      query: { ...commonQuery, page: 1, includeSummary: '1' },
    },
    {
      OrderModel: countingOrderModel(summaryCounter),
      ElectronicInvoiceModel: ElectronicInvoice,
    }
  );

  assert.strictEqual(summaryCounter.calls, 2);
  assert.strictEqual(firstPage.data.length, Math.min(PAGE_SIZE, expected.length));
  assert.deepStrictEqual(
    firstPage.data.map((order) => String(order._id)),
    expected.slice(0, PAGE_SIZE).map((order) => String(order._id))
  );
  assert.strictEqual(firstPage.total, expected.length);
  assert.strictEqual(firstPage.totalPages, Math.max(1, Math.ceil(expected.length / PAGE_SIZE)));
  assert.strictEqual(firstPage.financialSummary.totalSales, expectedSales);
  assert.strictEqual(
    firstPage.financialSummary.withoutInvoiceOrders,
    expected.length - expectedWithInvoice.length
  );
  assert.strictEqual(
    firstPage.financialSummary.validatedInvoiceOrders,
    expectedValidated.length
  );
  assert.strictEqual(firstPage.operationalSummary.prepare, expected.length);
  ok('la primera página, los totales y las métricas DIAN concilian con el volumen sembrado');

  const pageOnlyCounter = { calls: 0 };
  const secondPage = await queryAdminOrders(
    {
      adminRole: 'owner',
      query: { ...commonQuery, page: 2, includeSummary: '0' },
    },
    {
      OrderModel: countingOrderModel(pageOnlyCounter),
      ElectronicInvoiceModel: ElectronicInvoice,
    }
  );
  assert.strictEqual(pageOnlyCounter.calls, 1);
  assert.strictEqual(secondPage.summaryIncluded, false);
  assert.strictEqual(secondPage.total, undefined);
  assert.deepStrictEqual(
    secondPage.data.map((order) => String(order._id)),
    expected.slice(PAGE_SIZE, PAGE_SIZE * 2).map((order) => String(order._id))
  );
  assert.strictEqual(
    firstPage.data.some((first) =>
      secondPage.data.some((second) => String(first._id) === String(second._id))
    ),
    false
  );
  ok('paginar ejecuta una sola agregación y no repite filas con fechas iguales');

  const concurrentStartedAt = Date.now();
  const concurrentPages = await Promise.all(
    Array.from({ length: 24 }, (_, index) => {
      const page = (index % Math.max(1, firstPage.totalPages)) + 1;
      return queryAdminOrders({
        adminRole: 'owner',
        query: { ...commonQuery, page, includeSummary: '0' },
      });
    })
  );
  assert(
    concurrentPages.every(
      (response) =>
        response.summaryIncluded === false && response.data.length <= PAGE_SIZE
    )
  );
  assert(
    Date.now() - concurrentStartedAt < 15000,
    'Las consultas paginadas concurrentes excedieron 15 segundos.'
  );
  ok('24 lecturas concurrentes permanecen paginadas y no recalculan indicadores');

  const expectedWarehouse = fixture.orders.filter(
    (order) => order.status === 'delivered' && belongsToBranch(order, fixture.branchA)
  );
  const warehouseResult = await queryAdminOrders({
    adminRole: 'warehouse',
    adminDefaultBranch: fixture.branchA,
    adminBranches: [{ branch: fixture.branchA }],
    query: { status: 'delivered', page: 1, limit: 100 },
  });
  assert.strictEqual(warehouseResult.total, expectedWarehouse.length);
  assert(
    warehouseResult.data.every((order) => belongsToBranch(order, fixture.branchA))
  );
  ok('el volumen no rompe el aislamiento por sede principal o asignación multisede');

  console.log(
    `\nIntegración de consultas de Órdenes · Etapa 3: ${passed}/${passed} controles aprobados`
  );
}

async function main() {
  let connected = false;
  try {
    await run();
    connected = true;
  } catch (error) {
    connected = mongoose.connection.readyState !== 0;
    console.error('\nFAIL Integración de consultas de Órdenes · Etapa 3');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (connected || mongoose.connection.readyState !== 0) {
      try {
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  }
}

main();
