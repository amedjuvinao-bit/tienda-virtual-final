'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  createPayUCheckoutController,
} = require('../controllers/payu/payuCheckoutController');
const payUWebhookControllerModule = require('../controllers/payu/payuWebhookController');
const { createPayUWebhookController } = payUWebhookControllerModule;
const publicPaymentAccessService = require('../services/publicPaymentAccessService');
const configurationService = require('../services/payu/payuConfigurationService');
const paymentAmountService = require('../services/payu/payuPaymentAmountService');
const signatureService = require('../services/payu/payuSignatureService');
const {
  fingerprintPaymentMerchant,
} = require('../services/paymentAttemptService');
const {
  createPayUInventoryService,
} = require('../services/payu/payuInventoryService');
const {
  preparePayUWebhookRequest,
} = require('../services/payu/payuWebhookRequestService');
const {
  processPayUWebhookTransaction,
} = require('../services/payu/payuWebhookTransactionService');
const {
  buildPayUWebhookErrorResponse,
  finalizePayUWebhookResponse,
  sendPayUWebhookResponse,
} = require('../services/payu/payuWebhookResponseService');

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function buildPayments() {
  return {
    active: true,
    provider: 'payu',
    mode: 'sandbox',
    currency: 'COP',
    checkoutLabel: 'PayU Seguro',
    successMessage: 'Pago recibido',
    enableWebhook: true,
    credentials: {
      payu: {
        merchantId: 'merchant-900',
        accountId: 'account-901',
        apiKey: 'payu-api-key-secure',
        signatureSecret: '',
      },
    },
  };
}

function createCheckoutOrderModel(order, trace) {
  return {
    findById(orderId) {
      trace.orderLookups.push(String(orderId));
      return {
        lean() {
          return this;
        },
        async exec() {
          return String(orderId) === String(order._id) ? order : null;
        },
      };
    },
  };
}

async function validateCheckoutAccess() {
  const previousSecret = process.env.ORDER_PAYMENT_ACCESS_SECRET;
  const secret = 'payu-public-access-test-secret-32-characters-minimum';
  process.env.ORDER_PAYMENT_ACCESS_SECRET = secret;

  try {
    const order = {
      _id: '507f1f77bcf86cd799439011',
      orderNumber: '000900',
      sessionId: 'guest-session-payu-900',
      total: 125000,
      subtotal: 125000,
      storeCredit: { applied: true, amount: 25000, status: 'reserved' },
      payment: {
        amount: 100000,
        amountInCents: 10000000,
        currency: 'COP',
      },
      customer: {
        id: '1010123456',
        name: 'Cliente',
        lastname: 'PayU',
        email: 'cliente.payu@example.com',
      },
    };
    const trace = { orderLookups: [], configCalls: 0, attemptIssues: [] };
    const OrderModel = createCheckoutOrderModel(order, trace);
    const handler = createPayUCheckoutController({
      OrderModel,
      async getActivePaymentsConfig() {
        trace.configCalls += 1;
        return buildPayments();
      },
      publicPaymentAccessService,
      configurationService,
      paymentAttemptService: {
        async issueAttempt(payload) {
          trace.attemptIssues.push(payload);
          return {
            attempt: {
              reference: 'ORDER-000900__TRY__1700000000000',
            },
            reused: trace.attemptIssues.length > 1,
          };
        },
      },
      paymentAmountService,
      fingerprintPaymentMerchant,
      signatureService,
      logger: { error() {} },
    });
    const token = publicPaymentAccessService.createGuestOrderAccessToken({
      orderId: order._id,
      sessionId: order.sessionId,
      secret,
    });

    const allowedResponse = responseRecorder();
    await handler(
      {
        body: { orderId: order._id },
        headers: {
          'x-order-access-token': token,
          'x-session-id': order.sessionId,
        },
      },
      allowedResponse
    );

    assert.equal(allowedResponse.statusCode, 200);
    assert.equal(allowedResponse.body.ok, true);
    assert.equal(allowedResponse.body.order.id, order._id);
    assert.equal(allowedResponse.body.order.total, 125000);
    assert.equal(allowedResponse.body.order.paymentAmount, 100000);
    assert.equal(allowedResponse.body.payu.amount, 100000);
    assert.equal(allowedResponse.body.payu.currency, 'COP');
    const expectedSignature = signatureService.buildPayUPaymentSignature({
      apiKey: buildPayments().credentials.payu.apiKey,
      merchantId: buildPayments().credentials.payu.merchantId,
      referenceCode: allowedResponse.body.payu.referenceCode,
      amount: 100000,
      currency: 'COP',
    });
    assert.equal(allowedResponse.body.payu.signature, expectedSignature.signature);
    assert.equal(trace.attemptIssues.length, 1);
    assert.equal(trace.attemptIssues[0].amountInCents, 10000000);
    assert.equal(trace.attemptIssues[0].currency, 'COP');
    assert.equal(
      trace.attemptIssues[0].merchantFingerprint,
      fingerprintPaymentMerchant('payu', 'merchant-900:account-901')
    );
    assert.equal(trace.configCalls, 1);
    const publicPayload = JSON.stringify(allowedResponse.body);
    assert(!publicPayload.includes('payu-api-key-secure'));
    assert(!publicPayload.includes('signatureSecret'));
    assert(!publicPayload.includes('apiLogin'));

    const repeatedCheckoutResponse = responseRecorder();
    await handler(
      {
        body: { orderId: order._id },
        headers: {
          'x-order-access-token': token,
          'x-session-id': order.sessionId,
        },
      },
      repeatedCheckoutResponse
    );
    assert.equal(repeatedCheckoutResponse.statusCode, 200);
    assert.equal(
      repeatedCheckoutResponse.body.payu.referenceCode,
      allowedResponse.body.payu.referenceCode
    );
    assert.equal(trace.attemptIssues.length, 2);

    order.payment.status = 'paid';
    const terminalResponse = responseRecorder();
    await handler(
      {
        body: { orderId: order._id },
        headers: {
          'x-order-access-token': token,
          'x-session-id': order.sessionId,
        },
      },
      terminalResponse
    );
    assert.equal(terminalResponse.statusCode, 409);
    assert.deepEqual(terminalResponse.body, {
      ok: false,
      error: 'PAYMENT_CHECKOUT_NOT_AVAILABLE',
      message: 'Esta orden no admite un nuevo intento de pago.',
    });
    assert.equal(
      trace.configCalls,
      2,
      'Una orden terminal no debe volver a cargar credenciales PayU'
    );

    for (const terminalCase of [
      { paymentStatus: 'cancelled', orderStatus: 'pending' },
      { paymentStatus: 'pending_gateway', orderStatus: 'cancelled' },
      { paymentStatus: 'pending_gateway', orderStatus: 'refunded' },
    ]) {
      order.payment.status = terminalCase.paymentStatus;
      order.status = terminalCase.orderStatus;
      const response = responseRecorder();
      await handler(
        {
          body: { orderId: order._id },
          headers: {
            'x-order-access-token': token,
            'x-session-id': order.sessionId,
          },
        },
        response
      );
      assert.equal(response.statusCode, 409);
      assert.equal(response.body.error, 'PAYMENT_CHECKOUT_NOT_AVAILABLE');
    }
    assert.equal(trace.attemptIssues.length, 2);
    assert.equal(trace.configCalls, 2);

    const deniedResponse = responseRecorder();
    await handler(
      {
        body: { orderId: order._id },
        headers: {
          'x-order-access-token': `${token}alterado`,
          'x-session-id': order.sessionId,
        },
      },
      deniedResponse
    );

    assert.equal(deniedResponse.statusCode, 404);
    assert.deepEqual(
      deniedResponse.body,
      publicPaymentAccessService.SAFE_PAYMENT_ACCESS_ERROR
    );
    assert.equal(trace.configCalls, 2, 'Un acceso denegado no carga credenciales PayU');

    const enumerableResponse = responseRecorder();
    await handler(
      { body: { orderId: order._id }, headers: {} },
      enumerableResponse
    );
    assert.equal(enumerableResponse.statusCode, 404);
    assert.deepEqual(
      enumerableResponse.body,
      publicPaymentAccessService.SAFE_PAYMENT_ACCESS_ERROR
    );

    console.log(
      'OK 1: checkout PayU firma solo los $100.000 externos de una orden de $125.000 con $25.000 de saldo'
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.ORDER_PAYMENT_ACCESS_SECRET;
    } else {
      process.env.ORDER_PAYMENT_ACCESS_SECRET = previousSecret;
    }
  }
}

function createWebhookOrderModel(initialOrder, transactionalOrder, trace) {
  return {
    findOne() {
      trace.orderLookups += 1;
      const selected = trace.orderLookups === 1 ? initialOrder : transactionalOrder;
      return {
        session() {
          return Promise.resolve(selected);
        },
        then(resolve, reject) {
          return Promise.resolve(selected).then(resolve, reject);
        },
      };
    },
  };
}

function buildApprovedPayload(
  payments,
  {
    value = '100000.00',
    reference = 'ORDER-000901__TRY__1700000000000',
    transactionId = 'payu-transaction-000901',
    statePol = '4',
  } = {}
) {
  const payload = {
    merchant_id: payments.credentials.payu.merchantId,
    reference_sale: reference,
    value,
    currency: 'COP',
    state_pol: statePol,
    transaction_id: transactionId,
    payment_method_type: '2',
    payment_method_name: 'VISA',
    payment_method: '10',
    test: '1',
  };
  const normalizedValue = signatureService.formatPayUAmountForSignature(
    payload.value
  );
  const signatureBase = [
    payments.credentials.payu.apiKey,
    payload.merchant_id,
    payload.reference_sale,
    normalizedValue,
    payload.currency,
    payload.state_pol,
  ].join('~');
  payload.sign = crypto.createHash('md5').update(signatureBase).digest('hex');
  return payload;
}

async function validateWebhookOrchestration() {
  const payments = buildPayments();
  payments.provider = 'wompi';
  const initialOrder = {
    _id: '507f1f77bcf86cd799439012',
    orderNumber: '000901',
    total: 125000,
    storeCredit: { applied: true, amount: 25000, status: 'reserved' },
    status: 'pending',
    payment: {
      status: 'pending_gateway',
      currency: 'COP',
      amount: 100000,
      amountInCents: 10000000,
    },
  };
  const transactionalOrder = {
    ...initialOrder,
    payment: { ...initialOrder.payment },
    timeline: [],
    inventoryControl: {},
    async save() {
      trace.orderSaves += 1;
    },
  };
  const trace = {
    orderLookups: 0,
    orderSaves: 0,
    inventorySyncs: 0,
    events: [],
    postCommitCalls: [],
    attemptClaims: [],
    storeCreditConsumes: 0,
    sessionEnded: 0,
  };
  const handler = createPayUWebhookController({
    mongooseLib: {
      async startSession() {
        return {
          async withTransaction(work) {
            await work();
          },
          async endSession() {
            trace.sessionEnded += 1;
          },
        };
      },
    },
    OrderModel: createWebhookOrderModel(initialOrder, transactionalOrder, trace),
    OrderEventModel: {
      async create(events, options) {
        trace.events.push({ events, options });
      },
    },
    async getActivePaymentsConfig() {
      return payments;
    },
    getStoreCreditCheckoutService() {
      return {
        async consumeReservedStoreCreditForOrder(order, { session }) {
          trace.storeCreditConsumes += 1;
          assert(session);
          order.storeCredit.status = 'consumed';
          return {
            consumed: true,
            duplicate: false,
            usage: { amount: 25000, currency: 'COP' },
          };
        },
        async releaseReservedStoreCreditForOrder() {
          throw new Error('No debe liberar saldo en un APPROVED');
        },
      };
    },
    configurationService,
    paymentAttemptService: {
      async claimApprovedAttempt(payload, options) {
        trace.attemptClaims.push({ payload, options });
        return {
          allowed: true,
          duplicate: false,
          reconciliationRequired: false,
          code: 'PAYMENT_ATTEMPT_CLAIMED',
        };
      },
      async claimNonApprovedAttempt() {
        throw new Error('No debe reclamar estado no aprobado');
      },
    },
    paymentAmountService,
    fingerprintPaymentMerchant,
    signatureService,
    inventoryService: {
      async syncReservationAfterPayU(context) {
        trace.inventorySyncs += 1;
        assert.equal(context.mapped.paymentStatus, 'paid');
        assert(context.session);
      },
    },
    postCommitService: {
      async processPaidOrderEffects(context) {
        trace.postCommitCalls.push(context);
        return { processed: true, retryable: false };
      },
    },
    logger: { error() {} },
  });

  const response = responseRecorder();
  await handler(
    { body: buildApprovedPayload(payments), headers: {}, ip: '127.0.0.1' },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.received, true);
  assert.equal(response.body.paymentStatus, 'paid');
  assert.equal(transactionalOrder.status, 'paid');
  assert.equal(transactionalOrder.payment.transactionId, 'payu-transaction-000901');
  assert.equal(transactionalOrder.payment.amount, 100000);
  assert.equal(transactionalOrder.storeCredit.status, 'consumed');
  assert.equal(trace.inventorySyncs, 1);
  assert.equal(trace.storeCreditConsumes, 1);
  assert.equal(trace.orderSaves, 1);
  assert.equal(trace.events.length, 2);
  assert.equal(trace.postCommitCalls.length, 1);
  assert.equal(trace.attemptClaims.length, 1);
  assert.equal(trace.attemptClaims[0].payload.amountInCents, 10000000);
  assert.equal(trace.attemptClaims[0].payload.reference, 'ORDER-000901__TRY__1700000000000');
  assert(trace.attemptClaims[0].options.session);
  assert.equal(trace.postCommitCalls[0].paymentProvider, 'payu');
  assert.equal(transactionalOrder.paymentProcessing.provider, 'payu');
  assert.equal(
    transactionalOrder.paymentProcessing.approvedTransactionId,
    'payu-transaction-000901'
  );
  assert.equal(transactionalOrder.paymentProcessing.fulfillment.status, 'pending');
  assert.equal(transactionalOrder.paymentProcessing.invoice.status, 'pending');
  assert.equal(trace.sessionEnded, 1);

  console.log(
    'OK 2: webhook PayU pendiente acepta $100.000 aunque la tienda luego cambie su proveedor activo a Wompi'
  );
}

async function validateOrderTotalWebhookIsRejected() {
  const payments = buildPayments();
  const order = {
    _id: '507f1f77bcf86cd799439013',
    orderNumber: '000901',
    total: 125000,
    storeCredit: { applied: true, amount: 25000, status: 'reserved' },
    status: 'pending',
    payment: {
      status: 'pending_gateway',
      currency: 'COP',
      amount: 100000,
      amountInCents: 10000000,
      transactionId: '',
    },
    timeline: [],
    async save() {
      trace.saves += 1;
    },
  };
  const trace = { lookups: 0, sessions: 0, saves: 0, inventorySyncs: 0 };
  const handler = createPayUWebhookController({
    mongooseLib: {
      async startSession() {
        trace.sessions += 1;
        return {
          async withTransaction(work) {
            await work();
          },
          async endSession() {},
        };
      },
    },
    OrderModel: {
      findOne() {
        trace.lookups += 1;
        return {
          session() {
            return Promise.resolve(order);
          },
          then(resolve, reject) {
            return Promise.resolve(order).then(resolve, reject);
          },
        };
      },
    },
    OrderEventModel: { create() {} },
    async getActivePaymentsConfig() {
      return payments;
    },
    getStoreCreditCheckoutService() {
      throw new Error('No debe cargar saldo con importe incorrecto');
    },
    configurationService,
    paymentAttemptService: {
      async claimApprovedAttempt(payload) {
        assert.equal(payload.amountInCents, 12500000);
        payload.order.payment.reviewRequired = true;
        payload.order.payment.reviewCode = 'PAYMENT_ATTEMPT_VALUE_MISMATCH';
        return {
          allowed: false,
          duplicate: false,
          reconciliationRequired: true,
          code: 'PAYMENT_ATTEMPT_VALUE_MISMATCH',
        };
      },
      async claimNonApprovedAttempt() {
        throw new Error('No debe reclamar un estado no aprobado');
      },
    },
    paymentAmountService,
    fingerprintPaymentMerchant,
    signatureService,
    inventoryService: {
      async syncReservationAfterPayU() {
        trace.inventorySyncs += 1;
      },
    },
    generateElectronicInvoiceAfterPayment() {},
    logger: { error() {} },
  });
  const response = responseRecorder();

  await handler(
    {
      body: buildApprovedPayload(payments, { value: '125000.00' }),
      headers: {},
      ip: '127.0.0.1',
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ignored, true);
  assert.equal(response.body.reconciliationRequired, true);
  assert.equal(response.body.reason, 'PAYMENT_ATTEMPT_VALUE_MISMATCH');
  assert.equal(order.payment.transactionId, '');
  assert.equal(order.payment.reviewRequired, true);
  assert.equal(trace.lookups, 2);
  assert.equal(trace.sessions, 1);
  assert.equal(trace.saves, 1);
  assert.equal(trace.inventorySyncs, 0);
  console.log(
    'OK 3: webhook firmado por el total de $125.000 se rechaza y queda conciliable sin aplicar el pago'
  );
}

async function validateSecondApprovedChargeIsReconciled() {
  const payments = buildPayments();
  const order = {
    _id: '507f1f77bcf86cd799439014',
    orderNumber: '000901',
    total: 125000,
    status: 'pending',
    payment: {
      provider: 'payu',
      status: 'pending_gateway',
      currency: 'COP',
      amount: 100000,
      amountInCents: 10000000,
    },
    inventoryControl: {},
    timeline: [],
    async save() {
      trace.orderSaves += 1;
    },
  };
  const trace = {
    approvedTransactionId: '',
    claims: 0,
    inventorySyncs: 0,
    invoices: 0,
    orderSaves: 0,
  };
  const handler = createPayUWebhookController({
    mongooseLib: {
      async startSession() {
        return {
          async withTransaction(work) {
            await work();
          },
          async endSession() {},
        };
      },
    },
    OrderModel: {
      findOne() {
        return {
          session() {
            return Promise.resolve(order);
          },
          then(resolve, reject) {
            return Promise.resolve(order).then(resolve, reject);
          },
        };
      },
    },
    OrderEventModel: { async create() {} },
    async getActivePaymentsConfig() {
      return payments;
    },
    getStoreCreditCheckoutService() {
      return {
        async consumeReservedStoreCreditForOrder() {
          throw new Error('Esta orden no usa saldo');
        },
        async releaseReservedStoreCreditForOrder() {
          throw new Error('Esta orden no usa saldo');
        },
      };
    },
    configurationService,
    paymentAttemptService: {
      async claimApprovedAttempt(payload) {
        trace.claims += 1;
        if (!trace.approvedTransactionId) {
          trace.approvedTransactionId = payload.transactionId;
          return { allowed: true, duplicate: false };
        }
        if (trace.approvedTransactionId === payload.transactionId) {
          return {
            allowed: true,
            duplicate: true,
            code: 'PAYMENT_ATTEMPT_DUPLICATE',
          };
        }
        payload.order.payment.reviewRequired = true;
        payload.order.payment.reviewCode = 'PAYMENT_SECOND_CHARGE_DETECTED';
        payload.order.timeline.push({
          type: 'system',
          message: 'Segundo cobro enviado a conciliación.',
        });
        return {
          allowed: false,
          duplicate: false,
          reconciliationRequired: true,
          code: 'PAYMENT_SECOND_CHARGE_DETECTED',
        };
      },
      async claimNonApprovedAttempt() {
        throw new Error('No debe reclamar estado no aprobado');
      },
    },
    paymentAmountService,
    fingerprintPaymentMerchant,
    signatureService,
    inventoryService: {
      async syncReservationAfterPayU() {
        trace.inventorySyncs += 1;
      },
    },
    postCommitService: {
      async processPaidOrderEffects() {
        trace.invoices += 1;
        return { processed: true, retryable: false };
      },
    },
    logger: { error() {} },
  });

  const firstResponse = responseRecorder();
  await handler(
    { body: buildApprovedPayload(payments), headers: {}, ip: '127.0.0.1' },
    firstResponse
  );
  assert.equal(firstResponse.statusCode, 200);
  assert.equal(order.payment.transactionId, 'payu-transaction-000901');
  assert.equal(trace.inventorySyncs, 1);
  assert.equal(trace.invoices, 1);

  const secondResponse = responseRecorder();
  await handler(
    {
      body: buildApprovedPayload(payments, {
        transactionId: 'payu-transaction-second-000901',
      }),
      headers: {},
      ip: '127.0.0.1',
    },
    secondResponse
  );
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(secondResponse.body.reconciliationRequired, true);
  assert.equal(secondResponse.body.reason, 'PAYMENT_SECOND_CHARGE_DETECTED');
  assert.equal(order.payment.transactionId, 'payu-transaction-000901');
  assert.equal(order.payment.reviewRequired, true);
  assert.equal(trace.inventorySyncs, 1);
  assert.equal(trace.invoices, 1);

  const duplicateResponse = responseRecorder();
  await handler(
    { body: buildApprovedPayload(payments), headers: {}, ip: '127.0.0.1' },
    duplicateResponse
  );
  assert.equal(duplicateResponse.statusCode, 200);
  assert.equal(duplicateResponse.body.ignored, true);
  assert.equal(duplicateResponse.body.reason, 'PAYMENT_ATTEMPT_DUPLICATE');
  assert.equal(trace.inventorySyncs, 1);
  assert.equal(trace.invoices, 2);
  assert.equal(trace.claims, 3);

  console.log(
    'OK 4: dos APPROVED no sobrescriben la primera transacción; el segundo cobro se concilia y el replay redirige los efectos idempotentes'
  );
}

async function validateStaleFailedAttemptIsIgnored() {
  const payments = buildPayments();
  const order = {
    _id: '507f1f77bcf86cd799439015',
    orderNumber: '000901',
    total: 125000,
    status: 'pending',
    storeCredit: {
      applied: true,
      amount: 25000,
      status: 'reserved',
      usage: '507f1f77bcf86cd799439099',
    },
    payment: {
      provider: 'payu',
      status: 'pending_gateway',
      currency: 'COP',
      amount: 100000,
      amountInCents: 10000000,
      transactionId: '',
    },
    inventoryControl: {
      reservationRequired: true,
      reservationId: 'reservation-current-attempt',
      restockedOnFailure: false,
    },
    timeline: [],
    async save() {
      trace.orderSaves += 1;
    },
  };
  const trace = { claims: 0, inventorySyncs: 0, orderSaves: 0 };
  const handler = createPayUWebhookController({
    mongooseLib: {
      async startSession() {
        return {
          async withTransaction(work) {
            await work();
          },
          async endSession() {},
        };
      },
    },
    OrderModel: {
      findOne() {
        return {
          session() {
            return Promise.resolve(order);
          },
          then(resolve, reject) {
            return Promise.resolve(order).then(resolve, reject);
          },
        };
      },
    },
    OrderEventModel: { async create() {} },
    async getActivePaymentsConfig() {
      return payments;
    },
    getStoreCreditCheckoutService() {
      throw new Error('Un intento obsoleto no debe tocar el saldo');
    },
    configurationService,
    paymentAttemptService: {
      async claimApprovedAttempt() {
        throw new Error('No es una aprobación');
      },
      async claimNonApprovedAttempt(payload, { session }) {
        trace.claims += 1;
        assert(session);
        assert.equal(payload.paymentStatus, 'failed');
        return {
          allowed: false,
          ignored: true,
          reason: 'PAYMENT_ATTEMPT_NOT_ACTIVE',
        };
      },
    },
    paymentAmountService,
    fingerprintPaymentMerchant,
    signatureService,
    inventoryService: {
      async syncReservationAfterPayU() {
        trace.inventorySyncs += 1;
      },
    },
    generateElectronicInvoiceAfterPayment() {},
    logger: { error() {} },
  });
  const response = responseRecorder();

  await handler(
    {
      body: buildApprovedPayload(payments, {
        reference: 'ORDER-000901__TRY__obsolete',
        transactionId: 'payu-failed-obsolete-000901',
        statePol: '6',
      }),
      headers: {},
      ip: '127.0.0.1',
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ignored, true);
  assert.equal(response.body.reason, 'PAYMENT_ATTEMPT_NOT_ACTIVE');
  assert.equal(order.payment.status, 'pending_gateway');
  assert.equal(order.storeCredit.status, 'reserved');
  assert.equal(order.inventoryControl.restockedOnFailure, false);
  assert.equal(trace.claims, 1);
  assert.equal(trace.inventorySyncs, 0);
  assert.equal(trace.orderSaves, 0);

  console.log(
    'OK 5: FAILED de un intento obsoleto no libera el saldo ni el inventario del intento vigente'
  );
}

async function validateRejectedWebhookStopsBeforePersistence() {
  const payments = buildPayments();
  const trace = { lookups: 0, sessions: 0 };
  const handler = createPayUWebhookController({
    mongooseLib: {
      async startSession() {
        trace.sessions += 1;
        throw new Error('No debe abrir sesión');
      },
    },
    OrderModel: {
      findOne() {
        trace.lookups += 1;
        throw new Error('No debe consultar la orden');
      },
    },
    OrderEventModel: { create() {} },
    async getActivePaymentsConfig() {
      return payments;
    },
    getStoreCreditCheckoutService() {
      throw new Error('No debe cargar saldo con firma incorrecta');
    },
    configurationService,
    paymentAttemptService: {
      async claimApprovedAttempt() {
        throw new Error('No debe reclamar un intento con firma incorrecta');
      },
      async claimNonApprovedAttempt() {
        throw new Error('No debe reclamar un estado no aprobado');
      },
    },
    paymentAmountService,
    fingerprintPaymentMerchant,
    signatureService,
    inventoryService: { async syncReservationAfterPayU() {} },
    generateElectronicInvoiceAfterPayment() {},
    logger: { error() {} },
  });
  const payload = buildApprovedPayload(payments);
  payload.sign = 'firma-invalida';
  const response = responseRecorder();

  await handler({ body: payload, headers: {}, ip: '127.0.0.1' }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'INVALID_PAYU_SIGNATURE');
  assert.equal(trace.lookups, 0);
  assert.equal(trace.sessions, 0);
  console.log(
    'OK 6: firma PayU inválida se rechaza antes de consultar orden o abrir transacción'
  );
}

async function validateInventoryAdapter() {
  const trace = { confirmed: [], released: [], reconciled: [], applied: [] };
  const inventoryService = createPayUInventoryService({
    mongooseLib: { Types: { ObjectId: { isValid: () => true } } },
    ProductModel: {},
    async confirmReservation(identifier, metadata, options) {
      trace.confirmed.push({ identifier, metadata, options });
      return { _id: identifier, status: 'confirmed' };
    },
    async releaseReservation(identifier, metadata, options) {
      trace.released.push({ identifier, metadata, options });
      return {
        _id: identifier,
        status: metadata.status,
        releaseReason: metadata.releaseReason,
      };
    },
    async reconcileReservation(identifier, metadata, options) {
      trace.reconciled.push({ identifier, metadata, options });
      return { _id: identifier, status: 'pending' };
    },
    applyReservation(order, reservation) {
      trace.applied.push({ order, reservation });
    },
  });
  const paidOrder = {
    _id: 'order-payu-paid',
    orderNumber: '000902',
    payment: { provider: 'payu', status: 'paid' },
    inventoryControl: {
      reservationRequired: true,
      reservationId: 'reservation-paid',
    },
  };
  const paidSession = { id: 'session-paid' };

  await inventoryService.syncReservationAfterPayU({
    order: paidOrder,
    mapped: { paymentStatus: 'paid' },
    reference: 'ORDER-000902__TRY__1',
    transactionId: 'payu-tx-paid-000902',
    session: paidSession,
  });

  assert.equal(trace.confirmed.length, 1);
  assert.equal(trace.confirmed[0].identifier, 'reservation-paid');
  assert.equal(trace.confirmed[0].options.session, paidSession);
  assert.equal(trace.confirmed[0].options.syncOrderAllocations, false);
  assert.equal(paidOrder.inventoryControl.discountedAtCheckout, true);
  assert.equal(paidOrder.inventoryControl.restockedOnFailure, false);

  await inventoryService.syncReservationAfterPayU({
    order: paidOrder,
    mapped: { paymentStatus: 'paid' },
    reference: 'ORDER-000902__TRY__1',
    transactionId: 'payu-tx-paid-000902',
    session: paidSession,
  });
  assert.equal(
    trace.confirmed.length,
    1,
    'Repetir la misma aprobación no confirma dos veces la reserva'
  );

  const failedOrder = {
    _id: 'order-payu-failed',
    orderNumber: '000903',
    payment: { provider: 'payu', status: 'failed' },
    inventoryControl: {
      reservationRequired: true,
      reservationId: 'reservation-failed',
      discountedAtCheckout: false,
      restockedOnFailure: false,
    },
  };
  const failedSession = { id: 'session-failed' };

  await inventoryService.syncReservationAfterPayU({
    order: failedOrder,
    mapped: { paymentStatus: 'failed' },
    reference: 'ORDER-000903__TRY__1',
    transactionId: 'payu-tx-lifecycle-000903',
    session: failedSession,
  });

  assert.equal(trace.released.length, 1);
  assert.equal(trace.released[0].identifier, 'reservation-failed');
  assert.equal(trace.released[0].options.session, failedSession);
  assert.equal(trace.released[0].options.syncOrderAllocations, false);
  assert.equal(failedOrder.inventoryControl.discountedAtCheckout, false);
  assert.equal(failedOrder.inventoryControl.restockedOnFailure, true);

  const approvedSession = { id: 'session-approved-late' };
  failedOrder.payment.status = 'paid';
  failedOrder.payment.reference = 'ORDER-000903__TRY__1';
  failedOrder.payment.transactionId = 'payu-tx-lifecycle-000903';

  await inventoryService.syncReservationAfterPayU({
    order: failedOrder,
    mapped: { paymentStatus: 'paid' },
    reference: failedOrder.payment.reference,
    transactionId: failedOrder.payment.transactionId,
    session: approvedSession,
  });

  assert.equal(trace.reconciled.length, 1);
  assert.equal(trace.reconciled[0].identifier, 'reservation-failed');
  assert.equal(trace.reconciled[0].metadata.provider, 'payu');
  assert.equal(trace.reconciled[0].options.session, approvedSession);
  assert.equal(trace.confirmed.length, 2);
  assert.equal(trace.confirmed[1].identifier, 'reservation-failed');
  assert.equal(trace.confirmed[1].options.session, approvedSession);
  assert.equal(failedOrder.inventoryControl.discountedAtCheckout, true);
  assert.equal(failedOrder.inventoryControl.restockedOnFailure, false);

  await inventoryService.syncReservationAfterPayU({
    order: failedOrder,
    mapped: { paymentStatus: 'paid' },
    reference: failedOrder.payment.reference,
    transactionId: failedOrder.payment.transactionId,
    session: approvedSession,
  });
  assert.equal(trace.reconciled.length, 1);
  assert.equal(trace.confirmed.length, 2);
  assert.equal(trace.applied.length, 3);

  console.log(
    'OK 7: FAILED→APPROVED reconcilia y confirma la reserva liberada en la misma sesión; el reintento es idempotente'
  );
}

function validatePayUIpSpoofProtection() {
  const env = { PAYU_IP_ALLOWLIST_ENABLED: 'true' };
  const spoofed = configurationService.validatePayUIpIfEnabled(
    {
      ip: '203.0.113.40',
      ips: ['203.0.113.40'],
      headers: { 'x-forwarded-for': '34.233.144.154, 203.0.113.40' },
    },
    'production',
    env
  );
  assert.equal(spoofed.ok, false);
  assert.deepEqual(spoofed.ips, ['203.0.113.40']);

  const trustedExpressIp = configurationService.validatePayUIpIfEnabled(
    {
      ip: '34.233.144.154',
      ips: ['34.233.144.154'],
      headers: { 'x-forwarded-for': '203.0.113.40' },
    },
    'production',
    env
  );
  assert.equal(trustedExpressIp.ok, true);
  assert.equal(trustedExpressIp.ip, '34.233.144.154');

  console.log(
    'OK 8: allowlist PayU usa IP normalizada por Express e ignora X-Forwarded-For falsificado'
  );
}

async function validateWebhookModuleComposition() {
  assert.deepEqual(Object.keys(payUWebhookControllerModule), [
    'createPayUWebhookController',
  ]);
  assert.equal(typeof preparePayUWebhookRequest, 'function');
  assert.equal(typeof processPayUWebhookTransaction, 'function');
  assert.equal(typeof finalizePayUWebhookResponse, 'function');
  assert.equal(typeof buildPayUWebhookErrorResponse, 'function');
  assert.equal(typeof sendPayUWebhookResponse, 'function');

  const controllerPath = path.resolve(
    __dirname,
    '../controllers/payu/payuWebhookController.js'
  );
  const controllerSource = fs.readFileSync(controllerPath, 'utf8');
  const controllerLines = controllerSource.split(/\r?\n/).length;

  assert.ok(
    controllerLines <= 200,
    `El controlador PayU tiene ${controllerLines} líneas; debe permanecer como orquestador`
  );
  assert.match(controllerSource, /payuWebhookRequestService/);
  assert.match(controllerSource, /payuWebhookTransactionService/);
  assert.match(controllerSource, /payuWebhookResponseService/);
  assert.doesNotMatch(controllerSource, /\.withTransaction\s*\(/);
  assert.doesNotMatch(controllerSource, /freshOrder\.payment/);
  assert.doesNotMatch(controllerSource, /postCommitRetryRequired/);

  const postCommitCalls = [];
  const responsePayload = { ok: true, received: true };
  const finalized = await finalizePayUWebhookResponse({
    transactionResult: {
      responsePayload,
      shouldProcessPostCommit: true,
      postCommitOrderId: 'order-payu-postcommit',
      postCommitTransaction: { id: 'payu-transaction' },
      postCommitPayments: { provider: 'payu' },
    },
    async processPostCommitEffects(payload) {
      postCommitCalls.push(payload);
      return { retryable: true };
    },
  });
  assert.deepEqual(postCommitCalls, [
    {
      orderId: 'order-payu-postcommit',
      transaction: { id: 'payu-transaction' },
      payments: { provider: 'payu' },
      paymentProvider: 'payu',
    },
  ]);
  assert.deepEqual(finalized, {
    status: 503,
    body: {
      ok: true,
      received: true,
      postCommitRetryRequired: true,
    },
  });
  assert.deepEqual(
    buildPayUWebhookErrorResponse({
      retryable: true,
      code: 'PAYU_INVENTORY_RETRY_REQUIRED',
      message: 'Reintentar',
    }),
    {
      status: 503,
      body: {
        ok: false,
        error: 'PAYU_INVENTORY_RETRY_REQUIRED',
        message: 'Reintentar',
      },
    }
  );

  console.log(
    'OK 9: webhook PayU conserva paridad de contratos y delega seguridad, transacción financiera y respuesta'
  );
}

async function main() {
  await validateCheckoutAccess();
  await validateWebhookOrchestration();
  await validateOrderTotalWebhookIsRejected();
  await validateSecondApprovedChargeIsReconciled();
  await validateStaleFailedAttemptIsIgnored();
  await validateRejectedWebhookStopsBeforePersistence();
  await validateInventoryAdapter();
  validatePayUIpSpoofProtection();
  await validateWebhookModuleComposition();
  console.log('RESULTADO: 9/9 controles PayU aprobados; sin MongoDB ni proveedor real.');
}

main().catch((error) => {
  console.error('FAIL', error);
  process.exitCode = 1;
});
