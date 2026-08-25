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
