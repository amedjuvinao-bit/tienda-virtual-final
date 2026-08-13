'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  buildAdminOrderFilter,
  buildOperationalViewCriteria,
  buildPagePipeline,
  buildSummaryPipeline,
  parseSort,
  queryAdminOrders,
} = require('../services/orderAdminQueryService');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const checks = [];
function ok(message) {
  checks.push(message);
  console.log(`OK  ${message}`);
}

async function main() {
  const routesSource = read('backend/routes/orders.js');
  const serviceSource = read('backend/services/orderAdminQueryService.js');
  const controllerSource = read('backend/controllers/orderAdminQueryController.js');
  const frontendSource = read('frontend/src/admin/OrdersAdmin.jsx');
  const hookSource = read(
    'frontend/src/admin/orders/hooks/useOrdersAdminQuery.js'
  );

  assert.ok(routesSource.includes("router.get('/admin', listAdminOrders)"));
  assert.ok(routesSource.includes("require('../controllers/orderAdminQueryController')"));
  assert.ok(controllerSource.includes('queryAdminOrders(req)'));
  assert.ok(!routesSource.includes('financialSummaryRows'));
  assert.ok(!routesSource.includes('summaryOrderIdsForInvoices'));
  ok('el listado administrativo salió del archivo monolítico de rutas');

  assert.ok(serviceSource.includes('$lookup'));
  assert.ok(serviceSource.includes('allowDiskUse(true)'));
  assert.ok(!serviceSource.includes('countDocuments(filter)'));
  assert.ok(!serviceSource.includes("find(filter).select('_id')"));
  assert.ok(!serviceSource.includes("distinct('_id', filter)"));
  ok('facturación y métricas se resuelven en MongoDB sin cargar todos los IDs en Node');

  const ownerRequest = {
    adminRole: 'owner',
    query: {
      q: 'ORD.+',
      status: 'paid,cancelled',
      tags: 'VIP, mayorista',
      tagsMode: 'all',
      archived: '0',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    },
  };
  const filterResult = buildAdminOrderFilter(ownerRequest);
  assert.strictEqual(filterResult.ok, true);
  assert.strictEqual(filterResult.filter.$or[0].orderNumber.source, 'ORD\\.\\+');
  assert.deepStrictEqual(filterResult.filter.tags.$all, ['vip', 'mayorista']);
  assert.ok(filterResult.filter.status.$in.includes('canceled'));
  assert.ok(filterResult.filter.createdAt.$gte instanceof Date);
  assert.ok(filterResult.filter.createdAt.$lte instanceof Date);
  ok('búsqueda, fechas, estados y etiquetas conservan un contrato acotado');

  assert.deepStrictEqual(parseSort('total:asc'), { total: 1, _id: 1 });
  assert.deepStrictEqual(parseSort('campo_inseguro:desc'), {
    createdAt: -1,
    _id: -1,
  });
  ok('la paginación usa orden permitido y desempate estable por identificador');

  const invoiceModel = { collection: { name: 'electronicinvoices' } };
  const pagePipeline = buildPagePipeline({
    filter: { status: 'paid' },
    invoiceFilter: 'without_invoice',
    sort: parseSort('createdAt:desc'),
    skip: 20,
    limit: 20,
    ElectronicInvoiceModel: invoiceModel,
  });
  assert.ok(pagePipeline.some((stage) => stage.$lookup));
  assert.ok(
    pagePipeline.some(
      (stage) => stage.$match?.['_adminInvoices.0']?.$exists === false
    )
  );
  assert.ok(pagePipeline.some((stage) => stage.$skip === 20));
  assert.ok(pagePipeline.some((stage) => stage.$limit === 20));

  const summaryPipeline = buildSummaryPipeline({
    filter: {},
    invoiceFilter: 'all',
    ElectronicInvoiceModel: invoiceModel,
  });
  const summaryFacet = summaryPipeline.find((stage) => stage.$facet)?.$facet;
  const group = summaryFacet?.financial?.find((stage) => stage.$group)?.$group;
  assert.ok(group?.totalOrders);
  assert.ok(group?.withInvoiceOrders);
  assert.ok(group?.validatedInvoiceOrders);
  assert.ok(summaryFacet?.operational?.some((stage) => stage.$group));
  ok('página, totales financieros y estado DIAN tienen pipelines explícitos');

  assert.ok(buildOperationalViewCriteria('attention').$or);
  assert.strictEqual(buildOperationalViewCriteria('all'), null);
  ok('colas operativas y alertas logísticas se resuelven en MongoDB');

  const aggregateCalls = [];
  const fakeOrderModel = {
    aggregate(pipeline) {
      const isSummary = pipeline.some((stage) => stage.$facet);
      aggregateCalls.push({ pipeline, isSummary, allowDiskUse: false });
      const call = aggregateCalls[aggregateCalls.length - 1];
      const rows = isSummary
        ? [{
            financial: {
              totalOrders: 42,
              totalSales: 840000,
              pendingAmount: 120000,
              paidOrders: 7,
              pendingOrders: 2,
              cancelledOrders: 1,
              withInvoiceOrders: 30,
              validatedInvoiceOrders: 28,
              averageTicket: 120000,
            },
            operational: {
              total: 42,
              attention: 3,
              prepare: 5,
              transit: 2,
            },
          }]
        : [
            {
              _id: '64c000000000000000000001',
              orderNumber: 'ORD-ARCH-001',
              status: 'paid',
              total: 120000,
              items: [{ productId: '64c000000000000000000002', quantity: 2, price: 60000 }],
            },
          ];
      return {
        allowDiskUse(value) {
          call.allowDiskUse = value;
          return Promise.resolve(rows);
        },
      };
    },
  };

  const result = await queryAdminOrders(
    {
      adminRole: 'owner',
      query: { page: 2, limit: 20, sort: 'createdAt:-1' },
    },
    {
      OrderModel: fakeOrderModel,
      ElectronicInvoiceModel: invoiceModel,
    }
  );
  assert.strictEqual(aggregateCalls.length, 2);
  assert.ok(aggregateCalls.every((call) => call.allowDiskUse));
  assert.strictEqual(result.total, 42);
  assert.strictEqual(result.totalPages, 3);
  assert.strictEqual(result.financialSummary.withoutInvoiceOrders, 12);
  assert.strictEqual(result.financialSummary.validatedDianOrders, 28);
  assert.strictEqual(result.operationalSummary.attention, 3);
  assert.strictEqual(result.data[0].totalItems, 2);
  ok('la respuesta mantiene paginación, indicadores y campos derivados compatibles');

  aggregateCalls.length = 0;
  const pageOnly = await queryAdminOrders(
    {
      adminRole: 'owner',
      query: { page: 3, limit: 20, includeSummary: '0' },
    },
    {
      OrderModel: fakeOrderModel,
      ElectronicInvoiceModel: invoiceModel,
    }
  );
  assert.strictEqual(aggregateCalls.length, 1);
  assert.strictEqual(pageOnly.summaryIncluded, false);
  assert.strictEqual(pageOnly.financialSummary, undefined);
  ok('cambiar de página puede omitir el recálculo costoso de indicadores');

  assert.ok(frontendSource.includes('useOrdersAdminQuery'));
  assert.ok(!frontendSource.includes("api\n      .get('/api/orders/admin'"));
  assert.ok(hookSource.includes('inflightOrderQueries'));
  assert.ok(hookSource.includes('requestSequence.current'));
  assert.ok(hookSource.includes('includeSummary: includeSummary ? 1 : 0'));
  ok('React deduplica solicitudes y descarta respuestas obsoletas');

  const orderModelSource = read('backend/models/Order.js');
  assert.ok(orderModelSource.includes('orders_admin_branch_status_date'));
  assert.ok(orderModelSource.includes('orders_admin_allocation_status_date'));
  assert.ok(orderModelSource.includes('orders_admin_archive_status_date'));
  ok('los filtros operativos principales tienen índices compuestos dedicados');

  console.log(
    `\nArquitectura y rendimiento de Órdenes: ${checks.length}/${checks.length} controles superados.`
  );
}

main().catch((error) => {
  console.error('\nFALLO arquitectura de consultas de Órdenes:', error);
  process.exitCode = 1;
});
