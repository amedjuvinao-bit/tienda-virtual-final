'use strict';

const mongoose = require('mongoose');
const {
  MANUAL_PAYMENT_CONFIRMATION_INDEX_DEFINITIONS,
} = require('../services/manualPaymentConfirmation/indexDefinitions');

const MANUAL_PAYMENT_METHODS = ['cash', 'transfer', 'card', 'other'];

const ActorSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, required: true, maxlength: 120 },
    label: { type: String, trim: true, required: true, maxlength: 160 },
    role: { type: String, trim: true, lowercase: true, maxlength: 80 },
    source: { type: String, trim: true, lowercase: true, maxlength: 80 },
  },
  { _id: false }
);

const ManualPaymentConfirmationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    orderNumber: { type: String, trim: true, required: true, maxlength: 80 },
    provider: {
      type: String,
      enum: ['manual'],
      default: 'manual',
      immutable: true,
    },
    method: {
      type: String,
      enum: MANUAL_PAYMENT_METHODS,
      required: true,
    },
    methodLabel: { type: String, trim: true, required: true, maxlength: 120 },
    reference: { type: String, trim: true, required: true, maxlength: 160 },
    referenceKey: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 160,
    },
    amount: { type: Number, required: true, min: 0 },
    amountInCents: { type: Number, required: true, min: 1 },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      minlength: 3,
      maxlength: 3,
    },
    reason: { type: String, trim: true, required: true, maxlength: 500 },
    actor: { type: ActorSchema, required: true },
    confirmedAt: { type: Date, required: true },
    requestFingerprint: {
      type: String,
      trim: true,
      required: true,
      minlength: 64,
      maxlength: 64,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

for (const definition of MANUAL_PAYMENT_CONFIRMATION_INDEX_DEFINITIONS) {
  ManualPaymentConfirmationSchema.index(
    { ...definition.key },
    { ...definition.options }
  );
}

module.exports =
  mongoose.models.ManualPaymentConfirmation ||
  mongoose.model(
    'ManualPaymentConfirmation',
    ManualPaymentConfirmationSchema,
    'manual_payment_confirmations'
  );

module.exports.MANUAL_PAYMENT_METHODS = MANUAL_PAYMENT_METHODS;
