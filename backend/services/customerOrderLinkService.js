'use strict';

const {
  applyCustomerResolutionToOrderData,
  buildCustomerPayloadFromOrder,
  hasCustomerIdentity,
  isConfirmedOrder,
  isDemoOrder,
} = require('./customerOrderLink/normalization');
const {
  findCustomerMatch,
} = require('./customerOrderLink/matching');
const {
  resolveCustomerForOrder,
} = require('./customerOrderLink/resolution');
const {
  applyCustomerStatsForOrder,
} = require('./customerOrderLink/stats');
const {
  syncCustomerMasterFromOrder,
} = require('./customerOrderLink/sync');

module.exports = {
  applyCustomerResolutionToOrderData,
  applyCustomerStatsForOrder,
  buildCustomerPayloadFromOrder,
  findCustomerMatch,
  hasCustomerIdentity,
  isConfirmedOrder,
  isDemoOrder,
  resolveCustomerForOrder,
  syncCustomerMasterFromOrder,
};
