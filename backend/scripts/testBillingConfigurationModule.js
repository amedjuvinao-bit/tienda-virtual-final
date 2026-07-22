/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-configuration-test-key-32-characters-minimum';

const {
  BillingConfigurationError,
  FACTUS_API_URLS,
  buildRuntimeFactusConfig,
  calculateColombianNitDv,
  decryptBillingSecret,
  encryptBillingSecret,
  prepareBillingConfigurationForStorage,
  resolveFactusApiUrl,
} = require('../lib/billing/billingConfigurationSecurity');
const {
  buildAdminSiteSettings,
  stripProtectedWriteFields,
} = require('../lib/siteSettingsSecurity');

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

function assertThrowsCode(fn, expectedCode, message) {
  let captured = null;
  try {
    fn();
  } catch (error) {
    captured = error;
  }

  assert(captured, message || `Se esperaba el error ${expectedCode}.`);
  assert(
    captured.code === expectedCode,
    `Se esperaba ${expectedCode}, se recibió ${captured.code || captured.message}.`
  );
}

function validExternalBilling(overrides = {}) {
  return {
    fiscalInfo: {
      businessName: 'Tienda Virtual SAS',
      nit: '819003632',
      dv: '1',
      billingEmail: 'facturacion@tienda.test',
      address: 'Calle 1 # 2-3',
      city: 'Zona Bananera',
      municipalityCode: '47980',
      department: 'Magdalena',
      departmentCode: '47',
      country: 'CO',
    },
    dianResolution: {
      rangeFrom: 1,
      rangeTo: 1000,
      currentNumber: 1,
      documentType: '01',
    },
    dian: {
      enabled: true,
      mode: 'habilitation',
      environment: '2',
    },
    electronicProvider: {
      provider: 'factus',
      apiUrl: FACTUS_API_URLS.habilitacion,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      username: 'usuario@tienda.test',
      password: 'password-seguro',
    },
    taxes: {
      iva: {
        enabled: true,
        percent: 19,
        code: 'OTRO',
        name: 'Impuesto inventado',
      },
    },
    legalTexts: {},
    ...overrides,
  };
}

function validateOfficialUrls() {
  assert(
    resolveFactusApiUrl('habilitation') === 'https://api-sandbox.factus.com.co',
    'Habilitación debe usar exclusivamente el dominio sandbox oficial.'
  );
  assert(
    resolveFactusApiUrl('production') === 'https://api.factus.com.co',
    'Producción debe usar exclusivamente el dominio oficial de producción.'
  );

  assertThrowsCode(
    () =>
      prepareBillingConfigurationForStorage(
        validExternalBilling({
          electronicProvider: {
            ...validExternalBilling().electronicProvider,
            apiUrl: 'https://servidor-malicioso.example',
          },
        }),
        {}
      ),
    'FACTUS_API_URL_NOT_ALLOWED',
    'Una URL externa debe rechazarse antes de guardar credenciales.'
  );

  ok('Ambiente y URL Factus quedan unidos a dominios oficiales');
}

function validateAuthenticatedEncryption() {
  const encrypted = encryptBillingSecret('secreto-de-prueba');
  assert(encrypted.startsWith('billing:v1:'), 'El secreto debe usar formato versionado.');
  assert(!encrypted.includes('secreto-de-prueba'), 'El texto plano no debe quedar almacenado.');
  assert(
    decryptBillingSecret(encrypted) === 'secreto-de-prueba',
    'El cifrado autenticado debe poder descifrarse con la misma llave.'
  );

  const prepared = prepareBillingConfigurationForStorage(validExternalBilling(), {});
  assert(
    prepared.electronicProvider.clientSecret.startsWith('billing:v1:'),
    'Client Secret debe persistirse cifrado.'
  );
  assert(
    prepared.electronicProvider.password.startsWith('billing:v1:'),
    'La contraseña Factus debe persistirse cifrada.'
  );

  const runtime = buildRuntimeFactusConfig(prepared);
  assert(runtime.clientSecret === 'client-secret', 'El proveedor debe recibir el Client Secret descifrado.');
  assert(runtime.password === 'password-seguro', 'El proveedor debe recibir la contraseña descifrada.');

  const safe = buildAdminSiteSettings({ billing: prepared });
  assert(
    safe.billing.electronicProvider.clientSecret === undefined,
    'El navegador no debe recibir el Client Secret cifrado ni en texto plano.'
  );
  assert(
    safe.billing.electronicProvider.password === undefined,
    'El navegador no debe recibir la contraseña cifrada ni en texto plano.'
  );

  ok('Credenciales Factus usan AES-256-GCM y permanecen ocultas al navegador');
}

function validateProviderAndTaxRestrictions() {
  assertThrowsCode(
    () =>
      prepareBillingConfigurationForStorage(
        validExternalBilling({
          electronicProvider: {
            ...validExternalBilling().electronicProvider,
            provider: 'siigo',
          },
        }),
        {}
      ),
    'BILLING_PROVIDER_NOT_IMPLEMENTED'
  );

  const prepared = prepareBillingConfigurationForStorage(validExternalBilling(), {});
  assert(prepared.dian.mode === 'habilitacion', 'El modo debe normalizarse al valor del backend.');
  assert(prepared.electronicProvider.provider === 'factus', 'Factus debe ser el único proveedor externo.');
  assert(prepared.taxes.iva.code === '01', 'El código tributario debe coincidir con IVA.');
  assert(prepared.taxes.iva.name === 'IVA', 'El nombre tributario debe coincidir con IVA.');

  ok('Proveedores simulados e impuestos no implementados quedan bloqueados');
}

function validateFiscalRules() {
  assert(calculateColombianNitDv('819003632') === '1', 'El cálculo del DV debe ser correcto.');

  assertThrowsCode(
    () =>
      prepareBillingConfigurationForStorage(
        validExternalBilling({
          fiscalInfo: {
            ...validExternalBilling().fiscalInfo,
            dv: '9',
          },
        }),
        {}
      ),
    'BILLING_NIT_DV_INVALID'
  );

  assertThrowsCode(
    () =>
      prepareBillingConfigurationForStorage(
        validExternalBilling({
          dianResolution: {
            rangeFrom: 100,
            rangeTo: 10,
            currentNumber: 50,
          },
        }),
        {}
      ),
    'BILLING_RANGE_INVALID'
  );

  ok('NIT, DV, fechas y rangos fiscales tienen validación autoritativa');
}

function validateProductionFailClosed() {
  assertThrowsCode(
    () =>
      prepareBillingConfigurationForStorage(
        validExternalBilling({
          dian: {
            enabled: true,
            mode: 'production',
            environment: '1',
          },
          electronicProvider: {
            ...validExternalBilling().electronicProvider,
            apiUrl: FACTUS_API_URLS.production,
          },
        }),
        {}
      ),
    'BILLING_PRODUCTION_NOT_READY'
  );

  ok('Producción queda bloqueada sin conexión verificada y rangos oficiales');
}

function validateDedicatedWriteBoundary() {
  assertThrowsCode(
    () =>
      stripProtectedWriteFields({
        'billing.electronicProvider.provider': 'factus',
      }),
    'BILLING_DEDICATED_ENDPOINT_REQUIRED'
  );

  const indexFile = read('backend/index.js');
  const protectedRouteIndex = indexFile.indexOf("app.use('/api/site-settings', billingSettingsProtectionRoutes)");
  const genericRouteIndex = indexFile.indexOf("app.use('/api/site-settings', siteSettingsRoutes)");
  assert(protectedRouteIndex >= 0, 'La ruta fiscal protegida debe estar montada.');
  assert(genericRouteIndex > protectedRouteIndex, 'La ruta fiscal protegida debe ejecutarse antes que la genérica.');

  const protectedRoute = read('backend/routes/billingSettingsProtection.js');
  assert(protectedRoute.includes("requirePermission('billing:settings')"), 'Guardar debe exigir billing:settings.');
  assert(protectedRoute.includes('updateBillingConfiguration'), 'Guardar debe usar el servicio validado.');

  ok('Escritura fiscal sale de la ruta genérica con runValidators desactivado');
}

function validateRealConnectionAndRuntimeBoundary() {
  const testRoute = read('backend/routes/dianProviderTest.js');
  const service = read('backend/services/billingConfigurationService.js');
  const adapter = read('backend/lib/dian/providerAdapter.js');

  assert(!testRoute.includes('config_ready'), 'La prueba no debe aprobar solo por tener campos.');
  assert(!testRoute.includes('mock_ready'), 'La prueba no debe simular conexión exitosa.');
  assert(service.includes('getFactusAccessToken'), 'La prueba debe autenticar realmente con Factus.');
  assert(service.includes('/v2/companies'), 'La prueba debe verificar la empresa vinculada.');
  assert(adapter.includes('buildRuntimeFactusConfig'), 'La emisión debe descifrar y validar la configuración.');
  ['dianDirectProvider', 'carvajalProvider', 'siigoProvider', 'alegraProvider'].forEach((name) => {
    assert(!adapter.includes(name), `${name} no debe estar disponible en el adaptador de producción.`);
  });

  ok('Prueba de conexión y emisión atraviesan la misma frontera segura de Factus');
}

function validateScriptRegistered() {
  const packageFile = read('backend/package.json');
  assert(
    packageFile.includes('test:billing-configuration'),
    'package.json debe registrar test:billing-configuration.'
  );
  ok('Prueba de configuración registrada para ejecución desde terminal');
}

function main() {
  console.log('\nValidando Configuración de Facturación...');

  const tests = [
    validateOfficialUrls,
    validateAuthenticatedEncryption,
    validateProviderAndTaxRestrictions,
    validateFiscalRules,
    validateProductionFailClosed,
    validateDedicatedWriteBoundary,
    validateRealConnectionAndRuntimeBoundary,
    validateScriptRegistered,
  ];

  tests.forEach((test) => {
    try {
      test();
    } catch (error) {
      fail(test.name, error);
    }
  });

  console.log(
    `\nResumen Configuración Facturación -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`
  );
  if (results.fail > 0) process.exit(1);
}

main();