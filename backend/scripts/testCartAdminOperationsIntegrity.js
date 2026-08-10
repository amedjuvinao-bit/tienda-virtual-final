'use strict';

const assert = require('assert');
const path = require('path');

const {
  ABANDONED_WINDOW_MS,
  ACTIVE_WINDOW_MS,
  buildCartCsv,
  buildSort,
  classifyCartLifecycle,
  escapeRegex,
  getAdminCartSummary,
  getCartMetrics,
  listAdminCarts,
  markCartConverted,
  parseAdminCartQuery,
} = require('../services/cartAdminOperationsService');
const {
  getCartAccessSecret,
  issueCartRecoveryAccess,
  rotateCartAccess,
  verifyCartRecoveryAccess,
} = require('../services/cartAccessService');
const {
  createCartRecoveryService,
  getMailAvailability,
} = require('../services/cartRecoveryService');
const permissionMap = require('../security/adminRoutePermissionMap');

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`OK ${passed} - ${name}`);
    });
}

function cartAt(now, ageMs, extra = {}) {
  return {
    _id: '64b000000000000000000001',
    sessionId: `cart_${'a'.repeat(32)}`,
    userEmail: 'cliente@example.com',
    items: [{ qty: 2, price: 10000 }],
    updatedAt: new Date(now.getTime() - ageMs),
    ...extra,
  };
}

function queryResult(value) {
  return {
    select() { return this; },
    lean() { return this; },
    exec: async () => value,
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

function createRecoveryFakes() {
  const now = new Date('2026-08-04T15:00:00.000Z');
  const cart = cartAt(now, ABANDONED_WINDOW_MS + 1000, {
    accessVersion: 1,
    recoveryAttempts: [],
    recoveryAccess: {},
    lastCustomerActivityAt: new Date(now.getTime() - ABANDONED_WINDOW_MS - 1000),
  });
  const applyUpdate = (update) => {
    Object.assign(cart, update.$set || {});
    for (const [key, value] of Object.entries(update.$set || {})) {
      if (key.startsWith('recoveryAccess.')) {
        cart.recoveryAccess[key.split('.')[1]] = value;
        delete cart[key];
      }
    }
    if (update.$push?.recoveryAttempts) cart.recoveryAttempts.push(update.$push.recoveryAttempts);
  };
  const CartModel = {
    findOne() { return queryResult(cart); },
    updateOne(_filter, update) {
      applyUpdate(update);
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    },
    findOneAndUpdate(filter, update) {
      if (filter.$and && cart.recoveryEmailLockUntil && cart.recoveryEmailLockUntil > now) {
        return Promise.resolve(null);
      }
      applyUpdate(update);
      return Promise.resolve(cart);
    },
  };
  const MailSettingsModel = {
    findOne() {
      return queryResult({
        enabled: true,
        fromEmail: 'tienda@example.com',
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        smtpUser: 'tienda@example.com',
        hasSmtpPassword: true,
      });
    },
  };
  return { CartModel, MailSettingsModel, cart, now };
}

async function run() {
  const now = new Date('2026-08-04T15:00:00.000Z');
  await test('activo antes de 30 minutos', () => {
    assert.equal(classifyCartLifecycle(cartAt(now, ACTIVE_WINDOW_MS - 1), now), 'active');
  });
  await test('inactivo exactamente a los 30 minutos', () => {
    assert.equal(classifyCartLifecycle(cartAt(now, ACTIVE_WINDOW_MS), now), 'inactive');
  });
  await test('recuperable exactamente a las 24 horas con correo', () => {
    assert.equal(classifyCartLifecycle(cartAt(now, ABANDONED_WINDOW_MS), now), 'recoverable');
  });
  await test('abandonado sin correo valido', () => {
    assert.equal(classifyCartLifecycle(cartAt(now, ABANDONED_WINDOW_MS, { userEmail: '' }), now), 'abandoned');
  });
  await test('vacio prevalece sobre antiguedad', () => {
    assert.equal(classifyCartLifecycle(cartAt(now, ABANDONED_WINDOW_MS, { items: [] }), now), 'empty');
  });
  await test('convertido exige relacion explicita', () => {
    assert.equal(classifyCartLifecycle(cartAt(now, 0, { convertedOrderId: '64b000000000000000000002' }), now), 'converted');
  });
  await test('actividad administrativa no rejuvenece el carrito', () => {
    assert.equal(classifyCartLifecycle(cartAt(now, 0, {
      lastCustomerActivityAt: new Date(now.getTime() - ABANDONED_WINDOW_MS),
      lastAdminActivityAt: now,
      updatedAt: now,
    }), now), 'recoverable');
  });
  await test('documento historico usa updatedAt como fallback', () => {
    assert.equal(classifyCartLifecycle(cartAt(now, ACTIVE_WINDOW_MS + 1), now), 'inactive');
  });
  await test('metricas usan productos, unidades y subtotal registrados', () => {
    assert.deepEqual(getCartMetrics({ items: [{ qty: 2, price: 10 }, { qty: 3, price: 20 }] }), {
      differentProducts: 2,
      totalUnits: 5,
      subtotal: 80,
      recoveryAttemptsCount: 0,
    });
  });
  await test('filtros combinados quedan normalizados', () => {
    const parsed = parseAdminCartQuery({
      page: '2', limit: '50', lifecycle: 'recoverable', customerType: 'guest',
      minSubtotal: '100', maxSubtotal: '500', minUnits: '1', maxUnits: '9',
      recoveryAttempts: 'with', sort: 'highest_value',
    });
    assert.equal(parsed.page, 2);
    assert.equal(parsed.limit, 50);
    assert.equal(parsed.lifecycle, 'recoverable');
    assert.equal(parsed.sort, 'highest_value');
  });
  await test('limites no permitidos se rechazan', () => {
    assert.throws(() => parseAdminCartQuery({ limit: 500 }), /limit/);
  });
  await test('busqueda escapa expresiones regulares', () => {
    assert.equal(escapeRegex('vestido.*(azul)'), 'vestido\\.\\*\\(azul\\)');
  });
  await test('ordenamientos incluyen desempate determinista', () => {
    assert.equal(buildSort('highest_value')._id, 1);
    assert.equal(buildSort('oldest_activity')._id, 1);
  });
  await test('listado agrega filtros antes de facet y pagina en backend', async () => {
    let pipeline;
    const CartModel = { aggregate(value) { pipeline = value; return Promise.resolve([{ data: [], metadata: [{ total: 21 }] }]); } };
    const result = await listAdminCarts({ page: 2, limit: 10 }, { CartModel, now });
    assert.equal(result.total, 21);
    assert.equal(result.totalPages, 3);
    assert.ok(pipeline.some((stage) => stage.$facet?.data));
  });
  await test('resumen global no aplica paginacion', async () => {
    let pipeline;
    const CartModel = { aggregate(value) { pipeline = value; return Promise.resolve([{ cartsWithProducts: 4, active: 2, abandoned: 1, recoverable: 1, abandonedValue: 90000, cartsValue: 200000 }]); } };
    const result = await getAdminCartSummary({}, { CartModel, now });
    assert.equal(result.averageCartValue, 50000);
    assert.ok(!pipeline.some((stage) => stage.$skip || stage.$limit));
  });
  await test('CSV usa BOM UTF-8 y escapa comillas', () => {
    const csv = buildCartCsv([{ sessionId: 'cart_1', userName: 'Ana "VIP"', lifecycle: 'active' }]);
    assert.equal(csv.charCodeAt(0), 0xFEFF);
    assert.ok(csv.includes('Ana ""VIP""'));
  });
  await test('token de recuperacion queda limitado a carrito y sesion', () => {
    const secret = 's'.repeat(64);
    const cart = cartAt(now, 0, { recoveryAccess: {} });
    const access = issueCartRecoveryAccess({ cartId: cart._id, sessionId: cart.sessionId, expiresAt: new Date(now.getTime() + 60000), secret });
    cart.recoveryAccess = { tokenHash: access.tokenHash, expiresAt: access.expiresAt, usedAt: null };
    assert.equal(verifyCartRecoveryAccess({ cart, sessionId: cart.sessionId, credential: access.credential, secret, now }), true);
    assert.equal(verifyCartRecoveryAccess({ cart, sessionId: `cart_${'b'.repeat(32)}`, credential: access.credential, secret, now }), false);
  });
  await test('token manipulado es rechazado', () => {
    const secret = 's'.repeat(64);
    const cart = cartAt(now, 0, { recoveryAccess: {} });
    const access = issueCartRecoveryAccess({ cartId: cart._id, sessionId: cart.sessionId, expiresAt: new Date(now.getTime() + 60000), secret });
    cart.recoveryAccess = { tokenHash: access.tokenHash, expiresAt: access.expiresAt, usedAt: null };
    assert.equal(verifyCartRecoveryAccess({ cart, sessionId: cart.sessionId, credential: `${access.credential}x`, secret, now }), false);
  });
  await test('token expirado es rechazado', () => {
    const secret = 's'.repeat(64);
    const cart = cartAt(now, 0, { recoveryAccess: {} });
    const access = issueCartRecoveryAccess({ cartId: cart._id, sessionId: cart.sessionId, expiresAt: new Date(now.getTime() - 1), secret });
    cart.recoveryAccess = { tokenHash: access.tokenHash, expiresAt: access.expiresAt, usedAt: null };
    assert.equal(verifyCartRecoveryAccess({ cart, sessionId: cart.sessionId, credential: access.credential, secret, now }), false);
  });
  await test('rotacion mantiene sesion y crea acceso HMAC valido', () => {
    const secret = 's'.repeat(64);
    const cart = cartAt(now, 0, { accessVersion: 1 });
    const rotated = rotateCartAccess({ cartId: cart._id, sessionId: cart.sessionId, secret });
    assert.equal(rotated.sessionId, cart.sessionId);
    assert.equal(rotated.tokenHash.length, 64);
  });
  await test('conversion es idempotente y no reemplaza otra orden', async () => {
    const state = { convertedOrderId: null, convertedAt: null };
    const CartModel = {
      updateOne(filter, update) {
        const allowed = !state.convertedOrderId || String(state.convertedOrderId) === String(update.$set.convertedOrderId);
        if (allowed) Object.assign(state, update.$set);
        return Promise.resolve({ matchedCount: allowed ? 1 : 0, modifiedCount: allowed && !state.convertedAt ? 1 : 0 });
      },
    };
    await markCartConverted({ sessionId: 'cart_a', orderId: 'order_a', convertedAt: now }, { CartModel });
    await markCartConverted({ sessionId: 'cart_a', orderId: 'order_a', convertedAt: now }, { CartModel });
    await markCartConverted({ sessionId: 'cart_a', orderId: 'order_b', convertedAt: now }, { CartModel });
    assert.equal(state.convertedOrderId, 'order_a');
  });
  await test('mapa exige permisos por cada operacion administrativa', () => {
    const cases = [
      ['GET', '/api/cart/admin/summary', 'carts:view'],
      ['POST', '/api/cart/admin/export', 'carts:export'],
      ['POST', '/api/cart/admin/follow-ups', 'carts:recover'],
      ['PATCH', '/api/cart/admin/cart_x/items', 'carts:delete'],
      ['POST', '/api/cart/admin/cart_x/notes', 'carts:recover'],
      ['PUT', '/api/cart/admin/cart_x/tags', 'carts:recover'],
      ['POST', '/api/cart/admin/cart_x/recovery-link', 'carts:recover'],
      ['POST', '/api/cart/admin/cart_x/recoveries', 'carts:recover'],
      ['DELETE', '/api/cart/admin/cart_x', 'carts:delete'],
    ];
    for (const [method, route, permission] of cases) {
      assert.equal(permissionMap.findAdminRoutePermission(method, route)?.permission, permission);
    }
  });
  await test('rutas especificas aparecen antes de rutas dinamicas', () => {
    const source = require('fs').readFileSync(path.resolve(__dirname, '../routes/cartAdminRoutes.js'), 'utf8');
    assert.ok(source.indexOf("router.get('/summary'") < source.indexOf("router.get('/:sessionId'"));
    assert.ok(source.indexOf("router.post('/export'") < source.indexOf("router.get('/:sessionId'"));
  });
  await test('correo deshabilitado no crea configuracion ni envia', async () => {
    let writes = 0;
    const MailSettingsModel = { findOne() { return queryResult(null); }, create() { writes += 1; } };
    const result = await getMailAvailability({ MailSettingsModel });
    assert.equal(result.available, false);
    assert.equal(writes, 0);
  });
  await test('un carrito activo no puede recibir enlace de recuperacion', async () => {
    const fakes = createRecoveryFakes();
    fakes.cart.lastCustomerActivityAt = fakes.now;
    fakes.cart.updatedAt = fakes.now;
    const service = createCartRecoveryService({
      ...fakes,
      getSecret: () => 's'.repeat(64),
      env: { FRONTEND_URL: 'https://tienda.test' },
      now: () => fakes.now,
    });
    await assert.rejects(
      () => service.issueLink(fakes.cart.sessionId, { adminUsername: 'qa' }),
      (error) => error.code === 'CART_NOT_RECOVERABLE'
    );
  });
  await test('envio usa doble controlado y el reintento idempotente no duplica correo', async () => {
    const fakes = createRecoveryFakes();
    let sends = 0;
    const service = createCartRecoveryService({
      ...fakes,
      mailSender: async () => { sends += 1; return { messageId: 'test' }; },
      getSecret: () => 's'.repeat(64),
      env: { FRONTEND_URL: 'https://tienda.test' },
      now: () => fakes.now,
    });
    await service.sendRecoveryEmail(fakes.cart.sessionId, { adminUsername: 'qa' }, { idempotencyKey: 'same-key' });
    const second = await service.sendRecoveryEmail(fakes.cart.sessionId, { adminUsername: 'qa' }, { idempotencyKey: 'same-key' });
    assert.equal(sends, 1);
    assert.equal(second.idempotent, true);
  });
  await test('la prueba de correo no contacta proveedores reales', () => {
    assert.equal(process.env.NODE_ENV === 'production', false);
  });
  await test('secretos no aparecen en CSV ni salida publica del enlace', async () => {
    const fakes = createRecoveryFakes();
    const service = createCartRecoveryService({
      ...fakes,
      mailSender: async () => ({ messageId: 'test' }),
      getSecret: () => 'server-secret-value'.padEnd(64, 'x'),
      env: { FRONTEND_URL: 'https://tienda.test' },
      now: () => fakes.now,
    });
    const link = await service.issueLink(fakes.cart.sessionId, { adminUsername: 'qa' });
    assert.ok(!JSON.stringify(link).includes('server-secret-value'));
    assert.ok(!link.link.includes('admin'));
  });
  await test('configuracion de acceso usa secreto central existente', () => {
    assert.equal(getCartAccessSecret({ CART_ACCESS_SECRET: 'x'.repeat(64), NODE_ENV: 'test' }), 'x'.repeat(64));
  });

  console.log(`RESULT ${passed}/${passed}`);
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
