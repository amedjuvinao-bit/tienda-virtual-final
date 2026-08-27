// backend/services/orderRefundService.js

'use strict';

const {
  getPreviousRefundState,
} = require('./orderRefunds/refundCalculations');
const {
  restoreInventory,
} = require('./orderRefunds/refundInventoryService');
const {
  canonicalRefundPayload,
  createRefundError,
  normalizeRequestedItems,
} = require('./orderRefunds/refundNormalization');
const {
  processOrderRefund,
} = require('./orderRefunds/refundTransactionService');

module.exports = {
  processOrderRefund,
  createRefundError,
  normalizeRequestedItems,
  canonicalRefundPayload,
  getPreviousRefundState,
  restoreInventory,
};
