// backend/scripts/testBillingCreditNotesModule.js
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

function validateBackendCreditNotes() {
  const serviceFile = read('backend/services/adminBillingService.js');
  const routeFile = read('backend/routes/adminBilling.js');

  [
    'function serializeCreditNote',
    'async function listCreditNotes',
    "'creditNotes.0': { $exists: true }",
    'ElectronicInvoice.find(invoiceFilter)',
    'serializeCreditNote(invoice, note, index)',
    'listCreditNotes',
  ].forEach((needle) => {
    assertIncludes(serviceFile, needle, `Servicio de facturación no expone notas crédito: falta ${needle}`);
  });

  assertIncludes(routeFile, '/credit-notes', 'Ruta admin de notas crédito no está montada.');
  assertIncludes(routeFile, 'billingService.listCreditNotes', 'Ruta de notas crédito no usa el servicio oficial.');
  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'No debe usarse modelo Invoice paralelo.');

  ok('Backend lista notas crédito desde ElectronicInvoice.creditNotes');
}

function validateFrontendCreditNotesApi() {
  const apiFile = read('frontend/src/admin/billing/api/adminBillingApi.js');

  assertIncludes(apiFile, 'getBillingCreditNotes', 'API frontend no exporta getBillingCreditNotes.');
  assertIncludes(apiFile, '/api/admin/billing/credit-notes', 'API frontend no consume /credit-notes.');

  ok('API frontend consume endpoint de notas crédito');
}

function validateFrontendCreditNotesTab() {
  const pageFile = read('frontend/src/admin/billing/AdminBillingPage.jsx');

  [
    "id: 'notas-credito'",
    "label: 'Notas crédito'",
    'BillingCreditNotesPanel',
    'getBillingCreditNotes',
    'ElectronicInvoice.creditNotes',
    'Bandeja fiscal',
    'Buscar nota, factura, cliente o motivo',
    'Fuente: ElectronicInvoice.creditNotes',
    "`${BASE_PATH}/notas-credito`",
  ].forEach((needle) => {
    assertIncludes(pageFile, needle, `Frontend de notas crédito no está conectado: falta ${needle}`);
  });

  assertNotIncludes(pageFile, 'CreateCreditNoteModal', 'No se debe crear modal nuevo de nota crédito.');

  ok('Frontend agrega pestaña interna Notas crédito sin crear módulo separado');
}

function validateCreditNotesTableLayout() {
  const cssFile = read('frontend/src/admin/billing/billingDocumentsLayout.css');

  [
    'Tabla interna de Notas crédito: evita columna derecha mocha.',
    'table.min-w-\\[980px\\]',
    'table.min-w-\\[980px\\] th:nth-child(6)',
    'table.min-w-\\[980px\\] td:nth-child(6) > div',
    'overflow-x: hidden !important',
    'min-width: 72px',
  ].forEach((needle) => {
    assertIncludes(cssFile, needle, `CSS de notas crédito no evita tabla mocha: falta ${needle}`);
  });

  ok('Tabla de Notas crédito tiene ajuste visual propio sin recortes');
}

function validateSummaryIncludesCreditNotes() {
  const pageFile = read('frontend/src/admin/billing/AdminBillingPage.jsx');
  const serviceFile = read('backend/services/adminBillingService.js');

  assertIncludes(serviceFile, 'creditNotes,', 'Resumen backend no devuelve conteo de notas crédito.');
  assertIncludes(pageFile, "label=\"Notas crédito\"", 'Resumen frontend no muestra métrica de notas crédito.');
  assertIncludes(pageFile, 'summary?.creditNotes', 'Resumen frontend no consume summary.creditNotes.');

  ok('Resumen de facturación muestra conteo de notas crédito');
}

function main() {
  console.log('\nValidando pestaña Notas crédito en Facturación...');

  [
    validateBackendCreditNotes,
    validateFrontendCreditNotesApi,
    validateFrontendCreditNotesTab,
    validateCreditNotesTableLayout,
    validateSummaryIncludesCreditNotes,
  ].forEach((step) => {
    try {
      step();
    } catch (error) {
      fail(step.name, error);
    }
  });

  console.log(`\nResumen notas crédito facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
  if (results.fail > 0) process.exit(1);
}

main();