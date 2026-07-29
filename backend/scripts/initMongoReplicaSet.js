/* eslint-disable no-console */

'use strict';

const mongoose = require('mongoose');

const DIRECT_URI =
  process.env.MONGODB_DIRECT_URI ||
  'mongodb://127.0.0.1:27017/admin?directConnection=true';
const REPLICA_URI =
  process.env.MONGODB_REPLICA_URI ||
  'mongodb://127.0.0.1:27017/admin?replicaSet=rs0';

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function initiateReplicaSet() {
  const direct = await mongoose
    .createConnection(DIRECT_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();

  try {
    await direct.db.admin().command({
      replSetInitiate: {
        _id: 'rs0',
        members: [
          {
            _id: 0,
            host: '127.0.0.1:27017',
          },
        ],
      },
    });
    console.log('MongoDB replica set rs0 iniciado.');
  } catch (error) {
    if (
      ![23, 93].includes(Number(error?.code)) &&
      !/already initialized|already initiated/i.test(
        String(error?.message || '')
      )
    ) {
      throw error;
    }
    console.log('MongoDB replica set rs0 ya estaba iniciado.');
  } finally {
    await direct.close();
  }
}

async function waitForPrimary() {
  let lastError = null;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const connection = mongoose.createConnection(REPLICA_URI, {
      serverSelectionTimeoutMS: 1000,
    });
    try {
      await connection.asPromise();
      const hello = await connection.db.admin().command({
        hello: 1,
      });
      if (hello.isWritablePrimary === true) {
        await connection.close();
        console.log('MongoDB replica set rs0 listo para transacciones.');
        return;
      }
    } catch (error) {
      lastError = error;
    } finally {
      if (connection.readyState !== 0) {
        await connection.close().catch(() => {});
      }
    }
    await wait(1000);
  }

  throw new Error(
    `MongoDB no eligió un primario: ${lastError?.message || 'tiempo agotado'}`
  );
}

async function run() {
  await initiateReplicaSet();
  await waitForPrimary();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
