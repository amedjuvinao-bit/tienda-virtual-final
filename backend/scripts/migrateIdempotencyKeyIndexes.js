'use strict';

const mongoose = require('mongoose');
const { env } = require('../config/env');
const {
  IDEMPOTENCY_KEY_INDEX_DEFINITIONS,
} = require('../models/idempotencyKeyIndexDefinitions');
const {
  createCanonicalIndexMigration,
} = require('../services/indexMigrations/canonicalIndexMigration');

const APPLY_FLAG = '--apply-idempotency-key-index-migration';
const PRODUCTION_CONFIRMATION_FLAG =
  '--confirm-production-idempotency-key-index-migration';

const migration = createCanonicalIndexMigration({
  applyFlag: APPLY_FLAG,
  productionFlag: PRODUCTION_CONFIRMATION_FLAG,
  codePrefix: 'IDEMPOTENCY_KEY_INDEX_MIGRATION',
  collection: 'idempotency_keys',
  definitions: IDEMPOTENCY_KEY_INDEX_DEFINITIONS,
});

async function main(
  argv = process.argv.slice(2),
  {
    nodeEnv = env.nodeEnv,
    mongoUri = env.mongoUri,
    mongooseAdapter = mongoose,
    writeOutput = (value) => process.stdout.write(value),
  } = {}
) {
  const result = await migration.runMigration({
    argv,
    nodeEnv,
    mongoUri,
    mongooseAdapter,
  });
  writeOutput(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  main().catch(async (error) => {
    process.stderr.write(
      `${JSON.stringify({ ok: false, ...migration.safeError(error) })}\n`
    );
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => null);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_FLAG,
  PRODUCTION_CONFIRMATION_FLAG,
  ...migration,
  main,
};
