'use strict';

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const APPLY = process.argv.includes('--apply');
const confirmArgument = process.argv.find((value) => value.startsWith('--confirm-db='));
const confirmedDatabase = confirmArgument ? confirmArgument.split('=').slice(1).join('=') : '';
const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL ||
  '';

const REQUIRED_INDEXES = [
  {
    keys: { challengeId: 1 },
    options: { unique: true, name: 'challengeId_1' },
  },
  {
    keys: { expiresAt: 1 },
    options: { expireAfterSeconds: 0, name: 'expiresAt_1' },
  },
  {
    keys: { adminUser: 1, consumedAt: 1, expiresAt: 1 },
    options: { name: 'adminUser_1_consumedAt_1_expiresAt_1' },
  },
];

async function run() {
  if (!mongoUri) throw new Error('Falta MONGO_URI (o un alias compatible).');

  await mongoose.connect(mongoUri, { autoIndex: false });
  const databaseName = mongoose.connection.name;

  console.log(`Base de datos: ${databaseName}`);
  console.log(`Modo: ${APPLY ? 'APLICAR' : 'SOLO PLAN'}`);
  console.log('Colección: admintwofactorchallenges');

  if (!APPLY) {
    REQUIRED_INDEXES.forEach(({ keys, options }) => {
      console.log(`PLAN createIndex ${JSON.stringify(keys)} ${JSON.stringify(options)}`);
    });
    console.log('No se realizaron cambios. Usa --apply --confirm-db=NOMBRE para aplicar.');
    return;
  }

  if (!confirmedDatabase || confirmedDatabase !== databaseName) {
    throw new Error(
      `Confirma la base exacta con --confirm-db=${databaseName} antes de aplicar.`
    );
  }

  const collection = mongoose.connection.collection('admintwofactorchallenges');
  for (const { keys, options } of REQUIRED_INDEXES) {
    const indexName = await collection.createIndex(keys, options);
    console.log(`OK ${indexName}`);
  }
}

run()
  .catch((error) => {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
