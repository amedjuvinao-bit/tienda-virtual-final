'use strict';

const assert = require('node:assert/strict');

const {
  FACTUS_API_URLS,
  buildRuntimeFactusConfig,
} = require('../../lib/billing/billingConfigurationSecurity');
const {
  WOMPI_ENVIRONMENTS,
} = require('../../lib/payments/wompiPaymentUtils');

const FLAGS = Object.freeze({
  persist: '--confirm-persist',
  wompi: '--confirm-wompi-sandbox',
  factus: '--confirm-factus-habilitacion',
});
const ORDER_PREFIX = '--order=';
const RESUME_ORDER_PREFIX = '--resume-order=';
const TRANSACTION_PREFIX = '--wompi-transaction=';

function clean(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function argumentValue(args, prefix, max = 220) {
  const argument = args.find((value) => String(value).startsWith(prefix));
  return clean(argument?.slice(prefix.length), max);
}

function parseArguments(args = process.argv.slice(2)) {
  for (const flag of Object.values(FLAGS)) {
    assert(args.includes(flag), `Falta ${flag}.`);
  }
  const orderNumber =
    argumentValue(args, RESUME_ORDER_PREFIX, 100) ||
    argumentValue(args, ORDER_PREFIX, 100);
  const transactionId = argumentValue(args, TRANSACTION_PREFIX, 160);
  assert.strictEqual(
    Boolean(orderNumber),
    Boolean(transactionId),
    'Para reanudar se requieren juntos --resume-order y --wompi-transaction.'
  );
  return {
    autonomous: !orderNumber,
    orderNumber,
    transactionId,
  };
}

function assertNonProductionProcess(env = process.env) {
  assert.notStrictEqual(
    clean(env.NODE_ENV, 40).toLowerCase(),
    'production',
    'Esta traza está bloqueada con NODE_ENV=production.'
  );
}

function assertWompiSandboxConfig(config = {}) {
  assert.strictEqual(config.active, true, 'Los pagos no están activos.');
  assert.strictEqual(config.provider, 'wompi', 'Wompi no es la pasarela activa.');
  assert.strictEqual(config.mode, 'sandbox', 'La traza está bloqueada fuera de Wompi Sandbox.');
  const credentials = config.credentials?.wompi || {};
  assert.match(credentials.publicKey || '', /^pub_test_/i, 'La public key no es de pruebas.');
  assert.match(credentials.privateKey || '', /^prv_test_/i, 'La private key no es de pruebas.');
  assert.match(
    credentials.integrityKey || '',
    /^test_integrity_/i,
    'La llave de integridad no es de pruebas.'
  );
  assert.notStrictEqual(
    WOMPI_ENVIRONMENTS.sandbox,
    WOMPI_ENVIRONMENTS.production,
    'Los ambientes Wompi no están aislados.'
  );
  return WOMPI_ENVIRONMENTS.sandbox;
}

function assertFactusHabilitationConfig(settings = {}) {
  const billing = settings.billing || {};
  const runtime = buildRuntimeFactusConfig(billing);
  assert.strictEqual(billing?.dian?.enabled, true, 'La facturación electrónica no está activa.');
  assert.strictEqual(
    clean(billing?.electronicProvider?.provider, 40).toLowerCase(),
    'factus',
    'Factus no es el proveedor electrónico activo.'
  );
  assert.strictEqual(runtime.environment, 'habilitacion', 'Factus no está en habilitación.');
  assert.strictEqual(runtime.apiUrl, FACTUS_API_URLS.habilitacion);
  assert.notStrictEqual(runtime.apiUrl, FACTUS_API_URLS.production);
  assert(runtime.numberingRangeId > 0, 'Falta el rango de facturas de habilitación.');
  assert(runtime.creditNoteNumberingRangeId > 0, 'Falta el rango de notas crédito.');
  return runtime;
}

module.exports = {
  FLAGS,
  ORDER_PREFIX,
  RESUME_ORDER_PREFIX,
  TRANSACTION_PREFIX,
  assertFactusHabilitationConfig,
  assertNonProductionProcess,
  assertWompiSandboxConfig,
  clean,
  parseArguments,
};
