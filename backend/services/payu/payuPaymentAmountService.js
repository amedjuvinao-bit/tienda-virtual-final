'use strict';

const CENTS_PER_UNIT = 100;

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function toMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.round((numeric + Number.EPSILON) * CENTS_PER_UNIT) /
        CENTS_PER_UNIT
    : Number.NaN;
}

function resolvePayUExternalAmount(order) {
  const payment = order?.payment;

  if (!payment || typeof payment !== 'object') {
    return { ok: false, error: 'PAYU_PAYMENT_AMOUNT_MISSING' };
  }

  const hasAmount = hasValue(payment.amount);
  const hasAmountInCents = hasValue(payment.amountInCents);

  if (!hasAmount && !hasAmountInCents) {
    return { ok: false, error: 'PAYU_PAYMENT_AMOUNT_MISSING' };
  }

  const amount = hasAmount ? toMoney(payment.amount) : Number.NaN;
  const amountInCents = hasAmountInCents
    ? Number(payment.amountInCents)
    : Number.NaN;

  if (
    (hasAmount && (!Number.isFinite(amount) || amount < 0)) ||
    (hasAmountInCents &&
      (!Number.isSafeInteger(amountInCents) || amountInCents < 0))
  ) {
    return { ok: false, error: 'PAYU_PAYMENT_AMOUNT_INVALID' };
  }

  const resolvedAmountInCents = hasAmount
    ? Math.round(amount * CENTS_PER_UNIT)
    : amountInCents;

  if (hasAmount && hasAmountInCents && resolvedAmountInCents !== amountInCents) {
    return { ok: false, error: 'PAYU_PAYMENT_AMOUNT_INCONSISTENT' };
  }

  if (resolvedAmountInCents <= 0) {
    return { ok: false, error: 'PAYU_PAYMENT_AMOUNT_NOT_DUE' };
  }

  return {
    ok: true,
    amount: resolvedAmountInCents / CENTS_PER_UNIT,
    amountInCents: resolvedAmountInCents,
    source: hasAmount ? 'payment.amount' : 'payment.amountInCents',
  };
}

function matchesPayUExternalAmount(receivedAmount, expectedAmountInCents) {
  const normalizedReceived = toMoney(receivedAmount);
  const normalizedExpectedCents = Number(expectedAmountInCents);

  return (
    Number.isFinite(normalizedReceived) &&
    normalizedReceived > 0 &&
    Number.isSafeInteger(normalizedExpectedCents) &&
    Math.round(normalizedReceived * CENTS_PER_UNIT) === normalizedExpectedCents
  );
}

module.exports = {
  CENTS_PER_UNIT,
  matchesPayUExternalAmount,
  resolvePayUExternalAmount,
  toMoney,
};
