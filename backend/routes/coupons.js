'use strict';

// backend/routes/coupons.js
const express = require('express');
const couponService = require('../services/couponService');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

function sendError(res, error, fallback = 'Error procesando cupón.') {
  const status = Number(error?.status || error?.statusCode || 500);
  return res.status(status).json({
    ok: false,
    error: error?.code || 'COUPON_ERROR',
    message: status >= 500 ? fallback : error?.message || fallback,
  });
}

router.post('/validate', async (req, res) => {
  try {
    const data = await couponService.validateCoupon(req.body || {});
    const publicData = couponService.serializePublicValidation(data);
    return res.status(publicData.valid ? 200 : 422).json({
      ok: publicData.valid === true,
      data: publicData,
    });
  } catch (error) {
    return sendError(res, error, 'No se pudo validar el cupón.');
  }
});

module.exports = router;
