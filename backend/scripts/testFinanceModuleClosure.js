// backend/scripts/testFinanceModuleClosure.js
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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
const TEST_PREFIX = `FIN-CLOSE-${RUN_ID}`;
const TEST_DATE = new Date();
const PROJECT_ROOT = path.join(__dirname, '..', '..');

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

function assertIncludes(content, expected, message) {
  assert(String(content).includes(expected), message || `No se encontro: ${expected}`);
}

function readProjectFile(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe el archivo ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function formatLocalDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildTestQuery(branch) {
  const day = formatLocalDate(TEST_DATE);
  return {
    dateFrom: day,
    dateTo: day,
    branchId: String(branch._id),
  };
}

async function connectDb() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(env.mongoUri);
  }
  ok('Conexion a MongoDB activa');
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

function validateBackendStaticWiring() {
  const route = require('../routes/adminFinance');
  assert(route && typeof route === 'function', 'adminFinance no exporta un router valido.');

  const indexFile = readProjectFile('backend/index.js');
  const routeFile = readProjectFile('backend/routes/adminFinance.js');
  const serviceFile = readProjectFile('backend/services/adminFinanceService.js');
  const modelFile = readProjectFile('backend/models/FinanceExpense.js');
  const dateRangeFile = readProjectFile('backend/utils/dateRange.js');

  assertIncludes(indexFile, "./routes/adminFinance", 'index.js no carga adminFinance.');
  assertIncludes(indexFile, "/api/admin/finance", 'index.js no monta /api/admin/finance.');

  [
    "'/summary'",
    "'/sales'",
    "'/profit'",
    "'/cash'",
    "'/expenses'",
    "'/export'",
    "requirePermission.any(['finance:view', 'reports:view'])",
    "requirePermission('finance:expenses')",
    "requirePermission.any(['finance:export', 'reports:export'])",
  ].forEach((needle) => assertIncludes(routeFile, needle, `adminFinance.js no contiene ${needle}`));

  [
    'getFinanceSummary',
    'getSalesReport',
    'getProfitReport',
    'getCashReport',
    'getExpensesReport',
    'createExpense',
    'updateExpense',
    'cancelExpense',
    'buildFinanceCsv',
    'resolveDateRange',
  ].forEach((needle) => assertIncludes(serviceFile, needle, `adminFinanceService no contiene ${needle}`));

  [
    'amount',
    'category',
    'paymentMethod',
    'status',
    'branch',
    'createdBy',
    'cancelledBy',
    'deletedAt',
  ].forEach((needle) => assertIncludes(modelFile, needle, `FinanceExpense no contiene ${needle}`));

  [
    'resolveDateRange',
    'startOfLocalDay',
    'endOfLocalDay',
    'formatLocalDate',
  ].forEach((needle) => assertIncludes(dateRangeFile, needle, `dateRange util no contiene ${needle}`));

  assert(ADMIN_PERMISSION_KEYS.includes('finance:view'), 'Falta permiso finance:view.');
  assert(ADMIN_PERMISSION_KEYS.includes('finance:expenses'), 'Falta permiso finance:expenses.');
  assert(ADMIN_PERMISSION_KEYS.includes('finance:export'), 'Falta permiso finance:export.');
  assert(getPermissionsByModule('finance').length === 3, 'Catalogo de permisos Finanzas incompleto.');

  ok('Backend Finanzas tiene rutas, servicio, modelo, permisos y fechas centralizadas');
}

function validateFrontendStaticWiring() {
  const appFile = readProjectFile('frontend/src/App.jsx');
  const permissionFile = readProjectFile('frontend/src/admin/security/adminPermissions.js');
  const apiFile = readProjectFile('frontend/src/admin/finance/api/financeApi.js');
  const pageFile = readProjectFile('frontend/src/admin/finance/AdminFinancePage.jsx');

  assertIncludes(appFile, "import AdminFinancePage", 'App.jsx no importa AdminFinancePage.');
  assertIncludes(appFile, 'path="finanzas"', 'App.jsx no registra /admin/finanzas.');
  assertIncludes(appFile, 'protectAdminContent(<AdminFinancePage />)', 'La ruta Finanzas no esta protegida por permisos.');

  assertIncludes(permissionFile, "finanzas: ['finance:view']", 'adminPermissions no protege finanzas con finance:view.');

  [
    '/api/admin/finance/summary',
    '/api/admin/finance/sales',
    '/api/admin/finance/profit',
    '/api/admin/finance/cash',
    '/api/admin/finance/expenses',
    '/api/admin/finance/export',
    'responseType: \'blob\'',
    'api.post',
    'api.put',
    'api.delete',
  ].forEach((needle) => assertIncludes(apiFile, needle, `financeApi no contiene ${needle}`));

  [
    'createPortal',
    'document.body',
    'ExpenseModal',
    'expenseModalOpen',
    'openCreateExpenseForm',
    'openEditExpenseForm',
    'createFinanceExpense',
    'updateFinanceExpense',
    'cancelFinanceExpense',
    'exportFinanceCsv',
    'getFinanceSummary',
    'getFinanceSales',
    'getFinanceProfit',
    'getFinanceCash',
    'getFinanceExpenses',
    'Nuevo gasto',
    'Registrar gasto',
    'Ventas CSV',
    'Gastos CSV',
    'Ventas POS vs Web',
    'Metodos de pago',
    'Resumen de caja',
    'Utilidad neta',
  ].forEach((needle) => assertIncludes(pageFile, needle, `AdminFinancePage no contiene ${needle}`));

  assert(!pageFile.includes('showExpenseForm'), 'Quedo estado viejo showExpenseForm; el gasto debe abrirse en modal.');
  ok('Frontend Finanzas tiene ruta, permisos, API, modal, filtros, exportacion y acciones de gastos');
}

async function ensureBranch() {
  const branch = new Branch({
    name: `Sede Cierre Finanzas ${RUN_ID}`,
    code: TEST_PREFIX,
    type: 'store',
    status: 'active',
    active: true,
    isMain: false,
    isDefaultForOnlineOrders: false,
    notes: `Sede temporal aislada por cierre finanzas ${RUN_ID}`,
  });
  await branch.save();
  ok(`Sede temporal aislada creada: ${branch.name}`);
  return { branch, temporary: true };
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
      name: 'Cliente Cierre Finanzas',
      email: `${orderNumber.toLowerCase()}@example.com`,
      phone: '3000000000',
    },
    createdAt: TEST_DATE,
    updatedAt: TEST_DATE,
  };
}

async function forceOrderReportDate(orderIds = []) {
  const ids = orderIds.filter(Boolean).map((id) => new mongoose.Types.ObjectId(String(id)));
  if (!ids.length) return;

  await Order.collection.updateMany(
    { _id: { $in: ids } },
    { $set: { createdAt: TEST_DATE, updatedAt: TEST_DATE } }
  );
}

async function createFixtures(branch) {
  const product = new Product({
    sku: `${TEST_PREFIX}-PROD`,
    title: `Producto Cierre Finanzas ${RUN_ID}`,
    description: 'Producto temporal para prueba de cierre del modulo Finanzas.',
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
  ok('Producto temporal financiero creado');

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
  ok('Ordenes temporales POS y Web creadas para reporte financiero');

  const cashSession = await CashSession.create({
    sessionCode: `${TEST_PREFIX}-CAJA`,
    status: 'closed',
    branch: branch._id,
    branchSnapshot: {
      name: branch.name,
      code: branch.code,
      type: branch.type,
    },
    cashier: new mongoose.Types.ObjectId(),
    cashierSnapshot: {
      username: 'script-cierre-finanzas',
      displayName: 'Script Cierre Finanzas',
      role: 'owner',
      adminRole: 'owner',
    },
    openedAt: TEST_DATE,
    closedAt: TEST_DATE,
    openingAmount: 50000,
    countedCash: 238000,
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
        amount: 12000,
        direction: 'out',
        reason: 'Gasto caja prueba cierre finanzas',
        reference: `${TEST_PREFIX}-CASH-EXPENSE`,
      },
    ],
  });
  ok('Sesion de caja temporal creada');

  const expense = await financeService.createExpense(
    {
      date: TEST_DATE,
      amount: 8000,
      type: 'operating',
      category: 'Pruebas cierre',
      description: 'Gasto temporal prueba cierre finanzas',
      vendor: 'Proveedor prueba',
      paymentMethod: 'transfer',
      reference: `${TEST_PREFIX}-EXPENSE`,
      status: 'paid',
      branchId: String(branch._id),
      tags: ['finanzas', 'cierre'],
    },
    {
      snapshot: {
        username: 'script-cierre-finanzas',
        displayName: 'Script Cierre Finanzas',
        role: 'owner',
        adminRole: 'owner',
      },
    }
  );

  const updatedExpense = await financeService.updateExpense(expense._id, {
    amount: 9000,
    category: 'Pruebas cierre actualizadas',
    notes: 'Actualizado por prueba de cierre.',
  });

  assert(Number(updatedExpense.amount || 0) === 9000, 'Editar gasto no actualizo el valor.');
  ok('Crear y editar gasto financiero funciona');

  return {
    product,
    onlineOrder,
    posOrder,
    cashSession,
    expense: updatedExpense,
  };
}

async function validateReports(query) {
  const sales = await financeService.getSalesReport(query);
  assert(Number(sales.revenue || 0) === 335000, `Ventas no suman POS + Web. Actual: ${sales.revenue}`);
  assert(Number(sales.ordersCount || 0) === 2, `Cantidad de ordenes no coincide. Actual: ${sales.ordersCount}`);
  assert(sales.bySource.some((row) => row.key === 'pos' && Number(row.amount) === 200000), 'Ventas POS no aparecen en bySource.');
  assert(sales.bySource.some((row) => row.key === 'online' && Number(row.amount) === 135000), 'Ventas online no aparecen en bySource.');
  assert(sales.byPaymentMethod.some((row) => row.key === 'cash' && Number(row.amount) === 200000), 'Metodo cash no aparece en ventas.');
  assert(sales.byPaymentMethod.some((row) => row.key === 'transfer' && Number(row.amount) === 135000), 'Metodo transfer no aparece en ventas.');
  ok('Ventas separan POS/Web y metodos de pago');

  const profit = await financeService.getProfitReport(query);
  assert(Number(profit.revenue || 0) === 335000, `Utilidad no toma ingresos correctos. Actual: ${profit.revenue}`);
  assert(Number(profit.cogs || 0) === 200000, `Costo de venta no coincide. Actual: ${profit.cogs}`);
  assert(Number(profit.grossProfit || 0) === 135000, `Utilidad bruta incorrecta. Actual: ${profit.grossProfit}`);
  assert(Array.isArray(profit.byProduct) && profit.byProduct.length >= 1, 'Rentabilidad por producto no responde.');
  ok('Utilidad calcula ingresos, costos, margen bruto y productos rentables');

  const cash = await financeService.getCashReport(query);
  assert(Number(cash.sessionsCount || 0) === 1, `Caja no detecta sesion temporal. Actual: ${cash.sessionsCount}`);
  assert(Number(cash.paymentTotals?.cash || 0) === 200000, `Caja no suma efectivo. Actual: ${cash.paymentTotals?.cash}`);
  assert(Number(cash.movements?.operatingExpenses || 0) === 12000, `Caja no suma egresos. Actual: ${cash.movements?.operatingExpenses}`);
  ok('Caja financiera calcula sesiones, efectivo y movimientos');

  const expenses = await financeService.getExpensesReport(query);
  assert(Number(expenses.manualTotal || 0) === 9000, `Gastos manuales no suman. Actual: ${expenses.manualTotal}`);
  assert(Number(expenses.manualCount || 0) === 1, `Cantidad de gastos manuales incorrecta. Actual: ${expenses.manualCount}`);
  assert(Array.isArray(expenses.data) && expenses.data.some((item) => item.category === 'Pruebas cierre actualizadas'), 'Tabla de gastos no devuelve el gasto editado.');
  ok('Gastos manuales listan, suman y reflejan edicion');

  const summary = await financeService.getFinanceSummary(query);
  assert(Number(summary.kpis.revenue || 0) === 335000, `Resumen no trae ingresos correctos. Actual: ${summary.kpis.revenue}`);
  assert(Number(summary.kpis.cogs || 0) === 200000, `Resumen no trae costos correctos. Actual: ${summary.kpis.cogs}`);
  assert(Number(summary.kpis.operatingExpenses || 0) === 21000, `Resumen no suma gastos manuales + caja. Actual: ${summary.kpis.operatingExpenses}`);
  assert(Number(summary.kpis.netProfit || 0) === 114000, `Resumen no calcula utilidad neta. Actual: ${summary.kpis.netProfit}`);
  assert(summary.sales?.bySource?.length >= 1, 'Resumen no incluye ventas por canal.');
  assert(summary.cash, 'Resumen no incluye caja.');
  ok('Resumen financiero integra KPIs, ventas, caja, gastos y utilidad neta');

  const csvSales = await financeService.buildFinanceCsv('sales', query);
  assert(csvSales.includes('Orden') && csvSales.includes(`${TEST_PREFIX}-WEB`), 'CSV ventas no incluye orden temporal.');
  const csvExpenses = await financeService.buildFinanceCsv('expenses', query);
  assert(csvExpenses.includes('Categoria') && csvExpenses.includes('Pruebas cierre actualizadas'), 'CSV gastos no incluye gasto temporal.');
  ok('Exportacion CSV de ventas y gastos funciona');
}

async function validateExpenseCancel(expenseId, query) {
  const cancelled = await financeService.cancelExpense(expenseId, {
    snapshot: {
      username: 'script-cierre-finanzas',
      displayName: 'Script Cierre Finanzas',
      role: 'owner',
      adminRole: 'owner',
    },
  });

  assert(cancelled.status === 'cancelled', 'Anular gasto no dejo estado cancelled.');
  assert(cancelled.deletedAt, 'Anular gasto no marco deletedAt.');

  const expensesAfterCancel = await financeService.getExpensesReport(query);
  assert(Number(expensesAfterCancel.manualTotal || 0) === 0, 'Gasto anulado sigue sumando en gastos manuales.');
  ok('Anular gasto funciona y deja de afectar reportes');
}

async function main() {
  console.log('\n=== Prueba General Cierre Modulo Finanzas ===');
  console.log(`Run ID: ${RUN_ID}`);

  let branchInfo = null;
  let fixtures = null;

  try {
    validateBackendStaticWiring();
    validateFrontendStaticWiring();

    await connectDb();
    await cleanup();
    branchInfo = await ensureBranch();

    const query = buildTestQuery(branchInfo.branch);
    fixtures = await createFixtures(branchInfo.branch);
    await validateReports(query);
    await validateExpenseCancel(fixtures.expense._id, query);

    ok('Modulo Finanzas cumple condiciones tecnicas para cierre funcional');
  } catch (error) {
    fail('Error inesperado en prueba Cierre Finanzas', error);
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
