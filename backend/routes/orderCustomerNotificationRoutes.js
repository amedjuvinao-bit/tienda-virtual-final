'use strict';

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  previewOrderWhatsApp,
  recordOrderWhatsAppOpened,
} = require('../controllers/orderCustomerNotificationController');

const router = express.Router();

router.get(
  '/:id/customer-notifications/whatsapp/preview',
  requireAdmin,
  requirePermission('orders:email'),
  previewOrderWhatsApp
);

router.post(
  '/:id/customer-notifications/whatsapp/opened',
  requireAdmin,
  requirePermission('orders:email'),
  recordOrderWhatsAppOpened
);

module.exports = router;
