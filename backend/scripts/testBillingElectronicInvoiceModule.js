// backend/scripts/testBillingElectronicInvoiceModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const { readBillingFrontendSource } = require('./lib/readBillingFrontendSource');

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

function exists(relativePath) {
  return fs.existsSync(path.join(PROJECT_ROOT, relativePath));
}

function read(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertIncludes(content, expected, message) {
  assert(String(content).includes(expected), message || `No se encontró ${expected}`);
}

function assertIncludesAny(content, expectedList, message) {
  const text = String(content || '');
  const found = expectedList.some((expected) => text.includes(expected));
  assert(found, message || `No se encontró ninguna variante: ${expectedList.join(' | ')}`);
}

function assertNotIncludes(content, expected, message) {
  assert(!String(content).includes(expected), message || `No debe contener ${expected}`);
}

function validateNoParallelInvoiceLayer() {
  [
    'backend/models/Invoice.js',
    'backend/services/invoiceService.js',
    'backend/routes/adminInvoices.js',
    'backend/routes/invoices.js',
    'backend/scripts/testInvoicesBackendModule.js',
  ].forEach((relativePath) => {
    assert(!exists(relativePath), `${relativePath} no debe existir; se debe usar ElectronicInvoice.`);
  });

  ok('No existe capa paralela Invoice; se eliminó la duplicidad');
}

function validateExistingElectronicInvoiceLayer() {
  const electronicInvoiceModel = read('backend/models/ElectronicInvoice.js');
  const ordersRoute = read('backend/routes/orders.js');

  [
    'ElectronicInvoiceSchema',
    'orderId',
    'orderNumber',
    'invoiceNumber',
    'cufe',
    'xmlContent',
    'provider',
    'creditNotes',
  ].forEach((needle) => {
    assertIncludes(electronicInvoiceModel, needle, `ElectronicInvoice no contiene ${needle}`);
  });

  assertIncludes(
    ordersRoute,
    "require('../models/ElectronicInvoice')",
    'orders.js no importa ElectronicInvoice.'
  );

  assertIncludes(
    ordersRoute,
    'ElectronicInvoice.findOne',
    'orders.js no consulta ElectronicInvoice desde órdenes.'
  );

  assertIncludesAny(
    ordersRoute,
    ['orderId: o?._id', 'orderId: order._id', 'orderId }', 'orderId,'],
    'orders.js no conserva la relación ElectronicInvoice por orderId.'
  );

  ['invoice-xml', 'generateOrderPdf', 'factusLinks'].forEach((needle) => {
    assertIncludes(ordersRoute, needle, `orders.js no conserva integración existente con ${needle}`);
  });

  ok('ElectronicInvoice sigue siendo el documento oficial de facturación en órdenes');
}

function validateUnifiedBillingAdminApi() {
  const indexFile = read('backend/index.js');
  const routeFile = read('backend/routes/adminBilling.js');
  const serviceFile = read('backend/services/adminBillingService.js');
  const packageFile = read('backend/package.json');

  assertIncludes(indexFile, './routes/adminBilling', 'index.js no carga adminBilling.');
  assertIncludes(indexFile, '/api/admin/billing', 'index.js no monta /api/admin/billing.');
  assertNotIncludes(indexFile, './routes/adminInvoices', 'index.js no debe cargar adminInvoices.');
  assertNotIncludes(indexFile, './routes/invoices', 'index.js no debe cargar invoices paralelo.');
  assertNotIncludes(indexFile, '/api/admin/invoices', 'index.js no debe montar /api/admin/invoices paralelo.');
  assertNotIncludes(indexFile, '/api/invoices', 'index.js no debe montar /api/invoices paralelo.');

  [
    '/summary',
    '/documents',
    '/pending-orders',
    '/settings',
    'billing:view',
    'billing:settings',
  ].forEach((needle) => {
    assertIncludes(routeFile, needle, `adminBilling.js no contiene ${needle}`);
  });

  [
    "require('../models/ElectronicInvoice')",
    'listElectronicInvoices',
    'listPendingBillableOrders',
    'getBillingSummary',
    'getBillingSettingsSnapshot',
  ].forEach((needle) => {
    assertIncludes(serviceFile, needle, `adminBillingService no contiene ${needle}`);
  });

  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'adminBillingService no debe usar Invoice.');
  assertIncludes(packageFile, 'test:billing-electronic-invoice', 'package.json no registra la prueba de facturación unificada.');
  assertNotIncludes(packageFile, 'test:invoices-backend', 'package.json no debe conservar la prueba del motor paralelo Invoice.');

  ok('API admin de Facturación usa ElectronicInvoice y queda montada en módulo unificado');
}

function validateFrontendShellRemainsUnified() {
  const appFile = read('frontend/src/App.jsx');
  const pageFile = readBillingFrontendSource();

  assertIncludes(appFile, 'AdminBillingPage', 'App.jsx debe conservar el módulo unificado de facturación.');
  assertIncludes(appFile, 'facturacion', 'App.jsx debe registrar /admin/facturacion.');

  ['Resumen', 'Documentos', 'Órdenes por facturar', 'Configuración'].forEach((needle) => {
    assertIncludes(pageFile, needle, `AdminBillingPage no contiene la sección ${needle}.`);
  });

  ok('Frontend conserva un solo módulo visual de Facturación');
}

function main() {
  console.log('\nValidando corrección de Facturación con ElectronicInvoice...');

  try {
    validateNoParallelInvoiceLayer();
    validateExistingElectronicInvoiceLayer();
    validateUnifiedBillingAdminApi();
    validateFrontendShellRemainsUnified();
  } catch (error) {
    fail('Error validando Facturación con ElectronicInvoice', error);
  } finally {
    console.log(`\nResumen facturación ElectronicInvoice -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
    if (results.fail > 0) process.exit(1);
  }
}

main();
