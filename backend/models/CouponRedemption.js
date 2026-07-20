'use strict';

// backend/models/CouponRedemption.js
const mongoose = require('mongoose');

const CouponRedemptionSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    orderNumber: { type: String, trim: true, default: '', index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    customerEmail: { type: String, trim: true, lowercase: true, default: '', index: true },
    sessionId: { type: String, trim: true, default: '', index: true },

    subtotal: { type: Number, min: 0, default: 0 },
    shippingAmount: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    shippingDiscountAmount: { type: Number, min: 0, default: 0 },
    totalDiscountAmount: { type: Number, min: 0, default: 0 },

    source: {
      type: String,
      enum: ['checkout', 'admin', 'pos', 'manual'],
      default: 'checkout',
      index: true,
    },
    status: {
      type: String,
      enum: ['applied', 'cancelled', 'refunded'],
      default: 'applied',
      index: true,
    },
    meta: { type: Object, default: {} },
    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

CouponRedemptionSchema.index({ coupon: 1, order: 1 }, { unique: true, sparse: true });
CouponRedemptionSchema.index({ code: 1, customer: 1, status: 1 });
CouponRedemptionSchema.index({ code: 1, customerEmail: 1, status: 1 });

module.exports =
  mongoose.models.CouponRedemption ||
  mongoose.model('CouponRedemption', CouponRedemptionSchema);
