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
  preserveLegacyCustomerOrderLinks,
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
  preserveLegacyCustomerOrderLinks,
  resolveCustomerForOrder,
  syncCustomerMasterFromOrder,
};
