'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createSelectionRetentionWorker, JOB_ID, DAY_MS, CHECK_INTERVAL_MS, LEASE_MS,
} = require('../services/selectionRetentionWorkerService');

// Adaptador en memoria: la coordinación usa los filtros y escrituras reales
// del worker. No se conecta ni escribe en la base del negocio.
function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$and') return value.every(item => matches(document, item));
    if (key === '$or') return value.some(item => matches(document, item));
    const actual = document[key];
    if (value === null) return actual == null;
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('$lte' in value) return actual instanceof Date && actual <= value.$lte;
      if ('$gt' in value) return actual instanceof Date && actual > value.$gt;
    }
    return actual === value;
  });
}

function jobStore(initial = null) {
  let document = initial;
  return {
    get document() { return document; },
    async findOneAndUpdate(filter, update, options) {
      assert.equal(filter._id, JOB_ID);
      assert.equal(options.writeConcern.w, 'majority');
      assert.equal(options.returnDocument, 'after');
      assert.equal(options.includeResultMetadata, false);
      if (document && !matches(document, filter)) {
        const error = new Error('duplicate job'); error.code = 11000; throw error;
      }
      document = { ...(document || { _id: JOB_ID, ...update.$setOnInsert }), ...update.$set };
      return { ...document };
    },
    async updateOne(filter, update, options) {
      assert.equal(options.writeConcern.w, 'majority');
      if (!document || !matches(document, filter)) return { matchedCount: 0 };
      document = { ...document, ...update.$set };
      return { matchedCount: 1 };
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(options = {}) {
  let time = new Date('2026-11-20T12:00:00Z');
  let ready = true;
  const jobs = options.jobs || jobStore();
  const logs = [];
  const calls = { carts: 0, favorites: 0 };
  const resources = { jobs, carts: {}, favorites: {}, orders: {}, client: {} };
  const workerOptions = {
    getResources: () => resources,
    now: () => new Date(time), isReady: () => ready,
    logger: { info: (event, data) => logs.push({ event, data }), error: (event, data) => logs.push({ event, data }) },
    cleanCarts: async ({ report }) => { calls.carts++; report.checkedCarts++; report.deletedCarts++; return true; },
    cleanFavorites: async ({ report }) => { calls.favorites++; report.checkedFavoriteLists++; report.deletedFavoriteLists++; return true; },
    ...options,
  };
  delete workerOptions.jobs;
  return { jobs, calls, logs, resources, workerOptions,
    worker: createSelectionRetentionWorker(workerOptions),
    advance: ms => { time = new Date(time.getTime() + ms); },
    ready: value => { ready = value; },
    now: () => new Date(time),
  };
}

test('completa ambas limpiezas, guarda solo totales y conserva la fecha al reiniciar', async () => {
  const f = fixture();
  const result = await f.worker.runOnce();
  assert.deepEqual(result, { status: 'completed', retentionDays: 30,
    checkedCarts: 1, deletedCarts: 1, checkedFavoriteLists: 1, deletedFavoriteLists: 1 });
  assert.equal(f.jobs.document.nextRunAt.getTime(), f.now().getTime() + DAY_MS);
  assert.equal(f.jobs.document.owner, null);
  assert.equal(f.logs[0].event, 'selection_retention_cycle');
  const restarted = createSelectionRetentionWorker(f.workerOptions);
  assert.equal((await restarted.runOnce()).reason, 'not_due_or_claimed');
  f.advance(DAY_MS - 1);
  assert.equal((await restarted.runOnce()).skipped, true);
  f.advance(1);
  assert.equal((await restarted.runOnce()).status, 'completed');
  assert.deepEqual(f.calls, { carts: 2, favorites: 2 });
});

test('excluye ciclos simultáneos en el mismo proceso y entre dos instancias', async () => {
  const entered = deferred(); const release = deferred();
  const f = fixture({ cleanCarts: async () => { entered.resolve(); await release.promise; return true; } });
  const cycle = f.worker.runOnce();
  await entered.promise;
  assert.equal((await f.worker.runOnce()).reason, 'cycle_in_progress');
  const second = createSelectionRetentionWorker(f.workerOptions);
  assert.equal((await second.runOnce()).reason, 'not_due_or_claimed');
  assert.equal(f.worker.metrics().running, true);
  release.resolve();
  assert.equal((await cycle).status, 'completed');
  assert.equal(f.worker.metrics().running, false);
});

test('no consulta ni borra con MongoDB desconectado o mantenimiento activo', async () => {
  const f = fixture({ getResources: () => assert.fail('No debe acceder a MongoDB') });
  f.ready(false);
  assert.equal((await f.worker.runOnce()).reason, 'storage_or_maintenance');
  assert.equal(f.worker.metrics().running, false);
  assert.deepEqual(f.calls, { carts: 0, favorites: 0 });
});

test('la opción desactivada impide tanto el arranque como la ejecución directa', async () => {
  const f = fixture({ enabled: false, getResources: () => assert.fail('Tarea desactivada') });
  assert.equal(f.worker.start(), false);
  assert.equal((await f.worker.runOnce()).reason, 'disabled');
  assert.equal(f.worker.metrics().started, false);
});

test('arranca una sola vez, comprueba la fecha cada hora y libera su temporizador', async () => {
  let tick; let cleared = 0; let unref = 0;
  const timer = { unref() { unref++; } };
  const f = fixture({ setIntervalFn: (callback, interval) => {
    assert.equal(interval, CHECK_INTERVAL_MS); tick = callback; return timer;
  }, clearIntervalFn: value => { assert.equal(value, timer); cleared++; } });
  assert.equal(f.worker.start(), true);
  assert.equal(f.worker.start(), false);
  await new Promise(setImmediate);
  assert.deepEqual(f.calls, { carts: 1, favorites: 1 });
  f.advance(CHECK_INTERVAL_MS); tick();
  await new Promise(setImmediate);
  assert.deepEqual(f.calls, { carts: 1, favorites: 1 });
  f.advance(DAY_MS); tick();
  await new Promise(setImmediate);
  assert.deepEqual(f.calls, { carts: 2, favorites: 2 });
  assert.equal(unref, 1);
  assert.equal(f.worker.stop(), true);
  assert.equal(f.worker.stop(), false);
  assert.equal(cleared, 1);
  assert.equal((await f.worker.runOnce()).reason, 'storage_or_maintenance');
});

test('un fallo libera el ciclo, registra un código sin datos privados y reintenta en una hora', async () => {
  let fail = true;
  const f = fixture({ cleanCarts: async () => {
    if (fail) { const error = new Error('correo-privado@example.com'); error.code = 'SIMULATED_FAILURE'; throw error; }
    return true;
  } });
  const result = await f.worker.runOnce();
  assert.equal(result.status, 'failed');
  assert.equal(result.errorCode, 'SIMULATED_FAILURE');
  assert.equal(f.jobs.document.nextRunAt.getTime(), f.now().getTime() + CHECK_INTERVAL_MS);
  assert.equal(f.worker.metrics().running, false);
  assert.equal(JSON.stringify(f.logs).includes('correo-privado'), false);
  assert.equal(f.calls.favorites, 0);
  fail = false; f.advance(CHECK_INTERVAL_MS);
  assert.equal((await f.worker.runOnce()).status, 'completed');
});

test('un arranque interrumpido se recupera al vencer la reserva de ejecución', async () => {
  const at = new Date('2026-11-20T12:00:00Z');
  const jobs = jobStore({ _id: JOB_ID, owner: 'proceso-interrumpido', nextRunAt: at,
    leaseUntil: new Date(at.getTime() + LEASE_MS) });
  const f = fixture({ jobs });
  assert.equal((await f.worker.runOnce()).skipped, true);
  f.advance(LEASE_MS);
  assert.equal((await f.worker.runOnce()).status, 'completed');
});

test('renueva la reserva antes de cada borrado y detiene el trabajo si perdió la propiedad', async () => {
  const f = fixture({ cleanCarts: async ({ shouldContinue }) => {
    f.advance(1000);
    assert.equal(await shouldContinue(), true);
    assert.equal(f.jobs.document.leaseUntil.getTime(), f.now().getTime() + LEASE_MS);
    f.jobs.document.owner = 'otra-instancia';
    return shouldContinue();
  } });
  const result = await f.worker.runOnce();
  assert.equal(result.status, 'failed');
  assert.equal(result.errorCode, 'RETENTION_LEASE_LOST');
  assert.equal(f.jobs.document.owner, 'otra-instancia');
  assert.equal(f.calls.favorites, 0);
});

test('una reserva vencida detiene el ciclo antes de continuar borrando', async () => {
  const f = fixture({ cleanCarts: async ({ shouldContinue }) => {
    f.advance(LEASE_MS + 1); return shouldContinue();
  } });
  const result = await f.worker.runOnce();
  assert.equal(result.errorCode, 'RETENTION_LEASE_LOST');
  assert.equal(f.calls.favorites, 0);
});

test('una parada espera la operación en curso, evita la siguiente y deja reintento pendiente', async () => {
  const entered = deferred(); const release = deferred();
  const f = fixture({ cleanCarts: async () => { entered.resolve(); await release.promise; return true; } });
  const cycle = f.worker.runOnce(); await entered.promise;
  f.worker.stop();
  assert.equal(f.worker.metrics().running, true);
  release.resolve();
  assert.equal((await cycle).status, 'interrupted');
  assert.equal(f.worker.metrics().running, false);
  assert.equal(f.calls.favorites, 0);
  assert.equal(f.jobs.document.nextRunAt.getTime(), f.now().getTime() + CHECK_INTERVAL_MS);
});

function cursor(items, closed) {
  return { async *[Symbol.asyncIterator]() { yield* items; }, async close() { closed(); } };
}

function cleanupResources({ maintenanceAfterFirst = false, maintenanceAfterFavorite = false, failDelete = false } = {}) {
  const counts = { cartDeletes: [], favoriteDeletes: [], cursorsClosed: 0 };
  const f = fixture({ cleanCarts: undefined, cleanFavorites: undefined });
  const resources = f.resources;
  const session = { withTransaction: operation => operation() };
  resources.client = { withSession: async operation => operation(session) };
  resources.orders = { collectionName: 'orders', findOne: async ({ sessionId }) => sessionId === 'con-pedido' ? { _id: 'pedido' } : null };
  resources.carts = {
    aggregate(pipeline) {
      assert.equal(pipeline[2].$lookup.from, 'orders');
      return cursor([{ _id: 'c1', sessionId: 'vencido' }, { _id: 'c2', sessionId: 'con-pedido' },
        { _id: 'c3', sessionId: 'reactivado' }], () => counts.cursorsClosed++);
    },
    async deleteOne(filter, options) {
      assert.equal(options.session, session);
      assert.equal(filter.convertedOrderId, null);
      assert.ok(filter.$and[0].$or[0].lastCustomerActivityAt.$lte instanceof Date);
      if (failDelete) throw new Error('fallo-controlado');
      counts.cartDeletes.push(filter._id);
      if (maintenanceAfterFirst) f.ready(false);
      return { deletedCount: filter._id === 'c3' ? 0 : 1 };
    },
  };
  resources.favorites = {
    find() { return cursor([{ _id: 'f1' }, { _id: 'f2' }], () => counts.cursorsClosed++); },
    async deleteOne(filter) {
      assert.equal(filter['items.0'].$exists, true);
      assert.equal(filter.$or[0].lastCustomerActivityAt.$lte.getTime(), f.now().getTime() - 30 * DAY_MS);
      counts.favoriteDeletes.push(filter._id);
      if (maintenanceAfterFavorite) f.ready(false);
      return { deletedCount: filter._id === 'f2' ? 0 : 1 };
    },
  };
  return { ...f, counts };
}

test('integra los limpiadores reales: vuelve a comprobar pedidos, actividad y listas de favoritos', async () => {
  const f = cleanupResources();
  const result = await f.worker.runOnce();
  assert.equal(result.status, 'completed');
  assert.deepEqual(f.counts.cartDeletes, ['c1', 'c3']);
  assert.deepEqual(f.counts.favoriteDeletes, ['f1', 'f2']);
  assert.equal(result.checkedCarts, 3);
  assert.equal(result.deletedCarts, 1);
  assert.equal(result.checkedFavoriteLists, 2);
  assert.equal(result.deletedFavoriteLists, 1);
  assert.equal(f.counts.cursorsClosed, 2);
});

test('el mantenimiento iniciado durante un recorrido impide el siguiente borrado y cierra el cursor', async () => {
  const f = cleanupResources({ maintenanceAfterFirst: true });
  const result = await f.worker.runOnce();
  assert.equal(result.status, 'interrupted');
  assert.deepEqual(f.counts.cartDeletes, ['c1']);
  assert.deepEqual(f.counts.favoriteDeletes, []);
  assert.equal(f.counts.cursorsClosed, 1);
  assert.equal(f.worker.metrics().running, false);
});

test('un fallo de borrado también cierra el cursor y deja la tarea disponible para reintentar', async () => {
  const f = cleanupResources({ failDelete: true });
  assert.equal((await f.worker.runOnce()).status, 'failed');
  assert.equal(f.counts.cursorsClosed, 1);
  assert.equal(f.jobs.document.owner, null);
  assert.equal(f.worker.metrics().running, false);
});

test('el mantenimiento también detiene un recorrido de favoritos antes del siguiente borrado', async () => {
  const f = cleanupResources({ maintenanceAfterFavorite: true });
  const result = await f.worker.runOnce();
  assert.equal(result.status, 'interrupted');
  assert.deepEqual(f.counts.favoriteDeletes, ['f1']);
  assert.equal(f.counts.cursorsClosed, 2);
  assert.equal(result.deletedFavoriteLists, 1);
});

test('la configuración activa la tarea por defecto y permite desactivarla', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const filename = path.join(__dirname, '../config/env.js');
  const source = fs.readFileSync(filename, 'utf8');
  for (const [value, expected] of [[undefined, true], ['true', true], ['false', false]]) {
    const sandbox = { module: { exports: {} }, __dirname: path.dirname(filename), URL,
      process: { env: value === undefined ? {} : { SELECTION_RETENTION_ENABLED: value } },
      require: id => id === 'dotenv' ? { config() {} } : require(id),
    };
    vm.runInNewContext(source, sandbox, { filename });
    const { env, getSafeEnvSummary } = sandbox.module.exports;
    assert.equal(env.selectionRetention.enabled, expected);
    assert.equal(getSafeEnvSummary().selectionRetention.enabled, expected);
  }
});

test('un fallo al registrar el resultado no anuncia un ciclo completado', async () => {
  const f = fixture();
  const update = f.jobs.updateOne;
  f.jobs.updateOne = async (filter, change, options) => {
    if (change.$set.lastReport) throw new Error('Sin conexión');
    return update(filter, change, options);
  };
  const result = await f.worker.runOnce();
  assert.equal(result.status, 'failed');
  assert.equal(result.errorCode, 'RETENTION_RESULT_NOT_SAVED');
  assert.equal(f.jobs.document.status, 'running');
  assert.equal(f.worker.metrics().running, false);
});
