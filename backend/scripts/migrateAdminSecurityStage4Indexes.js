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

const COLLECTIONS = [
  {
    name: 'adminsessions',
    indexes: [
      {
        keys: { adminUser: 1, deviceIdHash: 1, createdAt: -1 },
        options: { name: 'adminUser_1_deviceIdHash_1_createdAt_-1' },
      },
      {
        keys: { adminUser: 1, lastSeenAt: -1 },
        options: { name: 'adminUser_1_lastSeenAt_-1' },
      },
    ],
  },
  {
    name: 'adminloginaudits',
    indexes: [
      {
        keys: { username: 1, status: 1, createdAt: -1 },
        options: { name: 'username_1_status_1_createdAt_-1' },
      },
    ],
  },
];

async function run() {
  if (!mongoUri) throw new Error('Falta MONGO_URI (o un alias compatible).');

  await mongoose.connect(mongoUri, { autoIndex: false });
  const databaseName = mongoose.connection.name;

  console.log(`Base de datos: ${databaseName}`);
  console.log(`Modo: ${APPLY ? 'APLICAR' : 'SOLO PLAN'}`);

  if (!APPLY) {
    COLLECTIONS.forEach(({ name, indexes }) => {
      indexes.forEach(({ keys, options }) => {
        console.log(`PLAN ${name}.createIndex ${JSON.stringify(keys)} ${JSON.stringify(options)}`);
      });
    });
    console.log('No se realizaron cambios. Usa --apply --confirm-db=NOMBRE para aplicar.');
    return;
  }

  if (!confirmedDatabase || confirmedDatabase !== databaseName) {
    throw new Error(
      `Confirma la base exacta con --confirm-db=${databaseName} antes de aplicar.`
    );
  }

  for (const { name, indexes } of COLLECTIONS) {
    const collection = mongoose.connection.collection(name);
    for (const { keys, options } of indexes) {
      const indexName = await collection.createIndex(keys, options);
      console.log(`OK ${name}.${indexName}`);
    }
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
