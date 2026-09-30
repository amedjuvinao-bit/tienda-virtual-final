const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const branchSelectionIndexes = require('../models/branchSelectionIndexes');

let indexPromise;

function selectionError(error) {
  if (error?.code === 'BRANCH_SELECTION_INDEX_CONFLICT' || error?.code === 'BRANCH_SELECTION_INDEX_UNAVAILABLE') {
    return error;
  }

  if (error?.code === 11000 &&
      (error?.keyPattern?.isMain || error?.keyPattern?.isDefaultForOnlineOrders ||
        /branches_one_(main|online_default)_v1/.test(error?.message || ''))) {
    const conflict = new Error('Otra sede cambió esa selección al mismo tiempo. Actualiza la página e inténtalo de nuevo.');
    conflict.code = 'BRANCH_SELECTION_CONFLICT';
    return conflict;
  }

  return error;
}

async function ensureBranchSelectionIndexes() {
  if (!indexPromise) {
    indexPromise = (async () => {
      for (const { key, options } of branchSelectionIndexes) {
        try {
          await Branch.collection.createIndex(key, options);
        } catch (error) {
          const conflict = new Error(error?.code === 11000
            ? 'Hay varias sedes con la misma selección. Revisa las sedes principal y online antes de intentar el cambio.'
            : 'No se pudo verificar la protección de las sedes principal y online. Inténtalo más tarde.');
          conflict.code = error?.code === 11000
            ? 'BRANCH_SELECTION_INDEX_CONFLICT'
            : 'BRANCH_SELECTION_INDEX_UNAVAILABLE';
          conflict.cause = error;
          throw conflict;
        }
      }
    })();
    indexPromise.catch(() => { indexPromise = undefined; });
  }
  return indexPromise;
}

async function saveBranchSelection(branch) {
  const selected = {
    isMain: branch.isMain === true,
    isDefaultForOnlineOrders: branch.isDefaultForOnlineOrders === true,
  };
  if (!selected.isMain && !selected.isDefaultForOnlineOrders) {
    return branch.save();
  }

  if (branch.active !== true || branch.status !== 'active') {
    const error = new Error('Solo una sede activa puede ser principal o predeterminada para ventas online.');
    error.code = 'BRANCH_SELECTION_INACTIVE';
    throw error;
  }

  await ensureBranchSelectionIndexes();

  try {
    await mongoose.connection.transaction(async (session) => {
      for (const [field, enabled] of Object.entries(selected)) {
        if (enabled) {
          await Branch.updateMany(
            { _id: { $ne: branch._id }, deletedAt: null, [field]: true },
            { $set: { [field]: false } },
            { session }
          );
        }
      }

      await branch.save({ session });

      // A document loaded before the transaction may already have true locally.
      // Make the selection explicit even if save() sees no modified flag.
      const result = await Branch.updateOne(
        { _id: branch._id, deletedAt: null },
        { $set: Object.fromEntries(Object.entries(selected).filter(([, enabled]) => enabled)) },
        { session }
      );
      if (result.matchedCount !== 1) {
        const conflict = new Error('La sede cambió durante la selección. Actualiza la página e inténtalo de nuevo.');
        conflict.code = 'BRANCH_SELECTION_CONFLICT';
        throw conflict;
      }
    });
  } catch (error) {
    throw selectionError(error);
  }

  return branch;
}

module.exports = { ensureBranchSelectionIndexes, saveBranchSelection, selectionError };
