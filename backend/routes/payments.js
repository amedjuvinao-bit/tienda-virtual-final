'use strict';

const express = require('express');
const mongoose = require('mongoose');

const SiteSettings = require('../models/SiteSettings');
const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const PaymentAttempt = require('../models/PaymentAttempt');
const StoreCreditUsage = require('../models/StoreCreditUsage');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  createPaymentPublicController,
} = require('../controllers/paymentPublicController');
const {
  createPaymentFiscalAdminController,
} = require('../controllers/paymentFiscalAdminController');
const {
  createWompiWebhookController,
} = require('../controllers/wompiWebhookController');
const {
  createPaymentRouteConfigurationService,
  trimSafe,
} = require('../services/paymentRouteConfigurationService');
const {
  createWompiPublicGatewayService,
} = require('../services/wompiPublicGatewayService');
const {
  createOrderCreationPostCommitService,
} = require('../services/orderCreationPostCommitService');
const {
  createWompiWebhookOrderService,
} = require('../services/wompiWebhookOrderService');
const {
  authorizeOrderAdminScope,
} = require('../services/orderAdminScopeService');
const {
  buildPaymentFailureReleaseReason,
  confirmInventoryReservation,
  reconcilePaymentFailureReservation,
  releaseInventoryReservation,
} = require('../services/inventoryReservationService');
const {
  applyReservationToOrderDocument,
} = require('../services/orderInventoryAllocationService');
const {
  issueElectronicInvoiceForOrder,
} = require('../services/electronicInvoiceIssuanceService');
const {
  createWompiWebhookIntegrityService,
  isApprovedPayment,
  resolveMonotonicWompiTransition,
} = require('../services/wompiWebhookIntegrityService');
const {
  createPaymentInventoryFailureService,
  isRetryablePaymentInventoryError,
  runPaymentInventoryTransaction,
} = require('../services/paymentInventoryFailureService');
const publicPaymentAccessService = require('../services/publicPaymentAccessService');
const {
  createPaymentAttemptService,
  fingerprintPaymentMerchant,
} = require('../services/paymentAttemptService');
const {
  deleteFactusBillByReference,
  getFactusCredentials,
  getFactusAccessToken,
} = require('../lib/dian/providers/factusProvider');
const {
  createOfficialCreditNote,
} = require('../services/electronicCreditNoteService');
const {
  linkRefundCreditNote,
} = require('../services/orderRefundReconciliationService');
const wompiPaymentUtils = require('../lib/payments/wompiPaymentUtils');

const router = express.Router();

function getStoreCreditCheckoutService() {
  return require('../services/storeCreditCheckoutService');
}

const paymentConfigurationService =
  createPaymentRouteConfigurationService({
    SiteSettingsModel: SiteSettings,
  });

const wompiPublicGatewayService = createWompiPublicGatewayService({
  fetchImpl: (...args) => fetch(...args),
});

const paymentAttemptService = createPaymentAttemptService({
  mongooseAdapter: mongoose,
  OrderModel: Order,
  PaymentAttemptModel: PaymentAttempt,
  StoreCreditUsageModel: StoreCreditUsage,
  OrderEventModel: OrderEvent,
});

const paymentPublicController = createPaymentPublicController({
  OrderModel: Order,
  getActivePaymentsConfig:
    paymentConfigurationService.getActivePaymentsConfig,
  trimSafe,
  resolveWompiBaseUrl: wompiPaymentUtils.resolveWompiBaseUrl,
  buildWompiReference: wompiPaymentUtils.buildWompiReference,
  amountToCents: wompiPaymentUtils.amountToCents,
  buildRedirectUrl: wompiPaymentUtils.buildRedirectUrl,
  buildIntegritySignature: wompiPaymentUtils.buildIntegritySignature,
  parseWompiTransactionStatus:
    wompiPaymentUtils.parseWompiTransactionStatus,
  publicPaymentAccessService,
  paymentAttemptService,
  fingerprintPaymentMerchant,
  wompiGatewayService: wompiPublicGatewayService,
});

const paymentPostCommitService = createOrderCreationPostCommitService({
  OrderModel: Order,
});

const wompiWebhookOrderService = createWompiWebhookOrderService({
  mongooseAdapter: mongoose,
  OrderModel: Order,
  OrderEventModel: OrderEvent,
  getStoreCreditCheckoutService,
  createPaymentInventoryFailureService,
  createWompiWebhookIntegrityService,
  buildPaymentFailureReleaseReason,
  confirmInventoryReservation,
  reconcilePaymentFailureReservation,
  releaseInventoryReservation,
  applyReservationToOrderDocument,
  isApprovedPayment,
  resolveMonotonicWompiTransition,
  runPaymentInventoryTransaction,
  postCommitService: paymentPostCommitService,
  paymentAttemptService,
  fingerprintPaymentMerchant,
  trimSafe,
});

const wompiWebhookController = createWompiWebhookController({
  OrderModel: Order,
  getActivePaymentsConfig:
    paymentConfigurationService.getActivePaymentsConfig,
  wompiWebhookOrderService,
  amountToCents: wompiPaymentUtils.amountToCents,
  buildWompiEventChecksum: wompiPaymentUtils.buildWompiEventChecksum,
  extractOrderNumberFromWompiReference:
    wompiPaymentUtils.extractOrderNumberFromWompiReference,
  getWompiProvidedChecksum: wompiPaymentUtils.getWompiProvidedChecksum,
  parseWompiTransactionStatus:
    wompiPaymentUtils.parseWompiTransactionStatus,
  trimSafe,
  isRetryablePaymentInventoryError,
});

const paymentFiscalAdminController = createPaymentFiscalAdminController({
  OrderModel: Order,
  OrderEventModel: OrderEvent,
  ElectronicInvoiceModel: ElectronicInvoice,
  authorizeOrderAdminScope,
  getSiteSettingsDoc: paymentConfigurationService.getSiteSettingsDoc,
  deleteFactusBillByReference,
  getFactusCredentials,
  getFactusAccessToken,
  createOfficialCreditNote,
  linkRefundCreditNote,
  issueElectronicInvoiceForOrder,
  trimSafe,
});

router.get('/public-config', paymentPublicController.getPublicConfig);
router.post(
  '/wompi/checkout-data',
  paymentPublicController.createWompiCheckoutData
);
router.get(
  '/wompi/transaction/:transactionId',
  paymentPublicController.getWompiTransaction
);
router.post(
  '/admin/wompi/test-merchant',
  requireAdmin,
  requirePermission('settings:payments'),
  paymentPublicController.testWompiMerchant
);
router.post('/wompi/webhook', wompiWebhookController.handleWompiWebhook);
router.post(
  '/admin/delete-factus-invoice/:orderId',
  requireAdmin,
  requirePermission('billing:retry'),
  paymentFiscalAdminController.deleteFactusInvoice
);
router.post(
  '/admin/create-credit-note/:orderId',
  requireAdmin,
  requirePermission('billing:credit_note'),
  paymentFiscalAdminController.createCreditNoteForOrder
);
router.post(
  '/admin/retry-electronic-invoice/:orderId',
  requireAdmin,
  requirePermission('billing:retry'),
  paymentFiscalAdminController.retryElectronicInvoice
);

module.exports = router;
