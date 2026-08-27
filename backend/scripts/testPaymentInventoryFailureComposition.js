'use strict';

const assert = require('node:assert/strict');

const facade = require('../services/paymentInventoryFailureService');
const constants = require('../services/paymentInventoryFailure/constants');
const classification = require('../services/paymentInventoryFailure/errorClassification');
const inventoryMode = require('../services/paymentInventoryFailure/inventoryMode');
const compensation = require('../services/paymentInventoryFailure/legacyCompensation');
const reconciliation = require('../services/paymentInventoryFailure/legacyReconciliation');
const movementEvidence = require('../services/paymentInventoryFailure/movementEvidence');
const serviceModule = require('../services/paymentInventoryFailure/service');
const transactionRunner = require('../services/paymentInventoryFailure/transactionRunner');

const checks = [];

async function check(name, callback) {
  await callback();
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function reservationOrder(overrides = {}) {
  return {
    _id: 'order-reservation-failure',
    orderNumber: 'TEST-FAIL-RESERVATION',
    payment: {
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
        quantity: 2,
        reservedQuantity: 2,
        soldQuantity: 0,
        status: 'reserved',
      },
    ],
    ...overrides,
  };
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

async function main() {
  await check('la fachada conserva exactamente el contrato publico previo', async () => {
    assert.deepEqual(Object.keys(facade), [
      'PERMANENT_PAYMENT_INVENTORY_CODES',
      'PAYMENT_INVENTORY_TRANSACTION_MAX_ATTEMPTS',
      'RETRYABLE_PAYMENT_INVENTORY_CODES',
      'asRetryablePaymentInventoryError',
      'assertLegacyCompensationComplete',
      'buildFailureMovementNumber',
      'buildFailureReversalMovementNumber',
      'assertFailureMovementMatches',
      'compensateLegacyDiscountedInventory',
      'createFailureError',
      'createLegacyInventoryCompensationService',
      'createPaymentInventoryFailureService',
      'getLegacyCompensationPlan',
      'hasLegacyDiscountEvidence',
      'hasReservationEvidence',
      'reconcileLegacyFailureCompensation',
      'restoreLegacyAllocation',
      'isRetryablePaymentInventoryError',
      'isPermanentPaymentInventoryError',
      'runPaymentInventoryTransaction',
      'reverseLegacyFailureAllocation',
      'resolveFailureInventoryMode',
    ]);

    const composedExports = {
      ...constants,
      ...classification,
      ...inventoryMode,
      ...compensation,
      ...reconciliation,
      ...movementEvidence,
      ...serviceModule,
      ...transactionRunner,
    };
    for (const [name, value] of Object.entries(facade)) {
      assert.strictEqual(value, composedExports[name], `${name} debe delegarse sin wrapper`);
    }
  });

  await check('los catalogos de errores y el maximo de reintentos no cambiaron', async () => {
    assert.equal(facade.PAYMENT_INVENTORY_TRANSACTION_MAX_ATTEMPTS, 3);
    assert.deepEqual([...facade.RETRYABLE_PAYMENT_INVENTORY_CODES], [
      'INVENTORY_RECOVERY_INCOMPLETE',
      'LEGACY_ALLOCATION_COMPENSATION_FAILED',
      'LEGACY_COMPENSATION_INCOMPLETE',
      'LEGACY_INVENTORY_CONCURRENT_CHANGE',
      'PAYMENT_FAILURE_RECONCILIATION_STOCK_UNAVAILABLE',
      'PAYMENT_FAILURE_RECONCILIATION_CONCURRENT_CHANGE',
      'PAYMENT_FAILURE_LEGACY_RECONCILIATION_INCOMPLETE',
      'PAYMENT_FAILURE_APPROVAL_RECONCILIATION_INCOMPLETE',
      'PAYMENT_FAILURE_RESERVATION_RECONCILIATION_UNAVAILABLE',
      'RESERVED_STOCK_RELEASE_FAILED',
      'RESERVED_STOCK_NOT_AVAILABLE',
      'CONCURRENT_CONFIRMATION_CHANGE',
      'INVENTORY_CONFIRMATION_ERROR',
      'INVENTORY_CONFIRMATION_NOT_READY',
      'INVENTORY_CONFIRMATION_INCONSISTENT',
      'PAYMENT_FAILURE_RECONCILIATION_REQUIRED',
      'PAYMENT_FAILURE_RECONCILIATION_NOT_READY',
      'PAYMENT_FAILURE_RECONCILIATION_INCONSISTENT',
    ]);
    assert.equal(facade.PERMANENT_PAYMENT_INVENTORY_CODES.size, 23);
    assert(facade.PERMANENT_PAYMENT_INVENTORY_CODES.has('UNVERIFIED_PAYMENT_APPROVAL'));
  });

  await check('clasifica causas Mongo y de dominio sin perder la cadena causal', async () => {
    assert(facade.isRetryablePaymentInventoryError({ code: 112 }));
    assert(facade.isRetryablePaymentInventoryError({ codeName: 'WriteConflict' }));
    assert(facade.isRetryablePaymentInventoryError({ errorLabels: ['TransientTransactionError'] }));
    assert(facade.isRetryablePaymentInventoryError({ cause: { statusCode: 503 } }));
    assert(!facade.isRetryablePaymentInventoryError({ code: 'RESERVATION_NOT_FOUND' }));
    assert(facade.isPermanentPaymentInventoryError({ cause: { code: 'RESERVATION_NOT_FOUND' } }));

    const cyclic = {};
    cyclic.cause = cyclic;
    assert.equal(facade.isRetryablePaymentInventoryError(cyclic), false);
    assert.equal(facade.isPermanentPaymentInventoryError(cyclic), false);
  });

  await check('crea errores con los mismos codigos, detalles y estados HTTP', async () => {
    const retryable = facade.createFailureError('retry', 'INVENTORY_RECOVERY_INCOMPLETE', { a: 1 });
    assert.deepEqual(
      {
        message: retryable.message,
        code: retryable.code,
        details: retryable.details,
        retryable: retryable.retryable,
        statusCode: retryable.statusCode,
      },
      {
        message: 'retry',
        code: 'INVENTORY_RECOVERY_INCOMPLETE',
        details: { a: 1 },
        retryable: true,
        statusCode: 503,
      }
    );
    const permanent = facade.createFailureError('stop', 'RESERVATION_NOT_FOUND');
    assert.equal(permanent.retryable, false);
    assert.equal(permanent.statusCode, 409);
  });

  await check('reintenta transacciones en el mismo orden y cierra cada sesion', async () => {
    const trace = [];
    let sessions = 0;
    const result = await facade.runPaymentInventoryTransaction({
      startSession: async () => {
        sessions += 1;
        const id = sessions;
        trace.push(`start:${id}`);
        return {
          async withTransaction(work) {
            trace.push(`transaction:${id}`);
            await work();
          },
          async endSession() {
            trace.push(`end:${id}`);
          },
        };
      },
      work: async (_session, context) => {
        trace.push(`work:${context.attempt}/${context.maxAttempts}`);
        if (context.attempt === 1) throw Object.assign(new Error('conflict'), { code: 112 });
        return 'completed';
      },
    });
    assert.equal(result, 'completed');
    assert.deepEqual(trace, [
      'start:1',
      'transaction:1',
      'work:1/3',
      'end:1',
      'start:2',
      'transaction:2',
      'work:2/3',
      'end:2',
    ]);
  });

  await check('un error permanente no se reintenta y siempre cierra la sesion', async () => {
    let starts = 0;
    let ends = 0;
    const failure = Object.assign(new Error('permanent'), { code: 'RESERVATION_NOT_FOUND' });
    await assert.rejects(
      facade.runPaymentInventoryTransaction({
        startSession: async () => {
          starts += 1;
          return {
            withTransaction: async (work) => work(),
            endSession: async () => { ends += 1; },
          };
        },
        work: async () => { throw failure; },
      }),
      (error) => error === failure
    );
    assert.equal(starts, 1);
    assert.equal(ends, 1);
  });

  await check('resuelve sin ambiguedad los cuatro modos de recuperacion', async () => {
    assert.equal(facade.resolveFailureInventoryMode({ inventoryControl: { restockedOnFailure: true } }), 'completed');
    assert.equal(facade.resolveFailureInventoryMode(legacyOrder()), 'legacy_compensation');
    assert.equal(facade.resolveFailureInventoryMode({ inventoryControl: { reservationRequired: false }, inventoryAllocations: [] }), 'none');
    assert.equal(facade.resolveFailureInventoryMode(reservationOrder()), 'release_reservation');
    assert.equal(facade.resolveFailureInventoryMode({ inventoryControl: { reservationRequired: true }, inventoryAllocations: [] }), 'incomplete');
  });

  await check('el plan heredado conserva identidad, cantidades y errores publicos', async () => {
    const plan = facade.getLegacyCompensationPlan(legacyOrder());
    assert.equal(plan.length, 2);
    assert.deepEqual(
      plan.map(({ allocationId, inventoryStock, branch, product, variantKey, soldQuantity, returnedQuantity, quantityToRestore }) => ({
        allocationId,
        inventoryStock,
        branch,
        product,
        variantKey,
        soldQuantity,
        returnedQuantity,
        quantityToRestore,
      })),
      [
        { allocationId: 'allocation-a', inventoryStock: 'stock-a', branch: 'branch-a', product: 'product-dress', variantKey: '4__royalblue', soldQuantity: 2, returnedQuantity: 0, quantityToRestore: 2 },
        { allocationId: 'allocation-b', inventoryStock: 'stock-b', branch: 'branch-b', product: 'product-dress', variantKey: '4__royalblue', soldQuantity: 1, returnedQuantity: 0, quantityToRestore: 1 },
      ]
    );
    assert.throws(
      () => facade.getLegacyCompensationPlan({ orderNumber: 'EMPTY', inventoryAllocations: [] }),
      (error) => error.code === 'LEGACY_INVENTORY_ALLOCATIONS_REQUIRED'
    );
  });

  await check('los identificadores idempotentes de kardex permanecen estables', async () => {
    const order = { _id: 'order-123', orderNumber: 'ORD-000123' };
    const planItem = { allocationId: 'allocation-a', inventoryStock: 'stock-a', branch: 'branch-a', product: 'product-a', variantKey: 'm__black' };
    assert.equal(facade.buildFailureMovementNumber(order, planItem), 'IM-PF-15AA0D852412FA5951589D11');
    assert.equal(facade.buildFailureReversalMovementNumber(order, planItem), 'IM-PFA-DFA3DCE016B8D058FDBA05F');
  });

  await check('el compensador conserva restaurar, aplicar y sincronizar como secuencia atomica', async () => {
    const order = legacyOrder();
    const trace = [];
    const compensate = facade.createLegacyInventoryCompensationService({
      restoreAllocation: async ({ planItem }) => {
        trace.push(`restore:${planItem.allocationId}`);
        return { completed: true };
      },
      applyReturns: (target, restorations) => {
        trace.push(`apply:${restorations.length}`);
        for (const item of target.inventoryAllocations) item.returnedQuantity = item.soldQuantity;
      },
      syncProducts: async (productIds) => {
        trace.push(`sync:${productIds.join(',')}`);
      },
      now: () => new Date('2026-08-27T12:00:00.000Z'),
    });
    const result = await compensate({ order, session: { id: 'session-1' } });
    assert.equal(result.completed, true);
    assert.deepEqual(trace, [
      'restore:allocation-a',
      'restore:allocation-b',
      'apply:2',
      'sync:product-dress',
    ]);
  });

  await check('process conserva DI, argumentos, mutaciones y evidencia de liberacion', async () => {
    const order = reservationOrder();
    const session = { id: 'session-1' };
    const calls = [];
    const completedAt = new Date('2026-08-27T12:30:00.000Z');
    const service = facade.createPaymentInventoryFailureService({
      releaseReservation: async (...args) => {
        calls.push(['release', ...args]);
        return { _id: 'reservation-1', status: 'failed', releaseReason: 'reason' };
      },
      applyReservation: (...args) => calls.push(['apply', ...args]),
      buildReleaseReason: (payload) => {
        calls.push(['reason', payload]);
        return 'reason';
      },
      now: () => completedAt,
    });
    const result = await service.process({
      order,
      paymentStatus: ' FAILED ',
      provider: 'wompi',
      paymentReference: 'reference-1',
      paymentTransactionId: 'transaction-1',
      session,
    });
    assert.equal(result.action, 'release_reservation');
    assert.strictEqual(result.completedAt, completedAt);
    assert.deepEqual(calls[0], ['reason', {
      provider: 'wompi',
      paymentStatus: 'failed',
      orderNumber: 'TEST-FAIL-RESERVATION',
      paymentReference: 'reference-1',
      paymentTransactionId: 'transaction-1',
    }]);
    assert.deepEqual(calls[1].slice(0, 3), [
      'release',
      'reservation-1',
      {
        status: 'failed',
        releaseReason: 'reason',
        paymentReference: 'reference-1',
        paymentTransactionId: 'transaction-1',
      },
    ]);
    assert.deepEqual(calls[1][3], { session, syncOrderAllocations: false });
    assert.equal(calls[2][0], 'apply');
    assert.equal(order.inventoryControl.restockedOnFailure, true);
    assert.equal(order.inventoryControl.discountedAtCheckout, false);
    assert.strictEqual(order.inventoryControl.restockedAt, completedAt);
  });

  await check('process conserva rutas ignorada, aprobada, incompleta, sin inventario y heredada', async () => {
    const baseDependencies = {
      releaseReservation: async () => { throw new Error('no esperado'); },
      applyReservation: () => { throw new Error('no esperado'); },
    };
    const ignored = await facade.createPaymentInventoryFailureService(baseDependencies).process({
      order: {}, paymentStatus: 'pending',
    });
    assert.deepEqual(ignored, { completed: false, ignored: true, action: 'ignored' });

    const approved = await facade.createPaymentInventoryFailureService({
      ...baseDependencies,
      isApprovedPayment: () => true,
    }).process({ order: {}, paymentStatus: 'failed' });
    assert.equal(approved.action, 'approved_is_terminal');

    await assert.rejects(
      facade.createPaymentInventoryFailureService(baseDependencies).process({
        order: { orderNumber: 'INCOMPLETE', inventoryControl: { reservationRequired: true }, inventoryAllocations: [] },
        paymentStatus: 'failed',
      }),
      (error) => error.code === 'INVENTORY_RECOVERY_INCOMPLETE' && error.statusCode === 503
    );

    const noInventoryOrder = { inventoryControl: { reservationRequired: false }, inventoryAllocations: [] };
    const noInventory = await facade.createPaymentInventoryFailureService(baseDependencies).process({ order: noInventoryOrder, paymentStatus: 'failed' });
    assert.equal(noInventory.action, 'none');

    const oldOrder = legacyOrder();
    const legacy = await facade.createPaymentInventoryFailureService({
      ...baseDependencies,
      compensateLegacyInventory: async ({ order }) => {
        assert.strictEqual(order, oldOrder);
        return { completed: true, marker: 'legacy' };
      },
    }).process({ order: oldOrder, paymentStatus: 'cancelled' });
    assert.equal(legacy.action, 'legacy_compensation');
    assert.equal(legacy.compensation.marker, 'legacy');
  });

  await check('reconcileApproved conserva las cuatro decisiones y la misma sesion', async () => {
    const session = { id: 'session-reconcile' };
    const calls = [];
    const service = facade.createPaymentInventoryFailureService({
      releaseReservation: async () => ({}),
      applyReservation: () => {},
      reconcileReservation: async (...args) => {
        calls.push(args);
        return { _id: 'reservation-1', status: 'confirmed' };
      },
    });
    const notNeeded = await service.reconcileApproved({ order: { inventoryControl: {} } });
    assert.deepEqual(notNeeded, { completed: true, needed: false, action: 'not_needed' });

    const order = reservationOrder();
    order.inventoryControl.restockedOnFailure = true;
    const reservation = await service.reconcileApproved({
      order,
      provider: 'payu',
      paymentReference: 'ref',
      paymentTransactionId: 'tx',
      session,
    });
    assert.equal(reservation.action, 'reconcile_reservation');
    assert.deepEqual(calls[0][2], { session, syncOrderAllocations: false });

    const noInventoryOrder = {
      inventoryControl: {
        reservationRequired: false,
        restockedOnFailure: true,
        restockedAt: new Date(),
      },
      inventoryAllocations: [],
    };
    const noInventory = await service.reconcileApproved({ order: noInventoryOrder });
    assert.equal(noInventory.action, 'reconcile_not_required');
    assert.equal(noInventoryOrder.inventoryControl.restockedOnFailure, false);
    assert.equal(noInventoryOrder.inventoryControl.restockedAt, null);
  });

  await check('reconcileApproved restaura el estado legado solo despues de una reconciliacion completa', async () => {
    const order = legacyOrder();
    order.inventoryControl.restockedOnFailure = true;
    order.inventoryControl.restockedAt = new Date('2026-08-01T00:00:00.000Z');
    const service = facade.createPaymentInventoryFailureService({
      releaseReservation: async () => ({}),
      applyReservation: () => {},
      reconcileLegacyInventory: async ({ order: received }) => {
        assert.strictEqual(received, order);
        return { completed: true, marker: 'reconciled' };
      },
    });
    const result = await service.reconcileApproved({ order });
    assert.equal(result.action, 'reconcile_legacy_compensation');
    assert.equal(result.reconciliation.marker, 'reconciled');
    assert.equal(order.inventoryControl.discountedAtCheckout, true);
    assert.equal(order.inventoryControl.restockedOnFailure, false);
    assert.equal(order.inventoryControl.restockedAt, null);
  });

  await check('las dependencias obligatorias y fallos de evidencia conservan sus mensajes', async () => {
    assert.throws(
      () => facade.createPaymentInventoryFailureService(),
      /releaseReservation es obligatorio\./
    );
    assert.throws(
      () => facade.createPaymentInventoryFailureService({ releaseReservation: async () => {} }),
      /applyReservation es obligatorio\./
    );
    assert.throws(
      () => facade.createLegacyInventoryCompensationService(),
      /restoreAllocation es obligatorio\./
    );
    await assert.rejects(
      facade.runPaymentInventoryTransaction(),
      /startSession y work son obligatorios\./
    );
  });

  console.log(`RESULTADO: ${checks.length}/${checks.length} controles de composicion y paridad aprobados.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
