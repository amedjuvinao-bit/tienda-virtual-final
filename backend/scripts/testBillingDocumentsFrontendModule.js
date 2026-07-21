// backend/scripts/testBillingDocumentsFrontendModule.js
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

  [
    '/api/admin/billing/summary',
    '/api/admin/billing/documents',
    '/api/admin/billing/pending-orders',
    '/api/admin/billing/settings',
    '/api/orders/${orderId}/pdf',
    '/api/orders/${orderId}/invoice-xml',
    'responseType: \'blob\'',
  ].forEach((needle) => {
    assertIncludes(apiFile, needle, `API frontend de facturación no contiene ${needle}`);
  });

  ok('API frontend de Facturación conecta resumen, documentos, pendientes, PDF y XML');
}

function validateDocumentsPage() {
  const pageFile = read('frontend/src/admin/billing/AdminBillingPage.jsx');

  [
    'BillingDocumentsPanel',
    'getBillingDocuments',
    'downloadOrderPdf',
    'downloadOrderInvoiceXml',
    'ElectronicInvoice',
    'Buscar orden, factura, cliente o CUFE',
    'STATUS_OPTIONS',
    'Facturas y comprobantes emitidos',
    'Fuente: ElectronicInvoice',
    'PDF',
    'XML',
  ].forEach((needle) => {
    assertIncludes(pageFile, needle, `AdminBillingPage no conecta Documentos correctamente: falta ${needle}`);
  });

  assertNotIncludes(
    pageFile,
    'Aquí se listarán los comprobantes y facturas generadas desde las órdenes',
    'La pestaña Documentos no debe seguir como bloque vacío.'
  );

  ok('Pestaña Documentos consume /api/admin/billing/documents y muestra soportes reales');
}

function validateInvoiceModalReuse() {
  const pageFile = read('frontend/src/admin/billing/AdminBillingPage.jsx');

  [
    "../orders/electronicInvoice/ElectronicInvoiceModal",
    'openInvoiceManager',
    'api.get(`/api/orders/${document.orderId}`)',
    'ElectronicInvoiceModal',
    'invoiceModalData',
    'Factura',
  ].forEach((needle) => {
    assertIncludes(pageFile, needle, `Documentos no reutiliza el modal existente de factura: falta ${needle}`);
  });

  assertNotIncludes(
    pageFile,
    'CreateCreditNoteModal',
    'No se debe crear un modal nuevo de nota crédito.'
  );

  ok('Documentos reutiliza ElectronicInvoiceModal existente para notas crédito');
}

function validateInvoiceModalLayout() {
  const mainFile = read('frontend/src/main.jsx');
  const cssFile = read('frontend/src/admin/orders/electronicInvoice/electronicInvoiceModalFix.css');

  assertIncludes(
    mainFile,
    './admin/orders/electronicInvoice/electronicInvoiceModalFix.css',
    'main.jsx debe cargar el ajuste visual del modal de factura electrónica.'
  );

  [
    'Ajuste visual puntual para el modal existente de factura electronica',
    'max-height: calc(100vh - 64px)',
    'z-index: 10000',
    'background: var(--admin-modal-bg, var(--admin-card-bg, #ffffff))',
    'overflow-y: auto',
  ].forEach((needle) => {
    assertIncludes(cssFile, needle, `electronicInvoiceModalFix.css no contiene ${needle}`);
  });

  ok('Modal existente de factura queda visible y centrado sin tocar Documentos');
}

function validateDocumentsLayoutFix() {
  const mainFile = read('frontend/src/main.jsx');
  const cssFile = read('frontend/src/admin/billing/billingDocumentsLayout.css');

  assertIncludes(
    mainFile,
    './admin/billing/billingDocumentsLayout.css',
    'main.jsx debe cargar el ajuste visual de Documentos de Facturación.'
  );

  [
    'Mantiene una tabla administrativa limpia',
    'table-layout: fixed',
    'display: table-cell',
    'text-overflow: ellipsis',
    'td:nth-child(6) > div',
    '@media (max-width: 1180px)',
  ].forEach((needle) => {
    assertIncludes(cssFile, needle, `billingDocumentsLayout.css no contiene ${needle}`);
  });

  assertNotIncludes(cssFile, 'grid-template-areas', 'El diseño no debe volver al listado tipo tarjeta desordenado.');

  ok('Documentos tiene diseño de tabla limpia, ancho y legible');
}

function validateBackendStillElectronicInvoice() {
  const routeFile = read('backend/routes/adminBilling.js');
  const serviceFile = read('backend/services/adminBillingService.js');

  assertIncludes(routeFile, '/documents', 'adminBilling.js debe conservar endpoint /documents.');
  assertIncludes(serviceFile, "require('../models/ElectronicInvoice')", 'adminBillingService debe usar ElectronicInvoice.');
  assertIncludes(serviceFile, 'listElectronicInvoices', 'adminBillingService debe exponer listElectronicInvoices.');
  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'No debe usarse modelo Invoice paralelo.');

  ok('Backend de Documentos sigue usando ElectronicInvoice como fuente oficial');
}

function main() {
  console.log('\nValidando conexión de Documentos en Facturación...');

  try {
    validateFrontendApi();
    validateDocumentsPage();
    validateInvoiceModalReuse();
    validateInvoiceModalLayout();
    validateDocumentsLayoutFix();
    validateBackendStillElectronicInvoice();
  } catch (error) {
    fail('Error validando Documentos de Facturación', error);
  } finally {
    console.log(`\nResumen documentos facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
    if (results.fail > 0) process.exit(1);
  }
}

main();
