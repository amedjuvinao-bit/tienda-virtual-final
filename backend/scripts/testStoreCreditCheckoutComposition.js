'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const facade = require('../services/storeCreditCheckoutService');
const access = require('../services/storeCreditCheckout/access');
const constants = require('../services/storeCreditCheckout/constants');
const expiration = require('../services/storeCreditCheckout/expiration');
const preview = require('../services/storeCreditCheckout/preview');
const reservation = require('../services/storeCreditCheckout/reservation');
const usageLifecycle = require('../services/storeCreditCheckout/usageLifecycle');

const EXPECTED_EXPORTS = [
  'STORE_CREDIT_ACCESS_TTL_MS',
  'STORE_CREDIT_ACCESS_VERSION',
  'STORE_CREDIT_RESERVATION_TTL_MS',
  'applyUsageSnapshotToOrder',
  'consumeReservedStoreCreditForOrder',
  'issueStoreCreditAccess',
  'previewCustomerStoreCredit',
  'releaseExpiredStoreCreditReservations',
  'releaseReservedStoreCreditForOrder',
  'reserveStoreCreditForOrder',
  'verifyStoreCreditAccess',
];

const INTERNAL_FILES = [
  'access.js',
  'constants.js',
  'expiration.js',
  'normalization.js',
  'preview.js',
  'reservation.js',
  'usageLifecycle.js',
];

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const lineCount = (source) => source.split(/\r?\n/).length;

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

async function run() {
  assert.deepEqual(Object.keys(facade), EXPECTED_EXPORTS);
  assert.equal(facade.STORE_CREDIT_ACCESS_VERSION, 1);
  assert.equal(facade.STORE_CREDIT_ACCESS_TTL_MS, 10 * 60 * 1000);
  assert.equal(facade.STORE_CREDIT_RESERVATION_TTL_MS, 20 * 60 * 1000);
  ok('la fachada conserva exactamente los once exports públicos');

  const delegatedExports = {
    applyUsageSnapshotToOrder: usageLifecycle.applyUsageSnapshotToOrder,
    consumeReservedStoreCreditForOrder:
      usageLifecycle.consumeReservedStoreCreditForOrder,
    issueStoreCreditAccess: access.issueStoreCreditAccess,
    previewCustomerStoreCredit: preview.previewCustomerStoreCredit,
    releaseExpiredStoreCreditReservations:
      expiration.releaseExpiredStoreCreditReservations,
    releaseReservedStoreCreditForOrder:
      usageLifecycle.releaseReservedStoreCreditForOrder,
    reserveStoreCreditForOrder: reservation.reserveStoreCreditForOrder,
    verifyStoreCreditAccess: access.verifyStoreCreditAccess,
  };
  for (const [name, implementation] of Object.entries(delegatedExports)) {
    assert.strictEqual(facade[name], implementation, `${name} no delega sin envolver`);
  }
  assert.strictEqual(
    facade.STORE_CREDIT_ACCESS_TTL_MS,
    constants.STORE_CREDIT_ACCESS_TTL_MS
  );
  assert.strictEqual(
    facade.STORE_CREDIT_ACCESS_VERSION,
    constants.STORE_CREDIT_ACCESS_VERSION
  );
  assert.strictEqual(
    facade.STORE_CREDIT_RESERVATION_TTL_MS,
    constants.STORE_CREDIT_RESERVATION_TTL_MS
  );
  ok('cada export delega a una única implementación canónica');

  const facadeSource = read('services/storeCreditCheckoutService.js');
  assert(lineCount(facadeSource) <= 100);
  assert(!facadeSource.includes("require('mongoose')"));
  assert(!facadeSource.includes('/models/'));
  for (const file of INTERNAL_FILES) {
    const source = read(`services/storeCreditCheckout/${file}`);
    assert(
      lineCount(source) <= 250,
      `${file} superó el límite cohesivo de 250 líneas`
    );
    assert(!source.includes('storeCreditCheckoutService'));
  }
  ok('la fachada es menor a 100 líneas y los módulos internos son acotados');

  const secret = 'store-credit-composition-secret-with-safe-length';
  const customerId = new mongoose.Types.ObjectId();
  const expiresAt = new Date('2030-01-01T00:00:00.000Z');
  const token = facade.issueStoreCreditAccess(
    { customerId, sessionId: 'composition-cart', currency: 'cop', expiresAt },
    { secret }
  );
  assert.equal(token.startsWith('sc1_'), true);
  assert.equal(
    facade.verifyStoreCreditAccess(
      token,
      {
        customerId,
        sessionId: 'composition-cart',
        currency: 'COP',
        now: new Date('2029-12-31T23:59:59.000Z'),
      },
      { secret }
    ).valid,
    true
  );
  assert.equal(
    facade.verifyStoreCreditAccess(
      token,
      {
        customerId,
        sessionId: 'composition-cart',
        currency: 'USD',
        now: new Date('2029-12-31T23:59:59.000Z'),
      },
      { secret }
    ).valid,
    false
  );
  ok('emisión y verificación conservan formato, vínculo y normalización');

  const order = {};
  const usage = {
    _id: new mongoose.Types.ObjectId(),
    amount: 123.456,
    currency: 'COP',
    status: 'reserved',
    allocations: [{ creditNumber: 'SC-PARITY-1' }],
    reservedAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-01-01T00:20:00.000Z'),
  };
  facade.applyUsageSnapshotToOrder(order, usage);
  assert.deepEqual(order.storeCredit, {
    applied: true,
    usage: usage._id,
    amount: 123.46,
    currency: 'COP',
    status: 'reserved',
    references: ['SC-PARITY-1'],
    reservedAt: usage.reservedAt,
    expiresAt: usage.expiresAt,
    consumedAt: null,
    releasedAt: null,
    releaseReason: '',
  });
  assert.deepEqual(
    await facade.consumeReservedStoreCreditForOrder(null, { session: {} }),
    { consumed: false, reason: 'not_available' }
  );
  assert.deepEqual(
    await facade.releaseReservedStoreCreditForOrder(null, { session: {} }),
    { released: false, reason: 'not_available' }
  );
  ok('snapshot y guardas tempranas conservan las formas de respuesta');

  let customerQueries = 0;
  const invalidPreview = await facade.previewCustomerStoreCredit(
    { documentNumber: '12', emailOrPhone: '', currency: 'cop' },
    {
      secret,
      CustomerModel: {
        findOne() {
          customerQueries += 1;
          throw new Error('No debía consultar Customer');
        },
      },
      StoreCreditModel: {},
    }
  );
  assert.deepEqual(invalidPreview, {
    eligible: false,
    balance: 0,
    currency: 'COP',
  });
  assert.equal(customerQueries, 0);
  await assert.rejects(
    () => facade.reserveStoreCreditForOrder({}, { secret }),
    (error) =>
      error instanceof TypeError &&
      error.message === 'La reserva de saldo exige una transacción.'
  );
  ok('preview y reserva mantienen validación temprana e inyección de dependencias');

  const reservationSource = read('services/storeCreditCheckout/reservation.js');
  assert(reservationSource.includes('.sort({ expiresAt: 1, issuedAt: 1 })'));
  assert(reservationSource.includes('balance: before'));
  assert(reservationSource.includes('$set: { balance: after }'));
  assert(reservationSource.includes('{ new: true, session, runValidators: true }'));
  assert(!reservationSource.includes('$inc: { balance: -take'));
  ok('la reserva conserva FIFO, CAS, sesión y validación de Mongoose');

  console.log(`\nComposición de saldo a favor: ${passed}/${passed} controles.`);
}

run().catch((error) => {
  console.error('\nFAIL composición de saldo a favor');
  console.error(error);
  process.exitCode = 1;
});
