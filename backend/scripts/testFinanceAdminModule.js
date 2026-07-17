// backend/scripts/testFinanceAdminModule.js
/* eslint-disable no-console */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const { env } = require('../config/env');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const CashSession = require('../models/CashSession');
const FinanceExpense = require('../models/FinanceExpense');
const financeService = require('../services/adminFinanceService');
const {
  ADMIN_PERMISSION_KEYS,
  getPermissionsByModule,
} = require('../security/adminPermissionCatalog');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const TEST_PREFIX = `FIN-${RUN_ID}`;
const TEST_DATE = new Date('2099-01-15T12:00:00.000Z');

const results = {
  ok: 0,
  warn: 0,
  fail: 0,
};

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function warn(message) {
  results.warn += 1;
  console.warn(`WARN ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildTestQuery(branch) {
  return {
    dateFrom: '2099-01-15',
    dateTo: '2099-01-15',
    branchId: String(branch._id),
  };
}

async function connectDb() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(env.mongoUri);
  }
  ok('Conexion a MongoDB activa');
}

async function ensureBranch() {
  const branch = new Branch({
    name: `Sede Finanzas ${RUN_ID}`,
    code: TEST_PREFIX,
    type: 'store',
    status: 'active',
    active: true,
    isMain: false,
    isDefaultForOnlineOrders: false,
    notes: `Sede temporal aislada por prueba finanzas ${RUN_ID}`,
  });
  await branch.save();
  ok(`Sede temporal aislada creada: ${branch.name}`);
  return { branch, temporary: true };
}

async function cleanup(extra = {}) {
  await Order.deleteMany({ orderNumber: { $regex: `^${TEST_PREFIX}` } });
  await CashSession.deleteMany({ sessionCode: { $regex: `^${TEST_PREFIX}` } });
  await FinanceExpense.deleteMany({ reference: { $regex: `^${TEST_PREFIX}` } });
  await Product.deleteMany({ sku: { $regex: `^${TEST_PREFIX}` } });
  await Branch.deleteMany({ code: TEST_PREFIX });

  if (extra.temporaryBranchId) {
    await Branch.deleteOne({ _id: extra.temporaryBranchId });
  }
}

function makeOrderPayload({ product, branch, orderNumber, source, channel, saleType, qty, unitPrice, size = '', color = '', method = 'cash' }) {
  const total = qty * unitPrice;
  return {
    sessionId: `${orderNumber}-SESSION`,
    orderNumber,
    status: 'paid',
    fulfillmentStatus: source === 'pos' ? 'delivered' : 'processing',
    branch: branch._id,
    branchSnapshot: {
      name: branch.name,
      code: branch.code,
      type: branch.type,
    },
    source,
    channel,
    saleType,
    items: [
      {
        product: product._id,
        productId: String(product._id),
        title: product.title,
        image: product.image,
        color,
        size,
        qty,
        quantity: qty,
        price: unitPrice,
        unitPrice,
        priceNumber: unitPrice,
      },
    ],
    subtotal: total,
    shipping: 0,
    total,
    payment: {
      provider: source === 'pos' ? 'pos' : 'manual',
      status: 'paid',
      method,
      methodType: method,
      methodLabel: method,
      amount: total,
      amountInCents: total * 100,
      paidAt: TEST_DATE,
    },
    customer: {
      name: 'Cliente Prueba Finanzas',
      email: `${orderNumber.toLowerCase()}@example.com`,
      phone: '3000000000',
    },
    createdAt: TEST_DATE,
    updatedAt: TEST_DATE,
  };
}

async function forceOrderReportDate(orderIds = []) {
  const ids = orderIds.filter(Boolean);
  if (!ids.length) return;

  await Order.updateMany(
    { _id: { $in: ids } },
    { $set: { createdAt: TEST_DATE, updatedAt: TEST_DATE } },
    { timestamps: false }
  );
}

async function createFixtures(branch) {
  const product = new Product({
    sku: `${TEST_PREFIX}-PROD`,
    title: `Producto Finanzas ${RUN_ID}`,
    description: 'Producto temporal para prueba de finanzas.',
    productType: 'physical',
    unitOfMeasure: 'unit',
    trackInventory: true,
    category: 'Pruebas finanzas',
    price: 135000,
    cost: 60000,
    averageCost: 60000,
    image: 'https://example.com/finance-product.jpg',
    variants: [
      {
        size: '128GB',
        color: '#0000ff',
        label: '128GB / Azul',
        sku: `${TEST_PREFIX}-AZU-128`,
        barcode: `770${RUN_ID}128`,
        price: 135000,
        cost: 80000,
        image: 'https://example.com/finance-variant.jpg',
        initialStock: 4,
        active: true,
      },
    ],
    active: true,
  });
  await product.save();
  ok('Producto temporal para finanzas creado');

  const onlineOrder = await Order.create(
    makeOrderPayload({
      product,
      branch,
      orderNumber: `${TEST_PREFIX}-WEB`,
      source: 'online',
      channel: 'web',
      saleType: 'online_order',
      qty: 1,
      unitPrice: 135000,
      size: '128GB',
      color: '#0000ff',
      method: 'transfer',
    })
  );

  const posOrder = await Order.create(
    makeOrderPayload({
      product,
      branch,
      orderNumber: `${TEST_PREFIX}-POS`,
      source: 'pos',
      channel: 'physical_store',
      saleType: 'pos_sale',
      qty: 2,
      unitPrice: 100000,
      method: 'cash',
    })
  );

  await forceOrderReportDate([onlineOrder._id, posOrder._id]);

  ok('Ordenes temporales POS y Web creadas');
  ok('Fechas de ordenes temporales fijadas para reporte financiero aislado');

  const cashier = new mongoose.Types.ObjectId();
  const cashSession = await CashSession.create({
    sessionCode: `${TEST_PREFIX}-CAJA`,
    status: 'closed',
    branch: branch._id,
    branchSnapshot: {
      name: branch.name,
      code: branch.code,
      type: branch.type,
    },
    cashier,
    cashierSnapshot: {
      username: 'script-finanzas',
      displayName: 'Script Finanzas',
      role: 'owner',
      adminRole: 'owner',
    },
    openedAt: TEST_DATE,
    closedAt: TEST_DATE,
    openingAmount: 50000,
    countedCash: 240000,
    salesSummary: {
      ordersCount: 1,
      itemsCount: 2,
      grossSales: 200000,
      netSales: 200000,
      paymentTotals: {
        cash: 200000,
        transfer: 0,
        card: 0,
        mixed: 0,
        other: 0,
      },
    },
    cashMovements: [
      {
        type: 'expense',
        amount: 10000,
        direction: 'out',
        reason: 'Gasto menor prueba finanzas',
        reference: `${TEST_PREFIX}-CASH-EXPENSE`,
      },
    ],
  });

  ok('Sesion de caja temporal creada');

  const expense = await financeService.createExpense(
    {
      date: TEST_DATE,
      amount: 5000,
      type: 'operating',
      category: 'Pruebas',
      description: 'Gasto temporal prueba finanzas',
      paymentMethod: 'transfer',
      reference: `${TEST_PREFIX}-EXPENSE`,
      status: 'paid',
      branchId: String(branch._id),
      branchSnapshot: {
        name: branch.name,
        code: branch.code,
        type: branch.type,
      },
      tags: ['finanzas', 'prueba'],
    },
    {
      snapshot: {
        username: 'script-finanzas',
        displayName: 'Script Finanzas',
        role: 'owner',
        adminRole: 'owner',
      },
    }
  );

  ok('Gasto operativo temporal creado desde servicio financiero');

  const updatedExpense = await financeService.updateExpense(expense._id, { amount: 6000, category: 'Pruebas actualizadas' });
  assert(Number(updatedExpense.amount || 0) === 6000, 'Actualizar gasto no cambio el valor.');
  ok('Actualizar gasto financiero funciona');

  return {
    product,
    onlineOrder,
    posOrder,
    cashSession,
    expense: updatedExpense,
  };
}

async function validateStaticWiring() {
  const route = require('../routes/adminFinance');
  assert(route && typeof route === 'function', 'La ruta adminFinance no exporta un router valido.');
  ok('Ruta backend adminFinance carga correctamente');

  const indexFile = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert(indexFile.includes("./routes/adminFinance"), 'index.js no carga ./routes/adminFinance.');
  assert(indexFile.includes('/api/admin/finance'), 'index.js no monta /api/admin/finance.');
  ok('Ruta /api/admin/finance esta montada en index.js');

  assert(ADMIN_PERMISSION_KEYS.includes('finance:view'), 'Falta permiso finance:view.');
  assert(ADMIN_PERMISSION_KEYS.includes('finance:expenses'), 'Falta permiso finance:expenses.');
  assert(ADMIN_PERMISSION_KEYS.includes('finance:export'), 'Falta permiso finance:export.');
  assert(getPermissionsByModule('finance').length === 3, 'Catalogo de permisos finanzas incompleto.');
  ok('Permisos financieros registrados en catalogo admin');
}

async function validateReports(query) {
  const sales = await financeService.getSalesReport(query);
  assert(Number(sales.revenue || 0) === 335000, 'Ventas no suman POS + Web correctamente.');
  assert(Number(sales.ordersCount || 0) === 2, 'Cantidad de ordenes financieras no coincide.');
  assert(sales.bySource.some((row) => row.key === 'pos' && Number(row.amount) === 200000), 'Ventas POS no aparecen en bySource.');
  assert(sales.bySource.some((row) => row.key === 'online' && Number(row.amount) === 135000), 'Ventas Web no aparecen en bySource.');
  ok('Reporte de ventas separa POS y Web correctamente');

  const profit = await financeService.getProfitReport(query);
  assert(Number(profit.revenue || 0) === 335000, 'Utilidad no toma ingresos correctos.');
  assert(Number(profit.cogs || 0) === 200000, 'Costo de venta no coincide con costos de producto/variante.');
  assert(Number(profit.grossProfit || 0) === 135000, 'Utilidad bruta incorrecta.');
  ok('Reporte de utilidad calcula ingresos, costos y margen bruto');

  const cash = await financeService.getCashReport(query);
  assert(Number(cash.sessionsCount || 0) === 1, 'Caja financiera no detecta la sesion temporal.');
  assert(Number(cash.movements?.operatingExpenses || 0) === 10000, 'Caja no suma gastos operativos de movimientos.');
  assert(Number(cash.paymentTotals?.cash || 0) === 200000, 'Caja no suma pagos en efectivo.');
  ok('Reporte de caja calcula ventas, efectivo y movimientos');

  const expenses = await financeService.getExpensesReport(query);
  assert(Number(expenses.manualTotal || 0) === 6000, 'Gastos manuales no suman correctamente.');
  assert(Number(expenses.manualCount || 0) === 1, 'Cantidad de gastos manuales incorrecta.');
  ok('Reporte de gastos manuales funciona');

  const summary = await financeService.getFinanceSummary(query);
  assert(Number(summary.kpis.revenue || 0) === 335000, 'Resumen financiero no trae ingresos correctos.');
  assert(Number(summary.kpis.cogs || 0) === 200000, 'Resumen financiero no trae costos correctos.');
  assert(Number(summary.kpis.operatingExpenses || 0) === 16000, 'Resumen financiero no suma gastos manuales + caja.');
  assert(Number(summary.kpis.netProfit || 0) === 119000, 'Resumen financiero no calcula utilidad neta correcta.');
  ok('Resumen financiero calcula KPIs principales');

  const csvSales = await financeService.buildFinanceCsv('sales', query);
  assert(csvSales.includes('Orden') && csvSales.includes(`${TEST_PREFIX}-WEB`), 'CSV de ventas no incluye orden temporal.');
  const csvExpenses = await financeService.buildFinanceCsv('expenses', query);
  assert(csvExpenses.includes('Categoria') && csvExpenses.includes('Pruebas actualizadas'), 'CSV de gastos no incluye gasto temporal.');
  ok('Exportacion CSV financiera funciona');
}

async function validateExpenseLifecycle(expenseId) {
  const cancelled = await financeService.cancelExpense(expenseId);
  assert(cancelled.status === 'cancelled', 'Anular gasto no dejo estado cancelled.');
  assert(cancelled.deletedAt, 'Anular gasto no marco deletedAt.');
  ok('Anular gasto financiero funciona');
}

async function main() {
  console.log('\n=== Prueba Backend Finanzas ===');
  console.log(`Run ID: ${RUN_ID}`);

  let branchInfo = null;
  let fixtures = null;

  try {
    await validateStaticWiring();
    await connectDb();
    await cleanup();
    branchInfo = await ensureBranch();

    const query = buildTestQuery(branchInfo.branch);
    fixtures = await createFixtures(branchInfo.branch);
    await validateReports(query);
    await validateExpenseLifecycle(fixtures.expense._id);
  } catch (error) {
    fail('Error inesperado en prueba Backend Finanzas', error);
  } finally {
    await cleanup({ temporaryBranchId: branchInfo?.temporary ? branchInfo.branch._id : null });
    ok('Limpieza final de datos temporales');

    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }

    if (results.fail > 0) process.exit(1);
  }
}

main();