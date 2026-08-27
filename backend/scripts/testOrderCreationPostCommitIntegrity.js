'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const {
  normalizeNewsletterIntent,
  persistNewsletterSubscription,
} = require('../services/orderCreationNewsletterService');
const {
  createOrderCreationPostCommitService,
  isFullyPaidStoreCreditOrder,
} = require('../services/orderCreationPostCommitService');

let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    cursor[part] = cursor[part] || {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function applySet(target, update = {}) {
  for (const [key, value] of Object.entries(update.$set || {})) {
    setPath(target, key, value);
  }
}

function getPath(target, dottedPath) {
  return dottedPath
    .split('.')
    .reduce((value, part) => value?.[part], target);
}

function matchesCondition(value, condition) {
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    if ('$in' in condition) return condition.$in.includes(value);
    if ('$exists' in condition) {
      return condition.$exists ? value !== undefined : value === undefined;
    }
    if ('$lt' in condition) return new Date(value) < new Date(condition.$lt);
  }
  return String(value) === String(condition);
}

function matchesFilter(target, filter = {}) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') {
      return condition.some((candidate) => matchesFilter(target, candidate));
    }
    return matchesCondition(getPath(target, key), condition);
  });
}

function createFakeOrderModel(state) {
  return {
    async findOneAndUpdate(filter, update) {
      if (!matchesFilter(state, filter)) return null;
      assert.strictEqual(filter['payment.status'], 'paid');
      assert.deepStrictEqual(
        filter['paymentProcessing.inventory.status'].$in,
        ['confirmed', 'not_required']
      );
      applySet(state, update);
      return state;
    },
    async updateOne(filter, update) {
      if (!matchesFilter(state, filter)) {
        return { matchedCount: 0, modifiedCount: 0 };
      }
      applySet(state, update);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
}

async function testExistingSubscriberDoesNotAbortCheckout() {
  const intent = normalizeNewsletterIntent(
    {
      wantsNewsletter: true,
      emailOrPhone: ' EXISTING@EXAMPLE.COM ',
      phone: '+573001112233',
    },
    'checkout-session'
  );
  assert.strictEqual(intent.email, 'existing@example.com');

  const calls = [];
  const SubscriberModel = {
    async findOneAndUpdate(filter, update, options) {
      calls.push({ filter, update, options });
      return { _id: 'subscriber-existing' };
    },
  };
  const result = await persistNewsletterSubscription(intent, {
    SubscriberModel,
  });
  assert.strictEqual(result.persisted, true);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].options.upsert, true);
  assert.deepStrictEqual(calls[0].filter.$or, [
    { email: 'existing@example.com' },
    { phone: '+573001112233' },
  ]);
  ok('un cliente ya suscrito se reutiliza mediante upsert fuera de la transacción');

  let attempt = 0;
  const racingSubscriberModel = {
    async findOneAndUpdate() {
      attempt += 1;
      if (attempt === 1) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      return { _id: 'subscriber-race-winner' };
    },
  };
  const raced = await persistNewsletterSubscription(intent, {
    SubscriberModel: racingSubscriberModel,
  });
  assert.strictEqual(raced.persisted, true);
  assert.strictEqual(raced.reused, true);
  assert.strictEqual(attempt, 2);
  ok('una carrera de índice único reintenta la suscripción sin afectar la orden');
}

async function testDurablePostCommitRetry() {
  const orderId = new mongoose.Types.ObjectId();
  const state = {
    _id: orderId,
    orderNumber: '009901',
    status: 'paid',
    payment: {
      status: 'paid',
      provider: 'store_credit',
      amount: 0,
      transactionId: 'SC-usage-1',
      reference: 'ORDER-009901',
      currency: 'COP',
    },
    storeCredit: { applied: true, status: 'consumed' },
    paymentProcessing: {
      provider: 'store_credit',
      approvedTransactionId: 'SC-usage-1',
      inventory: { status: 'confirmed' },
      fulfillment: { status: 'pending', claimId: '' },
      invoice: { status: 'pending', claimId: '' },
    },
  };
  assert.strictEqual(isFullyPaidStoreCreditOrder(state), true);

  let fulfillmentCalls = 0;
  let invoiceCalls = 0;
  let shouldFail = true;
  let tick = 0;
  const service = createOrderCreationPostCommitService({
    OrderModel: createFakeOrderModel(state),
    fulfillmentProcessor: async () => {
      fulfillmentCalls += 1;
      if (shouldFail) {
        throw Object.assign(new Error('delivery unavailable'), {
          code: 'DELIVERY_TEMPORARY_FAILURE',
        });
      }
      return { skipped: false, notified: true };
    },
    invoiceExecutor: async (options) => {
      invoiceCalls += 1;
      assert.strictEqual(options.processFulfillment, false);
      if (shouldFail) {
        throw Object.assign(new Error('invoice unavailable'), {
          code: 'INVOICE_TEMPORARY_FAILURE',
        });
      }
      return {
        outcome: 'performed',
        performed: true,
        reasonCode: 'INVOICE_PROCESSED',
      };
    },
    now: () => new Date(Date.UTC(2026, 7, 27, 12, 0, tick++)),
    randomUUID: () => `claim-${tick}`,
    logger: { error() {}, warn() {}, log() {} },
  });

  const first = await service.processFullyPaidStoreCreditOrder({ order: state });
  assert.strictEqual(first.retryable, true);
  assert.strictEqual(state.paymentProcessing.fulfillment.status, 'failed');
  assert.strictEqual(state.paymentProcessing.invoice.status, 'failed');
  assert.strictEqual(
    state.paymentProcessing.fulfillment.errorCode,
    'DELIVERY_TEMPORARY_FAILURE'
  );
  assert.strictEqual(
    state.paymentProcessing.invoice.errorCode,
    'INVOICE_TEMPORARY_FAILURE'
  );
  ok('los fallos post-commit quedan persistidos como reintentables');

  shouldFail = false;
  const replay = await service.processFullyPaidStoreCreditOrder({ order: state });
  assert.strictEqual(replay.retryable, false);
  assert.strictEqual(state.paymentProcessing.fulfillment.status, 'completed');
  assert.strictEqual(state.paymentProcessing.invoice.status, 'scheduled');
  assert.strictEqual(fulfillmentCalls, 2);
  assert.strictEqual(invoiceCalls, 2);
  ok('el replay reclama y completa entrega y factura después de un fallo');

  const duplicate = await service.processFullyPaidStoreCreditOrder({ order: state });
  assert.strictEqual(duplicate.fulfillment.duplicate, true);
  assert.strictEqual(duplicate.invoice.duplicate, true);
  assert.strictEqual(fulfillmentCalls, 2);
  assert.strictEqual(invoiceCalls, 2);
  ok('los efectos completados son idempotentes y no se ejecutan dos veces');
}

function paidState(provider, transactionId, overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    orderNumber: `POST-${provider}`,
    status: overrides.status || 'paid',
    payment: {
      status: 'paid',
      provider,
      transactionId,
      reference: `ORDER-${provider}`,
      currency: 'COP',
    },
    paymentProcessing: {
      provider,
      approvedTransactionId: transactionId,
      inventory: { status: 'not_required' },
      fulfillment: {
        status: 'pending',
        claimId: '',
        ...(overrides.fulfillment || {}),
      },
      invoice: {
        status: 'pending',
        claimId: '',
        ...(overrides.invoice || {}),
      },
    },
  };
}

async function testProviderAgnosticPostCommitMatrix() {
  for (const provider of ['wompi', 'payu', 'manual', 'store_credit']) {
    const transactionId = `tx-${provider}`;
    const state = paidState(provider, transactionId, {
      status: provider === 'manual' ? 'delivered' : 'paid',
    });
    const calls = { fulfillment: 0, invoice: 0 };
    const service = createOrderCreationPostCommitService({
      OrderModel: createFakeOrderModel(state),
      fulfillmentProcessor: async (options) => {
        calls.fulfillment += 1;
        assert.strictEqual(options.paymentProvider, provider);
        return { notified: true };
      },
      invoiceExecutor: async (options) => {
        calls.invoice += 1;
        assert.strictEqual(options.paymentProvider, provider);
        assert.strictEqual(options.processFulfillment, false);
        return {
          outcome: 'performed',
          performed: true,
          reasonCode: 'INVOICE_PROCESSED',
        };
      },
      logger: { error() {}, warn() {}, log() {} },
    });
    const result = await service.processPaidOrderEffects({
      orderId: state._id,
      paymentProvider: provider,
      transaction: { id: transactionId, status: 'APPROVED' },
    });
    assert.strictEqual(result.retryable, false);
    assert.strictEqual(state.paymentProcessing.fulfillment.status, 'completed');
    assert.strictEqual(state.paymentProcessing.invoice.status, 'scheduled');
    assert.deepStrictEqual(calls, { fulfillment: 1, invoice: 1 });
  }
  ok('Wompi, PayU, manual y saldo usan los mismos dos carriles durables');
}

async function testIdentityFencingAndConcurrency() {
  const state = paidState('wompi', 'tx-canonical');
  let fulfillmentCalls = 0;
  let invoiceCalls = 0;
  const service = createOrderCreationPostCommitService({
    OrderModel: createFakeOrderModel(state),
    fulfillmentProcessor: async () => {
      fulfillmentCalls += 1;
      return { notified: true };
    },
    invoiceExecutor: async () => {
      invoiceCalls += 1;
      return { outcome: 'performed', performed: true };
    },
    logger: { error() {}, warn() {}, log() {} },
  });

  const wrongIdentity = await service.processPaidOrderEffects({
    orderId: state._id,
    paymentProvider: 'wompi',
    transaction: { id: 'tx-different' },
  });
  assert.strictEqual(wrongIdentity.fulfillment.duplicate, true);
  assert.strictEqual(wrongIdentity.invoice.duplicate, true);
  assert.strictEqual(fulfillmentCalls, 0);
  assert.strictEqual(invoiceCalls, 0);

  const [first, concurrent] = await Promise.all([
    service.processPaidOrderEffects({
      orderId: state._id,
      paymentProvider: 'wompi',
      transaction: { id: 'tx-canonical' },
    }),
    service.processPaidOrderEffects({
      orderId: state._id,
      paymentProvider: 'wompi',
      transaction: { id: 'tx-canonical' },
    }),
  ]);
  assert.strictEqual(first.processed, true);
  assert.strictEqual(concurrent.processed, true);
  assert.strictEqual(fulfillmentCalls, 1);
  assert.strictEqual(invoiceCalls, 1);
  ok('identidad provider+transacción y claims atómicos cercan replay y concurrencia');
}

async function testIndependentLanesAndPendingNotification() {
  const firstState = paidState('manual', 'manual-independent');
  const first = createOrderCreationPostCommitService({
    OrderModel: createFakeOrderModel(firstState),
    fulfillmentProcessor: async () => {
      throw Object.assign(new Error('delivery failed'), {
        code: 'DELIVERY_FAILED',
      });
    },
    invoiceExecutor: async () => ({
      outcome: 'performed',
      performed: true,
    }),
    logger: { error() {}, warn() {}, log() {} },
  });
  const firstResult = await first.processPaidOrderEffects({
    orderId: firstState._id,
    paymentProvider: 'manual',
    transaction: { id: 'manual-independent' },
  });
  assert.strictEqual(firstResult.retryable, true);
  assert.strictEqual(firstState.paymentProcessing.fulfillment.status, 'failed');
  assert.strictEqual(firstState.paymentProcessing.invoice.status, 'scheduled');

  const secondState = paidState('payu', 'payu-independent');
  const second = createOrderCreationPostCommitService({
    OrderModel: createFakeOrderModel(secondState),
    fulfillmentProcessor: async () => ({
      notificationInProgress: true,
    }),
    invoiceExecutor: async () => {
      throw Object.assign(new Error('invoice failed'), {
        code: 'INVOICE_FAILED',
      });
    },
    logger: { error() {}, warn() {}, log() {} },
  });
  const secondResult = await second.processPaidOrderEffects({
    orderId: secondState._id,
    paymentProvider: 'payu',
    transaction: { id: 'payu-independent' },
  });
  assert.strictEqual(secondResult.retryable, true);
  assert.strictEqual(secondState.paymentProcessing.fulfillment.status, 'pending');
  assert.strictEqual(
    secondState.paymentProcessing.fulfillment.outcomeCode,
    'FULFILLMENT_NOTIFICATION_IN_PROGRESS'
  );
  assert.strictEqual(secondState.paymentProcessing.invoice.status, 'failed');
  ok('cada carril falla o queda pendiente sin ocultar ni bloquear al otro');
}

async function testInventoryBarrierDoesNotClaimPostCommitLanes() {
  for (const inventoryStatus of ['pending', 'failed']) {
    const state = paidState('wompi', `wompi-inventory-${inventoryStatus}`);
    state.paymentProcessing.inventory.status = inventoryStatus;
    let externalCalls = 0;
    const service = createOrderCreationPostCommitService({
      OrderModel: createFakeOrderModel(state),
      fulfillmentProcessor: async () => {
        externalCalls += 1;
        return { notified: true };
      },
      invoiceExecutor: async () => {
        externalCalls += 1;
        return { outcome: 'performed', performed: true };
      },
      logger: { error() {}, warn() {}, log() {} },
    });

    const result = await service.processPaidOrderEffects({
      orderId: state._id,
      paymentProvider: 'wompi',
      transaction: { id: `wompi-inventory-${inventoryStatus}` },
    });

    assert.strictEqual(result.fulfillment.duplicate, true);
    assert.strictEqual(result.invoice.duplicate, true);
    assert.strictEqual(state.paymentProcessing.fulfillment.status, 'pending');
    assert.strictEqual(state.paymentProcessing.invoice.status, 'pending');
    assert.strictEqual(externalCalls, 0);
  }
  ok('inventario pendiente o fallido bloquea ambos claims post-pago');
}

async function testTerminalNotRequiredOutcomes() {
  const state = paidState('manual', 'manual-not-required');
  let fulfillmentCalls = 0;
  let invoiceCalls = 0;
  const service = createOrderCreationPostCommitService({
    OrderModel: createFakeOrderModel(state),
    fulfillmentProcessor: async () => {
      fulfillmentCalls += 1;
      return { reason: 'no_digital_or_service_items' };
    },
    invoiceExecutor: async () => {
      invoiceCalls += 1;
      return {
        outcome: 'skipped',
        terminal: true,
        reasonCode: 'ELECTRONIC_BILLING_INACTIVE',
      };
    },
    logger: { error() {}, warn() {}, log() {} },
  });

  const result = await service.processPaidOrderEffects({
    orderId: state._id,
    paymentProvider: 'manual',
    transaction: { id: 'manual-not-required' },
  });

  assert.strictEqual(result.retryable, false);
  assert.strictEqual(result.fulfillment.notRequired, true);
  assert.strictEqual(result.invoice.terminal, true);
  assert.strictEqual(state.paymentProcessing.fulfillment.status, 'not_required');
  assert.strictEqual(
    state.paymentProcessing.fulfillment.outcomeCode,
    'FULFILLMENT_NOT_REQUIRED'
  );
  assert.strictEqual(state.paymentProcessing.invoice.status, 'not_required');
  assert.strictEqual(
    state.paymentProcessing.invoice.outcomeCode,
    'ELECTRONIC_BILLING_INACTIVE'
  );
  assert.strictEqual(fulfillmentCalls, 1);
  assert.strictEqual(invoiceCalls, 1);
  ok('sin ítems entregables y facturación inactiva cierran como not_required');
}

async function testStaleLeaseCrashRecovery() {
  const now = new Date('2026-08-27T12:00:00.000Z');
  const stale = new Date(now.getTime() - 11 * 60 * 1000);
  const state = paidState('wompi', 'tx-after-crash', {
    status: 'shipped',
    fulfillment: {
      status: 'processing',
      claimId: 'dead-worker-fulfillment',
      claimedAt: stale,
    },
    invoice: {
      status: 'scheduling',
      claimId: 'dead-worker-invoice',
      claimedAt: stale,
    },
  });
  let invoiceReuses = 0;
  const service = createOrderCreationPostCommitService({
    OrderModel: createFakeOrderModel(state),
    fulfillmentProcessor: async () => ({ notified: true, reused: true }),
    invoiceExecutor: async () => {
      invoiceReuses += 1;
      return {
        outcome: 'performed',
        performed: true,
        reused: true,
        reasonCode: 'INVOICE_REUSED',
      };
    },
    now: () => now,
    randomUUID: (() => {
      let claim = 0;
      return () => `recovery-claim-${++claim}`;
    })(),
    logger: { error() {}, warn() {}, log() {} },
  });
  const recovered = await service.processPaidOrderEffects({
    orderId: state._id,
    paymentProvider: 'wompi',
    transaction: { id: 'tx-after-crash' },
  });
  assert.strictEqual(recovered.retryable, false);
  assert.strictEqual(state.paymentProcessing.fulfillment.status, 'completed');
  assert.strictEqual(state.paymentProcessing.invoice.status, 'scheduled');
  assert.strictEqual(invoiceReuses, 1);
  ok('leases vencidos se recuperan tras crash usando efectos subyacentes idempotentes');
}

async function testFreshLeaseAndStaleWorkerFencing() {
  const now = new Date('2026-08-27T12:00:00.000Z');
  const freshState = paidState('manual', 'manual-fresh-lease', {
    fulfillment: {
      status: 'processing',
      claimId: 'active-fulfillment',
      claimedAt: new Date(now.getTime() - 60 * 1000),
    },
    invoice: {
      status: 'scheduling',
      claimId: 'active-invoice',
      claimedAt: new Date(now.getTime() - 60 * 1000),
    },
  });
  let effects = 0;
  const freshService = createOrderCreationPostCommitService({
    OrderModel: createFakeOrderModel(freshState),
    fulfillmentProcessor: async () => {
      effects += 1;
      return { notified: true };
    },
    invoiceExecutor: async () => {
      effects += 1;
      return { outcome: 'performed', performed: true };
    },
    now: () => now,
    logger: { error() {}, warn() {}, log() {} },
  });
  const fresh = await freshService.processPaidOrderEffects({
    orderId: freshState._id,
    paymentProvider: 'manual',
    transaction: { id: 'manual-fresh-lease' },
  });
  assert.strictEqual(fresh.fulfillment.duplicate, true);
  assert.strictEqual(fresh.invoice.duplicate, true);
  assert.strictEqual(effects, 0);

  const fencedState = paidState('payu', 'payu-fenced-worker');
  let releaseWorker;
  let markWorkerStarted;
  const workerStarted = new Promise((resolve) => {
    markWorkerStarted = resolve;
  });
  const release = new Promise((resolve) => {
    releaseWorker = resolve;
  });
  const fencedService = createOrderCreationPostCommitService({
    OrderModel: createFakeOrderModel(fencedState),
    fulfillmentProcessor: async () => {
      markWorkerStarted();
      await release;
      return { notified: true };
    },
    invoiceExecutor: async () => ({ outcome: 'performed', performed: true }),
    now: () => now,
    randomUUID: () => 'old-worker-claim',
    logger: { error() {}, warn() {}, log() {} },
  });
  const staleWorker = fencedService.processFulfillmentOnce({
    orderId: fencedState._id,
    paymentProvider: 'payu',
    transaction: { id: 'payu-fenced-worker' },
  });
  await workerStarted;
  fencedState.paymentProcessing.fulfillment.claimId = 'new-worker-claim';
  releaseWorker();
  const fenced = await staleWorker;
  assert.strictEqual(fenced.superseded, true);
  assert.notStrictEqual(
    fencedState.paymentProcessing.fulfillment.status,
    'completed'
  );
  ok('un lease vigente no se roba y un worker vencido no puede cerrar el claim nuevo');
}

async function testPostCommitInfrastructureFailureDoesNotRejectOrder() {
  const order = {
    _id: new mongoose.Types.ObjectId(),
    orderNumber: '009902',
    status: 'paid',
    payment: {
      status: 'paid',
      provider: 'store_credit',
      amount: 0,
      transactionId: 'SC-usage-2',
    },
    storeCredit: { applied: true, status: 'consumed' },
  };
  const unavailableModel = {
    async findOneAndUpdate() {
      throw Object.assign(new Error('database unavailable'), {
        code: 'DATABASE_TEMPORARY_FAILURE',
      });
    },
    async updateOne() {
      throw new Error('unexpected update');
    },
  };
  const service = createOrderCreationPostCommitService({
    OrderModel: unavailableModel,
    fulfillmentProcessor: async () => {
      throw new Error('unexpected fulfillment');
    },
    invoiceExecutor: async () => {
      throw new Error('unexpected invoice');
    },
    logger: { error() {}, warn() {}, log() {} },
  });

  const result = await service.processFullyPaidStoreCreditOrder({ order });
  assert.strictEqual(result.processed, true);
  assert.strictEqual(result.retryable, true);
  assert.strictEqual(result.fulfillment.failed, true);
  assert.strictEqual(result.invoice.failed, true);
  ok('una caída al reclamar efectos post-commit no convierte la orden ya pagada en fallo');
}

function testCompositionAndSchema() {
  const transactionSource = fs.readFileSync(
    path.join(__dirname, '../services/orderCreationTransactionService.js'),
    'utf8'
  );
  const controllerSource = fs.readFileSync(
    path.join(__dirname, '../controllers/orderCreationController.js'),
    'utf8'
  );
  const paymentRouteSource = fs.readFileSync(
    path.join(__dirname, '../routes/payments.js'),
    'utf8'
  );
  const payuRouteSource = fs.readFileSync(
    path.join(__dirname, '../routes/payuProductionWebhook.js'),
    'utf8'
  );
  const manualPostCommitSource = fs.readFileSync(
    path.join(
      __dirname,
      '../services/manualPaymentConfirmation/postCommit.js'
    ),
    'utf8'
  );
  assert(!transactionSource.includes("require('../models/Subscriber')"));
  assert(!transactionSource.includes('Subscriber.create'));
  assert(controllerSource.includes('await persistNewsletterSubscription(newsletterIntent)'));
  assert(controllerSource.includes('await processFullyPaidStoreCreditOrder'));
  assert(paymentRouteSource.includes('postCommitService: paymentPostCommitService'));
  assert(payuRouteSource.includes('postCommitService: paymentPostCommitService'));
  assert(manualPostCommitSource.includes('processPaidOrderEffects'));
  assert(!manualPostCommitSource.includes('electronicInvoiceAfterPaymentService'));
  assert(Order.schema.path('paymentProcessing.fulfillment.status'));
  assert(Order.schema.path('paymentProcessing.fulfillment.claimId'));
  ok('el contrato separa la compra de la suscripción y persiste los claims post-pago');
}

async function run() {
  await testExistingSubscriberDoesNotAbortCheckout();
  await testDurablePostCommitRetry();
  await testPostCommitInfrastructureFailureDoesNotRejectOrder();
  await testProviderAgnosticPostCommitMatrix();
  await testIdentityFencingAndConcurrency();
  await testIndependentLanesAndPendingNotification();
  await testInventoryBarrierDoesNotClaimPostCommitLanes();
  await testTerminalNotRequiredOutcomes();
  await testStaleLeaseCrashRecovery();
  await testFreshLeaseAndStaleWorkerFencing();
  testCompositionAndSchema();
  console.log(`\nIntegridad post-commit de creación: ${passed}/${passed} controles aprobados`);
}

run().catch((error) => {
  console.error('\nFAIL Integridad post-commit de creación');
  console.error(error);
  process.exitCode = 1;
});
