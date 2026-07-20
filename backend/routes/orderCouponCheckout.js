'use strict';

// backend/routes/orderCouponCheckout.js
// Middleware puntual para aplicar cupones cuando el checkout crea una orden.
const express = require('express');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const couponService = require('../services/couponService');

const router = express.Router();

const OrderEvent =
  mongoose.models.OrderEvent ||
  mongoose.model(
    'OrderEvent',
    new mongoose.Schema(
      {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true, required: true },
        type: { type: String, required: true },
        message: { type: String },
        meta: { type: Object },
      },
      { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
    ),
    'order_events'
  );

function numberSafe(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function moneySafe(value, fallback = 0) {
  return Math.max(0, numberSafe(value, fallback));
}

function getCouponCode(body = {}) {
  return couponService.normalizeCode(
    body?.coupon?.code ||
      body?.couponCode ||
      body?.discountCode ||
      body?.discount?.code ||
      ''
  );
}

function getCartItems(body = {}) {
  if (Array.isArray(body.cart)) return body.cart;
  if (Array.isArray(body.items)) return body.items;
  return [];
}

function getItemLineTotal(item = {}) {
  const explicit = numberSafe(item.lineTotal ?? item.total ?? item.subtotal, NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const qty = moneySafe(item.quantity ?? item.qty, 0);
  const price = moneySafe(item.price ?? item.unitPrice ?? item.priceNumber ?? item.product?.price, 0);
  return qty * price;
}

function calculateCartSubtotal(items = []) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + getItemLineTotal(item),
    0
  );
}

function getCustomerEmail(body = {}) {
  return String(
    body?.customer?.email ||
      body?.customer?.emailOrPhone ||
      body?.billing?.email ||
      ''
  )
    .trim()
    .toLowerCase();
}

function buildOrderCouponSnapshot(validation = {}, originalShipping = 0, finalShipping = 0) {
  const coupon = validation.coupon || {};
  const discount = validation.discount || {};

  return {
    coupon: coupon._id || coupon.id || null,
    code: coupon.code || '',
    type: coupon.type || '',
    value: Number(coupon.value || 0),
    name: coupon.name || '',
    discountAmount: moneySafe(discount.discountAmount, 0),
    shippingDiscountAmount: moneySafe(discount.shippingDiscountAmount, 0),
    totalDiscountAmount: moneySafe(discount.totalDiscountAmount, 0),
    originalShippingAmount: moneySafe(originalShipping, 0),
    finalShippingAmount: moneySafe(finalShipping, 0),
    status: 'applied',
    message: validation.message || 'Cupón aplicado correctamente.',
    appliedAt: new Date(),
  };
}

function buildCommercialDiscount(validation = {}) {
  const coupon = validation.coupon || {};
  const discount = validation.discount || {};
  const discountAmount = moneySafe(discount.discountAmount, 0);
  const shippingDiscountAmount = moneySafe(discount.shippingDiscountAmount, 0);
  const totalDiscountAmount = moneySafe(discount.totalDiscountAmount, 0);

  if (totalDiscountAmount <= 0) {
    return {
      type: 'none',
      value: 0,
      amount: 0,
      reason: '',
    };
  }

  return {
    type: coupon.type === 'percentage' ? 'percent' : 'amount',
    value: Number(coupon.value || 0),
    amount: totalDiscountAmount,
    reason:
      shippingDiscountAmount > 0 && discountAmount <= 0
        ? `Cupón ${coupon.code || ''} - envío gratis`
        : `Cupón ${coupon.code || ''}`,
  };
}

async function validateIncomingCoupon(req) {
  const body = req.body || {};
  const code = getCouponCode(body);
  if (!code) return null;

  const items = getCartItems(body);
  const subtotal = moneySafe(body.subtotal || calculateCartSubtotal(items), 0);
  const shippingAmount = moneySafe(body.shipping, 0);

  const validation = await couponService.validateCoupon({
    code,
    subtotal,
    shippingAmount,
    items,
    customerEmail: getCustomerEmail(body),
    sessionId: body.sessionId || req.headers['x-session-id'] || req.headers['X-Session-Id'] || '',
  });

  if (!validation?.valid) {
    const error = new Error(validation?.message || 'El cupón no es válido.');
    error.status = 422;
    error.statusCode = 422;
    error.code = validation?.code || 'COUPON_INVALID';
    error.details = validation || null;
    throw error;
  }

  return validation;
}

async function applyCouponToCreatedOrder({ orderId, validation, req }) {
  if (!orderId || !validation?.valid) return null;

  const order = await Order.findById(orderId);
  if (!order) return null;

  const discount = validation.discount || {};
  const coupon = validation.coupon || {};

  const currentSubtotal = moneySafe(order.subtotal ?? validation.totals?.subtotal, 0);
  const currentShipping = moneySafe(
    validation.totals?.shippingAmount ?? req.body?.shipping ?? order.shipping,
    0
  );
  const taxAmount = moneySafe(order.taxes?.iva?.amount, 0);
  const productDiscountAmount = moneySafe(discount.discountAmount, 0);
  const shippingDiscountAmount = moneySafe(discount.shippingDiscountAmount, 0);
  const totalDiscountAmount = moneySafe(discount.totalDiscountAmount, 0);
  const finalShipping = Math.max(0, currentShipping - shippingDiscountAmount);
  const finalTotal = Math.max(
    0,
    Math.round((currentSubtotal + taxAmount + finalShipping - productDiscountAmount) * 100) / 100
  );

  const couponSnapshot = buildOrderCouponSnapshot(validation, currentShipping, finalShipping);

  order.discount = buildCommercialDiscount(validation);
  order.shipping = finalShipping;
  order.total = finalTotal;

  if (order.payment && typeof order.payment === 'object') {
    order.payment.amount = finalTotal;
    order.payment.amountInCents = Math.round(finalTotal * 100);
  }

  await order.save();

  await Order.collection.updateOne(
    { _id: order._id },
    {
      $set: {
        coupon: couponSnapshot,
      },
    },
    { strict: false }
  );

  const redemption = await couponService.recordCouponRedemption({
    couponId: coupon._id || coupon.id,
    code: coupon.code,
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerEmail: getCustomerEmail(req.body || {}),
    sessionId: req.body?.sessionId || req.headers['x-session-id'] || '',
    source: 'checkout',
    subtotal: currentSubtotal,
    shippingAmount: currentShipping,
    discount,
  });

  if (redemption?._id) {
    await Order.collection.updateOne(
      { _id: order._id },
      {
        $set: {
          'coupon.redemption': redemption._id,
        },
      },
      { strict: false }
    );
  }

  await OrderEvent.create({
    orderId: order._id,
    type: 'coupon_applied',
    message: `Cupón aplicado: ${coupon.code || couponSnapshot.code}`,
    meta: {
      coupon: couponSnapshot,
      redemptionId: redemption?._id || null,
      subtotal: currentSubtotal,
      originalShipping: currentShipping,
      finalShipping,
      taxAmount,
      finalTotal,
    },
  });

  const updated = order.toObject ? order.toObject() : order;
  updated.coupon = {
    ...couponSnapshot,
    redemption: redemption?._id || null,
  };

  return updated;
}

router.use(async (req, res, next) => {
  if (req.method !== 'POST' || req.path !== '/') return next();

  let validation = null;

  try {
    validation = await validateIncomingCoupon(req);
  } catch (error) {
    return res.status(error.statusCode || error.status || 422).json({
      ok: false,
      error: 'COUPON_INVALID',
      code: error.code || 'COUPON_INVALID',
      message: error.message || 'El cupón no es válido.',
      details: error.details || null,
    });
  }

  if (!validation) return next();

  req.checkoutCouponValidation = validation;

  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    const statusCode = Number(res.statusCode || 200);
    const orderId = payload?._id || payload?.order?._id || '';

    if (statusCode < 200 || statusCode >= 300 || !orderId) {
      return originalJson(payload);
    }

    applyCouponToCreatedOrder({ orderId, validation, req })
      .then((updatedOrder) => {
        if (!updatedOrder) return originalJson(payload);

        return originalJson({
          ...payload,
          couponApplied: true,
          coupon: updatedOrder.coupon || null,
          discount: updatedOrder.discount || null,
          shipping: updatedOrder.shipping,
          total: updatedOrder.total,
        });
      })
      .catch((error) => {
        console.error('Error aplicando cupón a orden creada:', error);
        return originalJson(payload);
      });

    return undefined;
  };

  return next();
});

module.exports = router;
