const mongoose = require('mongoose');

const { cleanMoney } = require('./normalizers');

const CouponSnapshotSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    redemption: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CouponRedemption',
      default: null,
    },
    code: { type: String, trim: true, uppercase: true, default: '' },
    type: { type: String, trim: true, lowercase: true, default: '' },
    value: { type: Number, min: 0, default: 0 },
    name: { type: String, trim: true, default: '' },
    discountAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    shippingDiscountAmount: {
      type: Number,
      min: 0,
      default: 0,
      set: cleanMoney,
    },
    totalDiscountAmount: {
      type: Number,
      min: 0,
      default: 0,
      set: cleanMoney,
    },
    originalShippingAmount: {
      type: Number,
      min: 0,
      default: 0,
      set: cleanMoney,
    },
    finalShippingAmount: {
      type: Number,
      min: 0,
      default: 0,
      set: cleanMoney,
    },
    status: { type: String, trim: true, lowercase: true, default: '' },
    message: { type: String, trim: true, default: '' },
    appliedAt: { type: Date, default: null },
  },
  { _id: false }
);

const PricingSnapshotSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 2 },
    currency: { type: String, trim: true, uppercase: true, default: 'COP' },
    subtotal: { type: Number, min: 0, default: 0, set: cleanMoney },
    productDiscount: { type: Number, min: 0, default: 0, set: cleanMoney },
    subtotalAfterDiscount: {
      type: Number,
      min: 0,
      default: 0,
      set: cleanMoney,
    },
    originalShipping: { type: Number, min: 0, default: 0, set: cleanMoney },
    shippingDiscount: { type: Number, min: 0, default: 0, set: cleanMoney },
    shipping: { type: Number, min: 0, default: 0, set: cleanMoney },
    totalDiscount: { type: Number, min: 0, default: 0, set: cleanMoney },
    taxableBase: { type: Number, min: 0, default: 0, set: cleanMoney },
    taxAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    total: { type: Number, min: 0, default: 0, set: cleanMoney },
  },
  { _id: false }
);

const PosMetadataSchema = new mongoose.Schema(
  {
    saleNumber: { type: String, trim: true, default: '' },
    receiptNumber: { type: String, trim: true, default: '' },
    terminalId: { type: String, trim: true, default: '' },
    registerCode: { type: String, trim: true, uppercase: true, default: '' },
    shiftCode: { type: String, trim: true, uppercase: true, default: '' },
    customerMode: {
      type: String,
      enum: ['guest', 'identified'],
      default: 'guest',
    },
    quickSale: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: '' },
    confirmedAt: { type: Date, default: null },
  },
  { _id: false }
);

module.exports = {
  CouponSnapshotSchema,
  PosMetadataSchema,
  PricingSnapshotSchema,
};
