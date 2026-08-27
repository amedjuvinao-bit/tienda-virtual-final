'use strict';

const mongoose = require('mongoose');
const {
  orderEventRecentIndexDefinition,
} = require('./orderActivityIndexDefinitions');

const OrderEventSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    type: { type: String, required: true },
    message: { type: String },
    meta: { type: Object },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

{
  const { key, options } = orderEventRecentIndexDefinition();
  OrderEventSchema.index(key, options);
}

module.exports =
  mongoose.models.OrderEvent ||
  mongoose.model('OrderEvent', OrderEventSchema, 'order_events');
