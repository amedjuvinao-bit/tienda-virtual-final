'use strict';

const mongoose = require('mongoose');
const {
  SHIPPING_OPERATION_INDEX_DEFINITIONS,
} = require('./shippingOperationIndexDefinitions');

const ShippingOperationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    shipmentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    scope: {
      type: String,
      enum: ['outbound', 'return'],
      default: 'outbound',
      required: true,
    },
    returnCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderReturn',
      default: null,
    },
    activeLock: {
      type: Boolean,
      default: false,
    },
    provider: { type: String, trim: true, lowercase: true, required: true },
    mode: { type: String, enum: ['sandbox', 'production'], required: true },
    type: {
      type: String,
      enum: ['generate_label', 'schedule_pickup', 'cancel_label'],
      required: true,
    },
    idempotencyKey: { type: String, trim: true, required: true },
    requestHash: { type: String, trim: true, required: true },
    status: {
      type: String,
      enum: ['processing', 'succeeded', 'failed', 'action_required'],
      default: 'processing',
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

for (const definition of SHIPPING_OPERATION_INDEX_DEFINITIONS) {
  ShippingOperationSchema.index(
    { ...definition.key },
    { ...definition.options }
  );
}

module.exports =
  mongoose.models.ShippingOperation ||
  mongoose.model('ShippingOperation', ShippingOperationSchema);
