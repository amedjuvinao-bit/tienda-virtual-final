const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // ej: 'orderNumber', 'sku-VD-202508'
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

// ❌ Eliminamos el índice manual en _id (Mongo ya lo crea por defecto)

module.exports =
  mongoose.models.Counter ||
  mongoose.model('Counter', counterSchema, 'counters'); // colección explícita
