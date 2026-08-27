'use strict';

const Product = require('../../models/Product');
const { deriveOrderOperationalView } = require('./operationalPresentation');
const { presentAdminOrderListItem } = require('./listPresentation');
const {
  scopeOrderForBranchPresentation,
} = require('../orderBranchPresentationScopeService');

function quantityOf(item) {
  return Number(item?.quantity ?? item?.qty ?? 0) || 0;
}

function productIdOf(item) {
  if (item?.product && typeof item.product === 'object' && item.product._id) {
    return item.product._id;
  }
  return item?.product || item?.productId || item?.id || item?._id || null;
}

function calculateItemSummary(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (summary, item) => {
      const quantity = quantityOf(item);
      const price =
        Number(
          item?.price ??
            item?.unitPrice ??
            item?.priceNumber ??
            item?.product?.price ??
            0
        ) || 0;
      summary.totalItems += quantity;
      summary.subtotal += quantity * price;
      return summary;
    },
    { totalItems: 0, subtotal: 0 }
  );
}

async function enrichOrders(
  docs,
  { branchPresentationScope, populate, ProductModel = Product } = {}
) {
  const getItems = (order) =>
    Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.cart)
        ? order.cart
        : [];
  const scopedDocs = branchPresentationScope
    ? docs.map((order) =>
        scopeOrderForBranchPresentation(order, branchPresentationScope)
      )
    : docs;
  let productMap = new Map();

  if (populate) {
    const productIds = new Set();
    scopedDocs.forEach((order) => {
      getItems(order).forEach((item) => {
        const productId = productIdOf(item);
        if (productId) productIds.add(String(productId));
      });
    });

    if (productIds.size) {
      const products = await ProductModel.find({
        _id: { $in: Array.from(productIds) },
      })
        .select('title price image slug sku')
        .lean();
      productMap = new Map(
        products.map((product) => [String(product._id), product])
      );
    }
  }

  return scopedDocs.map((order) => {
    const sourceItems = getItems(order);
    const items = populate
      ? sourceItems.map((item) => {
          const productId = productIdOf(item);
          return {
            ...item,
            product: productId ? productMap.get(String(productId)) || null : null,
          };
        })
      : sourceItems;
    const summary = order.summary || calculateItemSummary(items);

    return presentAdminOrderListItem(order, {
      items,
      summary,
      operational: deriveOrderOperationalView(order),
    });
  });
}

module.exports = {
  calculateItemSummary,
  enrichOrders,
  productIdOf,
  quantityOf,
};
