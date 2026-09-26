'use strict';

const mongoose = require('mongoose');
const { env } = require('../config/env');
const Branch = require('../models/Branch');
const { ensureBranchSelectionIndexes } = require('../services/branchSelectionService');

function parseArguments(argv) {
  const allowed = ['--apply', '--confirm-production', '--main=', '--online='];
  if (argv.some((value) => !allowed.some((prefix) => value === prefix ||
    (prefix.endsWith('=') && value.startsWith(prefix))))) {
    throw new Error('Argumento desconocido. Usa --apply --main=ID --online=ID para corregir duplicados.');
  }
  const apply = argv.includes('--apply');
  const main = argv.find((value) => value.startsWith('--main='))?.slice(7);
  const online = argv.find((value) => value.startsWith('--online='))?.slice(9);
  if (argv.filter((value) => value.startsWith('--main=')).length > 1 ||
      argv.filter((value) => value.startsWith('--online=')).length > 1 ||
      (!apply && (main || online))) {
    throw new Error('Indica cada ID solo una vez y únicamente junto con --apply.');
  }
  if (apply && (Boolean(main) !== Boolean(online) ||
      (main && (!mongoose.isValidObjectId(main) || !mongoose.isValidObjectId(online))))) {
    throw new Error('Para corregir duplicados indica ambos IDs válidos: --main=ID --online=ID.');
  }
  if (apply && env.nodeEnv === 'production' && !argv.includes('--confirm-production')) {
    throw new Error('En producción agrega --confirm-production para aplicar cambios.');
  }
  return { apply, main, online };
}

async function inspect() {
  const selected = {};
  for (const field of ['isMain', 'isDefaultForOnlineOrders']) {
    selected[field] = await Branch.find({ deletedAt: null, [field]: true })
      .select('_id code name active status').lean();
  }
  return selected;
}

async function run(argv = process.argv.slice(2)) {
  const { apply, main, online } = parseArguments(argv);
  await mongoose.connect(env.mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    const before = await inspect();
    if (!apply) return { mode: 'audit', selected: before, duplicates: Object.values(before).some((items) => items.length > 1) };

    if (!main && Object.values(before).some((items) => items.length > 1)) {
      throw new Error('Hay selecciones duplicadas. Ejecuta de nuevo con --main=ID y --online=ID elegidos de las sedes activas.');
    }
    if (main) {
      const ids = [main, online];
      const choices = await Branch.find({ _id: { $in: ids }, deletedAt: null, active: true, status: 'active' })
        .select('_id').lean();
      if (new Set(choices.map((item) => String(item._id))).size !== new Set(ids).size) {
        throw new Error('Los IDs elegidos deben pertenecer a sedes existentes y activas.');
      }

      await mongoose.connection.transaction(async (session) => {
        for (const [field, id] of [['isMain', main], ['isDefaultForOnlineOrders', online]]) {
          await Branch.updateMany({ _id: { $ne: new mongoose.Types.ObjectId(id) }, deletedAt: null, [field]: true },
            { $set: { [field]: false } }, { session });
          const result = await Branch.updateOne({ _id: new mongoose.Types.ObjectId(id), deletedAt: null, active: true, status: 'active' },
            { $set: { [field]: true } }, { session });
          if (result.matchedCount !== 1) throw new Error('La sede elegida cambió durante la transacción.');
        }
      });
    }

    await ensureBranchSelectionIndexes();
    return { mode: 'apply', selected: await inspect(), indexes: 'verified' };
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { parseArguments, run };
