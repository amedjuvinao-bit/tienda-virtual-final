'use strict';

const {
  getOrderReturns,
  patchOrderReturn,
  postOrderReturn,
  postReturnAutomaticExchange,
  postReturnExchange,
  postReturnRefund,
  postReturnStoreCredit,
} = require('./orderReturns/adminController');
const {
  cancelCustomerOrderReturn,
  getCustomerOrderReturns,
  postCustomerOrderReturn,
} = require('./orderReturns/customerController');
const {
  getCustomerReturnLabel,
} = require('./orderReturns/customerLabelController');
const {
  getReturnPolicy,
  putReturnPolicy,
} = require('./orderReturns/policyController');
const {
  buildAccess,
  returnCreationIdempotencyKey,
  wholeOrderAccessOptions,
} = require('./orderReturns/shared');

module.exports = {
  buildAccess,
  cancelCustomerOrderReturn,
  getCustomerOrderReturns,
  getCustomerReturnLabel,
  getReturnPolicy,
  getOrderReturns,
  patchOrderReturn,
  postCustomerOrderReturn,
  postOrderReturn,
  postReturnAutomaticExchange,
  postReturnExchange,
  postReturnRefund,
  postReturnStoreCredit,
  putReturnPolicy,
  returnCreationIdempotencyKey,
  wholeOrderAccessOptions,
};
