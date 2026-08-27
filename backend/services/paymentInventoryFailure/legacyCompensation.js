'use strict';

const {
  canonicalizeVariantKey,
  resolveVariantIdentity,
} = require('../../../shared/variantKeyAuthority.cjs');
const { createFailureError } = require('./errorClassification');
const { getLegacyCompensationPlan } = require('./inventoryMode');
const {
  assertFailureMovementMatches,
  buildFailureMovementNumber,
  buildFailureMovementReference,
} = require('./movementEvidence');
const { cleanText, idValue, toQuantity } = require('./support');

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
          : require('../orderInventoryAllocationService')
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
    InventoryStockModel || require('../../models/InventoryStock');
  const InventoryMovement =
    InventoryMovementModel || require('../../models/InventoryMovement');
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

const compensateLegacyDiscountedInventory =
  createLegacyInventoryCompensationService({
    restoreAllocation: restoreLegacyAllocation,
    syncProducts: async (productIds, session) => {
      const { syncProductTotalStock } = require('../inventoryService');
      for (const productId of productIds) {
        if (productId) await syncProductTotalStock(productId, { session });
      }
    },
  });

module.exports = {
  allocationMatchesPlan,
  assertLegacyCompensationComplete,
  compensateLegacyDiscountedInventory,
  createLegacyInventoryCompensationService,
  restoreLegacyAllocation,
};
