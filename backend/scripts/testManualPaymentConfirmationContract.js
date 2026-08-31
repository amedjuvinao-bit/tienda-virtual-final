/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const AdminRole = require('../models/AdminRole');
const ManualPaymentConfirmation = require('../models/ManualPaymentConfirmation');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');
const {
  ADMIN_PERMISSION_KEYS,
} = require('../security/adminPermissionCatalog');
const {
  validateOrderStatusTransition,
} = require('../services/orderStatusTransitionService');
const {
  createManualPaymentConfirmationService,
} = require('../services/manualPaymentConfirmationService');
const {
  manualPaymentErrorResponse,
  presentManualPaymentOrder,
} = require('../controllers/orderManualPaymentController');

const ROOT = path.resolve(__dirname, '..', '..');
const IDS = {
  manual: '64c000000000000000009001',
  concurrent: '64c000000000000000009002',
  wompi: '64c000000000000000009003',
  payu: '64c000000000000000009004',
  other: '64c000000000000000009005',
};

let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeOrder(id, provider = 'manual') {
  return {
    _id: id,
    orderNumber: `ORDER-${id.slice(-4)}`,
    sessionId: `SESSION-${id.slice(-4)}`,
    status: 'pending',
    total: 125000,
    items: [{ title: 'Producto', productType: 'physical', quantity: 1 }],
    payment: {
      provider,
      status: provider === 'manual' ? 'pending_manual' : 'pending_gateway',
      amount: 125000,
      amountInCents: 12500000,
      currency: 'COP',
      splitPayments: [],
    },
    storeCredit: { applied: false, status: 'none', amount: 0 },
    inventoryControl: {
      reservationRequired: true,
      reservationId: `reservation-${id}`,
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
    timeline: [],
  };
}

function query(getter) {
  let useLean = false;
  const api = {
    session() {
      return api;
    },
    lean() {
      useLean = true;
      return api;
    },
    async exec() {
      const value = getter();
      return useLean && value ? clone(value) : value;
    },
  };
  return api;
}

function createHarness(
  initialOrders,
  { inventoryError = null, postCommitError = null } = {}
) {
  const state = {
    orders: new Map(initialOrders.map((order) => [String(order._id), clone(order)])),
    evidence: [],
    events: [],
    inventoryCalls: 0,
    statsCalls: 0,
    postCommitCalls: 0,
  };
  let sequence = 0;
  let lock = Promise.resolve();

  function documentFor(id) {
    const stored = state.orders.get(String(id));
    if (!stored) return null;
    const document = clone(stored);
    document.save = async () => {
      const persisted = clone(document);
      delete persisted.save;
      state.orders.set(String(id), persisted);
      return document;
    };
    return document;
  }

  const mongooseAdapter = {
    Types: { ObjectId: { isValid: (value) => /^[a-f0-9]{24}$/i.test(value) } },
    async startSession() {
      return {
        async withTransaction(work) {
          const previous = lock;
          let unlock;
          lock = new Promise((resolve) => {
            unlock = resolve;
          });
          await previous;
          const snapshot = {
            orders: new Map(
              [...state.orders.entries()].map(([key, value]) => [key, clone(value)])
            ),
            evidence: clone(state.evidence),
            events: clone(state.events),
          };
          try {
            await work();
          } catch (error) {
            state.orders = snapshot.orders;
            state.evidence = snapshot.evidence;
            state.events = snapshot.events;
            throw error;
          } finally {
            unlock();
          }
        },
        async endSession() {},
      };
    },
  };

  const OrderModel = {
    findById(id) {
      return query(() => documentFor(id));
    },
  };
  const EvidenceModel = {
    findOne(filter) {
      return query(() => {
        return (
          state.evidence.find((entry) => {
            if (filter.order && String(entry.order) !== String(filter.order)) {
              return false;
            }
            if (filter.provider && entry.provider !== filter.provider) return false;
            if (
              filter.referenceKey &&
              entry.referenceKey !== filter.referenceKey
            ) {
              return false;
            }
            return true;
          }) || null
        );
      });
    },
    async create(documents) {
      const document = clone(documents[0]);
      if (
        state.evidence.some(
          (entry) =>
            String(entry.order) === String(document.order) ||
            (entry.provider === document.provider &&
              entry.referenceKey === document.referenceKey)
        )
      ) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      sequence += 1;
      document._id = `74c00000000000000000${String(sequence).padStart(4, '0')}`;
      state.evidence.push(document);
      return [document];
    },
  };

  const service = createManualPaymentConfirmationService({
    mongooseAdapter,
    OrderModel,
    ManualPaymentConfirmationModel: EvidenceModel,
    OrderEventModel: {
      async create(events) {
        state.events.push(...clone(events));
      },
    },
    async confirmReservation(identifier) {
      state.inventoryCalls += 1;
      if (inventoryError) throw inventoryError;
      return {
        _id: identifier,
        reservationCode: `RES-${state.inventoryCalls}`,
        status: 'confirmed',
        items: [],
      };
    },
    applyReservation(order) {
      order.inventoryAllocations = [];
    },
    async customerStatsApplier() {
      state.statsCalls += 1;
    },
    async consumeStoreCredit() {
      throw new Error('No debe consumir saldo en este contrato.');
    },
    async postCommitProcessor() {
      state.postCommitCalls += 1;
      if (postCommitError) throw postCommitError;
      return { processed: true };
    },
    now: () => new Date('2026-08-27T12:00:00.000Z'),
  });

  return { service, state };
}

const validPayment = Object.freeze({
  method: 'transfer',
  reference: 'TRX-MANUAL-0001',
  amount: 125000,
  currency: 'COP',
  reason: 'Transferencia verificada en el extracto bancario.',
});
const actor = Object.freeze({
  id: 'admin-finance-01',
  label: 'Equipo de facturación',
  role: 'billing',
  source: 'admin_manual_payment',
});

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => error?.code === code);
}

async function main() {
  const presentedOrder = presentManualPaymentOrder({
    _id: IDS.manual,
    orderNumber: 'ORDER-9001',
    status: 'paid',
    total: 125000,
    payment: {
      status: 'paid',
      provider: 'manual',
      rawMethod: { bankSecret: 'never-expose' },
    },
    paymentProcessing: { claimId: 'never-expose' },
    customer: { id: 'never-expose' },
  });
  assert.strictEqual(presentedOrder.paymentStatus, 'paid');
  assert.strictEqual(JSON.stringify(presentedOrder).includes('never-expose'), false);
  ok('la respuesta HTTP presenta un resumen mínimo sin datos internos');

  assert.throws(
    () =>
      validateOrderStatusTransition(
        { status: 'pending', payment: { status: 'pending_manual' } },
        'paid'
      ),
    (error) =>
      error?.code === 'ORDER_PAYMENT_CONFIRMATION_REQUIRED' &&
      error?.statusCode === 409
  );
  assert.doesNotThrow(() =>
    validateOrderStatusTransition(
      { status: 'pending', payment: { status: 'paid' } },
      'paid'
    )
  );
  ok('PATCH de estado solo reconcilia un hecho de pago ya confirmado');

  const blocked = createHarness([
    makeOrder(IDS.wompi, 'wompi'),
    makeOrder(IDS.payu, 'payu'),
  ]);
  await rejectsCode(
    blocked.service.confirmManualPayment({
      orderId: IDS.wompi,
      payment: validPayment,
      actor,
    }),
    'MANUAL_PAYMENT_PROVIDER_FORBIDDEN'
  );
  await rejectsCode(
    blocked.service.confirmManualPayment({
      orderId: IDS.payu,
      payment: validPayment,
      actor,
    }),
    'MANUAL_PAYMENT_PROVIDER_FORBIDDEN'
  );
  assert.strictEqual(blocked.state.evidence.length, 0);
  assert.strictEqual(blocked.state.inventoryCalls, 0);
  ok('Wompi y PayU quedan bloqueados antes de evidencia o inventario');

  const validation = createHarness([makeOrder(IDS.manual)]);
  await rejectsCode(
    validation.service.confirmManualPayment({
      orderId: IDS.manual,
      payment: { ...validPayment, amount: 124999 },
      actor,
    }),
    'MANUAL_PAYMENT_AMOUNT_MISMATCH'
  );
  await rejectsCode(
    validation.service.confirmManualPayment({
      orderId: IDS.manual,
      payment: { ...validPayment, currency: 'USD' },
      actor,
    }),
    'MANUAL_PAYMENT_CURRENCY_MISMATCH'
  );
  await rejectsCode(
    validation.service.confirmManualPayment({
      orderId: IDS.manual,
      payment: { ...validPayment, method: 'crypto' },
      actor,
    }),
    'MANUAL_PAYMENT_METHOD_NOT_ALLOWED'
  );
  assert.strictEqual(validation.state.evidence.length, 0);
  ok('monto y moneda deben coincidir exactamente antes de persistir');

  const successful = await validation.service.confirmManualPayment({
    orderId: IDS.manual,
    payment: validPayment,
    actor,
  });
  assert.strictEqual(successful.confirmed, true);
  assert.strictEqual(successful.duplicate, false);
  assert.strictEqual(validation.state.evidence.length, 1);
  assert.strictEqual(validation.state.inventoryCalls, 1);
  assert.strictEqual(validation.state.statsCalls, 1);
  assert.strictEqual(validation.state.postCommitCalls, 1);
  assert.strictEqual(successful.order.status, 'paid');
  assert.strictEqual(successful.order.payment.status, 'paid');
  assert.strictEqual(successful.evidence.method, validPayment.method);
  assert.strictEqual(successful.evidence.reference, validPayment.reference);
  assert.strictEqual(successful.evidence.amount, validPayment.amount);
  assert.strictEqual(successful.evidence.currency, validPayment.currency);
  assert.deepStrictEqual(successful.evidence.actor, {
    id: actor.id,
    label: actor.label,
    role: actor.role,
  });
  assert(successful.evidence.confirmedAt);
  assert.strictEqual(successful.order.payment.manualConfirmation.reason, validPayment.reason);
  assert.strictEqual(
    validation.state.events.filter(
      (event) => event.type === 'manual_payment_confirmed'
    ).length,
    1
  );
  ok('éxito atómico deja evidencia, inventario, pago, timeline y evento');

  const inventoryFailure = createHarness(
    [makeOrder(IDS.other)],
    {
      inventoryError: Object.assign(new Error('Reserva rechazada.'), {
        code: 'INVENTORY_RESERVATION_REJECTED',
      }),
    }
  );
  await rejectsCode(
    inventoryFailure.service.confirmManualPayment({
      orderId: IDS.other,
      payment: { ...validPayment, reference: 'TRX-INVENTORY-FAIL' },
      actor,
    }),
    'INVENTORY_RESERVATION_REJECTED'
  );
  assert.strictEqual(inventoryFailure.state.evidence.length, 0);
  assert.strictEqual(inventoryFailure.state.events.length, 0);
  assert.strictEqual(
    inventoryFailure.state.orders.get(IDS.other).payment.status,
    'pending_manual'
  );
  assert.strictEqual(inventoryFailure.state.postCommitCalls, 0);
  ok('un fallo de inventario revierte evidencia, pago y eventos');

  const postCommitFailure = createHarness(
    [makeOrder(IDS.other)],
    {
      postCommitError: Object.assign(new Error('Entrega pendiente.'), {
        code: 'POST_COMMIT_RETRY_REQUIRED',
      }),
    }
  );
  const committed = await postCommitFailure.service.confirmManualPayment({
    orderId: IDS.other,
    payment: { ...validPayment, reference: 'TRX-POST-COMMIT-FAIL' },
    actor,
  });
  assert.strictEqual(committed.confirmed, true);
  assert.strictEqual(committed.order.payment.status, 'paid');
  assert.strictEqual(committed.postCommitWarning.code, 'POST_COMMIT_RETRY_REQUIRED');
  assert.strictEqual(postCommitFailure.state.evidence.length, 1);
  ok('un fallo post-commit no deshace el hecho financiero ya confirmado');

  const replay = await validation.service.confirmManualPayment({
    orderId: IDS.manual,
    payment: validPayment,
    actor,
  });
  assert.strictEqual(replay.confirmed, false);
  assert.strictEqual(replay.duplicate, true);
  assert.strictEqual(validation.state.evidence.length, 1);
  assert.strictEqual(validation.state.inventoryCalls, 1);
  assert.strictEqual(validation.state.statsCalls, 1);
  assert.strictEqual(validation.state.postCommitCalls, 2);
  ok('replay idéntico es idempotente y solo reintenta post-commit seguro');

  await rejectsCode(
    validation.service.confirmManualPayment({
      orderId: IDS.manual,
      payment: { ...validPayment, reason: 'Otra evidencia administrativa.' },
      actor,
    }),
    'MANUAL_PAYMENT_CONFIRMATION_CONFLICT'
  );
  ok('replay con evidencia diferente produce conflicto explícito');

  const concurrent = createHarness([makeOrder(IDS.concurrent)]);
  const results = await Promise.all([
    concurrent.service.confirmManualPayment({
      orderId: IDS.concurrent,
      payment: { ...validPayment, reference: 'TRX-CONCURRENT-01' },
      actor,
    }),
    concurrent.service.confirmManualPayment({
      orderId: IDS.concurrent,
      payment: { ...validPayment, reference: 'TRX-CONCURRENT-01' },
      actor,
    }),
  ]);
  assert.strictEqual(results.filter((result) => result.confirmed).length, 1);
  assert.strictEqual(results.filter((result) => result.duplicate).length, 1);
  assert.strictEqual(concurrent.state.evidence.length, 1);
  assert.strictEqual(concurrent.state.inventoryCalls, 1);
  assert.strictEqual(
    concurrent.state.events.filter(
      (event) => event.type === 'manual_payment_confirmed'
    ).length,
    1
  );
  ok('dos confirmaciones concurrentes producen un solo efecto financiero');

  const referenceReuse = createHarness([
    makeOrder(IDS.manual),
    makeOrder(IDS.other),
  ]);
  await referenceReuse.service.confirmManualPayment({
    orderId: IDS.manual,
    payment: validPayment,
    actor,
  });
  await rejectsCode(
    referenceReuse.service.confirmManualPayment({
      orderId: IDS.other,
      payment: validPayment,
      actor,
    }),
    'MANUAL_PAYMENT_REFERENCE_CONFLICT'
  );
  ok('una referencia manual no puede reutilizarse en otra orden');

  const permission = 'orders:confirm_manual_payment';
  assert(ADMIN_PERMISSION_KEYS.includes(permission));
  assert.strictEqual(
    findAdminRoutePermission(
      'POST',
      `/api/orders/${IDS.manual}/payments/manual-confirmation`
    )?.permission,
    permission
  );
  const roles = AdminRole.getDefaultRoles();
  ['owner', 'admin', 'billing'].forEach((roleCode) => {
    assert(
      roles.find((role) => role.code === roleCode)?.permissions.includes(permission),
      roleCode
    );
  });
  ['manager', 'cashier', 'seller', 'warehouse'].forEach((roleCode) => {
    assert(
      !roles.find((role) => role.code === roleCode)?.permissions.includes(permission),
      roleCode
    );
  });
  ok('el permiso peligroso solo llega a propietario, admin y facturación');

  const safeDomainError = manualPaymentErrorResponse({
    statusCode: 409,
    code: 'MANUAL_PAYMENT_CONFIRMATION_CONFLICT',
    message: 'La evidencia no coincide.',
    details: { field: 'reference' },
  });
  assert.strictEqual(safeDomainError.status, 409);
  assert.strictEqual(
    safeDomainError.payload.code,
    'MANUAL_PAYMENT_CONFIRMATION_CONFLICT'
  );
  const hiddenUnexpectedError = manualPaymentErrorResponse({
    statusCode: 500,
    code: 'MONGO_INTERNAL_FAILURE',
    message: 'mongodb://user:secret@internal-host/orders',
    details: { stack: 'sensitive stack' },
  });
  assert.deepStrictEqual(hiddenUnexpectedError, {
    status: 500,
    payload: {
      error: 'MANUAL_PAYMENT_CONFIRMATION_FAILED',
      code: 'MANUAL_PAYMENT_CONFIRMATION_FAILED',
      message: 'No fue posible confirmar el pago manual de la orden.',
    },
  });
  ok('errores inesperados no exponen mensajes ni detalles internos');

  const indexes = ManualPaymentConfirmation.schema.indexes();
  assert(
    indexes.some(
      ([key, options]) => key.order === 1 && options.unique === true
    )
  );
  assert(
    indexes.some(
      ([key, options]) =>
        key.provider === 1 && key.referenceKey === 1 && options.unique === true
    )
  );
  const routes = read('backend/routes/orders.js');
  const serviceSource = read(
    'backend/services/manualPaymentConfirmation/transaction.js'
  );
  assert(
    routes.includes("requirePermission('orders:confirm_manual_payment')")
  );
  assert(!serviceSource.includes("require('../models/PaymentAttempt')"));
  assert(!serviceSource.includes('wompi'));
  assert(!serviceSource.includes('payu'));
  assert(serviceSource.includes('session.withTransaction'));
  assert(serviceSource.includes('OrderEventModel.create(events, { session'));
  ok('composición conserva ledger propio y no toca gateways ni PaymentAttempt');

  console.log(
    `\nConfirmación manual segura: ${passed}/${passed} verificaciones aprobadas.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
