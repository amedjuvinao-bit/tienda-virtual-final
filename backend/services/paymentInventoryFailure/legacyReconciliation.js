'use strict';

const {
  canonicalizeVariantKey,
  resolveVariantIdentity,
} = require('../../../shared/variantKeyAuthority.cjs');
const { createFailureError } = require('./errorClassification');
const { getLegacyCompensationPlan } = require('./inventoryMode');
const { allocationMatchesPlan } = require('./legacyCompensation');
const {
  assertFailureMovementMatches,
  buildFailureMovementNumber,
  buildFailureMovementReference,
  buildFailureReversalMovementNumber,
} = require('./movementEvidence');
const { cleanText, idValue, toQuantity } = require('./support');

async function reverseLegacyFailureAllocation({ order, planItem, session, now }) {
  const InventoryStock = require('../../models/InventoryStock');
  const InventoryMovement = require('../../models/InventoryMovement');
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
  } = require('../orderInventoryAllocationService');
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

  const { syncProductTotalStock } = require('../inventoryService');
  for (const productId of productIds) {
    if (productId) await syncProductTotalStock(productId, { session });
  }
  return { completed: true, reversals };
}

module.exports = {
  reconcileLegacyFailureCompensation,
  reverseLegacyFailureAllocation,
};
