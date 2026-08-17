// backend/scripts/testBillingCreditNotesOfficialModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const { readBillingFrontendSource } = require('./lib/readBillingFrontendSource');
const {
  readElectronicInvoiceModalFrontendSource,
} = require('./lib/readElectronicInvoiceModalFrontendSource');
const {
  readFactusProviderSource,
} = require('./lib/readFactusProviderSource');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, warn: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log('OK  ' + message);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error('FAIL ' + message);
  if (error?.message) console.error('     ' + error.message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), 'No existe ' + relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

function includes(content, expected, message) {
  assert(String(content).includes(expected), message || 'No se encontró ' + expected);
}

function validateOfficialPayload() {
  const provider = readFactusProviderSource();
  includes(provider, 'bill_number: trimSafe(billNumber, 160)', 'La nota no usa bill_number oficial.');
  includes(provider, 'reference_code: trimSafe(referenceCode, 100)', 'La referencia no es estable.');
  assert(!provider.includes('bill_id:'), 'La nota no debe depender del ID interno de Factus.');
  ok('Payload V2 relaciona la nota mediante bill_number y reference_code estable');
}

function validatePayloadMath() {
  const {
    buildFactusCreditNotePayload,
  } = require('../lib/dian/providers/factusProvider');
  const order = {
    orderNumber: 'TEST-1001',
    billing: {
      personType: 'natural',
      documentType: 'CC',
      documentNumber: '222222222222',
      firstName: 'Consumidor',
      lastName: 'Final',
      municipalityCode: '11001',
      countryCode: 'CO',
    },
    items: [{ productId: 'P1', title: 'Producto', quantity: 2, price: 100 }],
    subtotal: 200,
    shipping: 10,
    total: 224.2,
    pricing: {
      productDiscount: 20,
      subtotalAfterDiscount: 180,
      shipping: 10,
      version: 2,
    },
    taxes: { iva: { enabled: true, percent: 19, amount: 34.2 } },
  };
  const payload = buildFactusCreditNotePayload({
    order,
    type: 'partial',
    selectedItems: [{ codeReference: 'P1', quantity: 1 }],
    reasonCode: '1',
    reasonText: 'Devolución parcial',
    billNumber: 'SETP9900077',
    referenceCode: 'NC-TEST-1001',
    numberingRangeId: 8,
  });

  assert(payload.bill_number === 'SETP9900077', 'No conserva bill_number.');
  assert(payload.customer.identification === '222222222222', 'No conserva el cliente fiscal.');
  assert(payload.items.length === 1, 'La parcial incluyó líneas no seleccionadas.');
  assert(payload.items[0].discount_amount === '10.00', 'No prorratea el descuento.');
  assert(payload.payment_details[0].amount === '107.10', 'No concilia base, descuento e IVA.');
  ok('Cálculo parcial prorratea descuento e IVA sin confiar en el navegador');
}

function validateDianReasons() {
  const service = read('backend/services/electronicCreditNoteService.js');
  const modal = readElectronicInvoiceModalFrontendSource();
  ['\'1\'', '\'2\'', '\'3\'', '\'4\'', '\'5\'', '\'6\''].forEach((code) => {
    includes(service, code, 'Falta motivo DIAN ' + code);
  });
  includes(modal, 'Descuento comercial por pronto pago', 'El código 5 sigue mal rotulado.');
  includes(modal, 'Descuento comercial por volumen de ventas', 'Falta el código 6.');
  assert(!modal.includes("label: 'Otros motivos'"), 'Otros motivos no es un código DIAN vigente.');
  ok('Formulario y backend usan los seis motivos DIAN vigentes');
}

function validateIdempotencyAndLock() {
  const model = read('backend/models/ElectronicInvoice.js');
  const service = read('backend/services/electronicCreditNoteService.js');
  ['idempotencyKey', 'requestFingerprint', 'creditNoteControl', 'lockToken'].forEach((needle) => {
    includes(model, needle, 'Falta control persistente: ' + needle);
  });
  includes(service, 'buildReferenceCode(order, request.idempotencyKey)', 'La referencia puede cambiar al reintentar.');
  includes(service, 'BILLING_CREDIT_NOTE_IN_PROGRESS', 'No bloquea solicitudes simultáneas.');
  includes(service, 'La nota crédito ya había sido procesada', 'No reutiliza una nota ya emitida.');
  ok('Motor reserva por factura y reutiliza el mismo documento en reintentos');
}

function validateServerSideAmounts() {
  const service = read('backend/services/electronicCreditNoteService.js');
  const provider = readFactusProviderSource();
  includes(service, 'normalizePartialItems(order, request.selectedItems)', 'Confía en precios enviados por el navegador.');
  includes(service, 'itemPrice(original.item)', 'El precio parcial no sale de la orden.');
  includes(service, 'BILLING_CREDIT_NOTE_QUANTITY_EXCEEDED', 'No controla cantidades ya acreditadas.');
  includes(provider, 'buildFactusInvoicePayload({ order })', 'No conserva descuentos e impuestos de la factura.');
  ok('Valores parciales se reconstruyen desde la orden con descuentos, IVA y cantidades restantes');
}

function validateOfficialDocuments() {
  const provider = readFactusProviderSource();
  const service = read('backend/services/electronicCreditNoteDocumentService.js');
  const routes = read('backend/routes/adminBilling.js');
  includes(provider, "resource: 'credit-notes'", 'No usa endpoints de documentos de notas crédito.');
  includes(service, 'downloadCreditNoteDocumentFromFactus', 'No existe capa oficial de descarga.');
  includes(service, 'sha256', 'No audita la huella del documento.');
  includes(routes, "'/credit-notes/:invoiceId/:noteId/pdf'", 'Falta ruta PDF.');
  includes(routes, "'/credit-notes/:invoiceId/:noteId/xml'", 'Falta ruta XML.');
  ok('PDF y XML oficiales se descargan desde Factus y registran metadata');
}

function validateSecurityAndPermissions() {
  const routes = read('backend/routes/adminBilling.js');
  const payments = read('backend/routes/payments.js');
  const provider = readFactusProviderSource();
  includes(routes, "requirePermission('billing:credit_note')", 'Creación sin permiso específico.');
  includes(routes, "requirePermission('billing:download')", 'Descarga sin permiso específico.');
  includes(payments, 'createOfficialCreditNote', 'La ruta heredada no comparte el motor seguro.');
  assert(!provider.includes('FACTUS CREDIT NOTE PAYLOAD:'), 'El payload fiscal se escribe en logs.');
  ok('Rutas están autorizadas, no exponen payloads y comparten un único motor');
}

function validateProviderErrors() {
  const provider = readFactusProviderSource();
  const service = read('backend/services/electronicCreditNoteService.js');
  const {
    extractFactusValidationErrors,
    summarizeFactusValidationErrors,
  } = require('../lib/dian/providers/factus/factusCreditNoteService');
  includes(provider, 'extractFactusValidationErrors', 'No extrae errores anidados de Factus.');
  includes(provider, 'validationErrors', 'No devuelve el detalle de validación del proveedor.');
  includes(service, 'providerResult?.validationErrors', 'No conserva el detalle del rechazo.');
  const errors = extractFactusValidationErrors({
    data: { errors: { customer: ['El cliente es obligatorio.'] } },
  });
  assert(errors.customer?.[0] === 'El cliente es obligatorio.', 'No reconoce el error anidado.');
  assert(
    summarizeFactusValidationErrors(errors).includes('customer:'),
    'No resume el campo rechazado.'
  );
  ok('Rechazos 422 conservan campos y mensajes de validación sin exponer credenciales');
}

function validateSyncIdentity() {
  const sync = read('backend/services/adminBillingSyncService.js');
  const service = read('backend/services/electronicCreditNoteService.js');
  includes(sync, "documentLabel: 'nota crédito'", 'Sincronización no valida la identidad de la nota.');
  includes(sync, 'storedProviderCufe: storedFiscalKey', 'No protege el CUDE guardado.');
  includes(sync, 'cude: remoteFiscalKey', 'No conserva el CUDE explícitamente.');
  includes(sync, 'credit_note_number_missing', 'Intenta consultar usando una referencia local.');
  includes(service, 'BILLING_CREDIT_NOTE_IDENTITY_MISMATCH', 'Creación no protege la referencia idempotente.');
  includes(service, 'BILLING_CREDIT_NOTE_CUDE_MISSING', 'Una nota validada podría guardarse sin CUDE.');
  ok('Sincronización protege número y CUDE oficiales de la nota crédito');
}

function validateFrontend() {
  const api = read('frontend/src/admin/billing/api/adminBillingApi.js');
  const page = readBillingFrontendSource();
  const modal = readElectronicInvoiceModalFrontendSource();
  includes(api, 'createBillingCreditNote', 'Creación no usa API unificada.');
  includes(api, 'downloadBillingCreditNotePdf', 'Falta descarga PDF.');
  includes(api, 'downloadBillingCreditNoteXml', 'Falta descarga XML.');
  includes(page, "downloadCreditNoteDocument(note, 'pdf')", 'La bandeja no descarga PDF oficial.');
  includes(page, "downloadCreditNoteDocument(note, 'xml')", 'La bandeja no descarga XML oficial.');
  includes(modal, 'createCreditNoteRequestKey', 'El formulario no conserva clave de reintento.');
  ok('Bandeja y modal crean, sincronizan y descargan documentos oficiales');
}

function validatePackageScript() {
  const packageFile = read('backend/package.json');
  includes(packageFile, 'test:billing-credit-notes-official', 'No se registró la prueba.');
  ok('Prueba de notas crédito oficiales registrada para ejecución local');
}

async function main() {
  console.log('\nValidando notas crédito oficiales de Facturación...');
  const steps = [
    validateOfficialPayload,
    validatePayloadMath,
    validateDianReasons,
    validateIdempotencyAndLock,
    validateServerSideAmounts,
    validateOfficialDocuments,
    validateSecurityAndPermissions,
    validateProviderErrors,
    validateSyncIdentity,
    validateFrontend,
    validatePackageScript,
  ];

  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      fail(step.name, error);
    }
  }

  console.log(
    '\nResumen notas crédito oficiales -> OK: ' + results.ok +
      ' WARN: ' + results.warn +
      ' FAIL: ' + results.fail
  );
  if (results.fail > 0) process.exitCode = 1;
}

main();
