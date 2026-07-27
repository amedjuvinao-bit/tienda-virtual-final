/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-configuration-test-key-32-characters-minimum';

const {
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

const ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, fail: 0 };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function read(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function expectCode(fn, code) {
  let captured = null;
  try {
    fn();
  } catch (error) {
    captured = error;
  }
  assert(captured, `Se esperaba el error ${code}.`);
  assert(captured.code === code, `Se esperaba ${code}, llegó ${captured.code || captured.message}.`);
}

function validBilling(overrides = {}) {
  const base = {
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
    dian: { enabled: true, mode: 'habilitation', environment: '2' },
    electronicProvider: {
      provider: 'factus',
      apiUrl: FACTUS_API_URLS.habilitacion,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      username: 'usuario@tienda.test',
      password: 'password-seguro',
    },
    taxes: {
      iva: { enabled: true, percent: 19, code: 'OTRO', name: 'Otro' },
    },
    legalTexts: {},
  };

  return {
    ...base,
    ...overrides,
    fiscalInfo: { ...base.fiscalInfo, ...(overrides.fiscalInfo || {}) },
    dianResolution: { ...base.dianResolution, ...(overrides.dianResolution || {}) },
    dian: { ...base.dian, ...(overrides.dian || {}) },
    electronicProvider: {
      ...base.electronicProvider,
      ...(overrides.electronicProvider || {}),
    },
    taxes: { ...base.taxes, ...(overrides.taxes || {}) },
  };
}

function testOfficialUrlBoundary() {
  assert(
    resolveFactusApiUrl('habilitation') === 'https://api-sandbox.factus.com.co',
    'Habilitación debe usar el dominio sandbox oficial.'
  );
  assert(
    resolveFactusApiUrl('production') === 'https://api.factus.com.co',
    'Producción debe usar el dominio oficial.'
  );
  expectCode(
    () =>
      prepareBillingConfigurationForStorage(
        validBilling({ electronicProvider: { apiUrl: 'https://malicioso.example' } }),
        {}
      ),
    'FACTUS_API_URL_NOT_ALLOWED'
  );
  ok('Factus solo usa URLs oficiales derivadas del ambiente');
}

function testEncryptionAndRedaction() {
  const encrypted = encryptBillingSecret('secreto-prueba');
  assert(encrypted.startsWith('billing:v1:'), 'El secreto debe quedar versionado.');
  assert(!encrypted.includes('secreto-prueba'), 'No puede persistirse texto plano.');
  assert(decryptBillingSecret(encrypted) === 'secreto-prueba', 'El descifrado debe ser íntegro.');

  const prepared = prepareBillingConfigurationForStorage(validBilling(), {});
  assert(prepared.electronicProvider.clientSecret.startsWith('billing:v1:'), 'Client Secret sin cifrar.');
  assert(prepared.electronicProvider.password.startsWith('billing:v1:'), 'Contraseña sin cifrar.');

  const runtime = buildRuntimeFactusConfig(prepared);
  assert(runtime.clientSecret === 'client-secret', 'Runtime no recuperó Client Secret.');
  assert(runtime.password === 'password-seguro', 'Runtime no recuperó contraseña.');

  const safe = buildAdminSiteSettings({ billing: prepared });
  assert(safe.billing.electronicProvider.clientSecret === undefined, 'Client Secret llegó al navegador.');
  assert(safe.billing.electronicProvider.password === undefined, 'Contraseña llegó al navegador.');
  ok('Credenciales usan AES-256-GCM y no regresan al navegador');
}

function testAuthoritativeValidation() {
  expectCode(
    () => prepareBillingConfigurationForStorage(validBilling({ electronicProvider: { provider: 'siigo' } }), {}),
    'BILLING_PROVIDER_NOT_IMPLEMENTED'
  );
  expectCode(
    () => prepareBillingConfigurationForStorage(validBilling({ fiscalInfo: { dv: '9' } }), {}),
    'BILLING_NIT_DV_INVALID'
  );
  expectCode(
    () =>
      prepareBillingConfigurationForStorage(
        validBilling({ dianResolution: { rangeFrom: 100, rangeTo: 10, currentNumber: 50 } }),
        {}
      ),
    'BILLING_RANGE_INVALID'
  );

  const prepared = prepareBillingConfigurationForStorage(validBilling(), {});
  assert(calculateColombianNitDv('819003632') === '1', 'Cálculo de DV incorrecto.');
  assert(prepared.dian.mode === 'habilitacion', 'Modo no normalizado.');
  assert(prepared.electronicProvider.provider === 'factus', 'Proveedor externo distinto de Factus.');
  assert(prepared.taxes.iva.code === '01' && prepared.taxes.iva.name === 'IVA', 'Impuesto incoherente.');
  ok('NIT, DV, rangos, proveedor e IVA tienen validación autoritativa');
}

function testProductionFailClosed() {
  expectCode(
    () =>
      prepareBillingConfigurationForStorage(
        validBilling({
          dian: { mode: 'production', environment: '1' },
          electronicProvider: { apiUrl: FACTUS_API_URLS.production },
        }),
        {}
      ),
    'BILLING_PRODUCTION_NOT_READY'
  );
  ok('Producción queda bloqueada sin conexión y rangos verificados');
}

function testCredentialRotationAndRevocation() {
  const current = prepareBillingConfigurationForStorage(validBilling(), {});
  const cleared = prepareBillingConfigurationForStorage(
    {
      ...validBilling(),
      dian: { enabled: false, mode: 'internal', environment: '2' },
      electronicProvider: {
        provider: 'mock',
        clearCredentials: true,
      },
    },
    current
  );

  assert(!cleared.electronicProvider.clientSecret, 'Client Secret no fue eliminado.');
  assert(!cleared.electronicProvider.password, 'Contraseña no fue eliminada.');
  assert(cleared.electronicProvider.numberingRangeId === 0, 'Rango sobrevivió a la revocación.');
  assert(cleared.dianResolution.technicalKey === '', 'Clave técnica sobrevivió a la revocación.');

  const provider = read('backend/lib/dian/providers/factusProvider.js');
  assert(provider.includes('clearFactusTokenCache'), 'No existe invalidación explícita del token.');
  assert(provider.includes('credentials.clientSecret'), 'La caché no depende del Client Secret.');
  assert(provider.includes('credentials.password'), 'La caché no depende de la contraseña.');
  ok('Credenciales pueden rotarse o eliminarse e invalidan el token anterior');
}

function testConcurrencyAndHistory() {
  const model = read('backend/models/SiteSettings.js');
  const service = read('backend/services/billingConfigurationService.js');
  const route = read('backend/routes/billingSettingsProtection.js');
  const frontend = read(
    'frontend/src/admin/configuracion/sections/FacturacionSection.jsx'
  );

  assert(model.includes('billingRevision'), 'El modelo no versiona la configuración.');
  assert(model.includes('billingHistory'), 'El modelo no conserva historial.');
  assert(service.includes('BILLING_CONFIGURATION_CONFLICT'), 'No bloquea escrituras obsoletas.');
  assert(service.includes('$slice: -BILLING_HISTORY_LIMIT'), 'El historial no tiene límite.');
  assert(route.includes("'/billing-history'"), 'No existe consulta de historial.');
  assert(route.includes("'/billing-history/:historyId/restore'"), 'No existe restauración.');
  assert(frontend.includes('billingRevision'), 'El navegador no envía la revisión editada.');
  assert(frontend.includes('beforeunload'), 'No advierte cambios sin guardar.');
  assert(frontend.includes('Confirmar restauración'), 'Restauración no exige confirmación.');
  ok('Edición concurrente, historial, restauración y cambios sin guardar quedan controlados');
}

function testSuccessfulSaveClearsUnsavedChanges() {
  const frontend = read(
    'frontend/src/admin/configuracion/sections/FacturacionSection.jsx'
  );
  const applySettingsStart = frontend.indexOf('const applySettings');
  const loadHistoryStart = frontend.indexOf('const loadHistory');
  const persistBillingStart = frontend.indexOf('const persistBilling');
  const handleRestoreStart = frontend.indexOf('const handleRestoreVersion');
  const applySettingsBlock = frontend.slice(applySettingsStart, loadHistoryStart);
  const persistBillingBlock = frontend.slice(
    persistBillingStart,
    handleRestoreStart
  );

  assert(
    frontend.includes(
      'const savedBillingSnapshotRef = useRef(JSON.stringify(EMPTY_BILLING))'
    ),
    'El formulario no conserva la referencia de la configuración confirmada.'
  );
  assert(
    frontend.includes(
      'JSON.stringify(billing) !== savedBillingSnapshotRef.current'
    ),
    'El aviso no se calcula contra la última configuración confirmada.'
  );
  assert(
    applySettingsBlock.includes(
      'savedBillingSnapshotRef.current = JSON.stringify(nextBilling)'
    ),
    'Aplicar la respuesta del backend no actualiza la referencia guardada.'
  );
  assert(
    frontend.includes('const markFormChanged') &&
      !frontend.includes('setHasUnsavedChanges('),
    'El aviso todavía depende de activaciones manuales que pueden quedar desincronizadas.'
  );
  assert(
    persistBillingBlock.includes(
      '`/api/site-settings/admin?refresh=${Date.now()}`'
    ),
    'Siguiente no vuelve a consultar el servidor para confirmar la persistencia.'
  );
  assert(
    persistBillingBlock.includes('billingStepWasPersisted('),
    'Siguiente no verifica que la etapa actual haya quedado persistida.'
  );
  assert(
    persistBillingBlock.includes('applySettings(persistedSettings)'),
    'Siguiente no aplica la configuración recargada desde el servidor.'
  );
  assert(
    !persistBillingBlock.includes('setHasUnsavedChanges(false)'),
    'Siguiente todavía fuerza el aviso sin sincronizar la referencia persistida.'
  );

  ok('El aviso compara el borrador con la respuesta realmente guardada');
}

function testLegalTextsPersistAcrossUpdates() {
  const first = prepareBillingConfigurationForStorage(
    validBilling({
      legalTexts: {
        invoiceLegalText: 'Texto legal anterior',
        internalReceiptNote: 'Nota interna anterior',
      },
    }),
    {}
  );
  const updated = prepareBillingConfigurationForStorage(
    validBilling({
      legalTexts: {
        invoiceLegalText: 'Texto legal actualizado',
        internalReceiptNote: 'Nota interna actualizada',
      },
    }),
    first
  );

  assert(
    updated.legalTexts.invoiceLegalText === 'Texto legal actualizado',
    'El backend conservó el texto legal anterior.'
  );
  assert(
    updated.legalTexts.internalReceiptNote === 'Nota interna actualizada',
    'El backend conservó la nota interna anterior.'
  );

  const route = read('backend/routes/billingSettingsProtection.js');
  assert(
    route.includes(
      "res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')"
    ),
    'La lectura administrativa permite reutilizar una respuesta anterior.'
  );

  ok('Los textos legales se actualizan y la recarga exige datos frescos');
}

function testPanelThemeAndSupportedOptions() {
  const section = read(
    'frontend/src/admin/configuracion/sections/FacturacionSection.jsx'
  );
  const provider = read(
    'frontend/src/admin/configuracion/sections/facturacion/ElectronicProviderBlock.jsx'
  );
  const taxes = read(
    'frontend/src/admin/configuracion/sections/facturacion/TaxConfigBlock.jsx'
  );
  const theme = read(
    'frontend/src/admin/configuracion/sections/facturacion/billingTheme.js'
  );
  const combined = `${section}\n${provider}\n${taxes}`;

  assert(theme.includes('var(--admin-primary)'), 'No reutiliza el tema del panel.');
  ['pink-', 'gray-', 'blue-', 'yellow-', 'emerald-', 'bg-white'].forEach((token) => {
    assert(!combined.includes(token), `Permanece una paleta fija: ${token}.`);
  });
  assert(!taxes.includes('04 - INC') && !taxes.includes('03 - ICA'), 'Ofrece impuestos sin payload.');
  assert(!provider.includes('<option value="siigo"'), 'Ofrece un proveedor no implementado.');
  ok('Asistente conserva su estructura y usa únicamente el tema y opciones soportadas');
}

function testDedicatedRouteAndPermissions() {
  expectCode(
    () => stripProtectedWriteFields({ 'billing.electronicProvider.provider': 'factus' }),
    'BILLING_DEDICATED_ENDPOINT_REQUIRED'
  );

  const index = read('backend/index.js');
  const protectedIndex = index.indexOf("app.use('/api/site-settings', billingSettingsProtectionRoutes)");
  const genericIndex = index.indexOf("app.use('/api/site-settings', siteSettingsRoutes)");
  assert(protectedIndex >= 0 && genericIndex > protectedIndex, 'Orden de rutas inseguro.');

  const route = read('backend/routes/billingSettingsProtection.js');
  assert(route.includes("requirePermission('billing:settings')"), 'Guardar no exige billing:settings.');
  assert(route.includes('updateBillingConfiguration'), 'La ruta no usa el servicio seguro.');
  ok('La escritura fiscal queda aislada y protegida por permiso específico');
}

function testRealConnectionAndRuntime() {
  const route = read('backend/routes/dianProviderTest.js');
  const service = read('backend/services/billingConfigurationService.js');
  const adapter = read('backend/lib/dian/providerAdapter.js');

  assert(!route.includes('mock_ready') && !route.includes('config_ready'), 'La prueba todavía simula éxito.');
  assert(service.includes('/oauth/token'), 'No existe autenticación OAuth real.');
  assert(service.includes('/v2/companies'), 'No se verifica la empresa vinculada.');
  assert(adapter.includes('buildRuntimeFactusConfig'), 'La emisión no atraviesa la frontera segura.');
  ['dianDirectProvider', 'carvajalProvider', 'siigoProvider', 'alegraProvider'].forEach((name) => {
    assert(!adapter.includes(name), `${name} permanece habilitado.`);
  });
  ok('Conexión y emisión utilizan únicamente Factus con credenciales seguras');
}

function testRegistration() {
  const packageFile = read('backend/package.json');
  assert(packageFile.includes('test:billing-configuration'), 'Falta registrar la prueba.');
  ok('Prueba de configuración registrada');
}

function main() {
  console.log('\nValidando Configuración de Facturación...');
  const tests = [
    testOfficialUrlBoundary,
    testEncryptionAndRedaction,
    testAuthoritativeValidation,
    testProductionFailClosed,
    testCredentialRotationAndRevocation,
    testConcurrencyAndHistory,
    testSuccessfulSaveClearsUnsavedChanges,
    testLegalTextsPersistAcrossUpdates,
    testPanelThemeAndSupportedOptions,
    testDedicatedRouteAndPermissions,
    testRealConnectionAndRuntime,
    testRegistration,
  ];

  tests.forEach((test) => {
    try {
      test();
    } catch (error) {
      results.fail += 1;
      console.error(`FAIL ${test.name}`);
      console.error(`     ${error.message}`);
    }
  });

  console.log(`\nResumen Configuración Facturación -> OK: ${results.ok} FAIL: ${results.fail}`);
  if (results.fail > 0) process.exit(1);
}

main();
