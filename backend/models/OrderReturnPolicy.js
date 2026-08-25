'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const RESOLUTION_TYPES = ['refund', 'exchange', 'store_credit'];
const SHIPPING_PAYER_TYPES = ['store', 'customer', 'case_by_case'];

function cleanText(value, maximum = 2000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanLower(value, maximum = 2000) {
  return cleanText(value, maximum).toLowerCase();
}

function cleanInteger(value, fallback, minimum, maximum) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

const OrderReturnPolicySchema = new Schema(
  {
    key: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
      default: 'default',
    },
    enabled: { type: Boolean, default: true },
    customerPortalEnabled: { type: Boolean, default: true },
    windowDays: { type: Number, min: 1, max: 365, default: 30 },
    allowedResolutions: {
      type: [{ type: String, enum: RESOLUTION_TYPES }],
      default: () => [...RESOLUTION_TYPES],
    },
    requireReasonText: { type: Boolean, default: false },
    autoAuthorize: { type: Boolean, default: false },
    returnShippingPaidBy: {
      type: String,
      enum: SHIPPING_PAYER_TYPES,
      default: 'case_by_case',
    },
    instructions: { type: String, trim: true, default: '', maxlength: 1600 },
    policyText: { type: String, trim: true, default: '', maxlength: 4000 },
    storeCreditEnabled: { type: Boolean, default: true },
    storeCreditExpirationDays: { type: Number, min: 30, max: 1825, default: 365 },
    automaticExchangeEnabled: { type: Boolean, default: true },
    revision: { type: Number, min: 0, default: 0 },
    updatedBy: {
      id: { type: Schema.Types.ObjectId, ref: 'AdminUser', default: null },
      label: { type: String, trim: true, default: '', maxlength: 160 },
      role: { type: String, trim: true, lowercase: true, default: '', maxlength: 80 },
    },
  },
  { timestamps: true }
);

OrderReturnPolicySchema.pre('validate', function normalizePolicy(next) {
  this.key = cleanLower(this.key || 'default', 80);
  this.windowDays = cleanInteger(this.windowDays, 30, 1, 365);
  this.storeCreditExpirationDays = cleanInteger(
    this.storeCreditExpirationDays,
    365,
    30,
    1825
  );
  this.instructions = cleanText(this.instructions, 1600);
  this.policyText = cleanText(this.policyText, 4000);
  this.allowedResolutions = Array.from(
    new Set(
      (Array.isArray(this.allowedResolutions) ? this.allowedResolutions : [])
        .map((item) => cleanLower(item, 40))
        .filter((item) => RESOLUTION_TYPES.includes(item))
    )
  );
  if (!this.storeCreditEnabled) {
    this.allowedResolutions = this.allowedResolutions.filter(
      (item) => item !== 'store_credit'
    );
  }
  if (!this.allowedResolutions.length) this.allowedResolutions = ['refund'];
  next();
});

module.exports =
  mongoose.models.OrderReturnPolicy ||
  mongoose.model('OrderReturnPolicy', OrderReturnPolicySchema);

module.exports.RESOLUTION_TYPES = RESOLUTION_TYPES;
module.exports.SHIPPING_PAYER_TYPES = SHIPPING_PAYER_TYPES;
