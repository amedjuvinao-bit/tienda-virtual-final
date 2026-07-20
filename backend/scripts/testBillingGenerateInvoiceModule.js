// backend/scripts/testBillingGenerateInvoiceModule.js
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

function validateBackendGenerationService() {
  const serviceFile = read('backend/services/adminBillingService.js');

  [
    'generateInvoiceForOrder',
    "require('../models/ElectronicInvoice')",
    "require('../models/Order')",
    'generateCUFE',
    'generateInvoiceXML',
    'ElectronicInvoice.create',
    "status: 'generated'",
    'billing.dianResolution.currentNumber',
    'serializeElectronicInvoice(created.toObject())',
  ].forEach((needle) => {
    assertIncludes(serviceFile, needle, `adminBillingService no genera factura correctamente: falta ${needle}`);
  });

  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'No debe usarse modelo Invoice paralelo.');
  ok('Servicio genera factura sobre ElectronicInvoice sin modelo paralelo');
}

function validateBackendGenerationRoute() {
  const routeFile = read('backend/routes/adminBilling.js');

  [
    "/orders/:orderId/generate",
    'router.post',
    'billingService.generateInvoiceForOrder',
    'res.status(data.created ? 201 : 200)',
  ].forEach((needle) => {
    assertIncludes(routeFile, needle, `adminBilling.js no expone generación de factura: falta ${needle}`);
  });

  ok('Ruta admin genera factura desde orden usando el servicio de facturación');
}

function validateFrontendGeneration() {
  const apiFile = read('frontend/src/admin/billing/api/adminBillingApi.js');
  const pageFile = read('frontend/src/admin/billing/AdminBillingPage.jsx');

  [
    'generateBillingInvoiceForOrder',
    '/api/admin/billing/orders/${orderId}/generate',
  ].forEach((needle) => {
    assertIncludes(apiFile, needle, `API frontend no conecta generar factura: falta ${needle}`);
  });

  [
    'generateBillingInvoiceForOrder',
    'handleGenerateInvoice',
    'Factura generada correctamente',
    'Generando...',
    'Generar',
    'await loadPendingOrders()',
    'return <BillingPendingOrdersPanel />;',
  ].forEach((needle) => {
    assertIncludes(pageFile, needle, `AdminBillingPage no conecta botón Generar: falta ${needle}`);
  });

  ok('Frontend conecta botón Generar al endpoint de facturación');
}

function validateScriptRegistered() {
  const packageFile = read('backend/package.json');
  assertIncludes(
    packageFile,
    'test:billing-generate-invoice',
    'package.json debe registrar test:billing-generate-invoice.'
  );

  ok('Script test:billing-generate-invoice registrado');
}

function main() {
  console.log('\nValidando generación de factura desde Facturación...');

  try {
    validateBackendGenerationService();
    validateBackendGenerationRoute();
    validateFrontendGeneration();
    validateScriptRegistered();
  } catch (error) {
    fail('Error validando generación de factura', error);
  } finally {
    console.log(`\nResumen generar factura -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
    if (results.fail > 0) process.exit(1);
  }
}

main();
