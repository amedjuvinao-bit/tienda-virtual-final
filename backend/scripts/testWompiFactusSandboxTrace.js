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
  normalizeTokenizationPublicKey,
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

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const escapedPublicKey = publicKey
  .export({ type: 'spki', format: 'pem' })
  .replace(/\n/g, '\\n');
assert.doesNotThrow(() => normalizeTokenizationPublicKey(escapedPublicKey));
assert.throws(
  () => normalizeTokenizationPublicKey('invalid'),
  /llave RSA de tokenización inválida/
);
const cardFixture = {
  number: ['4000', '0000', '0000', '0002'].join(''),
  cvc: ['9', '9', '9'].join(''),
  exp_month: '12',
  exp_year: '30',
  card_holder: 'CONTRACT TEST',
};
const compactJwe = buildCompactJwe(cardFixture, escapedPublicKey);
const parts = compactJwe.split('.');
assert.strictEqual(parts.length, 5);
assert.deepEqual(
  JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')),
  { alg: 'RSA-OAEP-256', enc: 'A256GCM' }
);
assert(parts.slice(1).every(Boolean));
const cek = crypto.privateDecrypt(
  {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  },
  Buffer.from(parts[1], 'base64url')
);
const decipher = crypto.createDecipheriv('aes-256-gcm', cek, Buffer.from(parts[2], 'base64url'));
decipher.setAAD(Buffer.from(parts[0], 'ascii'));
decipher.setAuthTag(Buffer.from(parts[4], 'base64url'));
const decrypted = Buffer.concat([
  decipher.update(Buffer.from(parts[3], 'base64url')),
  decipher.final(),
]);
assert.deepEqual(JSON.parse(decrypted.toString('utf8')), cardFixture);
cek.fill(0);
decrypted.fill(0);
console.log('OK 5: normaliza la llave Wompi y cifra JWE RSA-OAEP-256/AES-256-GCM');

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
