'use strict';

const crypto = require('crypto');

const {
  normalizeRequestedItems,
} = require('../orderRefunds/refundNormalization');
const {
  cleanLower,
  cleanText,
  createReturnError,
  idValue,
  toQuantity,
} = require('./normalization');

const RETURN_CREATION_IDEMPOTENCY_KEY_MAX_LENGTH = 200;
const RETURN_CREATION_IDEMPOTENCY_KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._~:-]{7,199}$/;

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizeExplicitIdempotencyKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  if (
    key.length > RETURN_CREATION_IDEMPOTENCY_KEY_MAX_LENGTH ||
    !RETURN_CREATION_IDEMPOTENCY_KEY_PATTERN.test(key)
  ) {
    throw createReturnError(
      'La clave de idempotencia de la devolución no es válida.',
      'RETURN_IDEMPOTENCY_KEY_INVALID',
      400,
      {
        minimumLength: 8,
        maximumLength: RETURN_CREATION_IDEMPOTENCY_KEY_MAX_LENGTH,
      }
    );
  }
  return key;
}

function resolveRawItemReasons(order, rawItems = []) {
  const reasons = new Map();
  for (const rawItem of Array.isArray(rawItems) ? rawItems : []) {
    const [normalized] = normalizeRequestedItems(order, [rawItem], new Map());
    if (!normalized || reasons.has(normalized.orderItemId)) continue;
    reasons.set(normalized.orderItemId, {
      reasonCode: cleanLower(rawItem?.reasonCode || 'other', 80),
      reasonText: cleanText(rawItem?.reasonText, 500),
    });
  }
  return reasons;
}

function canonicalReturnCreationPayload({
  order = {},
  items = [],
  requestedResolution = 'refund',
  reasonSummary = '',
  overrideEligibility = false,
  overrideReason = '',
  requestSource = 'admin',
} = {}) {
  const normalizedItems = normalizeRequestedItems(order, items, new Map());
  const reasons = resolveRawItemReasons(order, items);
  const canonicalItems = normalizedItems
    .map((item) => {
      const reason = reasons.get(item.orderItemId) || {};
      return {
        orderItemId: String(item.orderItemId || ''),
        quantity: toQuantity(item.returnedQuantity),
        reasonCode: cleanLower(reason.reasonCode || 'other', 80),
        reasonText: cleanText(reason.reasonText, 500),
      };
    })
    .sort((left, right) => left.orderItemId.localeCompare(right.orderItemId));

  return {
    requestSource:
      cleanLower(requestSource, 40) === 'customer' ? 'customer' : 'admin',
    requestedResolution: cleanLower(requestedResolution || 'refund', 40),
    reasonSummary: cleanText(reasonSummary, 800),
    overrideEligibility: overrideEligibility === true,
    overrideReason:
      overrideEligibility === true ? cleanText(overrideReason, 500) : '',
    items: canonicalItems,
  };
}

function hashReturnCreationPayload(payload = {}) {
  return hashValue(JSON.stringify(payload));
}

function firstIdentity(values = []) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

function buildReturnCreationScope({
  order = {},
  actor = {},
  customerSnapshot = {},
  requestSource = 'admin',
} = {}) {
  const source =
    cleanLower(requestSource, 40) === 'customer' ? 'customer' : 'admin';
  let identity;

  if (source === 'customer') {
    const customerId = firstIdentity([
      idValue(customerSnapshot?.customer),
      idValue(order?.customer?.customerId),
    ]);
    const email = cleanLower(
      customerSnapshot?.email ||
        order?.customer?.email ||
        (String(order?.customer?.emailOrPhone || '').includes('@')
          ? order.customer.emailOrPhone
          : ''),
      220
    );
    const phone = cleanText(
      customerSnapshot?.phone ||
        order?.customer?.phone ||
        (!String(order?.customer?.emailOrPhone || '').includes('@')
          ? order.customer.emailOrPhone
          : ''),
      80
    ).replace(/[^0-9+]/g, '');
    identity = firstIdentity([
      customerId ? `id:${customerId}` : '',
      email ? `email:${email}` : '',
      phone ? `phone:${phone}` : '',
      `order:${idValue(order?._id)}`,
    ]);
  } else {
    const actorId = idValue(actor?.id);
    const actorRole = cleanLower(actor?.role, 80);
    const actorLabel = cleanLower(
      actor?.label || actor?.displayName || 'admin',
      160
    );
    identity = firstIdentity([
      actorId ? `id:${actorId}` : '',
      `identity:${actorRole}:${actorLabel}`,
    ]);
  }

  return `${source}:${hashValue(identity).slice(0, 48)}`;
}

function buildReturnCreationIdempotency({
  order = {},
  actor = {},
  customerSnapshot = {},
  idempotencyKey = '',
  ...request
} = {}) {
  const canonicalPayload = canonicalReturnCreationPayload({ order, ...request });
  const requestHash = hashReturnCreationPayload(canonicalPayload);
  const explicitKey = normalizeExplicitIdempotencyKey(idempotencyKey);
  if (!explicitKey) {
    throw createReturnError(
      'Envía una clave de idempotencia para crear la devolución.',
      'RETURN_IDEMPOTENCY_KEY_REQUIRED',
      400,
      {
        header: 'Idempotency-Key',
        minimumLength: 8,
        maximumLength: RETURN_CREATION_IDEMPOTENCY_KEY_MAX_LENGTH,
      }
    );
  }
  return {
    scope: buildReturnCreationScope({
      order,
      actor,
      customerSnapshot,
      requestSource: canonicalPayload.requestSource,
    }),
    key: explicitKey,
    requestHash,
    canonicalPayload,
    explicit: true,
  };
}

function evaluateExistingReturnCreation(existing, expected = {}) {
  if (!existing) return { action: 'continue', returnCase: null };
  const existingHash = String(existing.creationRequestHash || '').trim();
  if (!existingHash || existingHash !== String(expected.requestHash || '')) {
    throw createReturnError(
      'La clave de idempotencia ya fue usada con otra solicitud de devolución.',
      'RETURN_IDEMPOTENCY_KEY_REUSED',
      409,
      {
        idempotencyKey: String(expected.key || ''),
      }
    );
  }
  return { action: 'reuse', returnCase: existing };
}

function withSession(query, session) {
  return session && typeof query?.session === 'function'
    ? query.session(session)
    : query;
}

async function resolveQuery(query) {
  return typeof query?.exec === 'function' ? query.exec() : query;
}

function createReturnCreationIdempotencyService({ OrderReturnModel } = {}) {
  if (!OrderReturnModel || typeof OrderReturnModel.findOne !== 'function') {
    throw new TypeError('ORDER_RETURN_IDEMPOTENCY_MODEL_REQUIRED');
  }

  async function inspect({ orderId, descriptor, session = null } = {}) {
    const query = OrderReturnModel.findOne({
      order: orderId,
      creationIdempotencyScope: descriptor.scope,
      creationIdempotencyKey: descriptor.key,
    });
    const existing = await resolveQuery(withSession(query, session));
    return evaluateExistingReturnCreation(existing, descriptor);
  }

  return Object.freeze({ inspect });
}

function isDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
}

module.exports = {
  RETURN_CREATION_IDEMPOTENCY_KEY_MAX_LENGTH,
  RETURN_CREATION_IDEMPOTENCY_KEY_PATTERN,
  buildReturnCreationIdempotency,
  buildReturnCreationScope,
  canonicalReturnCreationPayload,
  createReturnCreationIdempotencyService,
  evaluateExistingReturnCreation,
  hashReturnCreationPayload,
  isDuplicateKeyError,
  normalizeExplicitIdempotencyKey,
};
