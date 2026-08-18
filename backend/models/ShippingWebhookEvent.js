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
      enum: ['received', 'processed', 'ignored', 'failed'],
      default: 'received',
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true, versionKey: false }
);

ShippingWebhookEventSchema.index(
  { provider: 1, eventId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.ShippingWebhookEvent ||
  mongoose.model('ShippingWebhookEvent', ShippingWebhookEventSchema);
