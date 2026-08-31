'use strict';

const {
  PAYMENT_INVENTORY_TRANSACTION_MAX_ATTEMPTS,
} = require('./constants');
const {
  asRetryablePaymentInventoryError,
  isRetryablePaymentInventoryError,
} = require('./errorClassification');

async function runPaymentInventoryTransaction({
  startSession,
  work,
  maxAttempts = PAYMENT_INVENTORY_TRANSACTION_MAX_ATTEMPTS,
} = {}) {
  if (typeof startSession !== 'function' || typeof work !== 'function') {
    throw new TypeError('startSession y work son obligatorios.');
  }
  const safeMaxAttempts = Math.max(1, Math.min(5, Number(maxAttempts) || 1));
  let lastError = null;

  for (let attempt = 1; attempt <= safeMaxAttempts; attempt += 1) {
    const session = await startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session, { attempt, maxAttempts: safeMaxAttempts });
      });
      return result;
    } catch (error) {
      lastError = error;
      if (!isRetryablePaymentInventoryError(error)) throw error;
      if (attempt >= safeMaxAttempts) {
        throw asRetryablePaymentInventoryError(error);
      }
    } finally {
      await session.endSession();
    }
  }

  throw asRetryablePaymentInventoryError(lastError);
}

module.exports = {
  runPaymentInventoryTransaction,
};
