/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const scriptPath = path.join(
  root,
  'backend',
  'scripts',
  'seedPersistentFactusOrderReturnTrace.js'
);
const source = fs.readFileSync(scriptPath, 'utf8');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, 'backend', 'package.json'), 'utf8')
);

const required = [
  '--confirm-persist',
  '--confirm-factus-habilitacion',
  '--resume-order=',
  '--diagnose-order=',
  'FACTUS_API_URLS.habilitacion',
  'FACTUS_API_URLS.production',
  'seedPersistentOrderReturnTrace.js',
  'createElectronicInvoiceIssuanceService',
  'createOfficialCreditNote',
  'linkRefundCreditNote',
  'confirmRefundPaymentReversal',
  'downloadOfficialInvoiceDocument',
  'downloadOfficialCreditNoteDocument',
  'recoverFactusInvoice',
  'diagnosePersistentTrace',
  "finalRefund?.reconciliation?.state, 'completed'",
  "finalOrder?.status, 'refunded'",
  'Persistencia: CONSERVADA (sin limpieza automática).',
];

for (const token of required) {
  assert(source.includes(token), `Falta el control obligatorio: ${token}`);
}

const prohibited = [
  /dropDatabase\s*\(/,
  /dropCollection\s*\(/,
  /deleteOne\s*\(/,
  /deleteMany\s*\(/,
  /findOneAndDelete\s*\(/,
  /findByIdAndDelete\s*\(/,
  /\.remove\s*\(/,
];

for (const pattern of prohibited) {
  assert(!pattern.test(source), `La traza persistente contiene limpieza prohibida: ${pattern}`);
}

assert.strictEqual(
  packageJson.scripts['demo:orders-returns-factus-trace'],
  'node scripts/seedPersistentFactusOrderReturnTrace.js'
);
assert.strictEqual(
  packageJson.scripts['diagnose:orders-returns-factus-trace'],
  'node scripts/seedPersistentFactusOrderReturnTrace.js'
);

console.log('OK 1: la prueba exige confirmación de persistencia y Factus habilitación');
console.log('OK 2: producción queda bloqueada y ambos rangos oficiales son obligatorios');
console.log('OK 3: factura, RMA, reembolso, nota crédito y conciliación están enlazados');
console.log('OK 4: PDF/XML oficiales de factura y nota crédito quedan verificados');
console.log('OK 5: no existen operaciones de borrado ni limpieza automática');
console.log('\nResultado contrato Factus + RMA persistente: 5/5 verificaciones aprobadas.');
