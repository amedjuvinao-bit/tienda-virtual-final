// backend/models/Subscriber.js
const mongoose = require('mongoose');

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
  { unique: true, partialFilterExpression: { email: { $type: 'string', $ne: '' } } }
);

SubscriberSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string', $ne: '' } } }
);

SubscriberSchema.index({ sessionId: 1 });

module.exports =
  mongoose.models.Subscriber ||
  mongoose.model('Subscriber', SubscriberSchema, 'subscribers');
