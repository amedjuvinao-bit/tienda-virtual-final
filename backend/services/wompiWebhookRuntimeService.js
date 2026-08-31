'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const PaymentAttempt = require('../models/PaymentAttempt');
const StoreCreditUsage = require('../models/StoreCreditUsage');
function loadStoreCreditCheckoutService() {
  return require('./storeCreditCheckoutService');
}

function createWompiWebhookRuntimeService(options = {}) {
  const mongooseAdapter = options.mongooseAdapter || mongoose;
  const OrderModel = options.OrderModel || Order;
  const OrderEventModel = options.OrderEventModel || OrderEvent;
  const PaymentAttemptModel = options.PaymentAttemptModel || PaymentAttempt;
  const StoreCreditUsageModel = options.StoreCreditUsageModel || StoreCreditUsage;
  const inventory = options.inventoryReservationService ||
    require('./inventoryReservationService');
  const allocation = options.orderInventoryAllocationService ||
    require('./orderInventoryAllocationService');
  const paymentFailure = options.paymentInventoryFailureService ||
    require('./paymentInventoryFailureService');
  const integrity = options.wompiWebhookIntegrityService ||
    require('./wompiWebhookIntegrityService');
  const attemptModule = options.paymentAttemptModule ||
    require('./paymentAttemptService');
  const trimSafe = options.trimSafe ||
    require('./paymentRouteConfigurationService').trimSafe;
  const createOrderService = options.createWompiWebhookOrderService ||
    require('./wompiWebhookOrderService').createWompiWebhookOrderService;
  const attemptService =
    options.paymentAttemptService ||
    attemptModule.createPaymentAttemptService({
      mongooseAdapter,
      OrderModel,
      PaymentAttemptModel,
      StoreCreditUsageModel,
      OrderEventModel,
    });
  const durablePostCommitService =
    options.postCommitService ||
    require('./orderCreationPostCommitService')
      .createOrderCreationPostCommitService({ OrderModel });

  const orderService = createOrderService({
    mongooseAdapter,
    OrderModel,
    OrderEventModel,
    getStoreCreditCheckoutService:
      options.getStoreCreditCheckoutService || loadStoreCreditCheckoutService,
    createPaymentInventoryFailureService:
      paymentFailure.createPaymentInventoryFailureService,
    createWompiWebhookIntegrityService:
      integrity.createWompiWebhookIntegrityService,
    buildPaymentFailureReleaseReason:
      inventory.buildPaymentFailureReleaseReason,
    confirmInventoryReservation: inventory.confirmInventoryReservation,
    reconcilePaymentFailureReservation:
      inventory.reconcilePaymentFailureReservation,
    releaseInventoryReservation: inventory.releaseInventoryReservation,
    applyReservationToOrderDocument:
      allocation.applyReservationToOrderDocument,
    isApprovedPayment: integrity.isApprovedPayment,
    resolveMonotonicWompiTransition:
      integrity.resolveMonotonicWompiTransition,
    runPaymentInventoryTransaction:
      paymentFailure.runPaymentInventoryTransaction,
    postCommitService: durablePostCommitService,
    paymentAttemptService: attemptService,
    fingerprintPaymentMerchant: attemptModule.fingerprintPaymentMerchant,
    trimSafe,
  });

  return Object.freeze({
    orderService,
    paymentAttemptService: attemptService,
    postCommitService: durablePostCommitService,
  });
}

module.exports = { createWompiWebhookRuntimeService };
