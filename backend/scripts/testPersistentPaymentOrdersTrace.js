/* eslint-disable no-console */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const ManualPaymentConfirmation = require('../models/ManualPaymentConfirmation');
const Order = require('../models/Order');
const PaymentAttempt = require('../models/PaymentAttempt');
const {
  summarizeInventoryAllocations,
} = require('../services/orderInventoryAllocationService');
const {
  assertPersistentConfirmation,
  buildCandidatePool,
} = require('./seedPersistentOrdersTrace');
const {
  PAYMENT_SCENARIOS,
  buildAttemptDrafts,
  buildExternalEvents,
  buildManualEvidenceDraft,
  buildPaymentOrderDraft,
  buildPaymentRunId,
  buildPaymentTracePlan,
} = require('./paymentTraceDemo/plan');

const results = { ok: 0, fail: 0 };

async function test(name, callback) {
  try {
    await callback();
    results.ok += 1;
    console.log(`OK ${results.ok}: ${name}`);
  } catch (error) {
    results.fail += 1;
    console.error(`FAIL: ${name}`);
    console.error(`      ${error.message}`);
  }
}

function fixedBytes(size) {
  return Buffer.alloc(size, 7);
}

function candidateFixture() {
  return buildCandidatePool([
    {
      _id: '66aa00000000000000000001',
      active: true,
      deletedAt: null,
      availableStock: 20,
      branch: {
        _id: '66bb00000000000000000001',
        name: 'Sede Principal',
        code: 'PRINCIPAL',
        type: 'store',
        active: true,
        status: 'active',
      },
      product: {
        _id: '66cc00000000000000000001',
        title: 'Producto de trazabilidad',
        price: 250000,
        sku: 'SKU-PAY-TRACE',
        image: 'https://example.com/payment-trace.jpg',
        category: 'Demo',
        productType: 'physical',
        active: true,
        visible: true,
        variants: [],
      },
      variantKey: 'default__default',
      variant: { size: '', color: '', attributes: [] },
    },
  ]);
}

function buildPlan() {
  const runId = 'pay_trace_control_20260828t191500z_070707';
  return {
    runId,
    plan: buildPaymentTracePlan({
      runId,
      candidates: candidateFixture(),
      now: new Date('2026-08-28T19:15:00.000Z'),
    }),
  };
}

function buildOrder(entry, runId) {
  const evidenceId = entry.manualPayment
    ? new mongoose.Types.ObjectId('66dd00000000000000000001')
    : null;
  const order = new Order(buildPaymentOrderDraft(entry, runId, { evidenceId }));
  order.inventoryAllocations.forEach((allocation, index) => {
    allocation.orderItem = order.items[index]?._id || order.items[0]?._id || null;
  });
  order.inventoryAllocationSummary = summarizeInventoryAllocations(
    order.inventoryAllocations
  );
  return { evidenceId, order };
}

async function main() {
  await test('exige confirmación explícita porque conserva órdenes DEMO', () => {
    assert.throws(
      () => assertPersistentConfirmation({ confirmPersist: false }),
      /--confirm-persist/
    );
    assert.doesNotThrow(() =>
      assertPersistentConfirmation({ confirmPersist: true })
    );
  });

  await test('define nueve escenarios financieros únicos y completos', () => {
    assert.equal(PAYMENT_SCENARIOS.length, 9);
    assert.equal(
      new Set(PAYMENT_SCENARIOS.map((scenario) => scenario.key)).size,
      9
    );
    assert(PAYMENT_SCENARIOS.some((scenario) => scenario.key === 'wompi_retry_approved'));
    assert(PAYMENT_SCENARIOS.some((scenario) => scenario.key === 'full_credit_paid'));
    assert(PAYMENT_SCENARIOS.some((scenario) => scenario.key === 'manual_transfer_paid'));
  });

  await test('produce un identificador buscable y un plan determinista', () => {
    const runId = buildPaymentRunId({
      now: new Date('2026-08-28T19:15:00.000Z'),
      label: 'QA Pagos',
      randomBytes: fixedBytes,
    });
    assert.match(runId, /^pay_trace_qa-pagos_20260828t191500z_/);
    const { plan } = buildPlan();
    assert.deepEqual(
      plan.map((entry) => entry.key),
      PAYMENT_SCENARIOS.map((scenario) => scenario.key)
    );
    assert(plan.every((entry) => entry.candidates.length === 1));
  });

  await test('cada escenario cumple el modelo real de Orden', async () => {
    const { plan, runId } = buildPlan();
    for (const entry of plan) {
      const { order } = buildOrder(entry, runId);
      await order.validate();
      assert.equal(order.payment.status, entry.paymentStatus);
      assert.equal(order.inventoryControl.discountedAtCheckout, false);
      assert(order.tags.includes('payment-trace'));
      assert.match(order.notes[0].text, /No cobrar, facturar ni despachar/i);
    }
  });

  await test('los intentos aprobados, rechazados, reintentados y conciliados validan', async () => {
    const { plan, runId } = buildPlan();
    let count = 0;
    for (const entry of plan) {
      const { order } = buildOrder(entry, runId);
      const drafts = buildAttemptDrafts(entry, order, runId);
      for (const draft of drafts) {
        await new PaymentAttempt(draft).validate();
        count += 1;
      }
    }
    assert.equal(count, 8);
    const retry = plan.find((entry) => entry.key === 'wompi_retry_approved');
    const retryDrafts = buildAttemptDrafts(retry, buildOrder(retry, runId).order, runId);
    assert.deepEqual(retryDrafts.map((draft) => draft.state), ['superseded', 'approved']);
  });

  await test('la transferencia manual enlaza una evidencia administrativa válida', async () => {
    const { plan, runId } = buildPlan();
    const entry = plan.find((item) => item.key === 'manual_transfer_paid');
    const { evidenceId, order } = buildOrder(entry, runId);
    const evidence = buildManualEvidenceDraft(entry, order, evidenceId);
    await new ManualPaymentConfirmation(evidence).validate();
    assert.equal(String(order.payment.manualConfirmation.evidence), String(evidenceId));
    assert.equal(evidence.requestFingerprint.length, 64);
  });

  await test('saldo a favor conserva consumos, devoluciones y pago total diferenciados', () => {
    const { plan, runId } = buildPlan();
    const creditEntries = plan.filter((entry) => entry.storeCredit);
    const snapshots = creditEntries.map((entry) => buildOrder(entry, runId).order.storeCredit);
    assert.deepEqual(snapshots.map((item) => item.status), [
      'consumed',
      'released',
      'consumed',
    ]);
    const fullCredit = buildOrder(
      plan.find((entry) => entry.key === 'full_credit_paid'),
      runId
    ).order;
    assert.equal(fullCredit.payment.provider, 'store_credit');
    assert.equal(fullCredit.payment.amount, 0);
  });

  await test('cada orden genera eventos externos con el detalle del escenario', () => {
    const { plan, runId } = buildPlan();
    for (const entry of plan) {
      const { order } = buildOrder(entry, runId);
      const events = buildExternalEvents(entry, order, runId);
      assert(events.some((event) => event.type === 'order_created'));
      assert(events.every((event) => event.meta.runId === runId));
      assert.equal(
        events.filter((event) => event.type.startsWith('payment_attempt_')).length,
        entry.attemptStates.length
      );
    }
  });

  await test('el generador es modular y no borra ni altera datos operativos', () => {
    const directory = path.join(__dirname, 'paymentTraceDemo');
    const files = [
      path.join(__dirname, 'seedPersistentPaymentOrdersTrace.js'),
      ...fs.readdirSync(directory).map((name) => path.join(directory, name)),
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const lineCount = source.split(/\r?\n/).length;
      assert(lineCount <= 260, `${path.basename(file)} tiene ${lineCount} líneas`);
      assert.doesNotMatch(
        source,
        /\.(?:deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|drop)\s*\(/
      );
      assert.doesNotMatch(
        source,
        /(?:InventoryStock|Product|Branch|CashSession|ElectronicInvoice)\.(?:create|insertMany|updateOne|updateMany|findOneAndUpdate|bulkWrite)\s*\(/
      );
      assert.doesNotMatch(source, /(?:fetch|axios|https?\.request)\s*\(/i);
    }
  });

  console.log(`\nTrazabilidad de pagos: ${results.ok} controles superados.`);
  if (results.fail) process.exitCode = 1;
}

main();
