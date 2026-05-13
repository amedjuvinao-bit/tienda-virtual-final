// backend/models/Favorite.js
const mongoose = require('mongoose');

const favoriteItemSchema = new mongoose.Schema({
  productId: String,   // si usas ObjectId en productos, puedes cambiarlo a mongoose.Schema.Types.ObjectId
  title: String,
  image: String,
  price: Number,
  color: String,
  size: String,
});

const favoriteSchema = new mongoose.Schema(
  {
    sessionId: String,   // id anónimo o del usuario si inicia sesión
    items: [favoriteItemSchema],
  },
  {
    timestamps: true,    // <-- crea createdAt y updatedAt automáticamente
  }
);

module.exports = mongoose.model('Favorite', favoriteSchema);
