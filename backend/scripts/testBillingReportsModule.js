// backend/scripts/testBillingReportsModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(BACKEND_ROOT, '..');
const serviceFile = fs.readFileSync(path.join(BACKEND_ROOT, 'services', 'adminBillingReportService.js'), 'utf8');
const routesFile = fs.readFileSync(path.join(BACKEND_ROOT, 'routes', 'adminBilling.js'), 'utf8');
const apiFile = fs.readFileSync(path.join(PROJECT_ROOT, 'frontend', 'src', 'admin', 'billing', 'api', 'adminBillingApi.js'), 'utf8');
const pageFile = fs.readFileSync(path.join(PROJECT_ROOT, 'frontend', 'src', 'admin', 'billing', 'AdminBillingPage.jsx'), 'utf8');
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
    serviceFile,
    [
      "require('../models/ElectronicInvoice')",
      "require('../models/Order')",
      'ElectronicInvoice.find(candidateDateFilter(filters))',
      "select('orderNumber source channel saleType payment subtotal shipping total taxes discount pricing')",
    ],
    'Reportes reutiliza ElectronicInvoice y Order como fuentes únicas'
  );
  assertNotIncludes(
    serviceFile,
    ['mongoose.Schema', "model('BillingReport'", 'new BillingReport'],
    'Reportes no crea modelos ni duplica documentos fiscales'
  );
}

function validatePeriodsAndTotals() {
  assertIncludes(
    serviceFile,
    [
      "REPORT_TIME_ZONE = 'America/Bogota'",
      'MAX_REPORT_DAYS = 366',
      'getInvoiceDate(invoice)',
      'getCreditNoteDate(note)',
      'isInRange(getCreditNoteDate(note), filters)',
    ],
    'Períodos son válidos para Colombia y ubican cada nota en su fecha real'
  );
  assertIncludes(
    serviceFile,
    [
      'validInvoices.map((row) => row.total)',
      'validCreditNotes.map((row) => row.total)',
      'net: money(invoiced - credited)',
      'netTax: money(invoiceTax - creditedTax)',
    ],
    'Totales fiscales suman validados y descuentan notas crédito e IVA'
  );
}

function validateExport() {
  assertIncludes(
    serviceFile,
    [
      'buildBillingReport(params, { allRows: true })',
      "Buffer.from(`\\uFEFF${lines.join('\\r\\n')}`, 'utf8')",
      "replace('.', ',')",
      "return /^[=+\\-@]/.test(text) ? `'${text}` : text",
    ],
    'CSV respeta filtros, abre en Excel y bloquea fórmulas inyectadas'
  );
  assertIncludes(
    routesFile,
    [
      "'/reports'",
      "requirePermission('billing:view')",
      "'/reports/export'",
      "requirePermission('billing:download')",
      "'X-Billing-Report-Rows'",
    ],
    'Rutas de consulta y exportación están autenticadas por permisos existentes'
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
  const originalInvoiceFind = ElectronicInvoice.find;
  const originalOrderFind = Order.find;
  const invoices = [
    {
      _id: 'invoice-1',
      orderId: 'order-1',
      orderNumber: '1001',
      status: 'accepted',
      acceptedAt: new Date('2026-07-10T15:00:00.000Z'),
      totals: {
        subtotal: 110,
        productDiscount: 10,
        totalDiscount: 10,
        taxableBase: 100,
        taxAmount: 19,
        total: 119,
      },
      customer: { businessName: 'Cliente prueba', documentNumber: '123', email: 'cliente@example.com' },
      provider: { name: 'factus', number: 'FE1001', isValidated: true },
      creditNotes: [
        {
          _id: 'note-1',
          status: 'validated',
          validatedAt: new Date('2026-07-12T15:00:00.000Z'),
          subtotal: 50,
          taxAmount: 9.5,
          totalAmount: 59.5,
          provider: { number: 'NC1', isValidated: true },
        },
      ],
    },
    {
      _id: 'invoice-2',
      orderId: 'order-2',
      orderNumber: '1002',
      status: 'failed',
      createdAt: new Date('2026-07-15T15:00:00.000Z'),
      totals: { taxableBase: 200, taxAmount: 38, total: 238 },
      customer: { businessName: 'Cliente fallido' },
      provider: { name: 'factus' },
      creditNotes: [],
    },
    {
      _id: 'invoice-3',
      orderId: 'order-3',
      orderNumber: '1003',
      status: 'accepted',
      createdAt: new Date('2026-06-18T15:00:00.000Z'),
      customer: { businessName: 'Cliente histórico' },
      provider: { name: 'factus', number: 'FE1003', isValidated: true, validatedAt: '2026-07-18' },
      creditNotes: [],
    },
  ];
  const orders = [
    { _id: 'order-1', orderNumber: '1001', source: 'online', payment: { provider: 'wompi' } },
    { _id: 'order-2', orderNumber: '1002', source: 'pos', payment: { method: 'cash' } },
    {
      _id: 'order-3',
      orderNumber: '1003',
      source: 'online',
      payment: { provider: 'payu' },
      subtotal: 50,
      total: 59.5,
      pricing: { subtotal: 50, taxableBase: 50, taxAmount: 9.5, total: 59.5 },
    },
  ];

  ElectronicInvoice.find = () => ({ lean: async () => invoices });
  Order.find = () => ({
    select() { return this; },
    lean: async () => orders,
  });

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
      fail(`Cálculo controlado del reporte no concilia: ${JSON.stringify(mismatches)}`);
    } else {
      ok('Cálculo controlado concilia facturas, errores, notas crédito, neto e IVA');
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
      ok('Filtros de estado se aplican por igual a facturas y notas crédito');
    }

    const csv = await reportService.buildBillingReportCsv({
      from: '2026-07-01',
      to: '2026-07-31',
      type: 'all',
      status: 'all',
    });
    const csvText = csv.buffer.toString('utf8');
    if (!csvText.startsWith('\uFEFFFecha;') || !csvText.includes('Nota crédito') || csv.totalRows !== 4) {
      fail('Exportación CSV controlada no contiene todos los documentos filtrados');
    } else {
      ok('Exportación controlada incluye BOM, factura y nota crédito sin recortes');
    }
  } finally {
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
