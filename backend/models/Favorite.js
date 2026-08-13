// backend/models/Favorite.js
'use strict';

const mongoose = require('mongoose');

const favoriteVariantAttributeSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, lowercase: true, default: '', maxlength: 80 },
    label: { type: String, trim: true, default: '', maxlength: 120 },
    value: { type: String, trim: true, default: '', maxlength: 160 },
  },
  { _id: false }
);

const favoriteItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    variantKey: { type: String, trim: true, lowercase: true, default: '', maxlength: 240 },
    variantLabel: { type: String, trim: true, default: '', maxlength: 180 },
    variantAttributes: { type: [favoriteVariantAttributeSchema], default: [] },
    title: { type: String, trim: true, required: true, maxlength: 220 },
    image: { type: String, trim: true, default: '', maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    slug: { type: String, trim: true, default: '', maxlength: 240 },
    sku: { type: String, trim: true, uppercase: true, default: '', maxlength: 100 },
    category: { type: String, trim: true, default: '', maxlength: 160 },
    color: { type: String, trim: true, default: '', maxlength: 120 },
    size: { type: String, trim: true, default: '', maxlength: 80 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const favoriteSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 120,
    },
    items: {
      type: [favoriteItemSchema],
      default: [],
      validate: [
        (items) => Array.isArray(items) && items.length <= 200,
        'La lista admite máximo 200 favoritos.',
      ],
    },
    lastCustomerActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

favoriteSchema.index({ sessionId: 1 }, { unique: true });
favoriteSchema.index({ updatedAt: -1, _id: -1 });
favoriteSchema.index({ 'items.productId': 1, updatedAt: -1 });

module.exports =
  mongoose.models.Favorite || mongoose.model('Favorite', favoriteSchema);
