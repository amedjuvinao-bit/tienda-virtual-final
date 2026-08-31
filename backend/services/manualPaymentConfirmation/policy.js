'use strict';

const crypto = require('crypto');

const MANUAL_PAYMENT_METHODS = Object.freeze([
  'cash',
  'transfer',
  'card',
  'other',
]);

const METHOD_LABELS = Object.freeze({
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta registrada manualmente',
  other: 'Otro medio manual',
});

function cleanText(value, maximum = 300) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maximum);
}

function createManualPaymentError(
  code,
  message,
  statusCode = 409,
  details = {}
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function amountToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_AMOUNT_INVALID',
      'El monto confirmado debe ser un número mayor que cero.',
      422
    );
  }

  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-6) {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_AMOUNT_INVALID',
      'El monto confirmado solo admite dos decimales.',
      422
    );
  }
  return cents;
}

function normalizeActor(actor = {}) {
  const id = cleanText(actor.id || actor.userId || actor.label, 120);
  const label = cleanText(actor.label || actor.username || id, 160);
  if (!id || !label) {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_ACTOR_REQUIRED',
      'No fue posible identificar al administrador que confirma el pago.',
      403
    );
  }

  return Object.freeze({
    id,
    label,
    role: cleanText(actor.role, 80).toLowerCase(),
    source: cleanText(actor.source || 'admin', 80).toLowerCase(),
  });
}

function normalizeManualPaymentRequest(payload = {}) {
  const method = cleanText(payload.method, 40).toLowerCase();
  if (!MANUAL_PAYMENT_METHODS.includes(method)) {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_METHOD_NOT_ALLOWED',
      'El método de pago manual no está permitido.',
      422,
      { allowed: [...MANUAL_PAYMENT_METHODS] }
    );
  }

  const reference = cleanText(payload.reference, 160);
  if (reference.length < 4) {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_REFERENCE_REQUIRED',
      'Debes registrar una referencia comprobable del pago.',
      422
    );
  }

  const reason = cleanText(payload.reason, 500);
  if (reason.length < 8) {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_REASON_REQUIRED',
      'Debes explicar el motivo de la confirmación manual.',
      422
    );
  }

  const currency = cleanText(payload.currency, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_CURRENCY_INVALID',
      'La moneda debe enviarse con un código ISO de tres letras.',
      422
    );
  }

  const amountInCents = amountToCents(payload.amount);
  return Object.freeze({
    method,
    methodLabel: METHOD_LABELS[method],
    reference,
    referenceKey: reference.toLowerCase(),
    amount: amountInCents / 100,
    amountInCents,
    currency,
    reason,
  });
}

function expectedPaymentFacts(order) {
  const paymentAmount = Number(order?.payment?.amount);
  const storedCents = Number(order?.payment?.amountInCents);
  const derivedCents =
    Number.isFinite(paymentAmount) && paymentAmount >= 0
      ? Math.round(paymentAmount * 100)
      : NaN;

  if (
    Number.isInteger(storedCents) &&
    storedCents > 0 &&
    Number.isInteger(derivedCents) &&
    derivedCents > 0 &&
    storedCents !== derivedCents
  ) {
    throw createManualPaymentError(
      'ORDER_PAYMENT_AMOUNT_INCONSISTENT',
      'La orden tiene valores de pago inconsistentes y requiere revisión.',
      409
    );
  }

  const amountInCents =
    Number.isInteger(storedCents) && storedCents > 0
      ? storedCents
      : derivedCents;
  if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
    throw createManualPaymentError(
      'ORDER_PAYMENT_AMOUNT_NOT_CONFIGURED',
      'La orden no tiene un monto pendiente válido para confirmar.',
      409
    );
  }

  const currency = cleanText(order?.payment?.currency, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw createManualPaymentError(
      'ORDER_PAYMENT_CURRENCY_NOT_CONFIGURED',
      'La orden no tiene una moneda válida para confirmar.',
      409
    );
  }

  return { amount: amountInCents / 100, amountInCents, currency };
}

function assertManualProvider(order) {
  const provider = cleanText(order?.payment?.provider, 40).toLowerCase();
  if (provider !== 'manual') {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_PROVIDER_FORBIDDEN',
      'Las órdenes de pasarela solo pueden confirmarse mediante la evidencia verificada de su proveedor.',
      409,
      { provider: provider || 'unknown' }
    );
  }
}

function assertOrderAwaitsManualPayment(order) {
  const paymentStatus = cleanText(order?.payment?.status, 40).toLowerCase();
  const orderStatus = cleanText(order?.status, 40).toLowerCase();
  if (
    paymentStatus !== 'pending_manual' ||
    !['pending', 'processing'].includes(orderStatus)
  ) {
    throw createManualPaymentError(
      'ORDER_NOT_AWAITING_MANUAL_PAYMENT',
      'La orden no está pendiente de una confirmación manual.',
      409,
      { orderStatus, paymentStatus }
    );
  }
}

function assertExactPayment(order, request) {
  const expected = expectedPaymentFacts(order);
  if (request.currency !== expected.currency) {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_CURRENCY_MISMATCH',
      'La moneda confirmada no coincide con la moneda de la orden.',
      422,
      { expected: expected.currency, received: request.currency }
    );
  }
  if (request.amountInCents !== expected.amountInCents) {
    throw createManualPaymentError(
      'MANUAL_PAYMENT_AMOUNT_MISMATCH',
      'El monto confirmado debe coincidir exactamente con el saldo pendiente de la orden.',
      422,
      {
        expectedAmount: expected.amount,
        expectedAmountInCents: expected.amountInCents,
        receivedAmount: request.amount,
        receivedAmountInCents: request.amountInCents,
      }
    );
  }
  return expected;
}

function buildRequestFingerprint(orderId, request) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        orderId: String(orderId || ''),
        method: request.method,
        reference: request.referenceKey,
        amountInCents: request.amountInCents,
        currency: request.currency,
        reason: request.reason,
      })
    )
    .digest('hex');
}

function evidenceFingerprint(evidence) {
  return cleanText(
    evidence?.requestFingerprint ||
      evidence?.payment?.manualConfirmation?.requestFingerprint,
    64
  );
}

function assertMatchingReplay(evidence, fingerprint) {
  if (evidenceFingerprint(evidence) === fingerprint) return;
  throw createManualPaymentError(
    'MANUAL_PAYMENT_CONFIRMATION_CONFLICT',
    'La orden ya tiene una confirmación manual con evidencia diferente.',
    409
  );
}

function serializeEvidence(evidence) {
  if (!evidence) return null;
  const actor = evidence.actor || {};
  return {
    id: String(evidence._id || evidence.id || ''),
    provider: 'manual',
    method: cleanText(evidence.method, 40).toLowerCase(),
    reference: cleanText(evidence.reference, 160),
    amount: Number(evidence.amount || 0),
    amountInCents: Number(evidence.amountInCents || 0),
    currency: cleanText(evidence.currency, 3).toUpperCase(),
    reason: cleanText(evidence.reason, 500),
    actor: {
      id: cleanText(actor.id || evidence.actorId, 120),
      label: cleanText(actor.label || evidence.actorLabel, 160),
      role: cleanText(actor.role || evidence.actorRole, 80).toLowerCase(),
    },
    confirmedAt: evidence.confirmedAt || null,
  };
}

module.exports = {
  MANUAL_PAYMENT_METHODS,
  assertExactPayment,
  assertManualProvider,
  assertMatchingReplay,
  assertOrderAwaitsManualPayment,
  buildRequestFingerprint,
  cleanText,
  createManualPaymentError,
  normalizeActor,
  normalizeManualPaymentRequest,
  serializeEvidence,
};
