// backend/scripts/testBillingPendingOrdersFrontendModule.js
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
  assertIncludes(apiFile, 'BILLING_GENERATION_TIMEOUT_MS', 'La emisión debe esperar el tiempo real del proveedor.');

  ok('API frontend de Facturación expone órdenes pendientes por facturar');
}

function validatePendingOrdersPage() {
  const pageFile = readBillingFrontendSource();

  [
    'BillingPendingOrdersPanel',
    'getPendingBillingOrders',
    'Órdenes por facturar',
    'Ventas pagadas sin factura validada o con una emisión que requiere corrección',
    'Buscar orden o cliente',
    'Incluye órdenes pagadas sin factura y emisiones rechazadas',
    'Emisión rechazada',
    'Revisar y reintentar',
    'Ver orden',
    'Revisar y emitir',
    'BillingInvoicePreflightModal',
    'getBillingInvoicePreflight',
    'isUncertainGenerationError',
    'openGeneratedDocument',
    "return <BillingPendingOrdersPanel />;",
  ].forEach((needle) => {
    assertIncludes(pageFile, needle, `AdminBillingPage no conecta Órdenes por facturar correctamente: falta ${needle}`);
  });

  assertNotIncludes(
    pageFile,
    'Esta pestaña se conectará después con /api/admin/billing/pending-orders',
    'La pestaña Órdenes por facturar no debe seguir como bloque vacío.'
  );

  [
    'min-w-[760px] table-fixed',
    'w-[28%]',
    '[overflow-wrap:anywhere]',
    'w-full whitespace-nowrap rounded-xl',
  ].forEach((needle) => {
    assertIncludes(pageFile, needle, `La tabla de órdenes debe conservar su distribución legible: falta ${needle}`);
  });

  assertNotIncludes(
    pageFile,
    'max-w-[260px] truncate',
    'La tabla no debe recortar el correo del cliente.'
  );

  ok('Pestaña Órdenes por facturar consume pending-orders y mantiene una tabla ancha y legible');
}

function validateBackendPendingOrders() {
  const routeFile = read('backend/routes/adminBilling.js');
  const serviceFile = read('backend/services/adminBillingService.js');
  const aggregationFile = read('backend/services/adminBillingAggregationService.js');

  assertIncludes(routeFile, '/pending-orders', 'adminBilling.js debe conservar endpoint /pending-orders.');
  assertIncludes(serviceFile, 'listPendingBillableOrders', 'adminBillingService debe exponer listPendingBillableOrders.');
  assertIncludes(serviceFile, 'buildPendingOrdersPaginationPipeline', 'El servicio debe paginar pendientes en MongoDB.');
  assertIncludes(aggregationFile, '$lookup', 'El servicio debe consultar ElectronicInvoice dentro de MongoDB.');
  assertIncludes(aggregationFile, 'ERROR_INVOICE_STATUSES', 'Las emisiones fallidas deben volver a la bandeja de corrección.');
  assertIncludes(serviceFile, 'billingIssue', 'La respuesta debe informar la novedad fiscal de una orden reintentable.');
  assertIncludes(serviceFile, 'allowRetry: true', 'La generación administrativa debe reintentar fallos de forma explícita.');
  assertNotIncludes(serviceFile, "ElectronicInvoice.distinct('orderId'", 'No debe cargar todos los orderId facturados en memoria.');
  assertIncludes(serviceFile, 'serializePendingOrder', 'El servicio debe serializar órdenes pendientes.');
  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'No debe usarse modelo Invoice paralelo.');

  ok('Backend pagina órdenes, excluye facturas válidas y conserva fallos reintentables');
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
