'use strict';

const Cart = require('../../models/Cart');
const ElectronicInvoice = require('../../models/ElectronicInvoice');
const Order = require('../../models/Order');
const OrderRefund = require('../../models/OrderRefund');
const OrderReturn = require('../../models/OrderReturn');
const PaymentAttempt = require('../../models/PaymentAttempt');
const ShippingOperation = require('../../models/ShippingOperation');
const StoreCredit = require('../../models/StoreCredit');
const StoreCreditUsage = require('../../models/StoreCreditUsage');

function findRecent(Model, filter, sort, limit) {
  return Model.find(filter)
    .sort(sort)
    .limit(limit)
    .lean();
}

function createCustomer360MongoRepository() {
  return {
    countOrders(filter) {
      return Order.countDocuments(filter);
    },
    findOrders(filter, limit) {
      return findRecent(Order, filter, { createdAt: -1, _id: -1 }, limit);
    },
    findPaymentAttempts(filter, limit) {
      return findRecent(
        PaymentAttempt,
        filter,
        { issuedAt: -1, createdAt: -1, _id: -1 },
        limit
      );
    },
    findInvoices(filter, limit) {
      return findRecent(
        ElectronicInvoice,
        filter,
        { createdAt: -1, _id: -1 },
        limit
      );
    },
    findReturns(filter, limit) {
      return findRecent(
        OrderReturn,
        filter,
        { requestedAt: -1, createdAt: -1, _id: -1 },
        limit
      );
    },
    findRefunds(filter, limit) {
      return findRecent(
        OrderRefund,
        filter,
        { processedAt: -1, createdAt: -1, _id: -1 },
        limit
      );
    },
    findShippingOperations(filter, limit) {
      return findRecent(
        ShippingOperation,
        filter,
        { createdAt: -1, _id: -1 },
        limit
      );
    },
    findCarts(filter, limit) {
      return findRecent(
        Cart,
        filter,
        { lastCustomerActivityAt: -1, updatedAt: -1, _id: -1 },
        limit
      );
    },
    findStoreCredits(filter, limit) {
      return findRecent(
        StoreCredit,
        filter,
        { issuedAt: -1, createdAt: -1, _id: -1 },
        limit
      );
    },
    findStoreCreditUsages(filter, limit) {
      return findRecent(
        StoreCreditUsage,
        filter,
        { createdAt: -1, _id: -1 },
        limit
      );
    },
  };
}

module.exports = { createCustomer360MongoRepository };
