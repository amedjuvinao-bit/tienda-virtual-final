'use strict';

const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'cart-admin-route-test-secret'.padEnd(64, 'x');
process.env.CART_ACCESS_SECRET = 'cart-admin-access-test-secret'.padEnd(64, 'x');

const Cart = require('../models/Cart');
const AdminUser = require('../models/AdminUser');
const AdminRole = require('../models/AdminRole');

const originals = {
  cartAggregate: Cart.aggregate,
  adminUserFindOne: AdminUser.findOne,
  adminRoleFindOne: AdminRole.findOne,
};

let passed = 0;
function check(condition, message) {
  assert.ok(condition, message);
  passed += 1;
  console.log(`OK ${passed} - ${message}`);
}

function aggregateResult(pipeline = []) {
  const isSummary = pipeline.some((stage) => stage.$group?.cartsWithProducts);
  return Promise.resolve(isSummary
    ? [{
        cartsWithProducts: 21,
        active: 4,
        abandoned: 8,
        recoverable: 6,
        abandonedValue: 900000,
        cartsValue: 2100000,
      }]
    : [{ data: [{ sessionId: 'cart_route_test' }], metadata: [{ total: 21 }] }]);
}

function queryResult(value) {
  return {
    select() { return Promise.resolve(value); },
    lean() { return Promise.resolve(value); },
  };
}

async function request(baseUrl, path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${baseUrl}${path}`, { headers });
  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
  };
}

async function run() {
  Cart.aggregate = aggregateResult;
  AdminUser.findOne = () => queryResult({
    _id: '64b000000000000000000099',
    username: 'limited-admin',
    role: 'operator',
    permissions: [],
    active: true,
    status: 'active',
    deletedAt: null,
    tokenVersion: 0,
    roleRef: null,
    isAccountLocked: () => false,
    toObject() { return { ...this }; },
  });
  AdminRole.findOne = () => queryResult(null);

  const app = express();
  app.use(express.json());
  app.use(require('../middleware/adminAccessGate'));
  app.use('/api/cart', require('../routes/cartRoutes'));

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const allowedToken = jwt.sign(
    { role: 'admin', username: 'route-test', authType: 'legacy' },
    process.env.JWT_SECRET,
    { expiresIn: '2m' }
  );
  const limitedToken = jwt.sign(
    {
      role: 'admin',
      authType: 'db',
      adminUserId: '64b000000000000000000099',
      tokenVersion: 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '2m' }
  );

  try {
    const summary = await request(baseUrl, '/api/cart/admin/summary?sort=recent_activity&view=all&page=1&limit=20', allowedToken);
    const list = await request(baseUrl, '/api/cart/admin?sort=recent_activity&view=all&page=1&limit=20', allowedToken);
    const summaryWithoutSession = await request(baseUrl, '/api/cart/admin/summary');
    const listWithoutSession = await request(baseUrl, '/api/cart/admin');
    const summaryWithoutPermission = await request(baseUrl, '/api/cart/admin/summary', limitedToken);
    const listWithoutPermission = await request(baseUrl, '/api/cart/admin', limitedToken);

    check(summary.status === 200, 'GET /api/cart/admin/summary existe y responde 200');
    check(summary.body.cartsWithProducts === 21, 'el resumen usa el controlador administrativo real');
    check(list.status === 200 && list.body.total === 21, 'GET /api/cart/admin existe y responde 200');
    check(Array.isArray(list.body.data), 'el listado conserva su contrato paginado');
    check(summaryWithoutSession.status === 401, 'el resumen sin sesion responde 401 y nunca 404');
    check(listWithoutSession.status === 401, 'el listado sin sesion responde 401 y nunca 404');
    check(summaryWithoutPermission.status === 403, 'el resumen sin carts:view responde 403');
    check(listWithoutPermission.status === 403, 'el listado sin carts:view responde 403');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    Cart.aggregate = originals.cartAggregate;
    AdminUser.findOne = originals.adminUserFindOne;
    AdminRole.findOne = originals.adminRoleFindOne;
  }

  check(require('mongoose').connection.readyState === 0, 'MongoDB permanecio desconectado');
  console.log(`RESULT ${passed}/${passed}`);
}

run().catch((error) => {
  Cart.aggregate = originals.cartAggregate;
  AdminUser.findOne = originals.adminUserFindOne;
  AdminRole.findOne = originals.adminRoleFindOne;
  console.error(error.stack || error.message);
  process.exit(1);
});
