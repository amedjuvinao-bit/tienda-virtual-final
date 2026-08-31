'use strict';

const express = require('express');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const PaymentAttempt = require('../models/PaymentAttempt');
const StoreCreditUsage = require('../models/StoreCreditUsage');
const {
  createPayUCheckoutController,
} = require('../controllers/payu/payuCheckoutController');
const {
  createPayUWebhookController,
} = require('../controllers/payu/payuWebhookController');
const {
  getActivePaymentsConfig,
} = require('../services/paymentConfigurationAuthorityService');
const publicPaymentAccessService = require('../services/publicPaymentAccessService');
const payuConfigurationService = require('../services/payu/payuConfigurationService');
const payuPaymentAmountService = require('../services/payu/payuPaymentAmountService');
const payuSignatureService = require('../services/payu/payuSignatureService');
const payuInventoryService = require('../services/payu/payuInventoryService');
const {
  createPaymentAttemptService,
  fingerprintPaymentMerchant,
} = require('../services/paymentAttemptService');
const {
  createOrderCreationPostCommitService,
} = require('../services/orderCreationPostCommitService');

const router = express.Router();

function getStoreCreditCheckoutService() {
  return require('../services/storeCreditCheckoutService');
}

const paymentAttemptService = createPaymentAttemptService({
  mongooseAdapter: mongoose,
  OrderModel: Order,
  PaymentAttemptModel: PaymentAttempt,
  StoreCreditUsageModel: StoreCreditUsage,
  OrderEventModel: OrderEvent,
});

const paymentPostCommitService = createOrderCreationPostCommitService({
  OrderModel: Order,
});

const createCheckoutData = createPayUCheckoutController({
  OrderModel: Order,
  getActivePaymentsConfig,
  publicPaymentAccessService,
  configurationService: payuConfigurationService,
  paymentAttemptService,
  paymentAmountService: payuPaymentAmountService,
  fingerprintPaymentMerchant,
  signatureService: payuSignatureService,
});

const processWebhook = createPayUWebhookController({
  mongooseLib: mongoose,
  OrderModel: Order,
  OrderEventModel: OrderEvent,
  getActivePaymentsConfig,
  getStoreCreditCheckoutService,
  configurationService: payuConfigurationService,
  paymentAttemptService,
  fingerprintPaymentMerchant,
  signatureService: payuSignatureService,
  inventoryService: payuInventoryService,
  postCommitService: paymentPostCommitService,
});

router.post('/payu/checkout-data', createCheckoutData);
router.post(
  '/payu/webhook',
  express.urlencoded({ extended: true }),
  processWebhook
);

module.exports = router;
