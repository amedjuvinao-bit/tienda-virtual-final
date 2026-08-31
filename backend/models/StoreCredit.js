'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

function cleanText(value, maximum = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanUpper(value, maximum = 500) {
  return cleanText(value, maximum).toUpperCase();
}

function cleanMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

const StoreCreditSchema = new Schema(
  {
    creditNumber: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      unique: true,
      index: true,
      maxlength: 90,
    },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    customerKey: { type: String, trim: true, required: true, index: true, maxlength: 120 },
    customerEmailHash: { type: String, trim: true, default: '', index: true, maxlength: 64 },
    currency: { type: String, trim: true, uppercase: true, default: 'COP', maxlength: 12 },
    originalAmount: { type: Number, min: 0.01, required: true, set: cleanMoney },
    balance: { type: Number, min: 0, required: true, set: cleanMoney },
    status: {
      type: String,
      enum: ['active', 'depleted', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    sourceOrder: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    sourceOrderNumber: { type: String, trim: true, uppercase: true, default: '' },
    sourceReturn: {
      type: Schema.Types.ObjectId,
      ref: 'OrderReturn',
      required: true,
      unique: true,
      index: true,
    },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: {
      id: { type: Schema.Types.ObjectId, ref: 'AdminUser', default: null },
      label: { type: String, trim: true, default: '', maxlength: 160 },
      role: { type: String, trim: true, lowercase: true, default: '', maxlength: 80 },
    },
    revision: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

StoreCreditSchema.index({ customerKey: 1, status: 1, expiresAt: 1 });

StoreCreditSchema.pre('validate', function normalizeStoreCredit(next) {
  this.creditNumber = cleanUpper(this.creditNumber, 90);
  this.currency = cleanUpper(this.currency || 'COP', 12);
  this.sourceOrderNumber = cleanUpper(this.sourceOrderNumber, 90);
  this.customerKey = cleanText(this.customerKey, 120);
  this.customerEmailHash = cleanText(this.customerEmailHash, 64).toLowerCase();
  this.originalAmount = cleanMoney(this.originalAmount);
  this.balance = Math.min(this.originalAmount, cleanMoney(this.balance));
  if (this.balance <= 0 && this.status === 'active') this.status = 'depleted';
  next();
});

module.exports =
  mongoose.models.StoreCredit || mongoose.model('StoreCredit', StoreCreditSchema);
