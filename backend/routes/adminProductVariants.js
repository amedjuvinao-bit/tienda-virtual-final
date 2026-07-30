// backend/routes/adminProductVariants.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Product = require('../models/Product');
const { normalizeProductVariants } = require('../lib/products/productVariantConfig');
const { buildLegacyFromVariants } = require('../lib/products/productVariantLegacy');
const {
  ProductInventoryPersistenceError,
  saveProductWithInventoryTransaction,
} = require('../services/productInventoryPersistenceService');

const router = express.Router();

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function sendProductNotFound(res) {
  return res.status(404).json({
    ok: false,
    message: 'Producto no encontrado.',
  });
}

router.use(requireAdmin);

// GET /api/admin/product-variants/:productId
router.get('/:productId', requirePermission('products:view'), async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) return sendProductNotFound(res);

    const product = await Product.findOne({
      _id: productId,
      archivedAt: null,
    }).lean();
    if (!product) return sendProductNotFound(res);

    return res.json({
      ok: true,
      product: {
        id: String(product._id),
        title: product.title || '',
        sku: product.sku || '',
        price: Number(product.price || 0),
        cost: Number(product.cost || product.averageCost || 0),
        image: product.image || '',
        variantPreset: product.variantPreset || 'none',
        variantAxes: Array.isArray(product.variantAxes)
          ? product.variantAxes
          : [],
      },
      variants: normalizeProductVariants(product.variants || [], product),
    });
  } catch (error) {
    console.error('[adminProductVariants] GET error:', error);
    return res.status(500).json({
      ok: false,
      message: 'No se pudieron consultar las variantes del producto.',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
});

// PUT /api/admin/product-variants/:productId
router.put('/:productId', requirePermission('products:update'), async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) return sendProductNotFound(res);

    const product = await Product.findOne({
      _id: productId,
      archivedAt: null,
    });
    if (!product) return sendProductNotFound(res);

    const incomingVariants = Array.isArray(req.body?.variants) ? req.body.variants : [];
    const productContext = {
      _id: product._id,
      title: product.title,
      sku: product.sku,
      price: product.price,
      cost: product.cost,
      averageCost: product.averageCost,
      image: product.image,
      images: product.images,
      inventory: product.inventory,
      sizes: product.sizes,
      colors: product.colors,
      stock: product.stock,
      trackInventory: product.trackInventory,
    };
    const legacy = buildLegacyFromVariants(
      incomingVariants,
      productContext
    );
    const normalizedVariants = legacy.variants;

    const syncLegacy = req.body?.syncLegacy !== false;

    product.variants = normalizedVariants;
    if (Array.isArray(req.body?.variantAxes)) {
      product.variantAxes = req.body.variantAxes;
    }
    product.$locals = product.$locals || {};
    product.$locals.adminId = req.adminUserId || null;
    product.$locals.variantsAuthoritative = true;

    if (syncLegacy) {
      product.sizes = legacy.sizes;
      product.colors = legacy.colors;
      product.inventory = legacy.inventory;
    }

    const saved = await saveProductWithInventoryTransaction(
      product,
      {
        adminId: req.adminUserId || null,
        variantsAuthoritative: true,
      }
    );

    return res.json({
      ok: true,
      message: 'Variantes actualizadas correctamente.',
      variants: normalizeProductVariants(saved.variants || [], saved.toObject ? saved.toObject() : saved),
      sync: saved?.$locals?.inventorySyncResult || null,
    });
  } catch (error) {
    console.error('[adminProductVariants] PUT error:', error);

    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }

    if (error instanceof ProductInventoryPersistenceError) {
      return res.status(error.status || 500).json({
        ok: false,
        message:
          'No se actualizaron las variantes porque no fue posible confirmar el inventario. No se aplicó ningún cambio.',
        code: error.code,
      });
    }

    return res.status(500).json({
      ok: false,
      message: 'No se pudieron actualizar las variantes del producto.',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  }
});

module.exports = router;
