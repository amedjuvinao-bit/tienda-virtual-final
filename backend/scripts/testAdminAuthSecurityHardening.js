'use strict';

const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'admin-auth-security-test-secret-32-chars';

const AdminUser = require('../models/AdminUser');
const AdminSession = require('../models/AdminSession');
const requireAdmin = require('../middleware/requireAdmin');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function testTemporaryLockExpires() {
  const now = new Date('2026-09-18T12:00:00.000Z');
  const user = new AdminUser({
    username: 'security-owner',
    passwordHash: 'hash-for-model-test',
    role: 'owner',
    status: 'active',
    active: true,
    failedLoginAttempts: 4,
  });

  let saves = 0;
  user.save = async function saveForTest() {
    saves += 1;
    return this;
  };

  await user.registerFailedLogin({ now });

  assert.equal(user.failedLoginAttempts, 5);
  assert.equal(user.status, 'blocked');
  assert.equal(user.active, false);
  assert.equal(user.isAccountLocked({ now }), true);

  const afterExpiry = new Date(now.getTime() + 16 * 60 * 1000);
  const released = await user.releaseExpiredLoginLock({ now: afterExpiry });

  assert.equal(released, true);
  assert.equal(user.failedLoginAttempts, 0);
  assert.equal(user.lockedUntil, null);
  assert.equal(user.status, 'active');
  assert.equal(user.active, true);
  assert.equal(saves, 2);

  const manuallyBlocked = new AdminUser({
    username: 'manual-block',
    passwordHash: 'hash-for-model-test',
    role: 'admin',
    status: 'blocked',
    active: false,
    lockedUntil: null,
  });
  manuallyBlocked.save = async function saveForTest() {
    throw new Error('Un bloqueo manual no debe guardarse ni reactivarse.');
  };

  assert.equal(
    await manuallyBlocked.releaseExpiredLoginLock({ now: afterExpiry }),
    false
  );
  assert.equal(manuallyBlocked.status, 'blocked');
  assert.equal(manuallyBlocked.active, false);
}

async function testUnifiedPasswordPolicy() {
  assert.match(
    AdminUser.getPasswordPolicyError('Corta1!'),
    /mínimo 10 caracteres/i
  );
  assert.match(
    AdminUser.getPasswordPolicyError('solominusculas1!'),
    /mayúscula/i
  );
  assert.equal(AdminUser.getPasswordPolicyError('Segura2026!'), '');

  const user = new AdminUser({
    username: 'password-owner',
    passwordHash: 'hash-for-model-test',
    role: 'owner',
  });

  await assert.rejects(
    () => user.setPassword('Debil123'),
    (error) => error?.code === 'ADMIN_PASSWORD_POLICY'
  );

  await user.setPassword('Segura2026!', { mustChangePassword: true });

  assert.equal(user.mustChangePassword, true);
  assert.notEqual(user.passwordHash, 'Segura2026!');
  assert.equal(await user.comparePassword('Segura2026!'), true);
}

async function testRequiredPasswordChangeIsEnforcedByBackend() {
  const originalFindOne = AdminUser.findOne;
  const originalSessionFindOne = AdminSession.findOne;
  const userId = new mongoose.Types.ObjectId();
  const tokenVersion = 7;
  const pendingUser = {
    _id: userId,
    username: 'temporary-owner',
    role: 'owner',
    permissions: ['dashboard:view'],
    branches: [],
    defaultBranch: null,
    deletedAt: null,
    active: true,
    status: 'active',
    mustChangePassword: true,
    tokenVersion,
    releaseExpiredLoginLock: async () => false,
    isAccountLocked: () => false,
  };

  AdminUser.findOne = () => ({
    select: () => Promise.resolve(pendingUser),
  });
  AdminSession.findOne = () => ({
    select: () => Promise.resolve({
      _id: new mongoose.Types.ObjectId(),
      sessionId: 'security-session-id-1234567890',
      adminUser: userId,
      authType: 'db',
      username: 'temporary-owner',
      tokenVersion,
      lastSeenAt: new Date(),
      idleExpiresAt: new Date(Date.now() + 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    }),
  });

  try {
    const token = jwt.sign(
      {
        role: 'admin',
        authType: 'db',
        adminUserId: String(userId),
        username: 'temporary-owner',
        tokenVersion,
        sessionId: 'security-session-id-1234567890',
      },
      process.env.JWT_SECRET,
      {
        algorithm: 'HS256',
        audience: 'tienda-virtual-admin',
        issuer: 'tienda-virtual-backend',
        expiresIn: '5m',
      }
    );

    const req = {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    };
    const res = createResponse();
    let nextCalled = false;

    await requireAdmin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.error, 'PASSWORD_CHANGE_REQUIRED');

    pendingUser.mustChangePassword = false;
    const allowedReq = {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    };
    const allowedRes = createResponse();
    let allowedNextCalled = false;

    await requireAdmin(allowedReq, allowedRes, () => {
      allowedNextCalled = true;
    });

    assert.equal(allowedNextCalled, true);
    assert.equal(allowedReq.adminUserId, String(userId));
  } finally {
    AdminUser.findOne = originalFindOne;
    AdminSession.findOne = originalSessionFindOne;
  }
}

async function run() {
  await testTemporaryLockExpires();
  await testUnifiedPasswordPolicy();
  await testRequiredPasswordChangeIsEnforcedByBackend();

  console.log('✅ Seguridad de autenticación administrativa validada (3 controles).');
}

run().catch((error) => {
  console.error('❌ Falló la validación de seguridad administrativa:', error);
  process.exitCode = 1;
});
