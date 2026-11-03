// backend/models/Subscriber.js
const mongoose = require('mongoose');

const proofSchema = require('./newsletterConsentProof');
const {EMAIL_INDEX_OPTIONS} = require('../services/newsletter/indexes');
const verificationSchema = new mongoose.Schema({
  nonce: String, hash: String, expiresAt: Date, sentAt: Date,
  attempts: { type: Number, default: 0 },
  intent: { type: String, enum: ['subscribe', 'withdraw'] },
  proof: proofSchema,
}, { _id: false });

const SubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    sessionId: {
      type: String,
      trim: true,
    },
    // Legacy records remain unknown; a historical email is not proof of consent.
    status: { type: String, enum: ['unknown', 'granted', 'withdrawn'], default: 'unknown', index: true },
    consent: { type: proofSchema, default: undefined },
    consentHistory: { type: [proofSchema], default: [] },
    verification: { type: verificationSchema, default: undefined, select: false },
    origen: {
      type: String,
      default: 'checkout',
      trim: true,
    },
    // Mantengo compatibilidad con tu campo `fecha`
    fecha: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false, timestamps: true }
);

// ✅ Validación: debe venir al menos uno (email o phone)
SubscriberSchema.path('email').validate(function (_v) {
  const hasEmail = !!(this.email && String(this.email).trim());
  const hasPhone = !!(this.phone && String(this.phone).trim());
  return hasEmail || hasPhone;
}, 'Debes proporcionar al menos un email o un teléfono.');

SubscriberSchema.path('phone').validate(function (_v) {
  const hasEmail = !!(this.email && String(this.email).trim());
  const hasPhone = !!(this.phone && String(this.phone).trim());
  return hasEmail || hasPhone;
}, 'Debes proporcionar al menos un email o un teléfono.');

// ✅ Índices:
// - Único por email (si existe)
// - Único por teléfono (si existe)
// - Búsquedas rápidas por sessionId
SubscriberSchema.index(
  { email: 1 },
  EMAIL_INDEX_OPTIONS
);

SubscriberSchema.index(
  { phone: 1 },
  { name: 'subscriber_phone_nonempty_unique_v1', unique: true, partialFilterExpression: { phone: { $type: 'string', $gt: '' } } }
);

SubscriberSchema.index({ sessionId: 1 });

module.exports =
  mongoose.models.Subscriber ||
  mongoose.model('Subscriber', SubscriberSchema, 'subscribers');
