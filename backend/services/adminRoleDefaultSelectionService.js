'use strict';

const mongoose = require('mongoose');
const AdminRole = require('../models/AdminRole');
const defaultIndex = require('../models/adminRoleDefaultIndex');

let indexPromise;

function selectionError(error) {
  if (error?.code === 112 || error?.hasErrorLabel?.('TransientTransactionError')) {
    return Object.assign(new Error(
      'El perfil predeterminado cambió durante la operación. Actualiza la página e inténtalo de nuevo.'
    ), { code: 'ROLE_DEFAULT_CONFLICT' });
  }
  if (error?.code === 11000 && (
    error?.keyPattern?.isDefault ||
    String(error?.message || '').includes(defaultIndex.options.name)
  )) {
    return Object.assign(new Error(
      'Otro administrador cambió el perfil predeterminado. Actualiza la página e inténtalo de nuevo.'
    ), { code: 'ROLE_DEFAULT_CONFLICT' });
  }
  return error;
}

async function ensureDefaultRoleIndex() {
  if (!indexPromise) {
    indexPromise = AdminRole.collection.createIndex(defaultIndex.key, defaultIndex.options)
      .catch((error) => {
        indexPromise = undefined;
        throw Object.assign(new Error(
          error?.code === 11000
            ? 'Hay varios perfiles predeterminados. Corrige la selección antes de continuar.'
            : 'No se pudo verificar el índice del perfil predeterminado.'
        ), { code: error?.code === 11000 ? 'ROLE_DEFAULT_INDEX_CONFLICT' : 'ROLE_DEFAULT_INDEX_UNAVAILABLE', cause: error });
      });
  }
  return indexPromise;
}

async function saveRoleWithDefaultSelection(role) {
  if (role.isDefault !== true) return role.save();
  if (role.active !== true || role.status !== 'active' || role.deletedAt) {
    throw Object.assign(new Error('Solo un perfil activo puede ser predeterminado.'), { code: 'ROLE_DEFAULT_INACTIVE' });
  }
  await ensureDefaultRoleIndex();
  try {
    await mongoose.connection.transaction(async (session) => {
      await AdminRole.updateMany(
        { _id: { $ne: role._id }, deletedAt: null, isDefault: true },
        { $set: { isDefault: false } },
        { session }
      );
      await role.save({ session });
      const result = await AdminRole.updateOne(
        { _id: role._id, deletedAt: null, active: true, status: 'active' },
        { $set: { isDefault: true } },
        { session }
      );
      if (result.matchedCount !== 1) {
        throw Object.assign(new Error('El perfil cambió durante la selección. Actualiza la página.'), { code: 'ROLE_DEFAULT_CONFLICT' });
      }
    });
  } catch (error) {
    throw selectionError(error);
  }
  return role;
}

module.exports = { ensureDefaultRoleIndex, saveRoleWithDefaultSelection, selectionError };
