'use strict';

const mongoose = require('mongoose');

const Product = require('../../models/Product');
const {
  cleanLower,
  createRefundError,
  getOrderLines,
  idValue,
  normalizeVariantKey,
  orderItemProductId,
  orderItemQuantity,
  toQuantity,
} = require('./refundNormalization');
const {
  inventoryKey,
} = require('./refundInventoryAllocationService');

function addDemand(demands, key, quantity, metadata = {}) {
  const safeQuantity = toQuantity(quantity);
  if (!safeQuantity) return;

  const current = demands.get(key) || {
    key,
    quantity: 0,
    bundleParentProduct: null,
    ...metadata,
  };
  current.quantity += safeQuantity;
  if (
    metadata.bundleParentProduct &&
    !current.bundleParentProduct
  ) {
    current.bundleParentProduct = metadata.bundleParentProduct;
  }
  demands.set(key, current);
}

function getBundleComponents(line = {}) {
  const components =
    line.fulfillmentSnapshot?.bundle?.components;
  return Array.isArray(components) ? components : [];
}

async function buildInventoryDemands({
  order,
  requestedItems,
  allocationGroups,
  allocations,
  session,
}) {
  const demands = new Map();
  const currentProducts = await Product.find({
    _id: {
      $in: requestedItems
        .map((item) => item.product)
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    },
  })
    .select('productType trackInventory allowBackorder')
    .session(session)
    .lean();
  const productMap = new Map(
    currentProducts.map((product) => [
      idValue(product._id),
      product,
    ])
  );

  for (const item of requestedItems) {
    if (['digital', 'service'].includes(item.productType)) {
      continue;
    }
    if (!toQuantity(item.requestedRestockQuantity)) {
      continue;
    }

    if (item.productType !== 'bundle') {
      const key = inventoryKey(item.product, item.variantKey);
      const currentProduct = productMap.get(item.product);
      const inventoryExpected =
        currentProduct?.trackInventory !== false &&
        currentProduct?.allowBackorder !== true &&
        order.inventoryControl?.reservationRequired !== false;

      if (!allocationGroups.has(key)) {
        if (inventoryExpected) {
          throw createRefundError(
            `No existe trazabilidad de la salida de inventario para ${item.title}.`,
            'REFUND_SALE_TRACE_NOT_FOUND',
            409,
            {
              orderItemId: item.orderItemId,
              product: item.product,
              variantKey: item.variantKey,
            }
          );
        }
        continue;
      }

      addDemand(
        demands,
        key,
        item.requestedRestockQuantity,
        {
          product: item.product,
          variantKey: item.variantKey,
          sourceOrderItemIds: [item.orderItemId],
        }
      );
      item.restockedQuantity += item.requestedRestockQuantity;
      continue;
    }

    const components = getBundleComponents(item.line);
    let matchedComponents = 0;

    for (const component of components) {
      const componentProduct = idValue(component.product);
      if (!componentProduct) continue;
      const componentVariantKey = normalizeVariantKey(component);
      const key = inventoryKey(
        componentProduct,
        componentVariantKey
      );
      if (!allocationGroups.has(key)) continue;

      const quantity =
        item.requestedRestockQuantity *
        Math.max(1, toQuantity(component.quantity));
      addDemand(demands, key, quantity, {
        product: componentProduct,
        variantKey: componentVariantKey,
        bundleParentProduct: item.product,
        sourceOrderItemIds: [item.orderItemId],
      });
      item.restockedQuantity += quantity;
      matchedComponents += 1;
    }

    if (matchedComponents > 0) continue;

    const sameBundleLines = getOrderLines(order).filter(
      (line) =>
        cleanLower(line.productType) === 'bundle' &&
        orderItemProductId(line) === item.product
    );
    const totalBundlePurchased = sameBundleLines.reduce(
      (sum, line) => sum + orderItemQuantity(line),
      0
    );
    const bundleAllocations = allocations.filter(
      (allocation) =>
        idValue(allocation.bundleParentProduct) === item.product
    );
    const componentTotals = new Map();

    for (const allocation of bundleAllocations) {
      const key = inventoryKey(
        allocation.product,
        allocation.variantKey
      );
      componentTotals.set(
        key,
        (componentTotals.get(key) || 0) +
          toQuantity(allocation.quantity)
      );
    }

    for (const [key, totalComponentQuantity] of componentTotals) {
      if (!totalBundlePurchased) continue;
      const unitsPerBundle =
        totalComponentQuantity / totalBundlePurchased;
      if (
        !Number.isInteger(unitsPerBundle) ||
        unitsPerBundle <= 0
      ) {
        throw createRefundError(
          'No se pudo reconstruir la composición histórica del combo.',
          'BUNDLE_RETURN_TRACE_INVALID',
          409,
          {
            product: item.product,
            componentKey: key,
          }
        );
      }
      const group = allocationGroups.get(key);
      const quantity =
        item.requestedRestockQuantity * unitsPerBundle;
      addDemand(demands, key, quantity, {
        product: group?.product,
        variantKey: group?.variantKey,
        bundleParentProduct: item.product,
        sourceOrderItemIds: [item.orderItemId],
      });
      item.restockedQuantity += quantity;
      matchedComponents += 1;
    }

    if (
      matchedComponents === 0 &&
      order.inventoryControl?.reservationRequired !== false
    ) {
      throw createRefundError(
        `No existe trazabilidad de los componentes físicos de ${item.title}.`,
        'BUNDLE_RETURN_TRACE_NOT_FOUND',
        409,
        {
          orderItemId: item.orderItemId,
          product: item.product,
        }
      );
    }
  }

  return demands;
}

module.exports = {
  buildInventoryDemands,
};
