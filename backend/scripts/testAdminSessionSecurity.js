'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'admin-session-security-test-secret-32-chars';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';

const AdminSession = require('../models/AdminSession');
const {
  getAccessCredential,
  isTrustedRequestOrigin,
  rotateRefreshToken,
  startAdminSession,
  verifyAccessToken,
} = require('../security/adminSessionService');

function queryResult(value) {
  return { select: async () => value };
}

async function testHttpOnlySessionIssuance() {
  const originalCreate = AdminSession.create;
  const originalFindOne = AdminSession.findOne;
  const cookies = [];
  let stored = null;

  AdminSession.create = async (input) => {
    stored = { ...input, _id: new mongoose.Types.ObjectId() };
    return stored;
  };
  AdminSession.findOne = () => ({
    select() { return this; },
    sort() { return this; },
    async lean() { return null; },
  });

  try {
    const res = {
      cookie(name, value, options) {
        cookies.push({ name, value, options });
      },
    };
    const req = {
      headers: {
        'user-agent': 'session-security-test',
        'x-forwarded-for': '127.0.0.1',
      },
    };
    const userId = new mongoose.Types.ObjectId();
    const result = await startAdminSession({
      req,
      res,
      tokenPayload: {
        role: 'admin',
        authType: 'db',
        adminUserId: String(userId),
        username: 'owner',
        tokenVersion: 4,
      },
      adminUserId: userId,
      authType: 'db',
      username: 'owner',
      tokenVersion: 4,
    });

    assert.equal(cookies.length, 3);
    assert.equal(cookies.every((cookie) => cookie.options.httpOnly), true);
    assert.equal(cookies.every((cookie) => cookie.options.sameSite === 'lax'), true);
    assert.equal(cookies[0].options.path, '/');
    assert.equal(cookies[1].options.path, '/api/admin/auth');
    assert.equal(cookies[2].options.path, '/');
    assert.notEqual(stored.refreshTokenHash, cookies[1].value);
    assert.equal(stored.refreshTokenHash.length, 64);
    assert.equal(stored.deviceIdHash.length, 64);
    assert.deepEqual(stored.riskSignals, ['new_device']);
    assert.ok(result.expiresAt instanceof Date);

    const decoded = verifyAccessToken(cookies[0].value);
    assert.equal(decoded.sessionId, stored.sessionId);
    assert.equal(decoded.adminUserId, String(userId));

    const credential = getAccessCredential({
      headers: { cookie: `${cookies[0].name}=${cookies[0].value}` },
    });
    assert.equal(credential.source, 'cookie');
    assert.equal(credential.token, cookies[0].value);
  } finally {
    AdminSession.create = originalCreate;
    AdminSession.findOne = originalFindOne;
  }
}

async function testRefreshRotationAndReplayRevocation() {
  const originalFindOne = AdminSession.findOne;
  const originalFindOneAndUpdate = AdminSession.findOneAndUpdate;
  const originalUpdateOne = AdminSession.updateOne;
  const sessionId = 'abcdefghijklmnopqrstuvwx';
  const presented = `${sessionId}.${'z'.repeat(64)}`;
  const existing = {
    _id: new mongoose.Types.ObjectId(),
    sessionId,
    authType: 'db',
    username: 'owner',
    tokenVersion: 1,
    adminUser: new mongoose.Types.ObjectId(),
    revokedAt: null,
    idleExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  };
  let replayReason = '';
  let allowRotation = true;

  AdminSession.findOne = () => queryResult(existing);
  AdminSession.findOneAndUpdate = (filter, update) =>
    queryResult(
      allowRotation
        ? {
            ...existing,
            refreshTokenHash: update.$set.refreshTokenHash,
            idleExpiresAt: update.$set.idleExpiresAt,
          }
        : null
    );
  AdminSession.updateOne = async (_filter, update) => {
    replayReason = update?.$set?.revokeReason || '';
  };

  try {
    const req = {
      method: 'POST',
      headers: {
        cookie: `rb_admin_refresh=${presented}`,
        origin: 'http://localhost:5173',
      },
    };
    const rotated = await rotateRefreshToken(req);
    assert.equal(rotated.ok, true);
    assert.notEqual(rotated.refreshToken, presented);
    assert.equal(rotated.refreshToken.startsWith(`${sessionId}.`), true);

    allowRotation = false;
    const replay = await rotateRefreshToken(req);
    assert.equal(replay.ok, false);
    assert.equal(replay.reason, 'refresh_token_reuse');
    assert.equal(replayReason, 'refresh_token_reuse');
  } finally {
    AdminSession.findOne = originalFindOne;
    AdminSession.findOneAndUpdate = originalFindOneAndUpdate;
    AdminSession.updateOne = originalUpdateOne;
  }
}

function testOriginProtection() {
  assert.equal(
    isTrustedRequestOrigin({
      method: 'POST',
      headers: { origin: 'http://localhost:5173' },
    }),
    true
  );
  assert.equal(
    isTrustedRequestOrigin({
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
    }),
    false
  );
  assert.equal(
    isTrustedRequestOrigin({ method: 'GET', headers: {} }),
    true
  );
}

async function run() {
  await testHttpOnlySessionIssuance();
  await testRefreshRotationAndReplayRevocation();
  testOriginProtection();
  console.log('✅ Seguridad de sesiones administrativas validada (3 controles).');
}

run().catch((error) => {
  console.error('❌ Falló la seguridad de sesiones administrativas:', error);
  process.exitCode = 1;
});
