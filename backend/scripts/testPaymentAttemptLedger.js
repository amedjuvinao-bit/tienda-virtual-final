'use strict';

const assert = require('assert/strict');
const PaymentAttempt = require('../models/PaymentAttempt');
const {
  buildStoreCreditAttemptSnapshot,
  createPaymentAttemptService,
  evaluateApprovedPaymentAttempt,
  fingerprintPaymentMerchant,
  isOrderClosedForCheckout,
  sameAttemptComposition,
} = require('../services/paymentAttemptService');
const {
  createWompiWebhookIntegrityService,
} = require('../services/wompiWebhookIntegrityService');

const ORDER_ID = '66f000000000000000000001';
const USAGE_ID = '66f000000000000000000002';
const PROVIDER = 'wompi';
const REFERENCE = 'ORDER-000777__TRY__ledger-a';
const MERCHANT_FINGERPRINT = fingerprintPaymentMerchant(
  PROVIDER,
  'pub_test_merchant'
);

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`OK  ${message}`);
}

function makeOrder(overrides = {}) {
  const order = {
    _id: ORDER_ID,
    orderNumber: '000777',
    status: 'pending',
    total: 100000,
    payment: {
      provider: PROVIDER,
      currency: 'COP',
      status: 'pending_gateway',
      amount: 40000,
      transactionId: '',
      ...(overrides.payment || {}),
    },
    storeCredit: {
      applied: true,
      usage: USAGE_ID,
      amount: 60000,
      status: 'reserved',
      ...(overrides.storeCredit || {}),
    },
    timeline: [],
    async save() {
      return this;
    },
    ...overrides,
  };
  order.payment = {
    provider: PROVIDER,
    currency: 'COP',
    status: 'pending_gateway',
    amount: 40000,
    transactionId: '',
    ...(overrides.payment || {}),
  };
  order.storeCredit = {
    applied: true,
    usage: USAGE_ID,
    amount: 60000,
    status: 'reserved',
    ...(overrides.storeCredit || {}),
  };
  return order;
}

function makeAttempt(overrides = {}) {
  return {
    _id: `attempt-${Math.random()}`,
    provider: PROVIDER,
    order: ORDER_ID,
    orderNumber: '000777',
    reference: REFERENCE,
    merchantFingerprint: MERCHANT_FINGERPRINT,
    amountInCents: 4000000,
    currency: 'COP',
    state: 'issued',
    active: true,
    issuedBySystem: true,
    transactionId: '',
    storeCredit: {
      applied: true,
      usage: USAGE_ID,
      amountInCents: 6000000,
      statusAtIssue: 'reserved',
    },
    reconciliation: {},
    async save() {
      return this;
    },
    ...overrides,
  };
}

function approval(overrides = {}) {
  return {
    order: makeOrder(),
    attempt: makeAttempt(),
    usage: { _id: USAGE_ID, status: 'reserved' },
    provider: PROVIDER,
    reference: REFERENCE,
    transactionId: 'wompi-tx-primary',
    amountInCents: 4000000,
    currency: 'COP',
    merchantFingerprint: MERCHANT_FINGERPRINT,
    ...overrides,
  };
}

function query(value) {
  return {
    session() {
      return this;
    },
    exec: async () => value,
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

async function run() {
  const indexes = PaymentAttempt.schema.indexes();
  assert.equal(indexes.length, 4);
  assert(
    indexes.some(
      ([keys, options]) =>
        keys.provider === 1 &&
        keys.reference === 1 &&
        options.unique === true
    )
  );
  assert(
    indexes.some(
      ([keys, options]) =>
        keys.order === 1 &&
        keys.active === 1 &&
        Object.keys(keys).length === 2 &&
        options.unique === true &&
        options.partialFilterExpression?.active === true
    )
  );
  assert.equal(PaymentAttempt.schema.path('order').options.index, undefined);
  ok('el ledger tiene referencia única, un intento activo e índices sin duplicar');

  assert.equal(evaluateApprovedPaymentAttempt(approval()).allowed, true);
  ok('el intento activo exacto puede reclamar la aprobación');

  const released = evaluateApprovedPaymentAttempt(
    approval({ usage: { _id: USAGE_ID, status: 'released' } })
  );
  assert.equal(released.allowed, false);
  assert.equal(released.code, 'STORE_CREDIT_RELEASED_BEFORE_APPROVAL');
  ok('un webhook tardío no consume saldo que ya fue liberado');

  const spentElsewhere = evaluateApprovedPaymentAttempt(
    approval({ usage: { _id: USAGE_ID, status: 'released', reusedBy: 'other' } })
  );
  assert.equal(spentElsewhere.allowed, false);
  assert.equal(spentElsewhere.reconciliationRequired, true);
  ok('el doble gasto del saldo queda bloqueado para conciliación');

  const superseded = evaluateApprovedPaymentAttempt(
    approval({ attempt: makeAttempt({ state: 'superseded', active: false }) })
  );
  assert.equal(superseded.allowed, false);
  assert.equal(superseded.code, 'PAYMENT_ATTEMPT_SUPERSEDED');
  ok('una segunda ventana no puede aprobar el intento que fue supersedido');

  const unknown = evaluateApprovedPaymentAttempt(
    approval({ attempt: null, usage: null })
  );
  assert.equal(unknown.allowed, false);
  assert.equal(unknown.code, 'PAYMENT_ATTEMPT_UNKNOWN');
  ok('una referencia desconocida nunca cierra la orden');

  const wrongAmount = evaluateApprovedPaymentAttempt(
    approval({ amountInCents: 10000000 })
  );
  assert.equal(wrongAmount.allowed, false);
  assert.equal(wrongAmount.code, 'PAYMENT_ATTEMPT_VALUE_MISMATCH');
  ok('cada referencia acepta solamente su monto y moneda persistidos');

  const missingMerchant = evaluateApprovedPaymentAttempt(
    approval({ merchantFingerprint: '' })
  );
  assert.equal(missingMerchant.allowed, false);
  assert.equal(missingMerchant.code, 'PAYMENT_ATTEMPT_MERCHANT_MISMATCH');
  ok('un webhook sin identidad de comercio no puede reclamar el intento');

  const missingCurrency = evaluateApprovedPaymentAttempt(
    approval({ currency: '' })
  );
  assert.equal(missingCurrency.allowed, false);
  assert.equal(missingCurrency.code, 'PAYMENT_ATTEMPT_CURRENCY_MISSING');
  ok('una aprobación sin moneda explícita no puede reclamar el intento');

  const paidOrder = makeOrder({
    status: 'paid',
    payment: {
      status: 'paid',
      transactionId: 'wompi-tx-primary',
      paidAt: new Date(),
    },
  });
  const approvedAttempt = makeAttempt({
    state: 'approved',
    active: false,
    transactionId: 'wompi-tx-primary',
  });
  const duplicate = evaluateApprovedPaymentAttempt(
    approval({ order: paidOrder, attempt: approvedAttempt })
  );
  assert.equal(duplicate.allowed, true);
  assert.equal(duplicate.duplicate, true);
  ok('el mismo transactionId es idempotente');

  const secondCharge = evaluateApprovedPaymentAttempt(
    approval({
      order: paidOrder,
      attempt: approvedAttempt,
      transactionId: 'wompi-tx-second-charge',
    })
  );
  assert.equal(secondCharge.allowed, false);
  assert.equal(secondCharge.code, 'PAYMENT_SECOND_CHARGE_DETECTED');
  ok('un transactionId diferente después del pago se detecta como segundo cobro');

  const fullAfterReleaseOrder = makeOrder({
    payment: { amount: 100000 },
    storeCredit: { status: 'released' },
  });
  const fullAfterReleaseAttempt = makeAttempt({
    reference: 'ORDER-000777__TRY__ledger-full',
    amountInCents: 10000000,
    storeCredit: {
      applied: false,
      usage: null,
      amountInCents: 0,
      statusAtIssue: 'released',
    },
  });
  const fullAfterRelease = evaluateApprovedPaymentAttempt({
    ...approval(),
    order: fullAfterReleaseOrder,
    attempt: fullAfterReleaseAttempt,
    reference: fullAfterReleaseAttempt.reference,
    amountInCents: 10000000,
    usage: null,
  });
  assert.equal(fullAfterRelease.allowed, true);
  ok('un nuevo intento por el total tras liberar saldo sí es inequívoco');

  const failedWithoutCreditOrder = makeOrder({
    payment: { amount: 100000, status: 'failed' },
    storeCredit: { applied: false, usage: null, amount: 0, status: 'none' },
  });
  const failedWithoutCreditAttempt = makeAttempt({
    amountInCents: 10000000,
    state: 'declined',
    active: false,
    transactionId: 'wompi-tx-recovered',
    storeCredit: {
      applied: false,
      usage: null,
      amountInCents: 0,
      statusAtIssue: 'none',
    },
  });
  const recoveredWithoutCredit = evaluateApprovedPaymentAttempt({
    ...approval(),
    order: failedWithoutCreditOrder,
    attempt: failedWithoutCreditAttempt,
    usage: null,
    transactionId: 'wompi-tx-recovered',
    amountInCents: 10000000,
  });
  assert.equal(recoveredWithoutCredit.allowed, true);
  assert.equal(recoveredWithoutCredit.duplicate, false);
  ok('FAILED a APPROVED exacto puede reconciliarse si no se liberó dinero');

  const failedWithReservedCredit = evaluateApprovedPaymentAttempt({
    ...approval(),
    order: makeOrder({ payment: { status: 'failed' } }),
    attempt: makeAttempt({
      state: 'declined',
      active: false,
      transactionId: 'wompi-tx-credit-recovered',
    }),
    usage: { _id: USAGE_ID, status: 'reserved' },
    transactionId: 'wompi-tx-credit-recovered',
  });
  assert.equal(failedWithReservedCredit.allowed, true);
  ok('FAILED a APPROVED conserva la reserva exacta si aún sigue reservada');

  assert.equal(isOrderClosedForCheckout(paidOrder), true);
  assert.equal(
    isOrderClosedForCheckout(makeOrder({ status: 'cancelled' })),
    true
  );
  ok('un token público vigente no permite reabrir una orden cerrada');

  assert.deepEqual(buildStoreCreditAttemptSnapshot(makeOrder()), {
    applied: true,
    usage: USAGE_ID,
    amountInCents: 6000000,
    statusAtIssue: 'reserved',
  });
  assert.equal(
    sameAttemptComposition(makeAttempt(), {
      amountInCents: 4000000,
      currency: 'COP',
      merchantFingerprint: MERCHANT_FINGERPRINT,
      storeCredit: buildStoreCreditAttemptSnapshot(makeOrder()),
    }),
    true
  );
  ok('la reutilización compara monto, moneda, comercio y reserva exacta');

  const issueState = { order: makeOrder(), attempts: [] };
  const issueAttemptModel = {
    findOne(filter) {
      const found = issueState.attempts.find((item) =>
        Object.entries(filter).every(([key, value]) => {
          if (key === 'order') return String(item.order) === String(value);
          return item[key] === value;
        })
      );
      return query(found || null);
    },
    async updateMany(filter, update) {
      let modifiedCount = 0;
      for (const item of issueState.attempts) {
        const matches = Object.entries(filter).every(([key, value]) => {
          if (key === 'order') return String(item.order) === String(value);
          return item[key] === value;
        });
        if (!matches) continue;
        Object.assign(item, update.$set || {});
        modifiedCount += 1;
      }
      return { modifiedCount };
    },
    async create(documents) {
      const created = documents.map((document) => makeAttempt(document));
      issueState.attempts.push(...created);
      return created;
    },
  };
  const issueService = createPaymentAttemptService({
    mongooseAdapter: {
      startSession: async () => ({
        withTransaction: async (work) => work(),
        endSession: async () => {},
      }),
    },
    OrderModel: { findById: () => query(issueState.order) },
    PaymentAttemptModel: issueAttemptModel,
    StoreCreditUsageModel: { findById: () => query(null) },
    OrderEventModel: { create: async () => [] },
  });
  const issuedFirst = await issueService.issueAttempt({
    orderId: ORDER_ID,
    provider: PROVIDER,
    reference: 'ORDER-000777__TRY__window-a',
    amountInCents: 4000000,
    currency: 'COP',
    merchantFingerprint: MERCHANT_FINGERPRINT,
  });
  const issuedSecondWindow = await issueService.issueAttempt({
    orderId: ORDER_ID,
    provider: PROVIDER,
    reference: 'ORDER-000777__TRY__window-b',
    amountInCents: 4000000,
    currency: 'COP',
    merchantFingerprint: MERCHANT_FINGERPRINT,
  });
  assert.equal(issuedFirst.reused, false);
  assert.equal(issuedSecondWindow.reused, true);
  assert.equal(
    issuedSecondWindow.attempt.reference,
    issuedFirst.attempt.reference
  );
  assert.equal(issueState.attempts.length, 1);
  ok('dos ventanas reutilizan un único intento pendiente equivalente');

  issueState.order.payment.amount = 100000;
  issueState.order.storeCredit.status = 'released';
  const issuedAfterRelease = await issueService.issueAttempt({
    orderId: ORDER_ID,
    provider: PROVIDER,
    reference: 'ORDER-000777__TRY__after-release',
    amountInCents: 10000000,
    currency: 'COP',
    merchantFingerprint: MERCHANT_FINGERPRINT,
  });
  assert.equal(issuedAfterRelease.reused, false);
  assert.equal(issueState.attempts.length, 2);
  assert.equal(issueState.attempts[0].state, 'superseded');
  assert.equal(issueState.attempts[0].active, false);
  assert.equal(issueState.attempts[1].active, true);
  ok('un cambio de composición supersede atómicamente el intento anterior');

  issueState.order.status = 'paid';
  issueState.order.payment.status = 'paid';
  await assert.rejects(
    issueService.issueAttempt({
      orderId: ORDER_ID,
      provider: PROVIDER,
      reference: 'ORDER-000777__TRY__after-paid',
      amountInCents: 10000000,
      currency: 'COP',
      merchantFingerprint: MERCHANT_FINGERPRINT,
    }),
    (error) => error.code === 'PAYMENT_ATTEMPT_ORDER_CLOSED'
  );
  assert.equal(issueState.attempts.length, 2);
  ok('checkout no emite otro intento aunque el token siga vigente tras pagar');

  issueState.order.status = 'pending';
  issueState.order.payment.status = 'pending_gateway';
  const unidentifiedDecline = await issueService.claimNonApprovedAttempt(
    {
      order: issueState.order,
      provider: PROVIDER,
      reference: issueState.attempts[1].reference,
      transactionId: '',
      amountInCents: issueState.attempts[1].amountInCents,
      currency: 'COP',
      providerStatus: 'DECLINED',
      paymentStatus: 'failed',
      merchantFingerprint: MERCHANT_FINGERPRINT,
    },
    { session: {} }
  );
  assert.equal(unidentifiedDecline.allowed, false);
  assert.equal(unidentifiedDecline.ignored, true);
  assert.equal(issueState.attempts[1].active, true);
  assert.equal(issueState.attempts[1].state, 'issued');
  ok('un evento no aprobado sin transactionId no libera recursos');

  const staleDecline = await issueService.claimNonApprovedAttempt(
    {
      order: issueState.order,
      provider: PROVIDER,
      reference: issueState.attempts[0].reference,
      transactionId: 'wompi-tx-stale-declined',
      amountInCents: issueState.attempts[0].amountInCents,
      currency: 'COP',
      providerStatus: 'DECLINED',
      paymentStatus: 'failed',
      merchantFingerprint: MERCHANT_FINGERPRINT,
    },
    { session: {} }
  );
  assert.equal(staleDecline.allowed, false);
  assert.equal(staleDecline.ignored, true);
  assert.equal(issueState.attempts[1].active, true);
  assert.equal(issueState.attempts[1].state, 'issued');
  ok('DECLINED superseded no puede cerrar ni liberar el intento activo');

  const payuFingerprint = fingerprintPaymentMerchant('payu', 'merchant-fixture');
  const issuedByPayU = await issueService.issueAttempt({
    orderId: ORDER_ID,
    provider: 'payu',
    reference: 'ORDER-000777__TRY__payu-active',
    amountInCents: 10000000,
    currency: 'COP',
    merchantFingerprint: payuFingerprint,
  });
  assert.equal(issuedByPayU.reused, false);
  assert.equal(issueState.attempts.length, 3);
  assert.equal(issueState.attempts[1].state, 'superseded');
  assert.equal(issueState.attempts[1].active, false);
  assert.equal(issueState.attempts[2].provider, 'payu');
  assert.equal(issueState.attempts[2].active, true);
  ok('cambiar de pasarela supersede el único intento activo de la orden');

  const staleCrossProvider = await issueService.claimApprovedAttempt(
    {
      order: issueState.order,
      provider: PROVIDER,
      reference: issueState.attempts[1].reference,
      transactionId: 'wompi-tx-after-payu',
      amountInCents: issueState.attempts[1].amountInCents,
      currency: 'COP',
      merchantFingerprint: MERCHANT_FINGERPRINT,
    },
    { session: {} }
  );
  assert.equal(staleCrossProvider.allowed, false);
  assert.equal(staleCrossProvider.code, 'PAYMENT_ATTEMPT_SUPERSEDED');
  assert.equal(issueState.order.payment.status, 'pending_gateway');
  assert.equal(issueState.attempts[2].provider, 'payu');
  assert.equal(issueState.attempts[2].state, 'issued');
  assert.equal(issueState.attempts[2].active, true);
  ok('el APPROVED tardío de la pasarela anterior no toca el intento vigente');

  const raceOrder = makeOrder({
    payment: { amount: 100000 },
    storeCredit: { applied: false, usage: null, amount: 0, status: 'none' },
  });
  const crossProviderWinner = makeAttempt({
    provider: 'payu',
    reference: 'ORDER-000777__TRY__payu-race-winner',
    merchantFingerprint: payuFingerprint,
    amountInCents: 10000000,
    storeCredit: {
      applied: false,
      usage: null,
      amountInCents: 0,
      statusAtIssue: 'none',
    },
  });
  let raceActiveLookups = 0;
  const raceService = createPaymentAttemptService({
    mongooseAdapter: {
      startSession: async () => ({
        withTransaction: async (work) => work(),
        endSession: async () => {},
      }),
    },
    OrderModel: { findById: () => query(raceOrder) },
    PaymentAttemptModel: {
      findOne: () => {
        raceActiveLookups += 1;
        return query(raceActiveLookups === 1 ? null : crossProviderWinner);
      },
      updateMany: async () => ({ modifiedCount: 0 }),
      create: async () => {
        throw Object.assign(new Error('SIMULATED_ACTIVE_ATTEMPT_RACE'), {
          code: 11000,
        });
      },
    },
    StoreCreditUsageModel: { findById: () => query(null) },
    OrderEventModel: { create: async () => [] },
  });
  await assert.rejects(
    () =>
      raceService.issueAttempt({
        orderId: ORDER_ID,
        provider: PROVIDER,
        reference: 'ORDER-000777__TRY__wompi-race-loser',
        amountInCents: 10000000,
        currency: 'COP',
        merchantFingerprint: MERCHANT_FINGERPRINT,
      }),
    (error) => error.code === 'PAYMENT_ATTEMPT_CONCURRENT_CHANGE'
  );
  assert.equal(crossProviderWinner.provider, 'payu');
  assert.equal(crossProviderWinner.active, true);
  assert.equal(crossProviderWinner.state, 'issued');
  ok('la carrera entre pasarelas deja un solo ganador y obliga a refrescar');

  const state = {
    order: makeOrder(),
    usage: { _id: USAGE_ID, status: 'released' },
    attempts: [makeAttempt()],
    events: [],
  };
  const AttemptModel = {
    findOne(filter) {
      return query(
        state.attempts.find(
          (item) =>
            item.provider === filter.provider && item.reference === filter.reference
        ) || null
      );
    },
    async updateMany() {
      return { modifiedCount: 0 };
    },
    async create(documents) {
      const created = documents.map((document) => makeAttempt(document));
      state.attempts.push(...created);
      return created;
    },
  };
  const service = createPaymentAttemptService({
    mongooseAdapter: {
      startSession: async () => ({
        withTransaction: async (work) => work(),
        endSession: async () => {},
      }),
    },
    OrderModel: { findById: () => query(state.order) },
    PaymentAttemptModel: AttemptModel,
    StoreCreditUsageModel: { findById: () => query(state.usage) },
    OrderEventModel: {
      create: async (documents) => {
        state.events.push(...documents);
        return documents;
      },
    },
    now: () => new Date('2026-08-27T12:00:00.000Z'),
  });
  const session = {};
  const firstLate = await service.claimApprovedAttempt(
    {
      order: state.order,
      provider: PROVIDER,
      reference: REFERENCE,
      transactionId: 'wompi-tx-late',
      amountInCents: 4000000,
      currency: 'COP',
      merchantFingerprint: MERCHANT_FINGERPRINT,
    },
    { session }
  );
  assert.equal(firstLate.allowed, false);
  assert.equal(state.order.payment.status, 'pending_gateway');
  assert.equal(state.order.payment.reviewRequired, true);
  assert.equal(state.events.length, 1);
  const repeatedLate = await service.claimApprovedAttempt(
    {
      order: state.order,
      provider: PROVIDER,
      reference: REFERENCE,
      transactionId: 'wompi-tx-late',
      amountInCents: 4000000,
      currency: 'COP',
      merchantFingerprint: MERCHANT_FINGERPRINT,
    },
    { session }
  );
  assert.equal(repeatedLate.allowed, false);
  assert.equal(repeatedLate.alreadyRecorded, true);
  assert.equal(state.events.length, 1);
  ok('la conciliación tardía se persiste una sola vez y nunca marca paid');

  const unknownOrder = makeOrder();
  state.order = unknownOrder;
  const unknownClaim = await service.claimApprovedAttempt(
    {
      order: unknownOrder,
      provider: PROVIDER,
      reference: 'ORDER-000777__TRY__not-issued',
      transactionId: 'wompi-tx-unknown',
      amountInCents: 4000000,
      currency: 'COP',
      merchantFingerprint: MERCHANT_FINGERPRINT,
    },
    { session }
  );
  assert.equal(unknownClaim.code, 'PAYMENT_ATTEMPT_UNKNOWN');
  assert.equal(unknownOrder.payment.status, 'pending_gateway');
  assert.equal(unknownClaim.attempt.issuedBySystem, false);
  ok('el webhook desconocido deja evidencia forense sin aplicar el dinero');

  const foreignReference = 'ORDER-FOREIGN__TRY__collision';
  const foreignAttempt = makeAttempt({
    order: '66f000000000000000000099',
    orderNumber: '000999',
    reference: foreignReference,
  });
  state.attempts.push(foreignAttempt);
  const targetOrder = makeOrder({
    _id: '66f000000000000000000098',
    orderNumber: '000998',
  });
  state.order = targetOrder;
  const foreignClaim = await service.claimApprovedAttempt(
    {
      order: targetOrder,
      provider: PROVIDER,
      reference: foreignReference,
      transactionId: 'wompi-tx-foreign-reference',
      amountInCents: 4000000,
      currency: 'COP',
      merchantFingerprint: MERCHANT_FINGERPRINT,
    },
    { session }
  );
  assert.equal(foreignClaim.code, 'PAYMENT_ATTEMPT_ORDER_MISMATCH');
  assert.equal(targetOrder.payment.status, 'pending_gateway');
  assert.equal(targetOrder.payment.reviewRequired, true);
  assert.equal(foreignAttempt.state, 'issued');
  assert.equal(foreignAttempt.active, true);
  assert.equal(foreignAttempt.reconciliation.required, undefined);
  ok('una referencia ajena alerta la orden sin mutar el intento propietario');

  const lateOrder = makeOrder({ storeCredit: { status: 'released' } });
  const lateAttempt = makeAttempt();
  const lateState = {
    attempts: [lateAttempt],
    usage: { _id: USAGE_ID, status: 'released' },
    events: [],
    inventoryConfirmations: 0,
    invoices: 0,
  };
  const lateAttemptService = createPaymentAttemptService({
    mongooseAdapter: {
      startSession: async () => ({
        withTransaction: async (work) => work(),
        endSession: async () => {},
      }),
    },
    OrderModel: { findById: () => query(lateOrder) },
    PaymentAttemptModel: {
      findOne: () => query(lateState.attempts[0]),
      updateMany: async () => ({ modifiedCount: 0 }),
      create: async (documents) => documents.map((item) => makeAttempt(item)),
    },
    StoreCreditUsageModel: { findById: () => query(lateState.usage) },
    OrderEventModel: {
      create: async (documents) => {
        lateState.events.push(...documents);
        return documents;
      },
    },
    now: () => new Date('2026-08-27T13:00:00.000Z'),
  });
  const wompiIntegrity = createWompiWebhookIntegrityService({
    withOrderTransaction: async (_orderNumber, work) => {
      const result = await work(lateOrder, { session: {} });
      await lateOrder.save();
      return result;
    },
    confirmInventoryReservation: async () => {
      lateState.inventoryConfirmations += 1;
      return { status: 'confirmed' };
    },
    applyReservationToOrderDocument: () => {},
    scheduleInvoiceOnce: async () => {
      lateState.invoices += 1;
      return { scheduled: true };
    },
    claimApprovedPaymentAttempt: lateAttemptService.claimApprovedAttempt,
  });
  const lateWompiResult = await wompiIntegrity.processApproved({
    orderNumber: lateOrder.orderNumber,
    transaction: {
      id: 'wompi-tx-late-integrity',
      status: 'APPROVED',
      reference: REFERENCE,
      amount_in_cents: 4000000,
      currency: 'COP',
    },
    payments: { currency: 'COP' },
    reference: REFERENCE,
    merchantFingerprint: MERCHANT_FINGERPRINT,
    verified: true,
  });
  assert.equal(lateWompiResult.reconciliationRequired, true);
  assert.equal(lateWompiResult.retryable, false);
  assert.equal(lateOrder.payment.status, 'pending_gateway');
  assert.equal(lateOrder.status, 'pending');
  assert.equal(lateState.inventoryConfirmations, 0);
  assert.equal(lateState.invoices, 0);
  assert.equal(lateState.events.length, 1);
  ok('Wompi tardío queda conciliable sin inventario, factura ni consumo ficticio');

  const paidSecondOrder = makeOrder({
    status: 'paid',
    payment: {
      status: 'paid',
      transactionId: 'wompi-tx-primary-applied',
      paidAt: new Date('2026-08-27T13:30:00.000Z'),
    },
    storeCredit: { status: 'consumed' },
  });
  paidSecondOrder.paymentProcessing = {
    approvedAt: new Date('2026-08-27T13:30:00.000Z'),
    approvedTransactionId: 'wompi-tx-primary-applied',
    inventory: { status: 'not_required' },
  };
  const paidSecondAttempt = makeAttempt({
    state: 'approved',
    active: false,
    transactionId: 'wompi-tx-primary-applied',
  });
  const secondState = { events: [], invoices: 0 };
  const secondAttemptService = createPaymentAttemptService({
    mongooseAdapter: {
      startSession: async () => ({
        withTransaction: async (work) => work(),
        endSession: async () => {},
      }),
    },
    OrderModel: { findById: () => query(paidSecondOrder) },
    PaymentAttemptModel: {
      findOne: () => query(paidSecondAttempt),
      updateMany: async () => ({ modifiedCount: 0 }),
      create: async (documents) => documents.map((item) => makeAttempt(item)),
    },
    StoreCreditUsageModel: {
      findById: () => query({ _id: USAGE_ID, status: 'consumed' }),
    },
    OrderEventModel: {
      create: async (documents) => {
        secondState.events.push(...documents);
        return documents;
      },
    },
    now: () => new Date('2026-08-27T14:00:00.000Z'),
  });
  const secondIntegrity = createWompiWebhookIntegrityService({
    withOrderTransaction: async (_orderNumber, work) =>
      work(paidSecondOrder, { session: {} }),
    confirmInventoryReservation: async () => {
      throw new Error('SECOND_CHARGE_MUST_NOT_TOUCH_INVENTORY');
    },
    applyReservationToOrderDocument: () => {
      throw new Error('SECOND_CHARGE_MUST_NOT_APPLY_INVENTORY');
    },
    scheduleInvoiceOnce: async () => {
      secondState.invoices += 1;
      return { scheduled: true };
    },
    claimApprovedPaymentAttempt: secondAttemptService.claimApprovedAttempt,
  });
  const secondWompiResult = await secondIntegrity.processApproved({
    orderNumber: paidSecondOrder.orderNumber,
    transaction: {
      id: 'wompi-tx-second-real-charge',
      status: 'APPROVED',
      reference: REFERENCE,
      amount_in_cents: 4000000,
      currency: 'COP',
    },
    payments: { currency: 'COP' },
    reference: REFERENCE,
    merchantFingerprint: MERCHANT_FINGERPRINT,
    verified: true,
  });
  assert.equal(secondWompiResult.reconciliationRequired, true);
  assert.equal(secondWompiResult.reconciliationCode, 'PAYMENT_SECOND_CHARGE_DETECTED');
  assert.equal(paidSecondAttempt.transactionId, 'wompi-tx-primary-applied');
  assert.equal(
    paidSecondAttempt.reconciliation.transactionId,
    'wompi-tx-second-real-charge'
  );
  assert.equal(paidSecondOrder.payment.transactionId, 'wompi-tx-primary-applied');
  assert.equal(secondState.invoices, 0);
  assert.equal(secondState.events.length, 1);
  ok('un segundo cobro real preserva el pago original y no relanza efectos');

  console.log(
    `\nLedger transaccional de intentos de pago: ${passed}/${passed} controles aprobados`
  );
}

run().catch((error) => {
  console.error('\nFAIL Ledger transaccional de intentos de pago');
  console.error(error);
  process.exitCode = 1;
});
