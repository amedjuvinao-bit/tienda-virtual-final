// backend/scripts/testBillingOfficialDocumentsModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const { readBillingFrontendSource } = require('./lib/readBillingFrontendSource');
const {
  readFactusProviderSource,
} = require('./lib/readFactusProviderSource');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, warn: 0, fail: 0 };

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

function validateOfficialDocumentArchitecture() {
  const service = read('backend/services/electronicInvoiceDocumentService.js');
  const model = read('backend/models/ElectronicInvoice.js');

  [
    'downloadOfficialInvoiceDocument',
    'downloadInvoiceDocumentFromFactus',
    'resolveFactusInvoiceNumber',
    "crypto.createHash('sha256')",
    'officialDocuments.${documentType}',
  ].forEach((needle) => {
    assertIncludes(service, needle, `Servicio oficial incompleto: falta ${needle}`);
  });

  [
    'OfficialDocumentFileSchema',
    'officialDocuments',
    'lastDownloadedAt',
    'sha256',
  ].forEach((needle) => {
    assertIncludes(model, needle, `ElectronicInvoice no audita documentos oficiales: falta ${needle}`);
  });

  assertNotIncludes(service, 'sendInvoiceToFactus', 'Descargar un archivo nunca debe emitir una factura.');
  ok('PDF y XML oficiales se descargan sin invocar el motor de emisión');
}

async function validateFactusDownloads() {
  const {
    downloadInvoiceDocumentFromFactus,
  } = require('../lib/dian/providers/factusProvider');
  const originalFetch = global.fetch;
  const calls = [];
  const pdf = Buffer.from('%PDF-1.4\n%%EOF');
  const xml = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Invoice/>');
  const providerConfig = {
    apiUrl: 'https://factus-documents.test',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    username: 'facturacion@example.com',
    password: 'password',
  };

  global.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, method: options.method || 'GET' });

    if (target.endsWith('/oauth/token')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'token-documentos', token_type: 'Bearer', expires_in: 3600 }),
      };
    }

    if (target.endsWith('/download-pdf')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            file_name: 'fv-prueba',
            pdf_base_64_encoded: pdf.toString('base64'),
          },
        }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          file_name: 'fv-prueba',
          xml_base_64_encoded: xml.toString('base64'),
        },
      }),
    };
  };

  try {
    const pdfResult = await downloadInvoiceDocumentFromFactus({
      providerConfig,
      invoiceNumber: 'SETP990001',
      type: 'pdf',
    });
    const xmlResult = await downloadInvoiceDocumentFromFactus({
      providerConfig,
      invoiceNumber: 'SETP990001',
      type: 'xml',
    });

    assert(pdfResult.success && Buffer.isBuffer(pdfResult.buffer), 'PDF Factus no fue decodificado.');
    assert(xmlResult.success && Buffer.isBuffer(xmlResult.buffer), 'XML Factus no fue decodificado.');
    assert(pdfResult.buffer.equals(pdf), 'Contenido PDF cambió durante la descarga.');
    assert(xmlResult.buffer.equals(xml), 'Contenido XML cambió durante la descarga.');
    assert(pdfResult.fileName === 'fv-prueba.pdf', 'Nombre PDF no conserva la respuesta de Factus.');
    assert(xmlResult.fileName === 'fv-prueba.xml', 'Nombre XML no conserva la respuesta de Factus.');
    assert(
      calls.some((call) => call.url.endsWith('/v2/bills/SETP990001/download-pdf')),
      'No se consultó el endpoint PDF V2.'
    );
    assert(
      calls.some((call) => call.url.endsWith('/v2/bills/SETP990001/download-xml')),
      'No se consultó el endpoint XML V2.'
    );
  } finally {
    global.fetch = originalFetch;
  }

  ok('Factus V2 devuelve PDF y XML Base64 decodificados y con nombre seguro');
}

function validateNoEagerDownloads() {
  const provider = readFactusProviderSource();

  assertNotIncludes(
    provider,
    "console.log('📄 FACTUS PDF DOWNLOAD:'",
    'La emisión no debe imprimir ni descartar el PDF oficial.'
  );
  assertNotIncludes(
    provider,
    "error: 'No descargado todavía'",
    'La respuesta de emisión no debe fabricar descargas fallidas.'
  );

  const sendStart = provider.indexOf('async function sendInvoiceToFactus');
  const exportsStart = provider.indexOf('module.exports', sendStart);
  const sendBody = provider.slice(sendStart, exportsStart);
  assertNotIncludes(
    sendBody,
    'downloadFactusDocument({',
    'Emitir no debe descargar PDF/XML automáticamente.'
  );
  ok('La emisión no hace descargas anticipadas ni solicitudes adicionales a Factus');
}

function validateSyncIdentityAndStatus() {
  const {
    assertRemoteIdentity,
    normalizeRemoteStatus,
  } = require('../services/adminBillingSyncService');

  assert(
    normalizeRemoteStatus({ status: 1, is_validated: false }, 'invoice').localStatus === 'generated',
    'is_validated=false debe prevalecer sobre indicadores ambiguos.'
  );
  assert(
    normalizeRemoteStatus({ is_validated: true, cufe: 'CUFE-1' }, 'invoice').localStatus === 'accepted',
    'is_validated=true debe mapearse a accepted.'
  );
  assert(
    !assertRemoteIdentity({ requestedNumber: 'SETP 990001', remoteNumber: 'SETP990001' }),
    'El mismo número con espacios debe ser aceptado.'
  );
  assert(
    assertRemoteIdentity({ requestedNumber: 'SETP990001', remoteNumber: 'SETP990002' })?.code ===
      'BILLING_PROVIDER_IDENTITY_MISMATCH',
    'Un número remoto diferente debe bloquearse.'
  );
  assert(
    assertRemoteIdentity({
      requestedNumber: 'SETP990001',
      remoteNumber: 'SETP990001',
      storedProviderCufe: 'CUFE-1',
      remoteCufe: 'CUFE-2',
    })?.code === 'BILLING_PROVIDER_CUFE_MISMATCH',
    'Un CUFE remoto diferente debe bloquearse.'
  );
  ok('Sincronización conserva número/CUFE y respeta is_validated de Factus');
}

function validateProtectedRoutes() {
  const routes = read('backend/routes/orders.js');

  [
    "require('../services/electronicInvoiceDocumentService')",
    "type: 'pdf'",
    "type: 'xml'",
    "requirePermission('billing:download')",
    "X-Invoice-Document-Source",
    "Cache-Control', 'private, no-store'",
  ].forEach((needle) => {
    assertIncludes(routes, needle, `Rutas de descarga incompletas: falta ${needle}`);
  });

  ok('Rutas PDF/XML están autenticadas, autorizadas y sirven el archivo oficial');
}

function validateOrderReceiptSeparation() {
  const routes = read('backend/routes/orders.js');
  const orderDetail = read(
    'frontend/src/admin/orders/components/OrderDetailModal.jsx'
  );
  const billingApi = read('frontend/src/admin/billing/api/adminBillingApi.js');
  const invoiceDocuments = read(
    'frontend/src/admin/orders/electronicInvoice/InvoiceDocumentsTab.jsx'
  );

  [
    "'/:id/receipt-pdf'",
    "'X-Invoice-Document-Source', 'order-receipt'",
    'generateOrderPdf({',
  ].forEach((needle) => {
    assertIncludes(
      routes,
      needle,
      `El comprobante interno de la orden no conserva ${needle}`
    );
  });

  assertIncludes(
    orderDetail,
    '/api/orders/${order._id}/receipt-pdf',
    'El botón PDF del detalle no usa la ruta exclusiva del comprobante interno.'
  );
  assertNotIncludes(
    orderDetail,
    'api.get(`/api/orders/${order._id}/pdf`',
    'El botón PDF del detalle no debe intentar descargar la factura oficial.'
  );
  assertIncludes(
    billingApi,
    '/api/orders/${orderId}/pdf',
    'Facturación debe conservar la descarga protegida del PDF oficial.'
  );
  assertIncludes(
    invoiceDocuments,
    '/api/orders/${encodeURIComponent(orderId)}/pdf',
    'El modal de factura debe conservar el PDF oficial de Factus.'
  );

  ok('PDF de la orden y PDF oficial de Factus quedan separados sin reemplazarse');
}

function validateFrontendDownloads() {
  const api = read('frontend/src/admin/billing/api/adminBillingApi.js');
  const page = readBillingFrontendSource();
  const documents = read('frontend/src/admin/orders/electronicInvoice/InvoiceDocumentsTab.jsx');

  [
    'normalizeDownloadResponse',
    'content-disposition',
    'downloadBlob',
  ].forEach((needle) => assertIncludes(api, needle, `API de descarga incompleta: falta ${needle}`));

  [
    'downloadOrderPdf',
    'downloadOrderInvoiceXml',
    'downloadBlob',
  ].forEach((needle) => assertIncludes(page, needle, `Bandeja de documentos incompleta: falta ${needle}`));

  [
    'PDF oficial',
    'XML oficial',
    '/api/orders/${encodeURIComponent(orderId)}/pdf',
    '/api/orders/${encodeURIComponent(orderId)}/invoice-xml',
  ].forEach((needle) => assertIncludes(documents, needle, `Modal de documentos incompleto: falta ${needle}`));

  assertNotIncludes(
    page,
    'window.open(publicUrl',
    'PDF/XML oficiales no deben depender de un enlace público externo.'
  );
  ok('Bandeja y modal descargan PDF/XML oficiales a través del backend protegido');
}

function validatePackageScript() {
  const packageFile = read('backend/package.json');
  assertIncludes(
    packageFile,
    'test:billing-official-documents',
    'package.json no registra test:billing-official-documents.'
  );
  ok('Prueba de documentos oficiales registrada para ejecución desde terminal');
}

async function main() {
  console.log('\nValidando estados y documentos oficiales de Factus...');

  const steps = [
    validateOfficialDocumentArchitecture,
    validateFactusDownloads,
    validateNoEagerDownloads,
    validateSyncIdentityAndStatus,
    validateProtectedRoutes,
    validateOrderReceiptSeparation,
    validateFrontendDownloads,
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
    `\nResumen documentos oficiales -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`
  );

  if (results.fail > 0) process.exitCode = 1;
}

main();
