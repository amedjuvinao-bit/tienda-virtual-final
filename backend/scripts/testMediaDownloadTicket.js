'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { issue, consume } = require('../services/mediaDownloadTicketService');

const id = 'b'.repeat(24);
const owner = { id, userId: 'owner', sessionId: 'active-session' };

function response() {
  return {
    cookie(name, value, options) { this.name = name; this.value = value; this.options = options; },
    clearCookie(name, options) { this.cleared = { name, options }; },
  };
}

function request(res) {
  return { headers: { cookie: `${res.name}=${res.value}` } };
}

const first = response();
issue(first, owner);
assert.equal(first.options.httpOnly, true);
assert.equal(first.options.path, '/');
assert.equal(consume(request(first), first, owner), true);
assert.equal(consume(request(first), first, owner), false, 'Un ticket solo permite una descarga.');
assert.equal(first.cleared.name, first.name);

const second = response();
issue(second, owner);
assert.equal(consume(request(second), second, { ...owner, sessionId: 'another-session' }), false);
assert.equal(consume(request(second), second, owner), false, 'Una sesión incorrecta consume el ticket.');

const third = response();
issue(third, owner);
assert.equal(consume(request(third), third, { ...owner, id: 'c'.repeat(24) }), false);

const fourth = response();
issue(fourth, owner);
assert.equal(consume({ headers: {} }, fourth, owner), false);
assert.equal(consume(request(fourth), fourth, owner), true);

assert.throws(() => issue(response(), { ...owner, sessionId: '' }), /sesión vigente/);

async function routeTest() {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-download-test-'));
  const prior = { ...process.env };
  const AdminUser = require('../models/AdminUser');
  const findById = AdminUser.findById;
  try {
    process.env.BACKUP_DIRECTORY = directory;
    process.env.ADMIN_2FA_ENCRYPTION_KEY = 'a'.repeat(64);
    const { sha256 } = require('../services/freeBackupArchive');
    const { encryptTwoFactorSecret, generateTotp } = require('../security/adminTwoFactorCrypto');
    const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
    const router = require('../routes/adminBackupPreferences');
    const secret = 'JBSWY3DPEHPK3PXP';
    AdminUser.findById = () => ({ select: async () => ({
      twoFactorEnabled: true, twoFactorSecret: encryptTwoFactorSecret(secret),
      comparePassword: async (password) => password === 'correcta',
    }) });
    const file = path.join(directory, `media-${id}.bundle.enc`);
    await fs.promises.writeFile(file, 'copia cifrada de prueba');
    await fs.promises.writeFile(path.join(directory, `media-${id}.json`), JSON.stringify({
      id, kind: 'media', status: 'verificado', size: (await fs.promises.stat(file)).size,
      sha256: await sha256(file),
    }));
    const handler = (method, route) => router.stack.find((layer) =>
      layer.route?.path === route && layer.route?.methods[method.toLowerCase()]).route.stack.at(-1).handle;
    const authorize = handler('POST', '/media-runs/:id/native-download');
    const serve = handler('GET', '/media-runs/:id/file');
    const req = { params: { id }, adminUserId: owner.userId, adminSessionId: owner.sessionId,
      body: { currentPassword: 'correcta', twoFactorCode: generateTotp(secret) }, headers: {} };
    const out = () => ({ ...response(), statusCode: 200, set() { return this; },
      status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; return this; },
      download(source, name) { this.source = source; this.filename = name; return this; } });
    const authResponse = out();
    await authorize(req, authResponse, (error) => { throw error; });
    assert.equal(authResponse.statusCode, 200);
    assert.equal(authResponse.body.url, `/api/admin/backup-preferences/media-runs/${id}/file`);
    const downloadResponse = out();
    await serve({ ...req, headers: request(authResponse).headers }, downloadResponse, (error) => { throw error; });
    assert.equal(downloadResponse.source, file);
    assert.equal(downloadResponse.filename, `media-${id}.bundle.enc`);
    const replayResponse = out();
    await serve({ ...req, headers: request(authResponse).headers }, replayResponse, (error) => { throw error; });
    assert.equal(replayResponse.statusCode, 403);
    assert.equal(findAdminRoutePermission('POST', authResponse.body.url.replace('/file', '/native-download')).audit, true);
    assert.equal(findAdminRoutePermission('GET', authResponse.body.url).danger, true);
  } finally {
    AdminUser.findById = findById;
    process.env = prior;
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

routeTest().then(() => console.log('Descarga nativa: autenticación, integridad, auditoría y uso único correctos.'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
