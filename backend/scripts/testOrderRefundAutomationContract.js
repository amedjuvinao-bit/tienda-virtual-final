/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const OrderRefund = require('../models/OrderRefund');
const {
  buildAutomaticCreditNoteRequest,
  operationKey,
} = require('../services/orderRefundAutomationService');
const {
  executeWompiAutomaticRefund,
  resolveWompiRefundCapability,
} = require('../services/wompiRefundGatewayService');

let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK ${passed}: ${label}`);
}

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function config(overrides = {}) {
  return {
    active: true,
    provider: 'wompi',
    mode: 'sandbox',
    credentials: {
      wompi: { privateKey: 'prv_test_automation_contract' },
    },
    ...overrides,
  };
}

function order(overrides = {}) {
  return {
    _id: '68a000000000000000000001',
    total: 90000,
    payment: {
      provider: 'wompi',
      mode: 'sandbox',
      methodType: 'CARD',
      transactionId: 'wompi-transaction-001',
      amount: 90000,
    },
    refundControl: { transactionCount: 1 },
    items: [
      {
        product: '68a000000000000000000011',
        title: 'Producto trazable',
        quantity: 2,
        price: 45000,
      },
    ],
    ...overrides,
  };
}

function refund(overrides = {}) {
  return {
    _id: '68a000000000000000000101',
    amount: 90000,
    refundNumber: 'RF-AUTO-001',
    requestHash: 'hash-estable',
    reason: 'Devolución aprobada',
    reconciliation: {
      paymentProvider: 'wompi',
      paymentTransactionId: 'wompi-transaction-001',
    },
    items: [
      {
        product: '68a000000000000000000011',
        orderItemId: '68a000000000000000000021',
        returnedQuantity: 1,
      },
    ],
    ...overrides,
  };
}

async function run() {
  const eligible = resolveWompiRefundCapability({
    order: order(),
    refund: refund(),
    config: config(),
  });
  assert.strictEqual(eligible.automatic, true);
  assert.strictEqual(eligible.transactionId, 'wompi-transaction-001');
  assert(eligible.baseUrl.includes('sandbox.wompi.co'));
  ok('solo una devolución total con tarjeta y configuración coincidente habilita el void');

  const partial = resolveWompiRefundCapability({
    order: order(),
    refund: refund({ amount: 45000 }),
    config: config(),
  });
  assert.strictEqual(partial.automatic, false);
  assert.strictEqual(partial.code, 'WOMPI_PARTIAL_REFUND_MANUAL_REQUIRED');
  const cash = resolveWompiRefundCapability({
    order: order({ payment: { provider: 'wompi', methodType: 'CASH', transactionId: 'wompi-transaction-001', amount: 90000 } }),
    refund: refund(),
    config: config(),
  });
  assert.strictEqual(cash.automatic, false);
  const inactive = resolveWompiRefundCapability({
    order: order(),
    refund: refund(),
    config: config({ active: false }),
  });
  assert.strictEqual(inactive.code, 'WOMPI_AUTOMATION_NOT_CONFIGURED');
  ok('parciales, medios incompatibles y pasarela inactiva conservan conciliación manual');

  const totalRequest = buildAutomaticCreditNoteRequest(order(), refund());
  assert.strictEqual(totalRequest.type, 'total');
  assert.strictEqual(totalRequest.reasonCode, '2');
  assert.strictEqual(totalRequest.idempotencyKey, 'refund_68a000000000000000000101');
  const partialRequest = buildAutomaticCreditNoteRequest(
    order(),
    refund({ amount: 45000 })
  );
  assert.strictEqual(partialRequest.type, 'partial');
  assert.deepStrictEqual(partialRequest.selectedItems, [
    { productId: '68a000000000000000000011', quantity: 1 },
  ]);
  assert.strictEqual(
    operationKey(refund(), 'payment'),
    operationKey(refund(), 'payment')
  );
  ok('la nota crédito total o parcial usa selección e idempotencia determinísticas');

  const calls = [];
  const executed = await executeWompiAutomaticRefund(
    { order: order(), refund: refund() },
    {
      getConfig: async () => config(),
      fetchImpl: async (url, options = {}) => {
        calls.push({ url, method: options.method || 'GET' });
        if (options.method === 'POST') {
          return response({ data: { id: 'wompi-transaction-001', status: 'VOIDED' } });
        }
        return response({ data: { id: 'wompi-transaction-001', status: 'APPROVED' } });
      },
    }
  );
  assert.strictEqual(executed.completed, true);
  assert.deepStrictEqual(calls.map((call) => call.method), ['GET', 'POST']);
  assert(calls[1].url.endsWith('/transactions/wompi-transaction-001/void'));
  ok('la ejecución consulta primero y solicita una sola anulación oficial');

  let idempotentCalls = 0;
  const reused = await executeWompiAutomaticRefund(
    { order: order(), refund: refund() },
    {
      getConfig: async () => config(),
      fetchImpl: async () => {
        idempotentCalls += 1;
        return response({ data: { id: 'wompi-transaction-001', status: 'VOIDED' } });
      },
    }
  );
  assert.strictEqual(reused.completed, true);
  assert.strictEqual(reused.idempotent, true);
  assert.strictEqual(idempotentCalls, 1);
  ok('un void ya confirmado se reutiliza sin repetir el movimiento monetario');

  ['attempts', 'operationKey', 'providerStatus', 'nextRetryAt'].forEach((field) => {
    assert(OrderRefund.schema.path(`reconciliation.payment.${field}`));
  });
  const automation = source('services/orderRefundAutomationService.js');
  assert(automation.includes('findOneAndUpdate'));
  assert(!automation.includes('deleteMany'));
  assert(!automation.includes('deleteOne'));
  ok('intentos, bloqueo y resultado del proveedor quedan persistentes sin limpieza automática');

  const routes = source('routes/orders.js');
  const endpoint = routes.slice(routes.indexOf("'/:id/refunds/:refundId/automate'"));
  assert(endpoint.includes("requirePermission('orders:refund')"));
  assert(endpoint.includes("requirePermission('billing:credit_note')"));
  const panel = source('../frontend/src/admin/orders/components/orderDetail/OrderDetailRefundReconciliation.jsx');
  assert(panel.includes('Automatizar cierre'));
  assert(panel.includes('Confirmar dinero devuelto'));
  ok('ruta y panel exigen permisos separados y mantienen la alternativa manual');

  console.log(`\nAutomatización de reembolsos: ${passed}/7 controles superados.`);
}

run().catch((error) => {
  console.error('\nFALLO automatización de reembolsos:', error);
  process.exitCode = 1;
});
