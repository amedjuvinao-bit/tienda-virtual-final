'use strict';

// backend/models/CouponRedemption.js
const mongoose = require('mongoose');
const {
  COUPON_REDEMPTION_INDEX_DEFINITIONS,
} = require('./couponIndexDefinitions');

const CouponRedemptionSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    orderNumber: { type: String, trim: true, default: '' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerEmail: { type: String, trim: true, lowercase: true, default: '' },
    sessionId: { type: String, trim: true, default: '' },

    subtotal: { type: Number, min: 0, default: 0 },
    shippingAmount: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    shippingDiscountAmount: { type: Number, min: 0, default: 0 },
    totalDiscountAmount: { type: Number, min: 0, default: 0 },

    source: {
      type: String,
      enum: ['checkout', 'admin', 'pos', 'manual'],
      default: 'checkout',
    },
    status: {
      type: String,
      enum: ['reserved', 'applied', 'released', 'cancelled', 'refunded'],
      default: 'reserved',
    },
    meta: { type: Object, default: {} },
    reservedAt: { type: Date, default: Date.now },
    appliedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, trim: true, default: '' },
    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, trim: true, default: '' },
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, trim: true, default: '' },
    lifecycle: {
      type: [
        new mongoose.Schema(
          {
            from: { type: String, trim: true, default: '' },
            to: { type: String, trim: true, required: true },
            reason: { type: String, trim: true, default: '' },
            source: { type: String, trim: true, default: '' },
            at: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

COUPON_REDEMPTION_INDEX_DEFINITIONS.forEach(({ key, options }) => {
  CouponRedemptionSchema.index({ ...key }, { ...options });
});

module.exports =
  mongoose.models.CouponRedemption ||
  mongoose.model('CouponRedemption', CouponRedemptionSchema);
