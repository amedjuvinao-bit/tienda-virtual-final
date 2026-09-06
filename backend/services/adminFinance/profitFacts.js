'use strict';

const InventoryMovement = require('../../models/InventoryMovement');
const Product = require('../../models/Product');
const {
  resolveVariantCommercialSnapshot,
} = require('../../lib/products/productVariantConfig');

function createProfitFacts(deps) {
  const {
    clean,
    cleanLower,
    correctionTotal,
    getItemQty,
    getItemUnitPrice,
    getOrderAmount,
    getOrderItems,
    getProductIdFromItem,
    isValidObjectId,
    money,
    pct,
    signedMoney,
    toObjectId,
  } = deps;

  async function loadProductMapFromOrders(orders = []) {
    const ids = [];
    const seen = new Set();

    for (const order of orders) {
      for (const item of getOrderItems(order)) {
        const id = getProductIdFromItem(item);
        if (!id || !isValidObjectId(id) || seen.has(id)) continue;
        seen.add(id);
        ids.push(toObjectId(id));
      }
    }

    if (!ids.length) return new Map();
    const products = await Product.find({ _id: { $in: ids } }).lean();
    return new Map(products.map((product) => [String(product._id), product]));
  }

  function financeItemVariantKey(item = {}) {
    return cleanLower(item.variantKey || item.variantId || '');
  }

  function financeCostKey(orderId, productId, variantKey = '') {
    return `${String(orderId || '')}:${String(productId || '')}:${cleanLower(variantKey)}`;
  }

  async function loadHistoricalCostLedger(orders = []) {
    const orderIds = orders.map((order) => toObjectId(order?._id)).filter(Boolean);
    const exact = new Map();
    const byProduct = new Map();

    if (!orderIds.length) return { exact, byProduct };

    const movements = await InventoryMovement.find({
      order: { $in: orderIds },
      type: 'sale_out',
      status: 'posted',
      deletedAt: null,
    })
      .select('order product variantKey quantity unitCost totalCost')
      .lean();

    const add = (map, key, quantity, totalCost) => {
      if (!key || quantity <= 0 || totalCost <= 0) return;
      const row = map.get(key) || { quantity: 0, totalCost: 0 };
      row.quantity += quantity;
      row.totalCost += totalCost;
      map.set(key, row);
    };

    for (const movement of movements) {
      const orderId = String(movement.order || '');
      const productId = String(movement.product || '');
      const quantity = Math.max(0, Number(movement.quantity || 0));
      const totalCost = money(
        movement.totalCost || Number(movement.unitCost || 0) * quantity
      );
      if (!orderId || !productId || quantity <= 0 || totalCost <= 0) continue;

      add(
        exact,
        financeCostKey(orderId, productId, movement.variantKey),
        quantity,
        totalCost
      );
      add(
        byProduct,
        financeCostKey(orderId, productId),
        quantity,
        totalCost
      );
    }

    return { exact, byProduct };
  }

  function resolveItemCost(product, item = {}, order = {}, costLedger = {}) {
    const orderId = String(order?._id || '');
    const productId = getProductIdFromItem(item);
    const variantKey = financeItemVariantKey(item);
    const exact = costLedger.exact?.get(
      financeCostKey(orderId, productId, variantKey)
    );
    const productCost = costLedger.byProduct?.get(
      financeCostKey(orderId, productId)
    );
    const historical = exact || productCost;

    if (historical?.quantity > 0 && historical.totalCost > 0) {
      return {
        unitCost: money(historical.totalCost / historical.quantity),
        source: 'inventory_movement',
      };
    }

    if (product) {
      const snapshot = resolveVariantCommercialSnapshot(product, {
        variantKey,
        size: item.size || '',
        color: item.color || '',
      });
      const variantCost = money(snapshot?.cost);
      const fallbackCost = variantCost || money(product.averageCost || product.cost || 0);
      if (fallbackCost > 0) {
        return { unitCost: fallbackCost, source: 'estimated_current_product' };
      }
    }

    return { unitCost: 0, source: 'missing' };
  }

  async function buildProfitCostContext(orders = []) {
    const [productMap, costLedger] = await Promise.all([
      loadProductMapFromOrders(orders),
      loadHistoricalCostLedger(orders),
    ]);
    const byOrder = new Map();
    const quality = {
      historicalCostItems: 0,
      estimatedCostItems: 0,
      missingCostItems: 0,
    };

    for (const order of orders) {
      const rows = [];
      for (const item of getOrderItems(order)) {
        const qty = getItemQty(item);
        if (qty <= 0) continue;

        const productId = getProductIdFromItem(item);
        const product = productMap.get(String(productId));
        const cost = resolveItemCost(product, item, order, costLedger);
        const unitPrice = getItemUnitPrice(item);
        const row = {
          itemId: String(item._id || ''),
          productId,
          title: clean(item.title || product?.title || 'Producto sin nombre'),
          qty,
          unitPrice,
          revenue: money(unitPrice * qty),
          unitCost: cost.unitCost,
          cogs: money(cost.unitCost * qty),
          costSource: cost.source,
        };
        rows.push(row);

        if (cost.source === 'inventory_movement') quality.historicalCostItems += 1;
        else if (cost.source === 'estimated_current_product') quality.estimatedCostItems += 1;
        else quality.missingCostItems += 1;
      }

      byOrder.set(String(order._id), {
        rows,
        totalCost: rows.reduce((sum, row) => sum + row.cogs, 0),
        totalItemRevenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      });
    }

    return { byOrder, quality };
  }

  async function summarizeProfitFromOrders(
    salesOrders = [],
    correctionContext = { correctionsByOrder: new Map(), ordersById: new Map() }
  ) {
    const ordersById = new Map(correctionContext.ordersById || []);
    salesOrders.forEach((order) => ordersById.set(String(order._id), order));
    const allOrders = [...ordersById.values()];
    const costContext = await buildProfitCostContext(allOrders);
    const byProduct = new Map();
    const bySource = new Map();

    const ensureProduct = (row) => {
      const key = row.productId || row.title;
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          productId: row.productId || '',
          title: row.title,
          qty: 0,
          returnedQty: 0,
          grossRevenue: 0,
          refunds: 0,
          grossCogs: 0,
          returnedCogs: 0,
        });
      }
      return byProduct.get(key);
    };

    const ensureSource = (order) => {
      const key = cleanLower(order?.source || 'online') || 'online';
      if (!bySource.has(key)) {
        bySource.set(key, {
          key,
          label: key,
          orders: 0,
          grossAmount: 0,
          refunds: 0,
          grossCogs: 0,
          returnedCogs: 0,
        });
      }
      return bySource.get(key);
    };

    let grossRevenue = 0;
    let grossCogs = 0;
    let itemsCount = 0;

    for (const order of salesOrders) {
      const orderRevenue = getOrderAmount(order);
      const costRows = costContext.byOrder.get(String(order._id))?.rows || [];
      const source = ensureSource(order);
      source.orders += 1;
      source.grossAmount += orderRevenue;
      grossRevenue += orderRevenue;

      for (const row of costRows) {
        const product = ensureProduct(row);
        product.qty += row.qty;
        product.grossRevenue += row.revenue;
        product.grossCogs += row.cogs;
        source.grossCogs += row.cogs;
        grossCogs += row.cogs;
        itemsCount += row.qty;
      }
    }

    let returnedCogs = 0;
    const refunds = correctionTotal(correctionContext.correctionsByOrder);

    for (const group of correctionContext.correctionsByOrder.values()) {
      const order = group.order;
      const orderCost = costContext.byOrder.get(String(order._id)) || {
        rows: [],
        totalCost: 0,
        totalItemRevenue: 0,
      };
      const source = ensureSource(order);
      source.refunds += group.amount;
      let reversedForOrder = 0;

      for (const event of group.events) {
        const requestedItems = Array.isArray(event.items) ? event.items : [];
        const matches = [];

        for (const requested of requestedItems) {
          const itemId = String(requested.orderItemId || '');
          const productId = String(requested.product || requested.productId || '');
          const row = orderCost.rows.find((candidate) =>
            (itemId && candidate.itemId === itemId) ||
            (!itemId && productId && candidate.productId === productId)
          );
          const qty = Math.min(
            row?.qty || 0,
            Math.max(0, Number(requested.returnedQuantity ?? requested.quantity ?? 0))
          );
          if (row && qty > 0) matches.push({ row, qty });
        }

        if (matches.length) {
          const weightTotal = matches.reduce(
            (sum, match) => sum + money(match.row.unitPrice * match.qty),
            0
          );
          let allocatedRefund = 0;

          matches.forEach((match, index) => {
            const product = ensureProduct(match.row);
            const itemRefund = index === matches.length - 1
              ? event.amount - allocatedRefund
              : money(
                event.amount *
                  (money(match.row.unitPrice * match.qty) / (weightTotal || 1))
              );
            const itemReturnedCost = money(match.row.unitCost * match.qty);
            allocatedRefund += itemRefund;
            product.refunds += itemRefund;
            product.returnedCogs += itemReturnedCost;
            product.returnedQty += match.qty;
            reversedForOrder += itemReturnedCost;
          });
        } else if (orderCost.rows.length) {
          const orderAmount = getOrderAmount(order) || orderCost.totalItemRevenue || 1;
          const costToReverse = money(
            orderCost.totalCost * Math.min(1, event.amount / orderAmount)
          );
          reversedForOrder += costToReverse;
          let allocatedRefund = 0;
          let allocatedCost = 0;

          orderCost.rows.forEach((row, index) => {
            const product = ensureProduct(row);
            const weight = row.revenue / (orderCost.totalItemRevenue || 1);
            const itemRefund = index === orderCost.rows.length - 1
              ? event.amount - allocatedRefund
              : money(event.amount * weight);
            const itemReturnedCost = index === orderCost.rows.length - 1
              ? costToReverse - allocatedCost
              : money(costToReverse * weight);
            allocatedRefund += itemRefund;
            allocatedCost += itemReturnedCost;
            product.refunds += itemRefund;
            product.returnedCogs += itemReturnedCost;
            product.returnedQty += row.qty * Math.min(1, event.amount / orderAmount);
          });
        }
      }

      reversedForOrder = Math.min(orderCost.totalCost, reversedForOrder);
      source.returnedCogs += reversedForOrder;
      returnedCogs += reversedForOrder;
    }

    const revenue = signedMoney(grossRevenue - refunds);
    const cogs = signedMoney(grossCogs - returnedCogs);
    const grossProfit = signedMoney(revenue - cogs);

    return {
      ordersCount: salesOrders.length,
      refundedOrdersCount: correctionContext.correctionsByOrder.size,
      itemsCount,
      grossRevenue: money(grossRevenue),
      refunds: money(refunds),
      revenue,
      grossCogs: money(grossCogs),
      returnedCogs: money(returnedCogs),
      cogs,
      grossProfit,
      grossMarginPercent: pct(grossProfit, revenue),
      costQuality: {
        ...costContext.quality,
        usesEstimatedCosts: costContext.quality.estimatedCostItems > 0,
        hasMissingCosts: costContext.quality.missingCostItems > 0,
      },
      bySource: [...bySource.values()]
        .map((row) => {
          const amount = signedMoney(row.grossAmount - row.refunds);
          const netCogs = signedMoney(row.grossCogs - row.returnedCogs);
          return {
            ...row,
            amount,
            cogs: netCogs,
            grossProfit: signedMoney(amount - netCogs),
            percent: pct(amount, revenue),
          };
        })
        .sort((a, b) => Number(b.grossProfit || 0) - Number(a.grossProfit || 0)),
      byProduct: [...byProduct.values()]
        .map((row) => {
          const netRevenue = signedMoney(row.grossRevenue - row.refunds);
          const netCogs = signedMoney(row.grossCogs - row.returnedCogs);
          const profit = signedMoney(netRevenue - netCogs);
          return {
            ...row,
            qty: Math.max(0, row.qty - row.returnedQty),
            revenue: netRevenue,
            cogs: netCogs,
            grossProfit: profit,
            grossMarginPercent: pct(profit, netRevenue),
          };
        })
        .sort((a, b) => Number(b.grossProfit || 0) - Number(a.grossProfit || 0))
        .slice(0, 30),
    };
  }

  return {
    financeCostKey,
    resolveItemCost,
    summarizeProfitFromOrders,
  };
}

module.exports = { createProfitFacts };
