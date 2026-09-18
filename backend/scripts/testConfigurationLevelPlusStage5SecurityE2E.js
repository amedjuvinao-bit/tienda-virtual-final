'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SCENARIO_ID = `configuration-stage5-security-${new Date()
  .toISOString()
  .replace(/[:.]/g, '-')}-${process.pid}`;
const TEST_DATABASE_PREFIX = 'cfg_s5_e2e';
const MAX_TEST_DATABASE_NAME_BYTES = 38;
const REPORT_DIRECTORY = path.join(
  __dirname,
  '..',
  'reports',
  'security-stage5-e2e'
);
const REPORT_PATH = path.join(REPORT_DIRECTORY, `${SCENARIO_ID}.json`);

const OWNER_PASSWORD = 'OwnerE2E!2026#Secure';
const OPERATOR_PASSWORD = 'OperatorE2E!2026#Secure';
const SELLER_PASSWORD = 'SellerE2E!2026#Secure';
const VIEWER_PASSWORD = 'ViewerE2E!2026#Secure';
const ADMIN_PASSWORD = 'AdminE2E!2026#Secure';
const BLOCKED_PASSWORD = 'BlockedE2E!2026#Secure';
const ATTACK_TARGET_PASSWORD = 'AttackE2E!2026#Secure';

function readMongoSourceUri() {
  return String(
    process.env.ADMIN_SECURITY_STAGE5_E2E_MONGO_URI ||
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URL ||
      process.env.DATABASE_URL ||
      ''
  ).trim();
}

function databaseNameFromUri(uri) {
  try {
    return decodeURIComponent(new URL(uri).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
}

function assertSafeTestDatabaseName(databaseName) {
  assert.match(
    databaseName,
    /^cfg_s5_e2e(?:_|$)/,
    `La base temporal debe comenzar por ${TEST_DATABASE_PREFIX}. Recibida: ${
      databaseName || '(vacía)'
    }`
  );
  assert.ok(
    Buffer.byteLength(databaseName, 'utf8') <= MAX_TEST_DATABASE_NAME_BYTES,
    `El nombre de la base temporal supera ${MAX_TEST_DATABASE_NAME_BYTES} bytes.`
  );
}

function buildIsolatedMongoUri() {
  const sourceUri = readMongoSourceUri();
  assert.match(
    sourceUri,
    /^mongodb(?:\+srv)?:\/\//i,
    'Falta una URI MongoDB válida en ADMIN_SECURITY_STAGE5_E2E_MONGO_URI, MONGO_URI o MONGODB_URI.'
  );

  const explicitTestUri = String(
    process.env.ADMIN_SECURITY_STAGE5_E2E_MONGO_URI || ''
  ).trim();

  if (explicitTestUri) {
    const explicitDatabase = databaseNameFromUri(explicitTestUri);
    assertSafeTestDatabaseName(explicitDatabase);
    return { uri: explicitTestUri, databaseName: explicitDatabase };
  }

  const parsed = new URL(sourceUri);
  const suffix = `${Date.now().toString(36)}_${process.pid.toString(36)}_${crypto
    .randomBytes(3)
    .toString('hex')}`;
  const databaseName = `${TEST_DATABASE_PREFIX}_${suffix}`;
  assertSafeTestDatabaseName(databaseName);
  parsed.pathname = `/${databaseName}`;

  return { uri: parsed.toString(), databaseName };
}

const isolatedMongo = buildIsolatedMongoUri();

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = isolatedMongo.uri;
process.env.MONGODB_URI = isolatedMongo.uri;
process.env.JWT_SECRET =
  'configuration-stage5-security-e2e-jwt-secret-2026-at-least-64-characters';
process.env.ADMIN_2FA_ENCRYPTION_KEY =
  'configuration-stage5-security-e2e-encryption-key-2026-at-least-64-characters';
process.env.ADMIN_2FA_REQUIRED_ROLES = 'owner,admin';
process.env.ADMIN_2FA_ISSUER = 'Tienda Virtual E2E';
process.env.ADMIN_COOKIE_SECURE = 'false';
process.env.ADMIN_COOKIE_SAME_SITE = 'lax';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ALLOW_LEGACY_ADMIN_AUTH = 'false';

const express = require('express');
const mongoose = require('mongoose');

const adminAccessGate = require('../middleware/adminAccessGate');
const adminAuthRoutes = require('../routes/adminAuth');
const adminRolesRoutes = require('../routes/adminRoles');
const adminUsersRoutes = require('../routes/adminUsers');
const AdminAuditLog = require('../models/AdminAuditLog');
const AdminLoginAudit = require('../models/AdminLoginAudit');
const AdminRole = require('../models/AdminRole');
const AdminSecurityAlert = require('../models/AdminSecurityAlert');
const AdminSession = require('../models/AdminSession');
const AdminTwoFactorChallenge = require('../models/AdminTwoFactorChallenge');
const AdminUser = require('../models/AdminUser');
const {
  ADMIN_PERMISSION_KEYS,
} = require('../security/adminPermissionCatalog');
const {
  encryptTwoFactorSecret,
  generateRecoveryCodes,
  generateTotp,
  generateTotpSecret,
  hashRecoveryCode,
} = require('../security/adminTwoFactorCrypto');

const report = {
  scenarioId: SCENARIO_ID,
  stage: 'Primera Etapa 5 - seguridad de Configuración Nivel Plus',
  mode: 'HTTP real, MongoDB aislada, sesiones y 2FA reales',
  database: isolatedMongo.databaseName,
  startedAt: new Date().toISOString(),
  completedAt: null,
  outcome: 'running',
  cleanup: {
    databaseDropped: false,
    serverClosed: false,
  },
  actors: [],
  checks: [],
  trace: {},
  error: null,
};

function redactError(error) {
  return {
    name: String(error?.name || 'Error'),
    message: String(error?.message || error || 'Error desconocido')
      .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[MONGODB_URI_REDACTED]')
      .slice(0, 1200),
  };
}

function recordCheck(id, description, evidence = {}) {
  report.checks.push({
    id,
    description,
    status: 'passed',
    evidence,
    occurredAt: new Date().toISOString(),
  });
  console.log(`✅ ${description}`);
}

function safeCookieList(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const combined = headers.get('set-cookie');
  if (!combined) return [];
  return combined.split(/,(?=\s*[^;,\s]+=)/g);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  capture(headers) {
    for (const rawCookie of safeCookieList(headers)) {
      const [nameValue, ...attributes] = String(rawCookie).split(';');
      const separator = nameValue.indexOf('=');
      if (separator <= 0) continue;

      const name = nameValue.slice(0, separator).trim();
      const value = nameValue.slice(separator + 1).trim();
      const expired = attributes.some((attribute) =>
        /^\s*max-age=0\s*$/i.test(attribute)
      );

      if (expired || !value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

class HttpActor {
  constructor({ label, ip, userAgent }) {
    this.label = label;
    this.ip = ip;
    this.userAgent = userAgent;
    this.jar = new CookieJar();
    this.requestCounter = 0;
  }

  async request(baseUrl, method, requestPath, body = undefined) {
    this.requestCounter += 1;
    const headers = {
      Accept: 'application/json',
      Origin: 'http://localhost:5173',
      'User-Agent': this.userAgent,
      'X-Forwarded-For': this.ip,
      'X-Request-Id': `${SCENARIO_ID}-${this.label}-${this.requestCounter}`,
    };

    const cookie = this.jar.header();
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${baseUrl}${requestPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.jar.capture(response.headers);

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { status: response.status, data };
  }
}

function expectStatus(response, expected, label) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    allowed.includes(response.status),
    `${label}: esperaba ${allowed.join('/')}, recibió ${response.status}. ${
      response.data?.message || response.data?.error || ''
    }`
  );
  return response;
}

async function waitFor(predicate, {
  timeoutMs = 5000,
  intervalMs = 50,
  message = 'La condición esperada no se cumplió a tiempo.',
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(message);
}

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
  app.use(express.json({ limit: '256kb' }));
  app.use(adminAccessGate);
  app.use('/api/admin/auth', adminAuthRoutes);
  app.use('/api/admin/users', adminUsersRoutes);
  app.use('/api/admin/roles', adminRolesRoutes);

  // Rutas mínimas reales para comprobar el mismo control global de permisos
  // usado por Órdenes y Dashboard sin cargar módulos comerciales ajenos.
  app.get('/api/orders/admin', (_req, res) => {
    res.json({ ok: true, source: 'security-e2e-orders-probe' });
  });
  app.get('/api/admin/dashboard', (_req, res) => {
    res.json({ ok: true, source: 'security-e2e-dashboard-probe' });
  });

  app.use((error, _req, res, _next) => {
    console.error('❌ Error HTTP en escenario E2E:', error.message);
    res.status(500).json({ ok: false, message: 'Error interno de la prueba E2E.' });
  });

  return app;
}

async function listen(app) {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function seedOwner() {
  const ownerRole = await AdminRole.create({
    name: 'Propietario E2E',
    code: 'owner',
    description: 'Rol propietario temporal del escenario de seguridad.',
    permissions: ADMIN_PERMISSION_KEYS,
    scope: 'global',
    level: 100,
    status: 'active',
    active: true,
    isSystem: true,
    isDefault: false,
  });

  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes(10);
  const owner = new AdminUser({
    firstName: 'Owner',
    lastName: 'E2E',
    displayName: 'Owner Seguridad E2E',
    username: 'owner.e2e',
    email: 'owner.e2e@example.invalid',
    role: 'owner',
    roleRef: ownerRole._id,
    permissions: ADMIN_PERMISSION_KEYS,
    status: 'active',
    active: true,
    emailVerified: false,
    twoFactorEnabled: true,
    twoFactorRequirement: 'required',
    twoFactorSecret: encryptTwoFactorSecret(secret),
    twoFactorRecoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
    twoFactorEnabledAt: new Date(),
    mustChangePassword: false,
    notes: 'Usuario temporal de prueba E2E; no pertenece a producción.',
  });
  await owner.setPassword(OWNER_PASSWORD, { mustChangePassword: false });
  await owner.save();

  return { owner, secret };
}

async function login({ actor, baseUrl, username, password, twoFactorSecret = '' }) {
  const loginResponse = await actor.request(
    baseUrl,
    'POST',
    '/api/admin/auth/login',
    { username, password }
  );

  if (loginResponse.status !== 202) {
    return loginResponse;
  }

  assert.ok(twoFactorSecret, `${username}: el servidor pidió 2FA sin secreto de prueba.`);
  assert.equal(loginResponse.data?.requiresTwoFactor, true);

  const currentCode = generateTotp(twoFactorSecret);
  const wrongCode = currentCode === '000000' ? '111111' : '000000';
  const wrongResponse = await actor.request(
    baseUrl,
    'POST',
    '/api/admin/auth/2fa/verify',
    { code: wrongCode }
  );
  expectStatus(wrongResponse, 400, `${username}: rechazo de TOTP incorrecto`);
  assert.equal(wrongResponse.data?.remainingAttempts, 4);

  const verifyResponse = await actor.request(
    baseUrl,
    'POST',
    '/api/admin/auth/2fa/verify',
    { code: currentCode }
  );
  expectStatus(verifyResponse, 200, `${username}: verificación TOTP`);
  return verifyResponse;
}

async function createRole(ownerActor, baseUrl, payload) {
  const response = await ownerActor.request(
    baseUrl,
    'POST',
    '/api/admin/roles',
    payload
  );
  expectStatus(response, 201, `crear rol ${payload.code}`);
  return response.data?.data;
}

async function createUser(ownerActor, baseUrl, payload) {
  const response = await ownerActor.request(
    baseUrl,
    'POST',
    '/api/admin/users',
    payload
  );
  expectStatus(response, 201, `crear usuario ${payload.username}`);
  return response.data?.data;
}

function userPayload({ username, password, role, status = 'active' }) {
  return {
    firstName: 'Usuario',
    lastName: 'E2E',
    displayName: `Usuario ${username}`,
    username,
    email: `${username}@example.invalid`,
    documentType: 'CC',
    documentNumber: `E2E-${username}`,
    password,
    role,
    status,
    active: status === 'active',
    mustChangePassword: false,
    emailVerified: false,
    notes: 'Cuenta temporal creada por la prueba integral de seguridad.',
  };
}

function publicActor(username, role, purpose) {
  return { username, role, purpose };
}

async function captureTrace() {
  const [roles, users, loginAudits, auditLogs, sessions, alerts, challenges] =
    await Promise.all([
      AdminRole.find({}).sort({ createdAt: 1 }).lean(),
      AdminUser.find({}).sort({ createdAt: 1 }).lean(),
      AdminLoginAudit.find({}).sort({ createdAt: 1 }).lean(),
      AdminAuditLog.find({}).sort({ createdAt: 1 }).lean(),
      AdminSession.find({})
        .select('+sessionId +deviceIdHash')
        .sort({ createdAt: 1 })
        .lean(),
      AdminSecurityAlert.find({}).sort({ createdAt: 1 }).lean(),
      AdminTwoFactorChallenge.find({}).sort({ createdAt: 1 }).lean(),
    ]);

  return {
    counts: {
      roles: roles.length,
      users: users.length,
      loginAudits: loginAudits.length,
      administrativeAudits: auditLogs.length,
      sessions: sessions.length,
      securityAlerts: alerts.length,
      twoFactorChallenges: challenges.length,
    },
    roles: roles.map((role) => ({
      code: role.code,
      scope: role.scope,
      level: role.level,
      permissions: role.permissions,
      active: role.active,
    })),
    users: users.map((user) => ({
      username: user.username,
      role: user.role,
      status: user.status,
      active: user.active,
      twoFactorEnabled: user.twoFactorEnabled,
      mustChangePassword: user.mustChangePassword,
    })),
    loginActivity: loginAudits.map((audit) => ({
      username: audit.username,
      status: audit.status,
      reason: audit.reason,
      ip: audit.ip,
      occurredAt: audit.createdAt,
    })),
    administrativeActivity: auditLogs.map((audit) => ({
      action: audit.action,
      permission: audit.permission,
      username: audit.adminUsername,
      role: audit.adminRole,
      statusCode: audit.statusCode,
      success: audit.success,
      requestId: audit.requestId,
      bodySnapshot: audit.bodySnapshot,
      occurredAt: audit.createdAt,
    })),
    sessions: sessions.map((session) => ({
      username: session.username,
      ip: session.lastIp || session.createdIp,
      deviceLabel: session.deviceLabel,
      riskLevel: session.riskLevel,
      riskSignals: session.riskSignals,
      active: !session.revokedAt,
      revokeReason: session.revokeReason,
      createdAt: session.createdAt,
      revokedAt: session.revokedAt,
    })),
    securityAlerts: alerts.map((alert) => ({
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      username: alert.username,
      occurrenceCount: alert.occurrenceCount,
      notificationStatus: alert.notificationStatus,
      occurredAt: alert.lastOccurredAt,
    })),
    twoFactorChallenges: challenges.map((challenge) => ({
      attempts: challenge.attempts,
      maxAttempts: challenge.maxAttempts,
      consumed: Boolean(challenge.consumedAt),
      consumeReason: challenge.consumeReason,
      occurredAt: challenge.createdAt,
    })),
  };
}

async function runScenario(baseUrl) {
  const { owner, secret: ownerTotpSecret } = await seedOwner();
  report.actors.push(
    publicActor(owner.username, owner.role, 'Gobierno de usuarios, roles, sesiones y 2FA')
  );

  const anonymous = new HttpActor({
    label: 'anonymous',
    ip: '198.51.100.10',
    userAgent: 'SecurityE2E/Anonymous',
  });
  const anonymousAccess = await anonymous.request(
    baseUrl,
    'GET',
    '/api/admin/roles'
  );
  expectStatus(anonymousAccess, 401, 'ruta protegida sin sesión');
  recordCheck(
    'AUTH-01',
    'Las rutas administrativas rechazan solicitudes sin sesión',
    { statusCode: anonymousAccess.status }
  );

  const ownerPrimary = new HttpActor({
    label: 'owner-primary',
    ip: '203.0.113.10',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
  });
  const ownerLogin = await login({
    actor: ownerPrimary,
    baseUrl,
    username: owner.username,
    password: OWNER_PASSWORD,
    twoFactorSecret: ownerTotpSecret,
  });
  expectStatus(ownerLogin, 200, 'login owner con 2FA');
  recordCheck(
    'AUTH-02',
    'El owner exige contraseña y TOTP, rechaza un código incorrecto y acepta el vigente',
    { finalStatusCode: ownerLogin.status }
  );

  const operatorRole = await createRole(ownerPrimary, baseUrl, {
    name: 'Operador de seguridad E2E',
    code: 'security-operator-e2e',
    description: 'Consulta usuarios, perfiles, órdenes, dashboard y logs.',
    permissions: [
      'dashboard:view',
      'orders:view',
      'roles:view',
      'admin-users:view',
      'logs:view',
    ],
    scope: 'global',
    level: 80,
    status: 'active',
    active: true,
  });
  const sellerRole = await createRole(ownerPrimary, baseUrl, {
    name: 'Vendedor limitado E2E',
    code: 'seller-limited-e2e',
    description: 'Solo puede consultar órdenes.',
    permissions: ['orders:view'],
    scope: 'own',
    level: 30,
    status: 'active',
    active: true,
  });
  const viewerRole = await createRole(ownerPrimary, baseUrl, {
    name: 'Visor dashboard E2E',
    code: 'dashboard-viewer-e2e',
    description: 'Solo puede consultar el dashboard.',
    permissions: ['dashboard:view'],
    scope: 'own',
    level: 20,
    status: 'active',
    active: true,
  });
  const adminRole = await createRole(ownerPrimary, baseUrl, {
    name: 'Administrador E2E',
    code: 'admin',
    description: 'Administrador sujeto a la política obligatoria de 2FA.',
    permissions: ADMIN_PERMISSION_KEYS,
    scope: 'global',
    level: 90,
    status: 'active',
    active: true,
  });
  assert.ok(operatorRole?._id && sellerRole?._id && viewerRole?._id && adminRole?._id);
  recordCheck(
    'RBAC-01',
    'El owner crea perfiles reales con permisos y alcances diferentes',
    { rolesCreated: 4 }
  );

  const operator = await createUser(
    ownerPrimary,
    baseUrl,
    userPayload({
      username: 'operator.e2e',
      password: OPERATOR_PASSWORD,
      role: operatorRole.code,
    })
  );
  const seller = await createUser(
    ownerPrimary,
    baseUrl,
    userPayload({
      username: 'seller.e2e',
      password: SELLER_PASSWORD,
      role: sellerRole.code,
    })
  );
  const viewer = await createUser(
    ownerPrimary,
    baseUrl,
    userPayload({
      username: 'viewer.e2e',
      password: VIEWER_PASSWORD,
      role: viewerRole.code,
    })
  );
  const adminPendingTwoFactor = await createUser(
    ownerPrimary,
    baseUrl,
    userPayload({
      username: 'admin.pending-2fa.e2e',
      password: ADMIN_PASSWORD,
      role: adminRole.code,
    })
  );
  const blocked = await createUser(
    ownerPrimary,
    baseUrl,
    userPayload({
      username: 'blocked.e2e',
      password: BLOCKED_PASSWORD,
      role: sellerRole.code,
      status: 'blocked',
    })
  );
  const attackTarget = await createUser(
    ownerPrimary,
    baseUrl,
    userPayload({
      username: 'attack-target.e2e',
      password: ATTACK_TARGET_PASSWORD,
      role: sellerRole.code,
    })
  );
  assert.ok(
    operator?._id &&
      seller?._id &&
      viewer?._id &&
      adminPendingTwoFactor?._id &&
      blocked?._id &&
      attackTarget?._id
  );
  report.actors.push(
    publicActor(operator.username, operator.role, 'Operación con lectura administrativa'),
    publicActor(seller.username, seller.role, 'Consulta exclusiva de órdenes'),
    publicActor(viewer.username, viewer.role, 'Consulta exclusiva de dashboard'),
    publicActor(
      adminPendingTwoFactor.username,
      adminPendingTwoFactor.role,
      'Administrador bloqueado por incumplir 2FA'
    ),
    publicActor(blocked.username, blocked.role, 'Cuenta bloqueada administrativamente'),
    publicActor(attackTarget.username, attackTarget.role, 'Objetivo controlado de fuerza bruta')
  );
  recordCheck(
    'RBAC-02',
    'El owner crea usuarios reales asociados a cada perfil',
    { usersCreated: 6 }
  );

  const operatorActor = new HttpActor({
    label: 'operator',
    ip: '203.0.113.20',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Firefox/130.0',
  });
  expectStatus(
    await login({
      actor: operatorActor,
      baseUrl,
      username: operator.username,
      password: OPERATOR_PASSWORD,
    }),
    200,
    'login operator'
  );
  expectStatus(
    await operatorActor.request(baseUrl, 'GET', '/api/admin/roles'),
    200,
    'operator consulta roles'
  );
  const operatorCannotCreateRole = await operatorActor.request(
    baseUrl,
    'POST',
    '/api/admin/roles',
    {
      name: 'Rol que no debe existir',
      code: 'forbidden-role-e2e',
      permissions: ['dashboard:view'],
    }
  );
  expectStatus(operatorCannotCreateRole, 403, 'operator sin roles:create');
  recordCheck(
    'RBAC-03',
    'El operador consulta lo permitido y no puede crear perfiles',
    { allowedStatus: 200, deniedStatus: operatorCannotCreateRole.status }
  );

  const sellerActor = new HttpActor({
    label: 'seller',
    ip: '203.0.113.30',
    userAgent: 'Mozilla/5.0 (Android 15; Mobile) Chrome/153.0.0.0',
  });
  expectStatus(
    await login({
      actor: sellerActor,
      baseUrl,
      username: seller.username,
      password: SELLER_PASSWORD,
    }),
    200,
    'login seller'
  );
  expectStatus(
    await sellerActor.request(baseUrl, 'GET', '/api/orders/admin'),
    200,
    'seller consulta órdenes'
  );
  const sellerDashboardDenied = await sellerActor.request(
    baseUrl,
    'GET',
    '/api/admin/dashboard'
  );
  expectStatus(sellerDashboardDenied, 403, 'seller sin dashboard:view');
  recordCheck(
    'RBAC-04',
    'El vendedor limitado consulta órdenes y no puede abrir el dashboard',
    { allowedStatus: 200, deniedStatus: sellerDashboardDenied.status }
  );

  const viewerActor = new HttpActor({
    label: 'viewer',
    ip: '203.0.113.40',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari/604.1',
  });
  expectStatus(
    await login({
      actor: viewerActor,
      baseUrl,
      username: viewer.username,
      password: VIEWER_PASSWORD,
    }),
    200,
    'login viewer'
  );
  expectStatus(
    await viewerActor.request(baseUrl, 'GET', '/api/admin/dashboard'),
    200,
    'viewer consulta dashboard'
  );
  const viewerOrdersDenied = await viewerActor.request(
    baseUrl,
    'GET',
    '/api/orders/admin'
  );
  expectStatus(viewerOrdersDenied, 403, 'viewer sin orders:view');
  recordCheck(
    'RBAC-05',
    'El visor consulta el dashboard y no puede consultar órdenes',
    { allowedStatus: 200, deniedStatus: viewerOrdersDenied.status }
  );

  const adminActor = new HttpActor({
    label: 'admin-pending-2fa',
    ip: '203.0.113.50',
    userAgent: 'Mozilla/5.0 (macOS) Safari/18.0',
  });
  expectStatus(
    await login({
      actor: adminActor,
      baseUrl,
      username: adminPendingTwoFactor.username,
      password: ADMIN_PASSWORD,
    }),
    200,
    'login admin pendiente 2FA'
  );
  const adminPolicyDenied = await adminActor.request(
    baseUrl,
    'GET',
    '/api/admin/dashboard'
  );
  expectStatus(adminPolicyDenied, 403, 'política obligatoria 2FA para admin');
  assert.equal(adminPolicyDenied.data?.error, 'TWO_FACTOR_SETUP_REQUIRED');
  recordCheck(
    '2FA-01',
    'Un administrador sin 2FA queda bloqueado por la política obligatoria',
    { statusCode: adminPolicyDenied.status, error: adminPolicyDenied.data?.error }
  );

  const blockedActor = new HttpActor({
    label: 'blocked',
    ip: '203.0.113.60',
    userAgent: 'SecurityE2E/BlockedAccount',
  });
  const blockedLogin = await login({
    actor: blockedActor,
    baseUrl,
    username: blocked.username,
    password: BLOCKED_PASSWORD,
  });
  expectStatus(blockedLogin, 403, 'cuenta bloqueada administrativamente');
  recordCheck(
    'AUTH-03',
    'Una cuenta bloqueada administrativamente no puede iniciar sesión',
    { statusCode: blockedLogin.status }
  );

  const attacker = new HttpActor({
    label: 'attacker',
    ip: '198.51.100.77',
    userAgent: 'SecurityE2E/ControlledBruteForce',
  });
  const bruteForceStatuses = [];
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await attacker.request(
      baseUrl,
      'POST',
      '/api/admin/auth/login',
      {
        username: attackTarget.username,
        password: `WrongPassword!${attempt}#2026`,
      }
    );
    bruteForceStatuses.push(response.status);
  }
  assert.deepEqual(bruteForceStatuses.slice(0, 4), [401, 401, 401, 401]);
  assert.equal(bruteForceStatuses[4], 429);
  const lockedAttackTarget = await AdminUser.findById(attackTarget._id)
    .select('+failedLoginAttempts +lockedUntil')
    .lean();
  assert.equal(lockedAttackTarget.status, 'blocked');
  assert.equal(lockedAttackTarget.active, false);
  assert.equal(lockedAttackTarget.failedLoginAttempts, 5);
  assert.ok(lockedAttackTarget.lockedUntil > new Date());
  recordCheck(
    'AUTH-04',
    'Cinco contraseñas incorrectas bloquean temporalmente la cuenta y el origen',
    { statuses: bruteForceStatuses, failedLoginAttempts: 5 }
  );

  const ownerSecondary = new HttpActor({
    label: 'owner-secondary',
    ip: '198.51.100.88',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Mobile) Chrome/153.0.0.0',
  });
  expectStatus(
    await login({
      actor: ownerSecondary,
      baseUrl,
      username: owner.username,
      password: OWNER_PASSWORD,
      twoFactorSecret: ownerTotpSecret,
    }),
    200,
    'segundo dispositivo owner'
  );

  const securityCenterBefore = await ownerSecondary.request(
    baseUrl,
    'GET',
    '/api/admin/auth/security-center'
  );
  expectStatus(securityCenterBefore, 200, 'centro de seguridad owner');
  assert.ok(securityCenterBefore.data?.security?.summary?.activeSessions >= 2);
  assert.ok(securityCenterBefore.data?.security?.summary?.knownDevices >= 2);
  recordCheck(
    'SESSION-01',
    'El centro de seguridad detecta varias sesiones y dispositivos del owner',
    {
      activeSessions: securityCenterBefore.data.security.summary.activeSessions,
      knownDevices: securityCenterBefore.data.security.summary.knownDevices,
    }
  );

  const revokeOthers = await ownerSecondary.request(
    baseUrl,
    'POST',
    '/api/admin/auth/sessions/revoke-others',
    {
      currentPassword: OWNER_PASSWORD,
      code: generateTotp(ownerTotpSecret),
    }
  );
  expectStatus(revokeOthers, 200, 'revocar otras sesiones owner');
  const revokedPrimarySession = await ownerPrimary.request(
    baseUrl,
    'GET',
    '/api/admin/auth/security-center'
  );
  expectStatus(revokedPrimarySession, 401, 'sesión primaria revocada');
  expectStatus(
    await ownerSecondary.request(
      baseUrl,
      'GET',
      '/api/admin/auth/security-center'
    ),
    200,
    'sesión secundaria conservada'
  );
  recordCheck(
    'SESSION-02',
    'Cerrar las demás sesiones invalida las antiguas y conserva la sesión actual',
    { revokedSessionStatus: revokedPrimarySession.status, currentSessionStatus: 200 }
  );

  const operatorLogout = await operatorActor.request(
    baseUrl,
    'POST',
    '/api/admin/auth/logout'
  );
  expectStatus(operatorLogout, 200, 'logout operator');
  const operatorAfterLogout = await operatorActor.request(
    baseUrl,
    'GET',
    '/api/admin/roles'
  );
  expectStatus(operatorAfterLogout, 401, 'sesión después de logout');
  recordCheck(
    'SESSION-03',
    'Cerrar sesión revoca el registro y elimina el acceso posterior',
    { statusCodeAfterLogout: operatorAfterLogout.status }
  );

  await waitFor(
    async () =>
      (await AdminSecurityAlert.countDocuments({
        notificationStatus: 'processing',
      })) === 0,
    {
      message: 'Las alertas quedaron procesándose más tiempo del esperado.',
    }
  );
  await waitFor(
    async () =>
      (await AdminAuditLog.countDocuments({
        permission: 'admin-users:create',
        success: true,
      })) >= 6 &&
      (await AdminAuditLog.countDocuments({
        permission: 'roles:create',
        success: true,
      })) >= 4 &&
      (await AdminAuditLog.countDocuments({
        permission: 'roles:create',
        adminUsername: operator.username,
        statusCode: 403,
      })) >= 1,
    {
      message: 'La auditoría HTTP no terminó de persistir todos los eventos esperados.',
    }
  );

  const [failedAudits, blockedAudits, blockedAlerts, sessionAudits] =
    await Promise.all([
      AdminLoginAudit.countDocuments({ status: 'failed' }),
      AdminLoginAudit.countDocuments({ status: 'blocked' }),
      AdminSecurityAlert.countDocuments({
        type: { $in: ['login_failure', 'login_blocked'] },
      }),
      AdminAuditLog.countDocuments({ action: 'sessions.revoke_others' }),
    ]);
  assert.ok(failedAudits >= 5);
  assert.ok(blockedAudits >= 1);
  assert.ok(blockedAlerts >= 1);
  assert.equal(sessionAudits, 1);
  recordCheck(
    'TRACE-01',
    'Los accesos fallidos, bloqueos, alertas y acciones de sesión quedan persistidos',
    { failedAudits, blockedAudits, blockedAlerts, sessionAudits }
  );

  const userCreationAudit = await AdminAuditLog.findOne({
    permission: 'admin-users:create',
    success: true,
  })
    .sort({ createdAt: 1 })
    .lean();
  assert.equal(userCreationAudit?.bodySnapshot?.password, '[REDACTED]');
  assert.equal(userCreationAudit?.bodySnapshot?.email, '[REDACTED]');

  const completeAuditText = JSON.stringify(
    await AdminAuditLog.find({}).lean()
  );
  for (const secret of [
    OWNER_PASSWORD,
    OPERATOR_PASSWORD,
    SELLER_PASSWORD,
    VIEWER_PASSWORD,
    ADMIN_PASSWORD,
    BLOCKED_PASSWORD,
    ATTACK_TARGET_PASSWORD,
    generateTotp(ownerTotpSecret),
  ]) {
    assert.equal(completeAuditText.includes(secret), false);
  }
  assert.doesNotMatch(completeAuditText, /"code"\s*:\s*"\d{6}"/);
  recordCheck(
    'TRACE-02',
    'La auditoría redacta contraseñas, correos, tokens y códigos 2FA',
    { password: '[REDACTED]', email: '[REDACTED]' }
  );

  const roleDeniedAudit = await AdminAuditLog.findOne({
    permission: 'roles:create',
    adminUsername: operator.username,
    statusCode: 403,
    success: false,
  }).lean();
  assert.ok(roleDeniedAudit);
  recordCheck(
    'TRACE-03',
    'Los intentos administrativos denegados también quedan auditados',
    {
      username: roleDeniedAudit.adminUsername,
      permission: roleDeniedAudit.permission,
      statusCode: roleDeniedAudit.statusCode,
    }
  );

  const ownerChallenges = await AdminTwoFactorChallenge.find({
    adminUser: owner._id,
  }).lean();
  assert.ok(ownerChallenges.length >= 2);
  assert.ok(
    ownerChallenges.every(
      (challenge) =>
        challenge.consumedAt && challenge.consumeReason === 'verified_totp'
    )
  );
  recordCheck(
    '2FA-02',
    'Los desafíos 2FA se consumen una sola vez y quedan trazados como verificados',
    { verifiedChallenges: ownerChallenges.length }
  );

  report.trace = await captureTrace();
}

async function writeReport() {
  fs.mkdirSync(REPORT_DIRECTORY, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  let server = null;
  let connected = false;

  console.log('');
  console.log('🔐 PRUEBA INTEGRAL DE SEGURIDAD - PRIMERA ETAPA 5');
  console.log(`Escenario: ${SCENARIO_ID}`);
  console.log(`Base temporal aislada: ${isolatedMongo.databaseName}`);
  console.log('La URI, contraseñas, tokens y códigos no se mostrarán.');
  console.log('');

  try {
    assertSafeTestDatabaseName(isolatedMongo.databaseName);

    await mongoose.connect(isolatedMongo.uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 15000,
    });
    connected = true;
    assert.equal(mongoose.connection.name, isolatedMongo.databaseName);
    await mongoose.connection.dropDatabase();

    await Promise.all([
      AdminUser.createIndexes(),
      AdminRole.createIndexes(),
      AdminSession.createIndexes(),
      AdminLoginAudit.createIndexes(),
      AdminAuditLog.createIndexes(),
      AdminSecurityAlert.createIndexes(),
      AdminTwoFactorChallenge.createIndexes(),
    ]);

    const running = await listen(buildApp());
    server = running.server;
    await runScenario(running.baseUrl);

    report.outcome = 'passed';
    console.log('');
    console.log(`✅ Escenario completo aprobado: ${report.checks.length} controles.`);
  } catch (error) {
    report.outcome = 'failed';
    report.error = redactError(error);
    console.error('');
    console.error(`❌ Falló la prueba integral: ${report.error.message}`);
    process.exitCode = 1;
  } finally {
    if (server) {
      try {
        await closeServer(server);
        report.cleanup.serverClosed = true;
      } catch (error) {
        report.cleanup.serverError = redactError(error);
        process.exitCode = 1;
      }
    }

    if (connected || mongoose.connection.readyState !== 0) {
      try {
        assertSafeTestDatabaseName(mongoose.connection.name);
        await mongoose.connection.dropDatabase();
        report.cleanup.databaseDropped = true;
      } catch (error) {
        report.cleanup.databaseError = redactError(error);
        process.exitCode = 1;
      }

      await mongoose.disconnect().catch((error) => {
        report.cleanup.disconnectError = redactError(error);
        process.exitCode = 1;
      });
    }

    report.completedAt = new Date().toISOString();
    await writeReport();
    console.log(`📄 Informe seguro: ${REPORT_PATH}`);
    console.log(
      report.cleanup.databaseDropped
        ? `🧹 Base temporal eliminada: ${isolatedMongo.databaseName}`
        : '⚠️ La limpieza de la base temporal no pudo confirmarse.'
    );
  }
}

main();
