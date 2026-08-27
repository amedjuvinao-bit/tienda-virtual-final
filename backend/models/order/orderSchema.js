const mongoose = require('mongoose');

const { createOrderCommerceFields } = require('./orderCommerceFields');
const { createOrderLifecycleFields } = require('./orderLifecycleFields');
const { createOrderSettlementFields } = require('./orderSettlementFields');

function createOrderSchema() {
  return new mongoose.Schema(
    {
      ...createOrderLifecycleFields(),
      ...createOrderCommerceFields(),
      ...createOrderSettlementFields(),
    },
    { timestamps: true }
  );
}

module.exports = { createOrderSchema };
