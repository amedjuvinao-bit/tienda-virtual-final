'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');
const { saveRemovingOwner } = require('../security/adminLastOwnerGuard');

async function main() {
  const originalDb = mongoose.connection.db;
  const originalTransaction = mongoose.connection.transaction;
  const originalCount = AdminUser.countDocuments;
  const session = { test: true };
  const writes = [];
  let ownersLeft = 0;
  const user = {
    _id: new mongoose.Types.ObjectId(),
    async invalidateSessions(options) { writes.push(options); },
    async save(options) { writes.push(options); },
  };

  mongoose.connection.db = {
    collection() {
      return { async updateOne(filter, update, options) {
        if (update.$inc) assert.equal(options.session, session);
      } };
    },
  };
  mongoose.connection.transaction = async (callback) => callback(session);
  AdminUser.countDocuments = (filter) => {
    assert.equal(String(filter._id.$ne), String(user._id));
    return { async session(value) { assert.equal(value, session); return ownersLeft; } };
  };

  try {
    await assert.rejects(saveRemovingOwner(user), (error) => error.status === 400);
    assert.equal(writes.length, 0, 'No debe guardar ni revocar al último propietario');
    ownersLeft = 1;
    await saveRemovingOwner(user);
    assert.deepEqual(writes, [{ session }]);
    await saveRemovingOwner(user, { invalidateSessions: false });
    assert.deepEqual(writes, [{ session }, { session }]);
    console.log('✅ La guarda impide retirar al último propietario y guarda dentro de la transacción.');
  } finally {
    mongoose.connection.db = originalDb;
    mongoose.connection.transaction = originalTransaction;
    AdminUser.countDocuments = originalCount;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
