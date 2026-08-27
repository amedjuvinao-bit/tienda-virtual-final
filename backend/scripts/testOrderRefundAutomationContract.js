/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const OrderRefund = require('../models/OrderRefund');
const {
  AUTOMATION_LOCK_MS,
  buildAutomaticCreditNoteRequest,
  claimStage,
  operationKey,
  setClaimedStage,
} = require('../services/orderRefundAutomationService');
const {
  executeWompiAutomaticRefund,
  orderTotal,
  resolveWompiRefundCapability,
} = require('../services/wompiRefundGatewayService');
const {
  assertRefundCreditNoteAmount,
} = require('../services/orderRefunds/refundPaymentIntegrity');

let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK ${passed}: ${label}`);
}

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function config(overrides = {}) {
  return {
    active: true,
    provider: 'wompi',
    mode: 'sandbox',
    credentials: {
      wompi: { privateKey: 'prv_test_automation_contract' },
    },
    ...overrides,
  };
}

function order(overrides = {}) {
  return {
    _id: '68a000000000000000000001',
    total: 90000,
    payment: {
      provider: 'wompi',
      mode: 'sandbox',
      methodType: 'CARD',
      transactionId: 'wompi-transaction-001',
      amount: 90000,
    },
    refundControl: { transactionCount: 1 },
    items: [
      {
        product: '68a000000000000000000011',
        title: 'Producto trazable',
        quantity: 2,
        price: 45000,
      },
    ],
    ...overrides,
  };
}

function refund(overrides = {}) {
  return {
    _id: '68a000000000000000000101',
    amount: 90000,
    refundNumber: 'RF-AUTO-001',
    requestHash: 'hash-estable',
    reason: 'Devolución aprobada',
    reconciliation: {
      paymentProvider: 'wompi',
      paymentTransactionId: 'wompi-transaction-001',
    },
    items: [
      {
        product: '68a000000000000000000011',
        orderItemId: '68a000000000000000000021',
        returnedQuantity: 1,
      },
    ],
    ...overrides,
  };
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

function fencedRefundModel(initial) {
  const state = structuredClone(initial);
  return {
    state,
    async findOneAndUpdate(filter, update) {
      if (
        filter._id !== undefined &&
        String(filter._id) !== String(state._id)
      ) return null;
      if (
        filter.order !== undefined &&
        String(filter.order) !== String(state.order)
      ) return null;
      if (
        filter.$or &&
        !filter.$or.some((condition) => conditionMatches(state, condition))
      ) return null;
      const directFilter = Object.fromEntries(
        Object.entries(filter).filter(
          ([key]) => !['_id', 'order', '$or'].includes(key)
        )
      );
      if (!conditionMatches(state, directFilter)) return null;

      Object.entries(update.$set || {}).forEach(([pathName, value]) => {
        setAt(state, pathName, value);
      });
      Object.entries(update.$inc || {}).forEach(([pathName, value]) => {
        setAt(state, pathName, Number(valueAt(state, pathName) || 0) + value);
      });
      return structuredClone(state);
    },
  };
}

async function run() {
  const eligible = resolveWompiRefundCapability({
    order: order(),
    refund: refund(),
    config: config(),
  });
  assert.strictEqual(eligible.automatic, true);
  assert.strictEqual(eligible.transactionId, 'wompi-transaction-001');
  assert(eligible.baseUrl.includes('sandbox.wompi.co'));
  ok('solo una devolución total con tarjeta y configuración coincidente habilita el void');

  const partial = resolveWompiRefundCapability({
    order: order(),
    refund: refund({ amount: 45000 }),
    config: config(),
  });
  assert.strictEqual(partial.automatic, false);
  assert.strictEqual(partial.code, 'WOMPI_PARTIAL_REFUND_MANUAL_REQUIRED');
  const cash = resolveWompiRefundCapability({
    order: order({ payment: { provider: 'wompi', methodType: 'CASH', transactionId: 'wompi-transaction-001', amount: 90000 } }),
    refund: refund(),
    config: config(),
  });
  assert.strictEqual(cash.automatic, false);
  const inactive = resolveWompiRefundCapability({
    order: order(),
    refund: refund(),
    config: config({ active: false }),
  });
  assert.strictEqual(inactive.code, 'WOMPI_AUTOMATION_NOT_CONFIGURED');
  const mixed = resolveWompiRefundCapability({
    order: order({
      total: 120000,
      payment: {
        provider: 'wompi',
        mode: 'sandbox',
        methodType: 'CARD',
        transactionId: 'wompi-transaction-001',
        amount: 90000,
      },
      storeCredit: {
        applied: true,
        amount: 30000,
        status: 'consumed',
      },
    }),
    refund: refund(),
    config: config(),
  });
  assert.strictEqual(mixed.automatic, false);
  assert.strictEqual(
    mixed.code,
    'STORE_CREDIT_REFUND_MANUAL_REVIEW_REQUIRED'
  );
  assert.strictEqual(
    orderTotal(order({ total: 120000, payment: { amount: 90000 } })),
    120000
  );
  ok('parciales, medios incompatibles y pasarela inactiva conservan conciliación manual');

  const totalRequest = buildAutomaticCreditNoteRequest(order(), refund());
  assert.strictEqual(totalRequest.type, 'total');
  assert.strictEqual(totalRequest.reasonCode, '2');
  assert.strictEqual(totalRequest.idempotencyKey, 'refund_68a000000000000000000101');
  const partialRequest = buildAutomaticCreditNoteRequest(
    order(),
    refund({ amount: 45000 })
  );
  assert.strictEqual(partialRequest.type, 'partial');
  assert.deepStrictEqual(partialRequest.selectedItems, [
    { productId: '68a000000000000000000011', quantity: 1 },
  ]);
  assert.strictEqual(
    operationKey(refund(), 'payment'),
    operationKey(refund(), 'payment')
  );
  ok('la nota crédito total o parcial usa selección e idempotencia determinísticas');

  const calls = [];
  const executed = await executeWompiAutomaticRefund(
    { order: order(), refund: refund() },
    {
      getConfig: async () => config(),
      fetchImpl: async (url, options = {}) => {
        calls.push({ url, method: options.method || 'GET' });
        if (options.method === 'POST') {
          return response({ data: { id: 'wompi-transaction-001', status: 'VOIDED' } });
        }
        return response({ data: { id: 'wompi-transaction-001', status: 'APPROVED' } });
      },
    }
  );
  assert.strictEqual(executed.completed, true);
  assert.deepStrictEqual(calls.map((call) => call.method), ['GET', 'POST']);
  assert(calls[1].url.endsWith('/transactions/wompi-transaction-001/void'));
  ok('la ejecución consulta primero y solicita una sola anulación oficial');

  let idempotentCalls = 0;
  const reused = await executeWompiAutomaticRefund(
    { order: order(), refund: refund() },
    {
      getConfig: async () => config(),
      fetchImpl: async () => {
        idempotentCalls += 1;
        return response({ data: { id: 'wompi-transaction-001', status: 'VOIDED' } });
      },
    }
  );
  assert.strictEqual(reused.completed, true);
  assert.strictEqual(reused.idempotent, true);
  assert.strictEqual(idempotentCalls, 1);
  ok('un void ya confirmado se reutiliza sin repetir el movimiento monetario');

  ['attempts', 'operationKey', 'claimId', 'providerStatus', 'nextRetryAt'].forEach((field) => {
    assert(OrderRefund.schema.path(`reconciliation.payment.${field}`));
  });
  const automation = [
    source('services/orderRefundAutomationService.js'),
    source('services/orderRefundAutomation/claims.js'),
  ].join('\n');
  assert(automation.includes('findOneAndUpdate'));
  assert(!automation.includes('deleteMany'));
  assert(!automation.includes('deleteOne'));
  ok('intentos, bloqueo y resultado del proveedor quedan persistentes sin limpieza automática');

  const firstAttemptAt = new Date('2026-08-27T10:00:00.000Z');
  const baseRefund = refund({
    order: '68a000000000000000000001',
    reconciliation: {
      payment: {
        state: 'action_required',
        attempts: 0,
        lastAttemptAt: null,
      },
    },
  });
  const fakeModel = fencedRefundModel(baseRefund);
  const oldClaim = await claimStage(baseRefund, 'payment', {
    OrderRefundModel: fakeModel,
    now: firstAttemptAt,
    claimId: 'claim-worker-antiguo',
  });
  assert.strictEqual(
    oldClaim.reconciliation.payment.claimId,
    'claim-worker-antiguo'
  );
  const activeDuplicate = await claimStage(baseRefund, 'payment', {
    OrderRefundModel: fakeModel,
    now: new Date(firstAttemptAt.getTime() + 1000),
    claimId: 'claim-no-debe-entrar',
  });
  assert.strictEqual(activeDuplicate, null);
  const newClaim = await claimStage(baseRefund, 'payment', {
    OrderRefundModel: fakeModel,
    now: new Date(firstAttemptAt.getTime() + AUTOMATION_LOCK_MS + 1),
    claimId: 'claim-worker-nuevo',
  });
  assert.strictEqual(
    newClaim.reconciliation.payment.claimId,
    'claim-worker-nuevo'
  );
  const staleCompletion = await setClaimedStage(
    baseRefund._id,
    'payment',
    'claim-worker-antiguo',
    { state: 'completed', reference: 'STALE' },
    { OrderRefundModel: fakeModel }
  );
  assert.strictEqual(staleCompletion, null);
  assert.strictEqual(
    fakeModel.state.reconciliation.payment.state,
    'processing'
  );
  assert.strictEqual(
    fakeModel.state.reconciliation.payment.claimId,
    'claim-worker-nuevo'
  );
  const currentCompletion = await setClaimedStage(
    baseRefund._id,
    'payment',
    'claim-worker-nuevo',
    { state: 'completed', reference: 'CURRENT' },
    { OrderRefundModel: fakeModel }
  );
  assert.strictEqual(currentCompletion.reconciliation.payment.state, 'completed');
  assert.strictEqual(currentCompletion.reconciliation.payment.reference, 'CURRENT');
  ok('el fencing token impide que un worker vencido finalice el claim vigente');

  assert.throws(
    () =>
      assertRefundCreditNoteAmount(
        { amount: 30 },
        { totalAmount: 100, status: 'validated' }
      ),
    (error) =>
      error?.code === 'REFUND_CREDIT_NOTE_AMOUNT_MISMATCH' &&
      error?.details?.handling === 'manual_review'
  );
  assert.deepStrictEqual(
    assertRefundCreditNoteAmount(
      { amount: 100 },
      { totalAmount: 100, status: 'validated' }
    ),
    { refundAmount: 100, creditNoteAmount: 100 }
  );
  const reconciliation = source('services/orderRefundReconciliationService.js');
  assert(
    reconciliation.includes(
      'assertRefundCreditNoteAmount(refund, creditNote)'
    )
  );
  ok('una nota crédito de $100 no puede cerrar un reembolso de $30');

  const routes = source('routes/orders.js');
  const endpoint = routes.slice(routes.indexOf("'/:id/refunds/:refundId/automate'"));
  const controller = source('controllers/orderRefundController.js');
  assert(endpoint.includes("requirePermission('orders:refund')"));
  assert(endpoint.includes("requirePermission('billing:credit_note')"));
  assert(endpoint.includes('automateOrderRefundReconciliation'));
  assert(controller.includes('automateOrderRefund'));
  const panel = source('../frontend/src/admin/orders/components/orderDetail/OrderDetailRefundReconciliation.jsx');
  assert(panel.includes('Automatizar cierre'));
  assert(panel.includes('Confirmar dinero devuelto'));
  ok('ruta y panel exigen permisos separados y mantienen la alternativa manual');

  console.log(`\nAutomatización de reembolsos: ${passed}/${passed} controles superados.`);
}

run().catch((error) => {
  console.error('\nFALLO automatización de reembolsos:', error);
  process.exitCode = 1;
});
