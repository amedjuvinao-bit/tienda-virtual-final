'use strict';

const mongoose = require('mongoose');

const ShippingWebhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, trim: true, lowercase: true, required: true },
    eventId: { type: String, trim: true, required: true },
    eventType: { type: String, trim: true, required: true },
    providerTimestamp: { type: Date, required: true },
    status: {
      type: String,
      enum: ['received', 'processing', 'processed', 'ignored', 'failed'],
      default: 'received',
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    shipmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    returnCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderReturn',
      default: null,
    },
    processedAt: { type: Date, default: null },
    attempts: { type: Number, min: 0, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true, versionKey: false }
);

ShippingWebhookEventSchema.index(
  { provider: 1, eventId: 1 },
  { unique: true }
);
ShippingWebhookEventSchema.index({ status: 1, updatedAt: 1 });

module.exports =
  mongoose.models.ShippingWebhookEvent ||
  mongoose.model('ShippingWebhookEvent', ShippingWebhookEventSchema);
