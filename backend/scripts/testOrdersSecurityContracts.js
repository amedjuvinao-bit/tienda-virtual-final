'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  applyOrderBranchAccessFilter,
  authorizeOrderAdminScope,
  normalizeBranchId,
} = require('../services/orderAdminScopeService');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const ROOT = path.resolve(__dirname, '..', '..');
const BRANCH_A = '64b000000000000000000001';
const BRANCH_B = '64b000000000000000000002';
const ORDER_ID = '64c000000000000000000001';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

async function runMiddleware(middleware, request) {
  let nextCalled = false;
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  await middleware(request, response, () => {
    nextCalled = true;
  });

  return { nextCalled, response };
}

function operatorRequest(overrides = {}) {
  return {
    method: 'GET',
    query: {},
    adminUser: 'operador',
    adminUsername: 'operador',
    adminRole: 'operator',
    adminAuthType: 'db',
    adminPermissions: ['orders:view'],
    adminBranches: [{ branch: BRANCH_A }],
    adminDefaultBranch: BRANCH_A,
    adminRolePermissionsLoaded: true,
    adminRolePermissions: [],
    headers: {},
    ...overrides,
  };
}

async function verifyHttpAuthenticationContract(legacyToken) {
  const app = express();

  app.get(
    '/orders',
    requireAdmin,
    (req, _res, next) => {
      req.adminRolePermissionsLoaded = true;
      req.adminRolePermissions = [];
      next();
    },
    requirePermission('orders:view'),
    (_req, res) => res.json({ ok: true })
  );
  app.get(
    '/temporary-legacy-compatibility',
    requireAdmin,
    (req, _res, next) => {
      req.adminRolePermissionsLoaded = true;
      req.adminRolePermissions = [];
      next();
    },
    requirePermission('orders:view', { allowLegacyAdmin: true }),
    (_req, res) => res.json({ ok: true })
  );

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    delete process.env.ALLOW_LEGACY_ADMIN_AUTH;
    const anonymous = await fetch(`${baseUrl}/orders`);
    assert.strictEqual(anonymous.status, 401);

    const disabledLegacy = await fetch(`${baseUrl}/orders`, {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });
    assert.strictEqual(disabledLegacy.status, 403);
    assert.strictEqual(
      (await disabledLegacy.json()).error,
      'LEGACY_ADMIN_DISABLED'
    );

    process.env.ALLOW_LEGACY_ADMIN_AUTH = 'true';
    const deniedByRbac = await fetch(`${baseUrl}/orders`, {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });
    assert.strictEqual(deniedByRbac.status, 403);

    const explicitCompatibility = await fetch(
      `${baseUrl}/temporary-legacy-compatibility`,
      { headers: { Authorization: `Bearer ${legacyToken}` } }
    );
    assert.strictEqual(explicitCompatibility.status, 200);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main() {
  const checks = [];
  const ok = (message) => {
    checks.push(message);
    console.log(`OK ${checks.length}: ${message}`);
  };

  const objectIdBranch = new mongoose.Types.ObjectId(BRANCH_A);
  assert.strictEqual(normalizeBranchId(objectIdBranch), BRANCH_A);
  assert.strictEqual(normalizeBranchId({ _id: objectIdBranch }), BRANCH_A);
  const circularBranch = {};
  circularBranch._id = circularBranch;
  assert.strictEqual(normalizeBranchId(circularBranch), '');
  ok('los ObjectId y referencias circulares se normalizan sin recursión infinita');

  const assignedFilter = {};
  const assigned = applyOrderBranchAccessFilter(
    operatorRequest(),
    assignedFilter
  );
  assert.strictEqual(assigned.ok, true);
  assert.strictEqual(assigned.mode, 'assigned');
  assert.strictEqual(assigned.branchIds[0], BRANCH_A);
  assert.strictEqual(assignedFilter.$and[0].$or.length, 2);
  assert.strictEqual(
    String(assignedFilter.$and[0].$or[0].branch.$in[0]),
    BRANCH_A
  );
  assert.strictEqual(
    String(
      assignedFilter.$and[0].$or[1]['inventoryAllocations.branch'].$in[0]
    ),
    BRANCH_A
  );
  ok('el alcance incluye sede principal y asignaciones de inventario');

  const forbidden = applyOrderBranchAccessFilter(
    operatorRequest({ query: { branchId: BRANCH_B } }),
    {}
  );
  assert.strictEqual(forbidden.ok, false);
  assert.strictEqual(forbidden.status, 403);
  assert.strictEqual(forbidden.error, 'BRANCH_FORBIDDEN');
  ok('un operador no puede solicitar una sede ajena');

  const unassigned = applyOrderBranchAccessFilter(
    operatorRequest({ adminBranches: [], adminDefaultBranch: null }),
    {}
  );
  assert.strictEqual(unassigned.ok, false);
  assert.strictEqual(unassigned.error, 'NO_BRANCH_ASSIGNED');
  ok('un usuario operativo sin sede falla de forma cerrada');

  const ownerFilter = { status: 'paid' };
  const owner = applyOrderBranchAccessFilter(
    operatorRequest({ adminRole: 'owner', adminBranches: [] }),
    ownerFilter
  );
  assert.strictEqual(owner.ok, true);
  assert.strictEqual(owner.mode, 'all');
  assert.deepStrictEqual(ownerFilter, { status: 'paid' });
  ok('solo el rol privilegiado conserva alcance global');

  let capturedFilter = null;
  const authorized = await authorizeOrderAdminScope(
    operatorRequest(),
    ORDER_ID,
    {
      exists: async (filter) => {
        capturedFilter = filter;
        return { _id: ORDER_ID };
      },
    }
  );
  assert.strictEqual(authorized.ok, true);
  assert.strictEqual(String(capturedFilter._id), ORDER_ID);
  assert.ok(Array.isArray(capturedFilter.$and));
  const missing = await authorizeOrderAdminScope(
    operatorRequest(),
    ORDER_ID,
    { exists: async () => null }
  );
  assert.strictEqual(missing.status, 404);
  ok('las mutaciones verifican la orden dentro del alcance antes de operar');

  const previousLegacyFlag = process.env.ALLOW_LEGACY_ADMIN_AUTH;
  const previousJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'orders-security-contract-secret';
  delete process.env.ALLOW_LEGACY_ADMIN_AUTH;
  const legacyToken = jwt.sign(
    { role: 'admin', username: 'legacy-admin' },
    process.env.JWT_SECRET
  );
  const disabledLegacy = await runMiddleware(requireAdmin, {
    method: 'GET',
    headers: { authorization: `Bearer ${legacyToken}` },
  });
  assert.strictEqual(disabledLegacy.nextCalled, false);
  assert.strictEqual(disabledLegacy.response.statusCode, 403);
  assert.strictEqual(
    disabledLegacy.response.body.error,
    'LEGACY_ADMIN_DISABLED'
  );
  process.env.ALLOW_LEGACY_ADMIN_AUTH = 'true';
  const enabledLegacy = await runMiddleware(requireAdmin, {
    method: 'GET',
    headers: { authorization: `Bearer ${legacyToken}` },
  });
  assert.strictEqual(enabledLegacy.nextCalled, true);
  await verifyHttpAuthenticationContract(legacyToken);
  if (previousLegacyFlag === undefined) {
    delete process.env.ALLOW_LEGACY_ADMIN_AUTH;
  } else {
    process.env.ALLOW_LEGACY_ADMIN_AUTH = previousLegacyFlag;
  }
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
  ok('HTTP rechaza anonimato y autenticación heredada salvo habilitación explícita');

  const legacyPermission = await runMiddleware(
    requirePermission('orders:view'),
    operatorRequest({
      adminAuthType: 'legacy',
      adminPermissions: [],
    })
  );
  assert.strictEqual(legacyPermission.nextCalled, false);
  assert.strictEqual(legacyPermission.response.statusCode, 403);
  const explicitLegacyPermission = await runMiddleware(
    requirePermission('orders:view', { allowLegacyAdmin: true }),
    operatorRequest({
      adminAuthType: 'legacy',
      adminPermissions: [],
    })
  );
  assert.strictEqual(explicitLegacyPermission.nextCalled, true);
  const legacyRoleBypass = await runMiddleware(
    requirePermission.adminOrOwner(),
    operatorRequest({
      adminRole: 'admin',
      adminAuthType: 'legacy',
      adminPermissions: [],
    })
  );
  assert.strictEqual(legacyRoleBypass.nextCalled, false);
  assert.strictEqual(legacyRoleBypass.response.statusCode, 403);
  const legacyBranchBypass = await runMiddleware(
    requirePermission.branchAccess(() => BRANCH_A),
    operatorRequest({
      adminRole: 'admin',
      adminAuthType: 'legacy',
      adminPermissions: [],
    })
  );
  assert.strictEqual(legacyBranchBypass.nextCalled, false);
  assert.strictEqual(legacyBranchBypass.response.statusCode, 403);
  const dbAdminPermission = await runMiddleware(
    requirePermission('orders:refund'),
    operatorRequest({
      adminRole: 'admin',
      adminPermissions: [],
    })
  );
  assert.strictEqual(dbAdminPermission.nextCalled, true);
  ok('los permisos granulares no se omiten por compatibilidad heredada');

  const ordersRoute = read('backend/routes/orders.js');
  const emailRoute = read('backend/routes/orderEmailRoutes.js');
  const customerNotificationRoute = read(
    'backend/routes/orderCustomerNotificationRoutes.js'
  );
  const paymentRoute = read('backend/routes/payments.js');
  const billingRoute = read('backend/routes/adminBilling.js');
  assert.ok(ordersRoute.includes('buildAuthorizedSelectionFilter'));
  assert.ok(ordersRoute.includes('ensureOrderOperationAccess'));
  assert.ok(ordersRoute.includes('Order.findOne(access.filter)'));
  assert.ok(paymentRoute.includes('requireAuthorizedOrderScope'));
  assert.ok(billingRoute.includes('authorizeOrderAdminScope'));
  assert.strictEqual(
    (ordersRoute.match(/router\.post\('\/:id\/email'/g) || []).length,
    0
  );
  assert.strictEqual(
    (emailRoute.match(/router\.post\(/g) || []).length,
    1
  );
  ok('detalle, documentos, reembolsos, correo y acciones masivas comparten alcance');

  const trustedRuntime = [
    ordersRoute,
    emailRoute,
    customerNotificationRoute,
    paymentRoute,
  ].join('\n');
  assert.ok(!trustedRuntime.includes("req.headers['x-admin-user']"));
  assert.ok(emailRoute.includes('escapeHtml'));
  assert.ok(ordersRoute.includes('ORDER_CUSTOMER_EDITABLE_FIELDS'));
  assert.ok(ordersRoute.includes('customerFields: customer ? Object.keys(customer) : []'));
  ok('actores y datos editables provienen de contratos confiables y acotados');

  const expectedRules = [
    ['GET', '/api/orders/admin', 'orders:view'],
    ['POST', '/api/orders/admin/export', 'orders:export'],
    ['POST', '/api/orders/admin/bulk', 'orders:bulk'],
    ['PATCH', `/api/orders/${ORDER_ID}/status`, 'orders:status'],
    ['GET', `/api/orders/${ORDER_ID}/fulfillment/logistics`, 'orders:view'],
    ['POST', `/api/orders/${ORDER_ID}/fulfillment/logistics/initialize`, 'orders:fulfillment'],
    ['PATCH', `/api/orders/${ORDER_ID}/fulfillment/logistics/shipments/${ORDER_ID}`, 'orders:fulfillment'],
    ['POST', `/api/orders/${ORDER_ID}/email`, 'orders:email'],
    ['GET', `/api/orders/${ORDER_ID}/customer-notifications/whatsapp/preview`, 'orders:email'],
    ['POST', `/api/orders/${ORDER_ID}/customer-notifications/whatsapp/opened`, 'orders:email'],
    ['POST', `/api/orders/${ORDER_ID}/refund`, 'orders:refund'],
    ['GET', `/api/orders/${ORDER_ID}/pdf`, 'billing:download'],
  ];
  for (const [method, url, permission] of expectedRules) {
    assert.strictEqual(
      findAdminRoutePermission(method, url)?.permission,
      permission,
      `${method} ${url}`
    );
  }
  assert.strictEqual(
    findAdminRoutePermission('DELETE', `/api/orders/${ORDER_ID}`),
    null
  );
  ok('el mapa RBAC coincide con los endpoints realmente implementados');

  console.log(`\nSeguridad y contratos de órdenes: ${checks.length} controles superados.`);
}

main().catch((error) => {
  console.error('\nFALLO seguridad y contratos de órdenes:', error);
  process.exitCode = 1;
});
