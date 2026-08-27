'use strict';

async function createOrderEvent(OrderEventModel, payload, session) {
  if (!OrderEventModel) return;
  await OrderEventModel.create([payload], { session });
}

module.exports = { createOrderEvent };
