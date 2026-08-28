'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const Order = require('../../models/Order');
const OrderReturn = require('../../models/OrderReturn');
const { getOrderReturnPolicy } = require('../orderReturnPolicyService');
const { evaluateOrderReturnRisk } = require('../orderReturnRiskService');
const { getShippingProviderStatus } = require('../shippingProviderService');
const {
  returnShippingDestinations,
} = require('../orderReturnShipping/context');
const {
  buildReturnEligibility,
  loadReturnUsage,
  normalizeReturnRequest,
} = require('./eligibility');
const { createOrderEvent } = require('./events');
const {
  buildReturnCreationIdempotency,
  createReturnCreationIdempotencyService,
  isDuplicateKeyError,
} = require('./idempotency');
const {
  RETURN_RESOLUTION_TYPES,
  actorSnapshot,
  cleanLower,
  cleanText,
  cleanUpper,
  createReturnError,
  earliestDate,
  returnWindowDays,
} = require('./normalization');
const {
  safeCustomerReturnView,
  safeReturnView,
} = require('./presentation');

const defaultReturnCreationIdempotencyService =
  createReturnCreationIdempotencyService({ OrderReturnModel: OrderReturn });

function buildReturnNumber(orderNumber = '') {
  const orderPart = cleanUpper(orderNumber, 40).replace(/[^A-Z0-9-]/g, '') || 'ORDER';
  return `RMA-${orderPart}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

async function listOrderReturns({
  orderFilter,
  now = new Date(),
  includeAdminShipping = true,
} = {}) {
  const order = await Order.findOne(orderFilter).lean();
  if (!order) throw createReturnError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
  const [usage, policy, shippingDestinations, shippingProviders] = await Promise.all([
    loadReturnUsage(order._id),
    getOrderReturnPolicy(),
    includeAdminShipping ? returnShippingDestinations(order) : Promise.resolve([]),
    includeAdminShipping ? getShippingProviderStatus() : Promise.resolve({}),
  ]);
  const [returns, eligibility] = await Promise.all([
    OrderReturn.find({ order: order._id }).sort({ createdAt: -1, _id: -1 }).lean(),
    Promise.resolve(buildReturnEligibility(order, usage.returnedByLine, now, policy)),
  ]);
  return {
    policy,
    eligibility,
    shippingDestinations,
    shippingProviders,
    returns: returns.map(safeReturnView),
  };
}

async function listCustomerOrderReturns({ orderFilter, now = new Date() } = {}) {
  const result = await listOrderReturns({
    orderFilter,
    now,
    includeAdminShipping: false,
  });
  return {
    policy: {
      enabled: result.policy.enabled,
      customerPortalEnabled: result.policy.customerPortalEnabled,
      windowDays: result.policy.windowDays,
      allowedResolutions: result.policy.allowedResolutions,
      requireReasonText: result.policy.requireReasonText,
      returnShippingPaidBy: result.policy.returnShippingPaidBy,
      instructions: result.policy.instructions,
      policyText: result.policy.policyText,
    },
    eligibility: (result.eligibility || []).map((item) => ({
      orderItemId: item.orderItemId,
      title: item.title,
      variantKey: item.variantKey,
      size: item.size,
      color: item.color,
      purchasedQuantity: item.purchasedQuantity,
      deliveredQuantity: item.deliveredQuantity,
      availableQuantity: item.availableQuantity,
      deliveredAt: item.deliveredAt,
      eligibleUntil: item.eligibleUntil,
      eligible: item.eligible,
      expired: item.expired,
      blocker: item.blocker,
      policyRuleName: item.policyRuleName,
      policyWindowDays: item.policyWindowDays,
      policyManualReview: item.policyManualReview,
      allowedResolutions: item.allowedResolutions,
      requireReasonText: item.requireReasonText,
    })),
    shippingDestinations: [],
    shippingProviders: {},
    returns: (result.returns || []).map(safeCustomerReturnView),
  };
}

async function createOrderReturn(
  {
    orderFilter,
    items = [],
    requestedResolution = 'refund',
    reasonSummary = '',
    overrideEligibility = false,
    overrideReason = '',
    actor = {},
    requestSource = 'admin',
    customerSnapshot = {},
    idempotencyKey = '',
    now = new Date(),
  } = {},
  {
    OrderEventModel = null,
    OrderModel = Order,
    startSession = () => mongoose.startSession(),
    returnCreationIdempotencyService =
      defaultReturnCreationIdempotencyService,
  } = {}
) {
  const resolution = cleanLower(requestedResolution, 40);
  if (!RETURN_RESOLUTION_TYPES.has(resolution)) {
    throw createReturnError('La resolución solicitada no es válida.', 'RETURN_RESOLUTION_INVALID', 400);
  }

  const session = await startSession();
  let result;
  let resolvedIdempotency = null;
  try {
    await session.withTransaction(async () => {
      const order = await OrderModel.findOne(orderFilter).session(session);
      if (!order) throw createReturnError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
      const source = cleanLower(requestSource, 40) === 'customer'
        ? 'customer'
        : 'admin';
      const creationIdempotency = buildReturnCreationIdempotency({
        order,
        actor,
        customerSnapshot,
        idempotencyKey,
        items,
        requestedResolution: resolution,
        reasonSummary,
        overrideEligibility,
        overrideReason,
        requestSource: source,
      });
      resolvedIdempotency = {
        orderId: order._id,
        descriptor: creationIdempotency,
      };
      const existingRequest = await returnCreationIdempotencyService.inspect({
        orderId: order._id,
        descriptor: creationIdempotency,
        session,
      });
      if (existingRequest.action === 'reuse') {
        result = {
          ...safeReturnView(existingRequest.returnCase),
          idempotent: true,
        };
        return;
      }

      const [usage, policy] = await Promise.all([
        loadReturnUsage(order._id, { session }),
        getOrderReturnPolicy({ session }),
      ]);
      if (source === 'customer') {
        if (!policy.enabled || !policy.customerPortalEnabled) {
          throw createReturnError(
            'El autoservicio de devoluciones no está disponible.',
            'RETURN_CUSTOMER_PORTAL_DISABLED',
            409
          );
        }
        if (!policy.allowedResolutions.includes(resolution)) {
          throw createReturnError(
            'La opción solicitada no está disponible en la política de devoluciones.',
            'RETURN_RESOLUTION_NOT_ALLOWED',
            409
          );
        }
        if (overrideEligibility) {
          throw createReturnError(
            'El cliente no puede omitir la política de devoluciones.',
            'RETURN_OVERRIDE_NOT_ALLOWED',
            403
          );
        }
      }
      const eligibility = buildReturnEligibility(
        order,
        usage.returnedByLine,
        now,
        policy
      );
      const normalizedItems = normalizeReturnRequest(order, items, eligibility, {
        overrideEligibility,
        overrideReason,
        requestedResolution: resolution,
      });
      if (
        source === 'customer' &&
        normalizedItems.some((item) =>
          eligibility.find((entry) => entry.orderItemId === item.orderItemId)?.requireReasonText &&
          cleanText(item.reasonText, 500).length < 5
        )
      ) {
        throw createReturnError(
          'Describe brevemente el motivo de cada producto.',
          'RETURN_REASON_TEXT_REQUIRED',
          400
        );
      }
      const deliveredAt = earliestDate(
        normalizedItems.map((item) =>
          eligibility.find((entry) => entry.orderItemId === item.orderItemId)?.deliveredAt
        )
      );
      const selectedEligibility = normalizedItems.map((item) =>
        eligibility.find((entry) => entry.orderItemId === item.orderItemId)
      ).filter(Boolean);
      const eligibleUntil = earliestDate(
        selectedEligibility.map((entry) => entry.eligibleUntil)
      );
      const windowDays = returnWindowDays(policy);
      const riskAssessment = await evaluateOrderReturnRisk({
        order,
        items: normalizedItems,
        policy,
        effectivePolicies: selectedEligibility.map((entry) => ({
          ruleKey: entry.policyRuleKey,
          ruleName: entry.policyRuleName,
          requireManualReview: entry.policyManualReview,
        })),
        overrideEligibility,
        session,
        now,
      });
      if (riskAssessment.decision === 'blocked') {
        if (source === 'customer') {
          throw createReturnError(
            'La solicitud alcanzó un límite de seguridad y no puede crearse automáticamente.',
            'RETURN_RISK_BLOCKED',
            409
          );
        }
        riskAssessment.decision = 'manual_review';
      }
      const autoAuthorized =
        source === 'customer' &&
        policy.autoAuthorize === true &&
        riskAssessment.decision === 'clear';
      const matchedRules = Array.from(
        new Map(
          selectedEligibility.map((entry) => [
            entry.policyRuleKey || 'default',
            {
              key: entry.policyRuleKey || 'default',
              name: entry.policyRuleName || 'Política general',
            },
          ])
        ).values()
      );
      const returnPayers = Array.from(
        new Set(selectedEligibility.map((entry) => entry.returnShippingPaidBy).filter(Boolean))
      );
      const returnCase = new OrderReturn({
        returnNumber: buildReturnNumber(order.orderNumber),
        order: order._id,
        orderNumber: order.orderNumber,
        status: autoAuthorized ? 'authorized' : 'requested',
        revision: 0,
        requestedResolution: resolution,
        requestSource: source,
        creationIdempotencyScope: creationIdempotency.scope,
        creationIdempotencyKey: creationIdempotency.key,
        creationRequestHash: creationIdempotency.requestHash,
        customerSnapshot: {
          customer: order.customer?.customerId || customerSnapshot.customer || null,
          name: cleanText(
            customerSnapshot.name ||
              [order.customer?.name, order.customer?.lastname].filter(Boolean).join(' '),
            180
          ),
          email: cleanLower(
            customerSnapshot.email || order.customer?.email || order.customer?.emailOrPhone,
            220
          ),
          phone: cleanText(customerSnapshot.phone || order.customer?.phone, 80)
            .replace(/[^0-9+]/g, ''),
        },
        items: normalizedItems,
        reasonSummary: cleanText(reasonSummary, 800),
        eligibility: {
          windowDays,
          deliveredAt,
          eligibleUntil,
          overridden: overrideEligibility === true,
          overrideReason: overrideEligibility ? cleanText(overrideReason, 500) : '',
        },
        policySnapshot: {
          revision: policy.revision,
          windowDays,
          autoAuthorized,
          returnShippingPaidBy:
            returnPayers.length === 1 ? returnPayers[0] : 'case_by_case',
          matchedRules,
          requiresManualReview: riskAssessment.decision === 'manual_review',
        },
        riskAssessment,
        shipping: {
          method: autoAuthorized ? 'drop_off' : 'pending',
          labelType: autoAuthorized ? 'internal_rma' : 'none',
          instructions: policy.instructions,
        },
        requestedAt: now,
        requestedBy: actorSnapshot(actor),
        authorizedAt: autoAuthorized ? now : null,
        authorizedBy: autoAuthorized
          ? actorSnapshot({ label: 'Política automática', role: 'system' })
          : {},
        resolution: { type: resolution, state: 'pending' },
      });
      if (autoAuthorized) {
        for (const item of returnCase.items) {
          item.authorizedQuantity = item.requestedQuantity;
        }
      }
      await returnCase.save({ session });
      // Serializa solicitudes concurrentes de la misma orden. Si dos transacciones
      // intentan reservar las mismas unidades, MongoDB fuerza el reintento de una
      // de ellas y la segunda vuelve a calcular la elegibilidad ya comprometida.
      await OrderModel.updateOne(
        { _id: order._id },
        {
          $inc: {
            'returnControl.revision': 1,
            'returnControl.requestCount': 1,
          },
          $set: {
            'returnControl.lastRequestedAt': now,
            'returnControl.lastReturn': returnCase._id,
          },
        },
        { session }
      );
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: autoAuthorized ? 'return_auto_authorized' : 'return_requested',
          message: `RMA ${returnCase.returnNumber} ${
            autoAuthorized ? 'solicitado y autorizado' : 'solicitado'
          } para ${normalizedItems.reduce(
            (sum, item) => sum + item.requestedQuantity,
            0
          )} unidad(es).`,
          meta: {
            returnId: returnCase._id,
            returnNumber: returnCase.returnNumber,
            requestedResolution: resolution,
            requestSource: source,
            creationRequestHash: creationIdempotency.requestHash,
            autoAuthorized,
            riskDecision: riskAssessment.decision,
            riskLevel: riskAssessment.level,
            riskSignals: riskAssessment.signals.map((entry) => entry.code),
            overrideEligibility: overrideEligibility === true,
            items: normalizedItems.map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.requestedQuantity,
              reasonCode: item.reasonCode,
            })),
            by: actorSnapshot(actor),
          },
        },
        session
      );
      result = { ...safeReturnView(returnCase), idempotent: false };
    });
    return result;
  } catch (error) {
    if (isDuplicateKeyError(error) && resolvedIdempotency) {
      const existingRequest = await returnCreationIdempotencyService.inspect({
        ...resolvedIdempotency,
        session: null,
      });
      if (existingRequest.action === 'reuse') {
        return {
          ...safeReturnView(existingRequest.returnCase),
          idempotent: true,
        };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  createOrderReturn,
  listCustomerOrderReturns,
  listOrderReturns,
};
