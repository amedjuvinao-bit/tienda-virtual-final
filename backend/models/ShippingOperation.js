'use strict';

const mongoose = require('mongoose');

const ShippingOperationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    shipmentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    provider: { type: String, trim: true, lowercase: true, required: true },
    mode: { type: String, enum: ['sandbox', 'production'], required: true },
    type: {
      type: String,
      enum: ['generate_label', 'cancel_label'],
      required: true,
    },
    idempotencyKey: { type: String, trim: true, required: true, unique: true },
    requestHash: { type: String, trim: true, required: true },
    status: {
      type: String,
      enum: ['processing', 'succeeded', 'failed', 'action_required'],
      default: 'processing',
      index: true,
    },
    attempts: { type: Number, min: 1, default: 1 },
    providerReference: { type: String, trim: true, default: '' },
    trackingNumber: { type: String, trim: true, default: '' },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    error: {
      code: { type: String, trim: true, default: '' },
      message: { type: String, trim: true, maxlength: 500, default: '' },
    },
  },
  { timestamps: true, versionKey: false }
);

ShippingOperationSchema.index({ order: 1, shipmentId: 1, createdAt: -1 });

module.exports =
  mongoose.models.ShippingOperation ||
  mongoose.model('ShippingOperation', ShippingOperationSchema);
