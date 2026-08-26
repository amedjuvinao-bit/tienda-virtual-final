'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

function cleanText(value, maximum = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

const StoreCreditAllocationSchema = new Schema(
  {
    credit: {
      type: Schema.Types.ObjectId,
      ref: 'StoreCredit',
      required: true,
    },
    creditNumber: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      maxlength: 90,
    },
    amount: { type: Number, min: 0.01, required: true, set: cleanMoney },
    balanceBefore: { type: Number, min: 0, required: true, set: cleanMoney },
    balanceAfter: { type: Number, min: 0, required: true, set: cleanMoney },
  },
  { _id: false }
);

const StoreCreditUsageSchema = new Schema(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      index: true,
      maxlength: 90,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    customerKey: {
      type: String,
      trim: true,
      required: true,
      index: true,
      maxlength: 120,
    },
    sessionId: { type: String, trim: true, required: true, maxlength: 120 },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'COP',
      maxlength: 12,
    },
    amount: { type: Number, min: 0.01, required: true, set: cleanMoney },
    status: {
      type: String,
      enum: ['reserved', 'consumed', 'released'],
      default: 'reserved',
      index: true,
    },
    allocations: {
      type: [StoreCreditAllocationSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'El uso debe conservar al menos una asignación de saldo.',
      },
    },
    reservedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, trim: true, default: '', maxlength: 500 },
    revision: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

StoreCreditUsageSchema.index({ status: 1, expiresAt: 1 });
StoreCreditUsageSchema.index({ customer: 1, status: 1, createdAt: -1 });

StoreCreditUsageSchema.pre('validate', function normalizeUsage(next) {
  this.orderNumber = cleanText(this.orderNumber, 90).toUpperCase();
  this.customerKey = cleanText(this.customerKey, 120);
  this.sessionId = cleanText(this.sessionId, 120);
  this.currency = cleanText(this.currency || 'COP', 12).toUpperCase();
  this.amount = cleanMoney(this.amount);
  this.releaseReason = cleanText(this.releaseReason, 500);
  next();
});

module.exports =
  mongoose.models.StoreCreditUsage ||
  mongoose.model('StoreCreditUsage', StoreCreditUsageSchema);
