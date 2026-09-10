'use strict';

// backend/models/Coupon.js
const mongoose = require('mongoose');
const {
  COUPON_INDEX_DEFINITIONS,
} = require('./couponIndexDefinitions');

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
    },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },

    usageLimit: { type: Number, min: 0, default: null },
    usageCount: { type: Number, min: 0, default: 0 },
    perCustomerLimit: { type: Number, min: 0, default: null },

    appliesTo: {
      type: String,
      enum: COUPON_APPLIES_TO,
      default: 'all',
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
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

COUPON_INDEX_DEFINITIONS.forEach(({ key, options }) => {
  CouponSchema.index({ ...key }, { ...options });
});

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
  try {
    this.code = String(this.code || '').trim().toUpperCase();
    this.name = String(this.name || '').trim();
    this.description = String(this.description || '').trim();
    this.internalNotes = String(this.internalNotes || '').trim();

    this.categories = cleanStringArray(this.categories);
    this.excludedCategories = cleanStringArray(this.excludedCategories);
    this.tags = cleanStringArray(this.tags);
    this.active = this.status === 'active';

    const value = Number(this.value);
    if (!Number.isFinite(value)) {
      this.invalidate('value', 'El valor del cupón debe ser un número válido.');
    } else if (this.type === 'free_shipping') {
      this.value = 0;
    } else if (value <= 0) {
      this.invalidate('value', 'El valor del cupón debe ser mayor que cero.');
    } else if (this.type === 'percentage' && value > 100) {
      this.invalidate('value', 'El porcentaje del cupón no puede superar 100%.');
    }

    const minSubtotal = Number(this.minSubtotal);
    if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
      this.invalidate('minSubtotal', 'La compra mínima debe ser un número mayor o igual a cero.');
    }

    const usageCount = Number(this.usageCount);
    if (!Number.isInteger(usageCount) || usageCount < 0) {
      this.invalidate('usageCount', 'El contador de usos debe ser un número entero mayor o igual a cero.');
    }

    for (const field of ['usageLimit', 'perCustomerLimit']) {
      if (this[field] === null || this[field] === undefined) continue;
      const limit = Number(this[field]);
      if (!Number.isInteger(limit) || limit < 1) {
        this.invalidate(field, 'El límite debe ser un número entero mayor que cero.');
      }
    }

    if (this.type !== 'percentage') {
      this.maxDiscountAmount = null;
    } else if (this.maxDiscountAmount !== null && this.maxDiscountAmount !== undefined) {
      const maxDiscountAmount = Number(this.maxDiscountAmount);
      if (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount <= 0) {
        this.invalidate('maxDiscountAmount', 'El tope de descuento debe ser mayor que cero.');
      }
    }

    if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
      this.invalidate('endsAt', 'La fecha final debe ser posterior a la fecha inicial.');
    }
    if (this.appliesTo === 'products' && this.productIds.length === 0) {
      this.invalidate('productIds', 'Debes seleccionar al menos un producto.');
    }
    if (this.appliesTo === 'categories' && this.categories.length === 0) {
      this.invalidate('categories', 'Debes seleccionar al menos una categoría.');
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', CouponSchema);
module.exports.COUPON_TYPES = COUPON_TYPES;
module.exports.COUPON_STATUS = COUPON_STATUS;
module.exports.COUPON_APPLIES_TO = COUPON_APPLIES_TO;
