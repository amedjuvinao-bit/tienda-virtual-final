'use strict';

const assert = require('node:assert/strict');
const requirePermission = require('../middleware/requirePermission');
const BackupPreference = require('../models/BackupPreference');
const router = require('../routes/adminBackupPreferences');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const AdminUser = require('../models/AdminUser');
const backupMaintenance = require('../services/backupMaintenanceService');
const { encryptTwoFactorSecret, generateTotp } = require('../security/adminTwoFactorCrypto');
const crypto = require('node:crypto');

const put = router.stack.find((layer) => layer.route?.methods?.put).route.stack[0].handle;
const get = router.stack.find((layer) => layer.route?.methods?.get).route.stack[0].handle;

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    set() { return this; },
    once() { return this; },
    json(data) { this.body = data; return this; },
  };
}

async function call(handle, req) {
  const res = response();
  await handle(req, res, (error) => { throw error; });
  return res;
}

async function run() {
  assert.equal(findAdminRoutePermission('PUT', '/api/admin/backup-preferences').audit, true);
  const ownerOnly = requirePermission.ownerOnly();
  const forbidden = response();
  ownerOnly({ method: 'PUT', adminUserId: '123', adminRole: 'admin' }, forbidden, () => {
    throw new Error('Admin must not pass owner guard');
  });
  assert.equal(forbidden.statusCode, 403);
  const allowed = response();
  let passed = false;
  ownerOnly({ method: 'PUT', adminUserId: '123', adminRole: 'owner', adminAuthType: 'db' }, allowed, () => { passed = true; });
  assert.equal(passed, true);

  const original = {
    findById: BackupPreference.findById,
    create: BackupPreference.create,
    findOneAndUpdate: BackupPreference.findOneAndUpdate,
    findAdminById: AdminUser.findById,
    begin: backupMaintenance.begin,
  };
  let current = null;
  BackupPreference.findById = () => ({ lean: async () => current });
  BackupPreference.create = async (data) => {
    if (current) { const conflict = new Error('duplicate'); conflict.code = 11000; throw conflict; }
    current = { ...data, updatedAt: new Date() };
    return current;
  };
  BackupPreference.findOneAndUpdate = async (filter, update) => {
    if (current?.revision !== filter.revision) return null;
    current = { ...current, ...update.$set, revision: current.revision + 1 };
    return current;
  };
  try {
    const empty = await call(get, {});
    assert.equal(empty.body.backupVerified, false);
    assert.equal(empty.body.revision, 0);

    const invalid = await call(put, { body: { strategy: 'atlas_managed', revision: 0, password: 'secret' } });
    assert.equal(invalid.statusCode, 400);

    const created = await call(put, { body: { strategy: 'free_manual', revision: 0 }, adminUsername: 'owner' });
    assert.equal(created.body.strategy, 'free_manual');
    assert.equal(created.body.backupVerified, false);

    const stale = await call(put, { body: { strategy: 'atlas_managed', revision: 0 }, adminUsername: 'owner' });
    assert.equal(stale.statusCode, 409);
    assert.equal(current.strategy, 'free_manual');

    const updated = await call(put, { body: { strategy: 'atlas_managed', revision: 1 }, adminUsername: 'owner' });
    assert.equal(updated.body.revision, 2);
    assert.equal(updated.body.strategy, 'atlas_managed');

    const oldSession = await call(put, { body: { strategy: 'free_manual', revision: 1 }, adminUsername: 'owner' });
    assert.equal(oldSession.statusCode, 409);
    assert.equal(current.strategy, 'atlas_managed');

    const start = router.stack.find((layer) => layer.route?.path === '/start').route.stack.at(-1).handle;
    process.env.ADMIN_2FA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    const secret = 'JBSWY3DPEHPK3PXP';
    AdminUser.findById = () => ({ select: async () => ({ twoFactorEnabled: true,
      twoFactorSecret: encryptTwoFactorSecret(secret), comparePassword: async (value) => value === 'correct' }) });
    let starts = 0;
    backupMaintenance.begin = async () => { starts += 1; return 'a'.repeat(24); };
    const credentials = { currentPassword: 'correct', twoFactorCode: generateTotp(secret) };
    const wrong = await call(start, { adminUserId: 'owner', adminUsername: 'owner', body: { ...credentials, currentPassword: 'wrong' } });
    assert.equal(wrong.statusCode, 403);
    assert.equal(starts, 0);
    const paid = await call(start, { adminUserId: 'owner', adminUsername: 'owner', body: credentials });
    assert.equal(paid.statusCode, 409);
    current.strategy = 'free_manual';
    const accepted = await call(start, { adminUserId: 'owner', adminUsername: 'owner', body: credentials });
    assert.equal(accepted.statusCode, 202);
    assert.equal(starts, 1);
    assert.equal(findAdminRoutePermission('POST', '/api/admin/backup-preferences/start').audit, true);
  } finally {
    BackupPreference.findById = original.findById;
    BackupPreference.create = original.create;
    BackupPreference.findOneAndUpdate = original.findOneAndUpdate;
    AdminUser.findById = original.findAdminById;
    backupMaintenance.begin = original.begin;
  }
  console.log('Preferencias de respaldo: owner, auditoría, validación y conflictos OK');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
