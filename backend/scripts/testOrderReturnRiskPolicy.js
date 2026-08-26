'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const OrderReturn = require('../models/OrderReturn');
const OrderReturnPolicy = require('../models/OrderReturnPolicy');
const {
  buildRiskAssessment,
  normalizePolicyRules,
  normalizeRiskControls,
  resolveEffectiveReturnPolicy,
} = require('../services/orderReturnRiskService');

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

const basePolicy = {
  enabled: true,
  windowDays: 30,
  allowedResolutions: ['refund', 'exchange', 'store_credit'],
  returnShippingPaidBy: 'case_by_case',
  rules: [
    {
      key: 'technology-review',
      name: 'Tecnología de alto valor',
      enabled: true,
      priority: 50,
      scope: { type: 'category', values: ['tecnología'] },
      returnable: true,
      windowDays: 10,
      allowedResolutions: ['exchange'],
      requireReasonText: true,
      requireManualReview: true,
      returnShippingPaidBy: 'store',
    },
    {
      key: 'clearance-block',
      name: 'Venta final',
      enabled: true,
      priority: 40,
      scope: { type: 'commercial_condition', values: ['liquidación'] },
      returnable: false,
      windowDays: 5,
      allowedResolutions: ['refund'],
    },
    {
      key: 'pos-fast',
      name: 'Compra presencial',
      enabled: true,
      priority: 30,
      scope: { type: 'market', values: ['pos'] },
      returnable: true,
      windowDays: 15,
      allowedResolutions: ['exchange', 'store_credit'],
    },
    {
      key: 'sku-block',
      name: 'Producto no retornable',
      enabled: true,
      priority: 60,
      scope: { type: 'product', values: ['sku-no-return'] },
      returnable: false,
      windowDays: 1,
      allowedResolutions: ['refund'],
    },
  ],
};

test('normaliza umbrales y mantiene el bloqueo por encima de la revisión', () => {
  const controls = normalizeRiskControls({
    lookbackDays: 2,
    reviewRequestCount: 8,
    blockRequestCount: 4,
    reviewAmount: -50,
  });
  assert.equal(controls.lookbackDays, 7);
  assert.equal(controls.reviewRequestCount, 8);
  assert.equal(controls.blockRequestCount, 9);
  assert.equal(controls.reviewAmount, 0);
});

test('normaliza reglas, elimina duplicados y ordena por prioridad', () => {
  const rules = normalizePolicyRules([
    basePolicy.rules[1],
    basePolicy.rules[0],
    { ...basePolicy.rules[0], priority: 99 },
    { key: 'empty', name: 'Sin alcance', scope: { type: 'category', values: [] } },
  ]);
  assert.deepEqual(rules.map((rule) => rule.key), ['technology-review', 'clearance-block']);
});

test('aplica una política diferenciada por categoría', () => {
  const result = resolveEffectiveReturnPolicy(
    basePolicy,
    { source: 'online', channel: 'web' },
    { category: 'Tecnología', sku: 'TAB-1' }
  );
  assert.equal(result.ruleKey, 'technology-review');
  assert.equal(result.windowDays, 10);
  assert.equal(result.requireManualReview, true);
  assert.deepEqual(result.allowedResolutions, ['exchange']);
});

test('la regla de producto de mayor prioridad prevalece', () => {
  const result = resolveEffectiveReturnPolicy(
    basePolicy,
    { source: 'online', channel: 'web' },
    { category: 'Tecnología', variantSku: 'SKU-NO-RETURN' }
  );
  assert.equal(result.ruleKey, 'sku-block');
  assert.equal(result.returnable, false);
});

test('aplica reglas por canal y condición comercial', () => {
  const pos = resolveEffectiveReturnPolicy(basePolicy, { source: 'pos' }, { category: 'ropa' });
  const clearance = resolveEffectiveReturnPolicy(
    basePolicy,
    { source: 'online', tags: ['Liquidación'] },
    { category: 'ropa' }
  );
  assert.equal(pos.ruleKey, 'pos-fast');
  assert.equal(pos.windowDays, 15);
  assert.equal(clearance.ruleKey, 'clearance-block');
  assert.equal(clearance.returnable, false);
});

test('un cliente sin historial ni señales queda libre', () => {
  const result = buildRiskAssessment({
    controls: { enabled: true },
    order: { customer: { email: 'cliente@example.com' } },
    items: [{ requestedQuantity: 1, unitAmount: 50000 }],
  });
  assert.equal(result.decision, 'clear');
  assert.equal(result.level, 'low');
  assert.equal(result.score, 0);
});

test('la frecuencia acumulada exige revisión manual', () => {
  const result = buildRiskAssessment({
    controls: { reviewRequestCount: 3, blockRequestCount: 8 },
    history: [
      { status: 'resolved', items: [{ requestedQuantity: 1 }], estimatedRefundAmount: 50000 },
      { status: 'rejected', items: [{ requestedQuantity: 1 }], estimatedRefundAmount: 50000 },
    ],
    order: { customer: { email: 'cliente@example.com' } },
    items: [{ requestedQuantity: 1, unitAmount: 50000 }],
  });
  assert.equal(result.decision, 'manual_review');
  assert.ok(result.signals.some((entry) => entry.code === 'frequent_return_requests'));
});

test('el límite duro bloquea la creación automática', () => {
  const history = Array.from({ length: 4 }, () => ({
    status: 'resolved',
    items: [{ requestedQuantity: 1 }],
    estimatedRefundAmount: 10000,
  }));
  const result = buildRiskAssessment({
    controls: { reviewRequestCount: 2, blockRequestCount: 5 },
    history,
    order: { customer: { email: 'cliente@example.com' } },
    items: [{ requestedQuantity: 1, unitAmount: 10000 }],
  });
  assert.equal(result.decision, 'blocked');
  assert.equal(result.level, 'blocked');
  assert.ok(result.signals.some((entry) => entry.code === 'return_request_limit_blocked'));
});

test('una regla especial puede exigir revisión sin revelar reglas al cliente', () => {
  const result = buildRiskAssessment({
    controls: { enabled: true },
    order: { customer: { email: 'cliente@example.com' } },
    items: [{ requestedQuantity: 1, unitAmount: 10000 }],
    effectivePolicies: [{ ruleName: 'Tecnología de alto valor', requireManualReview: true }],
  });
  assert.equal(result.decision, 'manual_review');
  assert.ok(result.signals.some((entry) => entry.code === 'policy_manual_review'));
});

test('el esquema persiste política aplicada, evaluación y revisión', async () => {
  const document = new OrderReturn({
    returnNumber: 'RMA-RISK-CONTRACT',
    order: '64d000000000000000000001',
    orderNumber: 'ORD-RISK',
    items: [{
      orderItemId: '64d000000000000000000002',
      product: '64d000000000000000000003',
      title: 'Producto',
      purchasedQuantity: 1,
      requestedQuantity: 1,
      reasonCode: 'other',
      policyRuleKey: 'technology-review',
      policyRuleName: 'Tecnología de alto valor',
      policyWindowDays: 10,
      policyManualReview: true,
    }],
    riskAssessment: {
      level: 'high',
      decision: 'manual_review',
      score: 35,
      signals: [{ code: 'policy_manual_review', severity: 'high', message: 'Revisión requerida.' }],
    },
  });
  await document.validate();
  assert.equal(document.items[0].policyRuleKey, 'technology-review');
  assert.equal(document.riskAssessment.decision, 'manual_review');
});

test('el esquema de política acepta controles y reglas válidas', async () => {
  const document = new OrderReturnPolicy({
    key: 'contract-risk',
    riskControls: { reviewRequestCount: 4, blockRequestCount: 4 },
    rules: basePolicy.rules,
  });
  await document.validate();
  assert.equal(document.riskControls.blockRequestCount, 5);
  assert.equal(document.rules[0].key, 'sku-block');
});

test('la respuesta pública no incluye el análisis antifraude', () => {
  const service = source('backend/services/orderReturnService.js');
  const customerView = service.slice(
    service.indexOf('function safeCustomerReturnView'),
    service.indexOf('async function createOrderEvent')
  );
  assert.ok(!customerView.includes('riskAssessment'));
  assert.ok(service.includes("'RETURN_RISK_BLOCKED'"));
  assert.ok(!service.includes('signals: riskAssessment.signals.map((entry) => entry.code),\n          }'));
});

test('la interfaz administrativa exige documentar una alerta antes de autorizar', () => {
  const panel = source('frontend/src/admin/orders/components/orderDetail/OrderDetailReturnsPanel.jsx');
  const editor = source('frontend/src/admin/orders/components/orderDetail/OrderReturnPolicyAdvancedEditor.jsx');
  assert.ok(panel.includes('Conclusión de la revisión antifraude'));
  assert.ok(panel.includes('riskReviewNote'));
  assert.ok(editor.includes('Protección antifraude'));
  assert.ok(editor.includes('Políticas especiales'));
  assert.ok(editor.includes('ORDER_DETAIL_THEME'));
});

(async () => {
  let passed = 0;
  for (const entry of tests) {
    try {
      await entry.callback();
      passed += 1;
      console.log(`✓ ${entry.name}`);
    } catch (error) {
      console.error(`✗ ${entry.name}`);
      console.error(error);
      process.exitCode = 1;
    }
  }
  console.log(`\n${passed}/${tests.length} contratos antifraude y de política aprobados.`);
})();
