'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const CashSession = require('../models/CashSession');
const {
  beginPosSaleIdempotency,
  buildPosSaleIdempotency,
  completePosSaleIdempotency,
  inspectPosSaleIdempotency,
  normalizePosIdempotencyKey,
} = require('../services/posSaleIdempotencyService');
const {
  assertPosBranchAccess,
  buildCashSessionAccess,
  buildPosResourceAccess,
  canSuperviseCashSession,
  getAllowedPosBranchIds,
} = require('../services/adminPosAccessService');
const {
  assertCashSessionOperator,
  buildScopedCashSessionFilter,
  isCashConcurrencyError,
} = require('../services/cashSessionService');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function throwsCode(callback, code) {
  assert.throws(callback, (error) => error?.code === code);
  return true;
}

async function main() {
  const branchA = new mongoose.Types.ObjectId();
  const branchB = new mongoose.Types.ObjectId();
  const sellerId = new mongoose.Types.ObjectId();
  const payload = {
    branchId: String(branchA),
    items: [{ productId: 'producto-1', quantity: 1 }],
    payment: { method: 'cash', amount: 50000 },
  };
  const admin = { id: String(sellerId), username: 'cajero.principal' };
  const key = 'pos-sale-20260901-prueba-0001';

  ok(
    'la venta POS exige una clave de idempotencia explícita',
    throwsCode(() => normalizePosIdempotencyKey(''), 'POS_IDEMPOTENCY_KEY_REQUIRED')
  );
  ok(
    'la clave de idempotencia rechaza caracteres inseguros',
    throwsCode(
      () => normalizePosIdempotencyKey('clave no permitida'),
      'POS_IDEMPOTENCY_KEY_INVALID'
    )
  );
  ok(
    'la clave de idempotencia rechaza valores que superan el límite',
    throwsCode(
      () => normalizePosIdempotencyKey(`pos-${'x'.repeat(210)}`),
      'POS_IDEMPOTENCY_KEY_INVALID'
    )
  );

  const descriptor = buildPosSaleIdempotency({ key, payload, admin });
  const reorderedDescriptor = buildPosSaleIdempotency({
    key,
    payload: {
      payment: { amount: 50000, method: 'cash' },
      items: [{ quantity: 1, productId: 'producto-1' }],
      branchId: String(branchA),
    },
    admin,
  });
  ok(
    'la huella es estable aunque cambie el orden de las propiedades JSON',
    descriptor.requestHash === reorderedDescriptor.requestHash
  );
  ok(
    'la misma clave produce un identificador de pago POS estable',
    descriptor.paymentTransactionId === reorderedDescriptor.paymentTransactionId &&
      descriptor.paymentTransactionId.startsWith('POS-')
  );
  ok(
    'cambiar el importe cambia la huella de la operación',
    descriptor.requestHash !== buildPosSaleIdempotency({
      key,
      payload: { ...payload, payment: { method: 'cash', amount: 60000 } },
      admin,
    }).requestHash
  );
  ok(
    'la huella queda ligada al cajero autenticado',
    descriptor.requestHash !== buildPosSaleIdempotency({
      key,
      payload,
      admin: { id: String(new mongoose.Types.ObjectId()), username: 'otro' },
    }).requestHash
  );

  const records = new Map();
  const FakeIdempotencyModel = {
    findOne(query) {
      const record = records.get(`${query.endpoint}:${query.key}`) || null;
      return { lean: () => ({ exec: async () => record }) };
    },
    async create(documents, options) {
      const document = { _id: new mongoose.Types.ObjectId(), ...documents[0] };
      records.set(`${document.endpoint}:${document.key}`, document);
      FakeIdempotencyModel.createOptions = options;
      return [document];
    },
    async updateOne(query, update, options) {
      const mapKey = `${query.endpoint}:${query.key}`;
      const current = records.get(mapKey);
      FakeIdempotencyModel.updateOptions = options;
      if (!current || current.status !== query.status) return { matchedCount: 0 };
      Object.assign(current, update.$set);
      return { matchedCount: 1 };
    },
  };
  const fakeSession = { id: 'mongo-session-test' };

  ok(
    'una clave nueva continúa al flujo transaccional',
    (await inspectPosSaleIdempotency(descriptor, {
      IdempotencyModel: FakeIdempotencyModel,
    })).action === 'continue'
  );
  const record = await beginPosSaleIdempotency(descriptor, {
    session: fakeSession,
    IdempotencyModel: FakeIdempotencyModel,
  });
  ok(
    'el bloqueo idempotente se crea dentro de la sesión Mongo',
    record.status === 'processing' &&
      FakeIdempotencyModel.createOptions.session === fakeSession
  );
  ok(
    'un reintento concurrente se identifica como operación en proceso',
    (await inspectPosSaleIdempotency(descriptor, {
      IdempotencyModel: FakeIdempotencyModel,
    })).action === 'in_progress'
  );
  await completePosSaleIdempotency(
    record,
    descriptor,
    {
      order: { _id: new mongoose.Types.ObjectId(), orderNumber: '000999' },
      cashSession: { _id: new mongoose.Types.ObjectId() },
      cashRegisterCode: 'CAJA PRINCIPAL',
    },
    { session: fakeSession, IdempotencyModel: FakeIdempotencyModel }
  );
  ok(
    'la confirmación idempotente se guarda en la misma sesión Mongo',
    FakeIdempotencyModel.updateOptions.session === fakeSession
  );
  ok(
    'un reintento terminado reutiliza la orden original',
    (await inspectPosSaleIdempotency(descriptor, {
      IdempotencyModel: FakeIdempotencyModel,
    })).action === 'reuse'
  );
  ok(
    'reutilizar la clave con otra venta produce conflicto',
    (await inspectPosSaleIdempotency(
      { ...descriptor, requestHash: 'otra-huella' },
      { IdempotencyModel: FakeIdempotencyModel }
    )).action === 'conflict'
  );

  const sellerRequest = {
    adminAuthType: 'db',
    adminRole: 'seller',
    adminBranches: [
      { branch: branchA, canSell: true, canInvoice: false },
      { branch: branchB, canSell: false, canInvoice: true },
    ],
  };
  ok(
    'un cajero solo puede vender en sedes con canSell',
    getAllowedPosBranchIds(sellerRequest, { requireSell: true }).join(',') ===
      String(branchA)
  );
  ok(
    'la sede asignada solo para facturar no permite vender',
    throwsCode(
      () => assertPosBranchAccess(sellerRequest, branchB, { requireSell: true }),
      'POS_BRANCH_FORBIDDEN'
    )
  );
  ok(
    'las consultas de recibos quedan limitadas a las sedes asignadas',
    buildPosResourceAccess(sellerRequest).branchIds.length === 2
  );
  ok(
    'owner autenticado por base de datos conserva alcance global',
    buildPosResourceAccess({ adminAuthType: 'db', adminRole: 'owner' }).branchIds === null
  );
  ok(
    'la autenticación legacy no obtiene acceso global implícito',
    throwsCode(
      () => buildPosResourceAccess({ adminAuthType: 'legacy', adminRole: 'owner' }),
      'POS_BRANCH_ASSIGNMENT_REQUIRED'
    )
  );
  ok(
    'manager puede supervisar caja pero seller no',
    canSuperviseCashSession({ adminAuthType: 'db', adminRole: 'manager' }) &&
      !canSuperviseCashSession(sellerRequest)
  );
  ok(
    'el alcance de caja transporta sedes y facultad de supervisión',
    buildCashSessionAccess(sellerRequest).branchIds.length === 2 &&
      buildCashSessionAccess(sellerRequest).canSupervise === false
  );

  const sessionId = new mongoose.Types.ObjectId();
  const scopedFilter = buildScopedCashSessionFilter(sessionId, {
    branchIds: [String(branchA)],
  });
  ok(
    'la búsqueda de caja aplica el filtro de sede en Mongo',
    String(scopedFilter._id) === String(sessionId) &&
      scopedFilter.branch.$in.map(String).includes(String(branchA))
  );
  ok(
    'solo el cajero dueño puede operar su caja sin supervisión',
    assertCashSessionOperator(
      { _id: sessionId, cashier: sellerId },
      { id: String(sellerId) }
    ) === true
  );
  ok(
    'otro cajero recibe un rechazo explícito',
    throwsCode(
      () => assertCashSessionOperator(
        { _id: sessionId, cashier: new mongoose.Types.ObjectId() },
        { id: String(sellerId) }
      ),
      'CASH_SESSION_OPERATOR_FORBIDDEN'
    )
  );
  ok(
    'el modelo de caja usa concurrencia optimista',
    CashSession.schema.options.optimisticConcurrency === true
  );
  ok(
    'los conflictos de versión y escritura se reconocen como concurrencia',
    isCashConcurrencyError({ name: 'VersionError' }) &&
      isCashConcurrencyError({ codeName: 'WriteConflict' })
  );

  const posRoute = read('backend/routes/adminPos.js');
  const cashRoute = read('backend/routes/adminCashSessions.js');
  const receiptRoute = read('backend/routes/adminPosReceipt.js');
  const receiptService = read('backend/services/posReceiptService.js');
  const receiptUi = read('frontend/src/admin/pos/PosReceiptActions.jsx');
  const posApi = read('frontend/src/admin/api/adminPosApi.js');
  const apiClient = read('frontend/src/lib/api.js');
  const postCommit = read('backend/services/orderCreationPostCommitService.js');
  const permissionMap = read('backend/security/adminRoutePermissionMap.js');

  ok(
    'la ruta de venta exige Idempotency-Key antes de crear la orden',
    posRoute.includes("req.headers['idempotency-key']") &&
      posRoute.includes('inspectPosSaleIdempotency')
  );
  ok(
    'el frontend envía una clave estable por intento de venta',
    posApi.includes('postIdempotent(') &&
      posApi.includes('idempotencyKey') &&
      apiClient.includes("'Idempotency-Key': key") &&
      read('frontend/src/admin/pos/PosSalesPageSafe.jsx').includes('saleAttemptKeyRef')
  );
  ok(
    'todas las rutas de caja construyen alcance por sede',
    (cashRoute.match(/buildCashSessionAccess/g) || []).length >= 5
  );
  ok(
    'consultar o enviar un recibo no genera factura electrónica',
    !receiptRoute.includes('generateInvoice') &&
      !receiptService.includes('generateElectronicInvoiceAfterPayment') &&
      !receiptUi.includes('generateInvoice')
  );
  ok(
    'el cumplimiento POS usa el mecanismo postcommit recuperable',
    postCommit.includes('processFulfillmentOnce: defaultService.processFulfillmentOnce') &&
      read('backend/services/posCashSaleService.js').includes('processFulfillmentOnce')
  );
  ok(
    'ventas, recibos y operaciones de caja tienen permiso y auditoría global',
    permissionMap.includes("path: '/api/admin/pos/sales'") &&
      permissionMap.includes("path: '/api/admin/pos/sales/:id/receipt'") &&
      permissionMap.includes("path: '/api/admin/cash-sessions/:id/close'")
  );

  console.log(`\nEtapa 1 POS validada: ${controls} controles superados.`);
}

main().catch((error) => {
  console.error('Fallo en Etapa 1 POS:', error);
  process.exitCode = 1;
});
