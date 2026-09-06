'use strict';

/* eslint-disable no-console */

const mongoose = require('mongoose');

const TEST_URI = String(process.env.FINANCE_STAGE0_MONGO_URI || '').trim();
if (!TEST_URI) {
  throw new Error(
    'FINANCE_STAGE0_MONGO_URI es obligatoria y debe apuntar a una base aislada.'
  );
}

const databaseName = new URL(TEST_URI).pathname.replace(/^\//, '');
if (!/^finance_stage0_ci(?:_|$)/.test(databaseName)) {
  throw new Error(
    `La integración solo puede usar una base aislada finance_stage0_ci*. Recibida: ${databaseName || '(vacía)'}`
  );
}

process.env.MONGO_URI = TEST_URI;

const Branch = require('../models/Branch');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const FinanceExpense = require('../models/FinanceExpense');
const InventoryMovement = require('../models/InventoryMovement');
const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const Product = require('../models/Product');
const financeService = require('../services/adminFinanceService');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const PREFIX = `FIN0-${RUN_ID}`;
const NOW = new Date();
let controls = 0;

function ok(message, condition = true) {
  if (!condition) throw new Error(message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function localDay(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function cleanup() {
  const orders = await Order.find({
    orderNumber: { $regex: `^${PREFIX}` },
  }).select('_id');
  const orderIds = orders.map((order) => order._id);

  await Promise.all([
    ElectronicInvoice.deleteMany({ orderId: { $in: orderIds } }),
    OrderRefund.deleteMany({ order: { $in: orderIds } }),
    InventoryMovement.deleteMany({ order: { $in: orderIds } }),
    FinanceExpense.deleteMany({ reference: { $regex: `^${PREFIX}` } }),
  ]);
  await Order.deleteMany({ _id: { $in: orderIds } });
  await Product.deleteMany({ sku: { $regex: `^${PREFIX}` } });
  await Branch.deleteMany({ code: { $regex: `^${PREFIX}` } });
}

async function createBranch(suffix) {
  return Branch.create({
    name: `Sede Finanzas ${suffix} ${RUN_ID}`,
    code: `${PREFIX}-${suffix}`,
    type: 'store',
    status: 'active',
    active: true,
    isMain: false,
    isDefaultForOnlineOrders: false,
  });
}

async function createOrder({ branch, product, suffix, total, splitPayments }) {
  return Order.create({
    sessionId: `${PREFIX}-${suffix}-SESSION`,
    orderNumber: `${PREFIX}-${suffix}`,
    status: 'paid',
    fulfillmentStatus: 'delivered',
    branch: branch._id,
    branchSnapshot: {
      name: branch.name,
      code: branch.code,
      type: branch.type,
    },
    source: 'pos',
    channel: 'physical_store',
    saleType: 'pos_sale',
    items: [
      {
        product: product._id,
        productId: String(product._id),
        title: product.title,
        qty: 1,
        quantity: 1,
        price: total,
        unitPrice: total,
        priceNumber: total,
        variantKey: 'default__default',
      },
    ],
    subtotal: total,
    shipping: 0,
    total,
    payment: {
      provider: 'pos',
      status: 'paid',
      method: splitPayments ? 'mixed' : 'cash',
      methodType: splitPayments ? 'mixed' : 'cash',
      methodLabel: splitPayments ? 'Pago mixto' : 'Efectivo',
      amount: total,
      amountInCents: total * 100,
      paidAt: NOW,
      splitPayments: splitPayments || [],
    },
    customer: {
      name: 'Cliente Finanzas Etapa 0',
      email: `${PREFIX.toLowerCase()}-${suffix.toLowerCase()}@example.com`,
      phone: '3000000000',
    },
  });
}

async function createHistoricalMovement({ order, branch, product, unitCost }) {
  return InventoryMovement.create({
    type: 'sale_out',
    direction: 'out',
    status: 'posted',
    product: product._id,
    productSnapshot: {
      title: product.title,
      sku: product.sku,
      image: product.image,
      category: product.category,
    },
    variantKey: 'default__default',
    branchFrom: branch._id,
    branchFromSnapshot: {
      name: branch.name,
      code: branch.code,
      type: branch.type,
    },
    quantity: 1,
    stockFrom: { before: 2, quantity: 1, after: 1 },
    unitCost,
    totalCost: unitCost,
    reason: 'Costo histórico prueba Finanzas Etapa 0',
    reference: `${PREFIX}-${order.orderNumber}`,
    order: order._id,
    orderNumber: order.orderNumber,
    sourceModel: 'Order',
    sourceId: order._id,
    postedAt: NOW,
  });
}

async function createFixtures() {
  const [branchA, branchB] = await Promise.all([
    createBranch('A'),
    createBranch('B'),
  ]);
  const product = await Product.create({
    sku: `${PREFIX}-PRODUCTO`,
    title: `Producto Finanzas Etapa 0 ${RUN_ID}`,
    description: 'Producto aislado para validar hechos financieros.',
    productType: 'physical',
    unitOfMeasure: 'unit',
    trackInventory: true,
    category: 'Pruebas finanzas',
    price: 100000,
    cost: 40000,
    averageCost: 40000,
    image: 'https://example.com/finance-stage0.jpg',
    active: true,
  });
  const orderA = await createOrder({
    branch: branchA,
    product,
    suffix: 'A',
    total: 100000,
    splitPayments: [
      { method: 'cash', methodLabel: 'Efectivo', amount: 40000 },
      { method: 'card', methodLabel: 'Tarjeta', amount: 60000 },
    ],
  });
  const orderB = await createOrder({
    branch: branchB,
    product,
    suffix: 'B',
    total: 70000,
  });

  await Promise.all([
    createHistoricalMovement({
      order: orderA,
      branch: branchA,
      product,
      unitCost: 40000,
    }),
    createHistoricalMovement({
      order: orderB,
      branch: branchB,
      product,
      unitCost: 30000,
    }),
  ]);

  const refund = await OrderRefund.create({
    refundNumber: `${PREFIX}-REFUND`,
    order: orderA._id,
    orderNumber: orderA.orderNumber,
    idempotencyKey: `${PREFIX}-REFUND-KEY`,
    requestHash: 'a'.repeat(64),
    status: 'processed',
    amount: 50000,
    currency: 'COP',
    reason: 'Devolución parcial aislada',
    items: [
      {
        orderItemId: orderA.items[0]._id,
        product: product._id,
        title: product.title,
        purchasedQuantity: 1,
        returnedQuantity: 1,
        restockedQuantity: 1,
      },
    ],
    processedAt: NOW,
  });

  const invoice = await ElectronicInvoice.create({
    orderId: orderA._id,
    orderNumber: orderA.orderNumber,
    status: 'accepted',
    creditNotes: [
      {
        idempotencyKey: `${PREFIX}-CREDIT`,
        requestFingerprint: 'b'.repeat(64),
        type: 'partial',
        status: 'validated',
        reasonCode: '2',
        reasonText: 'Devolución parcial aislada',
        referenceCode: `${PREFIX}-NC`,
        totalAmount: 50000,
        subtotal: 50000,
        taxAmount: 0,
        items: [
          {
            productId: String(product._id),
            name: product.title,
            quantity: 1,
            price: 50000,
          },
        ],
        provider: {
          name: 'factus',
          status: 'validated',
          isValidated: true,
        },
        createdAt: NOW,
        validatedAt: NOW,
      },
    ],
  });

  refund.reconciliation = {
    ...(refund.reconciliation?.toObject?.() || refund.reconciliation || {}),
    creditNoteId: invoice.creditNotes[0]._id,
  };
  await refund.save();

  await Product.updateOne(
    { _id: product._id },
    { $set: { cost: 999000, averageCost: 999000 } }
  );

  return { branchA, branchB, product, orderA, orderB };
}

async function validateReports(fixtures) {
  const day = localDay(NOW);
  const queryA = {
    dateFrom: day,
    dateTo: day,
    branchIds: [String(fixtures.branchA._id)],
  };
  const salesA = await financeService.getSalesReport(queryA);
  ok('la sede A conserva su venta bruta', salesA.grossRevenue === 100000);
  ok('reembolso y nota crédito equivalentes se descuentan una sola vez', salesA.refunds === 50000);
  ok('la sede A calcula ingreso neto', salesA.revenue === 50000);

  const methods = new Map(salesA.byPaymentMethod.map((row) => [row.key, row]));
  ok(
    'el pago mixto neto conserva efectivo y tarjeta',
    methods.get('cash')?.amount === 20000 &&
      methods.get('card')?.amount === 30000
  );

  const profitA = await financeService.getProfitReport(queryA);
  ok('el costo histórico no cambia al editar el producto', profitA.grossCogs === 40000);
  ok('la devolución revierte el costo histórico asociado', profitA.returnedCogs === 40000 && profitA.cogs === 0);
  ok('la utilidad neta del hecho financiero es correcta', profitA.grossProfit === 50000);
  ok(
    'el reporte certifica que usó costo congelado',
    profitA.costQuality.historicalCostItems >= 1 &&
      profitA.costQuality.estimatedCostItems === 0
  );

  const salesB = await financeService.getSalesReport({
    ...queryA,
    branchIds: [String(fixtures.branchB._id)],
  });
  ok('el alcance de sede evita mezclar ventas', salesB.grossRevenue === 70000 && salesB.refunds === 0);
}

async function validateExpenses(fixtures) {
  const actor = { snapshot: { username: 'finance-stage0', role: 'manager' } };
  const expenseA = await financeService.createExpense(
    {
      date: NOW,
      amount: 12000,
      category: 'Prueba etapa 0',
      reference: `${PREFIX}-EXP-A`,
      branchId: String(fixtures.branchA._id),
      branchSnapshot: { name: 'DATO NO CONFIABLE' },
    },
    actor
  );
  const expenseB = await financeService.createExpense(
    {
      date: NOW,
      amount: 9000,
      category: 'Prueba etapa 0',
      reference: `${PREFIX}-EXP-B`,
      branchId: String(fixtures.branchB._id),
    },
    actor
  );

  ok('la sede del gasto se obtiene del registro oficial', expenseA.branchSnapshot.name === fixtures.branchA.name);

  const day = localDay(NOW);
  const listA = await financeService.getExpensesReport({
    dateFrom: day,
    dateTo: day,
    branchIds: [String(fixtures.branchA._id)],
  });
  ok('los gastos quedan aislados por sede', listA.total === 1 && listA.manualTotal === 12000);

  let protectedAsNotFound = false;
  try {
    await financeService.updateExpense(
      expenseB._id,
      { amount: 1 },
      actor,
      { branchIds: [String(fixtures.branchA._id)] }
    );
  } catch (error) {
    protectedAsNotFound = error?.status === 404;
  }
  ok('una sede no puede modificar gastos de otra sede', protectedAsNotFound);
}

async function main() {
  console.log('\n=== Integración Finanzas Nivel Plus · Etapa 0 ===');
  await mongoose.connect(TEST_URI);
  await cleanup();

  try {
    const fixtures = await createFixtures();
    await validateReports(fixtures);
    await validateExpenses(fixtures);
    console.log(`\nIntegración Etapa 0 Finanzas validada: ${controls} controles superados.`);
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Fallo integración Etapa 0 Finanzas:', error);
  process.exitCode = 1;
});
