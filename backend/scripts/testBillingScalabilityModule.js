// backend/scripts/testBillingScalabilityModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');
const billingService = require('../services/adminBillingService');
const {
  buildCreditNotesPaginationPipeline,
  buildInvoiceSummaryPipeline,
  buildPendingOrdersCountPipeline,
  buildPendingOrdersPaginationPipeline,
} = require('../services/adminBillingAggregationService');
const {
  buildBillingReportCountPipeline,
  buildBillingReportPipeline,
  buildBillingReportRowsPipeline,
} = require('../services/adminBillingReportAggregationService');

const results = { ok: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

function findStage(pipeline, operator) {
  return pipeline.find((stage) => stage && stage[operator]);
}

function validateCreditNotePipeline() {
  const pipeline = buildCreditNotesPaginationPipeline({
    invoiceFilter: { 'creditNotes.0': { $exists: true } },
    status: 'validated',
    type: 'partial',
    skip: 40,
    limit: 20,
  });
  const unwind = findStage(pipeline, '$unwind');
  const facet = findStage(pipeline, '$facet')?.$facet;
  const initialMatch = pipeline[0]?.$match;

  assert(
    initialMatch?.$and?.some((condition) => condition.creditNotes?.$elemMatch),
    'Los filtros no aprovechan el índice multiclave antes de $unwind.'
  );
  assert(unwind?.$unwind?.path === '$creditNotes', 'Notas crédito no se separan dentro de MongoDB.');
  assert(facet, 'Notas crédito no usan $facet para paginar y contar en una consulta.');
  assert(
    facet.rows.some((stage) => stage.$skip === 40) &&
      facet.rows.some((stage) => stage.$limit === 20),
    'La paginación de notas crédito no se ejecuta en MongoDB.'
  );
  assert(
    pipeline.some((stage) => stage.$match?._billingCreditNoteStatus === 'validated'),
    'El estado de nota crédito no se filtra dentro de MongoDB.'
  );

  ok('Notas crédito usan $unwind, filtros y paginación en MongoDB');
}

function validatePendingOrdersPipeline() {
  const pipeline = buildPendingOrdersPaginationPipeline({
    orderFilter: { status: 'paid' },
    invoiceCollectionName: 'electronicinvoices',
    skip: 20,
    limit: 10,
  });
  const lookup = findStage(pipeline, '$lookup')?.$lookup;
  const facet = findStage(pipeline, '$facet')?.$facet;
  const countPipeline = buildPendingOrdersCountPipeline({
    orderFilter: { status: 'paid' },
    invoiceCollectionName: 'electronicinvoices',
  });

  assert(lookup?.from === 'electronicinvoices', 'Órdenes pendientes no consultan ElectronicInvoice con $lookup.');
  assert(
    lookup.pipeline?.some((stage) => stage.$limit === 1),
    '$lookup no limita la coincidencia a una factura.'
  );
  assert(
    pipeline.some((stage) => stage.$match?.['_billingInvoiceMatch.0']?.$exists === false),
    'No se excluyen dentro de MongoDB las órdenes ya facturadas.'
  );
  assert(
    facet?.rows?.some((stage) => stage.$skip === 20) &&
      facet?.rows?.some((stage) => stage.$limit === 10),
    'Órdenes pendientes no se paginan dentro de MongoDB.'
  );
  assert(
    findStage(countPipeline, '$count')?.$count === 'pending',
    'El resumen no cuenta pendientes dentro de MongoDB.'
  );

  ok('Órdenes pendientes usan $lookup indexado, conteo y paginación en MongoDB');
}

function validateSummaryPipeline() {
  const pipeline = buildInvoiceSummaryPipeline();
  const group = findStage(pipeline, '$group')?.$group;

  ['emitted', 'validated', 'errors', 'creditNotes'].forEach((field) => {
    assert(group?.[field], `El resumen agregado no calcula ${field}.`);
  });
  assert(
    JSON.stringify(group).includes('"$size"'),
    'El conteo de notas crédito no se resuelve en MongoDB.'
  );
  assert(
    JSON.stringify(group).includes('$dianResponse.code'),
    'El resumen agregado perdió el estado histórico de la DIAN.'
  );

  ok('Resumen calcula documentos, validaciones, errores y notas con $group');
}

function reportFilters() {
  return {
    from: '2026-07-01',
    to: '2026-07-31',
    fromDate: new Date('2026-07-01T05:00:00.000Z'),
    toExclusive: new Date('2026-08-01T05:00:00.000Z'),
    type: 'all',
    status: 'all',
  };
}

function validateReportAggregationPipeline() {
  const args = {
    filters: reportFilters(),
    orderCollectionName: 'orders',
  };
  const report = buildBillingReportPipeline({ ...args, rowLimit: 30 });
  const count = buildBillingReportCountPipeline(args);
  const rows = buildBillingReportRowsPipeline(args);
  const lookup = findStage(report, '$lookup')?.$lookup;
  const facet = findStage(report, '$facet')?.$facet;

  assert(lookup?.from === 'orders', 'Reportes no unen órdenes dentro de MongoDB.');
  assert(
    lookup.pipeline?.some((stage) => stage.$limit === 1),
    'El $lookup de reportes no limita la orden relacionada.'
  );
  assert(
    report.some((stage) => stage.$unwind === '$_billingDocuments'),
    'Facturas y notas crédito no se normalizan con $unwind.'
  );
  ['metrics', 'statuses', 'paymentMethods', 'channels', 'daily', 'rows'].forEach((key) => {
    assert(facet?.[key], `El $facet del reporte no calcula ${key}.`);
  });
  assert(
    facet.rows.some((stage) => stage.$limit === 30),
    'La pantalla no limita sus filas dentro de MongoDB.'
  );
  assert(
    findStage(count, '$count')?.$count === 'totalRows',
    'La exportación no cuenta sus filas dentro de MongoDB.'
  );
  assert(
    findStage(rows, '$sort') && findStage(rows, '$project'),
    'El cursor CSV no recibe filas ordenadas y proyectadas por MongoDB.'
  );

  ok('Reportes calculan métricas, desgloses, límite y conteo con agregaciones');
}

function validateReportStreamingSource() {
  const service = read('backend/services/adminBillingReportService.js');
  const aggregation = read('backend/services/adminBillingReportAggregationService.js');
  const expressions = read('backend/services/billingReports/reportAggregationExpressions.js');
  const stages = read('backend/services/billingReports/reportAggregationStages.js');
  const routes = read('backend/routes/adminBilling.js');
  const model = read('backend/models/ElectronicInvoice.js');
  const exportStart = routes.indexOf("'/reports/export'");
  const exportEnd = routes.indexOf('router.post(', exportStart);
  const exportRoute = routes.slice(exportStart, exportEnd);

  [
    'ElectronicInvoice.find(',
    'Order.find(',
    'Buffer.from(',
    'buildBillingReport(params, { allRows: true })',
  ].forEach((unsafePattern) => {
    assert(
      !service.includes(unsafePattern),
      `Regresó una carga completa en reportes: ${unsafePattern}`
    );
  });
  [
    'REPORT_CSV_BATCH_SIZE',
    'createReportRowsCursor',
    'for await (const rawRow of cursor)',
    "once(writable, 'drain')",
    'allowDiskUse(true)',
    'maxTimeMS',
  ].forEach((expected) => {
    assert(
      `${service}\n${aggregation}`.includes(expected),
      `Falta control de reporte escalable: ${expected}`
    );
  });
  assert(
    !exportRoute.includes("'Content-Length'") &&
      exportRoute.includes('await result.streamTo(res)'),
    'La ruta CSV volvió a exigir un búfer completo.'
  );
  [
    'billing_report_generated_at',
    'billing_report_accepted_at',
    'billing_report_provider_validated_at',
    'billing_report_credit_note_created_at',
    'billing_report_credit_note_validated_at',
  ].forEach((indexName) => {
    assert(model.includes(indexName), `Falta índice fiscal ${indexName}.`);
  });
  [
    ['servicio', service],
    ['composición', aggregation],
    ['expresiones', expressions],
    ['etapas', stages],
  ].forEach(([label, source]) => {
    assert(
      source.split(/\r?\n/).length <= 500,
      `El módulo de ${label} volvió a ser monolítico.`
    );
  });

  ok('CSV usa módulos pequeños, lotes e índices dedicados de fechas fiscales');
}

function validateNoMassCollectionLoads() {
  const service = read('backend/services/adminBillingService.js');
  const aggregation = read('backend/services/adminBillingAggregationService.js');
  const model = read('backend/models/ElectronicInvoice.js');

  [
    "ElectronicInvoice.find(invoiceFilter)",
    "ElectronicInvoice.distinct('orderId'",
    'ElectronicInvoice.find({}).lean()',
  ].forEach((unsafePattern) => {
    assert(
      !service.includes(unsafePattern),
      `Regresó una carga masiva en memoria: ${unsafePattern}`
    );
  });
  [
    'buildCreditNotesPaginationPipeline',
    'buildPendingOrdersPaginationPipeline',
    'buildInvoiceSummaryPipeline',
    'allowDiskUse: true',
    'maxTimeMS',
  ].forEach((expected) => {
    assert(
      `${service}\n${aggregation}`.includes(expected),
      `Falta control de escalabilidad: ${expected}`
    );
  });
  assert(
    model.includes('billing_credit_notes_status_type_date'),
    'Falta índice compuesto para filtros de notas crédito.'
  );

  ok('No existen cargas completas de facturas ni listas globales de orderId en Node');
}

async function validateRuntimeContracts() {
  const originals = {
    invoiceAggregate: ElectronicInvoice.aggregate,
    invoiceFind: ElectronicInvoice.find,
    invoiceDistinct: ElectronicInvoice.distinct,
    orderAggregate: Order.aggregate,
    orderFind: Order.find,
    settingsFindOne: SiteSettings.findOne,
  };
  const captured = {
    invoices: [],
    orders: [],
  };

  ElectronicInvoice.find = () => {
    throw new Error('No se permite ElectronicInvoice.find en estas lecturas.');
  };
  ElectronicInvoice.distinct = () => {
    throw new Error('No se permite ElectronicInvoice.distinct en estas lecturas.');
  };
  Order.find = () => {
    throw new Error('No se permite Order.find en estas lecturas.');
  };
  ElectronicInvoice.aggregate = async (pipeline) => {
    captured.invoices.push(pipeline);
    if (findStage(pipeline, '$group')) {
      return [{ emitted: 12, validated: 9, errors: 2, creditNotes: 3 }];
    }
    return [{
      total: 2,
      rows: [{
        _id: 'invoice-1',
        orderId: 'order-1',
        orderNumber: '1001',
        status: 'accepted',
        customer: { businessName: 'Cliente controlado' },
        provider: { name: 'factus', number: 'FE1001', isValidated: true },
        creditNotes: {
          _id: 'note-1',
          type: 'partial',
          status: 'validated',
          totalAmount: 59.5,
          provider: { number: 'NC1', isValidated: true },
          createdAt: new Date('2026-07-28T12:00:00.000Z'),
        },
        _billingCreditNoteIndex: 0,
        _billingCreditNotesCount: 2,
      }],
    }];
  };
  Order.aggregate = async (pipeline) => {
    captured.orders.push(pipeline);
    if (findStage(pipeline, '$count')) return [{ pending: 4 }];
    return [{
      total: 6,
      rows: [{
        _id: 'order-2',
        orderNumber: '1002',
        status: 'paid',
        customer: { name: 'Cliente pendiente' },
        payment: { status: 'paid', provider: 'wompi' },
        total: 119,
        items: [{ productId: 'product-1' }],
      }],
    }];
  };
  SiteSettings.findOne = () => ({
    lean: async () => ({}),
  });

  try {
    const creditNotes = await billingService.listCreditNotes({
      page: 2,
      limit: 1,
      status: 'validated',
      type: 'partial',
    });
    assert(creditNotes.total === 2, 'Cambió el total de notas crédito.');
    assert(creditNotes.rows.length === 1, 'Cambió la página de notas crédito.');
    assert(
      creditNotes.rows[0].invoice.creditNotesCount === 2,
      'Se perdió el conteo total de notas de la factura.'
    );

    const pendingOrders = await billingService.listPendingBillableOrders({
      page: 1,
      limit: 20,
    });
    assert(pendingOrders.total === 6, 'Cambió el total de órdenes pendientes.');
    assert(
      pendingOrders.rows[0].orderNumber === '1002',
      'Cambió la serialización de órdenes pendientes.'
    );

    const summary = await billingService.getBillingSummary();
    assert(
      summary.emitted === 12 &&
        summary.validated === 9 &&
        summary.errors === 2 &&
        summary.creditNotes === 3 &&
        summary.pending === 4,
      'Cambió el contrato del resumen de facturación.'
    );
    assert(
      captured.invoices.every((pipeline) =>
        pipeline.some((stage) => stage.$unwind || stage.$group)
      ),
      'Se ejecutó una consulta de facturas fuera de las agregaciones esperadas.'
    );
    assert(
      captured.orders.every((pipeline) => findStage(pipeline, '$lookup')),
      'Se ejecutó una consulta de pendientes sin $lookup.'
    );

    ok('Las respuestas públicas conservan filas, totales, páginas y métricas');
  } finally {
    ElectronicInvoice.aggregate = originals.invoiceAggregate;
    ElectronicInvoice.find = originals.invoiceFind;
    ElectronicInvoice.distinct = originals.invoiceDistinct;
    Order.aggregate = originals.orderAggregate;
    Order.find = originals.orderFind;
    SiteSettings.findOne = originals.settingsFindOne;
  }
}

async function main() {
  console.log('\nValidando escalabilidad de Facturación...');

  [
    validateCreditNotePipeline,
    validatePendingOrdersPipeline,
    validateSummaryPipeline,
    validateReportAggregationPipeline,
    validateReportStreamingSource,
    validateNoMassCollectionLoads,
  ].forEach((step) => {
    try {
      step();
    } catch (error) {
      fail(step.name, error);
    }
  });

  try {
    await validateRuntimeContracts();
  } catch (error) {
    fail('validateRuntimeContracts', error);
  }

  console.log(
    `\nResumen escalabilidad Facturación -> OK: ${results.ok} FAIL: ${results.fail}`
  );
  if (results.fail > 0) process.exit(1);
}

main().catch((error) => {
  fail('Ejecución de escalabilidad', error);
  process.exit(1);
});
