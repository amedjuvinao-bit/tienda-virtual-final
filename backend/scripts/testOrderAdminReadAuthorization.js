'use strict';

const assert = require('assert');

const requirePermission = require('../middleware/requirePermission');
const ordersRouter = require('../routes/orders');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');
const {
  canExposeInvoiceDownloadLinks,
  createOrderAdminDetailController,
} = require('../controllers/orderAdminDetailController');
const {
  ADMIN_ORDER_INVOICE_DOWNLOAD_LINK_PROJECTION,
  ADMIN_ORDER_INVOICE_SUMMARY_PROJECTION,
  presentAdminOrderDetail,
  serializeOrderAdminInvoiceSummary,
} = require('../services/orderAdminDetailPresentationService');
const {
  csvCell,
  neutralizeCsvFormula,
  setOrderCsvResponseHeaders,
} = require('../services/orderCsvSerializationService');
const {
  ordersToCsv,
} = require('../services/orderAdminQuery/csv');
const {
  orderToCsvRow,
} = require('../controllers/orderExportController');
const {
  buildInvoiceDocumentOrderAccess,
  sendInvoiceDocumentError,
  setPrivateDocumentHeaders,
} = require('../controllers/orderDocumentsController');

const ORDER_ID = '64c000000000000000000001';
const INVOICE_ID = '64c000000000000000000002';

function responseProbe() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
  };
}

function operatorRequest(permissions, overrides = {}) {
  return {
    method: 'GET',
    query: {},
    params: {},
    headers: {},
    adminUser: 'orders-operator',
    adminUsername: 'orders-operator',
    adminRole: 'operator',
    adminAuthType: 'db',
    adminPermissions: permissions,
    adminRolePermissionsLoaded: true,
    adminRolePermissions: [],
    ...overrides,
  };
}

async function permissionDecision(rule, permissions) {
  assert(rule, 'La ruta administrativa debe existir en el mapa RBAC.');
  const req = operatorRequest(permissions);
  const res = responseProbe();
  let nextCalled = false;

  await requirePermission(rule.requiredPermissions || [rule.permission])(
    req,
    res,
    () => {
      nextCalled = true;
    }
  );

  return { nextCalled, res };
}

function unsafeInvoiceFixture() {
  return {
    _id: INVOICE_ID,
    orderId: ORDER_ID,
    orderNumber: '000240',
    required: true,
    status: 'accepted',
    invoiceNumber: 'SETP-240',
    cufe: 'CUFE-SEGURO-PARA-LA-VISTA',
    pdfUrl: 'https://private.example/invoice.pdf?token=PDF_SECRET',
    xmlUrl: 'https://private.example/invoice.xml?token=XML_SECRET',
    xmlContent: '<Invoice>XML_SECRET</Invoice>',
    qrUrl: 'https://private.example/qr?token=QR_SECRET',
    customer: { email: 'fiscal-secret@example.com' },
    fiscalInfo: { nit: 'SECRET_NIT' },
    dianResolution: { technicalKey: 'TECHNICAL_SECRET' },
    legalTexts: { invoiceLegalText: 'PRIVATE_LEGAL_TEXT' },
    emission: {
      state: 'completed',
      source: 'wompi',
      attempts: 1,
      lockToken: 'LOCK_SECRET',
    },
    provider: {
      name: 'factus',
      status: 'validated',
      referenceCode: 'FACTUS-240',
      number: 'SETP-240',
      cufe: 'CUFE-SEGURO-PARA-LA-VISTA',
      isValidated: true,
      validatedAt: '2026-08-27T10:00:00.000Z',
      links: {
        public_url: 'https://private.example/public?token=PUBLIC_SECRET',
      },
      raw: {
        credential: 'PROVIDER_RAW_SECRET',
        links: { pdf_url: 'https://private.example/raw.pdf' },
      },
    },
    dianResponse: {
      code: '201',
      raw: { credential: 'DIAN_RAW_SECRET' },
    },
    providerErrors: { private: 'PROVIDER_ERROR_SECRET' },
    creditNotes: [{ raw: { secret: 'CREDIT_NOTE_RAW_SECRET' } }],
    emailDelivery: { recipient: 'recipient-secret@example.com' },
    officialDocuments: {
      pdf: { available: true, sha256: 'PDF_HASH_SECRET' },
      xml: { available: true, sha256: 'XML_HASH_SECRET' },
    },
    generatedAt: '2026-08-27T09:58:00.000Z',
    acceptedAt: '2026-08-27T10:00:00.000Z',
    createdAt: '2026-08-27T09:57:00.000Z',
    updatedAt: '2026-08-27T10:00:00.000Z',
  };
}

function assertNoProtectedInvoicePayload(payload) {
  const serialized = JSON.stringify(payload);
  [
    'XML_SECRET',
    'PDF_SECRET',
    'QR_SECRET',
    'PUBLIC_SECRET',
    'PROVIDER_RAW_SECRET',
    'DIAN_RAW_SECRET',
    'PROVIDER_ERROR_SECRET',
    'CREDIT_NOTE_RAW_SECRET',
    'TECHNICAL_SECRET',
    'LOCK_SECRET',
    'recipient-secret@example.com',
    'fiscal-secret@example.com',
  ].forEach((secret) => {
    assert(!serialized.includes(secret), `El DTO filtró ${secret}.`);
  });

  ['xmlContent', 'pdfUrl', 'xmlUrl', 'qrUrl', 'factusLinks'].forEach((key) => {
    assert(!(key in payload), `El detalle no debe incluir ${key}.`);
  });
  assert(!('raw' in (payload.provider || {})), 'provider.raw debe quedar fuera.');
  assert(!('links' in (payload.provider || {})), 'provider.links debe quedar fuera.');
  assert(!('dianResponse' in payload), 'dianResponse no pertenece al DTO fiscal mínimo.');
}

async function validateRbacMatrix() {
  const listRule = findAdminRoutePermission('GET', '/api/orders/admin');
  const csvRule = findAdminRoutePermission(
    'GET',
    '/api/orders/admin?format=CSV'
  );
  const csvRuleFromQuery = findAdminRoutePermission(
    'GET',
    '/api/orders/admin',
    { format: 'csv' }
  );
  const detailRule = findAdminRoutePermission(
    'GET',
    `/api/orders/${ORDER_ID}`
  );
  const selectedCsvRule = findAdminRoutePermission(
    'POST',
    '/api/orders/admin/export'
  );

  assert.strictEqual(listRule?.permission, 'orders:view');
  assert.deepStrictEqual(listRule?.requiredPermissions, ['orders:view']);
  assert.strictEqual(csvRule?.permission, 'orders:export');
  assert.deepStrictEqual(
    csvRule?.requiredPermissions,
    ['orders:export', 'orders:view']
  );
  assert.strictEqual(csvRuleFromQuery, csvRule);
  assert.strictEqual(detailRule?.permission, 'orders:view');
  assert.strictEqual(
    findAdminRoutePermission('GET', '/api/orders/admin/export'),
    null,
    'El mapa no debe proteger un GET inexistente.'
  );
  assert.strictEqual(
    selectedCsvRule?.permission,
    'orders:export'
  );
  assert.deepStrictEqual(selectedCsvRule?.requiredPermissions, [
    'orders:export',
    'orders:view',
  ]);

  const matrix = [
    { rule: listRule, permissions: ['orders:view'], allowed: true },
    { rule: listRule, permissions: ['orders:export'], allowed: false },
    { rule: csvRule, permissions: ['orders:view'], allowed: false },
    { rule: csvRule, permissions: ['orders:export'], allowed: false },
    { rule: selectedCsvRule, permissions: ['orders:view'], allowed: false },
    { rule: selectedCsvRule, permissions: ['orders:export'], allowed: false },
    {
      rule: csvRule,
      permissions: ['orders:view', 'orders:export'],
      allowed: true,
    },
    {
      rule: selectedCsvRule,
      permissions: ['orders:view', 'orders:export'],
      allowed: true,
    },
    { rule: csvRule, permissions: ['orders:*'], allowed: true },
    { rule: detailRule, permissions: ['orders:view'], allowed: true },
    { rule: detailRule, permissions: ['billing:download'], allowed: false },
  ];

  for (const entry of matrix) {
    const decision = await permissionDecision(entry.rule, entry.permissions);
    assert.strictEqual(decision.nextCalled, entry.allowed);
    assert.strictEqual(decision.res.statusCode, entry.allowed ? 200 : 403);
  }

  const selectedExportRoute = ordersRouter.stack.find(
    (layer) =>
      layer?.route?.path === '/admin/export' && layer.route.methods?.post
  );
  assert(selectedExportRoute, 'La ruta POST de exportación debe existir.');
  const routeMiddlewareNames = selectedExportRoute.route.stack.map(
    (layer) => layer.handle?.name
  );
  assert(routeMiddlewareNames.includes('requireAdmin'));
  assert(routeMiddlewareNames.includes('requirePermissionMiddleware'));

  const routePermissionMiddleware = selectedExportRoute.route.stack.find(
    (layer) => layer.handle?.name === 'requirePermissionMiddleware'
  )?.handle;
  assert(routePermissionMiddleware, 'La ruta debe tener defensa RBAC propia.');

  for (const [permissions, allowed] of [
    [['orders:export'], false],
    [['orders:view'], false],
    [['orders:view', 'orders:export'], true],
  ]) {
    const req = operatorRequest(permissions, { method: 'POST' });
    const res = responseProbe();
    let nextCalled = false;
    await routePermissionMiddleware(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, allowed);
    assert.strictEqual(res.statusCode, allowed ? 200 : 403);
  }
}

async function validateMinimalFiscalDto() {
  const invoice = unsafeInvoiceFixture();
  const summary = serializeOrderAdminInvoiceSummary(invoice);

  assert.deepStrictEqual(Object.keys(summary).sort(), [
    'acceptedAt',
    'createdAt',
    'cufe',
    'documents',
    'emission',
    'failedAt',
    'generatedAt',
    'id',
    'invoiceNumber',
    'orderId',
    'orderNumber',
    'provider',
    'rejectedAt',
    'required',
    'sentAt',
    'status',
    'updatedAt',
  ]);
  assert.deepStrictEqual(Object.keys(summary.provider).sort(), [
    'cufe',
    'isValidated',
    'name',
    'number',
    'referenceCode',
    'status',
    'validatedAt',
  ]);
  assert.strictEqual(summary.status, 'accepted');
  assert.strictEqual(summary.invoiceNumber, 'SETP-240');
  assert.strictEqual(summary.cufe, 'CUFE-SEGURO-PARA-LA-VISTA');
  assert.strictEqual(summary.provider.name, 'factus');
  assert.strictEqual(summary.provider.isValidated, true);
  assert.strictEqual(summary.documents.hasPdf, true);
  assert.strictEqual(summary.documents.hasXml, true);
  assertNoProtectedInvoicePayload(summary);

  let selectedProjection = null;
  const OrderModel = {
    findOne() {
      return {
        lean: async () => ({
          _id: ORDER_ID,
          orderNumber: '000240',
          status: 'paid',
          total: 250000,
          sessionId: 'SESSION_SECRET',
          paymentAccess: { token: 'PAYMENT_ACCESS_SECRET' },
          payment: {
            provider: 'wompi',
            status: 'paid',
            transactionId: 'VISIBLE-TRANSACTION',
            rawMethod: { secret: 'RAW_PAYMENT_SECRET' },
            manualConfirmation: {
              reference: 'VISIBLE-REFERENCE',
              requestFingerprint: 'MANUAL_FINGERPRINT_SECRET',
            },
          },
          paymentProcessing: {
            invoice: { status: 'scheduled', claimId: 'CLAIM_SECRET' },
          },
          futureProviderSecretEncrypted: 'FUTURE_SECRET',
          fulfillment: {
            digitalDeliveries: [
              {
                title: 'Entrega visible',
                status: 'ready',
                assetUrl: 'https://private.example/asset?token=ASSET_SECRET',
                accessTokenHash: 'ACCESS_HASH_SECRET',
              },
            ],
            services: [
              {
                title: 'Servicio visible',
                status: 'scheduled',
                bookingUrl: 'https://private.example/booking?token=BOOKING_SECRET',
                internalInstructions: 'INTERNAL_INSTRUCTIONS_SECRET',
              },
            ],
          },
          factusLinks: { pdfUrl: 'https://private.example/legacy.pdf' },
          electronicInvoice: { xmlContent: 'LEGACY_XML_SECRET' },
        }),
      };
    },
    exists: async () => true,
  };
  const ElectronicInvoiceModel = {
    findOne() {
      return {
        select(projection) {
          selectedProjection = projection;
          return this;
        },
        lean: async () => invoice,
      };
    },
  };
  const controller = createOrderAdminDetailController({
    OrderModel,
    ElectronicInvoiceModel,
    applyBranchAccessFilter: () => ({ ok: true, mode: 'all' }),
    buildDownloadAccessFilter: () => ({
      ok: true,
      filter: { _id: ORDER_ID },
    }),
  });
  const req = operatorRequest(['orders:view'], {
    params: { id: ORDER_ID },
  });
  const res = responseProbe();
  await controller(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.orderNumber, '000240');
  assert.strictEqual(res.body.electronicInvoice.invoiceNumber, 'SETP-240');
  assert(!('factusLinks' in res.body));
  assert(!JSON.stringify(res.body).includes('LEGACY_XML_SECRET'));
  assert.strictEqual(res.body.payment.transactionId, 'VISIBLE-TRANSACTION');
  assert.strictEqual(
    res.body.payment.manualConfirmation.reference,
    'VISIBLE-REFERENCE'
  );
  [
    'SESSION_SECRET',
    'PAYMENT_ACCESS_SECRET',
    'RAW_PAYMENT_SECRET',
    'MANUAL_FINGERPRINT_SECRET',
    'CLAIM_SECRET',
    'FUTURE_SECRET',
    'ASSET_SECRET',
    'ACCESS_HASH_SECRET',
    'BOOKING_SECRET',
    'INTERNAL_INSTRUCTIONS_SECRET',
  ].forEach((secret) => {
    assert(!JSON.stringify(res.body).includes(secret), `El detalle filtró ${secret}.`);
  });
  assertNoProtectedInvoicePayload(res.body.electronicInvoice);
  assert.deepStrictEqual(
    selectedProjection,
    ADMIN_ORDER_INVOICE_SUMMARY_PROJECTION
  );
  Object.keys(selectedProjection).forEach((path) => {
    assert(!/(?:raw|xmlContent|Url|links|customer|fiscalInfo|dianResolution)/i.test(path));
  });

  const billingDownloadReq = operatorRequest(
    ['orders:view', 'billing:download'],
    { params: { id: ORDER_ID } }
  );
  const billingDownloadRes = responseProbe();
  await controller(billingDownloadReq, billingDownloadRes);

  assert.strictEqual(billingDownloadRes.statusCode, 200);
  assert.deepStrictEqual(
    selectedProjection,
    ADMIN_ORDER_INVOICE_DOWNLOAD_LINK_PROJECTION
  );
  assert.strictEqual(
    billingDownloadRes.body.factusLinks.pdfUrl,
    'https://private.example/public?token=PUBLIC_SECRET'
  );
  assert.strictEqual(
    billingDownloadRes.body.factusLinks.invoiceNumber,
    'SETP-240'
  );
  assertNoProtectedInvoicePayload(
    billingDownloadRes.body.electronicInvoice
  );
  assert(
    !JSON.stringify(billingDownloadRes.body.electronicInvoice).includes(
      'PUBLIC_SECRET'
    )
  );

  const noInvoiceCapability = await canExposeInvoiceDownloadLinks({
    req: operatorRequest(['orders:view', 'billing:download'], {
      adminDefaultBranch: '64b000000000000000000001',
      adminBranches: [
        {
          branch: '64b000000000000000000001',
          canInvoice: false,
        },
      ],
    }),
    orderId: ORDER_ID,
    OrderModel: {
      exists: async () => {
        throw new Error('No debe consultar la orden sin canInvoice.');
      },
    },
  });
  assert.strictEqual(noInvoiceCapability, false);

  const partialBranchController = createOrderAdminDetailController({
    OrderModel: {
      ...OrderModel,
      exists: async () => false,
    },
    ElectronicInvoiceModel,
    applyBranchAccessFilter: () => ({
      ok: true,
      mode: 'assigned',
      branchIds: ['64b000000000000000000001'],
    }),
    buildDownloadAccessFilter: () => ({
      ok: true,
      filter: { _id: ORDER_ID, wholeOrder: true },
    }),
  });
  const partialBranchRes = responseProbe();
  await partialBranchController(billingDownloadReq, partialBranchRes);
  assert.strictEqual(partialBranchRes.statusCode, 200);
  assert(!('factusLinks' in partialBranchRes.body));
  assert.deepStrictEqual(
    selectedProjection,
    ADMIN_ORDER_INVOICE_SUMMARY_PROJECTION,
    'Una orden parcialmente visible no puede proyectar URLs fiscales.'
  );

  const sanitizedLegacy = presentAdminOrderDetail(
    {
      _id: ORDER_ID,
      orderNumber: '000240',
      paymentDetails: { raw: 'LEGACY_PAYMENT_SECRET' },
      wompi: { token: 'LEGACY_WOMPI_SECRET' },
      payu: { signature: 'LEGACY_PAYU_SECRET' },
      transaction: { rawPayload: 'LEGACY_TRANSACTION_SECRET' },
    },
    null
  );
  assert.strictEqual(sanitizedLegacy.orderNumber, '000240');
  assert(!JSON.stringify(sanitizedLegacy).includes('LEGACY_'));
}

function validateInvoiceDocumentBranchAuthorization() {
  const branchA = '64b000000000000000000001';
  const branchB = '64b000000000000000000002';
  const withoutInvoiceCapability = buildInvoiceDocumentOrderAccess(
    operatorRequest(['orders:view', 'billing:download'], {
      adminDefaultBranch: branchA,
      adminBranches: [{ branch: branchA, canInvoice: false }],
    }),
    ORDER_ID
  );

  assert.strictEqual(withoutInvoiceCapability.ok, false);
  assert.strictEqual(withoutInvoiceCapability.status, 403);
  assert.strictEqual(
    withoutInvoiceCapability.error,
    'BRANCH_CAPABILITY_REQUIRED'
  );

  const assignedInvoiceAccess = buildInvoiceDocumentOrderAccess(
    operatorRequest(['orders:view', 'billing:download'], {
      adminDefaultBranch: branchA,
      adminBranches: [{ branch: branchA, canInvoice: true }],
    }),
    ORDER_ID
  );
  assert.strictEqual(assignedInvoiceAccess.ok, true);
  assert.strictEqual(assignedInvoiceAccess.requiredCapability, 'canInvoice');

  const wholeOrderScope = assignedInvoiceAccess.filter.$and.find(
    (entry) => Array.isArray(entry?.$and)
  );
  assert(wholeOrderScope, 'La descarga fiscal debe exigir la orden completa.');
  const serializedScope = JSON.stringify(wholeOrderScope);
  assert(serializedScope.includes('inventoryAllocations'));
  assert(serializedScope.includes('fulfillment.shipments'));
  assert(serializedScope.includes('$nin'));

  const partialOrder = {
    branch: branchA,
    inventoryAllocations: [{ branch: branchA }, { branch: branchB }],
    fulfillment: { shipments: [{ branch: branchA }, { branch: branchB }] },
  };
  const allowedBranches = new Set([branchA]);
  const hasUnauthorizedAllocation = partialOrder.inventoryAllocations.some(
    (entry) => !allowedBranches.has(String(entry.branch))
  );
  const hasUnauthorizedShipment = partialOrder.fulfillment.shipments.some(
    (entry) => !allowedBranches.has(String(entry.branch))
  );
  assert.strictEqual(hasUnauthorizedAllocation, true);
  assert.strictEqual(hasUnauthorizedShipment, true);
  assert(
    wholeOrderScope.$and.some(
      (entry) => entry?.inventoryAllocations?.$not?.$elemMatch?.branch?.$nin
    )
  );
  assert(
    wholeOrderScope.$and.some(
      (entry) => entry?.['fulfillment.shipments']?.$not?.$elemMatch?.branch?.$nin
    )
  );
}

function validateCsvHardening() {
  assert.strictEqual(neutralizeCsvFormula('=1+1'), "'=1+1");
  assert.strictEqual(neutralizeCsvFormula('+cmd'), "'+cmd");
  assert.strictEqual(neutralizeCsvFormula('-2+3'), "'-2+3");
  assert.strictEqual(neutralizeCsvFormula('@SUM(A1:A2)'), "'@SUM(A1:A2)");
  assert.strictEqual(neutralizeCsvFormula('  =1+1'), "'  =1+1");
  assert.strictEqual(csvCell('texto "citado"'), '"texto ""citado"""');
  assert.strictEqual(csvCell(-1200, { trustedNumber: true }), '-1200');

  const unsafeOrder = {
    _id: ORDER_ID,
    orderNumber: '=HYPERLINK("https://evil.example")',
    customer: {
      name: '+cmd',
      lastname: 'cliente',
      email: '@SUM(A1:A2)',
    },
    items: [{ quantity: 1, price: 100 }],
    itemsCount: 1,
    totalItems: 1,
    subtotal: 100,
    total: 100,
    status: '-2+3',
    tags: ['=WEBSERVICE("https://evil.example")'],
  };
  const listCsv = ordersToCsv([unsafeOrder]);
  const selectedCsv = orderToCsvRow(unsafeOrder);

  [listCsv, selectedCsv].forEach((csv) => {
    assert(csv.includes("'=HYPERLINK"));
    assert(csv.includes("'+cmd"));
    assert(csv.includes("'@SUM"));
    assert(csv.includes("'-2+3"));
  });
  assert(selectedCsv.includes("'=WEBSERVICE"));

  const res = responseProbe();
  setOrderCsvResponseHeaders(res, 'orders.csv');
  assert.strictEqual(res.headers['cache-control'], 'private, no-store');
  assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
  assert.strictEqual(res.headers['content-type'], 'text/csv; charset=utf-8');
  assert.strictEqual(
    res.headers['content-disposition'],
    'attachment; filename="orders.csv"'
  );

  const documentRes = responseProbe();
  setPrivateDocumentHeaders(documentRes);
  assert.strictEqual(documentRes.headers['cache-control'], 'private, no-store');
  assert.strictEqual(documentRes.headers['x-content-type-options'], 'nosniff');

  const unexpectedErrorRes = responseProbe();
  sendInvoiceDocumentError(
    unexpectedErrorRes,
    Object.assign(new Error('mongodb://private-host/internal'), {
      status: 500,
      code: 'MONGO_INTERNAL',
    }),
    'No se pudo descargar el documento.'
  );
  assert.strictEqual(unexpectedErrorRes.statusCode, 500);
  assert.strictEqual(
    unexpectedErrorRes.body.error,
    'INVOICE_DOCUMENT_DOWNLOAD_ERROR'
  );
  assert.strictEqual(
    unexpectedErrorRes.body.message,
    'No se pudo descargar el documento.'
  );
  assert(!JSON.stringify(unexpectedErrorRes.body).includes('private-host'));
}

async function main() {
  await validateRbacMatrix();
  await validateMinimalFiscalDto();
  validateInvoiceDocumentBranchAuthorization();
  validateCsvHardening();

  console.log('OK: matriz RBAC de listado/exportación');
  console.log('OK: POST export exige view+export también en su propia ruta');
  console.log('OK: DTO fiscal mínimo sin datos crudos ni URLs');
  console.log('OK: detalle elimina secretos de pago y procesamiento interno');
  console.log('OK: documentos fiscales exigen canInvoice y orden completa');
  console.log('OK: CSV neutraliza fórmulas y deshabilita caché compartida');
}

main().catch((error) => {
  console.error('FALLO seguridad de lectura administrativa de órdenes:', error);
  process.exitCode = 1;
});
