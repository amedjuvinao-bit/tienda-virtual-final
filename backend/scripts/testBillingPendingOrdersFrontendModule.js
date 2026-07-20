// backend/scripts/testBillingPendingOrdersFrontendModule.js
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

function validateFrontendApi() {
  const apiFile = read('frontend/src/admin/billing/api/adminBillingApi.js');

  assertIncludes(apiFile, 'getPendingBillingOrders', 'API frontend debe exportar getPendingBillingOrders.');
  assertIncludes(apiFile, '/api/admin/billing/pending-orders', 'API frontend debe consumir pending-orders.');

  ok('API frontend de Facturación expone órdenes pendientes por facturar');
}

function validatePendingOrdersPage() {
  const pageFile = read('frontend/src/admin/billing/AdminBillingPage.jsx');

  [
    'BillingPendingOrdersPanel',
    'getPendingBillingOrders',
    'Órdenes por facturar',
    'Ventas pagadas que todavía no tienen registro en ElectronicInvoice',
    'Buscar orden o cliente',
    'Fuente: Order menos órdenes que ya existen en ElectronicInvoice',
    'Ver orden',
    'Generar',
    "return <BillingPendingOrdersPanel />;",
  ].forEach((needle) => {
    assertIncludes(pageFile, needle, `AdminBillingPage no conecta Órdenes por facturar correctamente: falta ${needle}`);
  });

  assertNotIncludes(
    pageFile,
    'Esta pestaña se conectará después con /api/admin/billing/pending-orders',
    'La pestaña Órdenes por facturar no debe seguir como bloque vacío.'
  );

  ok('Pestaña Órdenes por facturar consume pending-orders y deja de estar vacía');
}

function validateBackendPendingOrders() {
  const routeFile = read('backend/routes/adminBilling.js');
  const serviceFile = read('backend/services/adminBillingService.js');

  assertIncludes(routeFile, '/pending-orders', 'adminBilling.js debe conservar endpoint /pending-orders.');
  assertIncludes(serviceFile, 'listPendingBillableOrders', 'adminBillingService debe exponer listPendingBillableOrders.');
  assertIncludes(serviceFile, "ElectronicInvoice.distinct('orderId'", 'El servicio debe excluir órdenes que ya tienen ElectronicInvoice.');
  assertIncludes(serviceFile, 'serializePendingOrder', 'El servicio debe serializar órdenes pendientes.');
  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'No debe usarse modelo Invoice paralelo.');

  ok('Backend de órdenes por facturar usa Order y ElectronicInvoice sin modelo paralelo');
}

function main() {
  console.log('\nValidando conexión de Órdenes por facturar en Facturación...');

  try {
    validateFrontendApi();
    validatePendingOrdersPage();
    validateBackendPendingOrders();
  } catch (error) {
    fail('Error validando Órdenes por facturar', error);
  } finally {
    console.log(`\nResumen órdenes por facturar -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
    if (results.fail > 0) process.exit(1);
  }
}

main();
