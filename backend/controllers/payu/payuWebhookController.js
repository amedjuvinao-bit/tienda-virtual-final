'use strict';

const {
  preparePayUWebhookRequest,
} = require('../../services/payu/payuWebhookRequestService');
const {
  processPayUWebhookTransaction,
} = require('../../services/payu/payuWebhookTransactionService');
const {
  buildPayUWebhookErrorResponse,
  finalizePayUWebhookResponse,
  sendPayUWebhookResponse,
} = require('../../services/payu/payuWebhookResponseService');

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`PAYU_WEBHOOK_DEPENDENCY_REQUIRED:${name}`);
  }
  return value;
}

function createPayUWebhookController({
  mongooseLib,
  OrderModel,
  OrderEventModel,
  getActivePaymentsConfig,
  getStoreCreditCheckoutService,
  configurationService,
  paymentAttemptService,
  fingerprintPaymentMerchant,
  signatureService,
  inventoryService,
  postCommitService,
  generateElectronicInvoiceAfterPayment,
  logger = console,
} = {}) {
  if (!mongooseLib || !OrderModel || !OrderEventModel) {
    throw new TypeError('PAYU_WEBHOOK_DEPENDENCY_REQUIRED:models');
  }

  const loadPayments = requireFunction(
    getActivePaymentsConfig,
    'getActivePaymentsConfig'
  );
  const loadStoreCredit = requireFunction(
    getStoreCreditCheckoutService,
    'getStoreCreditCheckoutService'
  );
  const {
    buildPayUInvoiceTransaction,
    extractOrderNumberFromReference,
    parseBoolean,
    parsePayUWebhookStatus,
    trimSafe,
    validatePayUIpIfEnabled,
    verifyPayUWebhookConfig,
  } = configurationService || {};
  const { claimApprovedAttempt, claimNonApprovedAttempt } =
    paymentAttemptService || {};
  const { parseAmount, validatePayUSignature } = signatureService || {};
  const { syncReservationAfterPayU } = inventoryService || {};
  const durablePostCommit = postCommitService?.processPaidOrderEffects;
  const processPostCommitEffects =
    typeof durablePostCommit === 'function'
      ? (payload) => durablePostCommit(payload)
      : typeof generateElectronicInvoiceAfterPayment === 'function'
        ? (payload) => generateElectronicInvoiceAfterPayment(payload)
        : null;

  [
    ['buildPayUInvoiceTransaction', buildPayUInvoiceTransaction],
    ['extractOrderNumberFromReference', extractOrderNumberFromReference],
    ['parseBoolean', parseBoolean],
    ['parsePayUWebhookStatus', parsePayUWebhookStatus],
    ['trimSafe', trimSafe],
    ['validatePayUIpIfEnabled', validatePayUIpIfEnabled],
    ['verifyPayUWebhookConfig', verifyPayUWebhookConfig],
    ['claimApprovedAttempt', claimApprovedAttempt],
    ['claimNonApprovedAttempt', claimNonApprovedAttempt],
    ['fingerprintPaymentMerchant', fingerprintPaymentMerchant],
    ['parseAmount', parseAmount],
    ['validatePayUSignature', validatePayUSignature],
    ['syncReservationAfterPayU', syncReservationAfterPayU],
    ['processPaidOrderEffects', processPostCommitEffects],
  ].forEach(([name, dependency]) => requireFunction(dependency, name));

  const requestDependencies = {
    OrderModel,
    loadPayments,
    verifyPayUWebhookConfig,
    validatePayUIpIfEnabled,
    trimSafe,
    parseBoolean,
    validatePayUSignature,
    extractOrderNumberFromReference,
    parseAmount,
    parsePayUWebhookStatus,
  };
  const transactionDependencies = {
    OrderModel,
    OrderEventModel,
    loadStoreCredit,
    claimApprovedAttempt,
    claimNonApprovedAttempt,
    fingerprintPaymentMerchant,
    syncReservationAfterPayU,
    buildPayUInvoiceTransaction,
  };

  return async function processPayUWebhook(req, res) {
    let session = null;

    try {
      const prepared = await preparePayUWebhookRequest({
        req,
        ...requestDependencies,
      });
      if (prepared.earlyResponse) {
        return sendPayUWebhookResponse(res, prepared.earlyResponse);
      }

      session = await mongooseLib.startSession();
      const transactionResult = await processPayUWebhookTransaction({
        session,
        context: prepared.context,
        ...transactionDependencies,
      });
      const response = await finalizePayUWebhookResponse({
        transactionResult,
        processPostCommitEffects,
      });
      return sendPayUWebhookResponse(res, response);
    } catch (error) {
      logger.error('POST /payments/payu/webhook secure', error);
      return sendPayUWebhookResponse(res, buildPayUWebhookErrorResponse(error));
    } finally {
      if (session) await session.endSession();
    }
  };
}

module.exports = {
  createPayUWebhookController,
};
