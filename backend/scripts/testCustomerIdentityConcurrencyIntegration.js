'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Customer = require('../models/Customer');

const MONGO_URI = String(process.env.CUSTOMERS_TEST_MONGO_URI || '').trim();
const EXPECTED_DATABASE = 'customers_ci';

function assertDedicatedDatabase(uri) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error('CUSTOMERS_TEST_MONGO_URI es obligatoria.');
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
    await Customer.createIndexes();

    const simultaneous = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) =>
        Customer.create({
          fullName: `Cliente concurrente ${index + 1}`,
          phone:
            index % 3 === 0
              ? '300 123 4567'
              : index % 3 === 1
                ? '+57 300 123 4567'
                : '57 300 123 4567',
          email: `concurrente-${index + 1}@example.com`,
          documentType: 'PP',
          documentNumber: `RACE-${index + 1}`,
          source: 'admin',
          status: 'active',
        })
      )
    );
    const created = simultaneous.filter((result) => result.status === 'fulfilled');
    const rejected = simultaneous.filter((result) => result.status === 'rejected');

    assert.equal(created.length, 1);
    assert.equal(rejected.length, 19);
    assert.ok(rejected.every((result) => Number(result.reason?.code) === 11000));
    console.log('OK 01 veinte escrituras simultáneas producen una sola identidad telefónica');

    const [passportA, passportB] = await Promise.all([
      Customer.create({
        fullName: 'Pasaporte A',
        documentType: 'PP',
        documentNumber: 'AB-123',
        email: 'passport-a@example.com',
      }),
      Customer.create({
        fullName: 'Pasaporte B',
        documentType: 'PP',
        documentNumber: 'XY-123',
        email: 'passport-b@example.com',
      }),
    ]);
    assert.equal(passportA.normalizedDocument, 'AB123');
    assert.equal(passportB.normalizedDocument, 'XY123');
    console.log('OK 02 documentos alfanuméricos diferentes no colisionan por sus números');

    const indexes = await Customer.collection.indexes();
    for (const name of [
      'customer_email_identity_unique',
      'customer_phone_identity_unique',
      'customer_document_identity_unique',
    ]) {
      assert.ok(indexes.some((index) => index.name === name && index.unique));
    }
    console.log('OK 03 MongoDB creó físicamente los tres índices únicos canónicos');

    console.log('\nConcurrencia Clientes: 3/3 controles superados.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error('FAIL concurrencia Clientes');
  console.error(error);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => null);
  }
  process.exitCode = 1;
});
