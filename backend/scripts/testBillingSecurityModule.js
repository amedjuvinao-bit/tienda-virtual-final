/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const { readBillingFrontendSource } = require('./lib/readBillingFrontendSource');
const {
  readBillingConfigurationFrontendSource,
} = require('./lib/readBillingConfigurationFrontendSource');

const {
  buildAdminSiteSettings,
  buildPublicSiteSettings,
  stripProtectedWriteFields,
} = require('../lib/siteSettingsSecurity');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

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

function buildUnsafeSettingsFixture() {
  return {
    store: { name: 'Tienda segura' },
    admin: { theme: { preset: 'rose' } },
    theme: {
      global: {
        payments: {
          provider: 'wompi',
          credentials: {
            wompi: {
              publicKey: 'pub_test_123',
              privateKey: 'private_test_123',
              integrityKey: 'integrity_test_123',
            },
            payu: {
              merchantId: 'merchant-1',
              apiKey: 'payu-secret-123',
            },
          },
        },
      },
    },
    billing: {
      dianResolution: {
        resolutionNumber: '1876',
        technicalKey: 'technical-secret-123',
      },
      electronicProvider: {
        provider: 'factus',
        apiUrl: 'https://api-sandbox.factus.com.co',
        clientId: 'client-id-visible-admin',
        clientSecret: 'factus-client-secret',
        username: 'factus-user',
        password: 'factus-password',
      },
    },
  };
}

function validatePublicSettingsRedaction() {
  const safe = buildPublicSiteSettings(buildUnsafeSettingsFixture());
  const serialized = JSON.stringify(safe);

  assert(!safe.billing, 'La respuesta pública no debe incluir billing.');
  assert(!safe?.theme?.global?.payments?.credentials, 'La respuesta pública no debe incluir credenciales de pagos.');
  ['factus-client-secret', 'factus-password', 'payu-secret-123', 'integrity_test_123'].forEach((secret) => {
    assert(!serialized.includes(secret), `La respuesta pública filtró el secreto ${secret}.`);
  });

  ok('GET público conserva apariencia y elimina credenciales de facturación y pagos');
}

function validateAdminSettingsRedaction() {
  const safe = buildAdminSiteSettings(buildUnsafeSettingsFixture());
  const provider = safe?.billing?.electronicProvider || {};

  assert(provider.clientId === 'client-id-visible-admin', 'El panel debe conservar el Client ID no secreto.');
  assert(provider.username === 'factus-user', 'El panel debe conservar el usuario no secreto.');
  assert(provider.clientSecret === undefined, 'El panel no debe recibir Client Secret.');
  assert(provider.password === undefined, 'El panel no debe recibir contraseña Factus.');
  assert(
    safe?._credentialStatus?.['billing.electronicProvider.clientSecret'] === true,
    'El panel debe saber que Client Secret está configurado.'
  );
  assert(
    safe?._credentialStatus?.['billing.electronicProvider.password'] === true,
    'El panel debe saber que la contraseña está configurada.'
  );

  ok('Respuesta administrativa informa credenciales configuradas sin devolver su valor');
}

function validateDedicatedBillingWriteBoundary() {
  const filtered = stripProtectedWriteFields({
    'theme.global.payments.credentials.wompi.integrityKey': 'new-integrity-key',
    'theme._credentialStatus.password': true,
  });

  assert(
    filtered['theme.global.payments.credentials.wompi.integrityKey'] === 'new-integrity-key',
    'Un secreto nuevo de pagos debe poder reemplazar al anterior.'
  );
  assert(
    !('theme._credentialStatus.password' in filtered),
    'Metadatos internos no deben guardarse.'
  );

  let billingError = null;
  try {
    stripProtectedWriteFields({
      'billing.electronicProvider.clientSecret': 'nuevo-secreto',
    });
  } catch (error) {
    billingError = error;
  }

  assert(billingError, 'La ruta genérica debe bloquear cualquier escritura de billing.');
  assert(
    billingError.code === 'BILLING_DEDICATED_ENDPOINT_REQUIRED',
    'La escritura fiscal debe redirigirse a la ruta protegida.'
  );

  ok('Configuración fiscal queda aislada de la ruta genérica de apariencia');
}

function validateBackendPermissions() {
  const expectations = [
    ['POST', '/api/admin/billing/orders/507f1f77bcf86cd799439011/generate', 'billing:create'],
    ['POST', '/api/admin/billing/documents/507f1f77bcf86cd799439011/sync', 'billing:retry'],
    ['POST', '/api/payments/admin/delete-factus-invoice/507f1f77bcf86cd799439011', 'billing:retry'],
    ['POST', '/api/payments/admin/create-credit-note/507f1f77bcf86cd799439011', 'billing:credit_note'],
    ['POST', '/api/payments/admin/retry-electronic-invoice/507f1f77bcf86cd799439011', 'billing:retry'],
    ['GET', '/api/orders/507f1f77bcf86cd799439011/invoice-xml', 'billing:download'],
    ['GET', '/api/site-settings/admin', 'settings:view'],
  ];

  expectations.forEach(([method, route, permission]) => {
    const rule = findAdminRoutePermission(method, route);
    assert(rule?.permission === permission, `${method} ${route} debe exigir ${permission}.`);
    assert(rule?.knownPermission === true, `El permiso ${permission} debe existir en el catálogo.`);
  });

  const billingRoutes = read('backend/routes/adminBilling.js');
  const paymentRoutes = read('backend/routes/payments.js');
  const providerRoutes = read('backend/routes/dianProviderTest.js');
  const protectedSettings = read('backend/routes/billingSettingsProtection.js');

  assertIncludes(billingRoutes, "requirePermission('billing:create')", 'Generar factura debe exigir billing:create.');
  assertIncludes(paymentRoutes, "requirePermission('billing:credit_note')", 'Nota crédito debe exigir billing:credit_note.');
  assertIncludes(paymentRoutes, "requirePermission('billing:retry')", 'Reintentos y eliminación pendiente deben exigir billing:retry.');
  assertIncludes(providerRoutes, "requirePermission('billing:settings')", 'Prueba de proveedor debe exigir billing:settings.');
  assertIncludes(protectedSettings, "requirePermission('billing:settings')", 'Guardar configuración debe exigir billing:settings.');

  ok('Backend exige permisos específicos para consultar, configurar, generar, sincronizar y acreditar');
}

function validateNoCredentialLeaksInPaymentResponses() {
  const paymentRoutes = read('backend/routes/payments.js');
  const accessGate = read('backend/middleware/adminAccessGate.js');

  assertNotIncludes(paymentRoutes, "integrityKeyLength: String(wompi.integrityKey", 'No debe registrar la llave de integridad Wompi.');
  assertNotIncludes(paymentRoutes, "'📦 BODY WEBHOOK:'", 'No debe registrar el cuerpo completo del webhook.');
  assertNotIncludes(paymentRoutes, "'🔐 HEADER CHECKSUM:'", 'No debe registrar la firma recibida del webhook.');
  assertNotIncludes(paymentRoutes, 'apiKey: payu.apiKey,', 'No debe devolver API Key de PayU al navegador.');
  assertNotIncludes(paymentRoutes, 'apiLogin: payu.apiLogin,', 'No debe devolver API Login de PayU al navegador.');
  ['integrityKey', 'softwarePin', 'technicalKey', 'certificatePath', 'apiLogin'].forEach((key) => {
    assertIncludes(accessGate, `'${key}'`, `La auditoría administrativa debe ocultar ${key}.`);
  });

  ok('Respuestas y logs de pagos no exponen llaves, firmas ni credenciales');
}

function validateFrontendPermissionAwareness() {
  const page = readBillingFrontendSource();
  const modal = read('frontend/src/admin/orders/electronicInvoice/ElectronicInvoiceModal.jsx');
  const settings = readBillingConfigurationFrontendSource();
  const provider = read('frontend/src/admin/configuracion/sections/facturacion/ElectronicProviderBlock.jsx');

  ['billing:view', 'billing:create', 'billing:retry', 'billing:download', 'billing:settings'].forEach((permission) => {
    assertIncludes(page, permission, `La bandeja debe reconocer ${permission}.`);
  });
  assertIncludes(modal, "can('billing:credit_note')", 'El modal debe ocultar nota crédito sin permiso.');
  assertIncludes(settings, '/api/site-settings/admin', 'La configuración debe usar la respuesta administrativa protegida.');
  assertIncludes(provider, 'Credencial configurada y protegida.', 'El formulario debe indicar secretos protegidos.');
  assertIncludes(provider, 'type="password"', 'Los secretos deben mostrarse como campos de contraseña.');

  ok('Interfaz oculta acciones no autorizadas y no vuelve a mostrar secretos guardados');
}

function validateScriptRegistered() {
  const packageFile = read('backend/package.json');
  assertIncludes(packageFile, 'test:billing-security', 'package.json debe registrar test:billing-security.');
  assertIncludes(packageFile, 'test:billing-configuration', 'package.json debe registrar test:billing-configuration.');
  ok('Pruebas de seguridad y configuración registradas para ejecución desde terminal');
}

function main() {
  console.log('\nValidando seguridad del módulo de Facturación...');

  try {
    validatePublicSettingsRedaction();
    validateAdminSettingsRedaction();
    validateDedicatedBillingWriteBoundary();
    validateBackendPermissions();
    validateNoCredentialLeaksInPaymentResponses();
    validateFrontendPermissionAwareness();
    validateScriptRegistered();
  } catch (error) {
    fail('Error validando seguridad de Facturación', error);
  } finally {
    console.log(`\nResumen seguridad Facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);
    if (results.fail > 0) process.exit(1);
  }
}

main();
