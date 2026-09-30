'use strict';

const Product = require('../models/Product');
const Branch = require('../models/Branch');
const { normalizeProductVariants } = require('../lib/products/productVariantConfig');
const {
  createManualOrder,
  manualBranchFilter,
  prepareQuote,
} = require('../services/manualOrderCreationService');

function errorResponse(res, error) {
  if (error.statusCode || error.status) {
    return res.status(error.statusCode || error.status).json({
      ok: false,
      error: error.code || 'MANUAL_ORDER_INVALID',
      message: error.message,
    });
  }
  console.error('No se pudo procesar el pedido manual:', error);
  return res.status(500).json({
    ok: false, error: 'MANUAL_ORDER_FAILED',
    message: 'No se pudo procesar el pedido. Intenta nuevamente.',
  });
}

async function listManualOrderBranches(req, res) {
  try {
    const branches = await Branch.find(manualBranchFilter(req))
      .select('name code isMain settings.allowInventoryMovements')
      .sort({ isMain: -1, name: 1 }).lean();
    return res.json({ ok: true, branches });
  } catch (error) { return errorResponse(res, error); }
}

async function listManualOrderProducts(req, res) {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const filter = { active: true, visible: true, archivedAt: null };
    if (q) filter.$or = [
      { title: regex }, { sku: regex }, { barcode: regex },
      { 'variants.sku': regex }, { 'variants.barcode': regex },
    ];
    const products = await Product.find(filter)
      .select('title price sku variants sizes colors stock productType')
      .sort({ title: 1 }).limit(30).lean();
    return res.json({ ok: true, products: products.map((product) => ({
      _id: product._id,
      title: product.title,
      sku: product.sku,
      price: product.price,
      productType: product.productType,
      variants: normalizeProductVariants(product.variants, product)
        .filter((variant) => variant.active !== false)
        .map((variant) => ({
          variantKey: variant.variantKey,
          label: variant.label,
          price: variant.price ?? product.price,
          size: variant.size,
          color: variant.color,
          attributes: variant.attributes,
        })),
    })) });
  } catch (error) { return errorResponse(res, error); }
}

async function previewManualOrder(req, res) {
  try {
    const { pricing, reservationRequired } = await prepareQuote(req, req.body || {});
    return res.json({ ok: true, pricing, reservationRequired });
  } catch (error) { return errorResponse(res, error); }
}

async function postManualOrder(req, res) {
  try {
    const { order, reused } = await createManualOrder(req, req.body || {});
    return res.status(reused ? 200 : 201).json({
      ok: true, reused, order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        branch: order.branch,
        paymentStatus: order.payment?.status,
        reservationExpiresAt: order.inventoryControl?.reservationExpiresAt || null,
      },
    });
  } catch (error) { return errorResponse(res, error); }
}

module.exports = {
  listManualOrderBranches,
  listManualOrderProducts,
  previewManualOrder,
  postManualOrder,
};
