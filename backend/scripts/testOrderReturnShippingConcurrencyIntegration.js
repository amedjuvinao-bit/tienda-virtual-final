/* eslint-disable no-console */
'use strict';

process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const ShippingOperation = require('../models/ShippingOperation');
const {
  reserveOperation,
} = require('../services/orderShipping/idempotencyState');

const SOURCE_URI =
  process.env.ORDERS_RETURN_SHIPPING_MONGO_URI ||
  process.env.MONGODB_REPLICA_URI ||
  process.env.MONGODB_URI ||
  '';
const RUN_ID = crypto.randomBytes(5).toString('hex');
const RACE_COUNT = Math.max(
  10,
  Math.min(100, Number(process.env.ORDERS_RETURN_SHIPPING_RACES || 30))
);

function isolatedMongoUri(uri) {
  const parsed = new URL(uri);
  parsed.pathname = `/orders_return_shipping_${RUN_ID}`;
  return parsed.toString();
}

function operationInput(index, ids) {
  const returnCase = { _id: ids.returnId };
  return {
    order: { _id: ids.orderId },
    shipment: returnCase,
    returnCase,
    scope: 'return',
    provider: { key: 'envia', mode: 'sandbox' },
    type: 'generate_label',
    idempotencyKey: `rma-race-${RUN_ID}-${String(index).padStart(3, '0')}`,
    requestPayload: {
      destinationBranchId: String(ids.branchId),
      packages: [{ weightGrams: 900, lengthCm: 30, widthCm: 20, heightCm: 12 }],
      rate: { carrier: 'coordinadora', service: 'standard' },
    },
  };
}

async function main() {
  if (!SOURCE_URI) {
    throw new Error(
      'Falta ORDERS_RETURN_SHIPPING_MONGO_URI para la prueba de concurrencia.'
    );
  }
  await mongoose.connect(isolatedMongoUri(SOURCE_URI), {
    serverSelectionTimeoutMS: 10000,
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert(hello.setName, 'La prueba exige MongoDB replica set, igual que Producción.');
  await ShippingOperation.init();

  const ids = {
    orderId: new mongoose.Types.ObjectId(),
    returnId: new mongoose.Types.ObjectId(),
    branchId: new mongoose.Types.ObjectId(),
  };
  const results = await Promise.allSettled(
    Array.from({ length: RACE_COUNT }, (_, index) =>
      reserveOperation(operationInput(index, ids))
    )
  );
  const winners = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');
  assert.equal(winners.length, 1, 'solo una operación externa puede adquirir el RMA');
  assert.equal(rejected.length, RACE_COUNT - 1);
  rejected.forEach((result) => {
    assert.equal(result.reason?.code, 'RETURN_SHIPPING_OPERATION_IN_PROGRESS');
  });
  assert.equal(
    await ShippingOperation.countDocuments({
      returnCase: ids.returnId,
      activeLock: true,
    }),
    1
  );

  const winner = winners[0].value.operation;
  winner.status = 'succeeded';
  winner.activeLock = false;
  await winner.save();

  const next = await reserveOperation(operationInput(RACE_COUNT + 1, ids));
  assert.equal(next.operation.activeLock, true);
  assert.equal(next.operation.status, 'processing');
  console.log(
    `OK: ${RACE_COUNT}/${RACE_COUNT} intentos simultáneos produjeron una sola operación externa activa.`
  );
  console.log('OK: al cerrar la operación, el RMA admite de forma controlada la siguiente.');
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  });
