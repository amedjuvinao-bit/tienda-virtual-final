// backend/scripts/testDashboardAdminModule.js
/* eslint-disable no-console */

/**
 * Prueba general del Dashboard administrativo.
 *
 * Comando:
 *   npm run test:dashboard-admin
 *
 * Esta prueba no levanta el servidor. Ejecuta directamente los controllers del dashboard
 * y compara algunos totales contra MongoDB para detectar datos simulados o métricas rotas.
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Order = require('../models/Order');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const DashboardGoal = require('../models/DashboardGoal');

const { getDashboardSummary } = require('../controllers/adminDashboardController');
const { getDashboardSales } = require('../controllers/adminDashboardSalesController');
const {
  getDashboardGoal,
  updateDashboardGoal,
} = require('../controllers/adminDashboardGoalController');
const {
  getMonthPeriodKey,
} = require('../services/dashboardGoalService');

const VALID_SALE_STATUSES = ['paid', 'confirmed', 'shipped', 'delivered', 'completed'];
const CANCELLED_STATUSES = ['cancelled', 'canceled', 'refunded', 'failed'];

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
  console.log(`WARN ${message}`);
}

function fail(message, details = '') {
  results.fail += 1;
  console.log(`FAIL ${message}${details ? `: ${details}` : ''}`);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseMoney(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;

  const clean = raw.replace(/[^\d.,-]/g, '');
  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
    return toNumber(clean.replaceAll(thousandsSeparator, '').replace(decimalSeparator, '.'));
  }

  if (lastComma >= 0) {
    const decimalDigits = clean.length - lastComma - 1;
    return toNumber(decimalDigits > 0 && decimalDigits <= 2 ? clean.replace(',', '.') : clean.replaceAll(',', ''));
  }

  if (lastDot >= 0) {
    const decimalDigits = clean.length - lastDot - 1;
    return toNumber(decimalDigits > 0 && decimalDigits <= 2 ? clean : clean.replaceAll('.', ''));
  }

  return toNumber(clean);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getCurrentMonthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

function createMockReq({ query = {}, body = {} } = {}) {
  return {
    query,
    body,
    adminUserId: 'script-dashboard-admin',
    adminUsername: 'script-dashboard-admin',
    headers: {
      'x-admin-user': 'script-dashboard-admin',
    },
  };
}

function createMockRes(label) {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  response.assertOk = () => {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`${label} respondio HTTP ${response.statusCode}: ${JSON.stringify(response.body)}`);
    }

    if (response.body?.ok === false) {
      throw new Error(`${label} respondio ok=false: ${JSON.stringify(response.body)}`);
    }

    return response.body?.data || response.body;
  };

  return response;
}

async function callController(label, controller, reqData = {}) {
  const req = createMockReq(reqData);
  const res = createMockRes(label);
  await controller(req, res);
  return res.assertOk();
}

async function connect() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta configurado en backend/.env');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

async function getMonthSalesExpected() {
  const { start, end } = getCurrentMonthRange();
  const rows = await Order.aggregate([
    {
      $match: {
        status: { $in: VALID_SALE_STATUSES },
        createdAt: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ['$total', 0] } },
      },
    },
  ]);

  return toNumber(rows?.[0]?.total, 0);
}

async function getRecentOrdersExpectedCount() {
  return Math.min(5, await Order.countDocuments({}));
}

async function getLowStockExpectedCount() {
  const hasInventoryStock = await InventoryStock.exists({ active: true, deletedAt: null });

  if (hasInventoryStock) {
    const rows = await InventoryStock.aggregate([
      {
        $match: {
          active: true,
          deletedAt: null,
          reorderPoint: { $gt: 0 },
        },
      },
      {
        $addFields: {
          realAvailableStock: {
            $ifNull: ['$availableStock', '$stock'],
          },
        },
      },
      {
        $match: {
          $expr: {
            $lte: ['$realAvailableStock', '$reorderPoint'],
          },
        },
      },
      { $group: { _id: '$product' } },
      { $count: 'count' },
    ]);

    return toNumber(rows?.[0]?.count, 0);
  }

  return Product.countDocuments({
    active: true,
    reorderPoint: { $gt: 0 },
    $expr: { $lte: ['$stock', '$reorderPoint'] },
  });
}

async function getInventoryBranchExpectedCount() {
  const inventoryRows = await InventoryStock.aggregate([
    {
      $match: {
        active: true,
        deletedAt: null,
      },
    },
    { $group: { _id: '$branch' } },
    { $count: 'count' },
  ]);

  const inventoryCount = toNumber(inventoryRows?.[0]?.count, 0);
  if (inventoryCount > 0) return Math.min(4, inventoryCount);

  const productRows = await Product.aggregate([
    { $match: { active: true } },
    {
      $group: {
        _id: { $ifNull: ['$warehouseLocation', 'Inventario general'] },
      },
    },
    { $count: 'count' },
  ]);

  return Math.min(4, toNumber(productRows?.[0]?.count, 0));
}

async function getSalesExpectedByRange(range) {
  const today = startOfDay(new Date());
  let start;
  let end;

  if (range === 'last_7_days') {
    start = addDays(today, -6);
    end = addDays(today, 1);
  } else if (range === 'this_month') {
    start = startOfMonth(today);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  } else if (range === 'previous_month') {
    end = startOfMonth(today);
    start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
  } else {
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start = addDays(today, diff);
    end = addDays(start, 7);
  }

  const rows = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lt: end },
        status: { $nin: CANCELLED_STATUSES },
        $or: [
          { status: { $in: VALID_SALE_STATUSES } },
          { 'payment.status': { $in: ['paid'] } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $ifNull: [
              '$total',
              {
                $add: [
                  { $ifNull: ['$subtotal', 0] },
                  { $ifNull: ['$shipping', 0] },
                  { $ifNull: ['$taxes.iva.amount', 0] },
                ],
              },
            ],
          },
        },
      },
    },
  ]);

  return Math.round(toNumber(rows?.[0]?.total, 0));
}

function assertArray(name, value) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} no es un arreglo`);
  }
}

function assertFiniteNumber(name, value) {
  if (!Number.isFinite(Number(value))) {
    throw new Error(`${name} no es numerico: ${value}`);
  }
}

function validateKpis(summary) {
  assertArray('kpis', summary.kpis);

  const requiredKpis = ['income', 'new-orders', 'active-carts', 'favorites', 'low-stock'];
  const ids = new Set(summary.kpis.map((kpi) => kpi.id));

  requiredKpis.forEach((id) => {
    if (!ids.has(id)) {
      throw new Error(`Falta KPI obligatorio: ${id}`);
    }
  });

  summary.kpis.forEach((kpi) => {
    if (!kpi.title) throw new Error(`KPI sin titulo: ${kpi.id}`);
    if (typeof kpi.value === 'undefined') throw new Error(`KPI sin valor: ${kpi.id}`);
  });
}

async function testDashboardSummary() {
  const summary = await callController('getDashboardSummary', getDashboardSummary);

  validateKpis(summary);
  ok('Dashboard principal responde con KPIs obligatorios');

  assertArray('salesChartData', summary.salesChartData);
  if (summary.salesChartData.length !== 7) {
    throw new Error(`salesChartData debe traer 7 puntos, recibio ${summary.salesChartData.length}`);
  }
  summary.salesChartData.forEach((point, index) => {
    if (!point.label) throw new Error(`Punto de ventas ${index} sin label`);
    assertFiniteNumber(`Punto de ventas ${index}`, point.value);
  });
  ok('Grafica principal trae 7 puntos numericos');

  assertArray('topProducts', summary.topProducts);
  if (summary.topProducts.length > 3) {
    throw new Error('topProducts no debe traer mas de 3 productos');
  }
  ok('Top productos principal responde correctamente');

  assertArray('alerts', summary.alerts);
  ok('Alertas del dashboard responden como arreglo');

  assertArray('inventoryByBranch', summary.inventoryByBranch);
  const expectedBranches = await getInventoryBranchExpectedCount();
  if (summary.inventoryByBranch.length !== expectedBranches) {
    warn(`Inventario por sede muestra ${summary.inventoryByBranch.length}, esperado ${expectedBranches}. Revisar datos si no coincide.`);
  } else {
    ok('Inventario por sede coincide con la base');
  }

  assertArray('recentOrders', summary.recentOrders);
  const expectedRecent = await getRecentOrdersExpectedCount();
  if (summary.recentOrders.length !== expectedRecent) {
    warn(`Ordenes recientes muestra ${summary.recentOrders.length}, esperado ${expectedRecent}.`);
  } else {
    ok('Ordenes recientes coincide con el limite esperado');
  }

  if (!summary.monthlyGoal || typeof summary.monthlyGoal !== 'object') {
    throw new Error('monthlyGoal no existe o no es objeto');
  }
  assertFiniteNumber('monthlyGoal.targetAmount', summary.monthlyGoal.targetAmount);
  assertFiniteNumber('monthlyGoal.currentAmount', summary.monthlyGoal.currentAmount);
  ok('Meta mensual viene en el resumen principal');

  const expectedMonthSales = await getMonthSalesExpected();
  const diff = Math.abs(toNumber(summary.monthlyGoal.currentAmount, 0) - expectedMonthSales);
  if (diff > 1) {
    fail(
      'Ventas del mes no coinciden con ordenes reales',
      `dashboard=${summary.monthlyGoal.currentAmount} esperado=${expectedMonthSales}`
    );
  } else {
    ok('Ventas del mes coinciden con ordenes reales');
  }

  const expectedLowStock = await getLowStockExpectedCount();
  const lowStockKpi = summary.kpis.find((kpi) => kpi.id === 'low-stock');
  const dashboardLowStock = parseMoney(lowStockKpi?.value);

  if (dashboardLowStock !== expectedLowStock) {
    fail('Stock bajo no coincide con inventario real', `dashboard=${dashboardLowStock} esperado=${expectedLowStock}`);
  } else {
    ok('Stock bajo coincide con inventario real');
  }

  if (!summary.totals || typeof summary.totals !== 'object') {
    throw new Error('totals no existe o no es objeto');
  }

  ['products', 'branches', 'currentSales', 'monthSales', 'activeCarts', 'favorites'].forEach((key) => {
    assertFiniteNumber(`totals.${key}`, summary.totals[key]);
  });
  ok('Totales principales son numericos');

  if (!summary.totals.orderStatusBreakdown || typeof summary.totals.orderStatusBreakdown !== 'object') {
    throw new Error('orderStatusBreakdown no existe');
  }
  ok('Resumen por estados de orden existe');

  if (!Object.prototype.hasOwnProperty.call(summary.totals, 'posSales')) {
    warn('Dashboard aun no expone ventas POS vs Web en totals. Pendiente para cierre visual/gerencial.');
  }

  if (!Object.prototype.hasOwnProperty.call(summary.totals, 'cashSummary')) {
    warn('Dashboard aun no expone resumen de caja. Pendiente integrar caja/POS al dashboard.');
  }
}

async function testDashboardSales() {
  const ranges = ['this_week', 'last_7_days', 'this_month', 'previous_month'];

  for (const range of ranges) {
    const sales = await callController(`getDashboardSales:${range}`, getDashboardSales, {
      query: { range, compare: 'true' },
    });

    if (sales.range !== range) {
      throw new Error(`Rango devuelto incorrecto. Esperado ${range}, recibio ${sales.range}`);
    }

    assertArray(`chartData ${range}`, sales.chartData);
    assertArray(`comparisonChartData ${range}`, sales.comparisonChartData);
    assertArray(`topProducts ${range}`, sales.topProducts);

    sales.chartData.forEach((point, index) => {
      if (!point.label) throw new Error(`chartData ${range}[${index}] sin label`);
      assertFiniteNumber(`chartData ${range}[${index}].value`, point.value);
    });

    const dashboardSales = toNumber(sales.summary?.currentSales, 0);
    const expectedSales = await getSalesExpectedByRange(range);
    const diff = Math.abs(dashboardSales - expectedSales);

    if (diff > 1) {
      fail(`Ventas ${range} no coinciden con ordenes reales`, `dashboard=${dashboardSales} esperado=${expectedSales}`);
    } else {
      ok(`Ventas ${range} coinciden con ordenes reales`);
    }
  }

  ok('Dashboard sales responde todos los rangos con comparacion');
}

async function testDashboardGoal() {
  const periodKey = getMonthPeriodKey();
  const query = {
    metric: 'monthly_revenue',
    periodType: 'month',
    periodKey,
  };

  const originalGoal = await DashboardGoal.findOne(query).lean();

  try {
    const goal = await callController('getDashboardGoal', getDashboardGoal, {
      query: { periodKey },
    });

    assertFiniteNumber('goal.targetAmount', goal.targetAmount);
    assertFiniteNumber('goal.currentAmount', goal.currentAmount);
    ok('Consultar meta mensual funciona');

    const nextTarget = Math.max(100000, toNumber(goal.targetAmount, 0) + 1000);

    const updatedGoal = await callController('updateDashboardGoal', updateDashboardGoal, {
      query: { periodKey },
      body: {
        periodKey,
        targetAmount: nextTarget,
        title: 'Meta de ingresos prueba dashboard',
        notes: 'Prueba automatica temporal. Se restaura al finalizar.',
        currency: 'COP',
      },
    });

    if (toNumber(updatedGoal.targetAmount, 0) !== nextTarget) {
      throw new Error(`Meta actualizada incorrecta: ${updatedGoal.targetAmount} esperado ${nextTarget}`);
    }

    ok('Actualizar meta mensual funciona');
  } finally {
    if (originalGoal) {
      await DashboardGoal.replaceOne({ _id: originalGoal._id }, originalGoal, { upsert: true });
      ok('Meta mensual restaurada al valor original');
    } else {
      await DashboardGoal.deleteOne(query);
      ok('Meta mensual temporal eliminada');
    }
  }
}

async function testDatabaseBase() {
  const [orders, products, branches, inventoryRows] = await Promise.all([
    Order.countDocuments({}),
    Product.countDocuments({}),
    Branch.countDocuments({ deletedAt: null, active: true }),
    InventoryStock.countDocuments({ active: true, deletedAt: null }),
  ]);

  console.log(`Base actual: ordenes=${orders} | productos=${products} | sedes=${branches} | inventario=${inventoryRows}`);

  if (orders > 0) ok('Existen ordenes para alimentar dashboard');
  else warn('No hay ordenes registradas; el dashboard cargara pero con metricas en cero.');

  if (products > 0) ok('Existen productos para alimentar dashboard');
  else warn('No hay productos registrados; top productos e inventario pueden salir vacios.');

  if (branches > 0) ok('Existen sedes activas para dashboard');
  else warn('No hay sedes activas; inventario por sede puede salir incompleto.');

  if (inventoryRows > 0) ok('Existen registros InventoryStock para dashboard');
  else warn('No hay InventoryStock activo; dashboard usara fallback de Product.stock.');
}

async function main() {
  console.log('\n=== Prueba general Dashboard Administrativo ===');
  console.log(`Run ID: ${Math.random().toString(36).slice(2, 9).toUpperCase()}`);

  await connect();
  ok('Conexion a MongoDB activa');

  await testDatabaseBase();
  await testDashboardSummary();
  await testDashboardSales();
  await testDashboardGoal();

  console.log('\n=== Resultado final ===');
  console.log(`OK: ${results.ok}`);
  console.log(`WARN: ${results.warn}`);
  console.log(`FAIL: ${results.fail}`);

  if (results.fail > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    fail('Error inesperado en prueba Dashboard', error.message);
    console.error(error);
    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
