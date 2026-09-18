'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.ADMIN_2FA_ENCRYPTION_KEY =
  'admin-two-factor-security-test-key-with-32-chars';

const AdminUser = require('../models/AdminUser');
const AdminTwoFactorChallenge = require('../models/AdminTwoFactorChallenge');
const {
  clearTwoFactorChallengeCookie,
  getTwoFactorChallengeToken,
  setTwoFactorChallengeCookie,
} = require('../security/adminSessionService');
const {
  buildTotpUri,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  generateRecoveryCodes,
  generateTotp,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotp,
} = require('../security/adminTwoFactorCrypto');

function testRfc6238Vector() {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(generateTotp(secret, { time: 59_000, digits: 8 }), '94287082');
}

function testTotpWindow() {
  const secret = 'JBSWY3DPEHPK3PXP';
  const time = 1_725_000_000_000;
  const code = generateTotp(secret, { time });
  assert.equal(verifyTotp(secret, code, { time }), true);
  assert.equal(verifyTotp(secret, '000000', { time }), false);
  assert.equal(verifyTotp(secret, code, { time: time + 60_000 }), false);
}

function testAuthenticatedEncryption() {
  const encrypted = encryptTwoFactorSecret('JBSWY3DPEHPK3PXP');
  assert.equal(encrypted.startsWith('v1:'), true);
  assert.equal(encrypted.includes('JBSWY3DPEHPK3PXP'), false);
  assert.equal(decryptTwoFactorSecret(encrypted), 'JBSWY3DPEHPK3PXP');
  assert.throws(() => decryptTwoFactorSecret(`${encrypted}x`));
}

function testRecoveryCodes() {
  const codes = generateRecoveryCodes(10);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  assert.equal(codes.every((code) => /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(code)), true);
  assert.equal(normalizeRecoveryCode(codes[0].toLowerCase()), codes[0]);
  assert.equal(hashRecoveryCode(codes[0]), hashRecoveryCode(codes[0].replace('-', '')));
  assert.equal(hashRecoveryCode(codes[0]).length, 64);
}

function testTotpUri() {
  const uri = buildTotpUri({
    secret: 'JBSWY3DPEHPK3PXP',
    username: 'owner@example.com',
    issuer: 'Rosa Boutique',
  });
  assert.equal(uri.startsWith('otpauth://totp/'), true);
  assert.equal(uri.includes('secret=JBSWY3DPEHPK3PXP'), true);
  assert.equal(uri.includes('period=30'), true);
}

function testChallengeCookie() {
  const cookies = [];
  const cleared = [];
  const res = {
    cookie(name, value, options) { cookies.push({ name, value, options }); },
    clearCookie(name, options) { cleared.push({ name, options }); },
  };
  setTwoFactorChallengeCookie(res, 'challenge.secret');
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].options.httpOnly, true);
  assert.equal(cookies[0].options.path, '/api/admin/auth/2fa');
  assert.equal(cookies[0].options.maxAge, 5 * 60 * 1000);
  assert.equal(
    getTwoFactorChallengeToken({
      headers: { cookie: `${cookies[0].name}=challenge.secret` },
    }),
    'challenge.secret'
  );
  clearTwoFactorChallengeCookie(res);
  assert.equal(cleared[0].options.path, '/api/admin/auth/2fa');
}

function testSchemaProtection() {
  assert.equal(AdminUser.schema.path('twoFactorSecret').options.select, false);
  assert.equal(AdminUser.schema.path('twoFactorPendingSecret').options.select, false);
  assert.equal(AdminUser.schema.path('twoFactorRecoveryCodeHashes').options.select, false);
  assert.equal(AdminTwoFactorChallenge.schema.path('tokenHash').options.select, false);
  assert.equal(AdminTwoFactorChallenge.schema.path('maxAttempts').options.default, 5);
  const ttlIndex = AdminTwoFactorChallenge.schema.indexes().find(
    ([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0
  );
  assert.ok(ttlIndex);
}

function testIntegrationContracts() {
  const root = path.join(__dirname, '..', '..');
  const route = fs.readFileSync(path.join(root, 'backend/routes/adminAuth.js'), 'utf8');
  const login = fs.readFileSync(path.join(root, 'frontend/src/admin/Login.jsx'), 'utf8');
  const security = fs.readFileSync(
    path.join(root, 'frontend/src/admin/configuracion/sections/SeguridadSection.jsx'),
    'utf8'
  );
  const migration = fs.readFileSync(
    path.join(root, 'backend/scripts/migrateAdminTwoFactorIndexes.js'),
    'utf8'
  );

  assert.match(route, /requiresTwoFactor:\s*true/);
  assert.match(route, /router\.post\('\/2fa\/verify'/);
  assert.match(route, /revokeOtherUserSessions/);
  assert.match(route, /requiresTwoFactorOnNextLogin:\s*true/);
  assert.match(login, /TwoFactorChallengeModal/);
  assert.match(security, /startAdminTwoFactorSetup/);
  assert.match(security, /regenerateAdminRecoveryCodes/);
  assert.match(migration, /expireAfterSeconds:\s*0/);
  assert.match(migration, /--confirm-db=/);
}

function run() {
  testRfc6238Vector();
  testTotpWindow();
  testAuthenticatedEncryption();
  testRecoveryCodes();
  testTotpUri();
  testChallengeCookie();
  testSchemaProtection();
  testIntegrationContracts();
  console.log('✅ Seguridad 2FA administrativa validada (8 grupos de controles).');
}

try {
  run();
} catch (error) {
  console.error('❌ Falló la validación de seguridad 2FA:', error);
  process.exitCode = 1;
}
