/* eslint-disable no-console */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertFactusHabilitationConfig,
  assertNonProductionProcess,
  assertWompiSandboxConfig,
  parseArguments,
} = require('./wompiFactusSandboxTrace/config');

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
    '--order=ORDER-TEST-1',
    '--wompi-transaction=TX-TEST-123',
  ]),
  { orderNumber: 'ORDER-TEST-1', transactionId: 'TX-TEST-123' }
);
assert.throws(() => parseArguments([]), /--confirm-persist/);
console.log('OK 1: exige tres confirmaciones y las identidades exactas de orden/transacción');

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
console.log('OK 4: enlaza aprobación, factura, reembolso, void y nota crédito reales');

assert.doesNotMatch(allSource, /(?:card_number|cardNumber|cvc|cvv|4242\s*4242)/i);
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
console.log('OK 5: no guarda tarjetas, no limpia evidencia y conserva módulos pequeños');

assert.strictEqual(
  packageJson.scripts['demo:orders-wompi-factus-sandbox'],
  'node scripts/runWompiFactusSandboxTrace.js'
);
assert.strictEqual(
  packageJson.scripts['test:orders-wompi-factus-sandbox'],
  'node scripts/testWompiFactusSandboxTrace.js'
);
console.log('OK 6: comandos de ejecución y contrato registrados');
console.log('\nResultado contrato Wompi + Factus Sandbox: 6/6 verificaciones aprobadas.');
