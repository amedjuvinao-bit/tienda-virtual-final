'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const archive = require('../services/freeBackupArchive');
const { configuration, reservePort } = require('./backupAtlasFree');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const AdminUser = require('../models/AdminUser');
const backupRouter = require('../routes/adminBackupPreferences');
const { encryptTwoFactorSecret, generateTotp } = require('../security/adminTwoFactorCrypto');

async function run() {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tv-free-backup-test-'));
  const original = { ...process.env };
  let server;
  try {
    process.env.BACKUP_DIRECTORY = dir;
    process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.MONGO_URI = 'mongodb+srv://user:secret@source.example.com/tienda_virtual';
    process.env.BACKUP_DB_NAME = 'tienda_virtual';
    process.env.STAGING_MONGODB_URI = 'mongodb://localhost:27017/staging';
    delete process.env.BACKUP_MONGODB_URI;
    assert.equal(configuration().database, 'tienda_virtual');
    process.env.STAGING_MONGODB_URI = process.env.MONGO_URI;
    assert.throws(configuration, /otro clúster/);
    process.env.STAGING_MONGODB_URI = 'mongodb://localhost:27017/staging';
    process.env.BACKUP_DB_NAME = 'otra';
    assert.throws(configuration, /deben coincidir/);
    process.env.BACKUP_DB_NAME = 'tienda_virtual';

    const plain = path.join(dir, 'plain');
    const encrypted = path.join(dir, 'encrypted');
    const decrypted = path.join(dir, 'decrypted');
    await fs.promises.writeFile(plain, crypto.randomBytes(200_000));
    const key = archive.encryptionKey();
    await archive.encryptArchive(plain, encrypted, key);
    assert.equal(await archive.verifiedPlaintextDigest(encrypted, key), await archive.sha256(plain));
    await archive.decryptArchive(encrypted, decrypted, key);
    assert.equal(await archive.sha256(decrypted), await archive.sha256(plain));
    assert.equal((await fs.promises.stat(encrypted)).mode & 0o777, 0o600);
    const tampered = path.join(dir, 'tampered');
    const contents = await fs.promises.readFile(encrypted);
    contents[25] ^= 1;
    await fs.promises.writeFile(tampered, contents);
    await assert.rejects(archive.verifiedPlaintextDigest(tampered, key));
    await assert.rejects(archive.decryptArchive(tampered, path.join(dir, 'bad-output'), key));
    assert.equal(fs.existsSync(path.join(dir, 'bad-output')), false);

    const manifestId = crypto.randomBytes(12).toString('hex');
    await fs.promises.writeFile(path.join(dir, `backup-${manifestId}.json`), JSON.stringify({
      id: manifestId, startedAt: new Date().toISOString(), status: 'verificado',
      sha256: await archive.sha256(encrypted), size: (await fs.promises.stat(encrypted)).size,
      steps: [{ name: 'Restauración comprobada', at: new Date().toISOString() }],
    }));
    assert.equal((await archive.listBackups()).length, 1);
    assert.equal(archive.safeBackupId('../evil'), false);
    assert.equal(findAdminRoutePermission('POST', `/api/admin/backup-preferences/runs/${manifestId}/download`).audit, true);

    const file = path.join(dir, `backup-${manifestId}.archive.gz.enc`);
    await fs.promises.copyFile(encrypted, file);
    process.env.ADMIN_2FA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    const secret = 'JBSWY3DPEHPK3PXP';
    const originalFind = AdminUser.findById;
    AdminUser.findById = () => ({ select: async () => ({
      twoFactorEnabled: true, twoFactorSecret: encryptTwoFactorSecret(secret),
      comparePassword: async (password) => password === 'correct',
    }) });
    const download = backupRouter.stack.find((layer) => layer.route?.path === '/runs/:id/download').route.stack.at(-1).handle;
    const invoke = async (id, currentPassword, twoFactorCode) => {
      const response = { statusCode: 200, set() { return this; }, status(status) { this.statusCode = status; return this; },
        json(body) { this.body = body; return this; }, download(_file, _name) { this.downloaded = true; } };
      await download({ params: { id }, adminUserId: 'owner', body: { currentPassword, twoFactorCode } }, response, (error) => { throw error; });
      return response;
    };
    try {
      assert.equal((await invoke('../outside', 'correct', generateTotp(secret))).statusCode, 400);
      assert.equal((await invoke(manifestId, 'wrong', generateTotp(secret))).statusCode, 403);
      assert.equal((await invoke(manifestId, 'correct', generateTotp(secret))).downloaded, true);
      await fs.promises.appendFile(file, 'tamper');
      assert.equal((await invoke(manifestId, 'correct', generateTotp(secret))).statusCode, 409);
    } finally { AdminUser.findById = originalFind; }

    server = await reservePort(0);
    const port = server.address().port;
    const response = await new Promise((resolve, reject) => http.get(`http://127.0.0.1:${port}/api/orders`, resolve).on('error', reject));
    assert.equal(response.statusCode, 503);
    assert.equal(response.headers['retry-after'], '600');
    response.resume();
    await assert.rejects(reservePort(port), /EADDRINUSE/);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    process.env = original;
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
  console.log('Respaldo Free: configuración, cifrado/autenticación, auditoría y mantenimiento OK');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
