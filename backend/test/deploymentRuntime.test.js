'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDeploymentHealth } = require('../lib/deploymentHealth');
const { createGracefulShutdown } = require('../lib/gracefulShutdown');

function response() {
  return {
    headers: {}, code: null, body: null,
    set(key, value) { this.headers[key] = value; return this; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('health comprueba MongoDB con un límite de tiempo y no permite caché', async () => {
  const calls = [];
  const handler = createDeploymentHealth({ connection: {
    readyState: 1, db: { command: async (...args) => { calls.push(args); } },
  } });
  const res = response();
  await handler({}, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(calls, [[{ ping: 1 }, { timeoutMS: 2000 }]]);
});

test('health rechaza MongoDB desconectado y un proceso que se está cerrando', async () => {
  for (const [readyState, stopping] of [[0, false], [2, false], [1, true]]) {
    const res = response();
    await createDeploymentHealth({
      connection: { readyState, db: { command: () => assert.fail('No debe consultar MongoDB') } },
      isStopping: () => stopping,
    })({}, res);
    assert.equal(res.code, 503);
    assert.deepEqual(res.body, { ok: false });
  }
});

test('health no expone un error del driver ni la credencial incluida en él', async () => {
  const res = response();
  await createDeploymentHealth({ connection: { readyState: 1, db: {
    command: async () => { throw new Error('mongodb://private-user:private-pass@private-host'); },
  } } })({}, res);
  assert.equal(res.code, 503);
  assert.deepEqual(res.body, { ok: false });
});

const logger = { info() {}, error() {} };

test('el cierre drena solicitudes y tareas antes de desconectar MongoDB', async () => {
  const events = [];
  let finishRequests;
  let idle = false;
  const lifecycle = createGracefulShutdown({
    server: { close(done) { events.push('http-close'); finishRequests = done; } },
    stopWorkers: () => events.push('workers-stop'), workersIdle: () => idle,
    disconnect: async () => events.push('database-close'), logger,
  });
  const shutdown = lifecycle.shutdown();
  assert.equal(lifecycle.isStopping(), true);
  assert.equal(lifecycle.shutdown(), shutdown);
  assert.deepEqual(events, ['workers-stop', 'http-close']);
  finishRequests();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.includes('database-close'), false);
  idle = true;
  assert.equal(await shutdown, 0);
  assert.deepEqual(events, ['workers-stop', 'http-close', 'database-close']);
});

test('un cierre que excede el plazo termina con error y cierra conexiones', async () => {
  let forced = false;
  const lifecycle = createGracefulShutdown({
    server: { close() {}, closeAllConnections() { forced = true; } },
    stopWorkers() {}, workersIdle: () => true,
    disconnect: () => assert.fail('No desconectar mientras hay solicitudes'),
    timeoutMs: 20, logger,
  });
  assert.equal(await lifecycle.shutdown(), 1);
  assert.equal(forced, true);
});

test('el plazo predeterminado termina antes del SIGKILL de Render con disco', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  context.after(() => context.mock.timers.reset());
  let forced = false;
  let result;
  const lifecycle = createGracefulShutdown({
    server: { close() {}, closeAllConnections() { forced = true; } },
    stopWorkers() {}, workersIdle: () => true,
    disconnect: () => assert.fail('Hay solicitudes que todavía no terminaron'),
    logger,
  });
  void lifecycle.shutdown().then(code => { result = code; });
  context.mock.timers.tick(29000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result, 1, 'El cierre debe terminar antes del límite fijo de 30 segundos');
  assert.equal(forced, true);
});

test('un error al cerrar no anuncia éxito ni expone el error interno', async () => {
  const messages = [];
  const lifecycle = createGracefulShutdown({
    server: { close(done) { done(new Error('private-error')); } },
    stopWorkers() {}, workersIdle: () => true, disconnect() {},
    logger: { info() {}, error: value => messages.push(value) },
  });
  assert.equal(await lifecycle.shutdown(), 1);
  assert.equal(messages.length, 1);
  assert.equal(messages.join('').includes('private-error'), false);
});
