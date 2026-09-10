'use strict';

const mongoose = require('mongoose');
const { env } = require('../config/env');
const migration = require('../services/couponIndexMigrationService');

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

module.exports = { ...migration, main };
