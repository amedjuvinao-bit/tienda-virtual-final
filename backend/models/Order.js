// backend/models/Order.js
const mongoose = require('mongoose');

const { createOrderSchema } = require('./order/orderSchema');
const { registerOrderHooks } = require('./order/registerOrderHooks');
const { registerOrderIndexes } = require('./order/registerOrderIndexes');

const OrderSchema = createOrderSchema();

registerOrderIndexes(OrderSchema);
registerOrderHooks(OrderSchema);

OrderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});
OrderSchema.set('toObject', { virtuals: true, versionKey: false });

module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
