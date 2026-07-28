// backend/scripts/testBillingGenerateInvoiceModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const { readBillingFrontendSource } = require('./lib/readBillingFrontendSource');
const {
  readElectronicInvoiceModalFrontendSource,
} = require('./lib/readElectronicInvoiceModalFrontendSource');

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
  const serviceFile = read('backend/services/electronicInvoiceIssuanceService.js');
  const adminServiceFile = read('backend/services/adminBillingService.js');

  [
    'issueElectronicInvoiceForOrder',
    'createElectronicInvoiceIssuanceService',
    "require('../models/ElectronicInvoice')",
    "require('../models/Order')",
    'generateCUFE',
    'generateInvoiceXML',
    'sendElectronicInvoiceToProvider',
    'extractProviderDocument',
    'isExternalProvider',
    'providerSucceeded',
    "'BILLING_PROVIDER_GENERATION_ERROR'",
    'remoteNumber',
    'remoteCufe',
    'InvoiceModel.create',
    'status: nextStatus',
    'billing.dianResolution.currentNumber',
    'idempotencyKey',
    "status: 'processing'",
  ].forEach((needle) => {
    assertIncludes(serviceFile, needle, `El motor unificado no genera factura correctamente: falta ${needle}`);
  });

  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'No debe usarse modelo Invoice paralelo.');
  const invoiceClaim = serviceFile.indexOf('claimedInvoice = await InvoiceModel.create');
  const providerCall = serviceFile.indexOf('providerResponse = await sendToProvider');
  assert(invoiceClaim >= 0 && providerCall > invoiceClaim, 'La orden debe reservarse antes de contactar al proveedor.');

  assertIncludes(adminServiceFile, 'issueElectronicInvoiceForOrder', 'El módulo admin no delega al motor unificado.');
  assertIncludes(adminServiceFile, "source: 'admin'", 'El módulo admin no registra el origen de la emisión.');

  ok('Motor unificado reserva la orden y guarda la respuesta oficial en ElectronicInvoice');
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

function validateFactusCreationResponse() {
  const { extractProviderDocument } = require('../services/adminBillingService');
  const document = extractProviderDocument({
    success: true,
    status: 201,
    data: {
      status: 'Created',
      message: 'Documento validado',
      data: {
        reference_code: '000228',
        number: 'SETP990002109',
        cufe: 'cufe-oficial-prueba',
        is_validated: true,
      },
      invoiceNumber: 'SETP990002109',
    },
  });

  assert(document.number === 'SETP990002109', 'No se extrajo data.number de la respuesta de creación Factus.');
  assert(document.cufe === 'cufe-oficial-prueba', 'No se extrajo el CUFE oficial de Factus.');
  assert(document.is_validated === true, 'No se conservó la validación real informada por Factus.');

  ok('Respuesta de creación Factus conserva número, CUFE y validación oficiales');
}

function validateFrontendGeneration() {
  const apiFile = read('frontend/src/admin/billing/api/adminBillingApi.js');
  const pageFile = readBillingFrontendSource();

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

  assertNotIncludes(pageFile, 'window.location.assign', 'No debe redirigir automáticamente después de generar factura.');
  assertNotIncludes(pageFile, 'buildGeneratedDocumentUrl', 'No debe construir URL automática a documentos.');
  assertNotIncludes(pageFile, 'getInitialDocumentQuery', 'Documentos no debe cargarse filtrado por URL automáticamente.');

  ok('Frontend conecta botón Generar sin redirigir ni recargar la página');
}

function validateGeneratedIsNotValidated() {
  const modalFile = readElectronicInvoiceModalFrontendSource();
  const statusFile = read('frontend/src/admin/orders/electronicInvoice/invoiceStatusUtils.js');
  const serviceFile = read('backend/services/adminBillingService.js');

  assertNotIncludes(
    modalFile,
    "status === 'generated' ||",
    'El modal no debe tratar una factura solamente generada como validada.'
  );
  assertNotIncludes(
    statusFile,
    "status === 'accepted' ||\n    status === 'generated'",
    'El estado generated no debe mostrarse como validado.'
  );
  assertNotIncludes(
    serviceFile,
    'Boolean(invoice.cufe || invoice?.provider?.cufe',
    'La existencia de un CUFE local no debe validar por sí sola la factura.'
  );

  ok('Estado generado permanece pendiente hasta confirmación real del proveedor');
}

function validateGenerateConfirmationBridge() {
  const mainFile = read('frontend/src/main.jsx');
  const bridgeFile = read('frontend/src/admin/billing/billingGenerateConfirmBridge.js');

  assertIncludes(
    mainFile,
    './admin/billing/billingGenerateConfirmBridge',
    'main.jsx debe cargar la confirmación visual de generar factura.'
  );

  [
    'installBillingGenerateConfirmBridge',
    "window.location.pathname === '/admin/facturacion/ordenes'",
    "normalizeText(button.textContent) === 'Generar'",
    '¿Seguro que deseas generar factura para la orden',
    'ElectronicInvoice',
    'window.confirm',
    'event.stopImmediatePropagation',
    'data-billing-generate-confirmed',
  ].forEach((needle) => {
    assertIncludes(bridgeFile, needle, `billingGenerateConfirmBridge no protege Generar factura: falta ${needle}`);
  });

  ok('Botón Generar factura exige confirmación visual antes de crear ElectronicInvoice');
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
    validateFactusCreationResponse();
    validateFrontendGeneration();
    validateGeneratedIsNotValidated();
    validateGenerateConfirmationBridge();
    validateScriptRegistered();
  } catch (error) {
    fail('Error validando generación de factura', error);
  } finally {
    console.log(`\nResumen generar factura -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
    if (results.fail > 0) process.exit(1);
  }
}

main();
