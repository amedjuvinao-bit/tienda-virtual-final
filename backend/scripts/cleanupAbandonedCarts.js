'use strict';

const {
  RETENTION_DAYS,
  buildCartRetentionMatch,
  buildEligibleCartPipeline,
} = require('./previewAbandonedCartRetention');

async function deleteEligibleCart(candidate, { carts, orders, session, clock = () => new Date() }) {
  return session.withTransaction(async () => {
    const order = await orders.findOne(
      { sessionId: candidate.sessionId },
      { session, projection: { _id: 1 } }
    );
    if (order) return 0;

    const result = await carts.deleteOne(
      {
        ...buildCartRetentionMatch(clock()),
        _id: candidate._id,
        sessionId: candidate.sessionId,
      },
      { session }
    );
    return result.deletedCount;
  }, {
    readPreference: 'primary',
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  });
}

async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== '--apply') {
    console.error('Para ejecutar la limpieza, usa node backend/scripts/cleanupAbandonedCarts.js --apply');
    console.error('Para usar la simulación, ejecuta node backend/scripts/previewAbandonedCartRetention.js');
    process.exitCode = 1;
    return;
  }

  const { env } = require('../config/env');
  if (!env.mongoUri) {
    console.error('Configura la conexión de MongoDB en el entorno del backend.');
    process.exitCode = 1;
    return;
  }

  const mongoose = require('mongoose');
  const Cart = require('../models/Cart');
  const Order = require('../models/Order');
  const report = {
    mode: 'apply',
    status: 'interrupted',
    retentionDays: RETENTION_DAYS,
    checkedCarts: 0,
    deletedCarts: 0,
  };

  try {
    await mongoose.connect(env.mongoUri, {
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
    });

    const carts = mongoose.connection.db.collection(Cart.collection.name);
    const orders = mongoose.connection.db.collection(Order.collection.name);

    await mongoose.connection.getClient().withSession(async (session) => {
      const candidates = carts.aggregate(
        buildEligibleCartPipeline(new Date(), orders.name),
        { batchSize: 100, readPreference: 'primary', maxTimeMS: 60_000 }
      );
      try {
        for await (const candidate of candidates) {
          const deleted = await deleteEligibleCart(candidate, { carts, orders, session });
          report.checkedCarts += 1;
          report.deletedCarts += deleted;
        }
      } finally {
        await candidates.close();
      }
    });

    report.status = 'completed';
  } finally {
    console.log(JSON.stringify(report, null, 2));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('No se completó la limpieza de carritos.', error.code || error.name);
    process.exitCode = 1;
  });
}

module.exports = { deleteEligibleCart };
