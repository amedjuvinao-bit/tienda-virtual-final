'use strict';

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`WOMPI_ORDER_DEPENDENCY_REQUIRED:${name}`);
  }
  return value;
}

function resolveWompiOrderDependencies(config = {}) {
  const {
    mongooseAdapter,
    OrderModel,
    OrderEventModel,
    getStoreCreditCheckoutService,
    createPaymentInventoryFailureService,
    createWompiWebhookIntegrityService,
    buildPaymentFailureReleaseReason,
    confirmInventoryReservation,
    reconcilePaymentFailureReservation,
    releaseInventoryReservation,
    applyReservationToOrderDocument,
    isApprovedPayment,
    resolveMonotonicWompiTransition,
    runPaymentInventoryTransaction,
    postCommitService,
    invoiceSchedulingService,
    paymentAttemptService,
    fingerprintPaymentMerchant,
    trimSafe,
    logger = console,
  } = config;

  if (!mongooseAdapter || typeof mongooseAdapter.startSession !== 'function') {
    throw new TypeError('WOMPI_ORDER_MONGOOSE_ADAPTER_REQUIRED');
  }
  if (!OrderModel || !OrderEventModel) {
    throw new TypeError('WOMPI_ORDER_MODELS_REQUIRED');
  }

  const loadStoreCredit = requireFunction(
    getStoreCreditCheckoutService,
    'getStoreCreditCheckoutService'
  );
  const clean = requireFunction(trimSafe, 'trimSafe');
  const resolveTransition = requireFunction(
    resolveMonotonicWompiTransition,
    'resolveMonotonicWompiTransition'
  );
  const runInventoryTransaction = requireFunction(
    runPaymentInventoryTransaction,
    'runPaymentInventoryTransaction'
  );
  const durablePostCommit = postCommitService?.processPaidOrderEffects;
  const legacyInvoiceScheduler = invoiceSchedulingService?.scheduleOnce;
  if (
    typeof durablePostCommit !== 'function' &&
    typeof legacyInvoiceScheduler !== 'function'
  ) {
    throw new TypeError(
      'WOMPI_ORDER_DEPENDENCY_REQUIRED:postCommitService.processPaidOrderEffects'
    );
  }
  const processPostCommitEffects =
    typeof durablePostCommit === 'function'
      ? (payload) => durablePostCommit(payload)
      : async (payload) => ({
          fulfillment: { processed: false, legacy: true },
          invoice: await legacyInvoiceScheduler(payload),
        });
  const claimApprovedPaymentAttempt = requireFunction(
    paymentAttemptService?.claimApprovedAttempt,
    'paymentAttemptService.claimApprovedAttempt'
  );
  const findPaymentAttempt = requireFunction(
    paymentAttemptService?.findAttempt,
    'paymentAttemptService.findAttempt'
  );
  const claimNonApprovedPaymentAttempt = requireFunction(
    paymentAttemptService?.claimNonApprovedAttempt,
    'paymentAttemptService.claimNonApprovedAttempt'
  );
  const merchantFingerprintFor = requireFunction(
    fingerprintPaymentMerchant,
    'fingerprintPaymentMerchant'
  );

  const paymentInventoryFailureService = requireFunction(
    createPaymentInventoryFailureService,
    'createPaymentInventoryFailureService'
  )({
    releaseReservation: releaseInventoryReservation,
    applyReservation: applyReservationToOrderDocument,
    reconcileReservation: reconcilePaymentFailureReservation,
    isApprovedPayment,
    buildReleaseReason: buildPaymentFailureReleaseReason,
  });

  return {
    OrderEventModel,
    OrderModel,
    applyReservationToOrderDocument,
    claimApprovedPaymentAttempt,
    claimNonApprovedPaymentAttempt,
    clean,
    confirmInventoryReservation,
    createWompiWebhookIntegrityService,
    findPaymentAttempt,
    loadStoreCredit,
    logger,
    merchantFingerprintFor,
    mongooseAdapter,
    paymentInventoryFailureService,
    processPostCommitEffects,
    resolveTransition,
    runInventoryTransaction,
  };
}

module.exports = {
  requireFunction,
  resolveWompiOrderDependencies,
};
