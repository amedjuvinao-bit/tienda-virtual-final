'use strict';

const mongoose = require('mongoose');

async function createOrderEvent(OrderEventModel, payload, session) {
  if (!OrderEventModel) return;
  await OrderEventModel.create([payload], { session });
}

async function runInTransaction(work, externalSession = null) {
  if (externalSession) return work(externalSession);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  createOrderEvent,
  runInTransaction,
};
