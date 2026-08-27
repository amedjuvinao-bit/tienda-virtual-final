'use strict';

const { isVerifiedPaymentApproval } = require('../verifiedPaymentApprovalService');
const {
  isRetryableInventoryApprovalError,
} = require('../wompiWebhookPaymentState');
const {
  resolveApprovedProcessorDependencies,
} = require('./dependencies');
const {
  runInitialApprovedTransaction,
} = require('./initialTransaction');
const {
  createInventoryFailurePersister,
} = require('./inventoryFailure');
const { retryApprovedInventory } = require('./inventoryRetry');
const { completeApprovedPostCommit } = require('./postCommitResult');

function createWompiWebhookIntegrityService(overrides = {}) {
  const dependencies = resolveApprovedProcessorDependencies(overrides);

  async function processApproved({
    orderNumber,
    transaction = {},
    payments = {},
    reference = '',
    merchantFingerprint = '',
    verified = false,
  } = {}) {
    if (
      !isVerifiedPaymentApproval({
        verified,
        providerStatus: transaction?.status,
        normalizedPaymentStatus: 'paid',
      })
    ) {
      const error = Object.assign(
        new Error('El proveedor no confirmo un pago aprobado verificable.'),
        { code: 'UNVERIFIED_PAYMENT_APPROVAL' }
      );
      return {
        ok: false,
        ignored: true,
        retryable: false,
        inventoryReady: false,
        invoiceEligible: false,
        error,
      };
    }

    const persistInventoryFailure = createInventoryFailurePersister({
      dependencies,
      orderNumber,
      payments,
      reference,
      transaction,
    });
    let initial;
    try {
      initial = await runInitialApprovedTransaction({
        dependencies,
        merchantFingerprint,
        orderNumber,
        payments,
        reference,
        transaction,
        verified,
      });
    } catch (error) {
      if (!isRetryableInventoryApprovalError(error)) throw error;
      return persistInventoryFailure(error);
    }

    if (initial.reconciliationRequired) {
      return {
        ok: false,
        retryable: false,
        inventoryReady: false,
        invoiceEligible: false,
        reconciliationRequired: true,
        reconciliationCode: initial.reconciliationCode,
        reconciliationMessage: initial.reconciliationMessage,
        duplicateReconciliation: initial.duplicateReconciliation === true,
        orderId: initial.orderId,
        orderNumber: initial.orderNumber,
      };
    }

    if (initial.needsInventoryRetry) {
      const retried = await retryApprovedInventory({
        dependencies,
        initial,
        orderNumber,
        payments,
        persistInventoryFailure,
        reference,
        transaction,
        verified,
      });
      if (retried.terminal) return retried.result;
      initial = retried.initial;
    }

    if (initial.inventoryReady) {
      return completeApprovedPostCommit({
        initial,
        payments,
        processPostCommitEffects: dependencies.processPostCommitEffects,
        transaction,
      });
    }

    return persistInventoryFailure(
      Object.assign(new Error('La transaccion no confirmo el inventario.'), {
        code: 'INVENTORY_CONFIRMATION_NOT_READY',
        retryable: true,
      })
    );
  }

  return { processApproved };
}

module.exports = { createWompiWebhookIntegrityService };
