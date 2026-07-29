/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-client-activation-test-key-32-characters-minimum';

const {
  assertClientActivationReady,
  buildActivationFingerprint,
  requireProductionCandidate,
} = require('../services/billingClientActivationOrchestrator');

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

function productionBilling() {
  return {
    fiscalInfo: {
      businessName: 'Cliente SAS',
      nit: '819003632',
      dv: '1',
      billingEmail: 'facturacion@cliente.test',
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
      apiUrl: 'https://api.factus.com.co',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      username: 'cliente@factus.test',
      password: 'password-seguro',
      numberingRangeId: 101,
      creditNoteNumberingRangeId: 202,
    },
  };
}

function testActivationRequiresCompleteProductionAccount() {
  const complete = requireProductionCandidate(productionBilling(), {});
  assert(complete.invoiceRangeId === 101, 'No conservó rango de facturas.');
  assert(complete.creditNoteRangeId === 202, 'No conservó rango de notas crédito.');

  expectCode(
    () =>
      requireProductionCandidate(
        {
          ...productionBilling(),
          dian: { mode: 'habilitacion' },
        },
        {}
      ),
    'BILLING_CLIENT_ACTIVATION_INCOMPLETE'
  );

  const missingCredit = productionBilling();
  missingCredit.electronicProvider.creditNoteNumberingRangeId = 0;
  missingCredit.dianResolution.creditNoteNumberingRangeId = 0;
  expectCode(
    () => requireProductionCandidate(missingCredit, {}),
    'BILLING_CLIENT_ACTIVATION_INCOMPLETE'
  );

  ok('Activación exige Producción, Factus y ambos rangos oficiales');
}

function testActivationFingerprintIsClientSpecific() {
  const runtime = {
    apiUrl: 'https://api.factus.com.co',
    clientId: 'client-id',
    username: 'cliente@factus.test',
    clientSecret: 'client-secret',
    password: 'password-seguro',
  };
  const first = buildActivationFingerprint({
    runtime,
    companyNit: '819003632',
    invoiceRangeId: 101,
    creditNoteRangeId: 202,
    mailFrom: 'facturacion@cliente.test',
  });
  const repeated = buildActivationFingerprint({
    runtime,
    companyNit: '819003632',
    invoiceRangeId: 101,
    creditNoteRangeId: 202,
    mailFrom: 'facturacion@cliente.test',
  });
  const anotherClient = buildActivationFingerprint({
    runtime: { ...runtime, clientId: 'otro-cliente' },
    companyNit: '900999999',
    invoiceRangeId: 301,
    creditNoteRangeId: 302,
    mailFrom: 'facturacion@otro.test',
  });

  assert(first === repeated, 'La huella no es determinística.');
  assert(first !== anotherClient, 'Dos clientes distintos comparten huella.');
  assert(first.length === 64, 'La huella no usa SHA-256.');

  ok('Cada cliente queda vinculado a credenciales, NIT, rangos y correo propios');
}

async function testEmissionRequiresMatchingActiveState() {
  const billing = productionBilling();
  const runtime = {
    apiUrl: billing.electronicProvider.apiUrl,
    clientId: billing.electronicProvider.clientId,
    username: billing.electronicProvider.username,
    clientSecret: billing.electronicProvider.clientSecret,
    password: billing.electronicProvider.password,
  };
  const state = {
    status: 'active',
    provider: 'factus',
    environment: 'production',
    companyNit: billing.fiscalInfo.nit,
    invoiceRangeId: 101,
    creditNoteRangeId: 202,
    mailFrom: 'facturacion@cliente.test',
  };
  state.activationFingerprint = buildActivationFingerprint({
    runtime,
    companyNit: state.companyNit,
    invoiceRangeId: state.invoiceRangeId,
    creditNoteRangeId: state.creditNoteRangeId,
    mailFrom: state.mailFrom,
  });

  await assertClientActivationReady(billing, state);

  let captured = null;
  try {
    await assertClientActivationReady(
      {
        ...billing,
        electronicProvider: {
          ...billing.electronicProvider,
          numberingRangeId: 999,
        },
      },
      state
    );
  } catch (error) {
    captured = error;
  }
  assert(
    captured?.code === 'BILLING_CLIENT_ACTIVATION_REQUIRED',
    'La emisión aceptó un rango diferente al activado.'
  );

  ok('Emisión productiva exige estado activo y huella vigente del cliente');
}

function testIndependentLockAndAuditState() {
  const model = read('backend/models/BillingActivationState.js');
  const service = read(
    'backend/services/billingClientActivationOrchestrator.js'
  );

  assert(model.includes("collection: 'billing_activation_states'"), 'No usa colección independiente.');
  assert(model.includes("enum: ['idle', 'activating', 'active', 'error']"), 'Estados incompletos.');
  assert(model.includes("select: false"), 'Lock o huella no están ocultos.');
  assert(service.includes('ACTIVATION_LOCK_MS'), 'No existe bloqueo temporal.');
  assert(service.includes('BILLING_CLIENT_ACTIVATION_IN_PROGRESS'), 'No bloquea activaciones simultáneas.');
  assert(service.includes('markFailure') && service.includes('markSuccess'), 'No audita resultado final.');
  assert(
    service.includes('assertClientActivationReady') &&
      service.includes('BILLING_CLIENT_ACTIVATION_REQUIRED'),
    'La emisión no queda cerrada mientras la activación final está incompleta.'
  );

  ok('Activación concurrente queda bloqueada y auditada fuera de SiteSettings');
}

function testFinalActivationRevalidatesEverything() {
  const service = read(
    'backend/services/billingClientActivationOrchestrator.js'
  );

  [
    'assertMailReady',
    'testFactusConnectionWithIdentity',
    'saveFactusNumberingRangeSelection',
    'assertProductionNumberingRangesReady',
    'updateBillingConfigurationWithReadiness',
    'reconcileNumberingRangeSnapshot',
    'readyForProduction',
  ].forEach((token) => {
    assert(service.includes(token), `Falta la validación final ${token}.`);
  });
  assert(
    service.indexOf('testFactusConnectionWithIdentity') <
      service.indexOf('saveFactusNumberingRangeSelection'),
    'Los rangos se validan antes de comprobar la cuenta.'
  );
  assert(
    !service.includes('/v2/bills/validate') &&
      !service.includes('/v2/credit-notes/validate'),
    'La activación está emitiendo documentos reales.'
  );

  ok('Activación revalida cuenta, empresa, rangos, correo y no emite documentos');
}

function testRouteIsProtectedAndRateLimited() {
  const route = read('backend/routes/dianProviderTest.js');

  assert(route.includes("requirePermission('billing:settings')"), 'Falta permiso fiscal.');
  assert(route.includes("'/activate-production'"), 'Falta endpoint de activación.');
  assert(route.includes('productionActivationLimiter'), 'Falta límite de intentos.');
  assert(route.includes('max: 5'), 'El límite de activación no es restrictivo.');
  assert(route.includes("'/activation-status'"), 'Falta consulta de estado.');
  assert(route.includes('hydrateBillingPayload'), 'No normaliza datos históricos.');

  ok('Endpoint de activación está autenticado, autorizado y limitado');
}

function testFrontendProvidesNoCodeActivation() {
  const ranges = read(
    'frontend/src/admin/configuracion/sections/facturacion/FactusNumberingRangesBlock.jsx'
  );
  const resolution = read(
    'frontend/src/admin/configuracion/sections/facturacion/DianResolutionBlock.jsx'
  );

  assert(ranges.includes('Activación final del cliente'), 'Falta el cierre guiado.');
  assert(ranges.includes('Validar todo y activar producción'), 'Falta la acción final.');
  assert(ranges.includes('/api/dian-provider/activate-production'), 'El panel no conecta el endpoint.');
  assert(ranges.includes("environment !== 'production'"), 'Permite activar desde habilitación.');
  assert(ranges.includes('selectionSaved'), 'Permite activar rangos no guardados.');
  assert(ranges.includes('no genera facturas ni notas'), 'No informa el alcance seguro.');
  assert(resolution.includes('onActivated={onActivated}'), 'No propaga el resultado final.');
  assert(!ranges.includes('389'), 'Quedó un rango fijo de la cuenta de pruebas.');

  ok('Cada comprador puede conectar y activar su cuenta desde el panel sin modificar código');
}

function testRegistration() {
  const packageFile = read('backend/package.json');
  const closure = read('backend/scripts/testBillingModuleClosure.js');

  assert(
    packageFile.includes('test:billing-client-activation'),
    'package.json no registra la prueba de activación.'
  );
  assert(
    closure.includes('testBillingClientActivationModule.js'),
    'El cierre integral no ejecuta la activación por cliente.'
  );

  ok('Prueba de activación registrada en el cierre integral');
}

async function main() {
  console.log('\nValidando activación productiva por cliente...');

  for (const test of [
    testActivationRequiresCompleteProductionAccount,
    testActivationFingerprintIsClientSpecific,
    testEmissionRequiresMatchingActiveState,
    testIndependentLockAndAuditState,
    testFinalActivationRevalidatesEverything,
    testRouteIsProtectedAndRateLimited,
    testFrontendProvidesNoCodeActivation,
    testRegistration,
  ]) {
    try {
      await test();
    } catch (error) {
      results.fail += 1;
      console.error(`FAIL ${test.name}`);
      console.error(`     ${error.message}`);
    }
  }

  console.log(
    `\nResumen activación por cliente -> OK: ${results.ok} FAIL: ${results.fail}`
  );
  if (results.fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
