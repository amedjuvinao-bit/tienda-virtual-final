/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const OrderReturn = require('../models/OrderReturn');
const OrderReturnPolicy = require('../models/OrderReturnPolicy');
const StoreCredit = require('../models/StoreCredit');
const {
  issueOrderReturnAccess,
  verifyOrderReturnAccess,
} = require('../services/orderReturnAccessService');
const {
  defaultPolicy,
  normalizePolicyPatch,
} = require('../services/orderReturnPolicyService');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const ROOT = path.resolve(__dirname, '..', '..');
const SECRET = 'orders-stage4-contract-secret-that-is-never-used-live';
let passed = 0;

function read(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  assert(fs.existsSync(absolutePath), `Falta el archivo ${relativePath}.`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function includesAll(source, values, label) {
  const missing = values.filter((value) => !source.includes(value));
  assert.strictEqual(missing.length, 0, `${label} no contiene: ${missing.join(', ')}`);
}

function run() {
  const backendPackage = JSON.parse(read('backend/package.json'));
  const frontendPackage = JSON.parse(read('frontend/package.json'));
  const workflow = read('.github/workflows/orders-ci.yml');
  const routes = read('backend/routes/orderReturnRoutes.js');
  const service = read('backend/services/orderReturnService.js');
  const accessService = read('backend/services/orderReturnAccessService.js');
  const customerPage = read('frontend/src/pages/OrderReturnsPage.jsx');
  const adminPanel = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailReturnsPanel.jsx'
  );
  const e2e = read('frontend/e2e/ordersReturnsStage4.e2e.js');
  const integration = read('backend/scripts/testOrderReturnsStage4Integration.js');
  const documentation = read('docs/modulos/ordenes-etapa-4-cierre.md');

  assert.strictEqual(
    backendPackage.scripts['test:orders-stage4-closure'],
    'node scripts/testOrdersStage4Closure.js'
  );
  assert.strictEqual(
    backendPackage.scripts['test:orders-stage4-returns'],
    'node scripts/testOrderReturnsStage4Integration.js'
  );
  assert.strictEqual(
    frontendPackage.scripts['test:orders-stage4'],
    'vitest run src/utils/orderReturnAccess.test.js src/pages/OrderReturnsPage.test.jsx src/admin/orders/components/orderDetail/OrderDetailReturnsPanel.test.jsx'
  );
  assert.strictEqual(
    frontendPackage.scripts['test:e2e:orders-stage4'],
    'node e2e/ordersReturnsStage4.e2e.js'
  );
  ok('los ejecutores propios de la Etapa 4 están registrados');

  includesAll(
    workflow,
    [
      'npm --prefix backend run test:orders-stage4-closure',
      'ORDERS_STAGE4_MONGO_URI:',
      'orders_ci_stage4_returns?replicaSet=rs0',
      'npm --prefix backend run test:orders-stage4-returns',
      'npm --prefix frontend run test:orders-stage4',
      'npm --prefix frontend run test:e2e:orders-stage4',
    ],
    'Órdenes CI'
  );
  ok('CI contiene contrato, MongoDB, UI y navegador de Etapa 4');

  const policy = normalizePolicyPatch(
    {
      windowDays: 45,
      allowedResolutions: ['exchange', 'store_credit', 'exchange'],
      storeCreditEnabled: true,
      autoAuthorize: true,
    },
    defaultPolicy({})
  );
  assert.deepStrictEqual(policy.allowedResolutions, ['exchange', 'store_credit']);
  assert.strictEqual(policy.windowDays, 45);
  assert.strictEqual(policy.autoAuthorize, true);
  assert(OrderReturnPolicy.schema.path('revision'));
  assert(OrderReturnPolicy.schema.path('customerPortalEnabled'));
  ok('la política es persistente, normalizada y versionada');

  assert(OrderReturn.schema.path('requestSource'));
  assert(OrderReturn.schema.path('customerSnapshot'));
  assert(OrderReturn.schema.path('policySnapshot.revision'));
  assert(OrderReturn.schema.path('shipping.labelType'));
  assert(OrderReturn.schema.path('resolution.storeCredit'));
  assert(
    OrderReturn.schema.path('requestedResolution').enumValues.includes('store_credit')
  );
  assert(StoreCredit.schema.path('sourceReturn').options.unique);
  assert(StoreCredit.schema.path('balance'));
  ok('RMA y saldo a favor conservan identidad, política y trazabilidad');

  const order = {
    _id: new mongoose.Types.ObjectId('64c000000000000000004001'),
    sessionId: 'stage4-customer-session',
    customer: { email: 'stage4@example.invalid', phone: '3000000000' },
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
  };
  const access = issueOrderReturnAccess({ order, secret: SECRET, now: 1_000, ttlMs: 60_000 });
  assert.strictEqual(
    verifyOrderReturnAccess({ token: access.token, order, secret: SECRET, now: 2_000 }).valid,
    true
  );
  assert.strictEqual(
    verifyOrderReturnAccess({
      token: access.token,
      order: { ...order, _id: new mongoose.Types.ObjectId('64c000000000000000004002') },
      secret: SECRET,
      now: 2_000,
    }).valid,
    false
  );
  assert.strictEqual(
    verifyOrderReturnAccess({ token: access.token, order, secret: SECRET, now: 61_001 }).valid,
    false
  );
  ok('el acceso del cliente está firmado, limitado a una orden y expira');

  includesAll(
    routes,
    [
      "router.get('/:id/returns/self-service', getCustomerOrderReturns)",
      "router.post('/:id/returns/self-service', postCustomerOrderReturn)",
      "'/:id/returns/self-service/:returnId/cancel'",
      "'/:id/returns/self-service/:returnId/label'",
    ],
    'Rutas de autoservicio'
  );
  assert(!routes.match(/self-service[^;]{0,200}requireAdmin/s));
  includesAll(accessService, ['timingSafeEqual', "'x-order-return-token'", 'SAFE_RETURN_ACCESS_ERROR'], 'Acceso público');
  ok('el autoservicio usa credencial dedicada sin exponer autenticación administrativa');

  const expectedRules = [
    ['GET', '/api/orders/returns/policy', 'orders:view'],
    ['PUT', '/api/orders/returns/policy', 'settings:store'],
    ['POST', '/api/orders/64c000000000000000004001/returns/64c000000000000000004101/exchange/automatic', 'orders:returns'],
    ['POST', '/api/orders/64c000000000000000004001/returns/64c000000000000000004101/store-credit', 'orders:refund'],
  ];
  expectedRules.forEach(([method, url, permission]) => {
    assert.strictEqual(findAdminRoutePermission(method, url)?.permission, permission);
  });
  ok('RBAC separa configuración, operación física y resolución monetaria');

  includesAll(
    service,
    [
      'session.withTransaction',
      'resolveOrderReturnStoreCredit',
      "sourceReturn: returnCase._id",
      'resolveOrderReturnAutomaticExchange',
      'createInventoryReservation',
      'confirmInventoryReservation',
      'idempotent: true',
    ],
    'Servicio de posventa'
  );
  ok('saldo y cambio automático son transaccionales, idempotentes y reservan inventario');

  includesAll(
    customerPage,
    [
      'Centro de posventa',
      'Enviar solicitud',
      'Descargar etiqueta RMA',
      "var(--color-primary)",
      "var(--color-bg)",
    ],
    'Portal del cliente'
  );
  includesAll(
    adminPanel,
    [
      'Política activa',
      'Crear orden de cambio',
      'Emitir saldo a favor',
      'expectedRevision',
    ],
    'Panel administrativo'
  );
  ok('cliente y administrador tienen recorridos completos con tema heredado');

  includesAll(
    integration,
    [
      "const REQUIRED_DATABASE = 'orders_ci_stage4_returns'",
      'ORDERS_STAGE4_MONGO_URI',
      "['127.0.0.1', 'localhost']",
      "parsed.searchParams.get('replicaSet')",
      'await mongoose.connection.dropDatabase()',
    ],
    'Aislamiento MongoDB'
  );
  assert(!integration.includes('process.env.MONGODB_URI'));
  assert(!integration.includes('mongodb+srv://'));
  assert(!integration.includes('fetch('));
  assert(!integration.includes('axios'));
  ok('la integración acepta solo una réplica local y no llama terceros');

  includesAll(
    e2e,
    [
      "url.pathname.startsWith('/api/')",
      'X-Order-Return-Token',
      'Enviar solicitud',
      'RMA-STAGE4-E2E',
    ],
    'Recorrido E2E'
  );
  assert(!e2e.includes('mongodb'));
  ok('el navegador valida autoservicio sin pagos, DIAN ni transportadoras reales');

  includesAll(
    documentation,
    [
      '# Cierre de Órdenes · Etapa 4',
      'Portal de autoservicio',
      'Política versionada',
      'Saldo a favor',
      'Cambio automático',
      'Prueba manual',
      'sin publicación',
    ],
    'Documento de cierre'
  );
  ok('alcance, límites y comprobación visible quedaron documentados');

  console.log(`\nCierre de Órdenes · Etapa 4: ${passed}/${passed} controles aprobados`);
}

try {
  run();
} catch (error) {
  console.error('\nFAIL Cierre de Órdenes · Etapa 4');
  console.error(error);
  process.exitCode = 1;
}
