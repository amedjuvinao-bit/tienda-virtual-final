'use strict';

const mongoose = require('mongoose');

const OrderReturn = require('../models/OrderReturn');

const ACTIVE_STATUSES = new Set([
  'requested',
  'authorized',
  'in_transit',
  'received',
  'inspected',
  'resolution_required',
]);
const REJECTED_STATUSES = new Set(['rejected', 'cancelled']);
const RISK_LEVELS = new Set(['low', 'medium', 'high', 'blocked']);
const RISK_DECISIONS = new Set(['clear', 'manual_review', 'blocked']);

function cleanText(value, maximum = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanLower(value, maximum = 500) {
  return cleanText(value, maximum).toLowerCase();
}

function toInteger(value, fallback, minimum, maximum) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function toMoney(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round((parsed + Number.EPSILON) * 100) / 100);
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString());
    return idValue(value._id || value.id || value.customerId || value.productId || value.product);
  }
  return cleanText(value, 120);
}

function uniqueLower(values = [], maximum = 80) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => cleanLower(value, maximum))
        .filter(Boolean)
    )
  );
}

function normalizeRiskControls(value = {}) {
  const controls = {
    enabled: value?.enabled !== false,
    lookbackDays: toInteger(value?.lookbackDays, 90, 7, 730),
    reviewRequestCount: toInteger(value?.reviewRequestCount, 3, 1, 50),
    blockRequestCount: toInteger(value?.blockRequestCount, 8, 2, 100),
    reviewUnitCount: toInteger(value?.reviewUnitCount, 5, 1, 500),
    reviewAmount: toMoney(value?.reviewAmount, 500000),
    reviewRejectedCount: toInteger(value?.reviewRejectedCount, 2, 1, 50),
    manualReviewOnMissingIdentity: value?.manualReviewOnMissingIdentity !== false,
    manualReviewOnPolicyOverride: value?.manualReviewOnPolicyOverride !== false,
  };
  if (controls.blockRequestCount <= controls.reviewRequestCount) {
    controls.blockRequestCount = Math.min(100, controls.reviewRequestCount + 1);
  }
  return controls;
}

function normalizePolicyRule(rule = {}, index = 0) {
  const scopeType = ['category', 'product', 'market', 'commercial_condition'].includes(
    cleanLower(rule?.scope?.type, 40)
  )
    ? cleanLower(rule.scope.type, 40)
    : 'category';
  const allowedResolutions = uniqueLower(rule?.allowedResolutions, 40).filter((value) =>
    ['refund', 'exchange', 'store_credit'].includes(value)
  );
  const payer = cleanLower(rule?.returnShippingPaidBy, 40);
  const key = cleanLower(rule?.key || `rule-${index + 1}`, 80)
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `rule-${index + 1}`;

  return {
    key,
    name: cleanText(rule?.name || `Política especial ${index + 1}`, 160),
    enabled: rule?.enabled !== false,
    priority: toInteger(rule?.priority, index + 1, 0, 999),
    scope: {
      type: scopeType,
      values: uniqueLower(rule?.scope?.values, 160).slice(0, 30),
    },
    returnable: rule?.returnable !== false,
    windowDays: toInteger(rule?.windowDays, 30, 1, 365),
    allowedResolutions: allowedResolutions.length
      ? allowedResolutions
      : ['refund', 'exchange'],
    requireReasonText: rule?.requireReasonText === true,
    requireManualReview: rule?.requireManualReview === true,
    returnShippingPaidBy: ['store', 'customer', 'case_by_case'].includes(payer)
      ? payer
      : 'case_by_case',
  };
}

function normalizePolicyRules(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .slice(0, 30)
    .map(normalizePolicyRule)
    .filter((rule) => {
      if (!rule.scope.values.length || seen.has(rule.key)) return false;
      seen.add(rule.key);
      return true;
    })
    .sort((left, right) => right.priority - left.priority || left.key.localeCompare(right.key));
}

function lineCategories(line = {}) {
  return uniqueLower([
    line.category,
    ...(Array.isArray(line.categories) ? line.categories : []),
    line.productSnapshot?.category,
  ]);
}

function lineProducts(line = {}) {
  return uniqueLower([
    idValue(line.product || line.productId),
    line.sku,
    line.productSnapshot?.sku,
    line.variantSku,
  ]);
}

function orderMarkets(order = {}) {
  return uniqueLower([order.source, order.channel]);
}

function commercialConditions(order = {}) {
  return uniqueLower([
    order.saleType,
    ...(Array.isArray(order.tags) ? order.tags : []),
  ]);
}

function ruleMatches(rule, order = {}, line = {}) {
  if (!rule?.enabled || !rule?.scope?.values?.length) return false;
  const candidates = rule.scope.type === 'product'
    ? lineProducts(line)
    : rule.scope.type === 'market'
      ? orderMarkets(order)
      : rule.scope.type === 'commercial_condition'
        ? commercialConditions(order)
        : lineCategories(line);
  return rule.scope.values.some((value) => candidates.includes(value));
}

function resolveEffectiveReturnPolicy(policy = {}, order = {}, line = {}) {
  const rules = normalizePolicyRules(policy.rules);
  const matched = rules.find((rule) => ruleMatches(rule, order, line)) || null;
  const allowedResolutions = matched?.allowedResolutions?.length
    ? matched.allowedResolutions
    : Array.isArray(policy.allowedResolutions) && policy.allowedResolutions.length
      ? policy.allowedResolutions
      : ['refund'];
  return {
    ruleKey: matched?.key || 'default',
    ruleName: matched?.name || 'Política general',
    returnable: matched ? matched.returnable : policy.enabled !== false,
    windowDays: toInteger(matched?.windowDays, toInteger(policy.windowDays, 30, 1, 365), 1, 365),
    allowedResolutions: uniqueLower(allowedResolutions, 40),
    requireReasonText: matched?.requireReasonText === true || policy.requireReasonText === true,
    requireManualReview: matched?.requireManualReview === true,
    returnShippingPaidBy:
      matched?.returnShippingPaidBy || policy.returnShippingPaidBy || 'case_by_case',
  };
}

function customerIdentity(order = {}) {
  const customer = order.customer || {};
  return {
    customerId: idValue(customer.customerId || customer._id),
    email: cleanLower(customer.email || customer.emailOrPhone, 220),
    phone: cleanText(customer.phone, 80).replace(/[^0-9+]/g, ''),
  };
}

function identityFilter(identity = {}) {
  const clauses = [];
  if (mongoose.Types.ObjectId.isValid(identity.customerId)) {
    clauses.push({ 'customerSnapshot.customer': new mongoose.Types.ObjectId(identity.customerId) });
  }
  if (identity.email && identity.email.includes('@')) {
    clauses.push({ 'customerSnapshot.email': identity.email });
  }
  if (identity.phone && identity.phone.replace(/\D/g, '').length >= 7) {
    clauses.push({ 'customerSnapshot.phone': identity.phone });
  }
  return clauses.length ? { $or: clauses } : null;
}

function historySummary(returns = []) {
  return (Array.isArray(returns) ? returns : []).reduce(
    (summary, returnCase) => {
      summary.requestCount += 1;
      summary.unitCount += (returnCase.items || []).reduce(
        (sum, item) => sum + toInteger(item.requestedQuantity, 0, 0, 100000),
        0
      );
      summary.amount += toMoney(returnCase.estimatedRefundAmount, 0);
      if (ACTIVE_STATUSES.has(cleanLower(returnCase.status, 40))) summary.activeCount += 1;
      if (REJECTED_STATUSES.has(cleanLower(returnCase.status, 40))) summary.rejectedCount += 1;
      return summary;
    },
    { requestCount: 0, unitCount: 0, amount: 0, activeCount: 0, rejectedCount: 0 }
  );
}

function signal(code, severity, message, value = 0, threshold = 0) {
  return {
    code: cleanLower(code, 80),
    severity: ['info', 'warning', 'high', 'blocked'].includes(severity)
      ? severity
      : 'warning',
    message: cleanText(message, 320),
    value: toMoney(value, 0),
    threshold: toMoney(threshold, 0),
  };
}

function buildRiskAssessment({
  controls = {},
  history = [],
  order = {},
  items = [],
  effectivePolicies = [],
  overrideEligibility = false,
  now = new Date(),
} = {}) {
  const config = normalizeRiskControls(controls);
  const identity = customerIdentity(order);
  const previous = historySummary(history);
  const requestedUnits = (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + toInteger(item.requestedQuantity, 0, 0, 100000),
    0
  );
  const requestedAmount = (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + toMoney(item.unitAmount) * toInteger(item.requestedQuantity, 0, 0, 100000),
    0
  );
  const projected = {
    requestCount: previous.requestCount + 1,
    unitCount: previous.unitCount + requestedUnits,
    amount: toMoney(previous.amount + requestedAmount),
    activeCount: previous.activeCount,
    rejectedCount: previous.rejectedCount,
  };
  const signals = [];

  if (config.enabled) {
    if (
      config.manualReviewOnMissingIdentity &&
      !identity.customerId &&
      !identity.email &&
      !identity.phone
    ) {
      signals.push(signal(
        'missing_customer_identity',
        'high',
        'La solicitud no tiene una identidad estable del cliente y requiere validación manual.'
      ));
    }
    if (projected.requestCount >= config.blockRequestCount) {
      signals.push(signal(
        'return_request_limit_blocked',
        'blocked',
        `El cliente alcanzó el límite de ${config.blockRequestCount} solicitudes dentro del periodo de control.`,
        projected.requestCount,
        config.blockRequestCount
      ));
    } else if (projected.requestCount >= config.reviewRequestCount) {
      signals.push(signal(
        'frequent_return_requests',
        'high',
        `El cliente acumula ${projected.requestCount} solicitudes dentro del periodo de control.`,
        projected.requestCount,
        config.reviewRequestCount
      ));
    }
    if (projected.unitCount >= config.reviewUnitCount) {
      signals.push(signal(
        'frequent_return_units',
        'warning',
        `El historial alcanza ${projected.unitCount} unidades solicitadas para devolución.`,
        projected.unitCount,
        config.reviewUnitCount
      ));
    }
    if (config.reviewAmount > 0 && projected.amount >= config.reviewAmount) {
      signals.push(signal(
        'high_return_amount',
        'high',
        'El valor acumulado solicitado supera el umbral de revisión manual.',
        projected.amount,
        config.reviewAmount
      ));
    }
    if (projected.rejectedCount >= config.reviewRejectedCount) {
      signals.push(signal(
        'repeated_rejected_returns',
        'warning',
        `El cliente registra ${projected.rejectedCount} solicitudes rechazadas o canceladas.`,
        projected.rejectedCount,
        config.reviewRejectedCount
      ));
    }
    if (config.manualReviewOnPolicyOverride && overrideEligibility) {
      signals.push(signal(
        'policy_override',
        'high',
        'La solicitud fue creada como excepción a la política vigente.'
      ));
    }
    const specialRules = Array.from(
      new Set(
        (Array.isArray(effectivePolicies) ? effectivePolicies : [])
          .filter((entry) => entry?.requireManualReview)
          .map((entry) => entry.ruleName || entry.ruleKey)
          .filter(Boolean)
      )
    );
    if (specialRules.length) {
      signals.push(signal(
        'policy_manual_review',
        'high',
        `La política especial ${specialRules.join(', ')} exige revisión manual.`
      ));
    }
  }

  const blocked = signals.some((entry) => entry.severity === 'blocked');
  const high = signals.some((entry) => entry.severity === 'high');
  const warning = signals.some((entry) => entry.severity === 'warning');
  const decision = blocked ? 'blocked' : signals.length ? 'manual_review' : 'clear';
  const level = blocked ? 'blocked' : high ? 'high' : warning ? 'medium' : 'low';
  const score = Math.min(
    100,
    signals.reduce(
      (sum, entry) => sum + (entry.severity === 'blocked' ? 100 : entry.severity === 'high' ? 35 : 15),
      0
    )
  );

  return {
    level: RISK_LEVELS.has(level) ? level : 'low',
    decision: RISK_DECISIONS.has(decision) ? decision : 'clear',
    score,
    signals,
    history: {
      lookbackDays: config.lookbackDays,
      requestCount: projected.requestCount,
      unitCount: projected.unitCount,
      amount: projected.amount,
      activeCount: projected.activeCount,
      rejectedCount: projected.rejectedCount,
    },
    evaluatedAt: now,
    reviewedAt: null,
    reviewNote: '',
    reviewedBy: {},
  };
}

async function loadCustomerReturnHistory(
  order = {},
  { controls = {}, session = null, now = new Date() } = {}
) {
  const config = normalizeRiskControls(controls);
  const filter = identityFilter(customerIdentity(order));
  if (!filter || !config.enabled) return [];
  filter.requestedAt = {
    $gte: new Date(now.getTime() - config.lookbackDays * 24 * 60 * 60 * 1000),
    $lte: now,
  };
  let query = OrderReturn.find(filter)
    .select('status items.requestedQuantity estimatedRefundAmount requestedAt')
    .sort({ requestedAt: -1, _id: -1 })
    .limit(200)
    .lean();
  if (session) query = query.session(session);
  return query;
}

async function evaluateOrderReturnRisk({
  order = {},
  items = [],
  policy = {},
  effectivePolicies = [],
  overrideEligibility = false,
  session = null,
  now = new Date(),
} = {}) {
  const history = await loadCustomerReturnHistory(order, {
    controls: policy.riskControls,
    session,
    now,
  });
  return buildRiskAssessment({
    controls: policy.riskControls,
    history,
    order,
    items,
    effectivePolicies,
    overrideEligibility,
    now,
  });
}

module.exports = {
  RISK_DECISIONS,
  RISK_LEVELS,
  buildRiskAssessment,
  customerIdentity,
  evaluateOrderReturnRisk,
  historySummary,
  identityFilter,
  loadCustomerReturnHistory,
  normalizePolicyRule,
  normalizePolicyRules,
  normalizeRiskControls,
  resolveEffectiveReturnPolicy,
  ruleMatches,
};
