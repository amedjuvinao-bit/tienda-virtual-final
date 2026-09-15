'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  assertEnv,
  EnvConfigError,
} = require('../config/env');
const { buildCorsOptions } = require('../config/corsOptions');
const {
  getUnsupportedSiteSettingsKeys,
  resolveSiteSettingsWritePermissions,
} = require('../security/siteSettingsWritePermissions');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');
const {
  resolveRulePermissions,
} = require('../middleware/adminAccessGate');
const {
  normalizeScope,
  serializeLoginLog,
  serializeOperationLog,
} = require('../routes/adminAuditLogs');

function sorted(values) {
  return [...values].sort();
}

function assertPermissions(payload, expected) {
  assert.deepStrictEqual(
    sorted(resolveSiteSettingsWritePermissions(payload)),
    sorted(expected)
  );
}

function buildProductionEnv(overrides = {}) {
  return {
    nodeEnv: 'production',
    mongoUri: 'mongodb://127.0.0.1:27017/tienda_virtual_test',
    mongoUriSource: 'MONGO_URI',
    frontendUrl: 'https://tienda.example.com',
    backendUrl: 'https://api.example.com',
    jwtSecret: 'j'.repeat(32),
    cartAccessSecret: 'c'.repeat(32),
    orderPaymentAccessSecret: 'o'.repeat(32),
    billingEncryptionKey: 'b'.repeat(32),
    integrationsEncryptionKey: 'i'.repeat(32),
    mailEncryptionKey: 'm'.repeat(32),
    shipping: {
      defaultProvider: 'manual',
      envia: { requestedMode: 'sandbox', mode: 'sandbox', token: '' },
    },
    ...overrides,
  };
}

assertPermissions({ store: {} }, ['settings:store']);
assertPermissions({ admin: {} }, ['settings:panel']);
assertPermissions({ loginAdmin: {} }, ['settings:login']);
assertPermissions({ billing: {} }, ['billing:settings']);
assertPermissions({ menus: {} }, ['appearance:menus']);
assertPermissions(
  { theme: { colors: {} } },
  ['appearance:update']
);
assertPermissions(
  { theme: { global: { payments: {} } } },
  ['settings:payments']
);
assertPermissions(
  { theme: { global: { envios: {} } } },
  ['settings:shipping']
);
assertPermissions(
  { theme: { colors: {}, global: { payments: {}, envios: {} } }, menus: {} },
  [
    'appearance:update',
    'appearance:menus',
    'settings:payments',
    'settings:shipping',
  ]
);

assert.deepStrictEqual(getUnsupportedSiteSettingsKeys({ store: {}, role: 'owner' }), [
  'role',
]);

const siteSettingsRule = findAdminRoutePermission('PUT', '/api/site-settings');
assert(siteSettingsRule?.dynamic, 'PUT /api/site-settings debe conservar resolución dinámica.');
assert.deepStrictEqual(
  resolveRulePermissions(siteSettingsRule, { body: { store: {} } }),
  ['settings:store']
);

assert.strictEqual(
  findAdminRoutePermission('GET', '/api/admin/audit-logs')?.permission,
  'logs:view'
);
assert.strictEqual(
  findAdminRoutePermission('GET', '/api/admin/audit-logs/export')?.permission,
  'logs:export'
);

assert.strictEqual(normalizeScope('operations'), 'operations');
assert.strictEqual(normalizeScope('invalid'), 'login');
assert.strictEqual(
  serializeLoginLog({ status: 'blocked' }).type,
  'login'
);
assert.strictEqual(
  serializeOperationLog({ success: false }).status,
  'failed'
);

assert.doesNotThrow(() => assertEnv(buildProductionEnv()));
assert.throws(
  () => assertEnv(buildProductionEnv({ jwtSecret: '' })),
  (error) =>
    error instanceof EnvConfigError &&
    error.details.some((detail) => detail.includes('JWT_SECRET'))
);
assert.throws(
  () => assertEnv(buildProductionEnv({ frontendUrl: 'http://tienda.example.com' })),
  (error) =>
    error instanceof EnvConfigError &&
    error.details.some((detail) => detail.includes('FRONTEND_URL'))
);
assert.throws(
  () =>
    assertEnv(
      buildProductionEnv({
        backendUrl: 'https://temporal.trycloudflare.com',
      })
    ),
  (error) =>
    error instanceof EnvConfigError &&
    error.details.some((detail) => detail.includes('BACKEND_URL'))
);
assert.throws(
  () => assertEnv(buildProductionEnv({ mailEncryptionKey: '' })),
  (error) =>
    error instanceof EnvConfigError &&
    error.details.some((detail) => detail.includes('MAIL_ENCRYPTION_KEY'))
);

const productionCors = buildCorsOptions(buildProductionEnv());
productionCors.origin('https://tienda.example.com', (_error, allowed) => {
  assert.strictEqual(allowed, true);
});
productionCors.origin('https://malicioso.example', (_error, allowed) => {
  assert.strictEqual(allowed, false);
});

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
assert(
  indexSource.includes("app.use('/api/admin/audit-logs', adminAuditLogsRoutes)"),
  'La ruta coherente de auditoría debe estar montada.'
);
assert(
  indexSource.includes('cors(buildCorsOptions(env))'),
  'CORS debe usar la lista de orígenes configurada.'
);

console.log('Configuración Nivel Plus Etapa 0 (backend): OK');
