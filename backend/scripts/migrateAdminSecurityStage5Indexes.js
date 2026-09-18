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

const INDEXES = [
  {
    keys: { fingerprint: 1 },
    options: { name: 'fingerprint_1', unique: true },
  },
  {
    keys: { status: 1, severity: 1, lastOccurredAt: -1 },
    options: { name: 'status_1_severity_1_lastOccurredAt_-1' },
  },
  {
    keys: { adminUser: 1, status: 1, lastOccurredAt: -1 },
    options: { name: 'adminUser_1_status_1_lastOccurredAt_-1' },
  },
  {
    keys: { username: 1, status: 1, lastOccurredAt: -1 },
    options: { name: 'username_1_status_1_lastOccurredAt_-1' },
  },
];

async function run() {
  if (!mongoUri) throw new Error('Falta MONGO_URI (o un alias compatible).');
  await mongoose.connect(mongoUri, { autoIndex: false });
  const databaseName = mongoose.connection.name;

  console.log(`Base de datos: ${databaseName}`);
  console.log(`Modo: ${APPLY ? 'APLICAR' : 'SOLO PLAN'}`);

  if (!APPLY) {
    INDEXES.forEach(({ keys, options }) => {
      console.log(`PLAN adminsecurityalerts.createIndex ${JSON.stringify(keys)} ${JSON.stringify(options)}`);
    });
    console.log('No se realizaron cambios. Usa --apply --confirm-db=NOMBRE para aplicar.');
    return;
  }

  if (!confirmedDatabase || confirmedDatabase !== databaseName) {
    throw new Error(`Confirma la base exacta con --confirm-db=${databaseName} antes de aplicar.`);
  }

  const collection = mongoose.connection.collection('adminsecurityalerts');
  for (const { keys, options } of INDEXES) {
    const indexName = await collection.createIndex(keys, options);
    console.log(`OK adminsecurityalerts.${indexName}`);
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
