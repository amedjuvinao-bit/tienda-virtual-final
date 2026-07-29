'use strict';

const express = require('express');

const {
  consumeDigitalDeliveryAccess,
} = require('../services/orderFulfillmentService');

const router = express.Router();

router.get('/:orderNumber/:deliveryId', async (req, res) => {
  res.set({
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });

  try {
    const result = await consumeDigitalDeliveryAccess({
      orderNumber: req.params.orderNumber,
      deliveryId: req.params.deliveryId,
      token: req.query.token,
    });

    return res.redirect(302, result.assetUrl);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || 'DIGITAL_DELIVERY_ERROR',
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : 'No fue posible abrir la descarga.',
    });
  }
});

module.exports = router;
