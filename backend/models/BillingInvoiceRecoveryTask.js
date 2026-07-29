'use strict';

const mongoose = require('mongoose');

const BillingInvoiceRecoveryTaskSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ElectronicInvoice',
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    referenceCode: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'resolved', 'failed'],
      default: 'pending',
      index: true,
    },
    reason: { type: String, default: '' },
    source: { type: String, default: 'system' },
    attempts: { type: Number, default: 0 },
    confirmedNotFound: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastAttemptAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    lockToken: { type: String, default: '', select: false },
    lastError: { type: String, default: '' },
    providerNumber: { type: String, default: '' },
    providerCufe: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

BillingInvoiceRecoveryTaskSchema.index({ status: 1, nextAttemptAt: 1 });
BillingInvoiceRecoveryTaskSchema.index({ status: 1, lockedAt: 1 });

module.exports =
  mongoose.models.BillingInvoiceRecoveryTask ||
  mongoose.model('BillingInvoiceRecoveryTask', BillingInvoiceRecoveryTaskSchema);
