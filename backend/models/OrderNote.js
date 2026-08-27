'use strict';

const mongoose = require('mongoose');
const {
  orderNotePinnedRecentIndexDefinition,
} = require('./orderActivityIndexDefinitions');

const OrderNoteSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    text: { type: String, required: true, maxlength: 2000 },
    author: { name: String, id: String },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

{
  const { key, options } = orderNotePinnedRecentIndexDefinition();
  OrderNoteSchema.index(key, options);
}

module.exports =
  mongoose.models.OrderNote ||
  mongoose.model('OrderNote', OrderNoteSchema, 'order_notes');
