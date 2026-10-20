'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.INSTAGRAM_ENCRYPTION_KEY = 'instagram-test-encryption-key-never-use-in-production';
const credentials = require('../lib/instagram/credentials');
const { createInstagramService, normalizeMedia, safeSettings, validateRedirect, metaRequest } = require('../services/instagramService');
const token = 'test-private-instagram-token-123456789';
const response = value => ({ ok: true, json: async () => value });
const media = id => ({ id, media_type: 'IMAGE', media_url: `https://cdn.example.com/${id}.jpg`, permalink: `https://www.instagram.com/p/${id}/`, caption: `Publicación ${id}` });
function fixture() {
  let store = { revision: 0, appId: '', apiVersion: 'v24.0', redirectUri: '', enabled: false, connectionId: '', __v: 0 };
  const pages = new Map(), requests = [];
  const doc = value => Object.assign(structuredClone(value), { save: async function () {
    if (this.__v !== store.__v) throw Object.assign(new Error('conflict'), { name: 'VersionError' });
    this.__v += 1; store = Object.fromEntries(Object.entries(this).filter(([,v]) => typeof v !== 'function'));
  } });
  const Model = {
    getSingleton: async () => doc(store),
    findOneAndUpdate: (query, update) => ({ select: async () => {
      if (query.oauthHash !== store.oauthHash || +new Date(store.oauthExpiresAt) <= Date.now()) return null;
      Object.assign(store, update.$set); return doc(store);
    } }),
  };
  const PageModel = {
    findOne: q => ({ lean: async () => pages.get(q.connection + q.cursorHash) || null }),
    updateOne: async (q,u) => pages.set(q.connection + q.cursorHash, u.$set),
    deleteMany: async q => { for (const [k,v] of pages) if (v.connection === q.connection) pages.delete(k); },
  };
  let rejectMeta = false;
  const fetchFn = async (url, options) => {
    const u = new URL(url); requests.push({ url: u, options });
    if (rejectMeta) return { ok: false, json: async () => ({ error: { code: 190, message: `RAW TOKEN ${token}` } }) };
    if (u.pathname === '/oauth/access_token') return response({ access_token: token });
    if (u.pathname === '/access_token') return response({ access_token: token, expires_in: 5184000 });
    if (u.pathname.endsWith('/me')) return response({ user_id: '1234567', username: 'rosa' });
    if (u.pathname.endsWith('/1234567')) return response({ name: 'Rosa', profile_picture_url: 'https://cdn.example.com/avatar.jpg', followers_count: 20, media_count: 3 });
    if (u.searchParams.get('fields') === 'id') return response({ data: [{ id: '1' }] });
    if (u.searchParams.get('after')) return response({ data: [media('two')] });
    return response({ data: [media('one')], paging: { cursors: { after: 'next-cursor' }, next: `https://evil.invalid/?access_token=${token}` } });
  };
  return { service: createInstagramService({ Model, PageModel, fetchFn }), requests, pages,
    current: () => store, mutate: fields => Object.assign(store, fields), reject: () => { rejectMeta = true; } };
}
test('AES-GCM protects credentials, detects tampering and never uses a default key', () => {
  const encrypted = credentials.protect(token);
  assert.ok(!encrypted.includes(token)); assert.equal(credentials.reveal(encrypted), token);
  assert.throws(() => credentials.reveal(encrypted.slice(0,-4) + 'AAAA'));
  const old = process.env.INSTAGRAM_ENCRYPTION_KEY; delete process.env.INSTAGRAM_ENCRYPTION_KEY;
  assert.throws(() => credentials.protect(token)); process.env.INSTAGRAM_ENCRYPTION_KEY = old;
});
test('signed pagination rejects tampering, different accounts and expiry', () => {
  const cursor = credentials.signCursor('after', 'connection');
  assert.equal(credentials.readCursor(cursor, 'connection'), 'after');
  assert.throws(() => credentials.readCursor(cursor, 'other'));
  assert.throws(() => credentials.readCursor(cursor + 'x', 'connection'));
  const now = Date.now; Date.now = () => now() + 25 * 3600000;
  try { assert.throws(() => credentials.readCursor(cursor, 'connection')); } finally { Date.now = now; }
});
test('OAuth redirect must use fixed callback path, HTTPS or local development', () => {
  assert.equal(validateRedirect('http://localhost:5000/api/instagram/callback'), 'http://localhost:5000/api/instagram/callback');
  for (const url of ['http://remote.com/api/instagram/callback', 'https://example.com/elsewhere', 'https://a:b@example.com/api/instagram/callback', 'https://example.com/api/instagram/callback?x=1']) assert.throws(() => validateRedirect(url));
});
test('media sanitization preserves album/video and independent real permalinks', () => {
  const post = normalizeMedia({ ...media('album'), media_type: 'CAROUSEL_ALBUM', children: { data: [media('a'), { id: 'b', media_type: 'VIDEO', media_url: 'https://cdn.example.com/b.mp4', thumbnail_url: 'https://cdn.example.com/b.jpg' }] } });
  assert.equal(post.album.length, 2); assert.equal(post.album[1].videoUrl, 'https://cdn.example.com/b.mp4');
  assert.equal(post.link, 'https://www.instagram.com/p/album/');
  assert.equal(normalizeMedia({ ...media('x'), permalink: 'https://instagram.com.evil.test/p/x/' }), null);
  assert.equal(normalizeMedia({ ...media('x'), media_url: 'javascript:alert(1)' }), null);
});
test('settings response whitelists fields and masks all private credentials/state', () => {
  const safe = JSON.stringify(safeSettings({ appSecretEncrypted: 'ENCRYPTED_SECRET', tokenEncrypted: token, oauthHash: 'PRIVATE_STATE', revision: 0 }));
  for (const value of ['ENCRYPTED_SECRET', token, 'PRIVATE_STATE', 'tokenEncrypted', 'appSecretEncrypted']) assert.ok(!safe.includes(value));
});
test('manual token is verified before storing; public paginated feed contains no secrets', async () => {
  const f = fixture(), connected = await f.service.connectToken({ revision: 0, accessToken: token });
  assert.equal(connected.settings.account.username, 'rosa'); assert.equal(connected.settings.connected, true);
  assert.ok(!f.current().tokenEncrypted.includes(token));
  const first = await f.service.feed(); assert.equal(first.posts[0].id, 'ig_one'); assert.ok(first.nextCursor);
  const second = await f.service.feed(first.nextCursor); assert.equal(second.posts[0].id, 'ig_two'); assert.equal(second.nextCursor, '');
  assert.ok(f.requests.every(r => r.url.hostname !== 'evil.invalid'));
  const serialized = JSON.stringify(first) + JSON.stringify(second);
  assert.ok(!serialized.includes(token)); assert.ok(!serialized.includes('tokenEncrypted'));
  await assert.rejects(() => f.service.feed(first.nextCursor + 'x'), /Paginación/);
});
test('feed cache prevents repeated provider requests and disconnect clears cache and token', async () => {
  const f = fixture(); await f.service.connectToken({ revision: 0, accessToken: token });
  await f.service.feed(); const count = f.requests.length; await f.service.feed(); assert.equal(f.requests.length, count);
  await f.service.disconnect({ revision: 1 }); assert.equal(f.current().tokenEncrypted, ''); assert.equal(f.pages.size, 0);
  assert.equal((await f.service.feed()).connected, false);
});
test('failed connection preserves prior account and sanitizes provider errors', async () => {
  const f = fixture(); await f.service.connectToken({ revision: 0, accessToken: token }); const previous = f.current().connectionId; f.reject();
  await assert.rejects(() => f.service.connectToken({ revision: 1, accessToken: token }), e => !e.message.includes(token) && /caducó/.test(e.message));
  assert.equal(f.current().connectionId, previous);
});
test('expired cache remains available on temporary failure, with explicit stale flag', async () => {
  const f = fixture(); await f.service.connectToken({ revision: 0, accessToken: token }); await f.service.feed();
  for (const value of f.pages.values()) value.fetchedAt = new Date(Date.now() - 2 * 3600000);
  f.reject(); const cached = await f.service.feed(); assert.equal(cached.posts[0].id, 'ig_one'); assert.equal(cached.stale, true);
  assert.ok(!f.current().lastError.includes(token));
});
test('revision conflicts prevent overwriting newer settings', async () => {
  const f = fixture(); await f.service.save({ revision: 0, appId: '1234567', apiVersion: 'v24.0' });
  await assert.rejects(() => f.service.save({ revision: 0, appId: '999999' }), /otra sesión/);
  assert.equal(f.current().appId, '1234567');
});
test('OAuth uses only basic read permission, browser state, single use and long-lived token exchange', async () => {
  const f = fixture(); await f.service.save({ revision: 0, appId: '1234567', appSecret: 'secret-test', redirectUri: 'https://backend.example.com/api/instagram/callback' });
  const start = await f.service.authorize({ revision: 1 }); start.state = new URL(start.url).searchParams.get('state'); const url = new URL(await f.service.start(start.state));
  assert.equal(url.searchParams.get('scope'), 'instagram_business_basic'); assert.equal(url.searchParams.get('state'), start.state);
  await assert.rejects(() => f.service.callback({ state: start.state, code: 'code' }, 'wrong-browser'), /navegador/);
  const result = await f.service.callback({ state: start.state, code: 'code' }, start.state);
  assert.equal(result.settings.connected, true); assert.ok(result.settings.expiresAt);
  await assert.rejects(() => f.service.callback({ state: start.state, code: 'code' }, start.state), /caducó/);
});
test('HTTP failures do not echo provider URLs, response messages or credentials', async () => {
  await assert.rejects(() => metaRequest('https://graph.instagram.com/me', { token, fetchFn: async () => { throw new Error(token); } }), e => !e.message.includes(token));
});
test('all protected routes are registered in the permission catalog', () => {
  const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
  for (const path of ['', '/authorize', '/connect-token', '/sync', '/disconnect']) {
    const rule = findAdminRoutePermission(path ? 'POST' : 'GET', '/api/admin/instagram-settings' + path);
    assert.equal(rule.permission, 'settings:instagram'); assert.equal(rule.knownPermission, true);
  }
  const sanitize = require('../middleware/adminAccessGate').sanitizeValue;
  assert.equal(sanitize({ accessToken: token, appSecret: 'private' }).accessToken, '[REDACTED]');
  assert.equal(sanitize({ appSecret: 'private' }).appSecret, '[REDACTED]');
});
test('HTTP routes deny unauthenticated administration and serve only the public feed contract', async () => {
  process.env.JWT_SECRET = 'jwt-test-secret-for-instagram-contract';
  const express = require('express'), exported = require('../services/instagramService');
  const original = exported.feed, f = fixture();
  await f.service.connectToken({ revision: 0, accessToken: token });
  exported.feed = f.service.feed;
  const routes = require('../routes/instagram');
  const app = express(); app.use(express.json()); app.use('/api/admin/instagram-settings', routes.admin); app.use('/api/instagram', routes.publicRouter);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [method,path] of [['GET',''],['PUT',''],['POST','/connect-token'],['POST','/authorize'],['POST','/disconnect']]) {
      const r = await fetch(base + '/api/admin/instagram-settings' + path, { method }); assert.equal(r.status, 401);
    }
    const r = await fetch(base + '/api/instagram/feed'); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
    const data = await r.json(); assert.equal(data.account.username, 'rosa'); assert.ok(!JSON.stringify(data).includes(token));
    const bad = await fetch(base + '/api/instagram/feed?cursor=forged'); assert.equal(bad.status, 400);
  } finally { exported.feed = original; await new Promise(resolve => server.close(resolve)); }
});
test('index migration defaults to a non-mutating plan and requires production confirmation', async () => {
  const { main } = require('../scripts/migrateInstagramIndexes');
  const plan = await main([], { nodeEnv: 'production', mongoUri: '', mongooseAdapter: null });
  assert.equal(plan.length, 2); assert.ok(plan.every(p => p.mutations === 0 && p.mode === 'dry-run'));
  assert.equal(plan[1].indexes.find(i => i.key.expiresAt === 1).options.expireAfterSeconds, 0);
  await assert.rejects(() => main(['--apply-instagram-index-migration'], { nodeEnv: 'production' }), /producci/i);
});
