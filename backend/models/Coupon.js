'use strict';

// backend/models/Coupon.js
const mongoose = require('mongoose');

const COUPON_TYPES = ['percentage', 'fixed', 'free_shipping'];
const COUPON_STATUS = ['draft', 'active', 'inactive', 'expired'];
const COUPON_APPLIES_TO = ['all', 'products', 'categories'];

const AdminActorSchema = new mongoose.Schema(
  {
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    username: { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    name: { type: String, trim: true, maxlength: 120, default: '' },
    description: { type: String, trim: true, maxlength: 500, default: '' },

    type: {
      type: String,
      enum: COUPON_TYPES,
      required: true,
      default: 'percentage',
      index: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    maxDiscountAmount: { type: Number, min: 0, default: null },
    minSubtotal: { type: Number, min: 0, default: 0 },

    status: {
      type: String,
      enum: COUPON_STATUS,
      default: 'active',
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
    startsAt: { type: Date, default: null, index: true },
    endsAt: { type: Date, default: null, index: true },

    usageLimit: { type: Number, min: 0, default: null },
    usageCount: { type: Number, min: 0, default: 0 },
    perCustomerLimit: { type: Number, min: 0, default: null },

    appliesTo: {
      type: String,
      enum: COUPON_APPLIES_TO,
      default: 'all',
      index: true,
    },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    excludedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categories: [{ type: String, trim: true }],
    excludedCategories: [{ type: String, trim: true }],

    customerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
    newCustomersOnly: { type: Boolean, default: false },

    tags: [{ type: String, trim: true }],
    internalNotes: { type: String, trim: true, maxlength: 1000, default: '' },

    createdBy: { type: AdminActorSchema, default: null },
    updatedBy: { type: AdminActorSchema, default: null },
    deletedBy: { type: AdminActorSchema, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

CouponSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);
CouponSchema.index({ active: 1, status: 1, startsAt: 1, endsAt: 1 });
CouponSchema.index({ appliesTo: 1, categories: 1 });
CouponSchema.index({ productIds: 1 });

function cleanStringArray(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });

  return result;
}

CouponSchema.pre('validate', function normalizeCoupon(next) {
  this.code = String(this.code || '').trim().toUpperCase();
  this.name = String(this.name || '').trim();
  this.description = String(this.description || '').trim();
  this.internalNotes = String(this.internalNotes || '').trim();

  this.categories = cleanStringArray(this.categories);
  this.excludedCategories = cleanStringArray(this.excludedCategories);
  this.tags = cleanStringArray(this.tags);

  if (this.type === 'percentage') {
    this.value = Math.min(100, Math.max(0, Number(this.value || 0)));
  } else {
    this.value = Math.max(0, Number(this.value || 0));
  }

  this.minSubtotal = Math.max(0, Number(this.minSubtotal || 0));
  this.usageCount = Math.max(0, Number(this.usageCount || 0));

  if (this.usageLimit !== null && this.usageLimit !== undefined) {
    this.usageLimit = Math.max(0, Number(this.usageLimit || 0));
  }

  if (this.perCustomerLimit !== null && this.perCustomerLimit !== undefined) {
    this.perCustomerLimit = Math.max(0, Number(this.perCustomerLimit || 0));
  }

  if (this.maxDiscountAmount !== null && this.maxDiscountAmount !== undefined) {
    this.maxDiscountAmount = Math.max(0, Number(this.maxDiscountAmount || 0));
  }

  next();
});

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', CouponSchema);
module.exports.COUPON_TYPES = COUPON_TYPES;
module.exports.COUPON_STATUS = COUPON_STATUS;
module.exports.COUPON_APPLIES_TO = COUPON_APPLIES_TO;
