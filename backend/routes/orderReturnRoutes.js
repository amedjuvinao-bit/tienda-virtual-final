'use strict';

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  getOrderReturns,
  patchOrderReturn,
  postOrderReturn,
  postReturnExchange,
  postReturnRefund,
} = require('../controllers/orderReturnController');

const router = express.Router();

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

module.exports = router;
