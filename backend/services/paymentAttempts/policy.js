'use strict';

const crypto = require('crypto');

const DEFAULT_RECONCILIATION_MESSAGE =
  'El proveedor reportó un cobro que no puede aplicarse automáticamente a la orden.';

function cleanText(value, maximum = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function idText(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function positiveInteger(value) {
  const number = Math.round(Number(value || 0));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeProvider(value) {
  return cleanText(value, 40).toLowerCase();
}

function normalizeCurrency(value) {
  return cleanText(value || 'COP', 12).toUpperCase() || 'COP';
}

function normalizeAttemptState(value) {
  return cleanText(value, 50).toLowerCase();
}

function fingerprintPaymentMerchant(provider, merchantIdentifier) {
  const safeProvider = normalizeProvider(provider);
  const safeIdentifier = cleanText(merchantIdentifier, 500);
  if (!safeProvider || !safeIdentifier) return '';
  return crypto
    .createHash('sha256')
    .update(`${safeProvider}|${safeIdentifier}`)
    .digest('hex');
}

function isOrderClosedForCheckout(order = {}) {
  const orderStatus = cleanText(order?.status, 40).toLowerCase();
  const paymentStatus = cleanText(order?.payment?.status, 40).toLowerCase();
  return (
    paymentStatus === 'paid' ||
    paymentStatus === 'cancelled' ||
    ['paid', 'cancelled', 'canceled', 'refunded'].includes(orderStatus)
  );
}

function buildStoreCreditAttemptSnapshot(order = {}) {
  const statusAtIssue =
    cleanText(order?.storeCredit?.status, 40).toLowerCase() || 'none';
  const applied = Boolean(
    order?.storeCredit?.applied === true && statusAtIssue === 'reserved'
  );
  return {
    applied,
    usage: applied ? order?.storeCredit?.usage || null : null,
    amountInCents: applied
      ? positiveInteger(Number(order?.storeCredit?.amount || 0) * 100)
      : 0,
    statusAtIssue,
  };
}

function resolveOrderPayableAmountInCents(order = {}) {
  const paymentAmount = Number(order?.payment?.amount);
  const total = Number(order?.total || 0);
  const amount =
    Number.isFinite(paymentAmount) && paymentAmount > 0 ? paymentAmount : total;
  return positiveInteger(amount * 100);
}

function sameAttemptComposition(attempt = {}, expected = {}) {
  const leftCredit = attempt?.storeCredit || {};
  const rightCredit = expected?.storeCredit || {};
  return Boolean(
    positiveInteger(attempt.amountInCents) ===
      positiveInteger(expected.amountInCents) &&
      normalizeCurrency(attempt.currency) ===
        normalizeCurrency(expected.currency) &&
      cleanText(attempt.merchantFingerprint, 128) ===
        cleanText(expected.merchantFingerprint, 128) &&
      Boolean(leftCredit.applied) === Boolean(rightCredit.applied) &&
      idText(leftCredit.usage) === idText(rightCredit.usage) &&
      positiveInteger(leftCredit.amountInCents) ===
        positiveInteger(rightCredit.amountInCents) &&
      normalizeAttemptState(leftCredit.statusAtIssue) ===
        normalizeAttemptState(rightCredit.statusAtIssue)
  );
}

function reconciliationDecision(code, message, details = {}) {
  return {
    allowed: false,
    duplicate: false,
    reconciliationRequired: true,
    code,
    message: message || DEFAULT_RECONCILIATION_MESSAGE,
    ...details,
  };
}

function evaluateApprovedPaymentAttempt({
  order = {},
  attempt = null,
  usage = null,
  provider,
  reference,
  transactionId,
  amountInCents,
  currency,
  merchantFingerprint = '',
} = {}) {
  const safeProvider = normalizeProvider(provider);
  const safeReference = cleanText(reference, 220);
  const safeTransactionId = cleanText(transactionId, 160);
  const safeAmountInCents = positiveInteger(amountInCents);
  const providedCurrency = cleanText(currency, 12).toUpperCase();
  const safeCurrency = normalizeCurrency(providedCurrency);
  const safeMerchantFingerprint = cleanText(merchantFingerprint, 128);

  if (!attempt) {
    return reconciliationDecision(
      'PAYMENT_ATTEMPT_UNKNOWN',
      'La referencia aprobada no fue emitida por este checkout.'
    );
  }

  if (
    normalizeProvider(attempt.provider) !== safeProvider ||
    cleanText(attempt.reference, 220) !== safeReference ||
    idText(attempt.order) !== idText(order?._id) ||
    cleanText(attempt.orderNumber, 90).toUpperCase() !==
      cleanText(order?.orderNumber, 90).toUpperCase()
  ) {
    return reconciliationDecision(
      'PAYMENT_ATTEMPT_ORDER_MISMATCH',
      'La referencia aprobada no pertenece inequívocamente a esta orden.'
    );
  }

  if (!safeTransactionId) {
    return reconciliationDecision(
      'PAYMENT_TRANSACTION_ID_MISSING',
      'El proveedor no entregó un identificador de transacción verificable.'
    );
  }

  if (!providedCurrency) {
    return reconciliationDecision(
      'PAYMENT_ATTEMPT_CURRENCY_MISSING',
      'El proveedor no entregó la moneda del intento aprobado.'
    );
  }

  if (
    positiveInteger(attempt.amountInCents) !== safeAmountInCents ||
    normalizeCurrency(attempt.currency) !== safeCurrency
  ) {
    return reconciliationDecision(
      'PAYMENT_ATTEMPT_VALUE_MISMATCH',
      'El monto o la moneda no coinciden con el intento exacto emitido.',
      {
        expectedAmountInCents: positiveInteger(attempt.amountInCents),
        expectedCurrency: normalizeCurrency(attempt.currency),
      }
    );
  }

  if (
    !safeMerchantFingerprint ||
    !cleanText(attempt.merchantFingerprint, 128) ||
    cleanText(attempt.merchantFingerprint, 128) !== safeMerchantFingerprint
  ) {
    return reconciliationDecision(
      'PAYMENT_ATTEMPT_MERCHANT_MISMATCH',
      'El intento no pertenece a la configuración de comercio que firmó el evento.'
    );
  }

  const attemptState = normalizeAttemptState(attempt.state);
  const attemptTransactionId = cleanText(attempt.transactionId, 160);
  const persistedTransactionId = cleanText(
    order?.payment?.transactionId ||
      order?.paymentProcessing?.approvedTransactionId,
    160
  );
  const paymentAlreadyApproved =
    cleanText(order?.payment?.status, 40).toLowerCase() === 'paid' ||
    Boolean(order?.paymentProcessing?.approvedAt);

  if (
    ['approved', 'reconciliation_required'].includes(attemptState) &&
    attemptTransactionId === safeTransactionId &&
    persistedTransactionId === safeTransactionId &&
    paymentAlreadyApproved
  ) {
    return {
      allowed: true,
      duplicate: true,
      reconciliationRequired: false,
      code: 'PAYMENT_ATTEMPT_DUPLICATE',
      message: 'La aprobación ya fue aplicada a esta orden.',
    };
  }

  if (
    attemptState === 'reconciliation_required' &&
    attempt?.reconciliation?.required === true &&
    cleanText(attempt?.reconciliation?.transactionId, 160) ===
      safeTransactionId
  ) {
    return reconciliationDecision(
      cleanText(attempt?.reconciliation?.code, 120) ||
        'PAYMENT_RECONCILIATION_REQUIRED',
      cleanText(attempt?.reconciliation?.message, 500) ||
        DEFAULT_RECONCILIATION_MESSAGE
    );
  }

  if (
    (attemptTransactionId && attemptTransactionId !== safeTransactionId) ||
    (paymentAlreadyApproved && persistedTransactionId !== safeTransactionId)
  ) {
    return reconciliationDecision(
      'PAYMENT_SECOND_CHARGE_DETECTED',
      'Se detectó otra transacción aprobada para una orden que ya tenía un cobro.'
    );
  }

  const recoverableLateApproval = Boolean(
    ['declined', 'cancelled', 'error'].includes(attemptState) &&
      attemptTransactionId === safeTransactionId &&
      attempt.issuedBySystem !== false
  );
  if (
    !recoverableLateApproval &&
    (attemptState !== 'issued' ||
      attempt.active !== true ||
      attempt.issuedBySystem === false)
  ) {
    return reconciliationDecision(
      attemptState === 'superseded'
        ? 'PAYMENT_ATTEMPT_SUPERSEDED'
        : 'PAYMENT_ATTEMPT_NOT_ACTIVE',
      'El intento aprobado ya no era el intento activo de la orden.'
    );
  }

  const creditSnapshot = attempt?.storeCredit || {};
  if (creditSnapshot.applied === true) {
    const usageStatus = normalizeAttemptState(usage?.status);
    if (!usage || idText(usage._id) !== idText(creditSnapshot.usage)) {
      return reconciliationDecision(
        'STORE_CREDIT_USAGE_MISMATCH',
        'No existe la reserva de saldo vinculada al intento aprobado.'
      );
    }
    if (usageStatus === 'released') {
      return reconciliationDecision(
        'STORE_CREDIT_RELEASED_BEFORE_APPROVAL',
        'El saldo de este intento ya había sido liberado antes de la aprobación.'
      );
    }
    if (usageStatus !== 'reserved') {
      return reconciliationDecision(
        'STORE_CREDIT_NOT_RESERVED_FOR_ATTEMPT',
        'El saldo de este intento no permanece reservado.'
      );
    }
    if (
      cleanText(order?.storeCredit?.status, 40).toLowerCase() !== 'reserved' ||
      idText(order?.storeCredit?.usage) !== idText(creditSnapshot.usage)
    ) {
      return reconciliationDecision(
        'STORE_CREDIT_ORDER_SNAPSHOT_CHANGED',
        'La composición de saldo de la orden cambió después de emitir el intento.'
      );
    }
  } else if (
    order?.storeCredit?.applied === true &&
    cleanText(order?.storeCredit?.status, 40).toLowerCase() === 'reserved'
  ) {
    return reconciliationDecision(
      'PAYMENT_COMPOSITION_CHANGED',
      'La orden reservó saldo después de emitir este intento de pago.'
    );
  }

  return {
    allowed: true,
    duplicate: false,
    reconciliationRequired: false,
    code: 'PAYMENT_ATTEMPT_CLAIMED',
    message: 'El intento coincide con la aprobación verificada.',
  };
}

module.exports = {
  DEFAULT_RECONCILIATION_MESSAGE,
  buildStoreCreditAttemptSnapshot,
  cleanText,
  evaluateApprovedPaymentAttempt,
  fingerprintPaymentMerchant,
  idText,
  isOrderClosedForCheckout,
  normalizeAttemptState,
  normalizeCurrency,
  normalizeProvider,
  positiveInteger,
  resolveOrderPayableAmountInCents,
  sameAttemptComposition,
};
