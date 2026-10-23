'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { listenHttpServer, startupErrorMessage } = require('../lib/listenHttpServer');
const mountInstagramRoutes = require('../routes/mountInstagramRoutes');

const close = server => new Promise(resolve => server.close(resolve));

test('occupied ports reject startup instead of announcing a running backend', async () => {
  const app = express();
  const first = await listenHttpServer(app, 0, '127.0.0.1');
  try {
    await assert.rejects(listenHttpServer(app, first.address().port, '127.0.0.1'), error => {
      assert.equal(error.code, 'EADDRINUSE');
      assert.match(startupErrorMessage(error, first.address().port), /otro proceso/);
      return true;
    });
  } finally { await close(first); }
});

test('the production Instagram mount rejects incomplete media routers', () => {
  assert.throws(() => mountInstagramRoutes(express(), { admin: express.Router(), publicRouter: express.Router() }), /falta la ruta GET \/feed/);
});

test('production mount and global access gate serve authenticated media endpoints without credential permissions', async () => {
  const jwt = require('jsonwebtoken');
  const service = require('../services/instagramService');
  const originalFeed = service.feed;
  const previousSecret = process.env.JWT_SECRET, previousLegacy = process.env.ALLOW_LEGACY_ADMIN_AUTH;
  process.env.JWT_SECRET = 'instagram-http-startup-test-secret';
  process.env.ALLOW_LEGACY_ADMIN_AUTH = 'true';
  const calls = [];
  service.feed = async (...args) => { calls.push(args); return { ok: true, connected: true, account: { id: '123', username: 'rosa' }, posts: [{ id: 'ig_1' }], nextCursor: '' }; };
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/adminAccessGate'));
  mountInstagramRoutes(app);
  const server = await listenHttpServer(app, 0, '127.0.0.1');
  try {
    // Legacy test identity only: no database or production credentials required.
    const auth = jwt.sign({ role: 'admin', actualRole: 'owner', username: 'test' }, process.env.JWT_SECRET);
    for (const [method, path, force] of [
      ['GET', '/api/admin/instagram-settings/feed?cursor=signed', false],
      ['POST', '/api/admin/instagram-settings/refresh-feed', true],
      ['GET', '/api/instagram/admin/feed', false],
    ]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { Authorization: `Bearer ${auth}` } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await response.json()).posts[0].id, 'ig_1');
      assert.equal(calls.at(-1)[1], force); assert.equal(calls.at(-1)[2], true);
    }
    const denied = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/instagram-settings/feed`);
    assert.equal(denied.status, 401);
  } finally {
    service.feed = originalFeed;
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
    if (previousLegacy === undefined) delete process.env.ALLOW_LEGACY_ADMIN_AUTH; else process.env.ALLOW_LEGACY_ADMIN_AUTH = previousLegacy;
    await close(server);
  }
});
