'use strict';

const {
  RETENTION_DAYS,
  buildFavoriteRetentionMatch,
} = require('./previewInactiveFavoriteRetention');

async function deleteEligibleFavoriteList(candidate, { favorites, cutoff }) {
  const result = await favorites.deleteOne(
    { ...buildFavoriteRetentionMatch(cutoff), _id: candidate._id },
    { writeConcern: { w: 'majority' } }
  );
  return result.deletedCount;
}

async function cleanupEligibleFavoriteLists({ favorites, report, now = new Date() }) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const candidates = favorites.find(buildFavoriteRetentionMatch(cutoff), {
    projection: { _id: 1 },
    batchSize: 100,
    readPreference: 'primary',
    maxTimeMS: 60_000,
  });

  try {
    for await (const candidate of candidates) {
      const deleted = await deleteEligibleFavoriteList(candidate, { favorites, cutoff });
      report.checkedFavoriteLists += 1;
      report.deletedFavoriteLists += deleted;
    }
  } finally {
    await candidates.close();
  }
}

async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== '--apply') {
    console.error('Para ejecutar la limpieza, usa node backend/scripts/cleanupInactiveFavorites.js --apply');
    console.error('Para usar la simulación, ejecuta node backend/scripts/previewInactiveFavoriteRetention.js');
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
  const Favorite = require('../models/Favorite');
  const report = {
    mode: 'apply',
    status: 'interrupted',
    retentionDays: RETENTION_DAYS,
    checkedFavoriteLists: 0,
    deletedFavoriteLists: 0,
  };

  try {
    await mongoose.connect(env.mongoUri, {
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
    });

    const favorites = mongoose.connection.db.collection(Favorite.collection.name);
    await cleanupEligibleFavoriteLists({ favorites, report });
    report.status = 'completed';
  } finally {
    console.log(JSON.stringify(report, null, 2));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('No se completó la limpieza de favoritos.', error.code || error.name);
    process.exitCode = 1;
  });
}

module.exports = { cleanupEligibleFavoriteLists, deleteEligibleFavoriteList };
