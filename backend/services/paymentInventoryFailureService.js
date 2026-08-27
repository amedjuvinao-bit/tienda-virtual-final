'use strict';

const {
  PAYMENT_INVENTORY_TRANSACTION_MAX_ATTEMPTS,
  PERMANENT_PAYMENT_INVENTORY_CODES,
  RETRYABLE_PAYMENT_INVENTORY_CODES,
} = require('./paymentInventoryFailure/constants');
const {
  asRetryablePaymentInventoryError,
  createFailureError,
  isPermanentPaymentInventoryError,
  isRetryablePaymentInventoryError,
} = require('./paymentInventoryFailure/errorClassification');
const {
  getLegacyCompensationPlan,
  hasLegacyDiscountEvidence,
  hasReservationEvidence,
  resolveFailureInventoryMode,
} = require('./paymentInventoryFailure/inventoryMode');
const {
  assertLegacyCompensationComplete,
  compensateLegacyDiscountedInventory,
  createLegacyInventoryCompensationService,
  restoreLegacyAllocation,
} = require('./paymentInventoryFailure/legacyCompensation');
const {
  reconcileLegacyFailureCompensation,
  reverseLegacyFailureAllocation,
} = require('./paymentInventoryFailure/legacyReconciliation');
const {
  assertFailureMovementMatches,
  buildFailureMovementNumber,
  buildFailureReversalMovementNumber,
} = require('./paymentInventoryFailure/movementEvidence');
const {
  createPaymentInventoryFailureService,
} = require('./paymentInventoryFailure/service');
const {
  runPaymentInventoryTransaction,
} = require('./paymentInventoryFailure/transactionRunner');

module.exports = {
  PERMANENT_PAYMENT_INVENTORY_CODES,
  PAYMENT_INVENTORY_TRANSACTION_MAX_ATTEMPTS,
  RETRYABLE_PAYMENT_INVENTORY_CODES,
  asRetryablePaymentInventoryError,
  assertLegacyCompensationComplete,
  buildFailureMovementNumber,
  buildFailureReversalMovementNumber,
  assertFailureMovementMatches,
  compensateLegacyDiscountedInventory,
  createFailureError,
  createLegacyInventoryCompensationService,
  createPaymentInventoryFailureService,
  getLegacyCompensationPlan,
  hasLegacyDiscountEvidence,
  hasReservationEvidence,
  reconcileLegacyFailureCompensation,
  restoreLegacyAllocation,
  isRetryablePaymentInventoryError,
  isPermanentPaymentInventoryError,
  runPaymentInventoryTransaction,
  reverseLegacyFailureAllocation,
  resolveFailureInventoryMode,
};
