'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';

const AdminSecurityAlert = require('../models/AdminSecurityAlert');
const {
  hashFingerprint,
  loginFingerprint,
} = require('../security/adminSecurityAlertService');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function testPersistentAlertSchema() {
  assert.deepEqual(AdminSecurityAlert.schema.path('status').options.enum, [
    'open',
    'reviewed',
    'resolved',
  ]);
  assert.deepEqual(AdminSecurityAlert.schema.path('severity').options.enum, [
    'low',
    'medium',
    'high',
    'critical',
  ]);
  assert.equal(AdminSecurityAlert.schema.path('fingerprint').options.unique, true);
  assert.equal(AdminSecurityAlert.schema.path('notificationRecipients').instance, 'Array');
  assert.ok(
    AdminSecurityAlert.schema.indexes().some(
      ([fields]) => fields.adminUser === 1 && fields.status === 1 && fields.lastOccurredAt === -1
    )
  );
}

function testDeterministicDeduplication() {
  assert.equal(hashFingerprint('same-event'), hashFingerprint('same-event'));
  const occurredAt = new Date('2026-09-18T12:01:00.000Z');
  assert.equal(
    loginFingerprint({ type: 'login_failure', username: 'owner', ip: '1.2.3.4', occurredAt }),
    loginFingerprint({
      type: 'login_failure',
      username: 'OWNER',
      ip: '1.2.3.4',
      occurredAt: new Date('2026-09-18T12:14:59.000Z'),
    })
  );
  assert.notEqual(
    loginFingerprint({ type: 'login_failure', username: 'owner', ip: '1.2.3.4', occurredAt }),
    loginFingerprint({
      type: 'login_failure',
      username: 'owner',
      ip: '1.2.3.4',
      occurredAt: new Date('2026-09-18T12:16:00.000Z'),
    })
  );
}

function testBackendContracts() {
  const authRoute = read('backend/routes/adminAuth.js');
  const sessionService = read('backend/security/adminSessionService.js');
  const alertService = read('backend/security/adminSecurityAlertService.js');
  const centerService = read('backend/security/adminSecurityCenterService.js');

  assert.match(authRoute, /security-alerts\/:alertId\/review/);
  assert.match(authRoute, /security-alerts\/:alertId\/respond/);
  assert.match(authRoute, /verifySecurityActionCredentials/);
  assert.match(authRoute, /block_user/);
  assert.match(sessionService, /recordSessionRiskAlerts/);
  assert.match(alertService, /emailVerified:\s*true/);
  assert.match(alertService, /notificationStatus:\s*'processing'/);
  assert.match(alertService, /no contiene códigos, contraseñas ni tokens/);
  assert.match(centerService, /pendingAlerts/);
  assert.match(centerService, /availableActions/);
}

function testFrontendContracts() {
  const api = read('frontend/src/admin/api/adminAuthApi.js');
  const ui = read('frontend/src/admin/configuracion/sections/SeguridadSection.jsx');

  assert.match(api, /reviewAdminSecurityAlert/);
  assert.match(api, /respondAdminSecurityAlert/);
  assert.match(ui, /Marcar revisada/);
  assert.match(ui, /Responder alerta/);
  assert.match(ui, /Motivo de la respuesta/);
  assert.match(ui, /Bloquear usuario/);
}

function run() {
  testPersistentAlertSchema();
  testDeterministicDeduplication();
  testBackendContracts();
  testFrontendContracts();
  console.log('✅ Seguridad administrativa Etapa 5 validada (4 grupos de controles).');
}

try {
  run();
} catch (error) {
  console.error('❌ Falló la seguridad administrativa Etapa 5:', error);
  process.exitCode = 1;
}
