// backend/scripts/testBillingSummaryFrontendModule.js
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

function read(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertIncludes(content, expected, message) {
  assert(String(content).includes(expected), message || `No se encontró ${expected}`);
}

function assertNotIncludes(content, expected, message) {
  assert(!String(content).includes(expected), message || `No debe contener ${expected}`);
}

function validateSummaryFrontend() {
  const pageFile = read('frontend/src/admin/billing/AdminBillingPage.jsx');

  [
    'BillingSummaryPanel',
    'getBillingSummary()',
    "getBillingDocuments({ page: 1, limit: 3, status: 'all' })",
    'getPendingBillingOrders({ page: 1, limit: 3 })',
    "getBillingDocuments({ page: 1, limit: 3, status: 'error' })",
    'Último documento generado',
    'Órdenes próximas por facturar',
    'Últimos errores de emisión',
    'Numeración y proveedor',
    'Ver documentos',
    'Órdenes pendientes',
  ].forEach((needle) => {
    assertIncludes(pageFile, needle, `Resumen de facturación no está conectado correctamente: falta ${needle}`);
  });

  assertNotIncludes(
    pageFile,
    'Módulo unificado de facturación" text="Esta pantalla centraliza',
    'Resumen no debe seguir como bloque informativo vacío.'
  );

  ok('Resumen consume endpoints reales y muestra documentos, pendientes, errores y proveedor');
}

function validateAdminApiStillAvailable() {
  const apiFile = read('frontend/src/admin/billing/api/adminBillingApi.js');

  [
    'getBillingSummary',
    'getBillingDocuments',
    'getPendingBillingOrders',
    '/api/admin/billing/summary',
    '/api/admin/billing/documents',
    '/api/admin/billing/pending-orders',
  ].forEach((needle) => {
    assertIncludes(apiFile, needle, `API frontend de facturación no contiene ${needle}`);
  });

  ok('API frontend conserva endpoints necesarios para Resumen');
}

function validateBackendSummaryStillElectronicInvoice() {
  const serviceFile = read('backend/services/adminBillingService.js');

  [
    'getBillingSummary',
    "require('../models/ElectronicInvoice')",
    "require('../models/Order')",
    'ElectronicInvoice.find({}).lean()',
    'Order.countDocuments',
  ].forEach((needle) => {
    assertIncludes(serviceFile, needle, `Backend de resumen no conserva fuente oficial: falta ${needle}`);
  });

  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'No debe usarse modelo Invoice paralelo.');
  ok('Backend de resumen sigue usando ElectronicInvoice y Order');
}

function validateScriptRegistered() {
  const packageFile = read('backend/package.json');
  assertIncludes(packageFile, 'test:billing-summary', 'package.json debe registrar test:billing-summary.');
  ok('Script test:billing-summary registrado');
}

function main() {
  console.log('\nValidando Resumen de Facturación...');

  try {
    validateSummaryFrontend();
    validateAdminApiStillAvailable();
    validateBackendSummaryStillElectronicInvoice();
    validateScriptRegistered();
  } catch (error) {
    fail('Error validando Resumen de Facturación', error);
  } finally {
    console.log(`\nResumen facturación resumen -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
    if (results.fail > 0) process.exit(1);
  }
}

main();
