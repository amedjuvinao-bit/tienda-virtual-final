// backend/scripts/testBillingSyncModule.js
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

function validateBackendSyncService() {
  const serviceFile = read('backend/services/adminBillingSyncService.js');

  [
    'syncInvoice',
    'syncCreditNote',
    "require('../models/ElectronicInvoice')",
    'serializeElectronicInvoice',
    'serializeCreditNote',
    'provider.raw',
    'billingSync',
    "source: 'admin-billing'",
  ].forEach((needle) => {
    assertIncludes(serviceFile, needle, `Servicio de sincronización no está completo: falta ${needle}`);
  });

  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'No debe usarse modelo Invoice paralelo.');
  ok('Servicio sincroniza facturas y notas crédito usando ElectronicInvoice');
}

function validateBackendRoutes() {
  const routeFile = read('backend/routes/adminBilling.js');

  [
    "require('../services/adminBillingSyncService')",
    '/documents/:invoiceId/sync',
    '/credit-notes/:invoiceId/:noteId/sync',
    'billingSyncService.syncInvoice',
    'billingSyncService.syncCreditNote',
  ].forEach((needle) => {
    assertIncludes(routeFile, needle, `Rutas de sincronización no están montadas: falta ${needle}`);
  });

  ok('Rutas admin de sincronización están montadas');
}

function validateFrontendApiAndBridge() {
  const apiFile = read('frontend/src/admin/billing/api/adminBillingApi.js');
  const bridgeFile = read('frontend/src/admin/billing/billingSyncBridge.js');
  const mainFile = read('frontend/src/main.jsx');

  [
    'syncBillingDocument',
    'syncBillingCreditNote',
    '/api/admin/billing/documents/',
    '/api/admin/billing/credit-notes/',
  ].forEach((needle) => {
    assertIncludes(apiFile, needle, `API frontend de sincronización no contiene ${needle}`);
  });

  [
    'Sincronizar visibles',
    'syncBillingDocument',
    'syncBillingCreditNote',
    '/admin/facturacion/documentos',
    '/admin/facturacion/notas-credito',
    'data-billing-sync-visible',
  ].forEach((needle) => {
    assertIncludes(bridgeFile, needle, `Bridge visual de sincronización no contiene ${needle}`);
  });

  assertIncludes(mainFile, "./admin/billing/billingSyncBridge", 'main.jsx no carga la sincronización visual.');
  ok('Frontend expone acción visual de sincronización sin tocar tablas');
}

function validatePackageScript() {
  const packageFile = read('backend/package.json');
  assertIncludes(packageFile, 'test:billing-sync', 'package.json debe registrar test:billing-sync.');
  ok('Script test:billing-sync registrado');
}

function main() {
  console.log('\nValidando sincronización de Facturación...');

  [
    validateBackendSyncService,
    validateBackendRoutes,
    validateFrontendApiAndBridge,
    validatePackageScript,
  ].forEach((step) => {
    try {
      step();
    } catch (error) {
      fail(step.name, error);
    }
  });

  console.log(`\nResumen sincronización facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
  if (results.fail > 0) process.exit(1);
}

main();
