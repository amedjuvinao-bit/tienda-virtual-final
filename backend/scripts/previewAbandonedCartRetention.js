'use strict';

const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function buildCartRetentionMatch(now) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
  return {
    sessionId: { $type: 'string', $ne: '' },
    convertedOrderId: null,
    convertedAt: null,
    items: {
      $elemMatch: {
        $or: [
          { qty: { $gte: 1 } },
          { qty: null, quantity: { $gte: 1 } },
        ],
      },
    },
    $and: [
      {
        $or: [
          { lastCustomerActivityAt: { $lte: cutoff } },
          { lastCustomerActivityAt: null, updatedAt: { $lte: cutoff } },
          { lastCustomerActivityAt: null, updatedAt: null, createdAt: { $lte: cutoff } },
        ],
      },
      {
        $or: [
          { 'recoveryAccess.expiresAt': null },
          { 'recoveryAccess.expiresAt': { $lte: now } },
          { 'recoveryAccess.usedAt': { $ne: null } },
        ],
      },
      {
        $or: [
          { recoveryEmailLockUntil: null },
          { recoveryEmailLockUntil: { $lte: now } },
        ],
      },
    ],
  };
}

function buildEligibleCartPipeline(now, orderCollection) {
  return [
    { $match: buildCartRetentionMatch(now) },
    { $project: { _id: 1, sessionId: 1 } },
    {
      $lookup: {
        from: orderCollection,
        localField: 'sessionId',
        foreignField: 'sessionId',
        pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }],
        as: 'linkedOrders',
      },
    },
    { $match: { 'linkedOrders.0': { $exists: false } } },
  ];
}

function buildCartRetentionPreview(now, orderCollection) {
  return [
    ...buildEligibleCartPipeline(now, orderCollection),
    { $count: 'eligibleCarts' },
  ];
}

async function main() {
  const { env } = require('../config/env');
  if (!env.mongoUri) {
    console.error('Configura la conexión de MongoDB en el entorno del backend.');
    process.exitCode = 1;
    return;
  }

  const mongoose = require('mongoose');
  const Cart = require('../models/Cart');
  const Order = require('../models/Order');

  try {
    await mongoose.connect(env.mongoUri, {
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
    });
    const now = new Date();
    const pipeline = buildCartRetentionPreview(now, Order.collection.name);
    const [result] = await Cart.aggregate(pipeline)
      .option({ maxTimeMS: 60_000 })
      .exec();
    const report = {
      mode: 'dry-run',
      retentionDays: RETENTION_DAYS,
      asOf: now.toISOString(),
      cutoff: new Date(now.getTime() - RETENTION_DAYS * DAY_MS).toISOString(),
      eligibleCarts: result?.eligibleCarts ?? 0,
    };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('No se completó la simulación de carritos.', error.code || error.name);
    process.exitCode = 1;
  });
}

module.exports = {
  RETENTION_DAYS,
  buildCartRetentionMatch,
  buildCartRetentionPreview,
  buildEligibleCartPipeline,
};
