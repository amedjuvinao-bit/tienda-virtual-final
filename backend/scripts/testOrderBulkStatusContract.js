/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  needsOperationalReconciliation,
  validateOrderStatusTransition,
} = require('../services/orderStatusTransitionService');

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

function run() {
  const service = read(
    'backend/services/orderStatusTransitionService.js'
  );
  const routes = read('backend/routes/orders.js');
  const model = read('backend/models/Order.js');
  const index = read('backend/index.js');
  const admin = read('frontend/src/admin/OrdersAdmin.jsx');
  const detailToolbar = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailActionToolbar.jsx'
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
          status: 'cancelled',
          payment: { status: 'paid' },
        },
        'cancelled'
      ),
    (error) => error?.code === 'ORDER_REFUND_REQUIRED'
  );
  ok('La máquina de estados bloquea cancelaciones y saltos inseguros');

  const bulkStart = routes.indexOf(
    "router.post('/admin/bulk'"
  );
  const bulkEnd = routes.indexOf(
    'POST /api/orders/admin/export',
    bulkStart
  );
  const bulkRoute = routes.slice(bulkStart, bulkEnd);
  assert(
    bulkRoute.includes('processBulkOrderStatusTransitions')
  );
  assert(!bulkRoute.includes('o.status = status'));
  ok('La ruta masiva dejó de escribir status directamente');

  assert(
    routes.includes(
      "requirePermission('orders:status')"
    )
  );
  assert(routes.includes('result.failed > 0 ? 207 : 200'));
  ok('Permiso y respuesta parcial reflejan el resultado real');

  assert(
    /'shipped',\s*'delivered',\s*'cancelled'/s.test(model)
  );
  assert(!index.includes('deliveredAliases'));
  ok('Entregado pertenece al modelo y ya no usa un atajo inseguro');

  assert(admin.includes('resp?.data?.results'));
  assert(admin.includes('setSelectedIds(failedIds)'));
  assert(admin.includes('result.paymentStatus'));
  ok('La interfaz solo actualiza las órdenes que sí cambiaron');

  assert(!admin.includes("{ code: 'refunded', label: 'Reembolsado' }"));
  assert(
    detailToolbar.includes(
      'Reembolsado (solo devolución)'
    )
  );
  assert(detailToolbar.includes('disabled={option.disabled === true}'));
  ok('Reembolsado no se puede asignar como un estado manual');

  console.log(
    `\nContrato de estados masivos: ${passed}/${passed} verificaciones aprobadas.`
  );
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
