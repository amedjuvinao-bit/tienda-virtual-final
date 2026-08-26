'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const mongoose = require('mongoose');

const {
  buildPaymentFailureReleaseReason,
  reconcilePaymentFailureReservation,
  releaseReservedItems,
} = require('../services/inventoryReservationService');
const {
  applyReturnsToOrderInventoryAllocations,
} = require('../services/orderInventoryAllocationService');
const {
  assertFailureMovementMatches,
  buildFailureMovementNumber,
  createLegacyInventoryCompensationService,
  createPaymentInventoryFailureService,
  getLegacyCompensationPlan,
  restoreLegacyAllocation,
  resolveFailureInventoryMode,
} = require('../services/paymentInventoryFailureService');
const {
  CANONICAL_ELECTRONIC_INVOICE_STATUSES,
  findCanonicalElectronicInvoice,
  getCanonicalPaymentApprovalEvidence,
  isApprovedPayment,
  resolveMonotonicWompiTransition,
} = require('../services/wompiWebhookIntegrityService');
const {
  isBillableOrder,
} = require('../services/electronicInvoiceIssuanceService');

const checks = [];

async function check(name, callback) {
  await callback();
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createStockModel(rows) {
  return {
    async updateOne(filter) {
      const row = rows.get(String(filter._id));
      const matches =
        row &&
        String(row.branch) === String(filter.branch) &&
        String(row.product) === String(filter.product) &&
        row.variantKey === filter.variantKey &&
        row.reservedStock >= Number(filter.reservedStock?.$gte || 0);
      if (!matches) return { matchedCount: 0, modifiedCount: 0 };
      const quantity = Number(filter.reservedStock.$gte);
      row.reservedStock -= quantity;
      row.availableStock = row.stock - row.reservedStock;
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
}

function reservationOrder() {
  return {
    _id: 'order-reservation-failure',
    orderNumber: 'TEST-FAIL-RESERVATION',
    payment: {
      status: 'failed',
      reference: 'ORDER-TEST-FAIL-RESERVATION__TRY__1',
      transactionId: 'tx-test-fail-reservation-1',
    },
    inventoryControl: {
      reservationRequired: true,
      reservationId: 'reservation-1',
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
    inventoryAllocations: [
      {
        _id: 'allocation-reserved-1',
        inventoryStock: 'stock-a',
        branch: 'branch-a',
        product: 'product-dress',
        variantKey: '4__royalblue',
        size: '4',
        color: 'royalblue',
        quantity: 2,
        reservedQuantity: 2,
        soldQuantity: 0,
        releasedQuantity: 0,
        status: 'reserved',
      },
    ],
  };
}

function incompleteReservationOrder() {
  return {
    _id: 'order-incomplete-failure',
    orderNumber: 'TEST-FAIL-INCOMPLETE',
    payment: { status: 'failed' },
    inventoryControl: {
      reservationRequired: true,
      reservationId: null,
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
    inventoryAllocations: [],
  };
}

function noActionOrder() {
  return {
    _id: 'order-no-inventory-failure',
    orderNumber: 'TEST-FAIL-NO-INVENTORY',
    payment: { status: 'failed' },
    inventoryControl: {
      reservationRequired: false,
      reservationId: null,
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
    inventoryAllocations: [],
  };
}

function approvedWompiOrder(overrides = {}) {
  const orderNumber = overrides.orderNumber || 'APPROVED-WOMPI-1';
  const transactionId = overrides.transactionId || 'tx-approved-wompi-1';
  return {
    _id: overrides._id || 'order-approved-wompi-1',
    orderNumber,
    status: 'paid',
    source: 'web',
    total: 1000,
    payment: {
      provider: 'wompi',
      status: 'paid',
      reference: `ORDER-${orderNumber}__TRY__approved`,
      transactionId,
      paidAt: new Date('2026-08-01T12:00:00.000Z'),
      ...(overrides.payment || {}),
    },
    paymentProcessing: {
      provider: 'wompi',
      approvedTransactionId: transactionId,
      approvedAt: new Date('2026-08-01T12:00:00.000Z'),
      inventory: { status: 'not_required' },
      invoice: { status: 'pending' },
      ...(overrides.paymentProcessing || {}),
    },
    inventoryControl: {
      reservationRequired: false,
      discountedAtCheckout: false,
      restockedOnFailure: false,
    },
    inventoryAllocations: [],
    ...overrides,
  };
}

function createObservedFailureService(calls = {}) {
  calls.release = 0;
  calls.apply = 0;
  calls.compensate = 0;

  return createPaymentInventoryFailureService({
    releaseReservation: async (_identifier, details) => {
      calls.release += 1;
      return {
        _id: 'reservation-observed',
        status: details.status,
        releaseReason: details.releaseReason,
      };
    },
    applyReservation: () => {
      calls.apply += 1;
    },
    compensateLegacyInventory: async () => {
      calls.compensate += 1;
      return { completed: true };
    },
    now: () => new Date('2026-08-04T12:00:00.000Z'),
  });
}

function legacyOrder() {
  return {
    _id: 'order-legacy-failure',
    orderNumber: 'TEST-FAIL-LEGACY',
    payment: { status: 'failed' },
    inventoryControl: {
      reservationRequired: true,
      reservationId: null,
      discountedAtCheckout: true,
      restockedOnFailure: false,
      restockedAt: null,
    },
    inventoryAllocations: [
      {
        _id: 'allocation-a',
        inventoryStock: 'stock-a',
        branch: 'branch-a',
        product: 'product-dress',
        variantKey: '4__royalblue',
        size: '4',
        color: 'Azul rey',
        quantity: 2,
        soldQuantity: 2,
        returnedQuantity: 0,
        status: 'sold',
      },
      {
        _id: 'allocation-b',
        inventoryStock: 'stock-b',
        branch: 'branch-b',
        product: 'product-dress',
        variantKey: '4__royalblue',
        size: '4',
        color: 'royalblue',
        quantity: 1,
        soldQuantity: 1,
        returnedQuantity: 0,
        status: 'sold',
      },
    ],
  };
}

function buildInMemoryLegacyCompensator({ stocks, movements, shouldFail }) {
  return createLegacyInventoryCompensationService({
    restoreAllocation: async ({ order, planItem }) => {
      if (shouldFail(planItem)) throw new Error('fallo aislado de sede');
      const movementNumber = buildFailureMovementNumber(order, planItem);
      if (movements.has(movementNumber)) {
        return { completed: true, alreadyRestored: true };
      }
      const row = stocks.get(String(planItem.inventoryStock));
      assert(row, 'La prueba debe conservar la fila original.');
      assert.equal(row.branch, String(planItem.branch));
      assert.equal(planItem.variantKey, '4__royalblue');
      row.stock += planItem.quantityToRestore;
      row.availableStock = row.stock - row.reservedStock;
      movements.add(movementNumber);
      return { completed: true, alreadyRestored: false };
    },
    applyReturns: applyReturnsToOrderInventoryAllocations,
    syncProducts: async () => {},
    now: () => new Date('2026-08-03T12:00:00.000Z'),
  });
}

function createDeferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createBarrier(parties) {
  let arrivals = 0;
  const released = createDeferred();
  return {
    async wait() {
      arrivals += 1;
      if (arrivals >= parties) released.resolve();
      await released.promise;
    },
    get arrivals() {
      return arrivals;
    },
  };
}

function createElectronicInvoiceModel(rows, expectedSession) {
  return {
    findOne(filter) {
      assert.deepEqual(
        filter.status.$in,
        [...CANONICAL_ELECTRONIC_INVOICE_STATUSES]
      );
      const found = rows.find(
        (row) =>
          String(row.orderId) === String(filter.orderId) &&
          filter.status.$in.includes(row.status)
      ) || null;
      const chain = {
        session(session) {
          assert.equal(session, expectedSession);
          return chain;
        },
        select() {
          return chain;
        },
        lean() {
          return Promise.resolve(found);
        },
      };
      return chain;
    },
  };
}

function createMutex() {
  let tail = Promise.resolve();
  return async (work) => {
    const previous = tail;
    const next = createDeferred();
    tail = next.promise;
    await previous;
    try {
      return await work();
    } finally {
      next.resolve();
    }
  };
}

async function runMountedRouteControls() {
  const WEBHOOK_SECRET = 'local-payment-failure-fixture';
  const ORDER_NUMBER = 'PAYMENT-FAILURE-ROUTE-1';
  const REFERENCE = `ORDER-${ORDER_NUMBER}__TRY__fixture`;
  const AMOUNT_IN_CENTS = 150000;
  const asyncContext = new AsyncLocalStorage();
  const routeState = {};

  function hydrateOrder(source = {}) {
    return {
      ...source,
      async save() {
        return this;
      },
    };
  }

  function hydrateReservation(source = {}) {
    return {
      ...source,
      items: (source.items || []).map((item) => ({ ...item })),
      async save() {
        return this;
      },
    };
  }

  function resetRouteState({ reservationRequired = true } = {}) {
    routeState.order = hydrateOrder({
      _id: 'route-order-1',
      orderNumber: ORDER_NUMBER,
      total: AMOUNT_IN_CENTS / 100,
      status: 'pending',
      payment: {
        status: 'pending_gateway',
        provider: 'wompi',
        currency: 'COP',
        paidAt: null,
      },
      paymentProcessing: undefined,
      inventoryControl: {
        reservationRequired,
        reservationId: reservationRequired ? 'route-reservation-1' : null,
        discountedAtCheckout: false,
        restockedOnFailure: false,
        restockedAt: null,
      },
      inventoryAllocations: reservationRequired
        ? [
            {
              _id: 'route-allocation-1',
              inventoryStock: 'route-stock-1',
              branch: 'route-branch-1',
              product: 'route-product-1',
              variantKey: 'm__black',
              quantity: 1,
              reservedQuantity: 1,
              soldQuantity: 0,
              returnedQuantity: 0,
              releasedQuantity: 0,
              status: 'reserved',
            },
          ]
        : [],
      inventoryAllocationSummary: {
        totalQuantity: reservationRequired ? 1 : 0,
        soldQuantity: 0,
        activeReservedQuantity: reservationRequired ? 1 : 0,
      },
      fulfillment: { status: 'pending', notificationError: '' },
      timeline: [],
      items: [],
    });
    routeState.reservation = reservationRequired
      ? hydrateReservation({
          _id: 'route-reservation-1',
          order: routeState.order._id,
          orderNumber: ORDER_NUMBER,
          paymentReference: REFERENCE,
          paymentTransactionId: '',
          status: 'pending',
          releaseReason: '',
          failedAt: null,
          cancelledAt: null,
          expiredAt: null,
          releasedAt: null,
          confirmedAt: null,
          items: [
            {
              _id: 'route-reservation-item-1',
              inventoryStock: 'route-stock-1',
              branch: 'route-branch-1',
              product: 'route-product-1',
              variantKey: 'm__black',
              size: 'M',
              color: 'black',
              quantity: 1,
              releasedAt: null,
              confirmedAt: null,
              saleMovement: null,
            },
          ],
        })
      : null;
    routeState.stock = {
      _id: 'route-stock-1',
      branch: 'route-branch-1',
      product: 'route-product-1',
      variantKey: 'm__black',
      active: true,
      deletedAt: null,
      stock: 4,
      reservedStock: reservationRequired ? 1 : 0,
      availableStock: reservationRequired ? 3 : 4,
    };
    routeState.events = [];
    routeState.releaseCalls = 0;
    routeState.releaseAttemptCount = 0;
    routeState.reconcileCalls = 0;
    routeState.confirmCalls = 0;
    routeState.kardexCount = 0;
    routeState.releaseMode = 'success';
    routeState.invoices = [];
    routeState.transactionBarrier = null;
    routeState.preferredTransaction = '';
    routeState.preferredDone = createDeferred();
    routeState.transactionMutex = createMutex();
  }

  function snapshotRouteState() {
    return clone({
      order: routeState.order,
      reservation: routeState.reservation,
      stock: routeState.stock,
      events: routeState.events,
      releaseCalls: routeState.releaseCalls,
      reconcileCalls: routeState.reconcileCalls,
      confirmCalls: routeState.confirmCalls,
      kardexCount: routeState.kardexCount,
    });
  }

  function restoreRouteState(snapshot) {
    routeState.order = hydrateOrder(snapshot.order);
    routeState.reservation = snapshot.reservation
      ? hydrateReservation(snapshot.reservation)
      : null;
    routeState.stock = snapshot.stock;
    routeState.events = snapshot.events;
    routeState.releaseCalls = snapshot.releaseCalls;
    routeState.reconcileCalls = snapshot.reconcileCalls;
    routeState.confirmCalls = snapshot.confirmCalls;
    routeState.kardexCount = snapshot.kardexCount;
  }

  function query(value) {
    const promise = Promise.resolve(value);
    const chain = {
      session() {
        return chain;
      },
      select() {
        return chain;
      },
      lean() {
        return Promise.resolve(value);
      },
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
    };
    return chain;
  }

  const fakeOrderModel = {
    findOne: ({ orderNumber } = {}) =>
      query(
        !orderNumber || orderNumber === routeState.order.orderNumber
          ? routeState.order
          : null
      ),
    findById: () => query(routeState.order),
    findOneAndUpdate: async () => null,
    updateOne: async () => ({ matchedCount: 1, modifiedCount: 1 }),
  };
  const fakeOrderEventModel = {
    create: async (documents) => {
      routeState.events.push(...documents.map((entry) => ({ ...entry })));
      return documents;
    },
  };
  const fakeMongoose = {
    models: { OrderEvent: fakeOrderEventModel },
    Types: { ObjectId: { isValid: () => true } },
    startSession: async () => {
      const label = asyncContext.getStore() || '';
      return {
        async withTransaction(work) {
          if (routeState.transactionBarrier) {
            await routeState.transactionBarrier.wait();
          }
          if (
            routeState.preferredTransaction &&
            label !== routeState.preferredTransaction
          ) {
            await routeState.preferredDone.promise;
          }
          return routeState.transactionMutex(async () => {
            const snapshot = snapshotRouteState();
            try {
              return await work();
            } catch (error) {
              restoreRouteState(snapshot);
              throw error;
            } finally {
              if (label === routeState.preferredTransaction) {
                routeState.preferredDone.resolve();
              }
            }
          });
        },
        async endSession() {},
      };
    },
  };

  function applyReservation(order, reservation) {
    if (!reservation) return;
    const confirmed = reservation.status === 'confirmed';
    const released = ['failed', 'cancelled', 'released', 'expired'].includes(
      reservation.status
    );
    order.inventoryControl.reservationId = reservation._id;
    order.inventoryAllocations = reservation.items.map((item) => ({
      _id: 'route-allocation-1',
      reservation: reservation._id,
      reservationItem: item._id,
      inventoryStock: item.inventoryStock,
      branch: item.branch,
      product: item.product,
      variantKey: item.variantKey,
      quantity: item.quantity,
      reservedQuantity: item.quantity,
      soldQuantity: confirmed ? item.quantity : 0,
      returnedQuantity: 0,
      releasedQuantity: released ? item.quantity : 0,
      status: confirmed ? 'sold' : released ? 'released' : 'reserved',
    }));
    order.inventoryAllocationSummary = {
      totalQuantity: 1,
      soldQuantity: confirmed ? 1 : 0,
      activeReservedQuantity: confirmed || released ? 0 : 1,
    };
  }

  const fakeInventoryReservationService = {
    async releaseInventoryReservation(identifier, details, options) {
      assert.equal(options.session != null, true);
      routeState.releaseAttemptCount += 1;
      routeState.releaseCalls += 1;
      const reservation = routeState.reservation;
      if (
        !reservation ||
        ![reservation._id, reservation.orderNumber].includes(String(identifier))
      ) {
        throw Object.assign(new Error('RESERVATION_NOT_FOUND'), {
          code: 'RESERVATION_NOT_FOUND',
          retryable: true,
        });
      }
      if (reservation.status !== 'pending') return reservation;
      routeState.stock.reservedStock -= 1;
      routeState.stock.availableStock =
        routeState.stock.stock - routeState.stock.reservedStock;
      reservation.status = details.status;
      reservation.releaseReason = details.releaseReason;
      reservation.paymentReference = details.paymentReference;
      reservation.paymentTransactionId = details.paymentTransactionId;
      reservation[details.status === 'failed' ? 'failedAt' : 'cancelledAt'] =
        new Date();
      reservation.items[0].releasedAt = new Date();
      if (routeState.releaseMode === 'mongo-transient') {
        const error = Object.assign(new Error('SIMULATED_WRITE_CONFLICT'), {
          code: 112,
          codeName: 'WriteConflict',
          errorLabels: ['TransientTransactionError'],
        });
        throw error;
      }
      if (routeState.releaseMode === 'mongo-cause') {
        const cause = Object.assign(new Error('SIMULATED_COMMIT_RESULT'), {
          errorLabels: ['UnknownTransactionCommitResult'],
        });
        throw Object.assign(new Error('SIMULATED_WRAPPED_MONGO_ERROR'), {
          cause,
        });
      }
      if (routeState.releaseMode === 'permanent') {
        throw Object.assign(new Error('SIMULATED_PERMANENT_MISMATCH'), {
          code: 'PAYMENT_FAILURE_MOVEMENT_MISMATCH',
        });
      }
      if (routeState.releaseMode === 'reserved-release-failed') {
        throw Object.assign(new Error('SIMULATED_RESERVED_STOCK_RELEASE_FAILED'), {
          code: 'RESERVED_STOCK_RELEASE_FAILED',
          statusCode: 409,
        });
      }
      if (
        routeState.releaseMode === 'retry-once' &&
        routeState.releaseAttemptCount === 1
      ) {
        throw Object.assign(new Error('SIMULATED_RETRYABLE_RELEASE'), {
          code: 'RESERVED_STOCK_RELEASE_FAILED',
        });
      }
      if (routeState.releaseMode === 'partial-error') {
        throw Object.assign(new Error('SIMULATED_PARTIAL_RELEASE'), {
          code: 'SIMULATED_PARTIAL_RELEASE',
          retryable: true,
        });
      }
      return reservation;
    },
    async reconcilePaymentFailureReservation(identifier, details, options) {
      routeState.reconcileCalls += 1;
      return reconcilePaymentFailureReservation(identifier, details, {
        ...options,
        findReservation: async () => routeState.reservation,
        InventoryStockModel: {
          async findOneAndUpdate(filter, update) {
            const quantity = update[0].$set.reservedStock.$add[1];
            const available =
              routeState.stock.stock - routeState.stock.reservedStock;
            if (
              filter._id !== routeState.stock._id ||
              available < quantity
            ) {
              return null;
            }
            routeState.stock.reservedStock += quantity;
            routeState.stock.availableStock =
              routeState.stock.stock - routeState.stock.reservedStock;
            return routeState.stock;
          },
        },
      });
    },
    async confirmInventoryReservation(identifier) {
      routeState.confirmCalls += 1;
      const reservation = routeState.reservation;
      if (
        !reservation ||
        ![reservation._id, reservation.orderNumber].includes(String(identifier))
      ) {
        throw Object.assign(new Error('RESERVATION_NOT_FOUND'), {
          code: 'RESERVATION_NOT_FOUND',
        });
      }
      if (reservation.status === 'confirmed') return reservation;
      if (
        reservation.status !== 'pending' ||
        routeState.stock.stock < 1 ||
        routeState.stock.reservedStock < 1
      ) {
        throw Object.assign(new Error('RESERVATION_NOT_CONFIRMABLE'), {
          code: 'RESERVATION_NOT_CONFIRMABLE',
          retryable: true,
        });
      }
      routeState.stock.stock -= 1;
      routeState.stock.reservedStock -= 1;
      routeState.stock.availableStock =
        routeState.stock.stock - routeState.stock.reservedStock;
      reservation.status = 'confirmed';
      reservation.confirmedAt = new Date();
      reservation.items[0].confirmedAt = new Date();
      reservation.items[0].saleMovement = `sale-${routeState.kardexCount + 1}`;
      routeState.kardexCount += 1;
      return reservation;
    },
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
              credentials: { wompi: { webhookSecret: WEBHOOK_SECRET } },
            },
          },
        },
      }),
    }),
  };
  const fakeElectronicInvoice = {
    findOne: (filter = {}) => {
      const allowedStatuses = Array.isArray(filter?.status?.$in)
        ? filter.status.$in
        : null;
      const found = routeState.invoices.find(
        (invoice) =>
          String(invoice.orderId) === String(filter.orderId) &&
          (!allowedStatuses || allowedStatuses.includes(invoice.status))
      ) || null;
      return query(found);
    },
    find: () => ({ sort: () => ({ lean: async () => [] }) }),
    deleteOne: async () => ({ deletedCount: 0 }),
  };
  const originalLoad = Module._load;
  Module._load = function loadPaymentFailureRouteDoubles(request, parent, isMain) {
    const doubles = {
      mongoose: fakeMongoose,
      '../models/SiteSettings': fakeSiteSettings,
      '../models/Order': fakeOrderModel,
      '../models/Product': { findById: async () => null },
      '../models/ElectronicInvoice': fakeElectronicInvoice,
      '../middleware/requireAdmin': (req, res, next) => next(),
      '../middleware/requirePermission': () => (req, res, next) => next(),
      '../services/inventoryReservationService': fakeInventoryReservationService,
      '../services/orderInventoryAllocationService': {
        applyReservationToOrderDocument: applyReservation,
      },
      '../services/electronicInvoiceAfterPaymentService': {
        executeElectronicInvoiceAfterPayment: async () => ({
          outcome: 'performed',
          performed: true,
          terminal: true,
          reasonCode: 'INVOICE_PROCESSED',
        }),
      },
      '../services/electronicInvoiceIssuanceService': {
        issueElectronicInvoiceForOrder: async () => ({}),
      },
      '../services/publicPaymentAccessService': {
        SAFE_PAYMENT_ACCESS_ERROR: 'UNAUTHORIZED',
        buildPublicCheckoutResponse: () => ({}),
        buildPublicTransactionResponse: () => ({}),
        isValidObjectIdText: () => true,
        isValidTransactionId: () => true,
        isWompiTransactionOwnedByOrder: () => true,
        resolveAuthorizedPublicPaymentOrder: async () => ({
          order: routeState.order,
        }),
      },
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

  let handler;
  try {
    const routePath = require.resolve('../routes/payments');
    delete require.cache[routePath];
    const router = require('../routes/payments');
    const layer = router.stack.find(
      (candidate) =>
        candidate.route?.path === '/wompi/webhook' &&
        candidate.route.methods?.post
    );
    assert(layer, 'La ruta POST /wompi/webhook debe estar montada.');
    handler = layer.route.stack.at(-1).handle;
  } finally {
    Module._load = originalLoad;
  }

  function event(status, transactionId = `tx-${status.toLowerCase()}`) {
    const transaction = {
      id: transactionId,
      status,
      reference: REFERENCE,
      amount_in_cents: AMOUNT_IN_CENTS,
      currency: 'COP',
      payment_method_type: 'CARD',
      payment_method: { type: 'CARD' },
      finalized_at: status === 'APPROVED' ? '2026-08-10T12:00:00.000Z' : null,
    };
    const body = {
      event: 'transaction.updated',
      data: { transaction },
      timestamp: 1770000000,
      signature: {
        properties: [
          'transaction.id',
          'transaction.status',
          'transaction.amount_in_cents',
        ],
      },
    };
    const values = body.signature.properties
      .map((property) =>
        property.split('.').reduce((value, key) => value?.[key], body.data)
      )
      .join('');
    body.signature.checksum = crypto
      .createHash('sha256')
      .update(`${values}${body.timestamp}${WEBHOOK_SECRET}`)
      .digest('hex');
    return body;
  }

  async function invoke(status, transactionId) {
    const req = { body: event(status, transactionId), get: () => '' };
    const response = { statusCode: 200, body: null };
    const res = {
      status(code) {
        response.statusCode = code;
        return this;
      },
      json(body) {
        response.body = body;
        return this;
      },
    };
    await asyncContext.run(status, () => handler(req, res));
    return response;
  }

  await check('la ruta real rechaza checksum invalido sin mutaciones', async () => {
    resetRouteState();
    const body = event('DECLINED');
    body.signature.checksum = '0'.repeat(64);
    const before = snapshotRouteState();
    const req = { body, get: () => '' };
    const response = { statusCode: 200, body: null };
    await handler(req, {
      status(code) {
        response.statusCode = code;
        return this;
      },
      json(payload) {
        response.body = payload;
        return this;
      },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'INVALID_WOMPI_CHECKSUM');
    assert.deepEqual(snapshotRouteState(), before);
  });

  await check('PENDING en la ruta real no libera inventario', async () => {
    resetRouteState();
    const response = await invoke('PENDING');
    assert.equal(response.statusCode, 200);
    assert.equal(routeState.releaseCalls, 0);
    assert.equal(routeState.reservation.status, 'pending');
    assert.equal(routeState.stock.reservedStock, 1);
  });

  await check('una factura fiscal no sustituye la aprobacion Wompi dentro de la transaccion', async () => {
    resetRouteState();
    routeState.order.status = 'failed';
    routeState.order.payment.status = 'failed';
    routeState.invoices = [
      { orderId: routeState.order._id, status: 'accepted' },
    ];
    const response = await invoke('DECLINED', 'tx-late-historical-failure');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ignored, undefined);
    assert.equal(routeState.releaseCalls, 1);
    assert.equal(routeState.reservation.status, 'failed');
    assert.equal(routeState.order.payment.status, 'failed');
  });

  await check('recuperacion incompleta responde 503 y revierte la transaccion', async () => {
    resetRouteState();
    routeState.order.inventoryControl.reservationId = null;
    routeState.order.inventoryAllocations = [];
    routeState.order.inventoryAllocationSummary = {
      totalQuantity: 0,
      soldQuantity: 0,
      activeReservedQuantity: 0,
    };
    routeState.reservation = null;
    routeState.stock.reservedStock = 0;
    routeState.stock.availableStock = routeState.stock.stock;
    const before = snapshotRouteState();
    const response = await invoke('DECLINED');
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.retryable, true);
    assert.deepEqual(snapshotRouteState(), before);
  });

  for (const [providerStatus, internalStatus] of [
    ['DECLINED', 'failed'],
    ['VOIDED', 'cancelled'],
  ]) {
    await check(`${internalStatus} completa la recuperacion moderna con HTTP 200`, async () => {
      resetRouteState();
      const response = await invoke(providerStatus);
      assert.equal(response.statusCode, 200);
      assert.equal(routeState.reservation.status, internalStatus);
      assert.equal(routeState.stock.reservedStock, 0);
      assert.equal(routeState.order.inventoryControl.restockedOnFailure, true);
      assert.equal(routeState.releaseCalls, 1);
    });
  }

  await check('repeticion secuencial no duplica la liberacion', async () => {
    resetRouteState();
    const first = await invoke('DECLINED', 'tx-repeat');
    const second = await invoke('DECLINED', 'tx-repeat');
    assert.deepEqual([first.statusCode, second.statusCode], [200, 200]);
    assert.equal(routeState.releaseCalls, 1);
    assert.equal(routeState.stock.reservedStock, 0);
  });

  await check('fallo parcial de liberacion responde 503 y hace rollback total', async () => {
    resetRouteState();
    routeState.releaseMode = 'partial-error';
    const before = snapshotRouteState();
    const response = await invoke('DECLINED');
    assert.equal(response.statusCode, 503);
    assert.deepEqual(snapshotRouteState(), before);
  });

  for (const scenario of [
    {
      name: 'error reintentable tipado agotado responde 503',
      mode: 'reserved-release-failed',
      expectedCode: 503,
    },
    {
      name: 'WriteConflict de MongoDB agotado responde 503',
      mode: 'mongo-transient',
      expectedCode: 503,
    },
    {
      name: 'error transitorio preservado en cause responde 503',
      mode: 'mongo-cause',
      expectedCode: 503,
    },
    {
      name: 'error permanente no se disfraza como reintentable',
      mode: 'permanent',
      expectedCode: 500,
    },
  ]) {
    await check(scenario.name, async () => {
      resetRouteState();
      routeState.releaseMode = scenario.mode;
      const before = snapshotRouteState();
      const response = await invoke('DECLINED', `tx-${scenario.mode}`);
      assert.equal(response.statusCode, scenario.expectedCode);
      assert.deepEqual(snapshotRouteState(), before);
      if (scenario.expectedCode === 503) {
        assert.equal(response.body.retryable, true);
        assert.equal(routeState.releaseAttemptCount, 3);
      } else {
        assert.equal(response.body.error, 'WOMPI_WEBHOOK_ERROR');
        assert.equal(response.body.retryable, undefined);
        assert.equal(routeState.releaseAttemptCount, 1);
      }
    });
  }

  await check('un conflicto transitorio reejecuta toda la transaccion y termina en 200', async () => {
    resetRouteState();
    routeState.releaseMode = 'retry-once';
    const response = await invoke('DECLINED', 'tx-retry-once');
    assert.equal(response.statusCode, 200);
    assert.equal(routeState.releaseAttemptCount, 2);
    assert.equal(routeState.reservation.status, 'failed');
    assert.equal(routeState.order.inventoryControl.restockedOnFailure, true);
    assert.equal(routeState.stock.reservedStock, 0);
  });

  await check('APPROVED primero impide una liberacion concurrente tardia', async () => {
    resetRouteState();
    routeState.transactionBarrier = createBarrier(2);
    routeState.preferredTransaction = 'APPROVED';
    const responses = await Promise.all([
      invoke('APPROVED', 'tx-approved-first'),
      invoke('DECLINED', 'tx-failed-second'),
    ]);
    assert.deepEqual(
      responses.map((entry) => entry.statusCode),
      [200, 200],
      JSON.stringify(responses)
    );
    assert.equal(routeState.transactionBarrier.arrivals >= 2, true);
    assert.equal(routeState.order.payment.status, 'paid');
    assert.equal(routeState.reservation.status, 'confirmed');
    assert.equal(routeState.releaseCalls, 0);
    assert.equal(routeState.kardexCount, 1);
  });

  await check('FAILED primero se reconcilia atomicamente con APPROVED concurrente', async () => {
    resetRouteState();
    routeState.transactionBarrier = createBarrier(2);
    routeState.preferredTransaction = 'DECLINED';
    const responses = await Promise.all([
      invoke('DECLINED', 'tx-failed-first'),
      invoke('APPROVED', 'tx-approved-second'),
    ]);
    assert.deepEqual(responses.map((entry) => entry.statusCode), [200, 200]);
    assert.equal(routeState.transactionBarrier.arrivals >= 2, true);
    assert.equal(routeState.releaseCalls, 1);
    assert.equal(routeState.reconcileCalls, 1);
    assert.equal(routeState.order.payment.status, 'paid');
    assert.equal(routeState.order.inventoryControl.restockedOnFailure, false);
    assert.equal(routeState.reservation.status, 'confirmed');
    assert.equal(routeState.stock.reservedStock, 0);
    assert.equal(routeState.kardexCount, 1);
  });

  await check('reconciliacion temporalmente imposible no persiste paid y luego reintenta', async () => {
    resetRouteState();
    const failed = await invoke('DECLINED', 'tx-failure-before-retry');
    assert.equal(failed.statusCode, 200);
    routeState.stock.stock = 0;
    routeState.stock.availableStock = 0;
    const blocked = await invoke('APPROVED', 'tx-approval-blocked');
    assert.equal(blocked.statusCode, 503);
    assert.equal(routeState.order.payment.status, 'failed');
    assert.equal(routeState.reservation.status, 'failed');
    assert.equal(routeState.order.inventoryControl.restockedOnFailure, true);
    assert.equal(routeState.kardexCount, 0);

    routeState.stock.stock = 4;
    routeState.stock.availableStock = 4;
    const retried = await invoke('APPROVED', 'tx-approval-retry');
    const duplicate = await invoke('APPROVED', 'tx-approval-retry');
    assert.deepEqual([retried.statusCode, duplicate.statusCode], [200, 200]);
    assert.equal(routeState.order.payment.status, 'paid');
    assert.equal(routeState.reservation.status, 'confirmed');
    assert.equal(routeState.kardexCount, 1);
  });
}

async function main() {
  assert.equal(mongoose.connection.readyState, 0);

  await check('reservationRequired sin identificador ni descuento queda incompleta', async () => {
    const calls = {};
    const service = createObservedFailureService(calls);
    const order = incompleteReservationOrder();
    const before = clone(order);
    await assert.rejects(
      service.process({
        order,
        paymentStatus: 'failed',
        provider: 'wompi',
      }),
      (error) =>
        error.code === 'INVENTORY_RECOVERY_INCOMPLETE' &&
        error.retryable === true &&
        error.statusCode === 503
    );
    assert.deepEqual(order, before);
    assert.equal(order.inventoryControl.restockedOnFailure, false);
    assert.equal(order.inventoryControl.restockedAt, null);
    assert.deepEqual(calls, { release: 0, apply: 0, compensate: 0 });
  });

  await check('una bandera heredada sin asignaciones vendidas no prueba un descuento', async () => {
    const calls = {};
    const service = createObservedFailureService(calls);
    const order = incompleteReservationOrder();
    order.inventoryControl.discountedAtCheckout = true;

    assert.equal(resolveFailureInventoryMode(order), 'incomplete');
    await assert.rejects(
      service.process({ order, paymentStatus: 'failed' }),
      (error) => error.code === 'INVENTORY_RECOVERY_INCOMPLETE'
    );
    assert.equal(order.inventoryControl.restockedOnFailure, false);
    assert.equal(order.inventoryControl.restockedAt, null);
    assert.deepEqual(calls, { release: 0, apply: 0, compensate: 0 });
  });

  await check('repetir un estado incompleto no toca stock, reserva ni kardex', async () => {
    const calls = {};
    const service = createObservedFailureService(calls);
    const order = incompleteReservationOrder();
    const before = clone(order);

    await assert.rejects(
      service.process({ order, paymentStatus: 'failed' }),
      (error) => error.code === 'INVENTORY_RECOVERY_INCOMPLETE'
    );
    await assert.rejects(
      service.process({ order, paymentStatus: 'failed' }),
      (error) => error.code === 'INVENTORY_RECOVERY_INCOMPLETE'
    );
    assert.deepEqual(order, before);
    assert.deepEqual(calls, { release: 0, apply: 0, compensate: 0 });
  });

  await check('una recuperacion incompleta no habilita facturacion', async () => {
    const service = createObservedFailureService({});
    const order = incompleteReservationOrder();
    let invoiceCalls = 0;
    await assert.rejects(
      service.process({ order, paymentStatus: 'failed' }),
      (error) => error.code === 'INVENTORY_RECOVERY_INCOMPLETE'
    );
    assert.equal(invoiceCalls, 0);
  });

  await check('libera la reserva en la sede original sin aumentar stock fisico', async () => {
    const stocks = new Map([
      ['stock-a', {
        branch: 'branch-a',
        product: 'product-dress',
        variantKey: '4__royalblue',
        stock: 10,
        reservedStock: 2,
        availableStock: 8,
      }],
    ]);
    const reservation = {
      _id: 'reservation-1',
      status: 'pending',
      items: [
        {
          inventoryStock: 'stock-a',
          branch: 'branch-a',
          product: 'product-dress',
          variantKey: '4__royalblue',
          size: '4',
          color: 'Azul rey',
          quantity: 2,
        },
      ],
    };
    let releaseCalls = 0;
    const service = createPaymentInventoryFailureService({
      releaseReservation: async (_identifier, details) => {
        releaseCalls += 1;
        await releaseReservedItems({
          items: reservation.items,
          InventoryStockModel: createStockModel(stocks),
        });
        reservation.status = details.status;
        reservation.releaseReason = details.releaseReason;
        reservation.items.forEach((item) => {
          item.releasedAt = new Date();
        });
        return reservation;
      },
      applyReservation: (order) => {
        order.inventoryAllocations[0].releasedQuantity = 2;
        order.inventoryAllocations[0].status = 'released';
      },
      now: () => new Date('2026-08-03T12:00:00.000Z'),
    });
    const order = reservationOrder();
    const result = await service.process({
      order,
      paymentStatus: 'failed',
      provider: 'wompi',
    });
    assert.equal(result.action, 'release_reservation');
    assert.equal(stocks.get('stock-a').stock, 10);
    assert.equal(stocks.get('stock-a').reservedStock, 0);
    assert.equal(stocks.get('stock-a').availableStock, 10);
    assert.equal(order.inventoryControl.restockedOnFailure, true);

    const duplicate = await service.process({
      order,
      paymentStatus: 'failed',
      provider: 'wompi',
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(releaseCalls, 1);
    assert.equal(stocks.get('stock-a').stock, 10);
  });

  await check('el caso legitimo sin reserva ni descuento finaliza sin movimientos', async () => {
    const calls = {};
    const service = createObservedFailureService(calls);
    const order = noActionOrder();
    const result = await service.process({
      order,
      paymentStatus: 'cancelled',
      provider: 'wompi',
    });

    assert.equal(result.completed, true);
    assert.equal(result.action, 'none');
    assert.equal(order.inventoryControl.restockedOnFailure, true);
    assert.equal(
      new Date(order.inventoryControl.restockedAt).toISOString(),
      '2026-08-04T12:00:00.000Z'
    );
    assert.deepEqual(calls, { release: 0, apply: 0, compensate: 0 });
  });

  await check('reservationRequired false sin asignaciones evita una recuperacion ficticia', async () => {
    const calls = {};
    const service = createObservedFailureService(calls);
    const order = noActionOrder();
    order.inventoryControl.discountedAtCheckout = true;

    const result = await service.process({ order, paymentStatus: 'failed' });
    assert.equal(result.action, 'none');
    assert.equal(order.inventoryControl.restockedOnFailure, true);
    assert.deepEqual(calls, { release: 0, apply: 0, compensate: 0 });
  });

  await check('un estado incompleto se recupera una sola vez al aparecer la reserva', async () => {
    const order = incompleteReservationOrder();
    let releaseCalls = 0;
    let applyCalls = 0;
    const service = createPaymentInventoryFailureService({
      releaseReservation: async (reservationId, details) => {
        releaseCalls += 1;
        assert.equal(reservationId, 'reservation-late');
        return {
          _id: reservationId,
          status: details.status,
          releaseReason: details.releaseReason,
        };
      },
      applyReservation: () => {
        applyCalls += 1;
      },
    });

    await assert.rejects(
      service.process({ order, paymentStatus: 'failed' }),
      (error) => error.code === 'INVENTORY_RECOVERY_INCOMPLETE'
    );

    order.inventoryControl.reservationId = 'reservation-late';
    order.payment.reference = `ORDER-${order.orderNumber}__TRY__late`;
    order.payment.transactionId = 'tx-reservation-late';
    const recovered = await service.process({
      order,
      paymentStatus: 'failed',
      provider: 'wompi',
    });
    const duplicate = await service.process({
      order,
      paymentStatus: 'failed',
      provider: 'wompi',
    });

    assert.equal(recovered.completed, true);
    assert.equal(recovered.action, 'release_reservation');
    assert.equal(duplicate.duplicate, true);
    assert.equal(releaseCalls, 1);
    assert.equal(applyCalls, 1);
  });

  await check('compensa descuento heredado por sede, variante y cantidad exactas', async () => {
    const stocks = new Map([
      ['stock-a', { branch: 'branch-a', stock: 7, reservedStock: 0, availableStock: 7 }],
      ['stock-b', { branch: 'branch-b', stock: 4, reservedStock: 0, availableStock: 4 }],
    ]);
    const movements = new Set();
    const compensate = buildInMemoryLegacyCompensator({
      stocks,
      movements,
      shouldFail: () => false,
    });
    const service = createPaymentInventoryFailureService({
      releaseReservation: async () => {
        throw new Error('No debe liberar una reserva para descuento heredado.');
      },
      applyReservation: () => {},
      compensateLegacyInventory: compensate,
    });
    const order = legacyOrder();
    const result = await service.process({
      order,
      paymentStatus: 'cancelled',
      provider: 'wompi',
    });
    assert.equal(result.action, 'legacy_compensation');
    assert.equal(stocks.get('stock-a').stock, 9);
    assert.equal(stocks.get('stock-b').stock, 5);
    assert.equal(order.inventoryAllocations[0].returnedQuantity, 2);
    assert.equal(order.inventoryAllocations[1].returnedQuantity, 1);
    assert.equal(order.inventoryAllocations[0].variantKey, '4__royalblue');
    assert.equal(movements.size, 2);

    const duplicate = await service.process({
      order,
      paymentStatus: 'cancelled',
      provider: 'wompi',
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(stocks.get('stock-a').stock, 9);
    assert.equal(stocks.get('stock-b').stock, 5);
    assert.equal(movements.size, 2);
  });

  await check('fallo parcial no marca completo y un reintento posterior funciona', async () => {
    const initialStocks = new Map([
      ['stock-a', { branch: 'branch-a', stock: 7, reservedStock: 0, availableStock: 7 }],
      ['stock-b', { branch: 'branch-b', stock: 4, reservedStock: 0, availableStock: 4 }],
    ]);
    let failSecond = true;
    const movements = new Set();
    const inner = buildInMemoryLegacyCompensator({
      stocks: initialStocks,
      movements,
      shouldFail: (item) => failSecond && String(item.branch) === 'branch-b',
    });
    const transactionalCompensator = async (payload) => {
      const stockSnapshot = clone(Array.from(initialStocks.entries()));
      const movementSnapshot = Array.from(movements);
      const allocationSnapshot = clone(payload.order.inventoryAllocations);
      try {
        return await inner(payload);
      } catch (error) {
        initialStocks.clear();
        stockSnapshot.forEach(([key, value]) => initialStocks.set(key, value));
        movements.clear();
        movementSnapshot.forEach((value) => movements.add(value));
        payload.order.inventoryAllocations = allocationSnapshot;
        throw error;
      }
    };
    const service = createPaymentInventoryFailureService({
      releaseReservation: async () => null,
      applyReservation: () => {},
      compensateLegacyInventory: transactionalCompensator,
    });
    const order = legacyOrder();
    await assert.rejects(
      service.process({ order, paymentStatus: 'failed', provider: 'wompi' }),
      /fallo aislado de sede/
    );
    assert.equal(order.inventoryControl.restockedOnFailure, false);
    assert.equal(order.inventoryControl.restockedAt, null);
    assert.equal(initialStocks.get('stock-a').stock, 7);
    assert.equal(initialStocks.get('stock-b').stock, 4);
    assert.equal(movements.size, 0);

    failSecond = false;
    const retry = await service.process({
      order,
      paymentStatus: 'failed',
      provider: 'wompi',
    });
    assert.equal(retry.completed, true);
    assert.equal(initialStocks.get('stock-a').stock, 9);
    assert.equal(initialStocks.get('stock-b').stock, 5);
    assert.equal(movements.size, 2);
  });

  for (const failingStage of ['asignaciones', 'kardex', 'sincronizacion']) {
    await check(`un fallo de ${failingStage} se propaga y no marca recuperacion completa`, async () => {
      const order = legacyOrder();
      const rows = new Map([
        ['stock-a', { stock: 7 }],
        ['stock-b', { stock: 4 }],
      ]);
      const movements = new Set();
      const compensator = createLegacyInventoryCompensationService({
        restoreAllocation: async ({ order: sourceOrder, planItem }) => {
          if (failingStage === 'kardex') {
            throw new Error('SIMULATED_KARDEX_FAILURE');
          }
          rows.get(String(planItem.inventoryStock)).stock +=
            planItem.quantityToRestore;
          movements.add(buildFailureMovementNumber(sourceOrder, planItem));
          return { completed: true };
        },
        applyReturns: (sourceOrder, restorations, at) => {
          if (failingStage === 'asignaciones') {
            throw new Error('SIMULATED_ALLOCATION_FAILURE');
          }
          return applyReturnsToOrderInventoryAllocations(
            sourceOrder,
            restorations,
            at
          );
        },
        syncProducts: async () => {
          if (failingStage === 'sincronizacion') {
            throw new Error('SIMULATED_SYNC_FAILURE');
          }
        },
      });
      const transactional = async (payload) => {
        const beforeRows = clone(Array.from(rows.entries()));
        const beforeMovements = Array.from(movements);
        const beforeAllocations = clone(payload.order.inventoryAllocations);
        try {
          return await compensator(payload);
        } catch (error) {
          rows.clear();
          beforeRows.forEach(([key, value]) => rows.set(key, value));
          movements.clear();
          beforeMovements.forEach((value) => movements.add(value));
          payload.order.inventoryAllocations = beforeAllocations;
          throw error;
        }
      };
      const service = createPaymentInventoryFailureService({
        releaseReservation: async () => null,
        applyReservation: () => {},
        compensateLegacyInventory: transactional,
      });
      await assert.rejects(
        service.process({ order, paymentStatus: 'failed', provider: 'wompi' }),
        new RegExp(`SIMULATED_${
          failingStage === 'asignaciones'
            ? 'ALLOCATION'
            : failingStage === 'kardex'
              ? 'KARDEX'
              : 'SYNC'
        }_FAILURE`)
      );
      assert.equal(order.inventoryControl.restockedOnFailure, false);
      assert.equal(rows.get('stock-a').stock, 7);
      assert.equal(rows.get('stock-b').stock, 4);
      assert.equal(movements.size, 0);
    });
  }

  await check('DECLINED posterior a APPROVED no toca pago ni inventario', async () => {
    const order = approvedWompiOrder({
      _id: 'order-legacy-failure',
      orderNumber: 'TEST-FAIL-LEGACY',
      transactionId: 'tx-approved-legacy-failure',
      inventoryControl: legacyOrder().inventoryControl,
      inventoryAllocations: legacyOrder().inventoryAllocations,
    });
    const before = clone(order);
    let failureCalls = 0;
    const transition = resolveMonotonicWompiTransition(order, {
      paymentStatus: 'failed',
      orderStatus: 'failed',
    });
    if (!transition.ignored) failureCalls += 1;
    assert.equal(transition.ignored, true);
    assert.equal(transition.reason, 'APPROVED_IS_TERMINAL');
    assert.equal(failureCalls, 0);
    assert.deepEqual(clone(order), before);
  });

  await check('un pago aprobado no entra al servicio de recuperacion', async () => {
    const calls = {};
    const service = createObservedFailureService(calls);
    const order = reservationOrder();
    const before = clone(order);
    const result = await service.process({
      order,
      paymentStatus: 'paid',
      provider: 'wompi',
    });

    assert.deepEqual(result, {
      completed: false,
      ignored: true,
      action: 'ignored',
    });
    assert.deepEqual(order, before);
    assert.deepEqual(calls, { release: 0, apply: 0, compensate: 0 });
  });

  await check('la autoridad canonica exige aprobacion Wompi persistida e identidad completa', async () => {
    const order = approvedWompiOrder();
    const result = getCanonicalPaymentApprovalEvidence(order, {
      orderId: order._id,
      provider: 'wompi',
      paymentReference: `ORDER-${order.orderNumber}__TRY__later`,
      paymentTransactionId: 'tx-approved-wompi-1',
      electronicInvoice: { orderId: order._id, status: 'accepted' },
    });
    assert.equal(result.approved, true);
    assert.equal(result.evidence.identityComplete, true);
    assert.equal(result.evidence.electronicInvoice, false);
    assert.equal(isBillableOrder(order), true);
  });

  for (const fiscalStatus of ['generated', 'sent', 'accepted']) {
    await check(`factura ${fiscalStatus} sin pago autentico no autoriza`, async () => {
      const order = approvedWompiOrder({
        status: 'processing',
        payment: {
          provider: 'wompi',
          status: 'failed',
          reference: 'ORDER-APPROVED-WOMPI-1__TRY__failed',
          transactionId: 'tx-failed',
          paidAt: null,
        },
        paymentProcessing: {
          provider: 'wompi',
          approvedTransactionId: '',
          approvedAt: null,
          inventory: { status: 'not_required' },
          invoice: { status: 'pending' },
        },
      });
      const result = getCanonicalPaymentApprovalEvidence(order, {
        electronicInvoice: { orderId: order._id, status: fiscalStatus },
      });
      assert.equal(result.approved, false);
      assert.equal(result.evidence.electronicInvoice, false);
      assert.equal(isBillableOrder(order), false);
    });
  }

  await check('marcador scheduled sin pago autentico no autoriza', async () => {
    const order = approvedWompiOrder({
      status: 'processing',
      payment: {
        provider: 'wompi',
        status: 'failed',
        reference: 'ORDER-APPROVED-WOMPI-1__TRY__failed',
        transactionId: 'tx-failed',
        paidAt: null,
      },
      paymentProcessing: {
        provider: 'wompi',
        approvedTransactionId: '',
        approvedAt: null,
        inventory: { status: 'not_required' },
        invoice: { status: 'scheduled' },
      },
    });
    const result = getCanonicalPaymentApprovalEvidence(order);
    assert.equal(result.approved, false);
    assert.equal(result.evidence.invoiceProcessing, false);
    assert.equal(isBillableOrder(order), false);
  });

  for (const paymentStatus of ['failed', 'pending_gateway']) {
    await check(`orden processing con pago ${paymentStatus} no es facturable`, async () => {
      const order = approvedWompiOrder({
        status: 'processing',
        payment: {
          provider: 'wompi',
          status: paymentStatus,
          reference: 'ORDER-APPROVED-WOMPI-1__TRY__pending',
          transactionId: 'tx-not-approved',
          paidAt: null,
        },
        paymentProcessing: {
          provider: 'wompi',
          approvedTransactionId: '',
          approvedAt: null,
          inventory: { status: 'not_required' },
          invoice: { status: 'pending' },
        },
      });
      assert.equal(isApprovedPayment(order), false);
      assert.equal(isBillableOrder(order), false);
    });
  }

  for (const scenario of [
    {
      name: 'factura de proveedor diferente no autoriza',
      context: { provider: 'payu', electronicInvoice: { status: 'accepted' } },
    },
    {
      name: 'factura con referencia diferente no autoriza',
      context: {
        provider: 'wompi',
        paymentReference: 'ORDER-OTHER-PURCHASE__TRY__1',
        paymentTransactionId: 'tx-other',
        electronicInvoice: { status: 'accepted' },
      },
    },
    {
      name: 'factura con transaccion no relacionada y referencia ausente no autoriza',
      context: {
        provider: 'wompi',
        paymentReference: '',
        paymentTransactionId: 'tx-unrelated',
        electronicInvoice: { status: 'accepted' },
      },
    },
    {
      name: 'identidad de pago incompleta no autoriza',
      context: { provider: 'wompi', paymentReference: '', paymentTransactionId: '' },
    },
    {
      name: 'factura valida de otra orden no autoriza',
      context: {
        orderId: 'other-order',
        provider: 'wompi',
        paymentReference: 'ORDER-APPROVED-WOMPI-1__TRY__other',
        paymentTransactionId: 'tx-other',
        electronicInvoice: { orderId: 'other-order', status: 'accepted' },
      },
    },
  ]) {
    await check(scenario.name, async () => {
      const unpaid = approvedWompiOrder({
        status: 'processing',
        payment: {
          provider: 'wompi',
          status: 'failed',
          reference: 'ORDER-APPROVED-WOMPI-1__TRY__failed',
          transactionId: '',
          paidAt: null,
        },
        paymentProcessing: {
          provider: 'wompi',
          approvedTransactionId: '',
          approvedAt: null,
          inventory: { status: 'not_required' },
          invoice: { status: 'pending' },
        },
      });
      assert.equal(
        getCanonicalPaymentApprovalEvidence(unpaid, scenario.context).approved,
        false
      );
      assert.equal(isBillableOrder(unpaid), false);
    });
  }

  await check('varias facturas sin aprobacion Wompi no forman evidencia combinada', async () => {
    const order = approvedWompiOrder({
      status: 'processing',
      payment: {
        provider: 'wompi',
        status: 'failed',
        reference: 'ORDER-APPROVED-WOMPI-1__TRY__failed',
        transactionId: 'tx-failed',
        paidAt: null,
      },
      paymentProcessing: {
        provider: 'wompi',
        approvedTransactionId: '',
        approvedAt: null,
        inventory: { status: 'not_required' },
        invoice: { status: 'scheduled' },
      },
    });
    for (const status of ['generated', 'sent', 'accepted']) {
      assert.equal(
        getCanonicalPaymentApprovalEvidence(order, {
          electronicInvoice: { orderId: order._id, status },
        }).approved,
        false
      );
    }
    assert.equal(isBillableOrder(order), false);
  });

  for (const scenario of [
    {
      name: 'una factura no canonica inicial no oculta una factura valida posterior',
      rows: [
        { orderId: 'invoice-order-1', status: 'failed' },
        { orderId: 'invoice-order-1', status: 'accepted' },
      ],
      expected: 'accepted',
    },
    {
      name: 'una factura valida inicial no depende de una no canonica posterior',
      rows: [
        { orderId: 'invoice-order-1', status: 'generated' },
        { orderId: 'invoice-order-1', status: 'pending' },
      ],
      expected: 'generated',
    },
    {
      name: 'facturas pendientes o fallidas no prueban aprobacion',
      rows: [
        { orderId: 'invoice-order-1', status: 'pending' },
        { orderId: 'invoice-order-1', status: 'processing' },
        { orderId: 'invoice-order-1', status: 'failed' },
      ],
      expected: null,
    },
    {
      name: 'una factura valida de otra orden queda aislada',
      rows: [
        { orderId: 'invoice-order-2', status: 'accepted' },
        { orderId: 'invoice-order-1', status: 'failed' },
      ],
      expected: null,
    },
    {
      name: 'varias facturas validas son evidencia sin depender del orden',
      rows: [
        { orderId: 'invoice-order-1', status: 'sent' },
        { orderId: 'invoice-order-1', status: 'accepted' },
        { orderId: 'invoice-order-1', status: 'generated' },
      ],
      expected: 'sent',
    },
  ]) {
    await check(scenario.name, async () => {
      const session = { id: `session-${scenario.name}` };
      const invoice = await findCanonicalElectronicInvoice({
        ElectronicInvoiceModel: createElectronicInvoiceModel(
          scenario.rows,
          session
        ),
        orderId: 'invoice-order-1',
        session,
      });
      assert.equal(invoice?.status || null, scenario.expected);
    });
  }

  await check('un kardex idempotente compatible valida toda su identidad', async () => {
    const order = legacyOrder();
    const planItem = getLegacyCompensationPlan(order)[0];
    const movement = {
      movementNumber: buildFailureMovementNumber(order, planItem),
      type: 'return_in',
      direction: 'in',
      status: 'posted',
      product: planItem.product,
      variantKey: planItem.variantKey,
      branchTo: planItem.branch,
      quantity: planItem.quantityToRestore,
      reason: 'Compensacion de inventario por pago no aprobado',
      reference: `PAYFAIL:${order.orderNumber}:${planItem.allocationId}`,
      order: order._id,
      orderNumber: order.orderNumber,
      sourceModel: 'InventoryStock',
      sourceId: planItem.inventoryStock,
    };
    assert.equal(movement.movementNumber.length <= 40, true);
    assert.equal(
      assertFailureMovementMatches({
        movement,
        order,
        planItem,
        quantity: planItem.quantityToRestore,
      }),
      true
    );
  });

  await check('el compensador productivo escribe stock y kardex una sola vez', async () => {
    const order = legacyOrder();
    const planItem = getLegacyCompensationPlan(order)[0];
    const session = { id: 'legacy-production-session' };
    const stock = {
      _id: planItem.inventoryStock,
      branch: planItem.branch,
      product: planItem.product,
      variantKey: planItem.variantKey,
      variant: { size: '4', color: 'royalblue', attributes: [] },
      stock: 7,
      reservedStock: 0,
      deletedAt: null,
    };
    const movements = new Map();
    class InventoryMovementModel {
      constructor(data) {
        Object.assign(this, data);
        this._id = `movement-${movements.size + 1}`;
      }

      async save(options) {
        assert.equal(options.session, session);
        movements.set(this.movementNumber, clone(this));
        return this;
      }

      static findOne(filter) {
        return {
          session(activeSession) {
            assert.equal(activeSession, session);
            return {
              lean: async () => movements.get(filter.movementNumber) || null,
            };
          },
        };
      }
    }
    const InventoryStockModel = {
      findById(identifier) {
        assert.equal(String(identifier), String(stock._id));
        return {
          session: async (activeSession) => {
            assert.equal(activeSession, session);
            return stock;
          },
        };
      },
      async findOneAndUpdate(filter, update, options) {
        assert.equal(options.session, session);
        assert.equal(String(filter._id), String(stock._id));
        const quantity = Number(update[0].$set.stock.$add[1]);
        stock.stock += quantity;
        stock.availableStock = stock.stock - stock.reservedStock;
        return stock;
      },
      async updateOne(filter, _update, options) {
        assert.equal(String(filter._id), String(stock._id));
        assert.equal(options.session, session);
        return { matchedCount: 1, modifiedCount: 1 };
      },
    };
    const payload = {
      order,
      planItem,
      session,
      now: new Date('2026-08-04T12:00:00.000Z'),
      InventoryStockModel,
      InventoryMovementModel,
    };
    const first = await restoreLegacyAllocation(payload);
    const second = await restoreLegacyAllocation(payload);
    assert.equal(first.alreadyRestored, false);
    assert.equal(second.alreadyRestored, true);
    assert.equal(stock.stock, 9);
    assert.equal(movements.size, 1);
    const movement = movements.get(buildFailureMovementNumber(order, planItem));
    assertFailureMovementMatches({
      movement,
      order,
      planItem,
      quantity: planItem.quantityToRestore,
    });
  });

  await check('una colision de kardex incompatible aborta la recuperacion', async () => {
    const order = legacyOrder();
    const planItem = getLegacyCompensationPlan(order)[0];
    assert.throws(
      () =>
        assertFailureMovementMatches({
          movement: {
            movementNumber: buildFailureMovementNumber(order, planItem),
            type: 'return_in',
            direction: 'in',
            status: 'posted',
            product: 'otro-producto',
            variantKey: planItem.variantKey,
            branchTo: planItem.branch,
            quantity: planItem.quantityToRestore,
            reason: 'Compensacion de inventario por pago no aprobado',
            reference: `PAYFAIL:${order.orderNumber}:${planItem.allocationId}`,
            order: order._id,
            orderNumber: order.orderNumber,
            sourceModel: 'InventoryStock',
            sourceId: planItem.inventoryStock,
          },
          order,
          planItem,
          quantity: planItem.quantityToRestore,
        }),
      (error) => error.code === 'PAYMENT_FAILURE_MOVEMENT_MISMATCH'
    );
  });

  await check('reconcilia una reserva liberada por este fallo con la misma sesion', async () => {
    const orderId = 'order-reconcile-1';
    const reservation = {
      _id: 'reservation-reconcile-1',
      order: orderId,
      orderNumber: 'ORDER-RECONCILE-1',
      paymentReference: 'ORDER-ORDER-RECONCILE-1__TRY__1',
      paymentTransactionId: 'tx-reconcile-failed-1',
      status: 'failed',
      failedAt: new Date(),
      cancelledAt: null,
      expiredAt: null,
      releasedAt: null,
      confirmedAt: null,
      releaseReason: buildPaymentFailureReleaseReason({
        provider: 'wompi',
        paymentStatus: 'failed',
        orderNumber: 'ORDER-RECONCILE-1',
        paymentReference: 'ORDER-ORDER-RECONCILE-1__TRY__1',
        paymentTransactionId: 'tx-reconcile-failed-1',
      }),
      items: [
        {
          _id: 'reservation-item-1',
          inventoryStock: 'stock-reconcile-1',
          branch: 'branch-a',
          product: 'product-a',
          variantKey: 'm__black',
          quantity: 2,
          releasedAt: new Date(),
          confirmedAt: null,
          saleMovement: null,
        },
      ],
      async save(options) {
        assert.equal(options.session.id, 'session-reconcile');
      },
    };
    const row = { stock: 5, reservedStock: 0, availableStock: 5 };
    const InventoryStockModel = {
      async findOneAndUpdate(filter, update, options) {
        assert.equal(options.session.id, 'session-reconcile');
        assert.equal(filter._id, 'stock-reconcile-1');
        const quantity = update[0].$set.reservedStock.$add[1];
        row.reservedStock += quantity;
        row.availableStock = row.stock - row.reservedStock;
        return row;
      },
    };
    const result = await reconcilePaymentFailureReservation(
      reservation._id,
      {
        order: orderId,
        orderNumber: reservation.orderNumber,
        provider: 'wompi',
        paymentReference: 'ORDER-ORDER-RECONCILE-1__TRY__2',
        paymentTransactionId: 'tx-reconcile-approved-2',
      },
      {
        session: { id: 'session-reconcile' },
        findReservation: async () => reservation,
        InventoryStockModel,
      }
    );
    assert.equal(result.status, 'pending');
    assert.equal(result.failedAt, null);
    assert.equal(result.releaseReason, '');
    assert.equal(result.items[0].releasedAt, null);
    assert.deepEqual(row, { stock: 5, reservedStock: 2, availableStock: 3 });
  });

  for (const scenario of [
    {
      name: 'rechaza reconciliacion de otra orden',
      mutateDetails: (details) => ({ ...details, orderNumber: 'OTHER-ORDER' }),
    },
    {
      name: 'rechaza reconciliacion de otro proveedor',
      mutateDetails: (details) => ({ ...details, provider: 'payu' }),
    },
    {
      name: 'rechaza reconciliacion con referencia de otra compra',
      mutateDetails: (details) => ({
        ...details,
        paymentReference: 'ORDER-OTHER-ORDER__TRY__approved',
      }),
    },
    {
      name: 'rechaza reconciliacion sin identidad de transaccion aprobada',
      mutateDetails: (details) => ({ ...details, paymentTransactionId: '' }),
    },
    {
      name: 'rechaza identidad persistida que no coincide con la liberacion',
      mutateReservation: (reservation) => {
        reservation.paymentTransactionId = 'tx-tampered';
      },
    },
  ]) {
    await check(scenario.name, async () => {
      const orderNumber = 'IDENTITY-ORDER-1';
      const failedReference = `ORDER-${orderNumber}__TRY__failed`;
      const reservation = {
        _id: 'reservation-identity-1',
        order: 'order-identity-1',
        orderNumber,
        paymentReference: failedReference,
        paymentTransactionId: 'tx-failed-identity-1',
        status: 'failed',
        failedAt: new Date(),
        cancelledAt: null,
        expiredAt: null,
        releasedAt: null,
        confirmedAt: null,
        releaseReason: buildPaymentFailureReleaseReason({
          provider: 'wompi',
          paymentStatus: 'failed',
          orderNumber,
          paymentReference: failedReference,
          paymentTransactionId: 'tx-failed-identity-1',
        }),
        items: [],
      };
      scenario.mutateReservation?.(reservation);
      const details = scenario.mutateDetails?.({
        order: reservation.order,
        orderNumber,
        provider: 'wompi',
        paymentReference: `ORDER-${orderNumber}__TRY__approved`,
        paymentTransactionId: 'tx-approved-identity-2',
      }) || {
        order: reservation.order,
        orderNumber,
        provider: 'wompi',
        paymentReference: `ORDER-${orderNumber}__TRY__approved`,
        paymentTransactionId: 'tx-approved-identity-2',
      };
      await assert.rejects(
        reconcilePaymentFailureReservation(reservation._id, details, {
          session: {},
          findReservation: async () => reservation,
          InventoryStockModel: {
            findOneAndUpdate: async () => {
              throw new Error('No debe tocar stock con identidad invalida.');
            },
          },
        }),
        (error) =>
          error.code === 'PAYMENT_FAILURE_RESERVATION_OWNERSHIP_MISMATCH' ||
          error.code === 'PAYMENT_FAILURE_RESERVATION_NOT_RECONCILABLE'
      );
    });
  }

  await check('no reactiva una reserva terminal liberada por otra causa', async () => {
    const reservation = {
      _id: 'reservation-unrelated',
      order: 'order-unrelated',
      orderNumber: 'ORDER-UNRELATED',
      status: 'cancelled',
      releaseReason: 'Cancelada administrativamente',
      items: [],
    };
    await assert.rejects(
      reconcilePaymentFailureReservation(
        reservation._id,
        {
          order: reservation.order,
          orderNumber: reservation.orderNumber,
          provider: 'wompi',
          paymentReference: 'ORDER-ORDER-UNRELATED__TRY__2',
          paymentTransactionId: 'tx-unrelated-approved-2',
        },
        {
          session: {},
          findReservation: async () => reservation,
          InventoryStockModel: { findOneAndUpdate: async () => null },
        }
      ),
      (error) =>
        error.code === 'PAYMENT_FAILURE_RESERVATION_NOT_RECONCILABLE'
    );
  });

  await check('una reserva terminal ajena no se reconoce como recuperacion completada', async () => {
    const order = reservationOrder();
    const service = createPaymentInventoryFailureService({
      releaseReservation: async () => ({
        _id: order.inventoryControl.reservationId,
        status: 'expired',
        releaseReason: 'Reserva vencida antes del fallo de pago',
      }),
      applyReservation: () => {
        throw new Error('No debe aplicar una reserva terminal ajena.');
      },
    });
    await assert.rejects(
      service.process({
        order,
        paymentStatus: 'failed',
        provider: 'wompi',
      }),
      (error) => error.code === 'RESERVATION_RELEASE_EVIDENCE_MISMATCH'
    );
    assert.equal(order.inventoryControl.restockedOnFailure, false);
  });

  await check('el webhook Wompi delega la recuperacion sin modificar stock directamente', async () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'payments.js'),
      'utf8'
    );
    const wompiWebhookStart = source.indexOf("router.post('/wompi/webhook'");
    const payuCheckoutStart = source.indexOf(
      "router.post('/payu/checkout-data'",
      wompiWebhookStart
    );
    assert(wompiWebhookStart >= 0);
    assert(payuCheckoutStart > wompiWebhookStart);
    const wompiWebhookSource = source.slice(wompiWebhookStart, payuCheckoutStart);

    assert(!wompiWebhookSource.includes('Product.inventory'));
    assert(!wompiWebhookSource.includes('product.inventory'));
    assert(!wompiWebhookSource.includes('Product.stock'));
    assert(!wompiWebhookSource.includes('product.stock'));
    assert(!wompiWebhookSource.includes('restockOrderIfNeeded'));
    assert(!wompiWebhookSource.includes('incrementStock'));
    assert(wompiWebhookSource.includes('paymentInventoryFailureService.process'));
    assert(wompiWebhookSource.includes('runPaymentInventoryTransaction'));
  });

  await runMountedRouteControls();

  assert.equal(mongoose.connection.readyState, 0);
  console.log(
    `RESULTADO: ${checks.length}/${checks.length} pruebas aprobadas; MongoDB no conectado.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
