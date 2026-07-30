// backend/services/orderRefundService.js

'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const {
  buildVariantKey,
  normalizeAttributes,
} = require('../lib/products/productVariantConfig');
const {
  syncProductTotalStock,
} = require('./inventoryService');

function createRefundError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function toMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function toQuantity(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function idValue(value) {
  if (!value) return '';
  if (
    value instanceof mongoose.Types.ObjectId ||
    typeof value?.toHexString === 'function'
  ) {
    return String(value.toHexString());
  }
  if (typeof value === 'object') {
    return cleanText(value._id || value.id || value.product || value);
  }
  return cleanText(value);
}

function toObjectId(value, fieldName = 'id') {
  const id = idValue(value);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createRefundError(
      `${fieldName} no tiene un identificador válido.`,
      'INVALID_OBJECT_ID',
      400,
      { field: fieldName, value: id }
    );
  }
  return new mongoose.Types.ObjectId(id);
}

function normalizeVariantKey(source = {}) {
  return cleanLower(
    source.variantKey ||
      source.variantId ||
      buildVariantKey(
        source.size || source.talla || source.variant?.size || '',
        source.color || source.variant?.color || '',
        source.variantAttributes ||
          source.attributes ||
          source.variant?.attributes ||
          []
      ) ||
      'default__default'
  ) || 'default__default';
}

function orderItemQuantity(item = {}) {
  return toQuantity(item.quantity ?? item.qty ?? item.cantidad);
}

function orderItemProductId(item = {}) {
  return idValue(item.productId || item.product);
}

function getOrderLines(order = {}) {
  if (Array.isArray(order.items) && order.items.length) {
    return order.items;
  }
  return Array.isArray(order.cart) ? order.cart : [];
}

function lineIdentity(line = {}, index = 0) {
  const existingId = idValue(line._id || line.orderItemId);
  if (mongoose.Types.ObjectId.isValid(existingId)) return existingId;

  throw createRefundError(
    `La línea ${index + 1} de la orden no tiene identificador histórico.`,
    'ORDER_ITEM_ID_MISSING',
    409,
    { index }
  );
}

function productMatchesLine(line = {}, requested = {}) {
  const requestedProduct = idValue(
    requested.productId ||
      requested.product ||
      requested.product_id ||
      requested._id ||
      requested.id
  );
  if (!requestedProduct) return true;
  return orderItemProductId(line) === requestedProduct;
}

function variantMatchesLine(line = {}, requested = {}) {
  const requestedVariant = cleanLower(
    requested.variantKey || requested.variantId || ''
  );
  const requestedSize = cleanLower(
    requested.size || requested.talla || requested.variant?.size || ''
  );
  const requestedColor = cleanLower(
    requested.color || requested.variant?.color || ''
  );

  if (
    requestedVariant &&
    normalizeVariantKey(line) !== requestedVariant
  ) {
    return false;
  }
  if (
    requestedSize &&
    cleanLower(line.size || line.talla) !== requestedSize
  ) {
    return false;
  }
  if (
    requestedColor &&
    cleanLower(line.color) !== requestedColor
  ) {
    return false;
  }
  return true;
}

function resolveOrderLine(orderLines, requested, index) {
  const explicitLineId = idValue(
    requested.orderItemId || requested.lineId || requested.orderLineId
  );
  const genericId = idValue(requested._id || requested.id);
  const lineIdCandidate = explicitLineId || genericId;

  if (lineIdCandidate) {
    const exact = orderLines.find(
      (line) => idValue(line._id || line.orderItemId) === lineIdCandidate
    );
    if (exact) return exact;
    if (explicitLineId) {
      throw createRefundError(
        `La línea ${index + 1} no pertenece a la orden.`,
        'REFUND_ITEM_NOT_IN_ORDER',
        400,
        { index, orderItemId: explicitLineId }
      );
    }
  }

  const candidates = orderLines.filter(
    (line) =>
      productMatchesLine(line, requested) &&
      variantMatchesLine(line, requested)
  );

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    throw createRefundError(
      `La línea ${index + 1} es ambigua. Envía orderItemId.`,
      'REFUND_ITEM_AMBIGUOUS',
      400,
      { index }
    );
  }

  throw createRefundError(
    `La línea ${index + 1} no corresponde a ningún producto vendido.`,
    'REFUND_ITEM_NOT_IN_ORDER',
    400,
    { index }
  );
}

function normalizeRequestedItems(
  order,
  requestedItems,
  previouslyReturnedByLine = new Map()
) {
  const orderLines = getOrderLines(order);
  const source = Array.isArray(requestedItems) ? requestedItems : [];
  const consolidated = new Map();

  source.forEach((requested, index) => {
    const line = resolveOrderLine(orderLines, requested || {}, index);
    const orderItemId = lineIdentity(
      line,
      orderLines.indexOf(line)
    );
    const quantity = toQuantity(
      requested?.quantity ?? requested?.qty ?? requested?.cantidad
    );

    if (quantity <= 0) {
      throw createRefundError(
        `La cantidad de la línea ${index + 1} debe ser mayor a cero.`,
        'REFUND_QUANTITY_INVALID',
        400,
        { index, quantity }
      );
    }

    const current = consolidated.get(orderItemId);
    if (current) {
      current.returnedQuantity += quantity;
      return;
    }

    const purchasedQuantity = orderItemQuantity(line);
    if (purchasedQuantity <= 0) {
      throw createRefundError(
        `La línea ${index + 1} no tiene una cantidad vendida válida.`,
        'ORDER_ITEM_QUANTITY_INVALID',
        409,
        { index, orderItemId }
      );
    }

    consolidated.set(orderItemId, {
      orderItemId,
      product: orderItemProductId(line),
      title: cleanText(line.title || line.name),
      productType: cleanLower(line.productType || 'physical') || 'physical',
      variantKey: normalizeVariantKey(line),
      size: cleanText(line.size || line.talla),
      color: cleanText(line.color),
      purchasedQuantity,
      returnedQuantity: quantity,
      restockedQuantity: 0,
      line,
    });
  });

  const normalized = Array.from(consolidated.values());

  normalized.forEach((item) => {
    if (!mongoose.Types.ObjectId.isValid(item.product)) {
      throw createRefundError(
        `La línea ${item.title || item.orderItemId} no conserva el producto vendido.`,
        'ORDER_ITEM_PRODUCT_MISSING',
        409,
        { orderItemId: item.orderItemId }
      );
    }

    const previous = toQuantity(
      previouslyReturnedByLine.get(item.orderItemId) || 0
    );
    if (
      previous + item.returnedQuantity >
      item.purchasedQuantity
    ) {
      throw createRefundError(
        `La devolución de ${item.title || 'un producto'} supera la cantidad comprada.`,
        'REFUND_QUANTITY_EXCEEDS_PURCHASED',
        409,
        {
          orderItemId: item.orderItemId,
          purchasedQuantity: item.purchasedQuantity,
          previouslyReturned: previous,
          requestedQuantity: item.returnedQuantity,
        }
      );
    }
  });

  return normalized;
}

function canonicalRefundPayload({ amount, reason, items }) {
  return {
    amount: toMoney(amount),
    reason: cleanText(reason),
    items: [...items]
      .map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.returnedQuantity,
      }))
      .sort((a, b) =>
        a.orderItemId.localeCompare(b.orderItemId)
      ),
  };
}

function hashPayload(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function buildRefundNumber(orderNumber = '') {
  const orderPart =
    cleanUpper(orderNumber).replace(/[^A-Z0-9-]/g, '').slice(-30) ||
    'ORDER';
  return `RF-${orderPart}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

function isPaidOrder(order = {}) {
  const orderStatus = cleanLower(order.status);
  const paymentStatus = cleanLower(order.payment?.status);
  return (
    paymentStatus === 'paid' ||
    ['paid', 'processing', 'shipped', 'delivered', 'refunded'].includes(
      orderStatus
    )
  );
}

function inventoryKey(product, variantKey) {
  return `${idValue(product)}:${cleanLower(variantKey || 'default__default')}`;
}

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

async function loadConfirmedSaleAllocations(order, session) {
  const reservation = await InventoryReservation.findOne({
    $or: [
      { order: order._id },
      { orderNumber: cleanText(order.orderNumber) },
    ],
    status: 'confirmed',
  })
    .sort({ confirmedAt: -1, createdAt: -1 })
    .session(session)
    .lean();

  if (reservation?.items?.length) {
    return reservation.items
      .filter(
        (item) =>
          item.inventoryStock &&
          item.product &&
          toQuantity(item.quantity) > 0
      )
      .map((item) => ({
        inventoryStock: idValue(item.inventoryStock),
        branch: idValue(item.branch),
        product: idValue(item.product),
        variantKey: normalizeVariantKey(item),
        size: cleanText(item.size),
        color: cleanText(item.color),
        variantLabel: cleanText(item.variantLabel),
        variantAttributes: normalizeAttributes(
          item.variantAttributes || []
        ),
        quantity: toQuantity(item.quantity),
        bundleParentProduct: idValue(item.bundleParentProduct) || null,
        productSnapshot: item.productSnapshot || {},
        branchSnapshot: item.branchSnapshot || {},
        source: 'InventoryReservation',
        sourceId: reservation._id,
      }));
  }

  const saleMovements = await InventoryMovement.find({
    $or: [
      { order: order._id },
      { orderNumber: cleanUpper(order.orderNumber) },
    ],
    type: 'sale_out',
    status: 'posted',
    deletedAt: null,
  })
    .sort({ createdAt: 1, _id: 1 })
    .session(session)
    .lean();

  const allocations = [];
  for (const movement of saleMovements) {
    const variantKey = normalizeVariantKey(movement.variant || {});
    const stock = await InventoryStock.findOne({
      branch: movement.branchFrom,
      product: movement.product,
      variantKey,
      deletedAt: null,
    })
      .session(session)
      .lean();

    if (!stock) continue;

    allocations.push({
      inventoryStock: idValue(stock._id),
      branch: idValue(movement.branchFrom),
      product: idValue(movement.product),
      variantKey,
      size: cleanText(movement.variant?.size),
      color: cleanText(movement.variant?.color),
      variantLabel: cleanText(movement.variant?.label),
      variantAttributes: normalizeAttributes(
        movement.variant?.attributes || []
      ),
      quantity: toQuantity(movement.quantity),
      bundleParentProduct: null,
      productSnapshot: movement.productSnapshot || stock.productSnapshot || {},
      branchSnapshot: movement.branchFromSnapshot || stock.branchSnapshot || {},
      source: 'InventoryMovement',
      sourceId: movement._id,
    });
  }

  return allocations;
}

function groupSaleAllocations(allocations = []) {
  const groups = new Map();

  for (const allocation of allocations) {
    const key = inventoryKey(
      allocation.product,
      allocation.variantKey
    );
    const stockId = idValue(allocation.inventoryStock);
    const group = groups.get(key) || {
      key,
      product: allocation.product,
      variantKey: allocation.variantKey,
      size: allocation.size,
      color: allocation.color,
      variantLabel: allocation.variantLabel,
      variantAttributes: allocation.variantAttributes,
      allocations: new Map(),
    };
    const current = group.allocations.get(stockId) || {
      ...allocation,
      quantity: 0,
    };
    current.quantity += toQuantity(allocation.quantity);
    group.allocations.set(stockId, current);
    groups.set(key, group);
  }

  return groups;
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
        item.returnedQuantity,
        {
          product: item.product,
          variantKey: item.variantKey,
          sourceOrderItemIds: [item.orderItemId],
        }
      );
      item.restockedQuantity += item.returnedQuantity;
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
        item.returnedQuantity *
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
        item.returnedQuantity * unitsPerBundle;
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

function getPreviousRefundState(refunds = []) {
  const amount = refunds.reduce(
    (sum, refund) => sum + toMoney(refund.amount),
    0
  );
  const returnedByLine = new Map();
  const restoredByStock = new Map();

  for (const refund of refunds) {
    for (const item of refund.items || []) {
      const lineId = idValue(item.orderItemId);
      returnedByLine.set(
        lineId,
        (returnedByLine.get(lineId) || 0) +
          toQuantity(item.returnedQuantity)
      );
    }
    for (const restoration of refund.inventoryRestorations || []) {
      const stockId = idValue(restoration.inventoryStock);
      restoredByStock.set(
        stockId,
        (restoredByStock.get(stockId) || 0) +
          toQuantity(restoration.quantity)
      );
    }
  }

  return {
    amount,
    returnedByLine,
    restoredByStock,
  };
}

async function loadLegacyRefundState({
  order,
  orderLines,
  OrderEventModel,
  session,
}) {
  const empty = {
    amount: 0,
    returnedByLine: new Map(),
  };
  if (!OrderEventModel) return empty;

  const events = await OrderEventModel.find({
    orderId: order._id,
    type: 'refund_created',
    'meta.refundId': { $exists: false },
  })
    .session(session)
    .lean();

  for (const event of events) {
    empty.amount += toMoney(event.meta?.amount);
    for (const [index, rawItem] of (
      Array.isArray(event.meta?.items) ? event.meta.items : []
    ).entries()) {
      try {
        const line = resolveOrderLine(
          orderLines,
          rawItem || {},
          index
        );
        const lineId = lineIdentity(
          line,
          orderLines.indexOf(line)
        );
        empty.returnedByLine.set(
          lineId,
          (empty.returnedByLine.get(lineId) || 0) +
            toQuantity(
              rawItem?.quantity ??
                rawItem?.qty ??
                rawItem?.cantidad
            )
        );
      } catch {
        // Los eventos antiguos sin una línea inequívoca sí cuentan
        // monetariamente, pero no se usan para inventar cantidades.
      }
    }
  }

  return empty;
}

function mergeQuantityMaps(first, second) {
  const merged = new Map(first);
  for (const [key, value] of second) {
    merged.set(key, (merged.get(key) || 0) + toQuantity(value));
  }
  return merged;
}

function serializeRefundItem(item) {
  return {
    orderItemId: item.orderItemId,
    product: item.product,
    title: item.title,
    productType: item.productType,
    variantKey: item.variantKey,
    size: item.size,
    color: item.color,
    purchasedQuantity: item.purchasedQuantity,
    returnedQuantity: item.returnedQuantity,
    restockedQuantity: item.restockedQuantity,
  };
}

async function restoreInventory({
  order,
  refund,
  requestedItems,
  previousRestoredByStock,
  adminId,
  session,
}) {
  if (!requestedItems.length) return [];

  const allocations = await loadConfirmedSaleAllocations(
    order,
    session
  );
  const allocationGroups = groupSaleAllocations(allocations);
  const demands = await buildInventoryDemands({
    order,
    requestedItems,
    allocationGroups,
    allocations,
    session,
  });
  const restorations = [];
  const affectedProducts = new Set();
  const now = new Date();

  for (const demand of demands.values()) {
    const group = allocationGroups.get(demand.key);
    let remaining = demand.quantity;

    for (const allocation of group?.allocations?.values() || []) {
      if (remaining <= 0) break;
      const stockId = idValue(allocation.inventoryStock);
      const alreadyRestored = toQuantity(
        previousRestoredByStock.get(stockId) || 0
      );
      const restoredNow = restorations
        .filter(
          (restoration) =>
            idValue(restoration.inventoryStock) === stockId
        )
        .reduce(
          (sum, restoration) =>
            sum + toQuantity(restoration.quantity),
          0
        );
      const capacity = Math.max(
        0,
        toQuantity(allocation.quantity) -
          alreadyRestored -
          restoredNow
      );
      if (!capacity) continue;

      const quantity = Math.min(remaining, capacity);
      const stock = await InventoryStock.findById(stockId).session(
        session
      );
      if (!stock) {
        throw createRefundError(
          'La existencia histórica de la venta ya no está disponible.',
          'RETURN_STOCK_ROW_NOT_FOUND',
          409,
          { inventoryStock: stockId }
        );
      }

      const before = Number(stock.stock || 0);
      const after = before + quantity;
      const movement = new InventoryMovement({
        type: 'return_in',
        direction: 'in',
        status: 'posted',
        product: allocation.product,
        productSnapshot:
          allocation.productSnapshot ||
          stock.productSnapshot ||
          {},
        variant: {
          size: allocation.size || stock.variant?.size || '',
          color: allocation.color || stock.variant?.color || '',
          label:
            allocation.variantLabel || stock.variant?.label || '',
          attributes: normalizeAttributes(
            allocation.variantAttributes ||
              stock.variant?.attributes ||
              []
          ),
          sku: stock.variant?.sku || '',
          barcode: stock.variant?.barcode || '',
        },
        branchFrom: null,
        branchFromSnapshot: {},
        branchTo: allocation.branch || stock.branch,
        branchToSnapshot:
          allocation.branchSnapshot ||
          stock.branchSnapshot ||
          {},
        quantity,
        stockFrom: {
          before: 0,
          quantity: 0,
          after: 0,
        },
        stockTo: {
          before,
          quantity,
          after,
        },
        reason: 'Entrada automática por devolución de cliente',
        notes: `Reembolso ${refund.refundNumber} de la orden ${order.orderNumber || order._id}.`,
        reference: refund.refundNumber,
        order: order._id,
        orderNumber: cleanUpper(order.orderNumber),
        sourceModel: 'OrderRefund',
        sourceId: refund._id,
        createdBy: adminId,
        updatedBy: adminId,
        postedBy: adminId,
        postedAt: now,
      });
      await movement.save({ session });

      stock.stock = after;
      stock.availableStock = Math.max(
        0,
        after - Number(stock.reservedStock || 0)
      );
      stock.lastMovement = movement._id;
      stock.lastMovementAt = now;
      stock.updatedBy = adminId;
      await stock.save({ session });

      restorations.push({
        inventoryStock: stock._id,
        inventoryMovement: movement._id,
        branch: allocation.branch || stock.branch,
        product: allocation.product,
        variantKey: allocation.variantKey,
        size: allocation.size,
        color: allocation.color,
        quantity,
        bundleParentProduct:
          demand.bundleParentProduct || null,
      });
      affectedProducts.add(idValue(allocation.product));
      remaining -= quantity;
    }

    if (remaining > 0) {
      throw createRefundError(
        'La devolución supera las unidades realmente descontadas del inventario.',
        'REFUND_QUANTITY_EXCEEDS_SOLD_INVENTORY',
        409,
        {
          product: demand.product,
          variantKey: demand.variantKey,
          requestedQuantity: demand.quantity,
          missingQuantity: remaining,
        }
      );
    }
  }

  for (const productId of affectedProducts) {
    await syncProductTotalStock(productId, { session });
  }

  return restorations;
}

function safeRefundResponse(refund) {
  const value =
    typeof refund?.toObject === 'function'
      ? refund.toObject()
      : refund;
  return {
    _id: value?._id,
    refundNumber: value?.refundNumber,
    order: value?.order,
    orderNumber: value?.orderNumber,
    idempotencyKey: value?.idempotencyKey,
    status: value?.status,
    amount: value?.amount,
    currency: value?.currency,
    reason: value?.reason,
    items: value?.items || [],
    inventoryRestorations: value?.inventoryRestorations || [],
    totalReturnedUnits: value?.totalReturnedUnits || 0,
    totalRestockedUnits: value?.totalRestockedUnits || 0,
    processedAt: value?.processedAt || null,
    createdAt: value?.createdAt || null,
  };
}

async function processOrderRefund(
  {
    orderId,
    amount,
    reason = '',
    items = [],
    idempotencyKey = '',
    adminId = null,
    adminLabel = '',
  } = {},
  {
    session: externalSession = null,
    OrderEventModel = null,
  } = {}
) {
  const orderObjectId = toObjectId(orderId, 'La orden');
  const refundAmount = toMoney(amount);
  if (refundAmount <= 0) {
    throw createRefundError(
      'El monto del reembolso debe ser mayor a cero.',
      'AMOUNT_INVALID',
      400
    );
  }
  const safeAdminId = mongoose.Types.ObjectId.isValid(idValue(adminId))
    ? new mongoose.Types.ObjectId(idValue(adminId))
    : null;
  const ownsSession = !externalSession;
  const session =
    externalSession || (await mongoose.startSession());
  let resolvedIdempotencyKey = '';
  let resolvedRequestHash = '';

  async function execute() {
    const order = await Order.findById(orderObjectId).session(session);
    if (!order) {
      throw createRefundError(
        'Orden no encontrada.',
        'ORDER_NOT_FOUND',
        404
      );
    }
    if (!isPaidOrder(order)) {
      throw createRefundError(
        'Solo se pueden reembolsar órdenes pagadas.',
        'ORDER_NOT_PAID',
        409,
        {
          orderStatus: order.status,
          paymentStatus: order.payment?.status,
        }
      );
    }

    const processedRefunds = await OrderRefund.find({
      order: order._id,
      status: 'processed',
    })
      .sort({ createdAt: 1, _id: 1 })
      .session(session)
      .lean();
    const previous = getPreviousRefundState(processedRefunds);
    const legacy = await loadLegacyRefundState({
      order,
      orderLines: getOrderLines(order),
      OrderEventModel,
      session,
    });
    const normalizedItems = normalizeRequestedItems(
      order,
      items,
      new Map()
    );
    const canonical = canonicalRefundPayload({
      amount: refundAmount,
      reason,
      items: normalizedItems,
    });
    resolvedRequestHash = hashPayload(canonical);
    resolvedIdempotencyKey =
      cleanText(idempotencyKey).slice(0, 200) ||
      `auto:${resolvedRequestHash}`;

    const existing = await OrderRefund.findOne({
      order: order._id,
      idempotencyKey: resolvedIdempotencyKey,
    }).session(session);
    if (existing) {
      if (existing.requestHash !== resolvedRequestHash) {
        throw createRefundError(
          'La clave de idempotencia ya fue usada con otro reembolso.',
          'IDEMPOTENCY_KEY_REUSED',
          409
        );
      }
      return {
        refund: safeRefundResponse(existing),
        idempotent: true,
      };
    }

    const previouslyReturnedByLine = mergeQuantityMaps(
      previous.returnedByLine,
      legacy.returnedByLine
    );
    for (const item of normalizedItems) {
      const previouslyReturned = toQuantity(
        previouslyReturnedByLine.get(item.orderItemId) || 0
      );
      if (
        previouslyReturned + item.returnedQuantity >
        item.purchasedQuantity
      ) {
        throw createRefundError(
          `La devolución de ${item.title || 'un producto'} supera la cantidad comprada.`,
          'REFUND_QUANTITY_EXCEEDS_PURCHASED',
          409,
          {
            orderItemId: item.orderItemId,
            purchasedQuantity: item.purchasedQuantity,
            previouslyReturned,
            requestedQuantity: item.returnedQuantity,
          }
        );
      }
    }

    const orderTotal = toMoney(
      order.total ||
        order.pricing?.total ||
        order.payment?.amount
    );
    const previouslyRefunded =
      previous.amount + legacy.amount;
    const refundableAmount = toMoney(
      orderTotal - previouslyRefunded
    );
    if (refundAmount > refundableAmount) {
      throw createRefundError(
        'El monto supera el saldo disponible para reembolsar.',
        'REFUND_AMOUNT_EXCEEDS_ORDER',
        409,
        {
          orderTotal,
          previouslyRefunded,
          refundableAmount,
          requestedAmount: refundAmount,
        }
      );
    }

    const refund = new OrderRefund({
      refundNumber: buildRefundNumber(order.orderNumber),
      order: order._id,
      orderNumber: order.orderNumber,
      idempotencyKey: resolvedIdempotencyKey,
      requestHash: resolvedRequestHash,
      status: 'processing',
      amount: refundAmount,
      currency:
        order.payment?.currency ||
        order.pricing?.currency ||
        'COP',
      reason,
      items: normalizedItems.map(serializeRefundItem),
      inventoryRestorations: [],
      createdBy: safeAdminId,
      createdByLabel: cleanText(adminLabel || 'admin'),
    });
    await refund.save({ session });

    const inventoryRestorations = await restoreInventory({
      order,
      refund,
      requestedItems: normalizedItems,
      previousRestoredByStock: previous.restoredByStock,
      adminId: safeAdminId,
      session,
    });
    refund.items = normalizedItems.map(serializeRefundItem);
    refund.inventoryRestorations = inventoryRestorations;
    refund.status = 'processed';
    refund.processedAt = new Date();
    await refund.save({ session });

    await Order.updateOne(
      { _id: order._id },
      {
        $inc: {
          'refundControl.totalAmount': refundAmount,
          'refundControl.transactionCount': 1,
          'refundControl.returnedUnits':
            refund.totalReturnedUnits,
          'refundControl.restockedUnits':
            refund.totalRestockedUnits,
        },
        $set: {
          'refundControl.lastRefundAt': refund.processedAt,
          'refundControl.lastRefund': refund._id,
        },
      },
      { session }
    );

    if (OrderEventModel) {
      await OrderEventModel.create(
        [
          {
            orderId: order._id,
            type: 'refund_created',
            message: `Reembolso ${refund.refundNumber} por ${refundAmount.toLocaleString(
              'es-CO',
              {
                style: 'currency',
                currency: refund.currency || 'COP',
              }
            )}${reason ? ` · ${cleanText(reason)}` : ''}`,
            meta: {
              refundId: refund._id,
              refundNumber: refund.refundNumber,
              idempotencyKey: resolvedIdempotencyKey,
              amount: refundAmount,
              currency: refund.currency,
              reason: cleanText(reason),
              items: refund.items,
              inventoryMovements:
                inventoryRestorations.map(
                  (restoration) =>
                    restoration.inventoryMovement
                ),
              by: cleanText(adminLabel || 'admin'),
            },
          },
        ],
        { session }
      );
    }

    return {
      refund: safeRefundResponse(refund),
      idempotent: false,
    };
  }

  try {
    if (externalSession) return await execute();

    let result;
    await session.withTransaction(async () => {
      result = await execute();
    });
    return result;
  } catch (error) {
    if (
      String(error?.code || '') === '11000' &&
      resolvedIdempotencyKey
    ) {
      const existing = await OrderRefund.findOne({
        order: orderObjectId,
        idempotencyKey: resolvedIdempotencyKey,
      });
      if (
        existing &&
        existing.requestHash === resolvedRequestHash
      ) {
        return {
          refund: safeRefundResponse(existing),
          idempotent: true,
        };
      }
    }
    throw error;
  } finally {
    if (ownsSession) {
      await session.endSession();
    }
  }
}

module.exports = {
  processOrderRefund,
  createRefundError,
  normalizeRequestedItems,
  canonicalRefundPayload,
  getPreviousRefundState,
};
