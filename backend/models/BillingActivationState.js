'use strict';

const mongoose = require('mongoose');

const BillingActivationStateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'main',
      immutable: true,
    },
    status: {
      type: String,
      enum: ['idle', 'activating', 'active', 'error'],
      default: 'idle',
    },
    provider: { type: String, default: 'factus' },
    environment: { type: String, default: '' },
    lockToken: { type: String, default: '', select: false },
    lockExpiresAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
    activatedBy: { type: String, default: '' },
    lastAttemptAt: { type: Date, default: null },
    lastAttemptBy: { type: String, default: '' },
    activationFingerprint: { type: String, default: '', select: false },
    companyNit: { type: String, default: '' },
    invoiceRangeId: { type: Number, default: 0 },
    creditNoteRangeId: { type: Number, default: 0 },
    mailFrom: { type: String, default: '' },
    lastErrorCode: { type: String, default: '' },
    lastErrorMessage: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'billing_activation_states',
  }
);

BillingActivationStateSchema.statics.getSingleton = async function getSingleton() {
  return this.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main', status: 'idle', provider: 'factus' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

module.exports =
  mongoose.models.BillingActivationState ||
  mongoose.model('BillingActivationState', BillingActivationStateSchema);
