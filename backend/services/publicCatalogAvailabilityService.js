'use strict';

const mongoose = require('mongoose');
const InventoryStock = require('../models/InventoryStock');
const { normalizeProductType } = require('../lib/products/productUniversalConfig');
const cleanKey = value => String(value || 'default__default').trim().toLowerCase();
const tracksInventory = product => product.trackInventory !== false && !['digital', 'service'].includes(normalizeProductType(product.productType));

// One inventory query per bounded page; never one query per product or variant.
async function attachPublicCatalogAvailability(products = [], { StockModel = InventoryStock } = {}) {
  const ids = products.filter(tracksInventory).map(p => p._id).filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
  const rows = ids.length ? await StockModel.aggregate([
    { $match: { product: { $in: ids }, deletedAt: null, active: { $ne: false } } },
    { $group: { _id: { product: '$product', variantKey: '$variantKey' }, availableStock: { $sum: { $ifNull: ['$availableStock', 0] } } } },
  ]) : [];
  const stock = new Map();
  for (const row of rows) {
    const id = String(row._id.product);
    if (!stock.has(id)) stock.set(id, new Map());
    stock.get(id).set(cleanKey(row._id.variantKey), Math.max(0, Number(row.availableStock || 0)));
  }
  return products.map(product => {
    const tracked = tracksInventory(product), variantsStock = stock.get(String(product._id)) || new Map();
    const availableStock = tracked ? [...variantsStock.values()].reduce((a, b) => a + b, 0) : null;
    return { ...product, inventoryTracked: tracked, availableStock,
      ...(tracked ? { stock: availableStock } : {}),
      variants: Array.isArray(product.variants) ? product.variants.map(variant => ({ ...variant, availableStock: tracked ? variantsStock.get(cleanKey(variant.variantKey || variant.variantId)) || 0 : null })) : product.variants,
    };
  });
}
module.exports = { attachPublicCatalogAvailability };
