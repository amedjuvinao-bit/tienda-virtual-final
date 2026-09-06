'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const {
  resolveFinanceBranchAccess,
  resolveFinanceWriteBranch,
} = require('../services/adminFinanceAccessService');
const financeService = require('../services/adminFinanceService');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const { __test } = financeService;
let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs
    .readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8')
    .replace(/\r\n?/g, '\n');
}

function id() {
  return new mongoose.Types.ObjectId().toHexString();
}

function managerRequest(branchIds, extra = {}) {
  return {
    adminRole: 'manager',
    adminAuthType: 'db',
    adminBranches: branchIds.map((branchId) => ({ branch: branchId })),
    adminDefaultBranch: branchIds[0] || null,
    query: {},
    body: {},
    ...extra,
  };
}

function validateBranchAccess() {
  const branchA = id();
  const branchB = id();
  const branchC = id();
  const request = managerRequest([branchA, branchB]);

  const assigned = resolveFinanceBranchAccess(request);
  ok(
    'un usuario limitado consolida únicamente sus sedes asignadas',
    assigned.mode === 'assigned' &&
      assigned.branchIds.length === 2 &&
      assigned.branchIds.includes(branchA) &&
      assigned.branchIds.includes(branchB)
  );

  const selected = resolveFinanceBranchAccess(request, {
    requestedBranchId: branchB,
  });
  ok(
    'el filtro de sede conserva una sede autorizada',
    selected.mode === 'single' && selected.branchIds[0] === branchB
  );

  assert.throws(
    () => resolveFinanceBranchAccess(request, { requestedBranchId: branchC }),
    (error) => error?.code === 'FINANCE_BRANCH_FORBIDDEN' && error?.statusCode === 403
  );
  ok('una sede ajena es rechazada aunque se envíe manualmente');

  assert.throws(
    () => resolveFinanceBranchAccess(request, { requestedBranchId: 'no-valida' }),
    (error) => error?.code === 'FINANCE_BRANCH_INVALID' && error?.statusCode === 400
  );
  ok('un identificador de sede inválido se rechaza');

  const write = resolveFinanceWriteBranch(request, '');
  ok('un gasto sin sede usa la sede predeterminada autorizada', write.branchId === branchA);

  const owner = resolveFinanceBranchAccess({
    adminRole: 'owner',
    adminAuthType: 'db',
    adminBranches: [],
    query: {},
    body: {},
  });
  ok('el propietario puede consolidar todas las sedes', owner.mode === 'all' && owner.branchIds === null);
}

function makeOrder() {
  const orderId = id();
  const productId = id();
  return {
    _id: orderId,
    orderNumber: 'FIN-STAGE0-001',
    status: 'paid',
    source: 'pos',
    channel: 'physical_store',
    saleType: 'pos_sale',
    total: 100000,
    subtotal: 100000,
    shipping: 0,
    discount: { amount: 0 },
    payment: {
      status: 'paid',
      method: 'mixed',
      paidAt: new Date('2026-09-06T15:00:00.000Z'),
      splitPayments: [
        { method: 'cash', methodLabel: 'Efectivo', amount: 40000 },
        { method: 'card', methodLabel: 'Tarjeta', amount: 60000 },
      ],
    },
    items: [
      {
        _id: id(),
        product: productId,
        productId,
        title: 'Producto financiero',
        variantKey: 'default__default',
        quantity: 1,
        price: 100000,
      },
    ],
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
  };
}

function validateFinancialFacts() {
  const order = makeOrder();
  const gross = __test.summarizeSalesFromOrders([order]);
  const paymentMap = new Map(gross.byPaymentMethod.map((row) => [row.key, row.amount]));
  ok('un pago mixto separa efectivo', paymentMap.get('cash') === 40000);
  ok('un pago mixto separa tarjeta', paymentMap.get('card') === 60000);
  ok(
    'la venta usa la fecha real de pago y no la fecha de creación',
    gross.daily[0]?.date === '2026-09-06'
  );

  const correctionsByOrder = new Map([
    [
      String(order._id),
      {
        order,
        orderId: String(order._id),
        amount: 30000,
        events: [
          {
            kind: 'refund',
            amount: 30000,
            date: new Date('2026-09-06T18:00:00.000Z'),
            items: [],
          },
        ],
      },
    ],
  ]);
  const net = __test.applySalesCorrections(gross, {
    correctionsByOrder,
    ordersById: new Map([[String(order._id), order]]),
  });
  const netPayments = new Map(net.byPaymentMethod.map((row) => [row.key, row]));
  ok('el reporte conserva la venta bruta', net.grossRevenue === 100000);
  ok('el reporte separa las devoluciones', net.refunds === 30000);
  ok('el reporte calcula venta neta', net.revenue === 70000);
  ok(
    'la devolución de pago mixto se distribuye proporcionalmente',
    netPayments.get('cash')?.refunds === 12000 &&
      netPayments.get('card')?.refunds === 18000
  );

  const ledger = {
    exact: new Map([
      [
        __test.financeCostKey(order._id, order.items[0].productId, 'default__default'),
        { quantity: 1, totalCost: 42000 },
      ],
    ]),
    byProduct: new Map(),
  };
  const historical = __test.resolveItemCost(
    { averageCost: 999000, cost: 999000, variants: [] },
    order.items[0],
    order,
    ledger
  );
  ok(
    'el costo histórico prevalece sobre el costo actual del producto',
    historical.unitCost === 42000 && historical.source === 'inventory_movement'
  );

  const filter = __test.buildPaidOrdersFilter({
    range: 'this_month',
    branchIds: [id()],
  });
  ok('el estado reembolsado conserva el hecho de venta original', !filter.status.$nin.includes('refunded'));
  ok(
    'una venta POS ya no se presume pagada solo por su origen',
    !JSON.stringify(filter).includes('pos_sale')
  );
  ok('la consulta financiera aplica el alcance por sedes', Array.isArray(filter.branch.$in));
}

function validateApiHardening() {
  const routes = read('backend/routes/adminFinance.js');
  const api = read('frontend/src/admin/finance/api/financeApi.js');
  const page = read('frontend/src/admin/finance/AdminFinancePage.jsx');
  const movement = read('backend/services/inventoryReservation/inventoryMovement.js');
  const workflow = read('.github/workflows/finance-ci.yml');

  ok(
    'los errores internos no se exponen al navegador',
    routes.includes("status >= 500 ? fallback")
  );
  ok(
    'las respuestas financieras deshabilitan almacenamiento en caché',
    routes.includes("Cache-Control', 'private, no-store")
  );
  ok(
    'las ventas web congelan el costo en el movimiento de inventario',
    movement.includes('resolveVariantCommercialSnapshot') &&
      movement.includes('totalCost: unitCost * quantity')
  );
  ok(
    'el selector consulta solo las sedes autorizadas por Finanzas',
    routes.includes("router.get(\n  '/branches'") &&
      api.includes("/api/admin/finance/branches") &&
      !api.includes("/api/admin/branches")
  );
  ok(
    'la interfaz oculta gastos y exportaciones sin el permiso correspondiente',
    page.includes("can('finance:expenses')") &&
      page.includes("can('finance:export')") &&
      page.includes('canManageExpenses ?') &&
      page.includes('canExport ?')
  );

  const expenseCreate = findAdminRoutePermission('POST', '/api/admin/finance/expenses');
  const expenseDelete = findAdminRoutePermission('DELETE', `/api/admin/finance/expenses/${id()}`);
  const exportRoute = findAdminRoutePermission('GET', '/api/admin/finance/export');
  ok('crear gastos exige finance:expenses y queda auditado', expenseCreate?.permission === 'finance:expenses' && expenseCreate?.audit === true);
  ok('anular gastos queda auditado como acción peligrosa', expenseDelete?.audit === true && expenseDelete?.danger === true);
  ok('exportar finanzas exige permiso propio y queda auditado', exportRoute?.permission === 'finance:export' && exportRoute?.audit === true);
  ok(
    'CI ejecuta los contratos estáticos, visuales y la integración Mongo aislada',
    workflow.includes('test:finance-level-plus-stage0') &&
      workflow.includes('test:finance-level-plus-stage0-integration') &&
      workflow.includes('finance_stage0_ci')
  );
}

function main() {
  validateBranchAccess();
  validateFinancialFacts();
  validateApiHardening();
  console.log(`\nEtapa 0 Finanzas validada: ${controls} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 0 Finanzas:', error);
  process.exitCode = 1;
}
