'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const CashSession = require('../models/CashSession');
const IdempotencyKey = require('../models/IdempotencyKey');
const {
  beginPosSaleIdempotency,
  buildPosSaleIdempotency,
  completePosSaleIdempotency,
  inspectPosSaleIdempotency,
} = require('../services/posSaleIdempotencyService');

const MONGO_URI = String(process.env.POS_STAGE1_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'pos_stage1_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error('POS_STAGE1_MONGO_URI es obligatoria.');
  }

  const database = uri.split('?')[0].split('/').pop();
  if (database !== EXPECTED_DATABASE) {
    throw new Error(
      `La prueba solo puede ejecutarse en la base aislada ${EXPECTED_DATABASE}.`
    );
  }
}

async function main() {
  assertDedicatedDatabase(MONGO_URI);
  await mongoose.connect(MONGO_URI, { autoIndex: false });

  try {
    await Promise.all([
      IdempotencyKey.createIndexes(),
      CashSession.createIndexes(),
    ]);

    const descriptor = buildPosSaleIdempotency({
      key: 'pos-stage1-ci-transaction-0001',
      payload: {
        branchId: String(new mongoose.Types.ObjectId()),
        items: [{ productId: String(new mongoose.Types.ObjectId()), quantity: 1 }],
        payment: { method: 'cash', amount: 45000 },
      },
      admin: {
        id: String(new mongoose.Types.ObjectId()),
        username: 'cajero.ci',
      },
    });
    const orderId = new mongoose.Types.ObjectId();

    const transaction = await mongoose.startSession();
    try {
      await transaction.withTransaction(async () => {
        const record = await beginPosSaleIdempotency(descriptor, {
          session: transaction,
        });
        await completePosSaleIdempotency(
          record,
          descriptor,
          {
            order: { _id: orderId, orderNumber: 'CI-0001' },
            cashRegisterCode: 'CAJA CI',
          },
          { session: transaction }
        );
      });
    } finally {
      await transaction.endSession();
    }

    const reused = await inspectPosSaleIdempotency(descriptor);
    assert.equal(reused.action, 'reuse');
    assert.equal(String(reused.orderId), String(orderId));
    console.log('OK 01 la clave y la orden se confirman juntas en una transacción real');

    const abortedDescriptor = buildPosSaleIdempotency({
      key: 'pos-stage1-ci-aborted-0001',
      payload: { branchId: String(new mongoose.Types.ObjectId()), total: 90000 },
      admin: { id: String(new mongoose.Types.ObjectId()), username: 'cajero.abort' },
    });
    const abortedSession = await mongoose.startSession();
    try {
      abortedSession.startTransaction();
      await beginPosSaleIdempotency(abortedDescriptor, {
        session: abortedSession,
      });
      await abortedSession.abortTransaction();
    } finally {
      await abortedSession.endSession();
    }
    assert.equal(
      await IdempotencyKey.countDocuments({ key: abortedDescriptor.key }),
      0
    );
    console.log('OK 02 una venta abortada no deja bloqueos idempotentes huérfanos');

    const raceDescriptor = buildPosSaleIdempotency({
      key: 'pos-stage1-ci-race-0001',
      payload: { branchId: String(new mongoose.Types.ObjectId()), total: 125000 },
      admin: { id: String(new mongoose.Types.ObjectId()), username: 'cajero.race' },
    });
    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, () => beginPosSaleIdempotency(raceDescriptor))
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === 'fulfilled').length,
      1
    );
    assert.equal(
      attempts.filter(
        (attempt) =>
          attempt.status === 'rejected' &&
          attempt.reason?.code === 'POS_IDEMPOTENT_IN_PROGRESS'
      ).length,
      11
    );
    console.log('OK 03 doce intentos simultáneos crean un solo bloqueo de venta');

    const branchId = new mongoose.Types.ObjectId();
    const cashierId = new mongoose.Types.ObjectId();
    const cash = await CashSession.create({
      sessionCode: 'CAJA-CI-OPTIMISTIC-0001',
      branch: branchId,
      cashier: cashierId,
      cashRegisterCode: 'CAJA CI',
      openingAmount: 100000,
    });
    const [copyA, copyB] = await Promise.all([
      CashSession.findById(cash._id),
      CashSession.findById(cash._id),
    ]);
    copyA.openingNotes = 'Primera escritura';
    await copyA.save();
    copyB.openingNotes = 'Escritura obsoleta';
    await assert.rejects(copyB.save(), (error) => error?.name === 'VersionError');
    console.log('OK 04 MongoDB rechaza una escritura de caja basada en versión obsoleta');

    await assert.rejects(
      CashSession.create({
        sessionCode: 'CAJA-CI-DUPLICATE-0002',
        branch: branchId,
        cashier: new mongoose.Types.ObjectId(),
        cashRegisterCode: 'CAJA CI',
        status: 'open',
      }),
      (error) => Number(error?.code) === 11000
    );
    console.log('OK 05 solo puede existir una caja abierta por sede y terminal');

    const indexes = await IdempotencyKey.collection.indexes();
    assert.ok(
      indexes.some(
        (index) => index.name === 'key_1_endpoint_1' && index.unique === true
      )
    );
    assert.ok(
      indexes.some(
        (index) =>
          index.name === 'ttl_createdAt_48h' &&
          Number(index.expireAfterSeconds) === 172800
      )
    );
    console.log('OK 06 MongoDB tiene unicidad y caducidad física para las claves');

    console.log('\nIntegración Etapa 1 POS: 6/6 controles superados.');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('FAIL integración Etapa 1 POS');
  console.error(error);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => null);
  }
  process.exitCode = 1;
});
