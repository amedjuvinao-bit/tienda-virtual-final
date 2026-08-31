/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  AUTOMATION_LOCK_MS,
  claimStage,
  completePaymentStageManually,
  setClaimedStage,
} = require('../services/orderRefundAutomation/claims');
const { automatePayment } = require('../services/orderRefundAutomation/paymentStage');

let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK ${passed}: ${label}`);
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function valueAt(sourceValue, dottedPath) {
  return dottedPath
    .split('.')
    .reduce((value, part) => value?.[part], sourceValue);
}

function setAt(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  const finalPart = parts.pop();
  const parent = parts.reduce((current, part) => {
    current[part] = current[part] || {};
    return current[part];
  }, target);
  parent[finalPart] = value;
}

function conditionMatches(state, condition = {}) {
  return Object.entries(condition).every(([pathName, expected]) => {
    const actual = valueAt(state, pathName);
    if (expected && Array.isArray(expected.$in)) {
      return expected.$in.includes(actual);
    }
    if (expected && expected.$lt instanceof Date) {
      return actual && new Date(actual).getTime() < expected.$lt.getTime();
    }
    return String(actual) === String(expected);
  });
}

function sharedRefundModel(initial) {
  const state = structuredClone(initial);

  function matches(filter = {}) {
    if (filter._id !== undefined && String(filter._id) !== String(state._id)) {
      return false;
    }
    if (filter.order !== undefined && String(filter.order) !== String(state.order)) {
      return false;
    }
    if (filter.$or && !filter.$or.some((condition) => conditionMatches(state, condition))) {
      return false;
    }
    return conditionMatches(
      state,
      Object.fromEntries(
        Object.entries(filter).filter(([key]) => !['_id', 'order', '$or'].includes(key))
      )
    );
  }

  return {
    state,
    async findOneAndUpdate(filter, update) {
      if (!matches(filter)) return null;
      Object.entries(update.$set || {}).forEach(([pathName, value]) => {
        setAt(state, pathName, value);
      });
      Object.entries(update.$inc || {}).forEach(([pathName, value]) => {
        setAt(state, pathName, Number(valueAt(state, pathName) || 0) + value);
      });
      return structuredClone(state);
    },
    async findOne(filter) {
      return matches(filter) ? structuredClone(state) : null;
    },
    async findById(id) {
      return String(id) === String(state._id) ? structuredClone(state) : null;
    },
  };
}

function refund(overrides = {}) {
  return {
    _id: '68a000000000000000000901',
    order: '68a000000000000000000001',
    requestHash: 'refund-concurrency-hash',
    reconciliation: {
      payment: {
        state: 'action_required',
        attempts: 0,
        claimId: '',
        reference: '',
        lastAttemptAt: null,
      },
    },
    ...overrides,
  };
}

async function run() {
  const model = sharedRefundModel(refund());
  const executionStarted = deferred();
  const releaseGateway = deferred();
  let gatewayExecutions = 0;
  const gateway = async ({ execute }) => {
    if (!execute) {
      return { completed: false, manualRequired: false };
    }
    gatewayExecutions += 1;
    executionStarted.resolve();
    await releaseGateway.promise;
    return {
      completed: true,
      reference: 'GW-REFUND-001',
      providerStatus: 'VOIDED',
    };
  };

  const automatic = automatePayment(
    {
      order: { _id: model.state.order },
      refund: structuredClone(model.state),
      adminLabel: 'worker',
      gateway,
    },
    { OrderRefundModel: model }
  );
  await executionStarted.promise;

  await assert.rejects(
    () => completePaymentStageManually(
      structuredClone(model.state),
      'MANUAL-REF-001',
      'admin',
      { OrderRefundModel: model }
    ),
    (error) => error?.code === 'PAYMENT_REVERSAL_AUTOMATION_IN_PROGRESS'
  );
  assert.strictEqual(gatewayExecutions, 1);
  assert.strictEqual(model.state.reconciliation.payment.state, 'processing');
  ok('la confirmación manual no puede competir con un gateway en vuelo');

  releaseGateway.resolve();
  const automaticOutcome = await automatic;
  assert.strictEqual(automaticOutcome.state, 'completed');
  assert.strictEqual(model.state.reconciliation.payment.reference, 'GW-REFUND-001');
  assert.strictEqual(gatewayExecutions, 1);
  ok('el claim automático completa una sola referencia monetaria');

  const replay = await completePaymentStageManually(
    structuredClone(model.state),
    'GW-REFUND-001',
    'admin',
    { OrderRefundModel: model }
  );
  assert.strictEqual(replay.replayed, true);
  await assert.rejects(
    () => completePaymentStageManually(
      structuredClone(model.state),
      'OTRA-REFERENCIA',
      'admin',
      { OrderRefundModel: model }
    ),
    (error) => error?.code === 'PAYMENT_REVERSAL_ALREADY_CONFIRMED'
  );
  assert.strictEqual(gatewayExecutions, 1);
  ok('el replay idéntico es idempotente y una segunda referencia se rechaza');

  const staleAt = new Date('2026-08-27T10:00:00.000Z');
  const staleModel = sharedRefundModel(refund({
    reconciliation: {
      payment: {
        state: 'processing',
        attempts: 1,
        claimId: 'gateway-worker-obsoleto',
        reference: '',
        lastAttemptAt: staleAt,
      },
    },
  }));
  await assert.rejects(
    () => completePaymentStageManually(
      structuredClone(staleModel.state),
      'MANUAL-AFTER-TIMEOUT',
      'admin',
      {
        OrderRefundModel: staleModel,
        now: new Date(staleAt.getTime() + AUTOMATION_LOCK_MS + 1),
      }
    ),
    (error) => error?.code === 'PAYMENT_REVERSAL_AUTOMATION_IN_PROGRESS'
  );
  const reclaimed = await claimStage(
    structuredClone(staleModel.state),
    'payment',
    {
      OrderRefundModel: staleModel,
      now: new Date(staleAt.getTime() + AUTOMATION_LOCK_MS + 1),
      claimId: 'gateway-worker-recuperacion',
    }
  );
  assert.strictEqual(
    reclaimed.reconciliation.payment.claimId,
    'gateway-worker-recuperacion'
  );
  const staleWorkerCompletion = await setClaimedStage(
    staleModel.state._id,
    'payment',
    'gateway-worker-obsoleto',
    { state: 'completed', reference: 'LATE-GATEWAY-RESULT' },
    { OrderRefundModel: staleModel }
  );
  assert.strictEqual(staleWorkerCompletion, null);
  const recoveredCompletion = await setClaimedStage(
    staleModel.state._id,
    'payment',
    'gateway-worker-recuperacion',
    { state: 'completed', reference: 'RECOVERED-GATEWAY-RESULT' },
    { OrderRefundModel: staleModel }
  );
  assert.strictEqual(recoveredCompletion.reconciliation.payment.state, 'completed');
  assert.strictEqual(
    staleModel.state.reconciliation.payment.reference,
    'RECOVERED-GATEWAY-RESULT'
  );
  ok('un claim vencido solo se recupera por la pasarela idempotente y cerca al worker obsoleto');

  const reconciliationSource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'orderRefundReconciliationService.js'),
    'utf8'
  );
  assert(reconciliationSource.includes('completePaymentStageManually('));
  assert(!reconciliationSource.includes('refund.reconciliation.payment ='));
  ok('el endpoint manual delega en el mismo CAS y no persiste por save vulnerable');

  console.log(`\nConcurrencia de reversos de pago: ${passed}/5 controles superados.`);
}

run().catch((error) => {
  console.error('\nFALLO concurrencia de reversos de pago:', error);
  process.exitCode = 1;
});
