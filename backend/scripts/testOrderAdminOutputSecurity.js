'use strict';

const assert = require('node:assert/strict');

const {
  ADMIN_ORDER_CSV_DB_PROJECTION,
  ADMIN_ORDER_LIST_DB_PROJECTION,
  buildPagePipeline,
  queryAdminOrders,
} = require('../services/orderAdminQueryService');
const { orderToCsvRow } = require('../controllers/orderExportController');
const {
  createOrderBranchPresentationScope,
  scopeOrderForBranchPresentation,
} = require('../services/orderBranchPresentationScopeService');

const INVOICE_MODEL = { collection: { name: 'electronicinvoices' } };
const SECRET_VALUES = [
  'https://private.example/asset.pdf',
  'https://private.example/access?token=plain',
  'DIGITAL_TOKEN_HASH_SENTINEL',
  'https://private.example/booking',
  'INTERNAL_SERVICE_INSTRUCTIONS_SENTINEL',
  'RAW_PROVIDER_PAYLOAD_SENTINEL',
  'CUSTOMS_INTERNAL_SENTINEL',
  'FULFILLMENT_INTERNAL_SENTINEL',
  'PAYMENT_CLAIM_SENTINEL',
  'CUSTOMER_DOCUMENT_SENTINEL',
  'CUSTOMER_ADDRESS_SENTINEL',
  'FUTURE_INTERNAL_SENTINEL',
];
const FORBIDDEN_KEYS = new Set([
  'assetUrl',
  'accessUrl',
  'accessTokenHash',
  'bookingUrl',
  'internalInstructions',
  'fulfillmentSnapshot',
  'customsSnapshot',
  'rawMethod',
  'manualConfirmation',
  'paymentProcessing',
  'sessionId',
  'billing',
  'customerId',
  'documentNumber',
  'address',
  'reservation',
  'reservationItem',
  'inventoryStock',
  'productSnapshot',
]);

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function sensitiveFixture() {
  return {
    _id: '64c000000000000000000001',
    sessionId: 'PRIVATE-IDEMPOTENCY-KEY',
    orderNumber: 'ORD-SAFE-001',
    status: 'paid',
    source: 'online',
    channel: 'web',
    saleType: 'online_order',
    total: 125000,
    subtotal: 120000,
    shipping: 5000,
    customer: {
      customerId: '64d000000000000000000001',
      name: 'Cliente',
      lastname: 'Seguro',
      email: 'cliente@example.invalid',
      emailOrPhone: 'cliente@example.invalid',
      phone: '3000000000',
      id: 'CUSTOMER_DOCUMENT_SENTINEL',
      address: 'CUSTOMER_ADDRESS_SENTINEL',
    },
    billing: {
      documentNumber: 'CUSTOMER_DOCUMENT_SENTINEL',
      address: 'CUSTOMER_ADDRESS_SENTINEL',
    },
    payment: {
      provider: 'wompi',
      providerLabel: 'Wompi',
      status: 'paid',
      method: 'card',
      methodLabel: 'Tarjeta',
      currency: 'COP',
      transactionId: 'PRIVATE-PROVIDER-TRANSACTION',
      rawMethod: { payload: 'RAW_PROVIDER_PAYLOAD_SENTINEL' },
      manualConfirmation: { requestFingerprint: 'PRIVATE-FINGERPRINT' },
    },
    paymentProcessing: {
      invoice: { claimId: 'PAYMENT_CLAIM_SENTINEL' },
    },
    futureInternal: { opaqueValue: 'FUTURE_INTERNAL_SENTINEL' },
    pos: { receiptNumber: 'POS-001', terminalId: 'PRIVATE-TERMINAL' },
    exchangeOrigin: {
      type: 'rma_exchange',
      originalOrderNumber: 'ORD-ORIGINAL',
      returnNumber: 'RMA-001',
      noCharge: true,
      originalOrder: 'PRIVATE-ORDER-ID',
    },
    tags: ['vip'],
    printed: true,
    archived: false,
    branch: '64b000000000000000000001',
    branchSnapshot: { name: 'Sede', code: 'SEDE', type: 'warehouse' },
    inventoryAllocations: [
      {
        branch: '64b000000000000000000001',
        branchSnapshot: { name: 'Sede', code: 'SEDE' },
        soldQuantity: 1,
        returnedQuantity: 0,
        reservation: 'PRIVATE-RESERVATION',
        reservationItem: 'PRIVATE-RESERVATION-ITEM',
        inventoryStock: 'PRIVATE-STOCK',
        productSnapshot: { cost: 99999 },
      },
    ],
    fulfillment: {
      digitalDeliveries: [
        {
          title: 'Contenido privado',
          assetUrl: 'https://private.example/asset.pdf',
          accessUrl: 'https://private.example/access?token=plain',
          accessTokenHash: 'DIGITAL_TOKEN_HASH_SENTINEL',
        },
      ],
      services: [
        {
          title: 'Servicio privado',
          bookingUrl: 'https://private.example/booking',
          internalInstructions: 'INTERNAL_SERVICE_INSTRUCTIONS_SENTINEL',
        },
      ],
      shipments: [
        {
          status: 'packing',
          incidents: [{ status: 'open', description: 'PRIVATE-INCIDENT' }],
          sla: { dispatchDueAt: new Date('2026-08-28T12:00:00.000Z') },
          shippingIntegration: { labelUrl: 'PRIVATE-LABEL-URL' },
        },
      ],
    },
    items: [
      {
        _id: '64e000000000000000000001',
        productId: '64f000000000000000000001',
        title: 'Producto visible',
        quantity: 1,
        price: 120000,
        fulfillmentSnapshot: { secret: 'FULFILLMENT_INTERNAL_SENTINEL' },
        customsSnapshot: { secret: 'CUSTOMS_INTERNAL_SENTINEL' },
      },
    ],
    summary: { itemsCount: 1, totalItems: 1, subtotal: 120000 },
    notes: [{ text: 'PRIVATE-NOTE' }],
    timeline: [{ message: 'PRIVATE-TIMELINE' }],
    createdAt: new Date('2026-08-27T12:00:00.000Z'),
    updatedAt: new Date('2026-08-27T12:05:00.000Z'),
  };
}

function recursivelyAssertAbsent(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => recursivelyAssertAbsent(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object' || value instanceof Date) return;

  Object.entries(value).forEach(([key, entry]) => {
    assert.equal(FORBIDDEN_KEYS.has(key), false, `${path}.${key} no puede exponerse`);
    recursivelyAssertAbsent(entry, `${path}.${key}`);
  });
}

function assertNoSecretValues(value) {
  const serialized = JSON.stringify(value);
  SECRET_VALUES.forEach((secret) => {
    assert.equal(serialized.includes(secret), false, `se expuso el sentinel ${secret}`);
  });
}

function fakeOrderModel(pageRow) {
  return {
    aggregate(pipeline) {
      const isSummary = pipeline.some((stage) => stage.$facet);
      const rows = isSummary
        ? [{
            financial: {
              totalOrders: 1,
              totalSales: 125000,
              paidOrders: 1,
              invoiceRequiredOrders: 1,
              withInvoiceOrders: 0,
            },
            operational: { total: 1, attention: 1 },
          }]
        : [pageRow];
      return {
        allowDiskUse() {
          return Promise.resolve(rows);
        },
      };
    },
  };
}

async function run() {
  const projectionValues = Object.values(ADMIN_ORDER_LIST_DB_PROJECTION);
  assert.ok(projectionValues.length > 0);
  assert.equal(projectionValues.every((value) => value === 1), true);
  assert.equal(
    Object.keys(ADMIN_ORDER_LIST_DB_PROJECTION).some((path) =>
      path.startsWith('fulfillment.digitalDeliveries') ||
      path.startsWith('fulfillment.services')
    ),
    false
  );
  assert.equal(
    Object.values(ADMIN_ORDER_CSV_DB_PROJECTION).every((value) => value === 1),
    true
  );
  ok('MongoDB usa proyecciones inclusivas sin campos digitales ni de servicios');

  const pipeline = buildPagePipeline({
    filter: {},
    invoiceFilter: 'all',
    sort: { createdAt: -1, _id: -1 },
    skip: 0,
    limit: 20,
    ElectronicInvoiceModel: INVOICE_MODEL,
  });
  const finalProjection = pipeline[pipeline.length - 1]?.$project;
  assert.deepEqual(finalProjection, ADMIN_ORDER_LIST_DB_PROJECTION);
  assert.equal(Object.values(finalProjection).some((value) => value === 0), false);
  ok('la proyección positiva es la última frontera del pipeline de página');

  const fixture = sensitiveFixture();
  const response = await queryAdminOrders(
    { adminRole: 'owner', query: { page: '1', limit: '20' } },
    { OrderModel: fakeOrderModel(fixture), ElectronicInvoiceModel: INVOICE_MODEL }
  );
  assert.equal(response.total, 1);
  assert.equal(response.financialSummary.totalSales, 125000);
  assert.equal(response.operationalSummary.attention, 1);
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0].operational.openIncidentCount, 1);
  assert.equal(response.data[0].totalItems, 1);
  recursivelyAssertAbsent(response.data);
  assertNoSecretValues(response.data);
  assert.deepEqual(Object.keys(response.data[0].customer).sort(), [
    'email',
    'emailOrPhone',
    'lastname',
    'name',
    'phone',
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(response.data[0], 'fulfillment'), false);
  ok('el DTO JSON conserva la bandeja y elimina recursivamente todo dato interno');

  const branchA = '64b000000000000000000001';
  const branchB = '64b000000000000000000002';
  const splitOrder = sensitiveFixture();
  splitOrder.branch = branchB;
  splitOrder.branchSnapshot = { name: 'BRANCH-B-SENTINEL', code: 'B' };
  splitOrder.inventoryAllocationSummary = {
    branchCount: 2,
    branchIds: [branchA, branchB],
    soldQuantity: 2,
  };
  splitOrder.fulfillment.logisticsSummary = {
    shipmentCount: 2,
    exceptionCount: 1,
  };
  splitOrder.inventoryAllocations = [
    {
      branch: branchA,
      branchSnapshot: { name: 'Sede A', code: 'A' },
      soldQuantity: 1,
      returnedQuantity: 0,
    },
    {
      branch: branchB,
      branchSnapshot: { name: 'BRANCH-B-SENTINEL', code: 'B' },
      soldQuantity: 1,
      returnedQuantity: 0,
    },
  ];
  splitOrder.fulfillment.shipments = [
    {
      branch: branchA,
      status: 'packing',
      incidents: [],
      sla: { dispatchDueAt: new Date('2026-08-29T12:00:00.000Z') },
    },
    {
      branch: branchB,
      status: 'exception',
      incidents: [{ status: 'open', description: 'BRANCH-B-INCIDENT' }],
      sla: { breachedAt: new Date('2026-08-26T12:00:00.000Z') },
      carrier: { trackingNumber: 'BRANCH-B-TRACKING' },
      destination: { address: 'BRANCH-B-ADDRESS' },
    },
  ];
  const rawScoped = scopeOrderForBranchPresentation(
    splitOrder,
    createOrderBranchPresentationScope({ mode: 'assigned', branchIds: [branchA] })
  );
  assert.equal(rawScoped.inventoryAllocationSummary, null);
  assert.equal(rawScoped.fulfillment.logisticsSummary, null);
  assert.equal(rawScoped.fulfillment.shipments.length, 1);
  assert.equal(JSON.stringify(rawScoped).includes('BRANCH-B-TRACKING'), false);
  assert.equal(JSON.stringify(rawScoped).includes('BRANCH-B-ADDRESS'), false);
  const branchScoped = await queryAdminOrders(
    {
      adminRole: 'warehouse',
      adminDefaultBranch: branchA,
      adminBranches: [{ branch: branchA }],
      query: { includeSummary: '0' },
    },
    { OrderModel: fakeOrderModel(splitOrder), ElectronicInvoiceModel: INVOICE_MODEL }
  );
  assert.equal(branchScoped.data[0].branch, null);
  assert.equal(branchScoped.data[0].inventoryAllocations.length, 1);
  assert.equal(branchScoped.data[0].inventoryAllocations[0].branch, branchA);
  assert.equal(branchScoped.data[0].operational.shipmentCount, 1);
  assert.equal(branchScoped.data[0].operational.openIncidentCount, 0);
  assert.equal(JSON.stringify(branchScoped.data).includes('BRANCH-B-SENTINEL'), false);
  assert.equal(JSON.stringify(branchScoped.data).includes('BRANCH-B-INCIDENT'), false);
  ok('una orden A+B se presenta y calcula solo con la sede autorizada');

  const csvResponse = await queryAdminOrders(
    { adminRole: 'owner', query: { format: 'csv', limit: '20' } },
    { OrderModel: fakeOrderModel(fixture), ElectronicInvoiceModel: INVOICE_MODEL }
  );
  assert.match(csvResponse.csv, /ORD-SAFE-001/);
  assert.match(csvResponse.csv, /Cliente Seguro/);
  assertNoSecretValues(csvResponse.csv);
  FORBIDDEN_KEYS.forEach((key) => assert.equal(csvResponse.csv.includes(key), false));
  assertNoSecretValues(orderToCsvRow(fixture));
  ok('CSV general y CSV seleccionado solo serializan columnas públicas del reporte');

  console.log(`\nSeguridad de salida administrativa: ${passed}/${passed} controles aprobados.`);
}

run().catch((error) => {
  console.error('\nFAIL seguridad de salida administrativa de Órdenes');
  console.error(error);
  process.exitCode = 1;
});
