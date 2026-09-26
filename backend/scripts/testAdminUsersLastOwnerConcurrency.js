'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');
const { saveRemovingOwner } = require('../security/adminLastOwnerGuard');

function isolatedUri() {
  const source = process.env.ADMIN_USERS_OWNER_E2E_MONGO_URI ||
    process.env.MONGO_URI || process.env.MONGODB_URI ||
    process.env.MONGO_URL || process.env.DATABASE_URL;
  assert.match(source || '', /^mongodb(?:\+srv)?:\/\//i,
    'No se encontró una URI MongoDB en backend/.env, .env de la raíz ni en las variables del sistema. Se aceptan MONGO_URI, MONGODB_URI, MONGO_URL o DATABASE_URL.');
  const uri = new URL(source);
  uri.pathname = `/users_owner_e2e_${crypto.randomBytes(6).toString('hex')}`;
  assert.match(decodeURIComponent(uri.pathname), /^\/users_owner_e2e_[a-z0-9]+$/,
    'La base de pruebas debe llamarse users_owner_e2e_<identificador>.');
  return uri.toString();
}

async function main() {
  const uri = isolatedUri();
  await mongoose.connect(uri);
  try {
    const [first, second] = await AdminUser.create([
      { username: 'owner_concurrency_a', passwordHash: 'test-only-hash', role: 'owner' },
      { username: 'owner_concurrency_b', passwordHash: 'test-only-hash', role: 'owner' },
    ]);
    const candidates = await Promise.all([first._id, second._id].map(async (id) => {
      const user = await AdminUser.findById(id).select('+tokenVersion');
      user.status = 'inactive';
      user.active = false;
      return user;
    }));

    const results = await Promise.allSettled(candidates.map((user) => saveRemovingOwner(user)));
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    assert.equal(await AdminUser.countDocuments({ role: 'owner', active: true, status: 'active' }), 1);
    console.log('✅ Dos desactivaciones simultáneas conservaron un propietario activo.');
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
