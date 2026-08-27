'use strict';

const mongoose = require('mongoose');
const {
  PAYMENT_ATTEMPT_INDEX_DEFINITIONS,
} = require('../services/paymentAttempts/indexDefinitions');

const PAYMENT_ATTEMPT_STATES = Object.freeze([
  'issued',
  'superseded',
  'approved',
  'declined',
  'cancelled',
  'error',
  'reconciliation_required',
]);

const StoreCreditAttemptSnapshotSchema = new mongoose.Schema(
  {
    applied: { type: Boolean, default: false },
    usage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreCreditUsage',
      default: null,
    },
    amountInCents: { type: Number, min: 0, default: 0 },
    statusAtIssue: { type: String, trim: true, lowercase: true, default: 'none' },
  },
  { _id: false }
);

const PaymentAttemptReconciliationSchema = new mongoose.Schema(
  {
    required: { type: Boolean, default: false },
    code: { type: String, trim: true, default: '', maxlength: 120 },
    message: { type: String, trim: true, default: '', maxlength: 500 },
    detectedAt: { type: Date, default: null },
    transactionId: { type: String, trim: true, default: '', maxlength: 160 },
    amountInCents: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: '' },
  },
  { _id: false }
);

const PaymentAttemptSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 40,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      maxlength: 90,
    },
    reference: {
      type: String,
      trim: true,
      required: true,
      maxlength: 220,
    },
    merchantFingerprint: {
      type: String,
      trim: true,
      default: '',
      maxlength: 128,
    },
    amountInCents: { type: Number, min: 1, required: true },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      maxlength: 12,
    },
    state: {
      type: String,
      enum: PAYMENT_ATTEMPT_STATES,
      default: 'issued',
    },
    active: { type: Boolean, default: true },
    issuedBySystem: { type: Boolean, default: true },
    transactionId: { type: String, trim: true, default: '', maxlength: 160 },
    providerStatus: { type: String, trim: true, default: '', maxlength: 80 },
    issuedAt: { type: Date, default: Date.now },
    supersededAt: { type: Date, default: null },
    finalizedAt: { type: Date, default: null },
    storeCredit: {
      type: StoreCreditAttemptSnapshotSchema,
      default: () => ({}),
    },
    reconciliation: {
      type: PaymentAttemptReconciliationSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

for (const definition of PAYMENT_ATTEMPT_INDEX_DEFINITIONS) {
  PaymentAttemptSchema.index(
    { ...definition.key },
    {
      ...definition.options,
      ...(definition.options.partialFilterExpression
        ? {
            partialFilterExpression: {
              ...definition.options.partialFilterExpression,
            },
          }
        : {}),
    }
  );
}

module.exports =
  mongoose.models.PaymentAttempt ||
  mongoose.model('PaymentAttempt', PaymentAttemptSchema, 'payment_attempts');
module.exports.PAYMENT_ATTEMPT_STATES = PAYMENT_ATTEMPT_STATES;
