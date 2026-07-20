// backend/scripts/testInvoicesBackendModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

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

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readProjectFile(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertIncludes(content, expected, message) {
  assert(String(content || '').includes(expected), message || `No se encontro ${expected}`);
}

function validateFilesExist() {
  [
    'backend/models/Invoice.js',
    'backend/services/invoiceService.js',
    'backend/routes/adminInvoices.js',
    'backend/routes/invoices.js',
  ].forEach((relativePath) => {
    readProjectFile(relativePath);
    ok(`${relativePath} existe`);
  });
}

function validateModel() {
  const file = readProjectFile('backend/models/Invoice.js');

  [
    'InvoiceSchema',
    'order',
    'orderNumber',
    'fullNumber',
    'numbering',
    'storeSnapshot',
    'fiscalSnapshot',
    'customerSnapshot',
    'billingSnapshot',
    'paymentSnapshot',
    'taxSnapshot',
    'couponSnapshot',
    'totals',
    'provider',
    'events',
    'status',
    'issued',
    'cancelled',
    'failed',
    'unique: true',
  ].forEach((needle) => assertIncludes(file, needle, `Invoice.js no contiene ${needle}`));

  ok('Modelo Invoice tiene snapshots, totales, numeracion, estados e indices');
}

function validateService() {
  const file = readProjectFile('backend/services/invoiceService.js');

  [
    'getBillingSettings',
    'isPaidOrder',
    'buildInvoiceItems',
    'buildInvoiceTotals',
    'buildNumberingSnapshot',
    'buildInvoicePayloadFromOrder',
    'listInvoices',
    'getInvoiceById',
    'getInvoicePublic',
    'getPendingBillableOrders',
    'getInvoiceSummary',
    'createInvoiceFromOrder',
    'setInvoiceStatus',
    'cancelInvoice',
    'SiteSettings',
    'Order',
  ].forEach((needle) => assertIncludes(file, needle, `invoiceService.js no contiene ${needle}`));

  ok('Servicio invoiceService contiene motor interno de facturacion');
}

function validateRoutes() {
  const adminRoute = readProjectFile('backend/routes/adminInvoices.js');
  const publicRoute = readProjectFile('backend/routes/invoices.js');
  const indexFile = readProjectFile('backend/index.js');

  [
    '/summary',
    '/documents',
    '/orders-pending',
    '/from-order/:orderId',
    'billing:view',
    'billing:create',
    'createInvoiceFromOrder',
  ].forEach((needle) => assertIncludes(adminRoute, needle, `adminInvoices.js no contiene ${needle}`));

  assertIncludes(publicRoute, '/:id/public', 'invoices.js no contiene consulta publica controlada.');
  assertIncludes(indexFile, './routes/adminInvoices', 'index.js no carga adminInvoices.');
  assertIncludes(indexFile, './routes/invoices', 'index.js no carga invoices.');
  assertIncludes(indexFile, '/api/admin/invoices', 'index.js no monta /api/admin/invoices.');
  assertIncludes(indexFile, '/api/invoices', 'index.js no monta /api/invoices.');

  ok('Rutas admin/publicas de facturacion interna estan montadas');
}

function validatePackageScript() {
  const packageFile = readProjectFile('backend/package.json');
  assertIncludes(packageFile, 'test:invoices-backend', 'package.json no registra test:invoices-backend.');
  ok('Script test:invoices-backend registrado');
}

function validatePureServiceLogic() {
  const service = require('../services/invoiceService');

  const numbering = service.buildNumberingSnapshot({
    dianResolution: {
      prefix: 'FE',
      rangeFrom: 1,
      rangeTo: 100,
      currentNumber: 7,
      resolutionNumber: '18764000000000',
      environment: '2',
    },
    electronicProvider: { provider: 'mock' },
  });

  assert(numbering.fullNumber === 'FE000007', 'La numeracion no genero FE000007.');

  const payload = service.buildInvoicePayloadFromOrder(
    {
      _id: '507f1f77bcf86cd799439011',
      orderNumber: 'ORD-TEST-001',
      status: 'paid',
      source: 'online',
      channel: 'web',
      saleType: 'online_order',
      items: [
        {
          title: 'Producto de prueba',
          quantity: 2,
          price: 50000,
          color: 'Rosado',
          size: 'M',
        },
      ],
      subtotal: 100000,
      shipping: 10000,
      discount: { amount: 5000 },
      taxes: { iva: { amount: 0 } },
      total: 105000,
      customer: { name: 'Cliente', email: 'cliente@test.com' },
      billing: { name: 'Cliente', email: 'cliente@test.com' },
      payment: { status: 'paid', amount: 105000, currency: 'COP' },
    },
    {
      store: { name: 'Tienda demo' },
      publicUrl: 'http://localhost:5173',
      fiscalInfo: { nit: '900123456', businessName: 'Tienda demo SAS' },
      dianResolution: { prefix: 'CI', rangeFrom: 1, rangeTo: 100, currentNumber: 1 },
      electronicProvider: { provider: 'mock' },
      legalTexts: { internalReceiptNote: 'Comprobante interno.' },
      taxes: { iva: { enabled: true, percent: 19, code: '01', name: 'IVA' } },
    },
    { username: 'tester' }
  );

  assert(payload.fullNumber === 'CI000001', 'El payload no genero CI000001.');
  assert(payload.orderNumber === 'ORD-TEST-001', 'El payload no conserva orderNumber.');
  assert(payload.items.length === 1, 'El payload no conserva items.');
  assert(payload.totals.total === 105000, 'El payload no conserva total.');
  assert(payload.fiscalSnapshot.nit === '900123456', 'El payload no conserva snapshot fiscal.');

  ok('Logica pura del servicio genera snapshot de comprobante desde orden');
}

function main() {
  console.log('\nValidando backend del motor interno de Facturacion...');

  try {
    validateFilesExist();
    validateModel();
    validateService();
    validateRoutes();
    validatePackageScript();
    validatePureServiceLogic();
  } catch (error) {
    fail('Error inesperado validando backend de facturacion', error);
  } finally {
    console.log(`\nResumen facturacion backend -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
    if (results.fail > 0) process.exit(1);
  }
}

main();
