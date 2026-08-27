'use strict';

// Fachada estable del dominio de devoluciones. Los consumidores existentes siguen
// importando este archivo; la implementación vive en módulos cohesionados por caso de uso.
const {
  createOrderReturn,
  listCustomerOrderReturns,
  listOrderReturns,
} = require('./orderReturns/creation');
const {
  buildReturnEligibility,
  loadReturnUsage,
  normalizeReturnRequest,
} = require('./orderReturns/eligibility');
const {
  resolveOrderReturnAutomaticExchange,
  resolveOrderReturnExchange,
} = require('./orderReturns/exchangeResolution');
const {
  ACTIVE_RETURN_STATUSES,
  createReturnError,
  lineUnitAmount,
} = require('./orderReturns/normalization');
const {
  safeCustomerReturnView,
  safeReturnView,
  safeStoreCreditView,
} = require('./orderReturns/presentation');
const {
  resolveOrderReturnRefund,
} = require('./orderReturns/refundResolution');
const {
  resolveOrderReturnStoreCredit,
} = require('./orderReturns/storeCreditResolution');
const {
  validateInspection,
} = require('./orderReturns/validation');
const {
  updateOrderReturn,
} = require('./orderReturns/workflow');

module.exports = {
  ACTIVE_RETURN_STATUSES,
  buildReturnEligibility,
  createOrderReturn,
  createReturnError,
  lineUnitAmount,
  listCustomerOrderReturns,
  listOrderReturns,
  loadReturnUsage,
  normalizeReturnRequest,
  resolveOrderReturnAutomaticExchange,
  resolveOrderReturnExchange,
  resolveOrderReturnRefund,
  resolveOrderReturnStoreCredit,
  safeCustomerReturnView,
  safeReturnView,
  safeStoreCreditView,
  updateOrderReturn,
  validateInspection,
};
