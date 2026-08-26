'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const RESOLUTION_TYPES = ['refund', 'exchange', 'store_credit'];
const SHIPPING_PAYER_TYPES = ['store', 'customer', 'case_by_case'];
const POLICY_SCOPE_TYPES = [
  'category',
  'product',
  'market',
  'commercial_condition',
];

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

function cleanMoney(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100);
}

function cleanList(values, maximum = 160, limit = 30) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => cleanLower(value, maximum))
        .filter(Boolean)
    )
  ).slice(0, limit);
}

const ReturnRiskControlsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    lookbackDays: { type: Number, min: 7, max: 730, default: 90 },
    reviewRequestCount: { type: Number, min: 1, max: 50, default: 3 },
    blockRequestCount: { type: Number, min: 2, max: 100, default: 8 },
    reviewUnitCount: { type: Number, min: 1, max: 500, default: 5 },
    reviewAmount: { type: Number, min: 0, default: 500000 },
    reviewRejectedCount: { type: Number, min: 1, max: 50, default: 2 },
    manualReviewOnMissingIdentity: { type: Boolean, default: true },
    manualReviewOnPolicyOverride: { type: Boolean, default: true },
  },
  { _id: false }
);

const ReturnPolicyRuleSchema = new Schema(
  {
    key: { type: String, trim: true, lowercase: true, required: true, maxlength: 80 },
    name: { type: String, trim: true, required: true, maxlength: 160 },
    enabled: { type: Boolean, default: true },
    priority: { type: Number, min: 0, max: 999, default: 0 },
    scope: {
      type: {
        type: String,
        enum: POLICY_SCOPE_TYPES,
        default: 'category',
      },
      values: { type: [String], default: [] },
    },
    returnable: { type: Boolean, default: true },
    windowDays: { type: Number, min: 1, max: 365, default: 30 },
    allowedResolutions: {
      type: [{ type: String, enum: RESOLUTION_TYPES }],
      default: () => ['refund', 'exchange'],
    },
    requireReasonText: { type: Boolean, default: false },
    requireManualReview: { type: Boolean, default: false },
    returnShippingPaidBy: {
      type: String,
      enum: SHIPPING_PAYER_TYPES,
      default: 'case_by_case',
    },
  },
  { _id: false }
);

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
    riskControls: {
      type: ReturnRiskControlsSchema,
      default: () => ({}),
    },
    rules: {
      type: [ReturnPolicyRuleSchema],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length <= 30;
        },
        message: 'La política admite máximo 30 reglas especiales.',
      },
    },
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
  if (!this.riskControls) this.riskControls = {};
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
  this.riskControls.lookbackDays = cleanInteger(
    this.riskControls.lookbackDays,
    90,
    7,
    730
  );
  this.riskControls.reviewRequestCount = cleanInteger(
    this.riskControls.reviewRequestCount,
    3,
    1,
    50
  );
  this.riskControls.blockRequestCount = cleanInteger(
    this.riskControls.blockRequestCount,
    8,
    2,
    100
  );
  if (this.riskControls.blockRequestCount <= this.riskControls.reviewRequestCount) {
    this.riskControls.blockRequestCount = Math.min(
      100,
      this.riskControls.reviewRequestCount + 1
    );
  }
  this.riskControls.reviewUnitCount = cleanInteger(
    this.riskControls.reviewUnitCount,
    5,
    1,
    500
  );
  this.riskControls.reviewAmount = cleanMoney(
    this.riskControls.reviewAmount,
    500000
  );
  this.riskControls.reviewRejectedCount = cleanInteger(
    this.riskControls.reviewRejectedCount,
    2,
    1,
    50
  );
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
  const seenRules = new Set();
  this.rules = (this.rules || [])
    .map((rule, index) => {
      rule.key = cleanLower(rule.key || `rule-${index + 1}`, 80)
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || `rule-${index + 1}`;
      rule.name = cleanText(rule.name || `Política especial ${index + 1}`, 160);
      rule.priority = cleanInteger(rule.priority, index + 1, 0, 999);
      if (!rule.scope) rule.scope = { type: 'category', values: [] };
      rule.scope.values = cleanList(rule.scope?.values, 160, 30);
      rule.windowDays = cleanInteger(rule.windowDays, this.windowDays, 1, 365);
      rule.allowedResolutions = Array.from(
        new Set(
          (rule.allowedResolutions || [])
            .map((item) => cleanLower(item, 40))
            .filter((item) => RESOLUTION_TYPES.includes(item))
        )
      );
      if (!rule.allowedResolutions.length) rule.allowedResolutions = ['refund'];
      return rule;
    })
    .filter((rule) => {
      if (!rule.scope.values.length || seenRules.has(rule.key)) return false;
      seenRules.add(rule.key);
      return true;
    })
    .sort((left, right) => right.priority - left.priority || left.key.localeCompare(right.key));
  next();
});

module.exports =
  mongoose.models.OrderReturnPolicy ||
  mongoose.model('OrderReturnPolicy', OrderReturnPolicySchema);

module.exports.RESOLUTION_TYPES = RESOLUTION_TYPES;
module.exports.SHIPPING_PAYER_TYPES = SHIPPING_PAYER_TYPES;
module.exports.POLICY_SCOPE_TYPES = POLICY_SCOPE_TYPES;
