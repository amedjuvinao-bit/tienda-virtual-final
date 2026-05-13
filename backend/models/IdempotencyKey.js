// backend/models/IdempotencyKey.js
const mongoose = require('mongoose');

const IdempotencyKeySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    endpoint: { type: String, required: true, trim: true },

    // Huella del payload procesado
    requestHash: { type: String, default: '' },

    // Estado real del ciclo de vida de la key
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      index: true,
    },

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

    // payload mínimo que devolviste la 1ª vez
    response: { type: Object, default: null },

    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

// Evita reusar la misma clave en el mismo endpoint
IdempotencyKeySchema.index({ key: 1, endpoint: 1 }, { unique: true });

// TTL: elimina automáticamente las claves después de 48h
IdempotencyKeySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 172800, name: 'ttl_createdAt_48h' }
);

module.exports =
  mongoose.models.IdempotencyKey ||
  mongoose.model('IdempotencyKey', IdempotencyKeySchema, 'idempotency_keys');