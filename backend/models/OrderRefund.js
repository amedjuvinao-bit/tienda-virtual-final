// backend/models/OrderRefund.js

'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function cleanMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function cleanQuantity(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

const InventoryRestorationSchema = new Schema(
  {
    inventoryStock: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryStock',
      required: true,
    },
    inventoryMovement: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryMovement',
      required: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'default__default',
    },
    size: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      set: cleanQuantity,
    },
    bundleParentProduct: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
  },
  { _id: true }
);

const RefundItemSchema = new Schema(
  {
    orderItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    title: { type: String, trim: true, default: '' },
    productType: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'physical',
    },
    variantKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'default__default',
    },
    size: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    purchasedQuantity: {
      type: Number,
      required: true,
      min: 1,
      set: cleanQuantity,
    },
    returnedQuantity: {
      type: Number,
      required: true,
      min: 1,
      set: cleanQuantity,
    },
    restockedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: cleanQuantity,
    },
  },
  { _id: true }
);

const OrderRefundSchema = new Schema(
  {
    refundNumber: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      unique: true,
      index: true,
      maxlength: 80,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      required: true,
      maxlength: 200,
    },
    requestHash: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 128,
    },
    status: {
      type: String,
      enum: ['processing', 'processed', 'failed'],
      default: 'processing',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      set: cleanMoney,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'COP',
      maxlength: 8,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    items: {
      type: [RefundItemSchema],
      default: [],
    },
    inventoryRestorations: {
      type: [InventoryRestorationSchema],
      default: [],
    },
    totalReturnedUnits: {
      type: Number,
      default: 0,
      min: 0,
      set: cleanQuantity,
    },
    totalRestockedUnits: {
      type: Number,
      default: 0,
      min: 0,
      set: cleanQuantity,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
    },
    createdByLabel: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
    },
    processedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

OrderRefundSchema.index(
  { order: 1, idempotencyKey: 1 },
  { unique: true }
);
OrderRefundSchema.index({ order: 1, status: 1, createdAt: 1 });
OrderRefundSchema.index({
  order: 1,
  'items.orderItemId': 1,
  status: 1,
});

OrderRefundSchema.pre('validate', function normalizeRefund(next) {
  this.refundNumber = cleanUpper(this.refundNumber);
  this.orderNumber = cleanUpper(this.orderNumber);
  this.idempotencyKey = cleanText(this.idempotencyKey);
  this.requestHash = cleanText(this.requestHash).toLowerCase();
  this.currency = cleanUpper(this.currency || 'COP') || 'COP';
  this.reason = cleanText(this.reason);
  this.createdByLabel = cleanText(this.createdByLabel);
  this.amount = cleanMoney(this.amount);

  this.totalReturnedUnits = (this.items || []).reduce(
    (sum, item) => sum + cleanQuantity(item.returnedQuantity),
    0
  );
  this.totalRestockedUnits = (this.inventoryRestorations || []).reduce(
    (sum, item) => sum + cleanQuantity(item.quantity),
    0
  );

  next();
});

module.exports =
  mongoose.models.OrderRefund ||
  mongoose.model('OrderRefund', OrderRefundSchema);
