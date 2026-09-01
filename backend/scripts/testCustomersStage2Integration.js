'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const { buildCustomerOrdersFilter } = require('../services/customerOrderIdentityFilter');
const {
  buildCartFilter,
  loadCustomer360,
  resolveCustomer360Access,
} = require('../services/customer360');
const { serializeInvoice } = require('../services/customer360/presentation');
const {
  loadCustomerIdentityCommercialMetrics,
} = require('../services/customerCommercialMetricsService');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function createFixtureRepository(fixtures = {}) {
  const calls = [];
  const repository = {
    calls,
    async countOrders(filter) {
      calls.push(['countOrders', filter]);
      return fixtures.totalOrders ?? fixtures.orders?.length ?? 0;
    },
  };

  const mappings = {
    findOrders: 'orders',
    findPaymentAttempts: 'attempts',
    findInvoices: 'invoices',
    findReturns: 'returns',
    findRefunds: 'refunds',
    findShippingOperations: 'shippingOperations',
    findCarts: 'carts',
    findStoreCredits: 'storeCredits',
    findStoreCreditUsages: 'storeCreditUsages',
  };

  Object.entries(mappings).forEach(([method, key]) => {
    repository[method] = async (filter, limit) => {
      calls.push([method, filter, limit]);
      return fixtures[key] || [];
    };
  });

  return repository;
}

async function main() {
  const customerId = new mongoose.Types.ObjectId();
  const orderPaidId = new mongoose.Types.ObjectId();
  const orderCancelledId = new mongoose.Types.ObjectId();
  const shipmentId = new mongoose.Types.ObjectId();
  const returnId = new mongoose.Types.ObjectId();
  const now = new Date('2026-08-31T20:00:00.000Z');
  const customer = {
    _id: customerId,
    customerCode: 'CLI-360',
    fullName: 'Cliente 360',
    normalizedEmail: 'cliente360@example.com',
    email: 'cliente360@example.com',
    phone: '3001234567',
    documentType: 'CC',
    documentNumber: '123456789',
  };
  const orders = [
    {
      _id: orderPaidId,
      sessionId: 'session-paid',
      orderNumber: 'ORD-360-PAID',
      status: 'delivered',
      source: 'online',
      channel: 'web',
      subtotal: 100000,
      total: 100000,
      createdAt: new Date('2026-08-20T12:00:00.000Z'),
      payment: {
        status: 'paid',
        provider: 'wompi',
        amount: 100000,
        currency: 'COP',
        paidAt: new Date('2026-08-20T12:05:00.000Z'),
      },
      fulfillment: {
        logisticsSummary: { status: 'delivered', shipmentCount: 1 },
        shipments: [
          {
            _id: shipmentId,
            code: 'ENV-360',
            status: 'delivered',
            carrier: {
              name: 'Envia',
              trackingNumber: 'GUIA-360',
            },
            deliveredAt: new Date('2026-08-25T12:00:00.000Z'),
          },
        ],
      },
    },
    {
      _id: orderCancelledId,
      sessionId: 'session-cancelled',
      orderNumber: 'ORD-360-CANCELLED',
      status: 'cancelled',
      total: 40000,
      createdAt: new Date('2026-08-21T12:00:00.000Z'),
      payment: { status: 'failed', provider: 'wompi', amount: 40000 },
    },
  ];
  const fixtures = {
    totalOrders: 2,
    orders,
    attempts: [
      {
        _id: new mongoose.Types.ObjectId(),
        order: orderCancelledId,
        orderNumber: 'ORD-360-CANCELLED',
        provider: 'wompi',
        state: 'declined',
        amountInCents: 4000000,
        currency: 'COP',
        issuedAt: new Date('2026-08-21T12:01:00.000Z'),
      },
    ],
    invoices: [
      {
        _id: new mongoose.Types.ObjectId(),
        orderId: orderPaidId,
        orderNumber: 'ORD-360-PAID',
        status: 'accepted',
        invoiceNumber: 'SETT-360',
        // Simula una factura histórica aceptada antes de guardar el snapshot
        // fiscal de totales. La ficha debe recuperar el valor desde su orden.
        totals: { currency: 'COP' },
        provider: { name: 'factus', isValidated: true },
        acceptedAt: new Date('2026-08-20T12:10:00.000Z'),
        creditNotes: [
          {
            _id: new mongoose.Types.ObjectId(),
            status: 'validated',
            provider: { number: 'NC-360' },
            totalAmount: 20000,
            createdAt: new Date('2026-08-28T12:00:00.000Z'),
          },
        ],
      },
    ],
    returns: [
      {
        _id: returnId,
        returnNumber: 'RMA-360',
        order: orderPaidId,
        orderNumber: 'ORD-360-PAID',
        status: 'resolved',
        requestedResolution: 'refund',
        estimatedRefundAmount: 20000,
        requestedAt: new Date('2026-08-27T12:00:00.000Z'),
        resolvedAt: new Date('2026-08-28T12:00:00.000Z'),
        resolution: {
          type: 'refund',
          state: 'completed',
          amount: 20000,
        },
      },
    ],
    refunds: [
      {
        _id: new mongoose.Types.ObjectId(),
        refundNumber: 'REF-360',
        order: orderPaidId,
        orderNumber: 'ORD-360-PAID',
        returnCase: returnId,
        status: 'processed',
        amount: 20000,
        currency: 'COP',
        processedAt: new Date('2026-08-28T12:00:00.000Z'),
        reconciliation: { state: 'completed' },
      },
    ],
    shippingOperations: [
      {
        _id: new mongoose.Types.ObjectId(),
        order: orderPaidId,
        shipmentId,
        provider: 'envia',
        type: 'generate_label',
        status: 'succeeded',
        trackingNumber: 'GUIA-360',
        attempts: 1,
      },
    ],
    carts: [
      {
        _id: new mongoose.Types.ObjectId(),
        sessionId: 'session-paid',
        userEmail: customer.email,
        items: [{ _id: new mongoose.Types.ObjectId(), qty: 1, price: 100000 }],
        convertedOrderId: orderPaidId,
        convertedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    storeCredits: [
      {
        _id: new mongoose.Types.ObjectId(),
        customer: customerId,
        creditNumber: 'SALDO-360',
        status: 'active',
        originalAmount: 20000,
        balance: 15000,
        sourceOrder: orderPaidId,
        sourceOrderNumber: 'ORD-360-PAID',
        sourceReturn: returnId,
        issuedAt: now,
      },
    ],
    storeCreditUsages: [
      {
        _id: new mongoose.Types.ObjectId(),
        customer: customerId,
        order: orderPaidId,
        orderNumber: 'ORD-360-PAID',
        status: 'consumed',
        amount: 5000,
        consumedAt: now,
      },
    ],
  };

  const identityFilter = buildCustomerOrdersFilter(customer);
  ok(
    'la ficha 360 comparte identidad por cliente, correo, celular y documento',
    Array.isArray(identityFilter.$or) && identityFilter.$or.length >= 6
  );

  const ownerRequest = {
    adminRole: 'owner',
    adminUser: 'owner',
    query: {},
  };
  const repository = createFixtureRepository(fixtures);
  const allAllowed = async () => true;
  let identityMetricsPipeline = null;
  const identityMetrics = await loadCustomerIdentityCommercialMetrics(
    ownerRequest,
    customer,
    {
      OrderModel: {
        aggregate: async (pipeline) => {
          identityMetricsPipeline = pipeline;
          return [{
            ordersCount: 2,
            posOrdersCount: 1,
            webOrdersCount: 1,
            grossSales: 140000,
            refundedAmount: 20000,
            firstPurchaseAt: new Date('2026-08-20T12:00:00.000Z'),
            lastPurchaseAt: new Date('2026-08-21T12:00:00.000Z'),
          }];
        },
      },
    }
  );
  ok(
    'el resumen individual usa la identidad completa y no solo customerId',
    JSON.stringify(identityMetricsPipeline?.[0]?.$match || {}).includes('customer.email') &&
      identityMetrics.ordersCount === 2 &&
      identityMetrics.netSpent === 120000
  );
  const detail = await loadCustomer360({
    req: ownerRequest,
    customer,
    repository,
    permissionChecker: allAllowed,
  });

  ok('la respuesta integra las dos órdenes reales del cliente', detail.orders.length === 2);
  ok(
    'pagos conserva intentos rechazados y la orden pagada',
    detail.paymentAttempts[0]?.state === 'declined' &&
      detail.summary.payments.paid === 1
  );
  ok(
    'facturación devuelve factura aceptada y nota crédito sin exponer payload crudo',
    detail.invoices[0]?.validated === true &&
      detail.invoices[0]?.creditNotes?.length === 1 &&
      !Object.prototype.hasOwnProperty.call(detail.invoices[0], 'raw')
  );
  ok(
    'facturación histórica recupera desde la orden un total fiscal ausente',
    detail.invoices[0]?.total === 100000 &&
      detail.invoices[0]?.totalSource === 'order'
  );
  const invoiceWithFiscalSnapshot = serializeInvoice(
    { totals: { total: 95000, currency: 'COP' } },
    { total: 100000 }
  );
  ok(
    'el total fiscal guardado prevalece sobre el valor actual de la orden',
    invoiceWithFiscalSnapshot.total === 95000 &&
      invoiceWithFiscalSnapshot.totalSource === 'invoice'
  );
  ok(
    'venta neta descuenta el reembolso procesado una sola vez',
    detail.summary.commercial.grossSales === 100000 &&
      detail.summary.commercial.refundedAmount === 20000 &&
      detail.summary.commercial.netSales === 80000
  );
  ok(
    'devolución y reembolso quedan enlazados con la orden',
    detail.returns[0]?.orderId === String(orderPaidId) &&
      detail.refunds[0]?.returnId === String(returnId)
  );
  ok(
    'envío expone guía, transportadora y operación idempotente',
    detail.shipments[0]?.carrier?.trackingNumber === 'GUIA-360' &&
      detail.shipments[0]?.operations?.[0]?.status === 'succeeded'
  );
  ok(
    'carrito convertido queda asociado sin exponer tokens de recuperación',
    detail.carts[0]?.lifecycle === 'converted' &&
      !Object.prototype.hasOwnProperty.call(detail.carts[0], 'recoveryAccess')
  );
  ok(
    'saldos muestra emisión, consumo y balance vigente',
    detail.summary.storeCredit.issued === 20000 &&
      detail.summary.storeCredit.consumed === 5000 &&
      detail.summary.storeCredit.activeBalance === 15000
  );
  ok(
    'actividad unifica eventos de compra, pago, Factus, RMA, envío y saldo',
    new Set(detail.activity.map((item) => item.type)).size >= 7
  );
  ok(
    'la cobertura declara explícitamente si el historial fue truncado',
    detail.coverage.totalOrders === 2 && detail.coverage.truncated === false
  );

  const branchRequest = {
    adminRole: 'seller',
    adminUser: 'seller',
    query: {},
  };
  const branchCartFilter = buildCartFilter({
    req: branchRequest,
    customer,
    orderIds: [orderPaidId],
    sessionIds: ['session-paid'],
  });
  ok(
    'usuarios de sede no pueden localizar carritos abiertos solo por correo',
    !JSON.stringify(branchCartFilter).includes('userEmail')
  );
  const ownerCartFilter = buildCartFilter({
    req: ownerRequest,
    customer,
    orderIds: [orderPaidId],
    sessionIds: [],
  });
  ok(
    'owner sí puede consolidar carritos identificados por correo',
    JSON.stringify(ownerCartFilter).includes('userEmail')
  );

  const limitedAccess = await resolveCustomer360Access(
    branchRequest,
    async (_req, permission) => ['orders:view', 'customers:view'].includes(permission)
  );
  ok(
    'cada sección se habilita por su permiso específico',
    limitedAccess.orders === true &&
      limitedAccess.payments === false &&
      limitedAccess.billing === false &&
      limitedAccess.carts === false
  );

  const limitedDetail = await loadCustomer360({
    req: ownerRequest,
    customer,
    repository: createFixtureRepository(fixtures),
    permissionChecker: async (_req, permission) => permission === 'orders:view',
  });
  ok(
    'orders:view no expone referencias de pago sin payments:view',
    limitedDetail.orders.length === 2 &&
      !Object.prototype.hasOwnProperty.call(limitedDetail.orders[0], 'payment') &&
      limitedDetail.paymentAttempts.length === 0 &&
      limitedDetail.summary.payments === null
  );

  const routeSource = read('backend/routes/adminCustomers.js');
  ok(
    'el detalle comercial solicita métricas por identidad completa',
    routeSource.includes('loadCustomerIdentityCommercialMetrics(req, customer)')
  );
  ok(
    'el endpoint 360 exige customers:view y se declara antes del detalle genérico',
    routeSource.indexOf("router.get('/:id/360'") > 0 &&
      routeSource.indexOf("router.get('/:id/360'") <
        routeSource.indexOf("router.get('/:id',") &&
      routeSource.includes("router.get('/:id/360', requirePermission('customers:view')")
  );

  console.log(`\nEtapa 2 Clientes backend: ${controls}/${controls} controles superados.`);
}

main().catch((error) => {
  console.error('FAIL Etapa 2 Clientes backend');
  console.error(error);
  process.exitCode = 1;
});
