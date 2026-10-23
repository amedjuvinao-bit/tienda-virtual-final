'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.TIKTOK_ENCRYPTION_KEY = 'qr-only-test-encryption-never-use-in-production';
process.env.JWT_SECRET = 'qr-only-test-session-secret';
const { createTiktokService, safeSettings } = require('../services/tiktokService');
const { reveal } = require('../lib/tiktok/credentials');

function fixture() {
  let stored = { key: 'main', __v: 0, revision: 0, clientKey: '', redirectUri: '', enabled: false };
  let reply = { status: 'new', client_ticket: '' }, getQr = null, tokens = null, wait = null;
  const calls = [];
  const document = value => Object.assign(structuredClone(value), { save: async function () {
    if (stored.__v !== this.__v) throw Object.assign(new Error('Conflict'), { name: 'VersionError' });
    this.__v += 1; stored = Object.fromEntries(Object.entries(this).filter(([, value]) => typeof value !== 'function'));
  } });
  const Model = {
    getSingleton: async () => document(stored),
    findOneAndUpdate: (query, update) => ({ select: async () => {
      for (const [key, value] of Object.entries(query)) {
        if (value?.$gt ? +new Date(stored[key]) <= +value.$gt : stored[key] !== value) return null;
      }
      Object.assign(stored, update.$set);
      for (const [key, value] of Object.entries(update.$inc || {})) stored[key] = (stored[key] || 0) + value;
      return document(stored);
    } }),
  };
  const fetchFn = async (url, options) => {
    const path = new URL(url).pathname, form = options.body && new URLSearchParams(options.body);
    calls.push({ path, form });
    if (wait?.path === path) await wait.promise;
    const ok = data => ({ ok: true, json: async () => data });
    if (path === '/v2/oauth/get_qrcode/') return ok(getQr || { scan_qrcode_url: 'aweme://authorize?client_key=client-key&client_ticket=tobefilled', token: 'private-provider-poll-token' });
    if (path === '/v2/oauth/check_qrcode/') return ok(reply);
    if (path === '/v2/oauth/token/') return ok(tokens || { access_token: 'private-access-token', refresh_token: 'private-refresh-token', expires_in: 86400, refresh_expires_in: 31536000, open_id: 'account', scope: 'user.info.basic,video.list' });
    if (path === '/v2/user/info/') return ok({ data: { user: { open_id: 'account', display_name: 'Cuenta conectada', avatar_url: 'https://cdn.example.test/profile.jpg' } } });
    if (path === '/v2/video/list/') return ok({ data: { videos: [], has_more: false } });
    if (path === '/v2/oauth/revoke/') return ok({});
    throw new Error('Unexpected provider endpoint');
  };
  const service = createTiktokService({ Model, fetchFn, PageModel: { deleteMany: async () => {} } });
  const begin = async () => { await service.save({ revision: 0, clientKey: 'client-key', clientSecret: 'private-app-secret', enabled: true }); return service.createQr({ revision: 1 }, 'session-one'); };
  const auth = () => JSON.parse(reveal(stored.qrSessionEncrypted));
  return { service, begin, calls, auth, current: () => stored, mutate: value => Object.assign(stored, value),
    reply: value => { reply = value; }, getQr: value => { getQr = value; }, tokens: value => { tokens = value; },
    wait: (path, promise) => { wait = { path, promise }; },
    confirm: (extra = {}) => { reply = { status: 'confirmed', client_ticket: auth().ticket, state: auth().state, redirect_uri: 'https://registered.example.test/return?code=approved%2Bcode', ...extra }; },
  };
}
test('QR connects on a local backend with empty redirect and encrypted pending credentials', async () => {
  const f = fixture(), qr = await f.begin();
  assert.equal(f.current().redirectUri, ''); assert.match(qr.qrImage, /^data:image\/png;base64,iVBOR/);
  assert.match(qr.qrToken, /^[a-f0-9]{64}$/); assert.equal(qr.pollAfterMs, 3000);
  assert.ok(!JSON.stringify(qr).includes('private-provider-poll-token'));
  assert.ok(!f.current().qrSessionEncrypted.includes('private-provider-poll-token'));
  assert.equal(f.calls[0].form.get('scope'), 'user.info.basic,video.list');
  const newStatus = await f.service.checkQr(qr, 'session-one'); assert.equal(newStatus.status, 'new');
  f.reply({ status: 'scanned', client_ticket: f.auth().ticket });
  assert.equal((await f.service.checkQr(qr, 'session-one')).status, 'scanned');
  f.confirm(); const result = await f.service.checkQr(qr, 'session-one');
  assert.equal(result.status, 'confirmed'); assert.equal(result.settings.connected, true);
  assert.equal(result.settings.account.name, 'Cuenta conectada'); assert.equal(f.current().qrSessionEncrypted, '');
  const exchange = f.calls.find(call => call.path === '/v2/oauth/token/').form;
  assert.equal(exchange.get('code'), 'approved+code'); assert.equal(exchange.get('redirect_uri'), 'https://registered.example.test/return');
  assert.equal(reveal(f.current().refreshTokenEncrypted), 'private-refresh-token');
  assert.ok(!JSON.stringify(result).includes('private-'));
  await assert.rejects(() => f.service.checkQr(qr, 'session-one'), error => error.status === 409);
});
test('QR supports the documented code field without inventing a redirect URI', async () => {
  const f = fixture(), qr = await f.begin(); f.confirm({ redirect_uri: undefined, code: 'plain-code' });
  await f.service.checkQr(qr, 'session-one');
  const form = f.calls.find(call => call.path === '/v2/oauth/token/').form;
  assert.equal(form.get('code'), 'plain-code'); assert.equal(form.has('redirect_uri'), false);
});
test('QR rejects mismatched ticket, state and invalid callback data before token exchange', async () => {
  for (const extra of [{ client_ticket: '' }, { client_ticket: 'foreign' }, { state: 'foreign' }, { redirect_uri: 'javascript:alert(1)' }, { redirect_uri: 'https://a:b@example.test/?code=x' }, { code: 'different-code' }, { redirect_uri: 'https://example.test/?code=x&code=y' }, { redirect_uri: 'https://example.test/?code=x&state=foreign' }]) {
    const f = fixture(), qr = await f.begin(); f.confirm(extra);
    await assert.rejects(() => f.service.checkQr(qr, 'session-one'));
    assert.equal(f.calls.some(call => call.path === '/v2/oauth/token/'), false);
    assert.equal(Boolean(f.current().tokenEncrypted), false);
  }
});
test('another admin session cannot poll or cancel the QR', async () => {
  const f = fixture(), qr = await f.begin(), count = f.calls.length;
  await assert.rejects(() => f.service.checkQr(qr, 'session-two'), error => error.status === 403);
  await assert.rejects(() => f.service.cancelQr(qr, 'session-two'), error => error.status === 403);
  await assert.rejects(() => f.service.checkQr({ qrToken: 'bad' }, 'session-one'), error => error.status === 400);
  assert.equal(f.calls.length, count);
});
test('expiry, replacement, cancellation and changed credentials invalidate the old QR', async () => {
  for (const action of ['expired', 'provider-expired', 'replacement', 'cancel', 'credentials']) {
    const f = fixture(), qr = await f.begin();
    if (action === 'expired') f.mutate({ qrExpiresAt: new Date(Date.now() - 1) });
    if (action === 'provider-expired') f.reply({ status: 'expired', client_ticket: '' });
    if (action.endsWith('expired')) { assert.equal((await f.service.checkQr(qr, 'session-one')).status, 'expired'); assert.equal(f.current().qrSessionEncrypted, ''); continue; }
    if (action === 'replacement') await f.service.createQr({ revision: 1 }, 'session-one');
    if (action === 'cancel') await f.service.cancelQr(qr, 'session-one');
    if (action === 'credentials') await f.service.save({ revision: 1, clientKey: 'client-key', clientSecret: 'changed-secret' });
    await assert.rejects(() => f.service.checkQr(qr, 'session-one'), error => error.status === 409);
  }
});
test('duplicate checks coalesce and exchange a confirmed code once', async () => {
  const f = fixture(), qr = await f.begin(); f.confirm();
  const results = await Promise.all([f.service.checkQr(qr, 'session-one'), f.service.checkQr(qr, 'session-one')]);
  assert.ok(results.every(result => result.settings.connected));
  assert.equal(f.calls.filter(call => call.path === '/v2/oauth/token/').length, 1);
});
test('cancel during provider check prevents a late confirmation from connecting', async () => {
  const f = fixture(), qr = await f.begin(); f.confirm(); let release;
  f.wait('/v2/oauth/check_qrcode/', new Promise(resolve => { release = resolve; }));
  const check = f.service.checkQr(qr, 'session-one');
  while (!f.calls.some(call => call.path === '/v2/oauth/check_qrcode/')) await new Promise(resolve => setImmediate(resolve));
  await f.service.cancelQr(qr, 'session-one'); release();
  await assert.rejects(() => check, error => error.status === 409);
  assert.equal(f.calls.some(call => call.path === '/v2/oauth/token/'), false);
});
test('disconnect during QR token exchange prevents the account being installed later', async () => {
  const f = fixture(), qr = await f.begin(); f.confirm(); let release;
  f.wait('/v2/oauth/token/', new Promise(resolve => { release = resolve; }));
  const check = f.service.checkQr(qr, 'session-one');
  while (!f.calls.some(call => call.path === '/v2/oauth/token/')) await new Promise(resolve => setImmediate(resolve));
  await f.service.disconnect({ revision: 1 }); release();
  await assert.rejects(() => check, error => error.name === 'VersionError');
  assert.equal(f.current().tokenEncrypted, ''); assert.equal(f.current().account, null);
});
test('an incomplete video permission grant never installs account credentials', async () => {
  const f = fixture(), qr = await f.begin(); f.confirm();
  f.tokens({ access_token: 'private-access-token', refresh_token: 'private-refresh-token', expires_in: 86400, scope: 'user.info.basic' });
  await assert.rejects(() => f.service.checkQr(qr, 'session-one'), /permisos/);
  assert.equal(Boolean(f.current().tokenEncrypted), false);
});
test('rejects arbitrary QR URLs and stale revisions, and safe settings hide QR sessions', async () => {
  const f = fixture(); await f.begin();
  const settings = JSON.stringify(safeSettings(f.current()));
  for (const secret of ['qrHash', 'qrSessionEncrypted', 'private-provider-poll-token', f.auth().ticket]) assert.ok(!settings.includes(secret));
  await assert.rejects(() => f.service.createQr({ revision: 0 }, 'session-one'), error => error.status === 409);
  f.getQr({ scan_qrcode_url: 'https://evil.example.test/authorize', token: 'private-token' });
  await assert.rejects(() => f.service.createQr({ revision: 1 }, 'session-one'), /QR válido/);
});
test('QR routes are registered in the permission gate and require authentication', async () => {
  const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
  const express = require('express'), app = express(); app.use(express.json()); require('../routes/mountTiktokRoutes')(app);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const suffix of ['/qr', '/qr/check', '/qr/cancel']) {
      const path = `/api/admin/tiktok-settings${suffix}`, rule = findAdminRoutePermission('POST', path);
      assert.equal(rule.permission, 'settings:tiktok'); assert.equal(rule.knownPermission, true);
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST' });
      assert.equal(response.status, 401);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
