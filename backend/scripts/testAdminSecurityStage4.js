'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.ADMIN_2FA_ENCRYPTION_KEY =
  'admin-security-stage4-test-key-with-more-than-32-characters';

const AdminSession = require('../models/AdminSession');
const {
  describeUserAgent,
} = require('../security/adminSecurityCenterService');
const {
  buildTwoFactorPolicy,
  getRequiredTwoFactorRoles,
  isTwoFactorBootstrapRequest,
} = require('../security/adminTwoFactorPolicy');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function testMandatoryTwoFactorPolicy() {
  assert.deepEqual(getRequiredTwoFactorRoles('owner, admin'), ['owner', 'admin']);
  assert.deepEqual(getRequiredTwoFactorRoles('none'), []);
  assert.deepEqual(
    buildTwoFactorPolicy({ role: 'owner', twoFactorEnabled: false }, 'owner,admin'),
    {
      role: 'owner',
      enabled: false,
      required: true,
      compliant: false,
      requiredRoles: ['owner', 'admin'],
      configuredRequired: true,
      enforcementReady: true,
      misconfigured: false,
    }
  );
  assert.equal(
    buildTwoFactorPolicy({ role: 'seller', twoFactorEnabled: false }, 'owner,admin').compliant,
    true
  );
}

function testBootstrapRestriction() {
  assert.equal(
    isTwoFactorBootstrapRequest({ originalUrl: '/api/admin/auth/2fa/setup' }),
    true
  );
  assert.equal(
    isTwoFactorBootstrapRequest({ originalUrl: '/api/admin/auth/security-center' }),
    true
  );
  assert.equal(
    isTwoFactorBootstrapRequest({ originalUrl: '/api/admin/orders' }),
    false
  );
}

function testDeviceDescription() {
  const desktop = describeUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36'
  );
  assert.equal(desktop.browser, 'Google Chrome');
  assert.equal(desktop.operatingSystem, 'Windows');
  assert.equal(desktop.deviceType, 'Computador');

  const mobile = describeUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1'
  );
  assert.equal(mobile.operatingSystem, 'iOS');
  assert.equal(mobile.deviceType, 'Teléfono');
}

function testSessionSchemaProtection() {
  assert.equal(AdminSession.schema.path('deviceIdHash').options.select, false);
  assert.deepEqual(AdminSession.schema.path('riskLevel').options.enum, [
    'low',
    'medium',
    'high',
  ]);
  const deviceIndex = AdminSession.schema.indexes().find(
    ([fields]) => fields.adminUser === 1 && fields.deviceIdHash === 1
  );
  assert.ok(deviceIndex);
}

function testIntegrationContracts() {
  const authRoute = read('backend/routes/adminAuth.js');
  const accessGate = read('backend/middleware/requireAdmin.js');
  const sessionService = read('backend/security/adminSessionService.js');
  const securityUi = read(
    'frontend/src/admin/configuracion/sections/SeguridadSection.jsx'
  );
  const login = read('frontend/src/admin/Login.jsx');

  assert.match(authRoute, /router\.get\('\/security-center'/);
  assert.match(authRoute, /router\.post\('\/sessions\/revoke-others'/);
  assert.match(authRoute, /router\.post\('\/sessions\/revoke-all'/);
  assert.match(authRoute, /sessions\/:sessionRecordId\/revoke/);
  assert.match(authRoute, /blocked_by_policy/);
  assert.match(accessGate, /TWO_FACTOR_SETUP_REQUIRED/);
  assert.match(sessionService, /admin-device:/);
  assert.match(sessionService, /httpOnly:\s*true/);
  assert.match(securityUi, /Sesiones y dispositivos/);
  assert.match(securityUi, /Alertas de seguridad/);
  assert.match(securityUi, /Actividad reciente/);
  assert.match(login, /twoFactorSetupRequired/);
}

function run() {
  testMandatoryTwoFactorPolicy();
  testBootstrapRestriction();
  testDeviceDescription();
  testSessionSchemaProtection();
  testIntegrationContracts();
  console.log('✅ Seguridad administrativa Etapa 4 validada (5 grupos de controles).');
}

try {
  run();
} catch (error) {
  console.error('❌ Falló la seguridad administrativa Etapa 4:', error);
  process.exitCode = 1;
}
