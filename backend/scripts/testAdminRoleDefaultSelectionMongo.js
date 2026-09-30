'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AdminRole = require('../models/AdminRole');
const { ensureDefaultRoleIndex, saveRoleWithDefaultSelection } =
  require('../services/adminRoleDefaultSelectionService');

async function selected() {
  return AdminRole.find({ deletedAt: null, isDefault: true }).lean();
}

async function main() {
  const uri = process.env.ADMIN_ROLE_DEFAULT_TEST_MONGO_URI || '';
  assert(/\/orders_ci_role_default(?:\?|$)/.test(uri),
    'La prueba solo puede usar la base aislada orders_ci_role_default.');
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    const first = await AdminRole.create({ name: 'Inicial', code: 'initial', isDefault: true });
    const second = await AdminRole.create({ name: 'Alterno', code: 'alternate' });
    const third = await AdminRole.create({ name: 'Tercero', code: 'third' });
    await ensureDefaultRoleIndex();

    second.isDefault = true;
    await saveRoleWithDefaultSelection(second);
    assert.deepEqual((await selected()).map((role) => role.code), ['alternate'],
      'Transferir el perfil debe retirar la selección anterior en una transacción.');

    await assert.rejects(
      AdminRole.collection.updateOne({ _id: first._id }, { $set: { isDefault: true } }),
      (error) => error.code === 11000,
      'El índice debe impedir dos perfiles predeterminados aun fuera de la ruta HTTP.'
    );

    third.isDefault = true;
    third.status = 'inactive';
    third.active = false;
    await assert.rejects(saveRoleWithDefaultSelection(third),
      (error) => error.code === 'ROLE_DEFAULT_INACTIVE');
    assert.deepEqual((await selected()).map((role) => role.code), ['alternate'],
      'Un intento inválido no debe alterar la selección persistida.');

    third.status = 'active';
    third.active = true;
    third.name = '';
    await assert.rejects(saveRoleWithDefaultSelection(third),
      (error) => error.name === 'ValidationError');
    assert.deepEqual((await selected()).map((role) => role.code), ['alternate'],
      'Un error al guardar debe revertir la retirada del perfil anterior.');

    await saveRoleWithDefaultSelection(second);
    assert.equal((await selected()).length, 1, 'Una repetición conserva una sola selección.');
    const indexes = await AdminRole.collection.listIndexes().toArray();
    assert(indexes.some((index) => index.name === 'admin_roles_one_default_v1' && index.unique));
    console.log('MongoDB: transferencia, unicidad, reversión e idempotencia del perfil verificadas.');
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
