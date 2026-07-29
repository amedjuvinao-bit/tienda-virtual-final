// backend/routes/productRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
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
const {
  buildLegacyFromVariants,
} = require('../lib/products/productVariantLegacy');
const {
  archiveProductSafely,
  archiveProductsSafely,
} = require('../services/productArchiveService');
const {
  ProductCatalogInputError,
  listAdminProducts,
  normalizeProductIds,
  updateProductsInBulk,
} = require('../services/adminProductCatalogService');
const {
  ProductTaxonomyInputError,
  archiveProductTaxonomy,
  createProductTaxonomy,
  listProductTaxonomies,
  resolveProductTaxonomyPayload,
  serializeTaxonomies,
  updateProductTaxonomy,
} = require('../services/productTaxonomyService');
const {
  normalizeCommercialFields,
  normalizeSeo,
  normalizeStringArray: normalizeCommercialStringArray,
} = require('../lib/products/productCommercialConfig');

const PUBLIC_TAXONOMY_POPULATE = [
  {
    path: 'primaryCategoryRef',
    select: 'kind name slug description image parent',
  },
  {
    path: 'categoryRefs',
    select: 'kind name slug description image parent',
  },
  {
    path: 'collectionRefs',
    select: 'kind name slug description image',
  },
];

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
    plain.inventorySummary ||
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
      .populate(PUBLIC_TAXONOMY_POPULATE)
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
      .populate(PUBLIC_TAXONOMY_POPULATE)
      .lean();

    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json(serializePublicProduct(product));
  } catch (error) {
    console.error('❌ Error al obtener producto por slug:', error.message);
    res.status(500).json({ message: 'Error al obtener el producto' });
  }
});

function sendTaxonomyError(res, error, fallbackMessage) {
  if (error instanceof ProductTaxonomyInputError) {
    return res.status(error.status || 400).json({
      ok: false,
      message: error.message,
    });
  }

  if (error?.name === 'ValidationError') {
    return res.status(400).json({
      ok: false,
      message: error.message,
    });
  }

  console.error(fallbackMessage, error.message);
  return res.status(500).json({
    ok: false,
    message: 'No fue posible procesar la clasificación.',
  });
}

// GET /api/products/admin/taxonomy
// Catálogo jerárquico usado por el formulario administrativo.
router.get(
  '/admin/taxonomy',
  requireAdmin,
  requirePermission('products:view'),
  async (req, res) => {
    try {
      const result = await listProductTaxonomies({
        includeInactive:
          req.query.includeInactive === '1' ||
          req.query.includeInactive === 'true',
      });

      return res.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      return sendTaxonomyError(
        res,
        error,
        'Error al listar categorías y colecciones:'
      );
    }
  }
);

// POST /api/products/admin/taxonomy
// Crea categorías, subcategorías o colecciones sin salir del producto.
router.post(
  '/admin/taxonomy',
  requireAdmin,
  requirePermission('products:update'),
  async (req, res) => {
    try {
      const created = await createProductTaxonomy(req.body || {});
      const catalog = await listProductTaxonomies({
        includeInactive: true,
      });
      const item = [
        ...catalog.categories,
        ...catalog.collections,
      ].find((entry) => entry._id === String(created._id));

      return res.status(201).json({
        ok: true,
        item:
          item ||
          serializeTaxonomies([created.toObject()])[0],
      });
    } catch (error) {
      return sendTaxonomyError(
        res,
        error,
        'Error al crear clasificación:'
      );
    }
  }
);

router.put(
  '/admin/taxonomy/:taxonomyId',
  requireAdmin,
  requirePermission('products:update'),
  async (req, res) => {
    try {
      const updated = await updateProductTaxonomy(
        req.params.taxonomyId,
        req.body || {}
      );

      return res.json({
        ok: true,
        item: serializeTaxonomies([updated.toObject()])[0],
      });
    } catch (error) {
      return sendTaxonomyError(
        res,
        error,
        'Error al actualizar clasificación:'
      );
    }
  }
);

router.delete(
  '/admin/taxonomy/:taxonomyId',
  requireAdmin,
  requirePermission('products:update'),
  async (req, res) => {
    try {
      const archived = await archiveProductTaxonomy(
        req.params.taxonomyId
      );

      return res.json({
        ok: true,
        archivedAt: archived.archivedAt,
      });
    } catch (error) {
      return sendTaxonomyError(
        res,
        error,
        'Error al retirar clasificación:'
      );
    }
  }
);

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
router.get(
  '/admin/list',
  requireAdmin,
  requirePermission('products:view'),
  async (req, res) => {
    try {
      const result = await listAdminProducts(req.query);
      const inventorySummaryMap = new Map(
        result.data.map((product) => [
          String(product._id),
          product.inventorySummary,
        ])
      );

      res.json({
        ok: true,
        total: result.pagination.total,
        data: result.data.map((product) =>
          serializeAdminProduct(product, inventorySummaryMap)
        ),
        pagination: result.pagination,
        summary: result.summary,
        filters: result.filters,
      });
    } catch (error) {
      console.error(
        '❌ Error al obtener productos admin:',
        error.message
      );
      res.status(500).json({
        ok: false,
        message: 'Error al obtener productos administrativos',
      });
    }
  }
);

// ✅ POST /api/products/admin/bulk/update
//    Activa, desactiva, publica u oculta hasta 100 productos.
router.post(
  '/admin/bulk/update',
  requireAdmin,
  requirePermission('products:update'),
  async (req, res) => {
    try {
      const result = await updateProductsInBulk({
        ids: req.body?.ids,
        action: req.body?.action,
      });

      return res.json({
        ok: true,
        message: 'Productos actualizados correctamente.',
        ...result,
      });
    } catch (error) {
      if (error instanceof ProductCatalogInputError) {
        return res.status(error.status || 400).json({
          ok: false,
          message: error.message,
        });
      }

      console.error(
        '❌ Error en actualización masiva de productos:',
        error.message
      );

      return res.status(500).json({
        ok: false,
        message: 'No fue posible actualizar los productos seleccionados.',
      });
    }
  }
);

// ✅ POST /api/products/admin/bulk/archive
//    Retiro lógico individualmente transaccional y con resultado por producto.
router.post(
  '/admin/bulk/archive',
  requireAdmin,
  requirePermission('products:delete'),
  async (req, res) => {
    try {
      const ids = normalizeProductIds(req.body?.ids).map(String);
      const result = await archiveProductsSafely({
        ids,
        adminId: req.adminUserId || null,
      });
      const status = result.failedCount > 0 ? 207 : 200;

      return res.status(status).json({
        ok: result.failedCount === 0,
        message:
          result.failedCount === 0
            ? 'Productos retirados correctamente.'
            : 'Algunos productos no pudieron retirarse.',
        ...result,
      });
    } catch (error) {
      if (error instanceof ProductCatalogInputError) {
        return res.status(error.status || 400).json({
          ok: false,
          message: error.message,
        });
      }

      console.error(
        '❌ Error en retiro masivo de productos:',
        error.message
      );

      return res.status(500).json({
        ok: false,
        message: 'No fue posible retirar los productos seleccionados.',
      });
    }
  }
);

// ✅ GET /api/products/admin/:id
//    Detalle administrativo completo, incluso para productos inactivos.
router.get(
  '/admin/:id',
  requireAdmin,
  requirePermission('products:view'),
  async (req, res) => {
    try {
      const value = String(req.params.id || '').trim();

      if (!value) {
        return res.status(404).json({
          message: 'Producto no encontrado',
        });
      }

      const isValidObjectId =
        value.length === 24 && /^[0-9a-fA-F]+$/.test(value);
      const identityFilter = isValidObjectId
        ? { $or: [{ _id: value }, { slug: value }] }
        : { slug: value };

      const product = await Product.findOne({
        ...identityFilter,
        archivedAt: null,
      });

      if (!product) {
        return res.status(404).json({
          message: 'Producto no encontrado',
        });
      }

      const inventorySummaryMap =
        await buildInventorySummaryMap([product]);
      return res.json(
        serializeAdminProduct(product, inventorySummaryMap)
      );
    } catch (error) {
      console.error(
        '❌ Error al obtener producto admin:',
        error.message
      );
      return res.status(500).json({
        message: 'Error al obtener el producto administrativo',
      });
    }
  }
);

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
        variants,

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
        tags,
        seo,
        commercialFields,
        notes,
      } = req.body;

      if (!title) return res.status(400).json({ message: 'title es requerido' });

      if (price == null || Number.isNaN(Number(price))) {
        return res.status(400).json({ message: 'price inválido' });
      }

      const productConfig = buildProductConfigPayload(req.body);
      const taxonomyPayload =
        await resolveProductTaxonomyPayload(req.body);
      const preInv = productConfig.trackInventory ? sanitizeInventory(inventory) : [];
      const variantsProvided =
        productConfig.trackInventory &&
        Array.isArray(variants) &&
        variants.length > 0;
      const variantLegacy = variantsProvided
        ? buildLegacyFromVariants(variants, {
            title,
            sku,
            price,
            cost,
            averageCost,
            image,
            images,
            inventory: preInv,
            sizes,
            colors,
            stock,
            trackInventory: productConfig.trackInventory,
          })
        : null;

      const effectiveInventory = variantsProvided
        ? variantLegacy.inventory
        : preInv;

      if (hasInventoryDuplicates(effectiveInventory)) {
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
            : productConfig.trackInventory && effectiveInventory.length
              ? totalStockFromInventory(effectiveInventory)
              : 0,
        active: typeof active === 'boolean' ? active : true,
        originalPrice:
          originalPrice != null ? Math.max(0, Number(originalPrice)) : undefined,
        features: Array.isArray(features) ? features : [],
        colors: variantsProvided
          ? variantLegacy.colors
          : Array.isArray(colors)
            ? colors.slice(0, 10)
            : [],
        category:
          taxonomyPayload?.category ?? category ?? undefined,
        categories:
          taxonomyPayload?.categories ??
          sanitizeStrArray(categories),
        primaryCategoryRef:
          taxonomyPayload?.primaryCategoryRef || null,
        categoryRefs: taxonomyPayload?.categoryRefs || [],
        collectionRefs:
          taxonomyPayload?.collectionRefs || [],

        sizes: variantsProvided
          ? variantLegacy.sizes
          : productConfig.trackInventory && Array.isArray(sizes)
            ? sizes
            : [],
        inventory: effectiveInventory,
        variants: variantsProvided ? variantLegacy.variants : [],

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
        tags: normalizeCommercialStringArray(
          tags,
          30,
          80
        ),
        seo: normalizeSeo(seo, {
          title,
          description,
          image,
        }),
        commercialFields:
          normalizeCommercialFields(commercialFields),
        notes: notes ?? '',
      });

      doc.$locals = doc.$locals || {};
      doc.$locals.adminId = req.adminUserId || null;
      doc.$locals.variantsAuthoritative = variantsProvided;

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

      if (error?.name === 'ValidationError') {
        return res.status(400).json({
          message: error.message,
        });
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
      .populate(PUBLIC_TAXONOMY_POPULATE)
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

      const prod = await Product.findOne({
        _id: id,
        archivedAt: null,
      });

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
        variants,
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
        tags,
        seo,
        commercialFields,
        notes,
      } = req.body;

      const hasField = (key) =>
        Object.prototype.hasOwnProperty.call(req.body || {}, key);
      const provided = (v) =>
        v !== undefined &&
        v !== null &&
        !(typeof v === 'string' && v.trim() === '');

      const productConfig = buildProductConfigPayload(req.body, prod.productType || 'physical');
      const taxonomyPayload =
        await resolveProductTaxonomyPayload(req.body, prod);
      const hadConfiguredVariants =
        Array.isArray(prod.variants) && prod.variants.length > 0;

      // Detectar cambio de categoría
      const incomingCategory = provided(category) ? String(category) : undefined;

      const categoryChanged =
        typeof incomingCategory === 'string' &&
        String(prod.category || '') !== incomingCategory;

      // ✅ Lista blanca y normalizaciones
      if (hasField('title')) {
        const cleanTitle = String(title || '').trim();
        if (!cleanTitle) {
          return res.status(400).json({
            message: 'title es requerido',
          });
        }
        prod.title = cleanTitle;
      }

      if (hasField('price')) {
        const n = Number(price);

        if (Number.isNaN(n)) {
          return res.status(400).json({
            message: 'price inválido',
          });
        }

        prod.price = Math.max(0, n);
      }

      if (hasField('originalPrice')) {
        const clearOriginalPrice =
          originalPrice === '' ||
          originalPrice === null ||
          originalPrice === undefined;
        const n = clearOriginalPrice ? 0 : Number(originalPrice);

        if (Number.isNaN(n)) {
          return res.status(400).json({
            message: 'originalPrice inválido',
          });
        }

        prod.originalPrice = clearOriginalPrice
          ? undefined
          : Math.max(0, n);
      }

      if (hasField('description')) prod.description = String(description || '');
      if (hasField('image')) prod.image = String(image || '');
      if (hasField('images')) {
        prod.images = Array.isArray(images) ? images.slice(0, 5) : [];
      }

      if (taxonomyPayload) {
        prod.primaryCategoryRef =
          taxonomyPayload.primaryCategoryRef;
        prod.categoryRefs = taxonomyPayload.categoryRefs;
        prod.collectionRefs =
          taxonomyPayload.collectionRefs;
        prod.category = taxonomyPayload.category;
        prod.categories = taxonomyPayload.categories;
      } else {
        if (hasField('category')) {
          prod.category = String(category || '').trim();
        }
        if (hasField('categories')) {
          prod.categories = sanitizeStrArray(categories);
        }
      }

      if (hasField('features')) {
        prod.features = Array.isArray(features) ? features : [];
      }
      if (hasField('colors')) {
        prod.colors = Array.isArray(colors) ? colors.slice(0, 10) : [];
      }
      if (hasField('sizes')) {
        prod.sizes =
          productConfig.trackInventory && Array.isArray(sizes) ? sizes : [];
      }

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
        prod.colors = [];
        prod.variants = [];
      }

      if (typeof active === 'boolean') prod.active = active;

      // inventario / contabilidad
      if (hasField('reorderPoint')) {
        prod.reorderPoint = Math.max(0, Number(reorderPoint) || 0);
      }

      if (hasField('reorderQty')) {
        prod.reorderQty = Math.max(0, Number(reorderQty) || 0);
      }

      if (hasField('warehouseLocation')) {
        prod.warehouseLocation = String(warehouseLocation || '');
      }

      if (hasField('weightGrams')) {
        prod.weightGrams = Math.max(0, Number(weightGrams) || 0);
      }

      if (hasField('dimensionsCm')) {
        prod.dimensionsCm = {
          l: Math.max(0, Number(dimensionsCm?.l || 0)),
          w: Math.max(0, Number(dimensionsCm?.w || 0)),
          h: Math.max(0, Number(dimensionsCm?.h || 0)),
        };
      }

      if (hasField('cost')) {
        prod.cost = Math.max(0, Number(cost) || 0);
      }

      if (hasField('averageCost')) {
        prod.averageCost = Math.max(0, Number(averageCost) || 0);
      }

      if (hasField('taxRate')) {
        prod.taxRate = Math.min(100, Math.max(0, Number(taxRate) || 0));
      }

      if (typeof taxIncluded === 'boolean') prod.taxIncluded = taxIncluded;

      if (hasField('brand')) prod.brand = String(brand || '');
      if (hasField('season')) prod.season = String(season || '');

      if (hasField('supplier')) {
        prod.supplier = {
          name:
            supplier && typeof supplier === 'object'
              ? String(supplier.name || '').trim()
              : '',
        };
      }

      if (hasField('barcode')) prod.barcode = String(barcode || '');
      if (hasField('tags')) {
        prod.tags = normalizeCommercialStringArray(
          tags,
          30,
          80
        );
      }
      if (hasField('seo')) {
        prod.seo = normalizeSeo(seo, {
          title: prod.title,
          description: prod.description,
          image: prod.image,
        });
      }
      if (hasField('commercialFields')) {
        prod.commercialFields =
          normalizeCommercialFields(commercialFields);
      }
      if (hasField('notes')) prod.notes = String(notes || '');

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

      if (Array.isArray(variants)) {
        const variantLegacy = buildLegacyFromVariants(variants, {
          ...(prod.toObject ? prod.toObject() : prod),
          trackInventory: productConfig.trackInventory,
        });
        const variantsAuthoritative =
          variants.length > 0 || hadConfiguredVariants;

        prod.variants = productConfig.trackInventory
          ? variantLegacy.variants
          : [];

        if (productConfig.trackInventory && variantsAuthoritative) {
          prod.sizes = variantLegacy.sizes;
          prod.colors = variantLegacy.colors;
          prod.inventory = variantLegacy.inventory;

          if (!provided(stock)) {
            prod.stock = totalStockFromInventory(variantLegacy.inventory);
          }
        }

        prod.$locals = prod.$locals || {};
        prod.$locals.variantsAuthoritative = variantsAuthoritative;
      }

      prod.$locals = prod.$locals || {};
      prod.$locals.adminId = req.adminUserId || null;

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

// ✅ DELETE /api/products/:id (archivo lógico, conserva historial e imágenes)
//    PROTEGIDO: solo admin con permiso products:delete
router.delete(
  '/:id',
  requireAdmin,
  requirePermission('products:delete'),
  async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const isValid =
        id.length === 24 && /^[0-9a-fA-F]+$/.test(id);

      if (!isValid) {
        return res.status(404).json({
          message: 'Producto no encontrado',
        });
      }

      const archiveResult = await archiveProductSafely({
        id,
        adminId: req.adminUserId || null,
      });

      if (!archiveResult?.archivedProduct) {
        return res.status(404).json({
          message: 'Producto no encontrado',
        });
      }

      res.json({
        message: 'Producto archivado correctamente',
        archivedAt: archiveResult.archivedProduct.archivedAt,
        inventoryRowsArchived:
          archiveResult.inventoryRowsArchived,
      });
    } catch (error) {
      console.error('❌ Error al archivar producto:', error.message);

      res.status(500).json({
        message: 'Error al archivar producto',
      });
    }
  }
);

module.exports = router;
