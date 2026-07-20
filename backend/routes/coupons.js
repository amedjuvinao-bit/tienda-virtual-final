'use strict';

// backend/routes/coupons.js
const express = require('express');
const couponService = require('../services/couponService');

const router = express.Router();

function sendError(res, error, fallback = 'Error procesando cupón.') {
  const status = Number(error?.status || error?.statusCode || 500);
  return res.status(status).json({
    ok: false,
    error: error?.code || 'COUPON_ERROR',
    message: error?.message || fallback,
  });
}

router.post('/validate', async (req, res) => {
  try {
    const data = await couponService.validateCoupon(req.body || {});
    return res.status(data.valid ? 200 : 422).json({
      ok: data.valid === true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'No se pudo validar el cupón.');
  }
});

module.exports = router;
