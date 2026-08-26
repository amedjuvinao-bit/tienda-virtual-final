/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const OrderReturn = require('../models/OrderReturn');
const {
  getOrderReturnPolicy,
  updateOrderReturnPolicy,
} = require('../services/orderReturnPolicyService');
const {
  evaluateOrderReturnRisk,
  loadCustomerReturnHistory,
  resolveEffectiveReturnPolicy,
} = require('../services/orderReturnRiskService');

const REQUIRED_DATABASE = 'orders_ci_return_risk';
const MONGO_URI = process.env.ORDERS_RETURN_RISK_MONGO_URI || '';
const NOW = new Date('2026-08-26T12:00:00.000Z');
const ORDER_ID = new mongoose.Types.ObjectId();
const LINE_ID = new mongoose.Types.ObjectId();
const PRODUCT_ID = new mongoose.Types.ObjectId();
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function assertSafeMongoUri(value) {
  assert(value, 'ORDERS_RETURN_RISK_MONGO_URI no está configurado.');
  const parsed = new URL(value);
  assert.strictEqual(parsed.protocol, 'mongodb:', 'La integración no acepta Atlas ni mongodb+srv.');
  assert(
    ['127.0.0.1', 'localhost'].includes(parsed.hostname),
    'La integración solo acepta MongoDB local.'
  );
  assert.strictEqual(
    parsed.pathname.replace(/^\//, ''),
    REQUIRED_DATABASE,
    `La base temporal debe llamarse ${REQUIRED_DATABASE}.`
  );
  assert.strictEqual(
    parsed.searchParams.get('replicaSet'),
    'rs0',
    'La integración exige replicaSet=rs0.'
  );
}

function returnFixture(position, status = 'resolved') {
  return {
    returnNumber: `RMA-RISK-HISTORY-${position}`,
    order: ORDER_ID,
    orderNumber: 'ORD-RISK-HISTORY',
    status,
    customerSnapshot: {
      name: 'Cliente Riesgo',
      email: 'risk.customer@example.invalid',
      phone: '3000000000',
    },
    items: [{
      orderItemId: LINE_ID,
      product: PRODUCT_ID,
      title: 'Producto de riesgo',
      purchasedQuantity: 1,
      unitAmount: 120000,
      requestedQuantity: 1,
      acceptedQuantity: status === 'resolved' ? 1 : 0,
      reasonCode: 'other',
      reasonText: 'Prueba de integración.',
    }],
    estimatedRefundAmount: 120000,
    requestedAt: new Date(NOW.getTime() - position * 24 * 60 * 60 * 1000),
  };
}

async function run() {
  assertSafeMongoUri(MONGO_URI);
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.dropDatabase();

  const initial = await getOrderReturnPolicy();
  const policy = await updateOrderReturnPolicy({
    payload: {
      expectedRevision: initial.revision,
      windowDays: 30,
      allowedResolutions: ['refund', 'exchange'],
      riskControls: {
        enabled: true,
        lookbackDays: 90,
        reviewRequestCount: 3,
        blockRequestCount: 6,
        reviewUnitCount: 10,
        reviewAmount: 1000000,
        reviewRejectedCount: 2,
      },
      rules: [{
        key: 'technology-review',
        name: 'Tecnología de alto valor',
        priority: 50,
        scope: { type: 'category', values: ['tecnología'] },
        returnable: true,
        windowDays: 10,
        allowedResolutions: ['exchange'],
        requireReasonText: true,
        requireManualReview: true,
        returnShippingPaidBy: 'store',
      }],
    },
    actor: { label: 'CI antifraude', role: 'owner' },
  });
  assert.strictEqual(policy.revision, 1);
  assert.strictEqual(policy.rules[0].key, 'technology-review');
  assert.strictEqual(policy.riskControls.reviewRequestCount, 3);
  ok('la política avanzada se guarda y recupera versionada');

  await OrderReturn.create([
    returnFixture(1, 'resolved'),
    returnFixture(2, 'rejected'),
  ]);
  const history = await loadCustomerReturnHistory(
    { customer: { email: 'risk.customer@example.invalid', phone: '3000000000' } },
    { controls: policy.riskControls, now: NOW }
  );
  assert.strictEqual(history.length, 2);
  ok('el historial se limita a la identidad y ventana configuradas');

  const effective = resolveEffectiveReturnPolicy(
    policy,
    { source: 'online', channel: 'web' },
    { category: 'Tecnología', product: PRODUCT_ID, variantSku: 'TECH-1' }
  );
  assert.strictEqual(effective.ruleKey, 'technology-review');
  assert.deepStrictEqual(effective.allowedResolutions, ['exchange']);
  ok('la línea usa la regla diferenciada persistida');

  const assessment = await evaluateOrderReturnRisk({
    order: {
      _id: ORDER_ID,
      customer: { email: 'risk.customer@example.invalid', phone: '3000000000' },
    },
    items: [{ requestedQuantity: 1, unitAmount: 120000 }],
    policy,
    effectivePolicies: [{
      ruleKey: effective.ruleKey,
      ruleName: effective.ruleName,
      requireManualReview: effective.requireManualReview,
    }],
    now: NOW,
  });
  assert.strictEqual(assessment.decision, 'manual_review');
  assert.strictEqual(assessment.history.requestCount, 3);
  assert(assessment.signals.some((entry) => entry.code === 'frequent_return_requests'));
  assert(assessment.signals.some((entry) => entry.code === 'policy_manual_review'));
  ok('la evaluación combina historial real y política especial');

  const current = await OrderReturn.create({
    ...returnFixture(3, 'requested'),
    returnNumber: 'RMA-RISK-CURRENT',
    policySnapshot: {
      revision: policy.revision,
      windowDays: effective.windowDays,
      matchedRules: [{ key: effective.ruleKey, name: effective.ruleName }],
      requiresManualReview: true,
    },
    riskAssessment: assessment,
  });
  const persisted = await OrderReturn.findById(current._id).lean();
  assert.strictEqual(persisted.riskAssessment.decision, 'manual_review');
  assert.strictEqual(persisted.policySnapshot.matchedRules[0].key, 'technology-review');
  assert.strictEqual(persisted.riskAssessment.signals.length, assessment.signals.length);
  ok('el RMA conserva el snapshot antifraude y de política');

  console.log(`\nIntegración antifraude de Órdenes: ${passed}/${passed} controles aprobados`);
}

async function main() {
  try {
    await run();
  } finally {
    if (mongoose.connection.readyState) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('\nFAIL Integración antifraude de Órdenes');
  console.error(error);
  process.exitCode = 1;
});
