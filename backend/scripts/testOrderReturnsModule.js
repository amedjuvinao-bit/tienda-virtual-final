/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const OrderReturn = require('../models/OrderReturn');
const AdminRole = require('../models/AdminRole');
const {
  buildReturnEligibility,
  normalizeReturnRequest,
  validateInspection,
} = require('../services/orderReturnService');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const ROOT = path.resolve(__dirname, '..', '..');
const ORDER_ID = '64c000000000000000000001';
const RETURN_ID = '64c000000000000000000002';
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK ${passed}: ${label}`);
}

function source(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function buildOrder({ deliveredAt = new Date('2026-08-01T12:00:00.000Z') } = {}) {
  const product = new mongoose.Types.ObjectId();
  return {
    _id: new mongoose.Types.ObjectId(ORDER_ID),
    orderNumber: 'ORD-RMA-001',
    status: 'delivered',
    payment: { status: 'paid' },
    updatedAt: deliveredAt,
    items: [
      {
        _id: new mongoose.Types.ObjectId(),
        product,
        title: 'Tenis Plus',
        productType: 'physical',
        variantKey: 'm__negro',
        size: 'M',
        color: 'Negro',
        quantity: 3,
        unitPrice: 120000,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        product: new mongoose.Types.ObjectId(),
        title: 'Licencia digital',
        productType: 'digital',
        quantity: 1,
        unitPrice: 50000,
      },
    ],
  };
}

function run() {
  const order = buildOrder();
  const lineId = String(order.items[0]._id);
  const eligibility = buildReturnEligibility(
    order,
    new Map([[lineId, 1]]),
    new Date('2026-08-17T12:00:00.000Z')
  );
  assert.strictEqual(eligibility.length, 1);
  assert.strictEqual(eligibility[0].availableQuantity, 2);
  assert.strictEqual(eligibility[0].eligible, true);
  ok('la elegibilidad incluye solo físicos entregados y descuenta unidades comprometidas');

  const normalized = normalizeReturnRequest(
    order,
    [{ orderItemId: lineId, quantity: 2, reasonCode: 'wrong_size' }],
    eligibility
  );
  assert.strictEqual(normalized[0].requestedQuantity, 2);
  assert.strictEqual(normalized[0].reasonCode, 'wrong_size');
  assert.strictEqual(normalized[0].unitAmount, 120000);
  ok('la solicitud conserva línea histórica, cantidad, motivo y valor unitario');

  assert.throws(
    () => normalizeReturnRequest(
      order,
      [{ orderItemId: lineId, quantity: 3, reasonCode: 'other' }],
      eligibility
    ),
    (error) => error?.code === 'RETURN_QUANTITY_NOT_AVAILABLE'
  );
  ok('dos expedientes no pueden reservar más unidades que las compradas');

  const expiredOrder = buildOrder({ deliveredAt: new Date('2026-05-01T12:00:00.000Z') });
  const expiredLineId = String(expiredOrder.items[0]._id);
  const expiredEligibility = buildReturnEligibility(
    expiredOrder,
    new Map(),
    new Date('2026-08-17T12:00:00.000Z')
  );
  assert.throws(
    () => normalizeReturnRequest(
      expiredOrder,
      [{ orderItemId: expiredLineId, quantity: 1, reasonCode: 'warranty' }],
      expiredEligibility
    ),
    (error) => error?.code === 'RETURN_WINDOW_EXPIRED'
  );
  ok('la ventana vencida falla cerrada sin excepción documentada');

  const overridden = normalizeReturnRequest(
    expiredOrder,
    [{ orderItemId: expiredLineId, quantity: 1, reasonCode: 'warranty' }],
    expiredEligibility,
    { overrideEligibility: true, overrideReason: 'Garantía comercial vigente' }
  );
  assert.strictEqual(overridden.length, 1);
  ok('una excepción de política exige justificación explícita');

  const inspected = validateInspection(
    {
      items: [{ orderItemId: lineId, title: 'Tenis Plus', receivedQuantity: 2 }],
    },
    [{
      orderItemId: lineId,
      sellableQuantity: 1,
      quarantineQuantity: 1,
      damagedQuantity: 0,
      rejectedQuantity: 0,
    }]
  );
  assert.strictEqual(inspected[0].acceptedQuantity, 2);
  assert.strictEqual(inspected[0].sellableQuantity, 1);
  ok('la inspección separa aceptadas de aptas para reventa');

  assert.throws(
    () => validateInspection(
      { items: [{ orderItemId: lineId, title: 'Tenis Plus', receivedQuantity: 2 }] },
      [{ orderItemId: lineId, sellableQuantity: 1 }]
    ),
    (error) => error?.code === 'RETURN_INSPECTION_TOTAL_MISMATCH'
  );
  ok('cada unidad recibida debe quedar clasificada exactamente una vez');

  assert(OrderReturn.schema.path('revision'));
  assert(OrderReturn.schema.path('inventoryRestorations'));
  assert(OrderReturn.schema.path('resolution.replacementOrder'));
  assert(OrderRefund.schema.path('returnCase'));
  assert(Order.schema.path('returnControl.revision'));
  ok('RMA, inventario, cambio y reembolso quedan enlazados en modelos persistentes');

  const expectedRules = [
    ['GET', `/api/orders/${ORDER_ID}/returns`, 'orders:view'],
    ['POST', `/api/orders/${ORDER_ID}/returns`, 'orders:returns'],
    ['PATCH', `/api/orders/${ORDER_ID}/returns/${RETURN_ID}`, 'orders:returns'],
    ['POST', `/api/orders/${ORDER_ID}/returns/${RETURN_ID}/refund`, 'orders:refund'],
    ['POST', `/api/orders/${ORDER_ID}/returns/${RETURN_ID}/exchange`, 'orders:returns'],
  ];
  expectedRules.forEach(([method, url, permission]) => {
    assert.strictEqual(findAdminRoutePermission(method, url)?.permission, permission);
  });
  ok('el mapa global RBAC cubre consulta, operación, reembolso y cambio');

  const roles = AdminRole.getDefaultRoles();
  const manager = roles.find((role) => role.code === 'manager');
  const warehouse = roles.find((role) => role.code === 'warehouse');
  const billing = roles.find((role) => role.code === 'billing');
  assert(manager.permissions.includes('orders:returns'));
  assert(warehouse.permissions.includes('orders:returns'));
  assert(!warehouse.permissions.includes('orders:refund'));
  assert(billing.permissions.includes('orders:refund'));
  assert(!billing.permissions.includes('orders:returns'));
  ok('bodega opera la pieza física y facturación conserva la autoridad monetaria');

  const returnService = source('backend/services/orderReturnService.js');
  const refundService = source('backend/services/orderRefundService.js');
  const ordersRoute = source('backend/routes/orders.js');
  assert(returnService.includes('expectedRevision'));
  assert(returnService.includes('restockQuantity: item.sellableQuantity'));
  assert(refundService.includes('RETURN_INSPECTION_REQUIRED'));
  assert(ordersRoute.includes('allowInventoryRestock: false'));
  ok('la concurrencia es optimista y el endpoint heredado no repone inventario sin inspección');

  const persistentTrace = source('backend/scripts/seedPersistentOrderReturnTrace.js');
  assert(persistentTrace.includes("process.env.MONGODB_URI"));
  assert(persistentTrace.includes("--confirm-persist"));
  assert(persistentTrace.includes("tags: ['demo', 'orders-trace', 'rma-trace']"));
  assert.doesNotMatch(
    persistentTrace,
    /\.(?:deleteOne|deleteMany|findOneAndDelete|findByIdAndDelete|drop)\s*\(/
  );
  assert(persistentTrace.includes('Persistencia: CONSERVADA'));
  ok('la traza Mongo principal exige confirmación y conserva toda la evidencia DEMO');

  console.log(`\nRMA avanzado de órdenes: ${passed}/12 verificaciones aprobadas.`);
}

run();
