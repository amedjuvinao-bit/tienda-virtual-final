'use strict';

const {
  MAX_BULK_ORDERS,
  createTransitionError,
  getAllowedOrderStatuses,
  normalizeOrderStatus,
} = require('./orderStatus/stateMachine');
const {
  needsOperationalReconciliation,
  validateOrderStatusTransition,
} = require('./orderStatus/operationalValidation');
const {
  transitionOrderStatus,
} = require('./orderStatus/singleTransition');
const {
  processBulkOrderStatusTransitions,
} = require('./orderStatus/bulkTransition');

module.exports = {
  MAX_BULK_ORDERS,
  normalizeOrderStatus,
  getAllowedOrderStatuses,
  validateOrderStatusTransition,
  needsOperationalReconciliation,
  transitionOrderStatus,
  processBulkOrderStatusTransitions,
  createTransitionError,
};
