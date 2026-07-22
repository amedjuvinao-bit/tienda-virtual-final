'use strict';

const express = require('express');
const { buildOrderQuote } = require('../services/orderPricingService');

const router = express.Router();

function couponSnapshot(validation = null) {
  if (!validation?.valid) return null;
  const coupon = validation.coupon || {};
  return {
    id: coupon._id || coupon.id || '',
    code: coupon.code || '',
    name: coupon.name || '',
    type: coupon.type || '',
    value: Number(coupon.value || 0),
    message: validation.message || 'Cupón aplicado correctamente.',
  };
}

router.post('/quote', async (req, res) => {
  try {
    const quote = await buildOrderQuote({
      ...(req.body || {}),
      items: req.body?.items || req.body?.cart || [],
    });

    if (quote.couponCode && !quote.couponValidation?.valid) {
      return res.status(422).json({
        ok: false,
        error: quote.couponValidation?.code || 'COUPON_INVALID',
        message: quote.couponValidation?.message || 'El cupón no es válido.',
        coupon: couponSnapshot(quote.couponValidation),
        details: {
          code: quote.couponValidation?.code || 'COUPON_INVALID',
        },
        pricing: quote.pricing,
      });
    }

    return res.json({
      ok: true,
      coupon: couponSnapshot(quote.couponValidation),
      pricing: quote.pricing,
      items: quote.pricing.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || item.variantKey || '',
        quantity: item.quantity,
        price: item.price,
        lineSubtotal: item.lineSubtotal,
        discountAmount: item.discountAmount,
        taxableBase: item.taxableBase,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
      })),
    });
  } catch (error) {
    return res.status(Number(error?.statusCode || error?.status || 500)).json({
      ok: false,
      error: error?.code || 'ORDER_QUOTE_ERROR',
      message: error?.message || 'No se pudo calcular el total de la orden.',
      details: error?.details || null,
    });
  }
});

module.exports = router;
