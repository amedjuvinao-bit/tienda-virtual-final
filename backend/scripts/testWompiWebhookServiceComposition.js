'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const approvedFacade = require('../services/wompiWebhookApprovedProcessor');
const approvedFactory = require('../services/wompiWebhookApproved/factory');
const {
  retryApprovedInventory,
} = require('../services/wompiWebhookApproved/inventoryRetry');
const orderFacade = require('../services/wompiWebhookOrderService');
const orderFactory = require('../services/wompiWebhookOrder/factory');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const lineCount = (source) => source.split(/\r?\n/).length;

const INTERNAL_LIMITS = {
  'services/wompiWebhookApproved/dependencies.js': 100,
  'services/wompiWebhookApproved/factory.js': 150,
  'services/wompiWebhookApproved/initialTransaction.js': 250,
  'services/wompiWebhookApproved/inventoryFailure.js': 175,
  'services/wompiWebhookApproved/inventoryRetry.js': 200,
  'services/wompiWebhookApproved/postCommitResult.js': 100,
  'services/wompiWebhookOrder/approved.js': 100,
  'services/wompiWebhookOrder/dependencies.js': 175,
  'services/wompiWebhookOrder/factory.js': 75,
  'services/wompiWebhookOrder/nonApproved.js': 375,
  'services/wompiWebhookOrder/orderTransaction.js': 100,
};

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

async function run() {
  assert.deepEqual(Object.keys(approvedFacade), [
    'createWompiWebhookIntegrityService',
  ]);
  assert.deepEqual(Object.keys(orderFacade), [
    'createWompiWebhookOrderService',
  ]);
  assert.strictEqual(
    approvedFacade.createWompiWebhookIntegrityService,
    approvedFactory.createWompiWebhookIntegrityService
  );
  assert.strictEqual(
    orderFacade.createWompiWebhookOrderService,
    orderFactory.createWompiWebhookOrderService
  );
  ok('las dos fachadas conservan exactamente sus factories públicas');

  for (const facadePath of [
    'services/wompiWebhookApprovedProcessor.js',
    'services/wompiWebhookOrderService.js',
  ]) {
    const source = read(facadePath);
    assert(lineCount(source) <= 100, `${facadePath} superó 100 líneas`);
    assert(!source.includes("require('mongoose')"));
    assert(!source.includes('/models/'));
  }
  for (const [modulePath, maximum] of Object.entries(INTERNAL_LIMITS)) {
    const source = read(modulePath);
    assert(
      lineCount(source) <= maximum,
      `${modulePath} superó el ratchet de ${maximum} líneas`
    );
    assert(!source.includes('wompiWebhookApprovedProcessor'));
    assert(!source.includes('wompiWebhookOrderService'));
  }
  ok('fachadas e internos respetan límites explícitos y dependencias unidireccionales');

  assert.throws(
    () => approvedFacade.createWompiWebhookIntegrityService(),
    (error) => error.message === 'withOrderTransaction es obligatorio.'
  );
  assert.throws(
    () => orderFacade.createWompiWebhookOrderService(),
    (error) => error.message === 'WOMPI_ORDER_MONGOOSE_ADAPTER_REQUIRED'
  );
  assert.throws(
    () =>
      orderFacade.createWompiWebhookOrderService({
        mongooseAdapter: { startSession: async () => ({}) },
      }),
    (error) => error.message === 'WOMPI_ORDER_MODELS_REQUIRED'
  );
  ok('el orden y texto de validación de dependencias permanece estable');

  let transactionCalls = 0;
  let postCommitCalls = 0;
  const approved = approvedFacade.createWompiWebhookIntegrityService({
    withOrderTransaction: async () => {
      transactionCalls += 1;
    },
    confirmInventoryReservation: async () => ({}),
    applyReservationToOrderDocument: () => {},
    processPostCommitEffects: async () => {
      postCommitCalls += 1;
      return {};
    },
    claimApprovedPaymentAttempt: async () => ({ allowed: true }),
  });
  const unverified = await approved.processApproved({
    orderNumber: 'ORDER-PARITY',
    transaction: { status: 'APPROVED' },
    verified: false,
  });
  assert.equal(unverified.ok, false);
  assert.equal(unverified.ignored, true);
  assert.equal(unverified.error.code, 'UNVERIFIED_PAYMENT_APPROVAL');
  assert.equal(transactionCalls, 0);
  assert.equal(postCommitCalls, 0);
  ok('una aprobación no verificada conserva el cierre temprano sin efectos');

  const recoveredDuringRetry = {
    ok: true,
    recoveredConcurrently: true,
    inventoryReady: true,
  };
  const retryOutcome = await retryApprovedInventory({
    dependencies: {
      confirmReservation: async () => {
        throw Object.assign(new Error('transient'), { retryable: true });
      },
    },
    initial: { orderId: 'order-1', orderNumber: 'ORDER-1' },
    orderNumber: 'ORDER-1',
    payments: {},
    persistInventoryFailure: async () => recoveredDuringRetry,
    reference: 'ORDER-ORDER-1',
    transaction: {},
    verified: true,
  });
  assert.equal(retryOutcome.terminal, true);
  assert.strictEqual(retryOutcome.result, recoveredDuringRetry);
  ok('la recuperación concurrente durante retry retorna sin duplicar post-commit');

  const releaseReservation = async () => ({});
  const applyReservation = () => {};
  const reconcileReservation = async () => ({});
  const recovery = {
    process: async () => ({ completed: true }),
    reconcileApproved: async (payload) => ({ completed: true, payload }),
  };
  let recoveryDependencies = null;
  let integrityDependencies = null;
  const claimApprovedAttempt = async () => ({ allowed: true });
  const findAttempt = async () => null;
  const service = orderFacade.createWompiWebhookOrderService({
    mongooseAdapter: { startSession: async () => ({}) },
    OrderModel: {},
    OrderEventModel: { create: async () => {} },
    getStoreCreditCheckoutService: () => ({}),
    createPaymentInventoryFailureService: (dependencies) => {
      recoveryDependencies = dependencies;
      return recovery;
    },
    createWompiWebhookIntegrityService: (dependencies) => {
      integrityDependencies = dependencies;
      return {
        processApproved: async (payload) => ({ payload }),
      };
    },
    buildPaymentFailureReleaseReason: () => '',
    confirmInventoryReservation: async () => ({}),
    reconcilePaymentFailureReservation: reconcileReservation,
    releaseInventoryReservation: releaseReservation,
    applyReservationToOrderDocument: applyReservation,
    isApprovedPayment: () => false,
    resolveMonotonicWompiTransition: () => ({
      ignored: true,
      reason: 'APPROVED_IS_TERMINAL',
    }),
    runPaymentInventoryTransaction: async () => {
      throw new Error('No debía abrir una transacción');
    },
    invoiceSchedulingService: { scheduleOnce: async () => ({}) },
    paymentAttemptService: {
      claimApprovedAttempt,
      findAttempt,
      claimNonApprovedAttempt: async () => ({ allowed: true }),
    },
    fingerprintPaymentMerchant: () => 'merchant-fingerprint',
    trimSafe: (value, maximum = 300) =>
      String(value || '').trim().slice(0, maximum),
    logger: { log: () => {} },
  });
  assert.equal(Object.isFrozen(service), true);
  assert.deepEqual(Object.keys(service), [
    'paymentInventoryFailureService',
    'findPaymentAttempt',
    'processApproved',
    'processNonApproved',
  ]);
  assert.strictEqual(service.paymentInventoryFailureService, recovery);
  assert.strictEqual(service.findPaymentAttempt, findAttempt);
  assert.strictEqual(recoveryDependencies.releaseReservation, releaseReservation);
  assert.strictEqual(recoveryDependencies.applyReservation, applyReservation);
  assert.strictEqual(recoveryDependencies.reconcileReservation, reconcileReservation);
  assert.equal(typeof integrityDependencies.withOrderTransaction, 'function');
  assert.strictEqual(
    integrityDependencies.claimApprovedPaymentAttempt,
    claimApprovedAttempt
  );
  ok('la composición conserva recuperación, ledger y superficie congelada');

  const approvedResult = await service.processApproved({
    payments: { credentials: { wompi: { publicKey: 'pub_test' } } },
  });
  assert.equal(
    approvedResult.payload.merchantFingerprint,
    'merchant-fingerprint'
  );
  const ignored = await service.processNonApproved({
    existingOrder: {
      status: 'paid',
      payment: { status: 'paid', transactionId: 'tx-original' },
    },
    mapped: { paymentStatus: 'failed' },
    orderNumber: 'ORDER-PARITY',
    transaction: { id: 'tx-late' },
    payments: {},
    reference: 'ORDER-ORDER-PARITY',
    eventName: 'transaction.updated',
  });
  assert.deepEqual(ignored, {
    ok: true,
    received: true,
    ignored: true,
    reason: 'APPROVED_IS_TERMINAL',
    event: 'transaction.updated',
    orderNumber: 'ORDER-PARITY',
    orderStatus: 'paid',
    paymentStatus: 'paid',
    transactionId: 'tx-original',
    reference: 'ORDER-ORDER-PARITY',
  });
  ok('wrappers aprobados y no aprobados conservan payloads y respuestas');

  console.log(`\nComposición Wompi webhook: ${passed}/${passed} controles.`);
}

run().catch((error) => {
  console.error('\nFAIL composición Wompi webhook');
  console.error(error);
  process.exitCode = 1;
});
