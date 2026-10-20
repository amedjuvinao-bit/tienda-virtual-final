'use strict';
const mongoose = require('mongoose');
const { env } = require('../config/env');
const { createCanonicalIndexMigration } = require('../services/indexMigrations/canonicalIndexMigration');
const Settings = require('../models/InstagramSettings');
const Pages = require('../models/InstagramFeedPage');
const APPLY_FLAG = '--apply-instagram-index-migration';
const PRODUCTION_CONFIRMATION_FLAG = '--confirm-production-instagram-index-migration';
const migrations = [Settings, Pages].map(model => createCanonicalIndexMigration({
  applyFlag: APPLY_FLAG, productionFlag: PRODUCTION_CONFIRMATION_FLAG,
  codePrefix: 'INSTAGRAM_INDEX_MIGRATION', collection: model.collection.name,
  definitions: model.schema.indexes().map(([key, options]) => ({ key, options: { ...options, name: options.name || Object.entries(key).map(([k,v]) => `${k}_${v}`).join('_') } })),
}));
async function main(argv = process.argv.slice(2), { nodeEnv = env.nodeEnv, mongoUri = env.mongoUri, mongooseAdapter = mongoose } = {}) {
  const results = [];
  for (const migration of migrations) results.push(await migration.runMigration({ argv, nodeEnv, mongoUri, mongooseAdapter }));
  return results;
}
if (require.main === module) main().then(results => process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)).catch(error => {
  process.stderr.write(`${JSON.stringify({ ok: false, ...migrations[0].safeError(error) })}\n`); process.exitCode = 1;
});
module.exports = { main, migrations, APPLY_FLAG, PRODUCTION_CONFIRMATION_FLAG };
