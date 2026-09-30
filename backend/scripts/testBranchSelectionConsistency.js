'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const router = require('../routes/adminBranches');
const { saveBranchSelection } = require('../services/branchSelectionService');
const { parseArguments } = require('./migrateBranchSelectionIndexes');

const original = {
  createIndex: Branch.collection.createIndex,
  save: Branch.prototype.save,
  updateMany: Branch.updateMany,
  updateOne: Branch.updateOne,
  findOne: Branch.findOne,
  findById: Branch.findById,
  countDocuments: Branch.countDocuments,
  transaction: mongoose.connection.transaction,
};
const events = [];
const session = { id: 'selection-transaction' };
let indexError;
let saveError;
let selectionRace;
let committed = { main: 'old', online: 'old' };
let staged;
let selectedBranch;

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

function handler(method, path) {
  const route = router.stack.find((entry) => entry.route?.path === path && entry.route.methods?.[method]);
  assert.ok(route, `${method} ${path}`);
  return route.route.stack.at(-1).handle;
}

async function main() {
  try {
    Branch.collection.createIndex = async (key, options) => {
      events.push(['index', key, options]);
      if (indexError) throw indexError;
      return options.name;
    };
    mongoose.connection.transaction = async (callback) => {
      events.push(['begin']);
      staged = { ...committed };
      try {
        await callback(session);
        committed = staged;
        events.push(['commit']);
      } catch (error) {
        events.push(['rollback']);
        throw error;
      }
    };
    Branch.updateMany = async (filter, update, options) => {
      assert.equal(options.session, session);
      events.push(['clear', filter, update]);
      if (filter.isMain) staged.main = null;
      if (filter.isDefaultForOnlineOrders) staged.online = null;
      return { modifiedCount: 1 };
    };
    Branch.prototype.save = async function (options) {
      events.push(['save', options?.session]);
      if (saveError) throw saveError;
      if (options?.session) assert.equal(options.session, session);
      return this;
    };
    Branch.updateOne = async (filter, update, options) => {
      assert.equal(options.session, session);
      events.push(['select', filter, update]);
      if (selectionRace) {
        throw Object.assign(new Error('branches_one_main_v1 duplicate'), {
          code: 11000, keyPattern: { isMain: 1, deletedAt: 1 },
        });
      }
      if (update.$set.isMain) staged.main = String(filter._id);
      if (update.$set.isDefaultForOnlineOrders) staged.online = String(filter._id);
      return { matchedCount: 1 };
    };

    const first = new Branch({ name: 'Nueva', code: 'NUEVA', isMain: true, active: true });
    indexError = Object.assign(new Error('duplicate existing flags'), { code: 11000 });
    await assert.rejects(saveBranchSelection(first), { code: 'BRANCH_SELECTION_INDEX_CONFLICT' });
    assert.equal(events.some(([name]) => name === 'begin'), false, 'No escribir si el índice falla');
    indexError = null;
    events.length = 0;
    await saveBranchSelection(first);
    assert.equal(events.filter(([name]) => name === 'index').length, 2);
    assert.ok(events.filter(([name]) => name === 'index').every(([, key, options]) =>
      key.deletedAt === 1 && options.unique === true && options.partialFilterExpression.deletedAt === null));
    assert.deepEqual(events.filter(([name]) => ['begin', 'clear', 'save', 'select', 'commit'].includes(name)).map(([name]) => name),
      ['begin', 'clear', 'save', 'select', 'commit']);
    assert.equal(committed.main, String(first._id));

    events.length = 0;
    selectedBranch = new Branch({ name: 'Elegida', code: 'ELEGIDA', active: true, isMain: false, isDefaultForOnlineOrders: false });
    Branch.findOne = (filter) => filter.code ? { lean: async () => null } : selectedBranch;
    Branch.findById = () => ({ populate: async () => selectedBranch });
    Branch.countDocuments = async () => 1;
    const req = { params: { id: String(selectedBranch._id) }, adminUserId: String(new mongoose.Types.ObjectId()) };

    const create = response();
    await handler('post', '/')({ ...req, body: { name: 'Primera', code: 'PRIMERA', isMain: true, isDefaultForOnlineOrders: true } }, create);
    assert.equal(create.statusCode, 201);
    assert.equal(events.filter(([name]) => name === 'clear').length, 2, 'Crear asigna ambos roles juntos');
    assert.equal(events.filter(([name]) => name === 'commit').length, 1);

    selectedBranch.isMain = false;
    selectedBranch.isDefaultForOnlineOrders = false;
    events.length = 0;
    const edit = response();
    await handler('put', '/:id')({ ...req, body: { isMain: true } }, edit);
    assert.equal(edit.statusCode, 200);
    assert.ok(events.some(([name]) => name === 'commit'), 'Editar asigna sede principal en transacción');

    selectedBranch.isMain = false;
    events.length = 0;
    const mainResponse = response();
    await handler('patch', '/:id/main')(req, mainResponse);
    assert.equal(mainResponse.statusCode, 200);
    assert.ok(events.some(([name]) => name === 'commit'), 'Botón principal usa transacción');

    selectedBranch.isMain = false;
    events.length = 0;
    const online = response();
    await handler('patch', '/:id/online-default')(req, online);
    assert.equal(online.statusCode, 200);
    assert.ok(events.some(([name]) => name === 'commit'), 'Botón online usa transacción');

    selectedBranch.isMain = false;
    selectedBranch.isDefaultForOnlineOrders = false;
    events.length = 0;
    saveError = new Error('falló guardar');
    const beforeFailure = { ...committed };
    const failed = response();
    await handler('patch', '/:id/main')(req, failed);
    assert.equal(failed.statusCode, 500);
    assert.deepEqual(committed, beforeFailure, 'El fallo de guardado revierte las marcas anteriores');
    assert.ok(events.some(([name]) => name === 'rollback'));
    saveError = null;

    selectedBranch.isMain = false;
    selectionRace = true;
    events.length = 0;
    const race = response();
    await handler('patch', '/:id/main')(req, race);
    assert.equal(race.statusCode, 409);
    assert.match(race.body.message, /al mismo tiempo/);
    assert.deepEqual(committed, beforeFailure, 'Una selección simultánea fallida no borra la sede anterior');
    assert.ok(events.some(([name]) => name === 'rollback'));
    selectionRace = false;

    selectedBranch.active = false;
    selectedBranch.status = 'inactive';
    events.length = 0;
    const inactive = response();
    await handler('patch', '/:id/main')(req, inactive);
    assert.equal(inactive.statusCode, 400);
    assert.equal(events.some(([name]) => name === 'begin'), false);

    assert.throws(() => parseArguments(['--apply', '--main=invalid', '--online=invalid']));
    console.log('Sedes: índices, cuatro rutas, reversión y sede inactiva verificados.');
  } finally {
    Branch.collection.createIndex = original.createIndex;
    Branch.prototype.save = original.save;
    Branch.updateMany = original.updateMany;
    Branch.updateOne = original.updateOne;
    Branch.findOne = original.findOne;
    Branch.findById = original.findById;
    Branch.countDocuments = original.countDocuments;
    mongoose.connection.transaction = original.transaction;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
