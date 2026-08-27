// backend/models/IdempotencyKey.js
const mongoose = require('mongoose');
const {
  IDEMPOTENCY_KEY_INDEX_DEFINITIONS,
} = require('./idempotencyKeyIndexDefinitions');

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
    },

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

    // payload mínimo que devolviste la 1ª vez
    response: { type: Object, default: null },

    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

for (const definition of IDEMPOTENCY_KEY_INDEX_DEFINITIONS) {
  IdempotencyKeySchema.index(
    { ...definition.key },
    { ...definition.options }
  );
}

module.exports =
  mongoose.models.IdempotencyKey ||
  mongoose.model('IdempotencyKey', IdempotencyKeySchema, 'idempotency_keys');
