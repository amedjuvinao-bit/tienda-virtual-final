/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Order = require('../models/Order');
const {
  needsOperationalReconciliation,
  validateOrderStatusTransition,
} = require('../services/orderStatusTransitionService');
const {
  requireOrderBulkActionPermission,
} = require('../middleware/orderBulkActionPermission');

let passed = 0;

function read(relativePath) {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', relativePath),
    'utf8'
  );
}

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

async function evaluateBulkPermission(actionType, permissions) {
  const req = {
    method: 'POST',
    body: { action: { type: actionType } },
    adminUserId: 'bulk-contract-user',
    adminRole: 'operator',
    adminPermissions: permissions,
    adminEffectivePermissionsLoaded: true,
    adminEffectivePermissions: permissions,
  };
  const outcome = { nextCalled: false, status: 200, payload: null };
  const res = {
    status(status) {
      outcome.status = status;
      return this;
    },
    json(payload) {
      outcome.payload = payload;
      return payload;
    },
  };
  await requireOrderBulkActionPermission(req, res, () => {
    outcome.nextCalled = true;
  });
  return outcome;
}

async function run() {
  const service = [
    'backend/services/orderStatusTransitionService.js',
    'backend/services/orderStatus/stateMachine.js',
    'backend/services/orderStatus/operationalValidation.js',
    'backend/services/orderStatus/operationalEffects.js',
    'backend/services/orderStatus/singleTransition.js',
    'backend/services/orderStatus/bulkTransition.js',
  ].map(read).join('\n');
  const routes = read('backend/routes/orders.js');
  const bulkController = read('backend/controllers/orderBulkController.js');
  const bulkPermission = read(
    'backend/middleware/orderBulkActionPermission.js'
  );
  const index = read('backend/index.js');
  const selectionActions = read(
    'frontend/src/admin/orders/hooks/useOrdersAdminSelectionActions.js'
  );
  const actionToolbarModel = read(
    'frontend/src/admin/orders/components/orderDetail/orderActionToolbarModel.js'
  );
  const actionForms = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailActionForms.jsx'
  );

  assert(service.includes('confirmInventoryReservation'));
  assert(service.includes('releaseInventoryReservation'));
  assert(service.includes('processOrderFulfillmentAfterPayment'));
  ok('Pago, liberación y cumplimiento usan un único servicio');

  assert(service.includes('session.withTransaction'));
  assert(service.includes('ordered: true'));
  assert(service.includes("targetStatus === 'paid'"));
  assert(
    service.includes("['cancelled', 'failed'].includes(targetStatus)")
  );
  ok('Cada transición crítica se ejecuta dentro de una transacción');

  assert(service.includes('ORDER_REFUND_REQUIRED'));
  assert(service.includes('ORDER_STATUS_TRANSITION_NOT_ALLOWED'));
  assert(service.includes('ORDER_PAYMENT_NOT_CONFIRMED'));
  assert(service.includes('ORDER_PAYMENT_CONFIRMATION_REQUIRED'));
  assert(service.includes('needsOperationalReconciliation'));
  assert(service.includes('status_reconciled'));
  assert.strictEqual(
    needsOperationalReconciliation(
      {
        status: 'paid',
        payment: { status: 'pending_manual' },
        inventoryControl: {
          reservationRequired: true,
          discountedAtCheckout: false,
        },
        items: [],
      },
      'paid'
    ),
    true
  );
  assert.throws(
    () =>
      validateOrderStatusTransition(
        {
          status: 'pending',
          payment: { status: 'pending_manual' },
        },
        'paid'
      ),
    (error) => error?.code === 'ORDER_PAYMENT_CONFIRMATION_REQUIRED'
  );
  assert.throws(
    () =>
      validateOrderStatusTransition(
        {
          status: 'cancelled',
          payment: { status: 'paid' },
        },
        'cancelled'
      ),
    (error) => error?.code === 'ORDER_REFUND_REQUIRED'
  );
  ok('La máquina de estados bloquea cancelaciones y saltos inseguros');

  const bulkStart = routes.search(/router\.post\(\s*['"]\/admin\/bulk/);
  const bulkEnd = routes.indexOf(
    'POST /api/orders/admin/export',
    bulkStart
  );
  const bulkRoute = routes.slice(bulkStart, bulkEnd);
  assert(bulkRoute.includes('applyOrderBulkAction'));
  assert(bulkController.includes('processBulkOrderStatusTransitions'));
  assert(!bulkController.includes('o.status = status'));
  ok('La ruta masiva dejó de escribir status directamente');

  assert(bulkRoute.includes('requireOrderBulkActionPermission'));
  assert(bulkPermission.includes("status: 'orders:status'"));
  assert(bulkPermission.includes("tags_add: 'orders:tags'"));
  assert(bulkPermission.includes("tags_remove: 'orders:tags'"));
  assert(bulkPermission.includes("['orders:bulk', actionPermission]"));
  assert(bulkController.includes('result.failed > 0 ? 207 : 200'));
  const deniedStatus = await evaluateBulkPermission('status', ['orders:bulk']);
  assert.strictEqual(deniedStatus.nextCalled, false);
  assert.strictEqual(deniedStatus.status, 403);
  const allowedStatus = await evaluateBulkPermission('status', [
    'orders:bulk',
    'orders:status',
  ]);
  assert.strictEqual(allowedStatus.nextCalled, true);
  const deniedTags = await evaluateBulkPermission('tags_add', ['orders:bulk']);
  assert.strictEqual(deniedTags.status, 403);
  const allowedTags = await evaluateBulkPermission('tags_remove', [
    'orders:bulk',
    'orders:tags',
  ]);
  assert.strictEqual(allowedTags.nextCalled, true);
  ok('Permiso y respuesta parcial reflejan el resultado real');

  const orderStatuses = Order.schema.path('status')?.enumValues || [];
  assert(
    ['shipped', 'delivered', 'cancelled'].every((status) =>
      orderStatuses.includes(status)
    )
  );
  assert(!index.includes('deliveredAliases'));
  ok('Entregado pertenece al modelo y ya no usa un atajo inseguro');

  assert(selectionActions.includes('response?.data?.results'));
  assert(selectionActions.includes('setSelectedIds(failedIds)'));
  assert(selectionActions.includes('result.paymentStatus'));
  ok('La interfaz solo actualiza las órdenes que sí cambiaron');

  assert(
    !actionToolbarModel.includes("{ code: 'refunded', label: 'Reembolsado' }")
  );
  assert(
    actionToolbarModel.includes(
      'Reembolsado (solo devolución)'
    )
  );
  assert(actionForms.includes('disabled={option.disabled === true}'));
  ok('Reembolsado no se puede asignar como un estado manual');

  console.log(
    `\nContrato de estados masivos: ${passed}/${passed} verificaciones aprobadas.`
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
