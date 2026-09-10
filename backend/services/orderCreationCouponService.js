'use strict';

const OrderEvent = require('../models/OrderEvent');
const couponService = require('./couponService');
const { getOrderCustomerEmail } = require('../lib/orders/orderCreationPayload');

async function recordNewOrderCoupon({ order, cleaned, quote, pricing, session }) {
  if (!quote.couponValidation?.valid || !order.coupon?.coupon) return null;

  const redemption = await couponService.recordCouponRedemption(
    {
      couponId: order.coupon.coupon,
      code: order.coupon.code,
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerId: order.customer?.customerId || null,
      customerEmail: getOrderCustomerEmail(cleaned),
      sessionId: cleaned.sessionId,
      source: 'checkout',
      subtotal: pricing.subtotal,
      shippingAmount: pricing.originalShipping,
      discount: {
        eligibleSubtotal:
          quote.couponValidation?.discount?.eligibleSubtotal || 0,
        discountAmount: pricing.productDiscount,
        shippingDiscountAmount: pricing.shippingDiscount,
        totalDiscountAmount: pricing.totalDiscount,
      },
    },
    {
      session,
      initialStatus:
        String(order.payment?.status || '').toLowerCase() === 'paid'
          ? 'applied'
          : 'reserved',
      source: 'order_creation',
    }
  );

  order.coupon.redemption = redemption?._id || null;
  await order.save({ session });
  await OrderEvent.create(
    [
      {
        orderId: order._id,
        type:
          String(redemption?.status || '').toLowerCase() === 'applied'
            ? 'coupon_applied'
            : 'coupon_reserved',
        message:
          String(redemption?.status || '').toLowerCase() === 'applied'
            ? `Cupón aplicado: ${order.coupon.code}`
            : `Cupón reservado: ${order.coupon.code}`,
        meta: {
          coupon: order.coupon.toObject
            ? order.coupon.toObject()
            : order.coupon,
          redemptionId: redemption?._id || null,
          subtotal: pricing.subtotal,
          productDiscount: pricing.productDiscount,
          originalShipping: pricing.originalShipping,
          shippingDiscount: pricing.shippingDiscount,
          finalShipping: pricing.shipping,
          taxableBase: pricing.subtotalAfterDiscount,
          taxAmount: pricing.tax.amount,
          finalTotal: pricing.total,
        },
      },
    ],
    { session }
  );

  return redemption;
}

module.exports = { recordNewOrderCoupon };
