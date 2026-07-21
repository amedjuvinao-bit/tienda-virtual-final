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
  const providerFile = read('backend/lib/dian/providers/factusProvider.js');
  const modelFile = read('backend/models/ElectronicInvoice.js');

  [
    'syncInvoice',
    'syncCreditNote',
    "require('../models/ElectronicInvoice')",
    "require('../models/SiteSettings')",
    'getInvoiceFromFactus',
    'getCreditNoteFromFactus',
    'extractRemoteDocument',
    'normalizeRemoteStatus',
    'resolveFactusInvoiceNumber',
    'provider_number_missing',
    'serializeElectronicInvoice',
    'serializeCreditNote',
    'billingSync',
    "source: 'admin-billing'",
  ].forEach((needle) => {
    assertIncludes(serviceFile, needle, `Servicio de sincronización no está completo: falta ${needle}`);
  });

  [
    '/v2/${resource}/${safeNumber}',
    'getInvoiceFromFactus',
    'getCreditNoteFromFactus',
  ].forEach((needle) => {
    assertIncludes(providerFile, needle, `Consulta real de Factus incompleta: falta ${needle}`);
  });

  ['BillingSyncSchema', 'lastAttemptAt', 'lastSuccessAt'].forEach((needle) => {
    assertIncludes(modelFile, needle, `ElectronicInvoice no conserva trazabilidad de sincronización: falta ${needle}`);
  });

  assertNotIncludes(serviceFile, "require('../models/Invoice')", 'No debe usarse modelo Invoice paralelo.');
  assertNotIncludes(
    serviceFile,
    'function normalizeInvoiceStatus(invoice',
    'La sincronización no puede limitarse a releer el estado local.'
  );
  ok('Servicio consulta Factus y sincroniza facturas/notas en ElectronicInvoice');
}

function validateProviderResponseNormalization() {
  const {
    extractRemoteDocument,
    normalizeRemoteStatus,
    resolveFactusInvoiceNumber,
  } = require('../services/adminBillingSyncService');

  const invoice = extractRemoteDocument({
    data: {
      bill: {
        number: 'SETP990001',
        status: 1,
        cufe: 'cufe-prueba',
      },
    },
  }, 'invoice');
  const creditNote = extractRemoteDocument({
    data: {
      data: {
        credit_note: {
          number: 'NC990001',
          status: 0,
          is_validated: false,
        },
      },
    },
  }, 'credit-note');

  assert(invoice.number === 'SETP990001', 'No se extrajo la factura del formato de respuesta de Factus.');
  assert(creditNote.number === 'NC990001', 'No se extrajo la nota crédito del formato de respuesta de Factus.');
  assert(normalizeRemoteStatus(invoice, 'invoice').localStatus === 'accepted', 'Factura validada debe quedar aceptada.');
  assert(normalizeRemoteStatus(creditNote, 'credit-note').localStatus === 'pending', 'Nota no validada debe quedar pendiente.');
  assert(normalizeRemoteStatus({ status: 'rejected' }, 'invoice').localStatus === 'rejected', 'Rechazo remoto debe conservarse.');
  assert(normalizeRemoteStatus({ status: 'failed' }, 'credit-note').localStatus === 'failed', 'Fallo remoto debe conservarse.');
  assert(
    resolveFactusInvoiceNumber({
      invoiceNumber: 'FE000027',
      provider: {
        number: 'FE000027',
        raw: { source: 'admin-billing', mode: 'sandbox' },
      },
    }) === '',
    'Un consecutivo interno no debe consultarse como número Factus.'
  );
  assert(
    resolveFactusInvoiceNumber({
      invoiceNumber: 'FE000027',
      provider: {
        number: 'FE000027',
        raw: { data: { bill: { number: 'SETP990007806', status: 1 } } },
      },
    }) === 'SETP990007806',
    'Debe recuperarse el número real desde la respuesta guardada de Factus.'
  );
  assert(
    resolveFactusInvoiceNumber({
      invoiceNumber: 'SETP990007801',
      provider: { number: 'SETP990007801', raw: {} },
    }) === 'SETP990007801',
    'Las facturas históricas con número Factus deben seguir sincronizando.'
  );

  ok('Estados, respuestas y números reales de Factus se normalizan correctamente');
}

async function validateFactusQueries() {
  const {
    getCreditNoteFromFactus,
    getInvoiceFromFactus,
  } = require('../lib/dian/providers/factusProvider');
  const originalFetch = global.fetch;
  const calls = [];
  const providerConfig = {
    apiUrl: 'https://factus.test',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    username: 'facturacion@example.com',
    password: 'password',
  };

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method });

    if (String(url).endsWith('/oauth/token')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'token-prueba', token_type: 'Bearer', expires_in: 3600 }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { number: 'documento-prueba', status: 1 } }),
    };
  };

  try {
    const invoiceResult = await getInvoiceFromFactus({ providerConfig, invoiceNumber: 'SETP 990001' });
    const noteResult = await getCreditNoteFromFactus({ providerConfig, creditNoteNumber: 'NC 990001' });

    assert(invoiceResult.success, 'La consulta simulada de factura debe ser exitosa.');
    assert(noteResult.success, 'La consulta simulada de nota crédito debe ser exitosa.');
    assert(calls.some((call) => call.url === 'https://factus.test/v2/bills/SETP%20990001'), 'Factura no consultó GET /v2/bills/:number.');
    assert(calls.some((call) => call.url === 'https://factus.test/v2/credit-notes/NC%20990001'), 'Nota crédito no consultó GET /v2/credit-notes/:number.');

    global.fetch = async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    };

    const timeoutResult = await getInvoiceFromFactus({
      providerConfig: { ...providerConfig, apiUrl: 'https://factus-timeout.test' },
      invoiceNumber: 'SETP990002',
    });
    assert(timeoutResult.success === false, 'Timeout de Factus debe devolverse como resultado controlado.');
    assert(timeoutResult.status === 503, 'Timeout de Factus debe mapearse a HTTP 503.');
    assert(timeoutResult.stage === 'auth', 'Timeout de autenticación debe identificar la etapa auth.');
  } finally {
    global.fetch = originalFetch;
  }

  ok('Cliente Factus consulta los endpoints oficiales por número');
}

function validateBackendRoutes() {
  const routeFile = read('backend/routes/adminBilling.js');
  const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');

  [
    "require('../services/adminBillingSyncService')",
    '/documents/:invoiceId/sync',
    '/credit-notes/:invoiceId/:noteId/sync',
    'billingSyncService.syncInvoice',
    'billingSyncService.syncCreditNote',
    "requirePermission('billing:retry')",
  ].forEach((needle) => {
    assertIncludes(routeFile, needle, `Rutas de sincronización no están montadas: falta ${needle}`);
  });

  const invoiceRule = findAdminRoutePermission(
    'POST',
    '/api/admin/billing/documents/507f1f77bcf86cd799439011/sync'
  );
  const creditNoteRule = findAdminRoutePermission(
    'POST',
    '/api/admin/billing/credit-notes/507f1f77bcf86cd799439011/507f191e810c19729de860ea/sync'
  );

  [invoiceRule, creditNoteRule].forEach((rule) => {
    assert(rule?.permission === 'billing:retry', 'Ruta de sincronización debe exigir billing:retry.');
    assert(rule?.knownPermission === true, 'Permiso billing:retry debe existir en el catálogo.');
    assert(rule?.audit === true, 'La sincronización debe quedar marcada para auditoría.');
  });

  ok('Rutas admin de sincronización están protegidas y auditadas');
}

function validateFrontendSync() {
  const apiFile = read('frontend/src/admin/billing/api/adminBillingApi.js');
  const billingPageFile = read('frontend/src/admin/billing/AdminBillingPage.jsx');
  const invoiceModalFile = read('frontend/src/admin/orders/electronicInvoice/ElectronicInvoiceModal.jsx');
  const mainFile = read('frontend/src/main.jsx');

  [
    'syncBillingDocument',
    'syncBillingCreditNote',
    '/api/admin/billing/documents/',
    '/api/admin/billing/credit-notes/',
  ].forEach((needle) => {
    assertIncludes(apiFile, needle, `API frontend de sincronización no contiene ${needle}`);
  });

  ['syncBillingDocument', 'syncBillingCreditNote', 'Sincronizar'].forEach((needle) => {
    assertIncludes(billingPageFile, needle, `Pantallas de Facturación no contienen ${needle}`);
  });

  ['syncBillingDocument', 'handleSyncInvoice', 'Última sincronización'].forEach((needle) => {
    assertIncludes(invoiceModalFile, needle, `Modal de factura no contiene ${needle}`);
  });

  assertNotIncludes(mainFile, 'billingSyncBridge', 'main.jsx no debe depender de manipulación DOM para sincronizar.');
  assert(
    !fs.existsSync(path.join(PROJECT_ROOT, 'frontend/src/admin/billing/billingSyncBridge.js')),
    'No debe conservarse el bridge DOM de sincronización.'
  );
  ok('Frontend sincroniza de forma nativa en Documentos, Notas crédito y modal');
}

function validatePackageScript() {
  const packageFile = read('backend/package.json');
  assertIncludes(packageFile, 'test:billing-sync', 'package.json debe registrar test:billing-sync.');
  assertIncludes(packageFile, 'billing:sync:live', 'package.json debe registrar billing:sync:live.');
  ok('Scripts test:billing-sync y billing:sync:live registrados');
}

function validateLiveSyncScript() {
  const liveScript = read('backend/scripts/syncFactusLive.js');

  [
    "require('../services/adminBillingSyncService')",
    'syncInvoice',
    'syncCreditNote',
    '--invoice',
    '--credit-note',
    'assertCredentials',
    'Factus respondió y el nuevo estado quedó guardado en MongoDB',
  ].forEach((needle) => {
    assertIncludes(liveScript, needle, `Script de prueba real incompleto: falta ${needle}`);
  });

  assertNotIncludes(liveScript, 'deleteMany(', 'La prueba real no debe eliminar registros.');
  assertNotIncludes(liveScript, 'ElectronicInvoice.create(', 'La prueba real no debe crear facturas.');
  ok('Script real valida una factura o nota sin crear ni eliminar documentos');
}

async function main() {
  console.log('\nValidando sincronización de Facturación...');

  for (const step of [
    validateBackendSyncService,
    validateProviderResponseNormalization,
    validateFactusQueries,
    validateBackendRoutes,
    validateFrontendSync,
    validatePackageScript,
    validateLiveSyncScript,
  ]) {
    try {
      await step();
    } catch (error) {
      fail(step.name, error);
    }
  }

  console.log(`\nResumen sincronización facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
  if (results.fail > 0) process.exit(1);
}

main().catch((error) => {
  fail('main', error);
  process.exit(1);
});
