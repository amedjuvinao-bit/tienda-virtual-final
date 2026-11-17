'use strict';

const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function buildFavoriteRetentionMatch(cutoff) {
  return {
    'items.0': { $exists: true },
    $or: [
      { lastCustomerActivityAt: { $lte: cutoff } },
      { lastCustomerActivityAt: null, updatedAt: { $lte: cutoff } },
      { lastCustomerActivityAt: null, updatedAt: null, createdAt: { $lte: cutoff } },
    ],
  };
}

async function main() {
  const { env } = require('../config/env');
  if (!env.mongoUri) {
    console.error('Configura la conexión de MongoDB en el entorno del backend.');
    process.exitCode = 1;
    return;
  }

  const mongoose = require('mongoose');
  const Favorite = require('../models/Favorite');

  try {
    await mongoose.connect(env.mongoUri, {
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
    });
    const now = new Date();
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
    const eligibleFavoriteLists = await Favorite.countDocuments(buildFavoriteRetentionMatch(cutoff))
      .maxTimeMS(60_000)
      .exec();

    console.log(JSON.stringify({
      mode: 'dry-run',
      retentionDays: RETENTION_DAYS,
      asOf: now.toISOString(),
      cutoff: cutoff.toISOString(),
      eligibleFavoriteLists,
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('No se completó la simulación de favoritos.', error.code || error.name);
    process.exitCode = 1;
  });
}

module.exports = { buildFavoriteRetentionMatch };
