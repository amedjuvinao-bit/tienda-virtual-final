const mongoose = require('mongoose');

const { cleanMoney } = require('./normalizers');

const PaymentSplitSchema = new mongoose.Schema(
  {
    method: { type: String, trim: true, lowercase: true, default: '' },
    methodLabel: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0, min: 0, set: cleanMoney },
    reference: { type: String, trim: true, default: '' },
    receivedAmount: { type: Number, default: 0, min: 0, set: cleanMoney },
    changeAmount: { type: Number, default: 0, min: 0, set: cleanMoney },
  },
  { _id: false }
);

const ManualPaymentConfirmationSnapshotSchema = new mongoose.Schema(
  {
    evidence: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ManualPaymentConfirmation',
      required: true,
    },
    method: { type: String, trim: true, lowercase: true, required: true },
    reference: { type: String, trim: true, required: true, maxlength: 160 },
    amount: { type: Number, required: true, min: 0, set: cleanMoney },
    amountInCents: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      maxlength: 3,
    },
    reason: { type: String, trim: true, required: true, maxlength: 500 },
    actorId: { type: String, trim: true, required: true, maxlength: 120 },
    actorLabel: { type: String, trim: true, required: true, maxlength: 160 },
    actorRole: { type: String, trim: true, lowercase: true, maxlength: 80 },
    confirmedAt: { type: Date, required: true },
    requestFingerprint: {
      type: String,
      trim: true,
      required: true,
      minlength: 64,
      maxlength: 64,
    },
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: true },
    provider: {
      type: String,
      enum: [
        'bold',
        'wompi',
        'mercado-pago',
        'payu',
        'manual',
        'pos',
        'store_credit',
        '',
      ],
      default: '',
    },
    providerLabel: { type: String, default: '' },
    mode: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox',
    },
    currency: { type: String, default: 'COP' },
    checkoutLabel: { type: String, default: '' },
    enableWebhook: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending_gateway', 'pending_manual', 'paid', 'failed', 'cancelled'],
      default: 'pending_gateway',
    },
    methodType: { type: String, trim: true, default: '' },
    method: { type: String, trim: true, default: '' },
    methodLabel: { type: String, trim: true, default: '' },
    transactionId: { type: String, trim: true, default: '' },
    reference: { type: String, trim: true, default: '' },
    amountInCents: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date, default: null },
    receivedAmount: { type: Number, default: 0, min: 0, set: cleanMoney },
    changeAmount: { type: Number, default: 0, min: 0, set: cleanMoney },
    splitPayments: { type: [PaymentSplitSchema], default: [] },
    rawMethod: { type: Object, default: () => ({}) },
    manualConfirmation: {
      type: ManualPaymentConfirmationSnapshotSchema,
      default: undefined,
    },
    reviewRequired: { type: Boolean, default: false },
    reviewCode: { type: String, trim: true, default: '', maxlength: 120 },
    reviewMessage: { type: String, trim: true, default: '', maxlength: 500 },
    reviewTransactionId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
    },
    reviewDetectedAt: { type: Date, default: null },
  },
  { _id: false }
);

const StoreCreditOrderSnapshotSchema = new mongoose.Schema(
  {
    applied: { type: Boolean, default: false },
    usage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreCreditUsage',
      default: null,
      index: true,
    },
    amount: { type: Number, min: 0, default: 0, set: cleanMoney },
    currency: { type: String, trim: true, uppercase: true, default: 'COP' },
    status: {
      type: String,
      enum: ['none', 'reserved', 'consumed', 'released'],
      default: 'none',
    },
    references: { type: [String], default: [] },
    reservedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PaymentInventoryProcessingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'not_required', 'failed'],
      default: 'pending',
    },
    lastAttemptAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    errorCode: { type: String, trim: true, default: '' },
    errorMessage: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PaymentInvoiceProcessingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'scheduling', 'scheduled', 'not_required', 'failed'],
      default: 'pending',
    },
    claimId: { type: String, trim: true, default: '' },
    claimedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    transactionId: { type: String, trim: true, default: '' },
    outcomeCode: { type: String, trim: true, default: '' },
    errorCode: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PaymentFulfillmentProcessingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'not_required', 'failed'],
      default: 'pending',
    },
    claimId: { type: String, trim: true, default: '' },
    claimedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    outcomeCode: { type: String, trim: true, default: '' },
    errorCode: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PaymentProcessingSchema = new mongoose.Schema(
  {
    provider: { type: String, trim: true, lowercase: true, default: '' },
    approvedTransactionId: { type: String, trim: true, default: '' },
    approvedAt: { type: Date, default: null },
    inventory: {
      type: PaymentInventoryProcessingSchema,
      default: () => ({}),
    },
    fulfillment: {
      type: PaymentFulfillmentProcessingSchema,
      default: () => ({}),
    },
    invoice: {
      type: PaymentInvoiceProcessingSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

module.exports = {
  ManualPaymentConfirmationSnapshotSchema,
  PaymentProcessingSchema,
  PaymentSchema,
  StoreCreditOrderSnapshotSchema,
};
