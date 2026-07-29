// backend/routes/productRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const cloudinary = require('cloudinary').v2;
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  PRODUCT_TYPE_VALUES,
  UNIT_OF_MEASURE_VALUES,
  normalizeProductType,
  normalizeUnitOfMeasure,
  normalizeVariantPreset,
  normalizeVariantAxes,
  shouldTrackInventory,
} = require('../lib/products/productUniversalConfig');
const {
  PUBLIC_PRODUCT_PROJECTION,
  buildPublicProductFilter,
  serializePublicProduct,
} = require('../lib/products/productPublicView');

// ✅ Cloudinary (usa tus variables del .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper Cloudinary
function getPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  let rest = url.slice(i + marker.length);
  rest = rest.replace(/^v\d+\//, '');
  rest = rest.split(/[?#]/)[0];
  const lastDot = rest.lastIndexOf('.');
  if (lastDot > -1) rest = rest.slice(0, lastDot);
  return rest;
}

// ✅ Normaliza arrays de strings (trim + de-dup + quita vacíos)
function sanitizeStrArray(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const v = String(x || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

// ✅ Normaliza inventory recibido del cliente
function sanitizeInventory(inv) {
  if (!Array.isArray(inv)) return [];
  return inv
    .map((row) => ({
      size: String(row?.size || '').trim(),
      color: String(row?.color || '').trim(),
      stock: Math.max(0, Number(row?.stock || 0)),
    }))
    // Debe venir al menos size o color (evita filas vacías)
    .filter((r) => r.size || r.color);
}

// ✅ Valida duplicados (color+size) en inventory
function hasInventoryDuplicates(inv) {
  const set = new Set();
  for (const r of inv) {
    const key = `${(r.color || '').toLowerCase()}|${(r.size || '').toLowerCase()}`;
    if (set.has(key)) return true;
    set.add(key);
  }
  return false;
}

// ✅ Suma total de stock desde inventory
function totalStockFromInventory(inv) {
  let total = 0;
  for (const r of inv) total += Math.max(0, Number(r.stock || 0));
  return total;
}

function parseBoolean(value, fallback = undefined) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function buildProductConfigPayload(body = {}, fallbackProductType = 'physical') {
  const productType = normalizeProductType(body.productType || fallbackProductType);
  const trackInventory = shouldTrackInventory(
    productType,
    parseBoolean(body.trackInventory, undefined)
  );
  const variantPreset = normalizeVariantPreset(body.variantPreset);

  return {
    productType,
    unitOfMeasure: normalizeUnitOfMeasure(body.unitOfMeasure),
    trackInventory,
    allowBackorder: parseBoolean(body.allowBackorder, false) === true,
    variantPreset,
    variantAxes: normalizeVariantAxes(body.variantAxes, variantPreset),
  };
}

function getObjectId(value) {
  try {
    const id = typeof value === 'object' ? value?._id || value?.id : value;
    const text = String(id || '').trim();
    return mongoose.Types.ObjectId.isValid(text) ? new mongoose.Types.ObjectId(text) : null;
  } catch {
    return null;
  }
}

async function buildInventorySummaryMap(products = []) {
  const ids = products
    .map((product) => getObjectId(product?._id))
    .filter(Boolean);

  if (!ids.length) return new Map();

  const rows = await InventoryStock.aggregate([
    {
      $match: {
        product: { $in: ids },
        deletedAt: null,
        active: { $ne: false },
      },
    },
    {
      $group: {
        _id: '$product',
        stock: { $sum: { $ifNull: ['$stock', 0] } },
        reservedStock: { $sum: { $ifNull: ['$reservedStock', 0] } },
        availableStock: { $sum: { $ifNull: ['$availableStock', 0] } },
        variantsCount: { $sum: 1 },
        branches: { $addToSet: '$branch' },
        lowStockCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: [{ $ifNull: ['$reorderPoint', 0] }, 0] },
                  { $lte: [{ $ifNull: ['$availableStock', 0] }, { $ifNull: ['$reorderPoint', 0] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const map = new Map();

  for (const row of rows) {
    map.set(String(row._id), {
      stock: Number(row.stock || 0),
      reservedStock: Number(row.reservedStock || 0),
      availableStock: Number(row.availableStock || 0),
      variantsCount: Number(row.variantsCount || 0),
      branchesCount: Array.isArray(row.branches) ? row.branches.length : 0,
      lowStockCount: Number(row.lowStockCount || 0),
      source: 'InventoryStock',
    });
  }

  return map;
}

function serializeAdminProduct(product, inventorySummaryMap = new Map()) {
  const plain = product?.toObject ? product.toObject({ virtuals: true }) : { ...product };
  const productId = String(plain?._id || '');
  const inventorySummary =
    inventorySummaryMap.get(productId) ||
    {
      stock: Number(plain.stock || 0),
      reservedStock: 0,
      availableStock: Number(plain.stock || 0),
      variantsCount: Array.isArray(plain.inventory) ? plain.inventory.length : 0,
      branchesCount: 0,
      lowStockCount: 0,
      source: 'Product.stock',
    };

  const price = Number(plain.price || 0);
  const cost = Number(plain.cost || 0);
  const marginValue = Math.max(0, price - cost);
  const marginPercent = price > 0 ? Math.round((marginValue / price) * 10000) / 100 : 0;

  return {
    ...plain,
    productType: normalizeProductType(plain.productType),
    unitOfMeasure: normalizeUnitOfMeasure(plain.unitOfMeasure),
    trackInventory: shouldTrackInventory(plain.productType, plain.trackInventory),
    inventorySummary,
    stock: inventorySummary.stock,
    reservedStock: inventorySummary.reservedStock,
    availableStock: inventorySummary.availableStock,
    financialSummary: {
      price,
      cost,
      marginValue,
      marginPercent,
    },
  };
}

// GET /api/products (catálogo público: siempre activos y visibles)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find(buildPublicProductFilter())
      .select(PUBLIC_PRODUCT_PROJECTION)
      .lean();

    res.json(products.map(serializePublicProduct));
  } catch (error) {
    console.error('❌ Error al obtener productos:', error.message);
    res.status(500).json({ message: 'Error al obtener productos' });
  }
});

/**
 * ✅ GET /api/products/slug/:slug
 * Busca por slug único (el modelo ya garantiza unicidad parcial).
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return res.status(400).json({ message: 'slug inválido' });
    }
    const product = await Product.findOne(
      buildPublicProductFilter({ slug: String(slug).trim() })
    )
      .select(PUBLIC_PRODUCT_PROJECTION)
      .lean();

    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json(serializePublicProduct(product));
  } catch (error) {
    console.error('❌ Error al obtener producto por slug:', error.message);
    res.status(500).json({ message: 'Error al obtener el producto' });
  }
});

// ✅ GET /api/products/admin/reviews
//    PROTEGIDO: solo admin
//    Devuelve todas las reseñas de todos los productos en una sola lista
router.get('/admin/reviews', requireAdmin, async (req, res) => {
  try {
    const products = await Product.find(
      { reviews: { $exists: true, $ne: [] } },
      {
        _id: 1,
        title: 1,
        slug: 1,
        image: 1,
        reviews: 1,
      }
    ).lean();

    const reviews = [];

    for (const product of products) {
      const productReviews = Array.isArray(product?.reviews) ? product.reviews : [];

      for (const review of productReviews) {
        reviews.push({
          reviewId: String(review?._id || ''),
          productId: String(product?._id || ''),
          productTitle: product?.title || '',
          productSlug: product?.slug || '',
          productImage: product?.image || '',
          name: review?.name || '',
          comment: review?.comment || '',
          rating: Number(review?.rating || 0),
          createdAt: review?.createdAt || null,
        });
      }
    }

    reviews.sort((a, b) => {
      const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });

    res.json({
      total: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error('❌ Error al obtener reseñas admin:', error.message);
    res.status(500).json({ message: 'Error al obtener las reseñas' });
  }
});

// ✅ GET /api/products/admin/list
//    Vista administrativa enriquecida con inventario real y resumen financiero.
router.get('/admin/list', requireAdmin, async (req, res) => {
  try {
    const { all = '1', q = '', productType = 'all' } = req.query;
    const filter = all === '1' ? {} : { active: true };

    const cleanQ = String(q || '').trim();
    if (cleanQ) {
      const regex = new RegExp(cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { title: regex },
        { description: regex },
        { sku: regex },
        { category: regex },
        { categories: regex },
        { barcode: regex },
      ];
    }

    const normalizedType = normalizeProductType(productType);
    if (productType !== 'all' && PRODUCT_TYPE_VALUES.includes(normalizedType)) {
      filter.productType = normalizedType;
    }

    const products = await Product.find(filter).sort({ createdAt: -1, title: 1 });
    const inventorySummaryMap = await buildInventorySummaryMap(products);

    res.json({
      ok: true,
      total: products.length,
      data: products.map((product) => serializeAdminProduct(product, inventorySummaryMap)),
    });
  } catch (error) {
    console.error('❌ Error al obtener productos admin:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener productos administrativos' });
  }
});

// ✅ GET /api/products/admin/:id
//    Detalle administrativo completo, incluso para productos inactivos.
router.get('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const value = String(req.params.id || '').trim();

    if (!value) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const isValidObjectId =
      value.length === 24 && /^[0-9a-fA-F]+$/.test(value);
    const identityFilter = isValidObjectId
      ? { $or: [{ _id: value }, { slug: value }] }
      : { slug: value };

    const product = await Product.findOne(identityFilter);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const inventorySummaryMap = await buildInventorySummaryMap([product]);
    return res.json(serializeAdminProduct(product, inventorySummaryMap));
  } catch (error) {
    console.error('❌ Error al obtener producto admin:', error.message);
    return res.status(500).json({
      message: 'Error al obtener el producto administrativo',
    });
  }
});

// ✅ POST /api/products (crear)
//    PROTEGIDO: solo admin con permiso products:create
router.post(
  '/',
  requireAdmin,
  requirePermission('products:create'),
  async (req, res) => {
    try {
      const {
        sku, // opcional (si no viene, lo genera el modelo con Counter)
        title,
        price,
        description,
        image,
        images,
        stock,
        active,
        originalPrice,
        features,
        colors,
        category,
        categories,

        // inventario heredado
        sizes,
        inventory,

        reorderPoint,
        reorderQty,
        warehouseLocation,
        weightGrams,
        dimensionsCm,
        cost,
        averageCost,
        taxRate,
        taxIncluded,
        brand,
        season,
        supplier,
        barcode,
        notes,
      } = req.body;

      if (!title) return res.status(400).json({ message: 'title es requerido' });

      if (price == null || Number.isNaN(Number(price))) {
        return res.status(400).json({ message: 'price inválido' });
      }

      const productConfig = buildProductConfigPayload(req.body);
      const preInv = productConfig.trackInventory ? sanitizeInventory(inventory) : [];

      if (hasInventoryDuplicates(preInv)) {
        return res.status(400).json({
          message: 'Inventory tiene combinaciones duplicadas (color+size)',
        });
      }

      const doc = new Product({
        sku: typeof sku === 'string' && sku.trim() ? sku.trim() : undefined,
        title: String(title).trim(),
        price: Math.max(0, Number(price)),
        description: description ?? '',
        image: image ?? '',
        images: Array.isArray(images) ? images.slice(0, 5) : [],
        stock:
          productConfig.trackInventory && stock != null
            ? Math.max(0, Number(stock))
            : productConfig.trackInventory && preInv.length
              ? totalStockFromInventory(preInv)
              : 0,
        active: typeof active === 'boolean' ? active : true,
        originalPrice:
          originalPrice != null ? Math.max(0, Number(originalPrice)) : undefined,
        features: Array.isArray(features) ? features : [],
        colors: Array.isArray(colors) ? colors.slice(0, 10) : [],
        category: category ?? undefined,
        categories: sanitizeStrArray(categories),

        sizes: productConfig.trackInventory && Array.isArray(sizes) ? sizes : [],
        inventory: preInv,

        productType: productConfig.productType,
        unitOfMeasure: productConfig.unitOfMeasure,
        trackInventory: productConfig.trackInventory,
        allowBackorder: productConfig.allowBackorder,
        variantPreset: productConfig.variantPreset,
        variantAxes: productConfig.variantAxes,

        reorderPoint:
          reorderPoint != null ? Math.max(0, Number(reorderPoint)) : undefined,
        reorderQty:
          reorderQty != null ? Math.max(0, Number(reorderQty)) : undefined,
        warehouseLocation: warehouseLocation ?? '',
        weightGrams:
          weightGrams != null ? Math.max(0, Number(weightGrams)) : undefined,

        dimensionsCm:
          dimensionsCm &&
          (Number(dimensionsCm?.l) ||
            Number(dimensionsCm?.w) ||
            Number(dimensionsCm?.h))
            ? {
                l: Math.max(0, Number(dimensionsCm.l || 0)),
                w: Math.max(0, Number(dimensionsCm.w || 0)),
                h: Math.max(0, Number(dimensionsCm.h || 0)),
              }
            : undefined,

        cost: cost != null ? Math.max(0, Number(cost)) : undefined,
        averageCost:
          averageCost != null ? Math.max(0, Number(averageCost)) : undefined,
        taxRate:
          taxRate != null
            ? Math.min(100, Math.max(0, Number(taxRate)))
            : undefined,
        taxIncluded: typeof taxIncluded === 'boolean' ? taxIncluded : undefined,

        brand: brand ?? '',
        season: season ?? '',
        supplier:
          supplier && typeof supplier === 'object'
            ? { name: String(supplier.name || '').trim() }
            : undefined,
        barcode: barcode ?? '',
        notes: notes ?? '',
      });

      const saved = await doc.save();

      return res.status(201).json(saved);
    } catch (error) {
      console.error('❌ Error al crear producto:', error);

      if (error?.code === 11000 && error?.keyPattern) {
        if (error.keyPattern.sku) {
          return res.status(409).json({
            message: 'SKU duplicado. Intenta con otro SKU.',
          });
        }

        if (error.keyPattern.slug) {
          return res.status(409).json({
            message: 'Slug duplicado. Cambia el título.',
          });
        }

        if (error.keyPattern.barcode) {
          return res.status(409).json({
            message: 'Barcode duplicado.',
          });
        }
      }

      res.status(500).json({ message: 'Error al crear producto' });
    }
  }
);

// ✅ POST /api/products/:id/reviews
//    Guarda una reseña en el producto por id o slug
router.post('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const value = String(id || '').trim();

    if (!value) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const name = String(req.body?.name || '').trim();
    const comment = String(req.body?.comment || '').trim();
    const rating = Number(req.body?.rating);

    if (!name) {
      return res.status(400).json({ message: 'El nombre es obligatorio' });
    }

    if (!comment) {
      return res.status(400).json({ message: 'El comentario es obligatorio' });
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'La calificación debe estar entre 1 y 5' });
    }

    const isValidObjectId =
      value.length === 24 && /^[0-9a-fA-F]+$/.test(value);

    const identityFilter = isValidObjectId
      ? { $or: [{ _id: value }, { slug: value }] }
      : { slug: value };

    const product = await Product.findOne(
      buildPublicProductFilter(identityFilter)
    );

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (!Array.isArray(product.reviews)) {
      product.reviews = [];
    }

    product.reviews.push({
      name,
      rating,
      comment,
      createdAt: new Date(),
    });

    await product.save();

    res.status(201).json({
      message: 'Reseña guardada correctamente',
      reviews: product.reviews,
    });
  } catch (error) {
    console.error('❌ Error al guardar reseña:', error.message);
    res.status(500).json({ message: 'Error al guardar la reseña' });
  }
});

// ✅ DELETE /api/products/:id/reviews/:reviewId
//    PROTEGIDO: solo admin
//    Elimina una reseña específica de un producto
router.delete('/:id/reviews/:reviewId', requireAdmin, async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const value = String(id || '').trim();
    const safeReviewId = String(reviewId || '').trim();

    if (!value) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (!safeReviewId) {
      return res.status(400).json({ message: 'reviewId inválido' });
    }

    const isValidObjectId =
      value.length === 24 && /^[0-9a-fA-F]+$/.test(value);

    let product = null;

    if (isValidObjectId) {
      product = await Product.findById(value);
    }

    if (!product) {
      product = await Product.findOne({ slug: value });
    }

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const reviews = Array.isArray(product.reviews) ? product.reviews : [];
    const reviewExists = reviews.some(
      (review) => String(review?._id || '') === safeReviewId
    );

    if (!reviewExists) {
      return res.status(404).json({ message: 'Reseña no encontrada' });
    }

    product.reviews = reviews.filter(
      (review) => String(review?._id || '') !== safeReviewId
    );

    await product.save();

    res.json({
      message: 'Reseña eliminada correctamente',
      reviews: product.reviews,
    });
  } catch (error) {
    console.error('❌ Error al eliminar reseña:', error.message);
    res.status(500).json({ message: 'Error al eliminar la reseña' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const value = String(id || '').trim();

    if (!value) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const isValidObjectId =
      value.length === 24 && /^[0-9a-fA-F]+$/.test(value);

    const identityFilter = isValidObjectId
      ? { $or: [{ _id: value }, { slug: value }] }
      : { slug: value };

    const product = await Product.findOne(
      buildPublicProductFilter(identityFilter)
    )
      .select(PUBLIC_PRODUCT_PROJECTION)
      .lean();

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(serializePublicProduct(product));
  } catch (error) {
    console.error('❌ Error al obtener producto por ID/slug:', error.message);
    res.status(500).json({ message: 'Error al obtener el producto' });
  }
});

// ✅ PUT /api/products/:id (editar)
//    PROTEGIDO: solo admin con permiso products:update
router.put(
  '/:id',
  requireAdmin,
  requirePermission('products:update'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const mode = (req.query.mode || 'replace').toString().toLowerCase(); // replace | merge
      const regenSku = req.query.regenSku === '1' || req.query.regenSku === 'true';

      const isValid = id && id.length === 24 && /^[0-9a-fA-F]+$/.test(id);

      if (!isValid) {
        return res.status(404).json({
          message: 'Producto no encontrado (id inválido)',
        });
      }

      const prod = await Product.findById(id);

      if (!prod) {
        return res.status(404).json({
          message: 'Producto no encontrado',
        });
      }

      const {
        // sku,  // ❌ no editable directamente
        title,
        price,
        originalPrice,
        description,
        image,
        images,
        colors,
        sizes,
        inventory,
        stock,
        active,
        category,
        categories,
        features,

        reorderPoint,
        reorderQty,
        warehouseLocation,
        weightGrams,
        dimensionsCm,
        cost,
        averageCost,
        taxRate,
        taxIncluded,
        brand,
        season,
        supplier,
        barcode,
        notes,
      } = req.body;

      const provided = (v) =>
        v !== undefined &&
        v !== null &&
        !(typeof v === 'string' && v.trim() === '');

      const productConfig = buildProductConfigPayload(req.body, prod.productType || 'physical');

      // Detectar cambio de categoría
      const incomingCategory = provided(category) ? String(category) : undefined;

      const categoryChanged =
        typeof incomingCategory === 'string' &&
        String(prod.category || '') !== incomingCategory;

      // ✅ Lista blanca y normalizaciones
      if (provided(title)) prod.title = String(title).trim();

      if (provided(price)) {
        const n = Number(price);

        if (Number.isNaN(n)) {
          return res.status(400).json({
            message: 'price inválido',
          });
        }

        prod.price = Math.max(0, n);
      }

      if (provided(originalPrice)) {
        const n = Number(originalPrice);

        if (Number.isNaN(n)) {
          return res.status(400).json({
            message: 'originalPrice inválido',
          });
        }

        prod.originalPrice = Math.max(0, n);
      }

      if (provided(description)) prod.description = description;
      if (provided(image)) prod.image = image;
      if (Array.isArray(images)) prod.images = images.slice(0, 5);

      if (provided(category)) prod.category = category;
      if (Array.isArray(categories)) prod.categories = sanitizeStrArray(categories);

      if (Array.isArray(features)) prod.features = features;
      if (Array.isArray(colors)) prod.colors = colors.slice(0, 10);
      if (Array.isArray(sizes)) prod.sizes = productConfig.trackInventory ? sizes : [];

      prod.productType = productConfig.productType;
      prod.unitOfMeasure = productConfig.unitOfMeasure;
      prod.trackInventory = productConfig.trackInventory;
      prod.allowBackorder = productConfig.allowBackorder;
      prod.variantPreset = productConfig.variantPreset;
      prod.variantAxes = productConfig.variantAxes;

      if (productConfig.trackInventory && provided(stock)) {
        const n = Number(stock);

        if (Number.isNaN(n)) {
          return res.status(400).json({
            message: 'stock inválido',
          });
        }

        prod.stock = Math.max(0, n);
      }

      if (!productConfig.trackInventory) {
        prod.stock = 0;
        prod.inventory = [];
        prod.sizes = [];
      }

      if (typeof active === 'boolean') prod.active = active;

      // inventario / contabilidad
      if (provided(reorderPoint)) {
        prod.reorderPoint = Math.max(0, Number(reorderPoint) || 0);
      }

      if (provided(reorderQty)) {
        prod.reorderQty = Math.max(0, Number(reorderQty) || 0);
      }

      if (provided(warehouseLocation)) prod.warehouseLocation = warehouseLocation;

      if (provided(weightGrams)) {
        prod.weightGrams = Math.max(0, Number(weightGrams) || 0);
      }

      if (
        dimensionsCm &&
        (Number(dimensionsCm?.l) ||
          Number(dimensionsCm?.w) ||
          Number(dimensionsCm?.h))
      ) {
        prod.dimensionsCm = {
          l: Math.max(0, Number(dimensionsCm.l || 0)),
          w: Math.max(0, Number(dimensionsCm.w || 0)),
          h: Math.max(0, Number(dimensionsCm.h || 0)),
        };
      }

      if (provided(cost)) prod.cost = Math.max(0, Number(cost) || 0);

      if (provided(averageCost)) {
        prod.averageCost = Math.max(0, Number(averageCost) || 0);
      }

      if (provided(taxRate)) {
        prod.taxRate = Math.min(100, Math.max(0, Number(taxRate) || 0));
      }

      if (typeof taxIncluded === 'boolean') prod.taxIncluded = taxIncluded;

      if (provided(brand)) prod.brand = brand;
      if (provided(season)) prod.season = season;

      if (supplier && typeof supplier === 'object') {
        prod.supplier = {
          name: String(supplier.name || '').trim(),
        };
      }

      if (provided(barcode)) prod.barcode = barcode;
      if (provided(notes)) prod.notes = notes;

      // ✅ INVENTARIO: replace (por defecto) o merge
      if (productConfig.trackInventory && Array.isArray(inventory)) {
        const sanitized = sanitizeInventory(inventory);

        if (hasInventoryDuplicates(sanitized)) {
          return res.status(400).json({
            message: 'Inventory tiene combinaciones duplicadas (color+size)',
          });
        }

        if (mode === 'merge') {
          // fusiona por clave color|size
          const map = new Map();

          // carga actual
          for (const r of sanitizeInventory(prod.inventory || [])) {
            const key = `${(r.color || '').toLowerCase()}|${(r.size || '').toLowerCase()}`;
            map.set(key, { ...r });
          }

          // sobrescribe con lo nuevo
          for (const r of sanitized) {
            const key = `${(r.color || '').toLowerCase()}|${(r.size || '').toLowerCase()}`;
            map.set(key, { ...r });
          }

          prod.inventory = Array.from(map.values());
        } else {
          // replace
          prod.inventory = sanitized;
        }

        // Si no envían stock pero sí inventory, sincroniza stock total
        if (!provided(stock)) {
          prod.stock = totalStockFromInventory(prod.inventory);
        }
      }

      // ✅ Regenerar SKU: usa el hook del modelo (Counter) para coherencia
      if (categoryChanged || regenSku) {
        // limpiar sku para que pre('validate') lo regenere con tu lógica de Counter
        prod.sku = undefined;
      }

      // Guarda con hooks (pre('validate') y pre('save') del modelo)
      const updated = await prod.save();

      return res.json(updated);
    } catch (error) {
      console.error('❌ Error al actualizar producto:', error);

      // Manejo fino de duplicados de índices únicos
      if (error?.code === 11000 && error?.keyPattern) {
        if (error.keyPattern.sku) {
          return res.status(409).json({
            message: 'SKU duplicado.',
          });
        }

        if (error.keyPattern.slug) {
          return res.status(409).json({
            message: 'Slug duplicado. Cambia el título.',
          });
        }

        if (error.keyPattern.barcode) {
          return res.status(409).json({
            message: 'Barcode duplicado.',
          });
        }
      }

      if (error?.name === 'ValidationError') {
        return res.status(400).json({
          message: error.message,
        });
      }

      res.status(500).json({
        message: 'Error al actualizar producto',
      });
    }
  }
);

// ✅ DELETE /api/products/:id (borra producto + imágenes de Cloudinary)
//    PROTEGIDO: solo admin con permiso products:delete
router.delete(
  '/:id',
  requireAdmin,
  requirePermission('products:delete'),
  async (req, res) => {
    try {
      const prod = await Product.findById(req.params.id);

      if (!prod) {
        return res.status(404).json({
          message: 'Producto no encontrado',
        });
      }

      const urls = [
        ...(prod.image ? [prod.image] : []),
        ...(Array.isArray(prod.images) ? prod.images : []),
      ];

      const publicIds = urls.map(getPublicIdFromUrl).filter(Boolean);

      if (publicIds.length) {
        await Promise.all(
          publicIds.map((pid) =>
            cloudinary.uploader.destroy(pid).catch(() => null)
          )
        );
      }

      await Product.findByIdAndDelete(req.params.id);

      res.json({
        message: 'Producto e imágenes eliminados correctamente',
      });
    } catch (error) {
      console.error('❌ Error al eliminar producto:', error.message);

      res.status(500).json({
        message: 'Error al eliminar producto',
      });
    }
  }
);

module.exports = router;
