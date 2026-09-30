'use strict';

const mongoose = require('mongoose');
const { env } = require('../config/env');
const AdminRole = require('../models/AdminRole');
const defaultIndex = require('../models/adminRoleDefaultIndex');

function parseArguments(argv) {
  const allowed = ['--verify', '--apply', '--confirm-production'];
  if (argv.some((arg) => !allowed.includes(arg) && !arg.startsWith('--default=')) ||
      (argv.includes('--verify') && argv.includes('--apply')) ||
      (argv.includes('--confirm-production') && !argv.includes('--apply'))) {
    throw new Error('Usa --verify para consultar o --apply [--default=ID] para crear el índice.');
  }
  const apply = argv.includes('--apply');
  const defaults = argv.filter((arg) => arg.startsWith('--default='));
  const chosenId = defaults[0]?.slice('--default='.length);
  if (defaults.length > 1 || (chosenId && (!apply || !mongoose.isValidObjectId(chosenId))) ||
      (defaults.length && !chosenId)) {
    throw new Error('--default=ID exige --apply y un único ID de perfil válido.');
  }
  if (apply && env.nodeEnv === 'production' && !argv.includes('--confirm-production')) {
    throw new Error('En producción agrega --confirm-production para crear el índice.');
  }
  return { apply, chosenId };
}

async function inspect() {
  const selected = await AdminRole.find({ deletedAt: null, isDefault: true })
    .select('_id code name status active').lean();
  const collectionExists = await mongoose.connection.db
    .listCollections({ name: AdminRole.collection.name }).hasNext();
  const indexes = collectionExists ? await AdminRole.collection.listIndexes().toArray() : [];
  const index = indexes.find(({ name }) => name === defaultIndex.options.name);
  const indexReady = Boolean(index?.unique &&
    JSON.stringify(index.key) === JSON.stringify(defaultIndex.key) &&
    JSON.stringify(index.partialFilterExpression) ===
      JSON.stringify(defaultIndex.options.partialFilterExpression));
  return {
    selected,
    index: { name: defaultIndex.options.name, ready: indexReady },
    ready: selected.length === 1 && selected[0].active === true &&
      selected[0].status === 'active' && indexReady,
  };
}

async function run(argv = process.argv.slice(2)) {
  const { apply, chosenId } = parseArguments(argv);
  await mongoose.connect(env.mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    const before = await inspect();
    if (!apply) return { mode: 'verify', ...before };
    if (chosenId) {
      const id = new mongoose.Types.ObjectId(chosenId);
      const chosen = await AdminRole.findOne({ _id: id, deletedAt: null, active: true, status: 'active' })
        .select('_id').lean();
      if (!chosen) throw new Error('El ID elegido debe pertenecer a un perfil activo.');
      await mongoose.connection.transaction(async (session) => {
        await AdminRole.updateMany({ _id: { $ne: id }, deletedAt: null, isDefault: true },
          { $set: { isDefault: false } }, { session });
        const result = await AdminRole.updateOne({ _id: id, deletedAt: null, active: true, status: 'active' },
          { $set: { isDefault: true } }, { session });
        if (result.matchedCount !== 1) throw new Error('El perfil elegido cambió durante la selección.');
      });
    } else if (before.selected.length !== 1 || before.selected[0].active !== true ||
               before.selected[0].status !== 'active') {
      throw new Error('Indica --default=ID de un perfil activo para resolver selecciones ausentes o duplicadas.');
    }
    await AdminRole.collection.createIndex(defaultIndex.key, defaultIndex.options);
    return { mode: 'apply', ...await inspect() };
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ready) process.exitCode = 1;
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { parseArguments, run };
