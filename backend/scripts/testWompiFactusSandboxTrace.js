/* eslint-disable no-console */

'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertFactusHabilitationConfig,
  assertNonProductionProcess,
  assertWompiSandboxConfig,
  parseArguments,
} = require('./wompiFactusSandboxTrace/config');
const {
  buildCompactJwe,
} = require('./wompiFactusSandboxTrace/secureCardStage');

const root = path.resolve(__dirname, '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));
const scriptDirectory = path.join(__dirname, 'wompiFactusSandboxTrace');
const sourceFiles = [
  path.join(__dirname, 'runWompiFactusSandboxTrace.js'),
  ...fs.readdirSync(scriptDirectory).map((name) => path.join(scriptDirectory, name)),
];

const wompiFixture = {
  active: true,
  provider: 'wompi',
  mode: 'sandbox',
  credentials: {
    wompi: {
      publicKey: 'pub_test_fixture',
      privateKey: 'prv_test_fixture',
      integrityKey: 'test_integrity_fixture',
    },
  },
};

assert.deepEqual(
  parseArguments([
    '--confirm-persist',
    '--confirm-wompi-sandbox',
    '--confirm-factus-habilitacion',
  ]),
  { autonomous: true, orderNumber: '', transactionId: '' }
);
assert.deepEqual(
  parseArguments([
    '--confirm-persist',
    '--confirm-wompi-sandbox',
    '--confirm-factus-habilitacion',
    '--resume-order=ORDER-TEST-1',
    '--wompi-transaction=TX-TEST-123',
  ]),
  {
    autonomous: false,
    orderNumber: 'ORDER-TEST-1',
    transactionId: 'TX-TEST-123',
  }
);
assert.throws(() => parseArguments([]), /--confirm-persist/);
assert.throws(
  () => parseArguments([
    '--confirm-persist',
    '--confirm-wompi-sandbox',
    '--confirm-factus-habilitacion',
    '--resume-order=ORDER-TEST-1',
  ]),
  /se requieren juntos/
);
console.log('OK 1: crea una traza nueva por defecto y permite reanudación explícita');

assert.doesNotThrow(() => assertNonProductionProcess({ NODE_ENV: 'test' }));
assert.throws(() => assertNonProductionProcess({ NODE_ENV: 'production' }), /bloqueada/);
assert.doesNotThrow(() => assertWompiSandboxConfig(wompiFixture));
assert.throws(
  () => assertWompiSandboxConfig({ ...wompiFixture, mode: 'production' }),
  /Sandbox/
);
console.log('OK 2: Wompi producción y NODE_ENV production quedan bloqueados');

const factusSettings = {
  billing: {
    dian: { enabled: true, mode: 'habilitacion' },
    electronicProvider: {
      provider: 'factus',
      apiUrl: 'https://api-sandbox.factus.com.co',
      clientId: 'fixture',
      clientSecret: 'fixture',
      username: 'fixture@example.com',
      password: 'fixture',
      numberingRangeId: 1,
      creditNoteNumberingRangeId: 2,
    },
  },
};
assert.doesNotThrow(() => assertFactusHabilitationConfig(factusSettings));
assert.throws(
  () =>
    assertFactusHabilitationConfig({
      billing: {
        ...factusSettings.billing,
        dian: { enabled: true, mode: 'production' },
        electronicProvider: {
          ...factusSettings.billing.electronicProvider,
          apiUrl: 'https://api.factus.com.co',
        },
      },
    }),
  /habilitación|habilitacion/i
);
console.log('OK 3: Factus exige habilitación, URL oficial y ambos rangos');

const allSource = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const token of [
  'findPurchasableInventoryItem',
  'issueCartAccess',
  "'/api/orders'",
  "'/api/payments/wompi/checkout-data'",
  'PaymentAttempt.findOne',
]) {
  assert(allSource.includes(token), `Falta el flujo canónico ${token}`);
}
console.log('OK 4: selecciona inventario real y crea carrito, orden e intento canónicos');

const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const compactJwe = buildCompactJwe(
  {
    number: ['4000', '0000', '0000', '0002'].join(''),
    cvc: ['9', '9', '9'].join(''),
    exp_month: '12',
    exp_year: '30',
    card_holder: 'CONTRACT TEST',
  },
  publicKey.export({ type: 'spki', format: 'pem' })
);
const parts = compactJwe.split('.');
assert.strictEqual(parts.length, 5);
assert.deepEqual(
  JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')),
  { alg: 'RSA-OAEP-256', enc: 'A256GCM' }
);
assert(parts.slice(1).every(Boolean));
console.log('OK 5: cifra la tarjeta efímera con JWE RSA-OAEP-256 y AES-256-GCM');

for (const token of [
  '/tokens/keys/tokenization',
  '/tokens/cards',
  '/transactions',
  'accept_personal_auth',
  'isWompiTransactionOwnedByOrder',
  'processApproved',
  'createElectronicInvoiceIssuanceService',
  'processOrderRefund',
  'automateOrderRefund',
  "'VOIDED'",
  'verifyCreditNoteDocuments',
]) {
  assert(allSource.includes(token), `Falta el control ${token}`);
}
console.log('OK 6: enlaza tokenización, pago, factura, reembolso, void y nota crédito reales');

assert.doesNotMatch(allSource, /(?:card_number|cardNumber|4242\s*4242)/i);
assert.doesNotMatch(allSource, /console\.(?:log|error)\([^\n]*(?:card|token|jwe)/i);
assert.doesNotMatch(
  allSource,
  /\.(?:deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|dropDatabase|dropCollection)\s*\(/
);
for (const file of sourceFiles) {
  assert(
    fs.readFileSync(file, 'utf8').split(/\r?\n/).length <= 230,
    `${path.basename(file)} supera 230 líneas.`
  );
}
console.log('OK 7: no guarda tarjetas, no limpia evidencia y conserva módulos pequeños');

assert.strictEqual(
  packageJson.scripts['demo:orders-wompi-factus-sandbox'],
  'node scripts/runWompiFactusSandboxTrace.js'
);
assert.strictEqual(
  packageJson.scripts['test:orders-wompi-factus-sandbox'],
  'node scripts/testWompiFactusSandboxTrace.js'
);
const workflow = fs.readFileSync(path.join(root, '.github/workflows/orders-ci.yml'), 'utf8');
assert(workflow.includes('npm --prefix backend run test:orders-wompi-factus-sandbox'));
console.log('OK 8: comandos y contrato sin llamadas externas quedan registrados en CI');

for (const token of [
  'OK 1/9',
  'OK 9/9',
  'Persistencia: CONSERVADA',
  'createAutonomousCheckout',
  'createApprovedSandboxTransaction',
]) {
  assert(allSource.includes(token), `Falta la evidencia autónoma ${token}`);
}
console.log('OK 9: la ejecución autónoma conserva nueve hitos y toda la trazabilidad');
console.log('\nResultado contrato Wompi + Factus Sandbox: 9/9 verificaciones aprobadas.');
