/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-connection-test-key-32-characters-minimum';

const {
  assertVerifiedCompanyMatchesFiscal,
  buildBillingReadinessSnapshot,
  normalizeCompanySnapshot,
} = require('../services/billingConnectionOrchestrationService');
const {
  buildFactusConnectionRuntimeConfig,
} = require('../services/billingConfigurationService');

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
  assert(
    captured.code === code,
    `Se esperaba ${code}, llegó ${captured.code || captured.message}.`
  );
}

function buildReadySettings() {
  return {
    _credentialStatus: {
      'billing.electronicProvider.clientSecret': true,
      'billing.electronicProvider.password': true,
    },
    billing: {
      fiscalInfo: {
        businessName: 'Tienda Virtual SAS',
        nit: '819003632',
        dv: '1',
        billingEmail: 'facturacion@tienda.test',
        address: 'Calle 1 # 2-3',
        municipalityCode: '47980',
      },
      dian: {
        enabled: true,
        mode: 'production',
        environment: '1',
      },
      dianResolution: {
        numberingRangeId: 101,
        creditNoteNumberingRangeId: 202,
      },
      electronicProvider: {
        provider: 'factus',
        clientId: 'client-id',
        username: 'usuario@tienda.test',
        numberingRangeId: 101,
        creditNoteNumberingRangeId: 202,
        lastConnectionStatus: 'success',
        lastConnectionEnvironment: 'production',
        lastConnectionAt: '2026-07-22T22:00:00.000Z',
        lastConnectionCompany: {
          id: 10,
          nit: '819003632',
          dv: '1',
          name: 'Tienda Virtual SAS',
        },
      },
    },
  };
}

function testCompanyIdentityNormalization() {
  const company = normalizeCompanySnapshot(
    {
      id: 10,
      identification: '819003632-1',
      business_name: 'Tienda Virtual SAS',
      trade_name: 'Tienda Virtual',
    },
    { nit: '819003632', dv: '1' }
  );

  assert(company.nit === '819003632', 'No normalizó el NIT de la empresa Factus.');
  assert(company.dv === '1', 'No normalizó el DV de la empresa Factus.');
  assert(company.name === 'Tienda Virtual SAS', 'No identificó la razón social.');
  ok('La identidad empresarial de Factus se normaliza sin perder NIT ni DV');
}

function testCompanyMustMatchFiscalIdentity() {
  const verified = assertVerifiedCompanyMatchesFiscal(
    { nit: '819003632', dv: '1', name: 'Tienda Virtual SAS' },
    { nit: '819003632', dv: '1' }
  );
  assert(verified.nit === '819003632', 'La empresa válida fue rechazada.');

  expectCode(
    () =>
      assertVerifiedCompanyMatchesFiscal(
        { nit: '900999999', dv: '5', name: 'Otra Empresa SAS' },
        { nit: '819003632', dv: '1' }
      ),
    'FACTUS_COMPANY_NIT_MISMATCH'
  );

  ok('Producción rechaza credenciales vinculadas a un NIT diferente');
}

function testConnectionIsIndependentFromNumberingConfiguration() {
  const runtime = buildFactusConnectionRuntimeConfig(
    {
      dian: { mode: 'habilitacion' },
      dianResolution: {
        rangeFrom: 100,
        rangeTo: 200,
        currentNumber: 999,
      },
      electronicProvider: {
        provider: 'factus',
        apiUrl: 'https://api-sandbox.factus.com.co',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        username: 'sandbox@tienda.test',
        password: 'password-seguro',
      },
    },
    {}
  );

  assert(runtime.provider === 'factus', 'No construyó el runtime de Factus.');
  assert(runtime.environment === 'habilitacion', 'No conservó el ambiente de conexión.');
  assert(runtime.clientId === 'client-id', 'No conservó las credenciales de conexión.');

  ok('Prueba de conexión no queda bloqueada por consecutivos o rangos históricos');
}

function testReadinessRequiresEveryProductionControl() {
  const mailReady = {
    enabled: true,
    configured: true,
    tested: true,
    ready: true,
    fromEmail: 'facturacion@tienda.test',
    lastTestAt: '2026-07-22T21:00:00.000Z',
  };
  const ready = buildBillingReadinessSnapshot(buildReadySettings(), mailReady);

  assert(ready.readyForProduction === true, 'Una configuración completa no quedó lista.');
  assert(ready.blockers.length === 0, 'Una configuración completa conserva bloqueos.');
  assert(ready.connection.companyMatchesFiscal === true, 'No confirmó la identidad fiscal.');

  const unsafe = buildReadySettings();
  unsafe.billing.electronicProvider.lastConnectionCompany.nit = '900999999';
  unsafe.billing.electronicProvider.creditNoteNumberingRangeId = 0;
  unsafe.billing.dianResolution.creditNoteNumberingRangeId = 0;

  const blocked = buildBillingReadinessSnapshot(unsafe, {
    ...mailReady,
    tested: false,
    ready: false,
  });

  assert(blocked.readyForProduction === false, 'Producción no se bloqueó.');
  assert(
    blocked.blockers.some((item) => item.includes('NIT de Factus')),
    'Falta el bloqueo por identidad empresarial.'
  );
  assert(
    blocked.blockers.some((item) => item.includes('notas crédito')),
    'Falta el bloqueo por rango de notas crédito.'
  );
  assert(
    blocked.blockers.some((item) => item.includes('Correo')),
    'Falta el bloqueo por correo no probado.'
  );

  ok('Readiness de Producción exige conexión, empresa, rangos, correo y credenciales');
}

function testOfficialFactusFlowAndRateLimit() {
  const baseService = read('backend/services/billingConfigurationService.js');
  const orchestration = read('backend/services/billingConnectionOrchestrationService.js');
  const route = read('backend/routes/dianProviderTest.js');

  assert(baseService.includes('/oauth/token'), 'Falta autenticación OAuth real.');
  assert(baseService.includes('/v2/companies'), 'Falta consulta oficial de empresa.');
  assert(
    baseService.includes('buildFactusConnectionRuntimeConfig'),
    'La prueba real no tiene un runtime independiente.'
  );
  assert(
    orchestration.includes('FACTUS_COMPANY_NIT_MISMATCH'),
    'La conexión no valida identidad fiscal.'
  );
  assert(
    route.includes('connectionTestLimiter') && route.includes('max: 10'),
    'La prueba real no tiene límite específico.'
  );
  assert(
    route.includes('testFactusConnectionWithIdentity'),
    'La ruta no usa la verificación empresarial completa.'
  );

  ok('La prueba usa endpoints oficiales, valida empresa y limita intentos');
}

function testFrontendUsesRealConnectionState() {
  const section = read(
    'frontend/src/admin/configuracion/sections/FacturacionSection.jsx'
  );
  const provider = read(
    'frontend/src/admin/configuracion/sections/facturacion/ElectronicProviderBlock.jsx'
  );
  const readiness = read(
    'frontend/src/admin/configuracion/sections/facturacion/BillingProductionReadiness.jsx'
  );

  assert(
    section.includes("'/api/dian-provider/test-provider'"),
    'El panel no llama la prueba real.'
  );
  assert(
    section.includes("value=\"habilitacion\""),
    'El frontend no usa el modo canónico de habilitación.'
  );
  assert(!section.includes('alert('), 'El panel todavía usa alert del navegador.');
  assert(provider.includes('Probar conexión real'), 'Falta la acción de conexión real.');
  assert(provider.includes('readOnly'), 'La URL oficial sigue siendo editable.');
  ['value="dian"', 'value="carvajal"', 'value="siigo"', 'value="alegra"'].forEach(
    (unsupported) => {
      assert(!provider.includes(unsupported), `${unsupported} sigue seleccionable.`);
    }
  );
  assert(
    readiness.includes('Producción permanece bloqueada'),
    'No se informa el bloqueo real de Producción.'
  );

  ok('El panel prueba Factus, muestra empresa y no habilita proveedores inexistentes');
}

function testRegistration() {
  const packageFile = read('backend/package.json');
  const closure = read('backend/scripts/testBillingModuleClosure.js');

  assert(
    packageFile.includes('test:billing-connection'),
    'package.json no registra test:billing-connection.'
  );
  assert(
    closure.includes('testBillingConnectionModule.js'),
    'El cierre integral no ejecuta la prueba de conexión.'
  );

  ok('Prueba de conexión registrada en el cierre integral');
}

function main() {
  console.log('\nValidando conexión real y readiness de Factus...');

  const tests = [
    testCompanyIdentityNormalization,
    testCompanyMustMatchFiscalIdentity,
    testConnectionIsIndependentFromNumberingConfiguration,
    testReadinessRequiresEveryProductionControl,
    testOfficialFactusFlowAndRateLimit,
    testFrontendUsesRealConnectionState,
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

  console.log(
    `\nResumen conexión Factus -> OK: ${results.ok} FAIL: ${results.fail}`
  );
  if (results.fail > 0) process.exit(1);
}

main();
