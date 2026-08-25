'use strict';

const mongoose = require('mongoose');

const OrderReturnPolicy = require('../models/OrderReturnPolicy');

const POLICY_KEY = 'default';
const RESOLUTION_TYPES = new Set(OrderReturnPolicy.RESOLUTION_TYPES || []);
const SHIPPING_PAYER_TYPES = new Set(OrderReturnPolicy.SHIPPING_PAYER_TYPES || []);

function cleanText(value, maximum = 4000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanLower(value, maximum = 4000) {
  return cleanText(value, maximum).toLowerCase();
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function integer(value, fallback, minimum, maximum) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function defaultWindowDays(env = process.env) {
  return integer(env.ORDER_RETURN_WINDOW_DAYS, 30, 1, 365);
}

function defaultPolicy(env = process.env) {
  return {
    key: POLICY_KEY,
    enabled: true,
    customerPortalEnabled: true,
    windowDays: defaultWindowDays(env),
    allowedResolutions: ['refund', 'exchange', 'store_credit'],
    requireReasonText: false,
    autoAuthorize: false,
    returnShippingPaidBy: 'case_by_case',
    instructions:
      'Conserva el producto y sus accesorios. Te indicaremos cómo entregarlo cuando la solicitud sea autorizada.',
    policyText:
      'Las solicitudes se revisan según la fecha de entrega, el estado del producto y las cantidades disponibles.',
    storeCreditEnabled: true,
    storeCreditExpirationDays: 365,
    automaticExchangeEnabled: true,
    revision: 0,
    updatedBy: {},
    updatedAt: null,
  };
}

function safePolicyView(value = {}, env = process.env) {
  const source = typeof value?.toObject === 'function' ? value.toObject() : value;
  const fallback = defaultPolicy(env);
  const allowedResolutions = Array.from(
    new Set(
      (Array.isArray(source?.allowedResolutions)
        ? source.allowedResolutions
        : fallback.allowedResolutions
      )
        .map((item) => cleanLower(item, 40))
        .filter((item) => RESOLUTION_TYPES.has(item))
    )
  );
  const storeCreditEnabled = source?.storeCreditEnabled !== false;
  const filteredResolutions = allowedResolutions.filter(
    (item) => storeCreditEnabled || item !== 'store_credit'
  );
  const payer = cleanLower(source?.returnShippingPaidBy, 40);

  return {
    key: POLICY_KEY,
    enabled: source?.enabled !== false,
    customerPortalEnabled: source?.customerPortalEnabled !== false,
    windowDays: integer(source?.windowDays, fallback.windowDays, 1, 365),
    allowedResolutions: filteredResolutions.length
      ? filteredResolutions
      : ['refund'],
    requireReasonText: source?.requireReasonText === true,
    autoAuthorize: source?.autoAuthorize === true,
    returnShippingPaidBy: SHIPPING_PAYER_TYPES.has(payer)
      ? payer
      : fallback.returnShippingPaidBy,
    instructions: cleanText(source?.instructions || fallback.instructions, 1600),
    policyText: cleanText(source?.policyText || fallback.policyText, 4000),
    storeCreditEnabled,
    storeCreditExpirationDays: integer(
      source?.storeCreditExpirationDays,
      fallback.storeCreditExpirationDays,
      30,
      1825
    ),
    automaticExchangeEnabled: source?.automaticExchangeEnabled !== false,
    revision: integer(source?.revision, 0, 0, Number.MAX_SAFE_INTEGER),
    updatedBy: source?.updatedBy || {},
    updatedAt: source?.updatedAt || null,
  };
}

async function getOrderReturnPolicy({ session = null } = {}) {
  let query = OrderReturnPolicy.findOne({ key: POLICY_KEY });
  if (session) query = query.session(session);
  const policy = await query.lean();
  return safePolicyView(policy || {});
}

function normalizePolicyPatch(payload = {}, current = defaultPolicy()) {
  const allowedResolutions = Array.from(
    new Set(
      (Array.isArray(payload.allowedResolutions)
        ? payload.allowedResolutions
        : current.allowedResolutions
      )
        .map((item) => cleanLower(item, 40))
        .filter((item) => RESOLUTION_TYPES.has(item))
    )
  );
  const storeCreditEnabled = payload.storeCreditEnabled !== undefined
    ? payload.storeCreditEnabled === true
    : current.storeCreditEnabled !== false;
  const filteredResolutions = allowedResolutions.filter(
    (item) => storeCreditEnabled || item !== 'store_credit'
  );
  const payer = cleanLower(
    payload.returnShippingPaidBy || current.returnShippingPaidBy,
    40
  );

  return {
    enabled: payload.enabled !== undefined ? payload.enabled === true : current.enabled !== false,
    customerPortalEnabled:
      payload.customerPortalEnabled !== undefined
        ? payload.customerPortalEnabled === true
        : current.customerPortalEnabled !== false,
    windowDays: integer(payload.windowDays, current.windowDays, 1, 365),
    allowedResolutions: filteredResolutions.length ? filteredResolutions : ['refund'],
    requireReasonText:
      payload.requireReasonText !== undefined
        ? payload.requireReasonText === true
        : current.requireReasonText === true,
    autoAuthorize:
      payload.autoAuthorize !== undefined
        ? payload.autoAuthorize === true
        : current.autoAuthorize === true,
    returnShippingPaidBy: SHIPPING_PAYER_TYPES.has(payer)
      ? payer
      : current.returnShippingPaidBy,
    instructions: cleanText(
      payload.instructions !== undefined ? payload.instructions : current.instructions,
      1600
    ),
    policyText: cleanText(
      payload.policyText !== undefined ? payload.policyText : current.policyText,
      4000
    ),
    storeCreditEnabled,
    storeCreditExpirationDays: integer(
      payload.storeCreditExpirationDays,
      current.storeCreditExpirationDays,
      30,
      1825
    ),
    automaticExchangeEnabled:
      payload.automaticExchangeEnabled !== undefined
        ? payload.automaticExchangeEnabled === true
        : current.automaticExchangeEnabled !== false,
  };
}

function policyError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

async function updateOrderReturnPolicy({ payload = {}, actor = {} } = {}) {
  const current = await getOrderReturnPolicy();
  const expectedRevision = Number(payload.expectedRevision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw policyError(
      'Debes enviar la revisión actual de la política.',
      'RETURN_POLICY_REVISION_REQUIRED'
    );
  }
  if (expectedRevision !== current.revision) {
    throw policyError(
      'Otra persona actualizó la política. Recarga antes de guardar.',
      'RETURN_POLICY_REVISION_CONFLICT',
      409,
      { expectedRevision, currentRevision: current.revision }
    );
  }

  const actorId = idValue(actor.id);
  const update = normalizePolicyPatch(payload, current);
  const filter = current.updatedAt
    ? { key: POLICY_KEY, revision: expectedRevision }
    : { key: POLICY_KEY, $or: [{ revision: 0 }, { revision: { $exists: false } }] };
  const policy = await OrderReturnPolicy.findOneAndUpdate(
    filter,
    {
      $set: {
        ...update,
        updatedBy: {
          id: mongoose.Types.ObjectId.isValid(actorId)
            ? new mongoose.Types.ObjectId(actorId)
            : null,
          label: cleanText(actor.label || actor.displayName || 'admin', 160),
          role: cleanLower(actor.role, 80),
        },
      },
      $inc: { revision: 1 },
      $setOnInsert: { key: POLICY_KEY },
    },
    { new: true, upsert: !current.updatedAt, runValidators: true }
  ).lean();

  if (!policy) {
    throw policyError(
      'Otra persona actualizó la política. Recarga antes de guardar.',
      'RETURN_POLICY_REVISION_CONFLICT',
      409
    );
  }
  return safePolicyView(policy);
}

module.exports = {
  POLICY_KEY,
  defaultPolicy,
  getOrderReturnPolicy,
  normalizePolicyPatch,
  safePolicyView,
  updateOrderReturnPolicy,
};
