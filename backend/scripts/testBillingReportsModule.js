// backend/scripts/testBillingReportsModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const { Writable } = require('stream');
const { readBillingFrontendSource } = require('./lib/readBillingFrontendSource');

const BACKEND_ROOT = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(BACKEND_ROOT, '..');
const serviceFile = fs.readFileSync(path.join(BACKEND_ROOT, 'services', 'adminBillingReportService.js'), 'utf8');
const aggregationFile = fs.readFileSync(
  path.join(BACKEND_ROOT, 'services', 'adminBillingReportAggregationService.js'),
  'utf8'
);
const aggregationExpressionsFile = fs.readFileSync(
  path.join(BACKEND_ROOT, 'services', 'billingReports', 'reportAggregationExpressions.js'),
  'utf8'
);
const aggregationStagesFile = fs.readFileSync(
  path.join(BACKEND_ROOT, 'services', 'billingReports', 'reportAggregationStages.js'),
  'utf8'
);
const reportBackendSource = [
  serviceFile,
  aggregationFile,
  aggregationExpressionsFile,
  aggregationStagesFile,
].join('\n');
const routesFile = fs.readFileSync(path.join(BACKEND_ROOT, 'routes', 'adminBilling.js'), 'utf8');
const reportExportStart = routesFile.indexOf("'/reports/export'");
const reportExportEnd = routesFile.indexOf('router.post(', reportExportStart);
const reportExportRouteFile = routesFile.slice(reportExportStart, reportExportEnd);
const apiFile = fs.readFileSync(path.join(PROJECT_ROOT, 'frontend', 'src', 'admin', 'billing', 'api', 'adminBillingApi.js'), 'utf8');
const pageFile = readBillingFrontendSource();
const packageFile = fs.readFileSync(path.join(BACKEND_ROOT, 'package.json'), 'utf8');
const closureFile = fs.readFileSync(path.join(BACKEND_ROOT, 'scripts', 'testBillingModuleClosure.js'), 'utf8');
const ElectronicInvoice = require(path.join(BACKEND_ROOT, 'models', 'ElectronicInvoice'));
const Order = require(path.join(BACKEND_ROOT, 'models', 'Order'));
const reportService = require(path.join(BACKEND_ROOT, 'services', 'adminBillingReportService'));

const results = { ok: 0, warn: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
}

function assertIncludes(content, needles, message) {
  const missing = needles.filter((needle) => !content.includes(needle));
  if (missing.length) {
    fail(`${message}. Falta: ${missing.join(', ')}`);
    return false;
  }
  ok(message);
  return true;
}

function assertNotIncludes(content, needles, message) {
  const found = needles.filter((needle) => content.includes(needle));
  if (found.length) {
    fail(`${message}. No debe contener: ${found.join(', ')}`);
    return false;
  }
  ok(message);
  return true;
}

function validateSources() {
  assertIncludes(
    reportBackendSource,
    [
      "require('../models/ElectronicInvoice')",
      "require('../models/Order')",
      'ElectronicInvoice.aggregate(pipeline)',
      '$lookup',
      "orderCollectionName: Order.collection?.name || 'orders'",
    ],
    'Reportes reutiliza ElectronicInvoice y Order mediante agregaciones'
  );
  assertNotIncludes(
    reportBackendSource,
    ['mongoose.Schema', "model('BillingReport'", 'new BillingReport'],
    'Reportes no crea modelos ni duplica documentos fiscales'
  );
  assertNotIncludes(
    serviceFile,
    ['ElectronicInvoice.find(', 'Order.find(', 'buildBillingReport(params, { allRows: true })'],
    'Reportes no carga facturas, órdenes ni CSV completos en memoria'
  );
}

function validatePeriodsAndTotals() {
  assertIncludes(
    reportBackendSource,
    [
      "REPORT_TIME_ZONE = 'America/Bogota'",
      'MAX_REPORT_DAYS = 366',
      "timezone: 'America/Bogota'",
      "to: 'date'",
      'creditNotes.provider.validatedAt',
    ],
    'Períodos se convierten y filtran en MongoDB con zona horaria de Colombia'
  );
  assertIncludes(
    aggregationFile,
    [
      "metricGroupStage()",
      "$subtract: ['$invoiced', '$credited']",
      "$subtract: ['$invoiceTax', '$creditedTax']",
      "validCreditNote",
    ],
    'MongoDB suma documentos validados y descuenta notas crédito e IVA'
  );
}

function validateExport() {
  assertIncludes(
    serviceFile,
    [
      'prepareBillingReportCsv',
      'createReportRowsCursor',
      'REPORT_CSV_BATCH_SIZE',
      'for await (const rawRow of cursor)',
      "once(writable, 'drain')",
      '`\\uFEFF${CSV_HEADERS.map(csvCell).join(\';\')}`',
      "replace('.', ',')",
      "return /^[=+\\-@]/.test(text) ? `'${text}` : text",
    ],
    'CSV usa cursor, lotes, backpressure, BOM y protección de fórmulas'
  );
  assertIncludes(
    routesFile,
    [
      "'/reports'",
      "requirePermission('billing:view')",
      "'/reports/export'",
      "requirePermission('billing:download')",
      "'X-Billing-Report-Rows'",
      'await result.streamTo(res)',
    ],
    'Rutas de consulta y exportación están autenticadas por permisos existentes'
  );
  assertNotIncludes(
    reportExportRouteFile,
    ["'Content-Length'", 'res.send(result.buffer)'],
    'Ruta CSV transmite por partes sin exigir un búfer completo'
  );
}

function validateFrontend() {
  assertIncludes(
    apiFile,
    [
      'getBillingReport',
      "'/api/admin/billing/reports'",
      'downloadBillingReportCsv',
      "'/api/admin/billing/reports/export'",
      "responseType: 'blob'",
    ],
    'API frontend conecta reporte y exportación CSV'
  );
  assertIncludes(
    pageFile,
    [
      "id: 'reportes'",
      'function BillingReportsPanel()',
      'REPORT_STATUS_OPTIONS',
      'REPORT_TYPE_OPTIONS',
      'Total facturado',
      'Facturación neta',
      'IVA neto',
      'Documentos por estado',
      'Resultado por medio de pago',
      'Facturación neta por fecha',
      'Exportar CSV',
    ],
    'Pestaña Reportes muestra filtros, indicadores, desgloses y exportación'
  );
  assertIncludes(
    pageFile,
    [
      'aria-label="Secciones de facturación"',
      'flex min-w-max items-center gap-1.5',
      'shrink-0 items-center justify-center gap-1.5 whitespace-nowrap',
    ],
    'Navegación de Facturación conserva una sola línea y no recorta Configuración'
  );
  assertIncludes(
    pageFile,
    [
      'sm:grid-cols-2 xl:grid-cols-4',
      'Filtros del reporte',
      'Aplicar filtros',
      'xl:col-span-6',
      'featured icon={BarChart3}',
    ],
    'Reportes separa filtros y prioriza visualmente la facturación neta'
  );
  assertIncludes(
    pageFile,
    [
      'paymentMaximum',
      'dailyMaximum',
      'break-words font-black [overflow-wrap:anywhere]">{row.number}',
      'break-words font-black [overflow-wrap:anywhere]">{row.customerName}',
    ],
    'Estados, tendencias y detalle evitan textos cortados y desbordamientos'
  );
}

function validateRegistration() {
  const packageJson = JSON.parse(packageFile);
  if (packageJson?.scripts?.['test:billing-reports'] !== 'node scripts/testBillingReportsModule.js') {
    fail('Prueba de Reportes no está registrada en backend/package.json');
  } else {
    ok('Prueba de Reportes está registrada en backend/package.json');
  }

  assertIncludes(
    closureFile,
    ["['Reportes de Facturación', 'testBillingReportsModule.js']"],
    'Cierre integral incluye el bloque Reportes de Facturación'
  );
}

async function validateCalculatedReport() {
  const originalInvoiceAggregate = ElectronicInvoice.aggregate;
  const originalInvoiceFind = ElectronicInvoice.find;
  const originalOrderFind = Order.find;
  const controls = {
    allowDiskUse: 0,
    maxTimeMS: [],
    batchSizes: [],
    cursorClosed: 0,
  };
  const rows = [
    {
      id: 'invoice-3',
      documentType: 'invoice',
      date: new Date('2026-07-18T05:00:00.000Z'),
      dateKey: '2026-07-18',
      number: 'FE1003',
      orderNumber: '1001',
      status: 'validated',
      validated: true,
      customer: { businessName: 'Cliente histórico' },
      channelKey: 'online',
      channel: 'Tienda web',
      paymentMethodKey: 'payu',
      paymentMethod: 'PayU',
      subtotal: 50,
      productDiscount: 0,
      shippingDiscount: 0,
      totalDiscount: 0,
      shipping: 0,
      taxableBase: 50,
      taxAmount: 9.5,
      total: 59.5,
    },
    {
      id: 'invoice-2',
      documentType: 'invoice',
      date: new Date('2026-07-15T15:00:00.000Z'),
      dateKey: '2026-07-15',
      number: 'Sin número',
      orderNumber: '1002',
      status: 'failed',
      validated: false,
      customer: { businessName: 'Cliente fallido' },
      channelKey: 'pos',
      channel: 'POS',
      paymentMethodKey: 'cash',
      paymentMethod: 'Efectivo',
      subtotal: 200,
      productDiscount: 0,
      shippingDiscount: 0,
      totalDiscount: 0,
      shipping: 0,
      taxableBase: 200,
      taxAmount: 38,
      total: 238,
    },
    {
      id: 'note-1',
      documentType: 'credit_note',
      date: new Date('2026-07-12T15:00:00.000Z'),
      dateKey: '2026-07-12',
      number: 'NC1',
      referenceNumber: 'FE1001',
      orderNumber: '1001',
      status: 'validated',
      validated: true,
      customer: { businessName: '=Cliente prueba', documentNumber: '123', email: 'cliente@example.com' },
      channelKey: 'online',
      channel: 'Tienda web',
      paymentMethodKey: 'wompi',
      paymentMethod: 'Wompi',
      subtotal: 50,
      productDiscount: 0,
      shippingDiscount: 0,
      totalDiscount: 0,
      shipping: 0,
      taxableBase: 50,
      taxAmount: 9.5,
      total: 59.5,
    },
    {
      id: 'invoice-1',
      documentType: 'invoice',
      date: new Date('2026-07-10T15:00:00.000Z'),
      dateKey: '2026-07-10',
      number: 'FE1001',
      orderNumber: '1001',
      status: 'validated',
      validated: true,
      customer: { businessName: '=Cliente prueba', documentNumber: '123', email: 'cliente@example.com' },
      channelKey: 'online',
      channel: 'Tienda web',
      paymentMethodKey: 'wompi',
      paymentMethod: 'Wompi',
      subtotal: 110,
      productDiscount: 10,
      shippingDiscount: 0,
      totalDiscount: 10,
      shipping: 0,
      taxableBase: 100,
      taxAmount: 19,
      total: 119,
    },
  ];

  function calculateMetrics(selectedRows) {
    const invoices = selectedRows.filter((row) => row.documentType === 'invoice');
    const creditNotes = selectedRows.filter((row) => row.documentType === 'credit_note');
    const validInvoices = invoices.filter((row) => row.validated);
    const validCreditNotes = creditNotes.filter((row) => row.validated);
    const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);
    const invoiced = sum(validInvoices.map((row) => row.total));
    const credited = sum(validCreditNotes.map((row) => row.total));
    const invoiceTax = sum(validInvoices.map((row) => row.taxAmount));
    const creditedTax = sum(validCreditNotes.map((row) => row.taxAmount));
    const invoiceBase = sum(validInvoices.map((row) => row.taxableBase));
    const creditedBase = sum(validCreditNotes.map((row) => row.taxableBase));

    return {
      documents: selectedRows.length,
      invoices: invoices.length,
      validatedInvoices: validInvoices.length,
      creditNotes: creditNotes.length,
      validatedCreditNotes: validCreditNotes.length,
      errors: selectedRows.filter((row) => ['rejected', 'failed', 'error'].includes(row.status)).length,
      invoiced,
      credited,
      net: invoiced - credited,
      discounts: sum(validInvoices.map((row) => row.totalDiscount)),
      shipping: sum(validInvoices.map((row) => row.shipping)),
      taxableBase: invoiceBase - creditedBase,
      invoiceTax,
      creditedTax,
      netTax: invoiceTax - creditedTax,
    };
  }

  function aggregateResult(pipeline) {
    const statusMatch = pipeline.find((stage) => stage?.$match?._billingStatus);
    const selectedRows = statusMatch
      ? rows.filter((row) => row.status === statusMatch.$match._billingStatus)
      : rows;
    const hasFacet = pipeline.some((stage) => stage.$facet);
    const hasCount = pipeline.some((stage) => stage.$count === 'totalRows');

    if (hasFacet) {
      return [{
        metrics: [calculateMetrics(selectedRows)],
        statuses: [],
        paymentMethods: [],
        channels: [],
        daily: [],
        rows: selectedRows.slice(0, 30),
      }];
    }
    if (hasCount) return [{ totalRows: selectedRows.length }];
    return selectedRows;
  }

  ElectronicInvoice.find = () => {
    throw new Error('El reporte no debe usar ElectronicInvoice.find.');
  };
  Order.find = () => {
    throw new Error('El reporte no debe usar Order.find.');
  };
  ElectronicInvoice.aggregate = (pipeline) => {
    const result = aggregateResult(pipeline);
    return {
      allowDiskUse(value) {
        if (value === true) controls.allowDiskUse += 1;
        return this;
      },
      option(options) {
        controls.maxTimeMS.push(options?.maxTimeMS);
        return this;
      },
      async exec() {
        return result;
      },
      cursor(options) {
        controls.batchSizes.push(options?.batchSize);
        return {
          async *[Symbol.asyncIterator]() {
            for (const row of result) yield row;
          },
          async close() {
            controls.cursorClosed += 1;
          },
        };
      },
    };
  };

  try {
    const report = await reportService.buildBillingReport({
      from: '2026-07-01',
      to: '2026-07-31',
      type: 'all',
      status: 'all',
    });
    const expected = {
      documents: 4,
      invoices: 3,
      creditNotes: 1,
      errors: 1,
      invoiced: 178.5,
      credited: 59.5,
      net: 119,
      netTax: 19,
    };
    const mismatches = Object.entries(expected).filter(([key, value]) => report?.metrics?.[key] !== value);
    if (mismatches.length) {
      fail(`Cálculo agregado del reporte no concilia: ${JSON.stringify(mismatches)}`);
    } else {
      ok('Cálculo agregado concilia facturas, errores, notas crédito, neto e IVA');
    }

    const filtered = await reportService.buildBillingReport({
      from: '2026-07-01',
      to: '2026-07-31',
      type: 'all',
      status: 'validated',
    });
    if (filtered.totalRows !== 3 || filtered.rows.some((row) => row.status !== 'validated')) {
      fail('Filtro validado no conserva exactamente las facturas y la nota crédito validadas');
    } else {
      ok('Filtros de estado se aplican dentro de MongoDB a facturas y notas crédito');
    }

    const csv = await reportService.prepareBillingReportCsv({
      from: '2026-07-01',
      to: '2026-07-31',
      type: 'all',
      status: 'all',
    });
    let csvText = '';
    const destination = new Writable({
      write(chunk, encoding, callback) {
        csvText += chunk.toString('utf8');
        callback();
      },
    });
    const written = await csv.streamTo(destination);
    destination.end();

    if (
      !csvText.startsWith('\uFEFFFecha;') ||
      !csvText.includes('Nota crédito') ||
      !csvText.includes("'=Cliente prueba") ||
      csv.totalRows !== 4 ||
      written !== 4
    ) {
      fail('Exportación CSV por cursor no contiene todos los documentos filtrados');
    } else {
      ok('Exportación por cursor incluye BOM, protección Excel y todos los documentos');
    }

    if (
      controls.allowDiskUse < 4 ||
      controls.maxTimeMS.some((value) => value !== 30_000) ||
      controls.batchSizes[0] !== 250 ||
      controls.cursorClosed !== 1
    ) {
      fail(`Controles de consulta o cursor incompletos: ${JSON.stringify(controls)}`);
    } else {
      ok('Agregaciones usan disco, timeout, lotes y cierre explícito del cursor');
    }
  } finally {
    ElectronicInvoice.aggregate = originalInvoiceAggregate;
    ElectronicInvoice.find = originalInvoiceFind;
    Order.find = originalOrderFind;
  }
}

async function main() {
  console.log('\nValidando Reportes de Facturación...');
  validateSources();
  validatePeriodsAndTotals();
  validateExport();
  validateFrontend();
  validateRegistration();
  await validateCalculatedReport();
  console.log(`\nResumen reportes facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
  if (results.fail > 0) process.exit(1);
}

main().catch((error) => {
  fail(error?.stack || error?.message || String(error));
  console.log(`\nResumen reportes facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
  process.exit(1);
});
