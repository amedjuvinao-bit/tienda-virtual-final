'use strict';

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  sendOrderEmail,
} = require('../controllers/orderEmailController');

const router = express.Router();

router.post(
  '/:id/email',
  requireAdmin,
  requirePermission('orders:email'),
  sendOrderEmail
);

module.exports = router;
