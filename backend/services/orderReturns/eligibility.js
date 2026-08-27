'use strict';

const OrderRefund = require('../../models/OrderRefund');
const OrderReturn = require('../../models/OrderReturn');
const {
  getPreviousRefundState,
  normalizeRequestedItems,
} = require('../orderRefundService');
const {
  resolveEffectiveReturnPolicy,
} = require('../orderReturnRiskService');
const {
  ACTIVE_RETURN_STATUSES,
  RETURN_REASON_CODES,
  cleanLower,
  cleanText,
  createReturnError,
  deliveryForLine,
  idValue,
  isPhysicalLine,
  lineQuantity,
  lineUnitAmount,
  objectId,
  orderLines,
  returnWindowDays,
  toQuantity,
} = require('./normalization');
const {
  canonicalizeVariantKey,
} = require('../../lib/products/productVariantConfig');

function addQuantity(map, key, value) {
  const id = idValue(key);
  if (!id) return;
  map.set(id, (map.get(id) || 0) + toQuantity(value));
}

async function loadReturnUsage(orderId, { session = null, excludeReturnId = null } = {}) {
  const refundQuery = OrderRefund.find({
    order: orderId,
    status: 'processed',
    returnCase: null,
  }).lean();
  const returnFilter = {
    order: orderId,
    status: { $in: ACTIVE_RETURN_STATUSES },
  };
  if (excludeReturnId) returnFilter._id = { $ne: objectId(excludeReturnId, 'El RMA') };
  const returnsQuery = OrderReturn.find(returnFilter).lean();
  const allRefundsQuery = OrderRefund.find({ order: orderId, status: 'processed' }).lean();
  const allReturnsQuery = OrderReturn.find({
    order: orderId,
    inventoryProcessedAt: { $ne: null },
  }).lean();
  if (session) {
    refundQuery.session(session);
    returnsQuery.session(session);
    allRefundsQuery.session(session);
    allReturnsQuery.session(session);
  }

  const [directRefunds, returns, allRefunds, inventoryReturns] = await Promise.all([
    refundQuery,
    returnsQuery,
    allRefundsQuery,
    allReturnsQuery,
  ]);
  const returnedByLine = getPreviousRefundState(directRefunds).returnedByLine;
  const unrefundedReturnByLine = new Map();

  for (const returnCase of returns) {
    const inspected = Boolean(returnCase.inspectedAt);
    for (const item of returnCase.items || []) {
      const committedQuantity = inspected
        ? item.acceptedQuantity
        : item.requestedQuantity;
      addQuantity(returnedByLine, item.orderItemId, committedQuantity);
      if (!returnCase.resolution?.refund) {
        addQuantity(unrefundedReturnByLine, item.orderItemId, committedQuantity);
      }
    }
  }

  const restoredByStock = getPreviousRefundState(allRefunds).restoredByStock;
  for (const returnCase of inventoryReturns) {
    for (const restoration of returnCase.inventoryRestorations || []) {
      addQuantity(restoredByStock, restoration.inventoryStock, restoration.quantity);
    }
  }

  return { returnedByLine, restoredByStock, unrefundedReturnByLine };
}

function buildReturnEligibility(
  order = {},
  returnedByLine = new Map(),
  now = new Date(),
  policy = {}
) {
  return orderLines(order)
    .filter(isPhysicalLine)
    .map((line) => {
      const effectivePolicy = resolveEffectiveReturnPolicy(policy, order, line);
      const orderItemId = idValue(line._id || line.orderItemId);
      const purchasedQuantity = lineQuantity(line);
      const delivery = deliveryForLine(order, line);
      const alreadyCommitted = toQuantity(returnedByLine.get(orderItemId) || 0);
      const deliveredQuantity = Math.min(purchasedQuantity, delivery.deliveredQuantity);
      const availableQuantity = Math.max(0, deliveredQuantity - alreadyCommitted);
      const eligibleUntil = delivery.deliveredAt
        ? new Date(
            delivery.deliveredAt.getTime() +
              effectivePolicy.windowDays * 24 * 60 * 60 * 1000
          )
        : null;
      const expired = Boolean(eligibleUntil && now.getTime() > eligibleUntil.getTime());

      return {
        orderItemId,
        product: idValue(line.product || line.productId),
        title: cleanText(line.title || line.name || 'Producto', 240),
        productType: cleanLower(line.productType || 'physical'),
        variantKey:
          canonicalizeVariantKey(line.variantKey || line.variantId) ||
          'default__default',
        size: cleanText(line.size || line.talla, 80),
        color: cleanText(line.colorLabel || line.color, 120),
        purchasedQuantity,
        deliveredQuantity,
        alreadyCommitted,
        availableQuantity,
        unitAmount: lineUnitAmount(line),
        category: cleanText(line.category || line.productSnapshot?.category, 160),
        categories: Array.isArray(line.categories) ? line.categories : [],
        sku: cleanText(line.sku || line.productSnapshot?.sku || line.variantSku, 160),
        deliveredAt: delivery.deliveredAt,
        eligibleUntil,
        eligible: availableQuantity > 0 && !expired && effectivePolicy.returnable,
        expired,
        policyRuleKey: effectivePolicy.ruleKey,
        policyRuleName: effectivePolicy.ruleName,
        policyWindowDays: effectivePolicy.windowDays,
        policyManualReview: effectivePolicy.requireManualReview,
        policyReturnable: effectivePolicy.returnable,
        allowedResolutions: effectivePolicy.allowedResolutions,
        requireReasonText: effectivePolicy.requireReasonText,
        returnShippingPaidBy: effectivePolicy.returnShippingPaidBy,
        blocker:
          deliveredQuantity <= 0
            ? 'ITEM_NOT_DELIVERED'
            : availableQuantity <= 0
              ? 'ITEM_ALREADY_RETURNED'
              : !effectivePolicy.returnable
                ? 'RETURN_POLICY_BLOCKED'
              : expired
                ? 'RETURN_WINDOW_EXPIRED'
                : '',
      };
    });
}

function requestItemInput(rawItems = [], orderItemId) {
  return rawItems.find(
    (item) => idValue(item?.orderItemId || item?.lineId || item?._id) === orderItemId
  ) || {};
}

function normalizeReturnRequest(
  order,
  rawItems,
  eligibility,
  {
    overrideEligibility = false,
    overrideReason = '',
    requestedResolution = 'refund',
  } = {}
) {
  if (!Array.isArray(rawItems) || !rawItems.length) {
    throw createReturnError(
      'Selecciona al menos una línea física para la devolución.',
      'RETURN_ITEMS_REQUIRED',
      400
    );
  }
  if (overrideEligibility && cleanText(overrideReason, 500).length < 8) {
    throw createReturnError(
      'Explica por qué se autoriza la devolución fuera de la política.',
      'RETURN_OVERRIDE_REASON_REQUIRED',
      400
    );
  }

  const normalized = normalizeRequestedItems(order, rawItems, new Map());
  const eligibilityMap = new Map(eligibility.map((item) => [item.orderItemId, item]));

  return normalized.map((item) => {
    const policy = eligibilityMap.get(item.orderItemId);
    const input = requestItemInput(rawItems, item.orderItemId);
    const reasonCode = cleanLower(input.reasonCode || 'other', 80);
    if (!policy || policy.deliveredQuantity <= 0) {
      throw createReturnError(
        `${item.title} todavía no tiene una entrega confirmada.`,
        'RETURN_ITEM_NOT_DELIVERED',
        409,
        { orderItemId: item.orderItemId }
      );
    }
    if (item.returnedQuantity > policy.availableQuantity) {
      throw createReturnError(
        `La cantidad solicitada de ${item.title} supera las unidades disponibles para devolución.`,
        'RETURN_QUANTITY_NOT_AVAILABLE',
        409,
        {
          orderItemId: item.orderItemId,
          availableQuantity: policy.availableQuantity,
          requestedQuantity: item.returnedQuantity,
        }
      );
    }
    if (!policy.policyReturnable && !overrideEligibility) {
      throw createReturnError(
        `${item.title} está excluido por la política especial ${policy.policyRuleName}.`,
        'RETURN_POLICY_BLOCKED',
        409,
        {
          orderItemId: item.orderItemId,
          policyRuleKey: policy.policyRuleKey,
          policyRuleName: policy.policyRuleName,
        }
      );
    }
    if (policy.expired && !overrideEligibility) {
      throw createReturnError(
        `La ventana de devolución de ${item.title} ya venció.`,
        'RETURN_WINDOW_EXPIRED',
        409,
        { orderItemId: item.orderItemId, eligibleUntil: policy.eligibleUntil }
      );
    }
    if (!RETURN_REASON_CODES.has(reasonCode)) {
      throw createReturnError('El motivo de devolución no es válido.', 'RETURN_REASON_INVALID', 400);
    }
    if (
      !overrideEligibility &&
      Array.isArray(policy.allowedResolutions) &&
      !policy.allowedResolutions.includes(cleanLower(requestedResolution, 40))
    ) {
      throw createReturnError(
        `${item.title} no permite la resolución seleccionada según ${policy.policyRuleName}.`,
        'RETURN_RESOLUTION_NOT_ALLOWED_BY_RULE',
        409,
        {
          orderItemId: item.orderItemId,
          policyRuleKey: policy.policyRuleKey,
          allowedResolutions: policy.allowedResolutions,
        }
      );
    }

    return {
      orderItemId: item.orderItemId,
      product: item.product,
      title: item.title,
      productType: item.productType,
      variantKey: item.variantKey,
      size: item.size,
      color: item.color,
      purchasedQuantity: item.purchasedQuantity,
      unitAmount: policy.unitAmount,
      requestedQuantity: item.returnedQuantity,
      reasonCode,
      reasonText: cleanText(input.reasonText, 500),
      policyRuleKey: policy.policyRuleKey || 'default',
      policyRuleName: policy.policyRuleName || 'Política general',
      policyWindowDays: policy.policyWindowDays || returnWindowDays(),
      policyManualReview: policy.policyManualReview === true,
    };
  });
}

module.exports = {
  buildReturnEligibility,
  loadReturnUsage,
  normalizeReturnRequest,
};
