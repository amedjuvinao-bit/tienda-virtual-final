'use strict';

const MAX_AUTOMATIC_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000];
const REQUIRES_REVIEW_CODES = new Set([
  'INVALID_ORDER_ID',
  'ORDER_NOT_FOUND',
  'ORDER_NOT_BILLABLE',
  'FACTUS_CREDENTIALS_INCOMPLETE',
]);

function requiresReview(error) {
  const code = String(error?.code || '').toUpperCase();
  return REQUIRES_REVIEW_CODES.has(code) || (
    code.startsWith('BILLING_') &&
    code !== 'BILLING_PROVIDER_GENERATION_ERROR' &&
    code !== 'BILLING_PROVIDER_NUMBER_MISSING'
  );
}

function nextInvoiceAttempt({ error, attempts, now }) {
  const count = Math.max(1, Number(attempts) || 1);
  if (requiresReview(error) || count >= MAX_AUTOMATIC_ATTEMPTS) {
    return { status: 'needs_review', nextAttemptAt: null };
  }
  return {
    status: 'failed',
    nextAttemptAt: new Date(now.getTime() + RETRY_DELAYS_MS[count - 1]),
  };
}

module.exports = { MAX_AUTOMATIC_ATTEMPTS, nextInvoiceAttempt };
