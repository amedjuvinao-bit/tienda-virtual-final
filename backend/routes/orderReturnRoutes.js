'use strict';

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
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
} = require('../controllers/orderReturnController');
const {
  postReturnShippingDropoff,
  postReturnShippingLabel,
  postReturnShippingLabelCancel,
  postReturnShippingPickup,
  postReturnShippingRates,
  postReturnShippingTrackingSync,
  postReturnShippingWebhookTest,
} = require('../controllers/orderReturns/shippingController');

const router = express.Router();

router.get(
  '/returns/policy',
  requireAdmin,
  requirePermission('orders:view'),
  getReturnPolicy
);

router.put(
  '/returns/policy',
  requireAdmin,
  requirePermission('settings:store'),
  putReturnPolicy
);

router.get('/:id/returns/self-service', getCustomerOrderReturns);
router.post('/:id/returns/self-service', postCustomerOrderReturn);
router.patch(
  '/:id/returns/self-service/:returnId/cancel',
  cancelCustomerOrderReturn
);

router.post(
  '/:id/returns/:returnId/shipping/rates',
  requireAdmin,
  requirePermission('orders:returns'),
  postReturnShippingRates
);

router.post(
  '/:id/returns/:returnId/shipping/label',
  requireAdmin,
  requirePermission('orders:returns'),
  postReturnShippingLabel
);

router.post(
  '/:id/returns/:returnId/shipping/tracking/sync',
  requireAdmin,
  requirePermission('orders:returns'),
  postReturnShippingTrackingSync
);

router.post(
  '/:id/returns/:returnId/shipping/pickup',
  requireAdmin,
  requirePermission('orders:returns'),
  postReturnShippingPickup
);

router.post(
  '/:id/returns/:returnId/shipping/webhook/test',
  requireAdmin,
  requirePermission('orders:returns'),
  postReturnShippingWebhookTest
);

router.post(
  '/:id/returns/:returnId/shipping/handoff/dropoff',
  requireAdmin,
  requirePermission('orders:returns'),
  postReturnShippingDropoff
);

router.post(
  '/:id/returns/:returnId/shipping/label/cancel',
  requireAdmin,
  requirePermission('orders:returns'),
  postReturnShippingLabelCancel
);
router.get(
  '/:id/returns/self-service/:returnId/label',
  getCustomerReturnLabel
);

router.get(
  '/:id/returns',
  requireAdmin,
  requirePermission('orders:view'),
  getOrderReturns
);

router.post(
  '/:id/returns',
  requireAdmin,
  requirePermission('orders:returns'),
  postOrderReturn
);

router.patch(
  '/:id/returns/:returnId',
  requireAdmin,
  requirePermission('orders:returns'),
  patchOrderReturn
);

router.post(
  '/:id/returns/:returnId/refund',
  requireAdmin,
  requirePermission('orders:refund'),
  postReturnRefund
);

router.post(
  '/:id/returns/:returnId/exchange',
  requireAdmin,
  requirePermission('orders:returns'),
  postReturnExchange
);

router.post(
  '/:id/returns/:returnId/exchange/automatic',
  requireAdmin,
  requirePermission('orders:returns'),
  postReturnAutomaticExchange
);

router.post(
  '/:id/returns/:returnId/store-credit',
  requireAdmin,
  requirePermission('orders:refund'),
  postReturnStoreCredit
);

module.exports = router;
