'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const Module = require('module');
const {
  secureChecksumEquals,
} = require('../controllers/wompiWebhookController');

const FIXTURE_WEBHOOK_SECRET = 'local-fixture-wompi-webhook-secret';
const ORDER_NUMBER = 'WOMPI-INTEGRITY-0001';
const ORDER_REFERENCE = `ORDER-${ORDER_NUMBER}__TRY__integrity-fixture`;
const AMOUNT_IN_CENTS = 125000;
const FIRST_PAID_AT = '2026-01-10T10:00:00.000Z';
const LATER_PAID_AT = '2026-01-11T11:00:00.000Z';

const state = {
  order: null,
  confirmMode: 'success',
  inventoryConfirmed: false,
  confirmationCalls: 0,
  inventoryMutationCount: 0,
  kardexCount: 0,
  reservationStatus: 'pending',
  invoiceMode: 'success',
  invoiceAttemptCount: 0,
  invoiceSchedulingCount: 0,
  orderEvents: [],
  transactionBarrier: null,
  inventoryBarrier: null,
  invoiceClaimBarrier: null,
  transactionMutex: null,
  inventoryMutex: null,
  mongoMutex: null,
  paymentAttempt: null,
};

function createBarrier(parties) {
  let arrivals = 0;
  let release;
  const released = new Promise((resolve) => {
    release = resolve;
  });
  return {
    async wait() {
      arrivals += 1;
      if (arrivals >= parties) release();
      await released;
    },
    get arrivals() {
      return arrivals;
    },
  };
}

function createMutex() {
  let tail = Promise.resolve();
  return async (work) => {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  };
}

function makeOrder(overrides = {}) {
  const payment = {
    active: true,
    provider: 'wompi',
    providerLabel: 'Wompi',
    mode: 'sandbox',
    currency: 'COP',
    enableWebhook: true,
    status: 'pending_gateway',
    paidAt: null,
    ...(overrides.payment || {}),
  };
  const inventoryControl = {
    reservationRequired: true,
    reservationId: 'reservation-fixture-1',
    discountedAtCheckout: true,
    restockedOnFailure: false,
    ...(overrides.inventoryControl || {}),
  };

  return {
    _id: 'order-fixture-1',
    orderNumber: ORDER_NUMBER,
    total: AMOUNT_IN_CENTS / 100,
    status: 'pending',
    source: 'online',
    payment,
    paymentProcessing: overrides.paymentProcessing,
    inventoryControl,
    inventoryAllocations: [
      {
        quantity: 1,
        soldQuantity: 0,
      },
    ],
    inventoryAllocationSummary: {
      totalQuantity: 1,
      soldQuantity: 0,
      activeReservedQuantity: 1,
    },
    fulfillment: {
      status: 'pending',
      notificationError: '',
    },
    timeline: [],
    items: [],
    async save() {
      return this;
    },
    ...overrides,
    payment,
    inventoryControl,
  };
}

function resetState(
  orderOverrides = {},
  confirmMode = 'success',
  invoiceMode = 'success'
) {
  state.order = makeOrder(orderOverrides);
  state.confirmMode = confirmMode;
  state.invoiceMode = invoiceMode;
  state.inventoryConfirmed = false;
  state.reservationStatus = 'pending';
  state.confirmationCalls = 0;
  state.inventoryMutationCount = 0;
  state.kardexCount = 0;
  state.invoiceAttemptCount = 0;
  state.invoiceSchedulingCount = 0;
  state.orderEvents = [];
  state.transactionBarrier = null;
  state.inventoryBarrier = null;
  state.invoiceClaimBarrier = null;
  state.transactionMutex = createMutex();
  state.inventoryMutex = createMutex();
  state.mongoMutex = createMutex();
  state.paymentAttempt = {
    provider: 'wompi',
    order: state.order._id,
    orderNumber: state.order.orderNumber,
    reference: ORDER_REFERENCE,
    amountInCents: AMOUNT_IN_CENTS,
    currency: 'COP',
    state: 'issued',
    active: true,
    issuedBySystem: true,
    transactionId: '',
  };
}

function setDotted(target, dottedPath, value) {
  const parts = String(dottedPath).split('.');
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function applyUpdate(target, update = {}) {
  for (const [dottedPath, value] of Object.entries(update.$set || {})) {
    setDotted(target, dottedPath, value);
  }
  for (const dottedPath of Object.keys(update.$unset || {})) {
    setDotted(target, dottedPath, undefined);
  }
}

function getDotted(target, dottedPath) {
  return String(dottedPath)
    .split('.')
    .reduce((value, key) => value?.[key], target);
}

function matchesCondition(value, condition) {
  if (
    condition &&
    typeof condition === 'object' &&
    !Array.isArray(condition) &&
    !(condition instanceof Date)
  ) {
    if ('$in' in condition) return condition.$in.includes(value);
    if ('$exists' in condition) {
      return condition.$exists ? value !== undefined : value === undefined;
    }
    if ('$lt' in condition) {
      return new Date(value).getTime() < new Date(condition.$lt).getTime();
    }
  }
  return String(value) === String(condition);
}

function matchesFilter(target, filter = {}) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') {
      return condition.some((candidate) => matchesFilter(target, candidate));
    }
    return matchesCondition(getDotted(target, key), condition);
  });
}

function thenableOrderQuery() {
  const promise = Promise.resolve(state.order);
  return {
    session: async () => state.order,
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
}

const fakeOrderModel = {
  findOne: () => thenableOrderQuery(),
  findById: () => thenableOrderQuery(),
  findOneAndUpdate: async (filter, update) => {
    if (
      state.invoiceClaimBarrier &&
      update?.$set?.['paymentProcessing.invoice.status'] === 'scheduling'
    ) {
      await state.invoiceClaimBarrier.wait();
    }
    return state.mongoMutex(async () => {
      if (!matchesFilter(state.order, filter)) return null;
      applyUpdate(state.order, update);
      return state.order;
    });
  },
  updateOne: async (filter, update) => {
    return state.mongoMutex(async () => {
      if (!matchesFilter(state.order, filter)) {
        return { matchedCount: 0, modifiedCount: 0 };
      }
      applyUpdate(state.order, update);
      return { matchedCount: 1, modifiedCount: 1 };
    });
  },
};

const fakeOrderEventModel = {
  create: async (documents) => {
    state.orderEvents.push(...documents.map((document) => ({ ...document })));
    return documents;
  },
};

const fakePaymentAttemptService = {
  findAttempt: async () => state.paymentAttempt,
  issueAttempt: async () => ({ attempt: state.paymentAttempt, reused: true }),
  claimApprovedAttempt: async ({ order, reference, transactionId, amountInCents }) => {
    const attempt = state.paymentAttempt;
    if (
      !attempt ||
      attempt.reference !== reference ||
      Number(attempt.amountInCents) !== Number(amountInCents)
    ) {
      return {
        allowed: false,
        reconciliationRequired: true,
        code: 'PAYMENT_ATTEMPT_VALUE_MISMATCH',
        message: 'Intento inconsistente.',
      };
    }
    if (attempt.state === 'approved') {
      if (attempt.transactionId === transactionId) {
        return { allowed: true, duplicate: true };
      }
      return {
        allowed: false,
        reconciliationRequired: true,
        code: 'PAYMENT_SECOND_CHARGE_DETECTED',
        message: 'Segundo cobro.',
      };
    }
    attempt.state = 'approved';
    attempt.active = false;
    attempt.transactionId = transactionId;
    return { allowed: true, duplicate: false };
  },
  claimNonApprovedAttempt: async ({ reference, amountInCents }) => {
    const attempt = state.paymentAttempt;
    if (
      !attempt ||
      attempt.active !== true ||
      attempt.reference !== reference ||
      Number(attempt.amountInCents) !== Number(amountInCents)
    ) {
      return { allowed: false, ignored: true, reason: 'PAYMENT_ATTEMPT_NOT_ACTIVE' };
    }
    attempt.active = false;
    attempt.state = 'declined';
    return { allowed: true, ignored: false };
  },
};

const fakePaymentAttemptModule = {
  createPaymentAttemptService: () => fakePaymentAttemptService,
  fingerprintPaymentMerchant: () => 'fixture-merchant-fingerprint',
};

const fakeMongoose = {
  models: { OrderEvent: fakeOrderEventModel },
  Types: {
    ObjectId: {
      isValid: () => true,
    },
  },
  startSession: async () => ({
    withTransaction: async (work) => {
      if (state.transactionBarrier) {
        await state.transactionBarrier.wait();
      }
      return state.transactionMutex(work);
    },
    endSession: async () => {},
  }),
};

const fakeSiteSettings = {
  findOne: () => ({
    lean: async () => ({
      theme: {
        global: {
          payments: {
            active: true,
            provider: 'wompi',
            mode: 'sandbox',
            currency: 'COP',
            enableWebhook: true,
            credentials: {
              wompi: {
                webhookSecret: FIXTURE_WEBHOOK_SECRET,
              },
            },
          },
        },
      },
    }),
  }),
};

const fakeInventoryReservationService = {
  confirmInventoryReservation: async () => {
    state.confirmationCalls += 1;
    if (state.inventoryBarrier) {
      await state.inventoryBarrier.wait();
    }
    return state.inventoryMutex(async () => {
      if (state.confirmMode === 'fail') {
        const error = new Error('SIMULATED_INVENTORY_CONFIRMATION_FAILURE');
        error.code = 'SIMULATED_INVENTORY_CONFIRMATION_FAILURE';
        throw error;
      }

      if (state.reservationStatus !== 'confirmed') {
        state.reservationStatus = 'confirmed';
        state.inventoryConfirmed = true;
        state.inventoryMutationCount += 1;
        state.kardexCount += 1;
      }

      return {
        _id: 'reservation-fixture-1',
        reservationCode: 'RES-FIXTURE-1',
        status: state.reservationStatus,
        totalQuantity: 1,
        soldQuantity: 1,
        activeReservedQuantity: 0,
      };
    });
  },
  releaseInventoryReservation: async () => ({
    _id: 'reservation-fixture-1',
    reservationCode: 'RES-FIXTURE-1',
    status: 'released',
    totalQuantity: 1,
    soldQuantity: 0,
    activeReservedQuantity: 0,
  }),
};

const fakeOrderInventoryAllocationService = {
  applyReservationToOrderDocument: (order, reservation) => {
    order.inventoryControl = {
      ...(order.inventoryControl || {}),
      reservationRequired: true,
      reservationId: reservation._id,
    };
    order.inventoryAllocations = [
      {
        quantity: reservation.totalQuantity,
        soldQuantity: reservation.soldQuantity,
      },
    ];
    order.inventoryAllocationSummary = {
      totalQuantity: reservation.totalQuantity,
      soldQuantity: reservation.soldQuantity,
      activeReservedQuantity: reservation.activeReservedQuantity,
    };
  },
};

const fakeElectronicInvoiceIssuanceService = {
  issueElectronicInvoiceForOrder: async () => {
    state.invoiceAttemptCount += 1;
    if (state.invoiceMode === 'fail') {
      const error = new Error('SIMULATED_INVOICE_OPERATION_FAILURE');
      error.code = 'SIMULATED_INVOICE_OPERATION_FAILURE';
      throw error;
    }
    if (state.invoiceMode === 'skip-terminal') {
      return {
        skipped: true,
        message: 'Facturacion electronica inactiva en la fixture.',
        invoice: null,
      };
    }
    if (state.invoiceMode === 'skip-retryable') {
      return {
        reused: true,
        retryable: true,
        inProgress: false,
        invoice: { status: 'failed' },
      };
    }
    if (state.invoiceMode === 'in-progress') {
      return {
        created: false,
        reused: true,
        retryable: false,
        inProgress: true,
        invoice: { status: 'processing' },
      };
    }
    state.invoiceSchedulingCount += 1;
    return {
      created: true,
      reused: false,
      invoice: { status: 'generated' },
    };
  },
};

const fakeOrderFulfillmentService = {
  processOrderFulfillmentAfterPayment: async () => ({ ok: true }),
};

const fakePublicPaymentAccessService = {
  SAFE_PAYMENT_ACCESS_ERROR: 'PAYMENT_ACCESS_DENIED',
  buildPublicCheckoutResponse: () => ({}),
  buildPublicTransactionResponse: () => ({}),
  isValidObjectIdText: () => true,
  isValidTransactionId: () => true,
  isWompiTransactionOwnedByOrder: () => true,
  resolveAuthorizedPublicPaymentOrder: async () => ({ order: state.order }),
};

const fakeElectronicInvoiceModel = {
  findOne: async () => null,
  find: () => ({ sort: () => ({ lean: async () => [] }) }),
  deleteOne: async () => ({ deletedCount: 0 }),
};

const originalLoad = Module._load;
Module._load = function loadWithIntegrityDoubles(request, parent, isMain) {
  const doubles = {
    mongoose: fakeMongoose,
    '../models/SiteSettings': fakeSiteSettings,
    '../models/Order': fakeOrderModel,
    '../models/OrderEvent': fakeOrderEventModel,
    '../models/PaymentAttempt': {},
    '../models/StoreCreditUsage': {},
    '../models/Product': { findById: async () => null },
    '../models/MailSettings': {},
    '../lib/mail/mailer': { sendMail: async () => ({}) },
    '../middleware/requireAdmin': (req, res, next) => next(),
    '../middleware/requirePermission': () => (req, res, next) => next(),
    '../services/inventoryReservationService': fakeInventoryReservationService,
    '../services/orderInventoryAllocationService':
      fakeOrderInventoryAllocationService,
    './electronicInvoiceIssuanceService': fakeElectronicInvoiceIssuanceService,
    './orderFulfillmentService': fakeOrderFulfillmentService,
    '../services/publicPaymentAccessService': fakePublicPaymentAccessService,
    '../services/paymentAttemptService': fakePaymentAttemptModule,
    '../models/ElectronicInvoice': fakeElectronicInvoiceModel,
    '../lib/dian/providers/factusProvider': {
      deleteFactusBillByReference: async () => ({}),
      getFactusCredentials: async () => ({}),
      getFactusAccessToken: async () => '',
    },
    '../services/electronicCreditNoteService': {
      createOfficialCreditNote: async () => ({}),
    },
    '../services/orderRefundReconciliationService': {
      linkRefundCreditNote: async () => ({}),
    },
    '../lib/orders/orderTimeline': {
      addInvoiceGeneratedEvent: async () => {},
      addInvoiceValidatedEvent: async () => {},
      addInvoiceFailedEvent: async () => {},
      addInvoiceDeletedEvent: async () => {},
      addInvoiceRetryEvent: async () => {},
    },
  };

  if (Object.prototype.hasOwnProperty.call(doubles, request)) {
    return doubles[request];
  }
  return originalLoad.call(this, request, parent, isMain);
};

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

let paymentsRouter;
let isBillableOrder;
let executeElectronicInvoiceAfterPayment;
let isInventoryReadyForBilling;
let resolveInitialInventoryStatus;
try {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  paymentsRouter = require('../routes/payments');
  ({ isBillableOrder } = require('../services/electronicInvoiceIssuanceService'));
  ({
    executeElectronicInvoiceAfterPayment,
  } = require('../services/electronicInvoiceAfterPaymentService'));
  ({
    isInventoryReadyForBilling,
    resolveInitialInventoryStatus,
  } = require('../services/orderInventoryBillingReadinessService'));
} finally {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  Module._load = originalLoad;
}

const webhookLayer = paymentsRouter.stack.find(
  (layer) => layer.route?.path === '/wompi/webhook' && layer.route.methods?.post
);
assert(webhookLayer, 'No se encontro POST /wompi/webhook.');
const webhookHandler = webhookLayer.route.stack.at(-1).handle;

function signedEvent(status, options = {}) {
  const transaction = {
    id: options.transactionId || `tx-${status.toLowerCase()}`,
    status,
    reference: ORDER_REFERENCE,
    amount_in_cents: AMOUNT_IN_CENTS,
    currency: 'COP',
    payment_method_type: 'CARD',
    payment_method: { type: 'CARD' },
    created_at: options.createdAt || LATER_PAID_AT,
    finalized_at: options.finalizedAt || null,
  };
  const body = {
    event: 'transaction.updated',
    data: { transaction },
    timestamp: options.timestamp || 1770000000,
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
      ],
    },
  };
  const propertiesConcat = body.signature.properties
    .map((property) =>
      property.split('.').reduce((value, key) => value?.[key], body.data)
    )
    .map((value) => (value === undefined || value === null ? '' : String(value)))
    .join('');
  body.signature.checksum = crypto
    .createHash('sha256')
    .update(`${propertiesConcat}${body.timestamp}${FIXTURE_WEBHOOK_SECRET}`)
    .digest('hex');
  return body;
}

async function invokeWebhook(body) {
  const req = { body, get: () => '' };
  const result = { statusCode: 200, body: null };
  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(payload) {
      result.body = payload;
      return this;
    },
  };

  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    await webhookHandler(req, res);
    await Promise.resolve();
    await Promise.resolve();
  } finally {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
  return result;
}

let passed = 0;
async function control(name, run) {
  await run();
  passed += 1;
  originalConsole.log(`OK  ${name}`);
}

(async () => {
  const canonicalChecksum = 'ab'.repeat(32);
  assert.equal(secureChecksumEquals(canonicalChecksum, canonicalChecksum), true);
  assert.equal(secureChecksumEquals(canonicalChecksum.toUpperCase(), canonicalChecksum), true);
  assert.equal(secureChecksumEquals('ab', canonicalChecksum), false);
  assert.equal(secureChecksumEquals('z'.repeat(64), canonicalChecksum), false);
  assert.equal(secureChecksumEquals('', canonicalChecksum), false);
  originalConsole.log('OK  checksum Wompi usa comparación constante y rechaza formatos inválidos');

  resetState({}, 'success');
  const invalidSignatureEvent = signedEvent('APPROVED', {
    finalizedAt: FIRST_PAID_AT,
    transactionId: 'tx-invalid-signature',
  });
  invalidSignatureEvent.signature.checksum = '0'.repeat(64);
  const invalidSignatureResponse = await invokeWebhook(invalidSignatureEvent);
  assert.equal(invalidSignatureResponse.statusCode, 400);
  assert.equal(invalidSignatureResponse.body.error, 'INVALID_WOMPI_CHECKSUM');
  assert.equal(state.order.payment.status, 'pending_gateway');
  assert.equal(state.confirmationCalls, 0);
  assert.equal(state.invoiceSchedulingCount, 0);
  originalConsole.log('OK  firma Wompi vigente bloquea eventos alterados');

  await control('1/7 estados no aprobados no crean ni modifican paidAt', async () => {
    for (const status of ['PENDING', 'DECLINED', 'ERROR', 'VOIDED']) {
      resetState({
        payment: { status: 'pending_gateway', paidAt: null },
        inventoryControl: { reservationRequired: false },
      });
      const response = await invokeWebhook(signedEvent(status));
      assert.equal(response.statusCode, 200, status);
      assert.equal(state.order.payment.paidAt, null, status);
    }
  });

  await control('2/7 la primera fecha aprobada permanece inmutable', async () => {
    resetState({
      status: 'paid',
      payment: { status: 'paid', paidAt: FIRST_PAID_AT },
      paymentProcessing: {
        provider: 'wompi',
        inventory: { status: 'not_required' },
        invoice: { status: 'scheduled' },
      },
      inventoryControl: { reservationRequired: false },
    });
    const response = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: LATER_PAID_AT,
        transactionId: 'tx-approved-later',
      })
    );
    assert.equal(response.statusCode, 200);
    assert.equal(new Date(state.order.payment.paidAt).toISOString(), FIRST_PAID_AT);
  });

  await control('3/7 una aprobacion no se degrada por eventos posteriores', async () => {
    for (const status of ['PENDING', 'DECLINED', 'ERROR', 'VOIDED']) {
      resetState({
        status: 'paid',
        payment: {
          status: 'paid',
          paidAt: FIRST_PAID_AT,
          transactionId: 'tx-approved-original',
        },
        paymentProcessing: {
          provider: 'wompi',
          inventory: { status: 'not_required' },
          invoice: { status: 'scheduled' },
        },
        inventoryControl: { reservationRequired: false },
      });
      const response = await invokeWebhook(signedEvent(status));
      assert.equal(response.statusCode, 200, status);
      assert.equal(response.body.ignored, true, status);
      assert.equal(state.order.status, 'paid', status);
      assert.equal(state.order.payment.status, 'paid', status);
      assert.equal(state.order.payment.paidAt, FIRST_PAID_AT, status);
    }
  });

  await control('4/7 el fallo de inventario no deja la orden facturable', async () => {
    resetState({}, 'fail');
    const response = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: FIRST_PAID_AT,
        transactionId: 'tx-inventory-failure',
      })
    );
    assert.equal(response.statusCode, 503);
    assert.equal(state.order.payment.status, 'paid');
    assert.equal(state.order.status, 'pending');
    assert.equal(state.order.paymentProcessing.inventory.status, 'failed');
    assert.equal(isBillableOrder(state.order), false);
  });

  await control('5/7 sin inventario confirmado no se programa factura', async () => {
    resetState({}, 'fail');
    const response = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: FIRST_PAID_AT,
        transactionId: 'tx-no-invoice-without-stock',
      })
    );
    assert.equal(response.statusCode, 503);
    assert.equal(state.inventoryConfirmed, false);
    assert.equal(state.invoiceSchedulingCount, 0);
    assert.equal(state.order.paymentProcessing.invoice.status, 'pending');
  });

  await control('6/7 un reintento completa inventario y facturacion pendientes', async () => {
    resetState({}, 'fail');
    const event = signedEvent('APPROVED', {
      finalizedAt: FIRST_PAID_AT,
      transactionId: 'tx-retryable',
    });
    const first = await invokeWebhook(event);
    const paidAtAfterFailure = state.order.payment.paidAt;
    state.confirmMode = 'success';
    const retry = await invokeWebhook(event);
    assert.equal(first.statusCode, 503);
    assert.equal(retry.statusCode, 200);
    assert.equal(state.order.payment.paidAt, paidAtAfterFailure);
    assert.equal(state.order.status, 'paid');
    assert.equal(state.order.paymentProcessing.inventory.status, 'confirmed');
    assert.equal(state.inventoryMutationCount, 1);
    assert.equal(state.kardexCount, 1);
    assert.equal(state.invoiceSchedulingCount, 1);
  });

  await control('7/7 APPROVED repetido no duplica efectos ni programacion', async () => {
    resetState({}, 'success');
    const event = signedEvent('APPROVED', {
      finalizedAt: FIRST_PAID_AT,
      transactionId: 'tx-approved-duplicate',
    });
    const first = await invokeWebhook(event);
    const duplicate = await invokeWebhook(event);
    assert.equal(first.statusCode, 200);
    assert.equal(duplicate.statusCode, 200);
    assert.equal(state.confirmationCalls, 1);
    assert.equal(state.inventoryMutationCount, 1);
    assert.equal(state.kardexCount, 1);
    assert.equal(state.invoiceSchedulingCount, 1);
    assert.equal(
      state.orderEvents.filter(
        (eventRecord) =>
          eventRecord.type === 'inventory_reservation_confirmed'
      ).length,
      1
    );
  });

  const invoiceFailureEvent = signedEvent('APPROVED', {
    finalizedAt: FIRST_PAID_AT,
    transactionId: 'tx-invoice-failure-retry',
  });

  await control('8/19 el fallo de factura ocurre despues de adquirir el reclamo', async () => {
    resetState({}, 'success', 'fail');
    const response = await invokeWebhook(invoiceFailureEvent);
    assert.equal(response.statusCode, 503);
    assert.equal(state.invoiceAttemptCount, 1);
    assert.ok(state.order.paymentProcessing.invoice.claimId);
  });

  await control('9/19 el fallo de factura no queda marcado como scheduled', async () => {
    assert.equal(state.order.payment.status, 'paid');
    assert.equal(state.order.paymentProcessing.inventory.status, 'confirmed');
    assert.equal(state.order.paymentProcessing.invoice.status, 'failed');
    assert.equal(
      state.order.paymentProcessing.invoice.errorCode,
      'SIMULATED_INVOICE_OPERATION_FAILURE'
    );
  });

  await control('10/19 el fallo de factura puede reclamarse y completarse', async () => {
    state.invoiceMode = 'success';
    const response = await invokeWebhook(invoiceFailureEvent);
    assert.equal(response.statusCode, 200);
    assert.equal(state.order.paymentProcessing.invoice.status, 'scheduled');
    assert.equal(state.invoiceAttemptCount, 2);
    assert.equal(state.invoiceSchedulingCount, 1);
  });

  await control('11/19 un reclamo scheduling vencido se recupera', async () => {
    resetState(
      {
        status: 'paid',
        payment: { status: 'paid', paidAt: FIRST_PAID_AT },
        paymentProcessing: {
          provider: 'wompi',
          inventory: { status: 'not_required' },
          invoice: {
            status: 'scheduling',
            claimId: 'stale-claim',
            claimedAt: new Date(Date.now() - 11 * 60 * 1000),
          },
        },
        inventoryControl: { reservationRequired: false },
      },
      'success',
      'success'
    );
    const response = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: LATER_PAID_AT,
        transactionId: 'tx-stale-claim-recovery',
      })
    );
    assert.equal(response.statusCode, 200);
    assert.equal(state.order.paymentProcessing.invoice.status, 'scheduled');
    assert.notEqual(state.order.paymentProcessing.invoice.claimId, 'stale-claim');
    assert.equal(state.invoiceSchedulingCount, 1);
  });

  await control('12/19 una omision legitima se distingue de fallo y omision temporal', async () => {
    resetState(
      { inventoryControl: { reservationRequired: false } },
      'success',
      'skip-terminal'
    );
    const terminalResponse = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: FIRST_PAID_AT,
        transactionId: 'tx-terminal-skip',
      })
    );
    assert.equal(terminalResponse.statusCode, 200);
    assert.equal(state.order.paymentProcessing.invoice.status, 'not_required');
    assert.equal(
      state.order.paymentProcessing.invoice.outcomeCode,
      'ELECTRONIC_BILLING_INACTIVE'
    );
    assert.equal(state.order.paymentProcessing.invoice.errorCode, '');

    resetState(
      { inventoryControl: { reservationRequired: false } },
      'success',
      'skip-retryable'
    );
    const temporaryResponse = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: FIRST_PAID_AT,
        transactionId: 'tx-temporary-skip',
      })
    );
    assert.equal(temporaryResponse.statusCode, 503);
    assert.equal(state.order.paymentProcessing.invoice.status, 'pending');
    assert.equal(state.order.paymentProcessing.invoice.errorCode, '');
  });

  await control('13/19 orden historica pagada sin inventario gestionado sigue lista', async () => {
    resetState({
      status: 'paid',
      payment: { status: 'paid', paidAt: FIRST_PAID_AT },
      paymentProcessing: undefined,
      inventoryControl: {
        reservationRequired: true,
        reservationId: null,
        discountedAtCheckout: true,
      },
      inventoryAllocations: [],
      inventoryAllocationSummary: {
        totalQuantity: 0,
        soldQuantity: 0,
        activeReservedQuantity: 0,
      },
    });
    const response = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: LATER_PAID_AT,
        transactionId: 'tx-historical-unmanaged',
      })
    );
    assert.equal(response.statusCode, 200);
    assert.equal(state.order.status, 'paid');
    assert.equal(state.order.paymentProcessing.inventory.status, 'not_required');
    assert.equal(state.confirmationCalls, 0);
  });

  await control('14/19 orden historica con reservationId recupera asignaciones', async () => {
    resetState({
      status: 'paid',
      payment: { status: 'paid', paidAt: FIRST_PAID_AT },
      paymentProcessing: undefined,
      inventoryControl: {
        reservationRequired: true,
        reservationId: 'reservation-fixture-1',
        discountedAtCheckout: true,
      },
      inventoryAllocations: [],
      inventoryAllocationSummary: {
        totalQuantity: 0,
        soldQuantity: 0,
        activeReservedQuantity: 0,
      },
    });
    const response = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: LATER_PAID_AT,
        transactionId: 'tx-historical-reservation',
      })
    );
    assert.equal(response.statusCode, 200);
    assert.equal(state.order.paymentProcessing.inventory.status, 'confirmed');
    assert.equal(state.confirmationCalls, 1);
    assert.equal(state.inventoryMutationCount, 1);
  });

  await control('15/19 dos APPROVED se solapan y producen un solo efecto', async () => {
    resetState({ inventoryControl: { reservationRequired: false } });
    state.transactionBarrier = createBarrier(2);
    const [first, second] = await Promise.all([
      invokeWebhook(
        signedEvent('APPROVED', {
          finalizedAt: FIRST_PAID_AT,
          transactionId: 'tx-concurrent-approved-first',
        })
      ),
      invokeWebhook(
        signedEvent('APPROVED', {
          finalizedAt: LATER_PAID_AT,
          transactionId: 'tx-concurrent-approved-second',
        })
      ),
    ]);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(state.transactionBarrier.arrivals >= 2, true);
    assert.equal(state.invoiceSchedulingCount, 1);
    assert.equal(new Date(state.order.payment.paidAt).toISOString(), FIRST_PAID_AT);
  });

  await control('16/19 APPROVED y DECLINED solapados conservan la aprobacion', async () => {
    resetState({ inventoryControl: { reservationRequired: false } });
    state.transactionBarrier = createBarrier(2);
    const [approved, declined] = await Promise.all([
      invokeWebhook(
        signedEvent('APPROVED', {
          finalizedAt: FIRST_PAID_AT,
          transactionId: 'tx-approved-race',
        })
      ),
      invokeWebhook(
        signedEvent('DECLINED', {
          transactionId: 'tx-declined-race',
        })
      ),
    ]);
    assert.equal(approved.statusCode, 200);
    assert.equal(declined.statusCode, 200);
    assert.equal(state.transactionBarrier.arrivals >= 2, true);
    assert.equal(state.order.status, 'paid');
    assert.equal(state.order.payment.status, 'paid');
    assert.equal(new Date(state.order.payment.paidAt).toISOString(), FIRST_PAID_AT);
  });

  await control('17/19 dos reintentos de inventario se solapan sin duplicar kardex', async () => {
    resetState({}, 'fail');
    const event = signedEvent('APPROVED', {
      finalizedAt: FIRST_PAID_AT,
      transactionId: 'tx-concurrent-inventory-retry',
    });
    const failed = await invokeWebhook(event);
    assert.equal(failed.statusCode, 503);
    state.confirmMode = 'success';
    state.transactionBarrier = createBarrier(2);
    state.inventoryBarrier = createBarrier(2);
    const retries = await Promise.all([invokeWebhook(event), invokeWebhook(event)]);
    assert.deepEqual(retries.map((entry) => entry.statusCode), [200, 200]);
    assert.equal(state.inventoryBarrier.arrivals, 2);
    assert.equal(state.inventoryMutationCount, 1);
    assert.equal(state.kardexCount, 1);
    assert.equal(state.invoiceSchedulingCount, 1);
  });

  await control('18/19 dos reclamos de factura se solapan y solo uno gana', async () => {
    resetState({
      status: 'paid',
      payment: { status: 'paid', paidAt: FIRST_PAID_AT },
      paymentProcessing: {
        provider: 'wompi',
        inventory: { status: 'not_required' },
        invoice: { status: 'pending' },
      },
      inventoryControl: { reservationRequired: false },
    });
    state.transactionBarrier = createBarrier(2);
    state.invoiceClaimBarrier = createBarrier(2);
    const event = signedEvent('APPROVED', {
      finalizedAt: FIRST_PAID_AT,
      transactionId: 'tx-concurrent-invoice-claim',
    });
    const responses = await Promise.all([invokeWebhook(event), invokeWebhook(event)]);
    assert.deepEqual(responses.map((entry) => entry.statusCode), [200, 200]);
    assert.equal(state.invoiceClaimBarrier.arrivals, 2);
    assert.equal(state.invoiceAttemptCount, 1);
    assert.equal(state.invoiceSchedulingCount, 1);
    assert.equal(state.order.paymentProcessing.invoice.status, 'scheduled');
  });

  await control('19/19 el primer paidAt se conserva bajo concurrencia', async () => {
    resetState({ inventoryControl: { reservationRequired: false } });
    state.transactionBarrier = createBarrier(2);
    const responses = await Promise.all([
      invokeWebhook(
        signedEvent('APPROVED', {
          finalizedAt: FIRST_PAID_AT,
          transactionId: 'tx-paid-at-first',
        })
      ),
      invokeWebhook(
        signedEvent('APPROVED', {
          finalizedAt: LATER_PAID_AT,
          transactionId: 'tx-paid-at-later',
        })
      ),
    ]);
    assert.deepEqual(responses.map((entry) => entry.statusCode), [200, 200]);
    assert.equal(state.transactionBarrier.arrivals, 2);
    assert.equal(new Date(state.order.payment.paidAt).toISOString(), FIRST_PAID_AT);
  });

  await control('20/23 una primera aprobacion con reserva requerida ausente no se clasifica como historica', async () => {
    const newlyApprovedSnapshot = makeOrder({
      payment: { status: 'paid', paidAt: FIRST_PAID_AT },
      paymentProcessing: undefined,
      inventoryControl: {
        reservationRequired: true,
        reservationId: null,
        discountedAtCheckout: false,
      },
      inventoryAllocations: [],
      inventoryAllocationSummary: {
        totalQuantity: 0,
        soldQuantity: 0,
        activeReservedQuantity: 0,
      },
    });
    assert.equal(
      resolveInitialInventoryStatus(newlyApprovedSnapshot, {
        wasApprovedBefore: false,
        hadPaymentProcessingBefore: false,
      }),
      'pending'
    );

    resetState(
      {
        inventoryControl: {
          reservationRequired: true,
          reservationId: null,
          discountedAtCheckout: false,
        },
        inventoryAllocations: [],
        inventoryAllocationSummary: {
          totalQuantity: 0,
          soldQuantity: 0,
          activeReservedQuantity: 0,
        },
      },
      'fail'
    );
    const response = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: FIRST_PAID_AT,
        transactionId: 'tx-new-order-missing-reservation',
      })
    );
    assert.equal(response.statusCode, 503);
    assert.equal(state.order.payment.status, 'paid');
    assert.equal(new Date(state.order.payment.paidAt).toISOString(), FIRST_PAID_AT);
    assert.notEqual(state.order.paymentProcessing.inventory.status, 'not_required');
    assert.equal(state.order.paymentProcessing.inventory.status, 'failed');
    assert.equal(isInventoryReadyForBilling(state.order), false);
    assert.equal(state.order.paymentProcessing.invoice.status, 'pending');
    assert.equal(state.confirmationCalls, 1);
    assert.equal(state.invoiceAttemptCount, 0);
    assert.equal(state.invoiceSchedulingCount, 0);
  });

  await control('21/23 llamadas historicas sin wasApprovedBefore conservan el fallback compatible', async () => {
    const historicalOrder = makeOrder({
      status: 'paid',
      payment: { status: 'paid', paidAt: FIRST_PAID_AT },
      paymentProcessing: undefined,
      inventoryControl: {
        reservationRequired: true,
        reservationId: null,
        discountedAtCheckout: true,
      },
      inventoryAllocations: [],
      inventoryAllocationSummary: {
        totalQuantity: 0,
        soldQuantity: 0,
        activeReservedQuantity: 0,
      },
    });
    assert.equal(resolveInitialInventoryStatus(historicalOrder), 'not_required');
    assert.equal(isInventoryReadyForBilling(historicalOrder), true);
  });

  await control('22/23 una factura reutilizada inProgress permanece pendiente y reintentable', async () => {
    resetState(
      { inventoryControl: { reservationRequired: false } },
      'success',
      'in-progress'
    );
    const strictOutcome = await executeElectronicInvoiceAfterPayment({
      orderId: state.order._id,
      paymentProvider: 'wompi',
      allowRetry: true,
    });
    assert.equal(strictOutcome.outcome, 'pending');
    assert.equal(strictOutcome.performed, false);
    assert.equal(strictOutcome.terminal, false);
    assert.equal(strictOutcome.reasonCode, 'INVOICE_IN_PROGRESS');

    resetState(
      { inventoryControl: { reservationRequired: false } },
      'success',
      'in-progress'
    );
    const response = await invokeWebhook(
      signedEvent('APPROVED', {
        finalizedAt: FIRST_PAID_AT,
        transactionId: 'tx-invoice-still-processing',
      })
    );
    assert.equal(response.statusCode, 503);
    assert.equal(state.order.paymentProcessing.invoice.status, 'pending');
    assert.equal(state.order.paymentProcessing.invoice.scheduledAt, null);
    assert.equal(
      state.order.paymentProcessing.invoice.outcomeCode,
      'INVOICE_IN_PROGRESS'
    );
    assert.equal(state.invoiceSchedulingCount, 0);
  });

  await control('23/23 un procesamiento concurrente fallido se reclama y completa sin duplicar factura', async () => {
    resetState(
      { inventoryControl: { reservationRequired: false } },
      'success',
      'in-progress'
    );
    const event = signedEvent('APPROVED', {
      finalizedAt: FIRST_PAID_AT,
      transactionId: 'tx-concurrent-invoice-retry',
    });

    const inProgress = await invokeWebhook(event);
    assert.equal(inProgress.statusCode, 503);
    assert.equal(state.order.paymentProcessing.invoice.status, 'pending');
    assert.equal(state.order.paymentProcessing.invoice.scheduledAt, null);
    const pendingClaimId = state.order.paymentProcessing.invoice.claimId;

    state.invoiceMode = 'fail';
    const failed = await invokeWebhook(event);
    assert.equal(failed.statusCode, 503);
    assert.equal(state.order.paymentProcessing.invoice.status, 'failed');
    assert.equal(state.order.paymentProcessing.invoice.scheduledAt, null);
    const failedClaimId = state.order.paymentProcessing.invoice.claimId;
    assert.notEqual(failedClaimId, pendingClaimId);

    state.invoiceMode = 'success';
    const retried = await invokeWebhook(event);
    assert.equal(retried.statusCode, 200);
    assert.equal(state.order.paymentProcessing.invoice.status, 'scheduled');
    assert.ok(state.order.paymentProcessing.invoice.scheduledAt);
    assert.notEqual(state.order.paymentProcessing.invoice.claimId, failedClaimId);
    assert.equal(state.invoiceSchedulingCount, 1);

    const invoiceAttemptsAfterSuccess = state.invoiceAttemptCount;
    const duplicate = await invokeWebhook(event);
    assert.equal(duplicate.statusCode, 200);
    assert.equal(state.invoiceAttemptCount, invoiceAttemptsAfterSuccess);
    assert.equal(state.invoiceSchedulingCount, 1);
  });

  originalConsole.log(`WOMPI INVENTORY INTEGRITY: ${passed}/23 controles aprobados.`);
})().catch((error) => {
  originalConsole.error(`FAIL ${passed + 1}/23 ${error.stack || error.message}`);
  process.exitCode = 1;
});
