'use strict';

const crypto = require('crypto');

const {
  canonicalizeVariantKey,
  resolveVariantIdentity,
} = require('../../shared/variantKeyAuthority.cjs');
const RETRYABLE_PAYMENT_INVENTORY_CODES = new Set([
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
const RETRYABLE_MONGO_CODES = new Set([6, 7, 50, 89, 91, 112, 189, 251, 262, 9001]);
const RETRYABLE_MONGO_LABELS = new Set([
  'TransientTransactionError',
  'UnknownTransactionCommitResult',
]);
const PERMANENT_PAYMENT_INVENTORY_CODES = new Set([
  'INVALID_PAYMENT_FAILURE_RELEASE_STATUS',
  'PAYMENT_FAILURE_RELEASE_IDENTITY_REQUIRED',
  'PAYMENT_FAILURE_MOVEMENT_MISMATCH',
  'PAYMENT_FAILURE_RESERVATION_OWNERSHIP_MISMATCH',
  'PAYMENT_FAILURE_RESERVATION_NOT_RECONCILABLE',
  'PAYMENT_FAILURE_RESERVATION_TERMINAL_EVIDENCE',
  'PAYMENT_FAILURE_RESERVATION_ITEM_INVALID',
  'PAYMENT_FAILURE_RESERVATION_RECONCILER_REQUIRED',
  'LEGACY_INVENTORY_ALLOCATIONS_REQUIRED',
  'LEGACY_ALLOCATION_INCOMPLETE',
  'LEGACY_DISCOUNT_EVIDENCE_MISSING',
  'LEGACY_INVENTORY_STOCK_NOT_FOUND',
  'LEGACY_INVENTORY_ALLOCATION_MISMATCH',
  'PAYMENT_FAILURE_COMPENSATION_MOVEMENT_MISSING',
  'PAYMENT_FAILURE_COMPENSATION_QUANTITY_MISMATCH',
  'PAYMENT_FAILURE_RECONCILIATION_STOCK_MISSING',
  'PAYMENT_FAILURE_RECONCILIATION_STOCK_MISMATCH',
  'PAYMENT_FAILURE_RECONCILIATION_ALLOCATION_MISMATCH',
  'CONFIRMED_RESERVATION_CANNOT_BE_RELEASED',
  'RESERVATION_RELEASE_EVIDENCE_MISMATCH',
  'RESERVATION_EXPIRED',
  'RESERVATION_NOT_FOUND',
  'UNVERIFIED_PAYMENT_APPROVAL',
]);
const PAYMENT_INVENTORY_TRANSACTION_MAX_ATTEMPTS = 3;

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function getPaymentFailureReleaseReason(payload) {
  return require('./inventoryReservationService').buildPaymentFailureReleaseReason(
    payload
  );
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function toQuantity(value) {
  const quantity = Math.floor(Number(value || 0));
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
}

function getErrorLabels(error) {
  const labels = new Set();
  for (const label of Array.isArray(error?.errorLabels) ? error.errorLabels : []) {
    labels.add(String(label));
  }
  for (const label of RETRYABLE_MONGO_LABELS) {
    if (error?.hasErrorLabel?.(label) === true) labels.add(label);
  }
  return labels;
}

function isRetryablePaymentInventoryError(error, visited = new Set()) {
  if (!error || visited.has(error)) return false;
  if (typeof error === 'object') visited.add(error);
  if (error.retryable === true || Number(error.statusCode || 0) === 503) return true;

  const code = String(error.code || '').trim();
  const codeName = String(error.codeName || '').trim();
  if (RETRYABLE_PAYMENT_INVENTORY_CODES.has(code)) return true;
  if (RETRYABLE_MONGO_CODES.has(Number(error.code))) return true;
  if (codeName === 'WriteConflict' || code === 'WriteConflict') return true;
  if ([...getErrorLabels(error)].some((label) => RETRYABLE_MONGO_LABELS.has(label))) {
    return true;
  }
  return isRetryablePaymentInventoryError(error.cause, visited);
}

function isPermanentPaymentInventoryError(error, visited = new Set()) {
  if (!error || visited.has(error)) return false;
  if (typeof error === 'object') visited.add(error);
  if (PERMANENT_PAYMENT_INVENTORY_CODES.has(String(error.code || '').trim())) {
    return true;
  }
  return isPermanentPaymentInventoryError(error.cause, visited);
}

function asRetryablePaymentInventoryError(
  error,
  fallbackCode = 'PAYMENT_INVENTORY_RECOVERY_RETRYABLE'
) {
  const failure = error instanceof Error ? error : new Error(String(error || ''));
  if (!failure.code) failure.code = fallbackCode;
  failure.retryable = true;
  failure.statusCode = 503;
  return failure;
}

function createFailureError(
  message,
  code,
  details = {},
  { retryable = RETRYABLE_PAYMENT_INVENTORY_CODES.has(code), cause = null } = {}
) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.retryable = retryable === true;
  error.statusCode = retryable === true ? 503 : 409;
  if (cause) error.cause = cause;
  return error;
}

async function runPaymentInventoryTransaction({
  startSession,
  work,
  maxAttempts = PAYMENT_INVENTORY_TRANSACTION_MAX_ATTEMPTS,
} = {}) {
  if (typeof startSession !== 'function' || typeof work !== 'function') {
    throw new TypeError('startSession y work son obligatorios.');
  }
  const safeMaxAttempts = Math.max(1, Math.min(5, Number(maxAttempts) || 1));
  let lastError = null;

  for (let attempt = 1; attempt <= safeMaxAttempts; attempt += 1) {
    const session = await startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session, { attempt, maxAttempts: safeMaxAttempts });
      });
      return result;
    } catch (error) {
      lastError = error;
      if (!isRetryablePaymentInventoryError(error)) throw error;
      if (attempt >= safeMaxAttempts) {
        throw asRetryablePaymentInventoryError(error);
      }
    } finally {
      await session.endSession();
    }
  }

  throw asRetryablePaymentInventoryError(lastError);
}

function hasLegacyDiscountEvidence(order = {}) {
  const allocations = Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : [];

  return allocations.some((allocation) => toQuantity(allocation?.soldQuantity) > 0);
}

function hasReservationEvidence(order = {}) {
  const allocations = Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : [];

  return allocations.some((allocation) => {
    const status = cleanText(allocation?.status, 40).toLowerCase();
    return (
      toQuantity(allocation?.reservedQuantity) > 0 ||
      ['reserved', 'confirmed'].includes(status)
    );
  });
}

function resolveFailureInventoryMode(order = {}) {
  const control = order.inventoryControl || {};

  if (control.restockedOnFailure === true) return 'completed';
  if (hasLegacyDiscountEvidence(order)) {
    return 'legacy_compensation';
  }
  if (
    control.reservationRequired === false &&
    !hasReservationEvidence(order)
  ) {
    return 'none';
  }
  if (control.reservationId) return 'release_reservation';
  return 'incomplete';
}

function getLegacyCompensationPlan(order = {}) {
  const allocations = Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : [];

  if (!allocations.length) {
    throw createFailureError(
      'La orden heredada figura descontada, pero no conserva asignaciones por sede.',
      'LEGACY_INVENTORY_ALLOCATIONS_REQUIRED',
      { orderNumber: cleanText(order.orderNumber, 40) }
    );
  }

  const plan = allocations.map((allocation, index) => {
    const quantity = toQuantity(allocation.quantity);
    const soldQuantity = Math.min(
      quantity,
      toQuantity(allocation.soldQuantity)
    );
    const returnedQuantity = Math.min(
      soldQuantity,
      toQuantity(allocation.returnedQuantity)
    );
    const identity = resolveVariantIdentity({
      variantKey: allocation.variantKey,
      size: allocation.size,
      color: allocation.color,
      attributes: allocation.variantAttributes || [],
    });

    if (
      !allocation.inventoryStock ||
      !allocation.branch ||
      !allocation.product
    ) {
      throw createFailureError(
        'Una asignacion heredada no identifica inventario, sede y producto.',
        'LEGACY_ALLOCATION_INCOMPLETE',
        { index, allocationId: idValue(allocation._id) }
      );
    }

    return {
      allocation,
      allocationId: idValue(allocation._id),
      inventoryStock: allocation.inventoryStock,
      branch: allocation.branch,
      product: allocation.product,
      variantKey: identity.variantKey,
      variantIdentity: identity,
      soldQuantity,
      returnedQuantity,
      quantityToRestore: Math.max(0, soldQuantity - returnedQuantity),
    };
  });

  const soldTotal = plan.reduce(
    (sum, item) => sum + item.soldQuantity,
    0
  );

  if (!soldTotal) {
    throw createFailureError(
      'No existe evidencia por asignacion de stock fisico descontado.',
      'LEGACY_DISCOUNT_EVIDENCE_MISSING',
      { orderNumber: cleanText(order.orderNumber, 40) }
    );
  }

  return plan;
}

function buildFailureMovementNumber(order, planItem) {
  const raw = [
    idValue(order?._id),
    cleanText(order?.orderNumber, 40),
    planItem.allocationId,
    idValue(planItem.inventoryStock),
    idValue(planItem.branch),
    idValue(planItem.product),
    planItem.variantKey,
  ].join('|');
  const digest = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
  return `IM-PF-${digest}`.toUpperCase();
}

function buildFailureReversalMovementNumber(order, planItem) {
  const raw = [
    'approval-reversal',
    idValue(order?._id),
    cleanText(order?.orderNumber, 40),
    planItem.allocationId,
    idValue(planItem.inventoryStock),
    idValue(planItem.branch),
    idValue(planItem.product),
    planItem.variantKey,
  ].join('|');
  const digest = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 23);
  return `IM-PFA-${digest}`.toUpperCase();
}

function buildFailureMovementReference(order, planItem, prefix = 'PAYFAIL') {
  return [
    prefix,
    cleanText(order?.orderNumber, 40),
    planItem.allocationId,
  ].join(':').slice(0, 120);
}

function assertFailureMovementMatches({
  movement,
  order,
  planItem,
  quantity,
  reversal = false,
} = {}) {
  const expectedType = reversal ? 'adjustment_out' : 'return_in';
  const expectedDirection = reversal ? 'out' : 'in';
  const expectedReference = buildFailureMovementReference(
    order,
    planItem,
    reversal ? 'PAYFAIL-UNDO' : 'PAYFAIL'
  );
  const expectedReason = reversal
    ? 'Reversion de compensacion por aprobacion verificada'
    : 'Compensacion de inventario por pago no aprobado';
  const actualBranch = reversal ? movement?.branchFrom : movement?.branchTo;
  const mismatches = {
    order: idValue(movement?.order) !== idValue(order?._id),
    orderNumber:
      cleanText(movement?.orderNumber, 40) !== cleanText(order?.orderNumber, 40),
    branch: idValue(actualBranch) !== idValue(planItem?.branch),
    product: idValue(movement?.product) !== idValue(planItem?.product),
    variant:
      canonicalizeVariantKey(movement?.variantKey) !== planItem?.variantKey,
    inventoryStock:
      cleanText(movement?.sourceModel, 80) !== 'InventoryStock' ||
      idValue(movement?.sourceId) !== idValue(planItem?.inventoryStock),
    allocation: cleanText(movement?.reference, 120) !== expectedReference,
    type: cleanText(movement?.type, 40).toLowerCase() !== expectedType,
    direction:
      cleanText(movement?.direction, 40).toLowerCase() !== expectedDirection,
    status: cleanText(movement?.status, 40).toLowerCase() !== 'posted',
    quantity: toQuantity(movement?.quantity) !== toQuantity(quantity),
    purpose: cleanText(movement?.reason, 240) !== expectedReason,
  };
  const invalidFields = Object.entries(mismatches)
    .filter(([, invalid]) => invalid)
    .map(([field]) => field);

  if (invalidFields.length) {
    throw createFailureError(
      'El movimiento idempotente existente no coincide con la compensacion esperada.',
      'PAYMENT_FAILURE_MOVEMENT_MISMATCH',
      {
        movementNumber: cleanText(movement?.movementNumber, 40),
        invalidFields,
      }
    );
  }
  return true;
}

function allocationMatchesPlan(allocation, planItem) {
  if (planItem.allocationId && idValue(allocation?._id) === planItem.allocationId) {
    return true;
  }
  return (
    idValue(allocation?.inventoryStock) === idValue(planItem.inventoryStock) &&
    idValue(allocation?.branch) === idValue(planItem.branch) &&
    idValue(allocation?.product) === idValue(planItem.product) &&
    canonicalizeVariantKey(allocation?.variantKey) === planItem.variantKey
  );
}

function assertLegacyCompensationComplete(order, plan) {
  const allocations = Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : [];

  for (const planItem of plan) {
    const allocation = allocations.find((candidate) =>
      allocationMatchesPlan(candidate, planItem)
    );
    if (
      !allocation ||
      toQuantity(allocation.returnedQuantity) < planItem.soldQuantity
    ) {
      throw createFailureError(
        'La compensacion heredada no quedo completa en todas las asignaciones.',
        'LEGACY_COMPENSATION_INCOMPLETE',
        {
          allocationId: planItem.allocationId,
          inventoryStock: idValue(planItem.inventoryStock),
          expected: planItem.soldQuantity,
          returned: toQuantity(allocation?.returnedQuantity),
        }
      );
    }
  }
}

function createLegacyInventoryCompensationService({
  restoreAllocation,
  applyReturns = null,
  syncProducts = async () => {},
  now = () => new Date(),
} = {}) {
  if (typeof restoreAllocation !== 'function') {
    throw new TypeError('restoreAllocation es obligatorio.');
  }

  return async function compensateLegacyInventory({ order, session } = {}) {
    const plan = getLegacyCompensationPlan(order);
    const restorations = [];
    const productIds = new Set();

    for (const planItem of plan) {
      if (!planItem.quantityToRestore) continue;
      const result = await restoreAllocation({
        order,
        planItem,
        session,
        now: now(),
      });
      if (!result || result.completed !== true) {
        throw createFailureError(
          'No se completo una asignacion de la compensacion heredada.',
          'LEGACY_ALLOCATION_COMPENSATION_FAILED',
          {
            allocationId: planItem.allocationId,
            inventoryStock: idValue(planItem.inventoryStock),
          }
        );
      }
      restorations.push({
        reservationItem: planItem.allocation.reservationItem || null,
        inventoryStock: planItem.inventoryStock,
        product: planItem.product,
        branch: planItem.branch,
        variantKey: planItem.variantKey,
        quantity: planItem.quantityToRestore,
      });
      productIds.add(idValue(planItem.product));
    }

    if (restorations.length) {
      const applyReturnsToAllocations =
        typeof applyReturns === 'function'
          ? applyReturns
          : require('./orderInventoryAllocationService')
              .applyReturnsToOrderInventoryAllocations;
      applyReturnsToAllocations(order, restorations, now());
    }
    assertLegacyCompensationComplete(order, plan);
    await syncProducts(Array.from(productIds), session);

    return {
      completed: true,
      plan,
      restorations,
    };
  };
}

async function restoreLegacyAllocation({
  order,
  planItem,
  session,
  now,
  InventoryStockModel = null,
  InventoryMovementModel = null,
}) {
  const InventoryStock =
    InventoryStockModel || require('../models/InventoryStock');
  const InventoryMovement =
    InventoryMovementModel || require('../models/InventoryMovement');
  const stock = await InventoryStock.findById(planItem.inventoryStock).session(
    session
  );
  if (!stock || stock.deletedAt) {
    throw createFailureError(
      'La fila original de inventario ya no esta disponible.',
      'LEGACY_INVENTORY_STOCK_NOT_FOUND',
      { inventoryStock: idValue(planItem.inventoryStock) }
    );
  }

  const stockIdentity = resolveVariantIdentity({
    variantKey: stock.variantKey,
    size: stock.variant?.size,
    color: stock.variant?.color,
    attributes: stock.variant?.attributes || [],
  });
  const sameAllocation =
    idValue(stock.branch) === idValue(planItem.branch) &&
    idValue(stock.product) === idValue(planItem.product) &&
    canonicalizeVariantKey(stockIdentity.variantKey) === planItem.variantKey;

  if (!sameAllocation) {
    throw createFailureError(
      'La fila original no coincide con sede, producto y variante de la asignacion.',
      'LEGACY_INVENTORY_ALLOCATION_MISMATCH',
      {
        inventoryStock: idValue(stock._id),
        expectedBranch: idValue(planItem.branch),
        actualBranch: idValue(stock.branch),
        expectedVariantKey: planItem.variantKey,
        actualVariantKey: stockIdentity.variantKey,
      }
    );
  }

  const movementNumber = buildFailureMovementNumber(order, planItem);
  const existingMovement = await InventoryMovement.findOne({
    movementNumber,
  })
    .session(session)
    .lean();

  if (existingMovement) {
    assertFailureMovementMatches({
      movement: existingMovement,
      order,
      planItem,
      quantity: planItem.quantityToRestore,
    });
    return {
      completed: true,
      alreadyRestored: true,
      movement: existingMovement,
    };
  }

  const quantity = planItem.quantityToRestore;
  const before = toQuantity(stock.stock);
  const after = before + quantity;
  const updatedStock = await InventoryStock.findOneAndUpdate(
    {
      _id: stock._id,
      branch: planItem.branch,
      product: planItem.product,
      deletedAt: null,
    },
    [
      {
        $set: {
          stock: { $add: ['$stock', quantity] },
        },
      },
      {
        $set: {
          availableStock: {
            $max: [
              0,
              {
                $subtract: [
                  '$stock',
                  { $ifNull: ['$reservedStock', 0] },
                ],
              },
            ],
          },
          lastMovementAt: now,
        },
      },
    ],
    { new: true, session, runValidators: false }
  );

  if (!updatedStock) {
    throw createFailureError(
      'La fila original cambio mientras se compensaba el pago fallido.',
      'LEGACY_INVENTORY_CONCURRENT_CHANGE',
      { inventoryStock: idValue(stock._id) }
    );
  }

  const movement = new InventoryMovement({
    movementNumber,
    type: 'return_in',
    direction: 'in',
    status: 'posted',
    product: planItem.product,
    productSnapshot: planItem.allocation.productSnapshot || stock.productSnapshot || {},
    variant: {
      size: stockIdentity.size,
      color: stockIdentity.color,
      label: planItem.allocation.variantLabel || stock.variant?.label || '',
      attributes: stockIdentity.attributes,
      sku: stock.variant?.sku || '',
      barcode: stock.variant?.barcode || '',
    },
    variantKey: stockIdentity.variantKey,
    branchTo: planItem.branch,
    branchToSnapshot:
      planItem.allocation.branchSnapshot || stock.branchSnapshot || {},
    quantity,
    stockTo: { before, quantity, after },
    reason: 'Compensacion de inventario por pago no aprobado',
    notes: `Reposicion transaccional de la orden ${cleanText(order.orderNumber, 40)}.`,
    reference: buildFailureMovementReference(order, planItem),
    order: order._id,
    orderNumber: cleanText(order.orderNumber, 40),
    sourceModel: 'InventoryStock',
    sourceId: planItem.inventoryStock,
    postedAt: now,
  });
  await movement.save({ session });

  await InventoryStock.updateOne(
    { _id: stock._id },
    { $set: { lastMovement: movement._id, lastMovementAt: now } },
    { session }
  );

  return {
    completed: true,
    alreadyRestored: false,
    movement,
  };
}

async function reverseLegacyFailureAllocation({ order, planItem, session, now }) {
  const InventoryStock = require('../models/InventoryStock');
  const InventoryMovement = require('../models/InventoryMovement');
  const originalMovementNumber = buildFailureMovementNumber(order, planItem);
  const originalMovement = await InventoryMovement.findOne({
    movementNumber: originalMovementNumber,
  })
    .session(session)
    .lean();

  if (!originalMovement) {
    throw createFailureError(
      'No existe el movimiento que sustenta la compensacion heredada.',
      'PAYMENT_FAILURE_COMPENSATION_MOVEMENT_MISSING',
      { movementNumber: originalMovementNumber }
    );
  }

  const quantity = toQuantity(originalMovement.quantity);
  if (
    quantity <= 0 ||
    quantity > toQuantity(planItem.allocation?.returnedQuantity) ||
    quantity > planItem.soldQuantity
  ) {
    throw createFailureError(
      'La cantidad compensada no coincide con la asignacion heredada.',
      'PAYMENT_FAILURE_COMPENSATION_QUANTITY_MISMATCH',
      {
        movementNumber: originalMovementNumber,
        quantity,
        returnedQuantity: toQuantity(planItem.allocation?.returnedQuantity),
        soldQuantity: planItem.soldQuantity,
      }
    );
  }
  assertFailureMovementMatches({
    movement: originalMovement,
    order,
    planItem,
    quantity,
  });

  const reversalMovementNumber = buildFailureReversalMovementNumber(
    order,
    planItem
  );
  const existingReversal = await InventoryMovement.findOne({
    movementNumber: reversalMovementNumber,
  })
    .session(session)
    .lean();
  if (existingReversal) {
    assertFailureMovementMatches({
      movement: existingReversal,
      order,
      planItem,
      quantity,
      reversal: true,
    });
    return { completed: true, alreadyReversed: true, quantity };
  }

  const stock = await InventoryStock.findById(planItem.inventoryStock).session(
    session
  );
  if (!stock || stock.deletedAt) {
    throw createFailureError(
      'La fila compensada no esta disponible para reconciliar la aprobacion.',
      'PAYMENT_FAILURE_RECONCILIATION_STOCK_MISSING',
      { inventoryStock: idValue(planItem.inventoryStock) }
    );
  }
  const stockIdentity = resolveVariantIdentity({
    variantKey: stock.variantKey,
    size: stock.variant?.size,
    color: stock.variant?.color,
    attributes: stock.variant?.attributes || [],
  });
  if (
    idValue(stock.branch) !== idValue(planItem.branch) ||
    idValue(stock.product) !== idValue(planItem.product) ||
    canonicalizeVariantKey(stockIdentity.variantKey) !== planItem.variantKey
  ) {
    throw createFailureError(
      'La fila compensada no coincide con la asignacion que debe reconciliarse.',
      'PAYMENT_FAILURE_RECONCILIATION_STOCK_MISMATCH',
      { inventoryStock: idValue(planItem.inventoryStock) }
    );
  }

  const before = toQuantity(stock.stock);
  if (before < quantity) {
    throw createFailureError(
      'El stock compensado ya no esta disponible para reconciliar la aprobacion.',
      'PAYMENT_FAILURE_RECONCILIATION_STOCK_UNAVAILABLE',
      { inventoryStock: idValue(stock._id), quantity, stock: before }
    );
  }
  const after = before - quantity;
  const updatedStock = await InventoryStock.findOneAndUpdate(
    {
      _id: stock._id,
      branch: planItem.branch,
      product: planItem.product,
      variantKey: planItem.variantKey,
      deletedAt: null,
      stock: { $gte: quantity },
    },
    [
      { $set: { stock: { $subtract: ['$stock', quantity] } } },
      {
        $set: {
          availableStock: {
            $max: [
              0,
              {
                $subtract: [
                  '$stock',
                  { $ifNull: ['$reservedStock', 0] },
                ],
              },
            ],
          },
          lastMovementAt: now,
        },
      },
    ],
    { new: true, session, runValidators: false }
  );
  if (!updatedStock) {
    throw createFailureError(
      'La fila compensada cambio durante la reconciliacion de la aprobacion.',
      'PAYMENT_FAILURE_RECONCILIATION_CONCURRENT_CHANGE',
      { inventoryStock: idValue(stock._id) }
    );
  }

  const movement = new InventoryMovement({
    movementNumber: reversalMovementNumber,
    type: 'adjustment_out',
    direction: 'out',
    status: 'posted',
    product: planItem.product,
    productSnapshot:
      planItem.allocation.productSnapshot || stock.productSnapshot || {},
    variant: {
      size: stockIdentity.size,
      color: stockIdentity.color,
      label: planItem.allocation.variantLabel || stock.variant?.label || '',
      attributes: stockIdentity.attributes,
      sku: stock.variant?.sku || '',
      barcode: stock.variant?.barcode || '',
    },
    variantKey: stockIdentity.variantKey,
    branchFrom: planItem.branch,
    branchFromSnapshot:
      planItem.allocation.branchSnapshot || stock.branchSnapshot || {},
    quantity,
    stockFrom: { before, quantity, after },
    reason: 'Reversion de compensacion por aprobacion verificada',
    notes: `Reconciliacion transaccional de la orden ${cleanText(order.orderNumber, 40)}.`,
    reference: buildFailureMovementReference(order, planItem, 'PAYFAIL-UNDO'),
    order: order._id,
    orderNumber: cleanText(order.orderNumber, 40),
    sourceModel: 'InventoryStock',
    sourceId: planItem.inventoryStock,
    postedAt: now,
  });
  await movement.save({ session });
  await InventoryStock.updateOne(
    { _id: stock._id },
    { $set: { lastMovement: movement._id, lastMovementAt: now } },
    { session }
  );
  return { completed: true, alreadyReversed: false, quantity, movement };
}

async function reconcileLegacyFailureCompensation({ order, session, now }) {
  const {
    getAllocationStatus,
    normalizeAllocation,
    summarizeInventoryAllocations,
  } = require('./orderInventoryAllocationService');
  const plan = getLegacyCompensationPlan(order);
  const productIds = new Set();
  const reversals = [];

  for (const planItem of plan) {
    const result = await reverseLegacyFailureAllocation({
      order,
      planItem,
      session,
      now,
    });
    reversals.push({ planItem, result });
    productIds.add(idValue(planItem.product));
  }

  const allocations = (Array.isArray(order.inventoryAllocations)
    ? order.inventoryAllocations
    : []
  ).map(normalizeAllocation);
  for (const { planItem, result } of reversals) {
    const allocation = allocations.find((candidate) =>
      allocationMatchesPlan(candidate, planItem)
    );
    if (!allocation || toQuantity(allocation.returnedQuantity) < result.quantity) {
      throw createFailureError(
        'La asignacion no conserva la devolucion que debe reconciliarse.',
        'PAYMENT_FAILURE_RECONCILIATION_ALLOCATION_MISMATCH',
        { allocationId: planItem.allocationId }
      );
    }
    allocation.returnedQuantity -= result.quantity;
    if (allocation.returnedQuantity === 0) allocation.lastReturnedAt = null;
    allocation.status = getAllocationStatus(allocation);
  }
  order.inventoryAllocations = allocations;
  order.inventoryAllocationSummary = summarizeInventoryAllocations(allocations);

  const { syncProductTotalStock } = require('./inventoryService');
  for (const productId of productIds) {
    if (productId) await syncProductTotalStock(productId, { session });
  }
  return { completed: true, reversals };
}

const compensateLegacyDiscountedInventory =
  createLegacyInventoryCompensationService({
    restoreAllocation: restoreLegacyAllocation,
    syncProducts: async (productIds, session) => {
      const { syncProductTotalStock } = require('./inventoryService');
      for (const productId of productIds) {
        if (productId) await syncProductTotalStock(productId, { session });
      }
    },
  });

function createPaymentInventoryFailureService({
  releaseReservation,
  applyReservation,
  compensateLegacyInventory = compensateLegacyDiscountedInventory,
  reconcileReservation = null,
  reconcileLegacyInventory = reconcileLegacyFailureCompensation,
  isApprovedPayment = () => false,
  buildReleaseReason = getPaymentFailureReleaseReason,
  now = () => new Date(),
} = {}) {
  if (typeof releaseReservation !== 'function') {
    throw new TypeError('releaseReservation es obligatorio.');
  }
  if (typeof applyReservation !== 'function') {
    throw new TypeError('applyReservation es obligatorio.');
  }

  return {
    async process({
      order,
      paymentStatus,
      provider = '',
      paymentReference = '',
      paymentTransactionId = '',
      session = null,
      approvalContext = {},
    } = {}) {
      const safeStatus = cleanText(paymentStatus, 40).toLowerCase();
      if (!['failed', 'cancelled'].includes(safeStatus)) {
        return { completed: false, ignored: true, action: 'ignored' };
      }

      if (isApprovedPayment(order, approvalContext)) {
        return {
          completed: false,
          ignored: true,
          canonicalApproval: true,
          action: 'approved_is_terminal',
        };
      }

      const mode = resolveFailureInventoryMode(order);
      if (mode === 'completed') {
        return { completed: true, duplicate: true, action: 'already_completed' };
      }
      if (mode === 'incomplete') {
        throw createFailureError(
          'La recuperacion no conserva evidencia suficiente para completarse.',
          'INVENTORY_RECOVERY_INCOMPLETE',
          {
            reason: 'RESERVATION_OR_DISCOUNT_EVIDENCE_REQUIRED',
            orderNumber: cleanText(order?.orderNumber, 40),
          }
        );
      }

      let reservation = null;
      let compensation = null;

      if (mode === 'release_reservation') {
        const releasePaymentReference = cleanText(
          paymentReference || order?.payment?.reference,
          180
        );
        const releasePaymentTransactionId = cleanText(
          paymentTransactionId || order?.payment?.transactionId,
          120
        );
        const releaseReason = buildReleaseReason({
          provider: provider || 'pasarela',
          paymentStatus: safeStatus,
          orderNumber: order.orderNumber,
          paymentReference: releasePaymentReference,
          paymentTransactionId: releasePaymentTransactionId,
        });
        reservation = await releaseReservation(
          order.inventoryControl.reservationId || order.orderNumber,
          {
            status: safeStatus === 'cancelled' ? 'cancelled' : 'failed',
            releaseReason,
            paymentReference: releasePaymentReference,
            paymentTransactionId: releasePaymentTransactionId,
          },
          { session, syncOrderAllocations: false }
        );

        if (reservation?.status === 'confirmed') {
          throw createFailureError(
            'Una reserva confirmada no puede liberarse por un pago tardio fallido.',
            'CONFIRMED_RESERVATION_CANNOT_BE_RELEASED',
            { reservationId: idValue(reservation?._id) }
          );
        }
        const expectedReservationStatus =
          safeStatus === 'cancelled' ? 'cancelled' : 'failed';
        if (
          cleanText(reservation?.status, 40).toLowerCase() !==
            expectedReservationStatus ||
          cleanText(reservation?.releaseReason, 1000) !==
            cleanText(releaseReason, 1000)
        ) {
          throw createFailureError(
            'La reserva no quedo liberada por esta operacion de pago fallido.',
            'RESERVATION_RELEASE_EVIDENCE_MISMATCH',
            {
              reservationId: idValue(reservation?._id),
              status: reservation?.status,
            }
          );
        }
        applyReservation(order, reservation);
      } else if (mode === 'legacy_compensation') {
        compensation = await compensateLegacyInventory({ order, session });
        if (compensation?.completed !== true) {
          throw createFailureError(
            'La compensacion heredada no termino correctamente.',
            'LEGACY_COMPENSATION_INCOMPLETE'
          );
        }
      }

      const completedAt = now();
      order.inventoryControl = order.inventoryControl || {};
      order.inventoryControl.discountedAtCheckout = false;
      order.inventoryControl.restockedOnFailure = true;
      order.inventoryControl.restockedAt = completedAt;

      return {
        completed: true,
        duplicate: false,
        action: mode,
        reservation,
        compensation,
        completedAt,
      };
    },

    async reconcileApproved({
      order,
      provider = 'wompi',
      paymentReference = '',
      paymentTransactionId = '',
      session = null,
    } = {}) {
      const control = order?.inventoryControl || {};
      if (control.restockedOnFailure !== true) {
        return { completed: true, needed: false, action: 'not_needed' };
      }

      if (control.reservationId) {
        if (typeof reconcileReservation !== 'function') {
          throw createFailureError(
            'No existe una autoridad para reconciliar la reserva liberada.',
            'PAYMENT_FAILURE_RESERVATION_RECONCILER_REQUIRED'
          );
        }
        const reservation = await reconcileReservation(
          control.reservationId,
          {
            order: order._id,
            orderNumber: order.orderNumber,
            provider,
            paymentReference,
            paymentTransactionId,
          },
          { session, syncOrderAllocations: false }
        );
        return {
          completed: true,
          needed: true,
          action: 'reconcile_reservation',
          reservation,
        };
      }

      if (hasLegacyDiscountEvidence(order)) {
        const reconciliation = await reconcileLegacyInventory({
          order,
          session,
          now: now(),
        });
        if (reconciliation?.completed !== true) {
          throw createFailureError(
            'La compensacion heredada no pudo reconciliarse con la aprobacion.',
            'PAYMENT_FAILURE_LEGACY_RECONCILIATION_INCOMPLETE'
          );
        }
        order.inventoryControl.discountedAtCheckout = true;
        order.inventoryControl.restockedOnFailure = false;
        order.inventoryControl.restockedAt = null;
        return {
          completed: true,
          needed: true,
          action: 'reconcile_legacy_compensation',
          reconciliation,
        };
      }

      if (control.reservationRequired === false) {
        control.restockedOnFailure = false;
        control.restockedAt = null;
        return {
          completed: true,
          needed: true,
          action: 'reconcile_not_required',
        };
      }

      throw createFailureError(
        'La recuperacion previa no conserva una ruta segura de reconciliacion.',
        'PAYMENT_FAILURE_APPROVAL_RECONCILIATION_INCOMPLETE',
        { orderNumber: cleanText(order?.orderNumber, 40) }
      );
    },
  };
}

module.exports = {
  PERMANENT_PAYMENT_INVENTORY_CODES,
  PAYMENT_INVENTORY_TRANSACTION_MAX_ATTEMPTS,
  RETRYABLE_PAYMENT_INVENTORY_CODES,
  asRetryablePaymentInventoryError,
  assertLegacyCompensationComplete,
  buildFailureMovementNumber,
  buildFailureReversalMovementNumber,
  assertFailureMovementMatches,
  compensateLegacyDiscountedInventory,
  createFailureError,
  createLegacyInventoryCompensationService,
  createPaymentInventoryFailureService,
  getLegacyCompensationPlan,
  hasLegacyDiscountEvidence,
  hasReservationEvidence,
  reconcileLegacyFailureCompensation,
  restoreLegacyAllocation,
  isRetryablePaymentInventoryError,
  isPermanentPaymentInventoryError,
  runPaymentInventoryTransaction,
  reverseLegacyFailureAllocation,
  resolveFailureInventoryMode,
};
