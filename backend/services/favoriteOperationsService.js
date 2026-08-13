'use strict';

const mongoose = require('mongoose');

const Favorite = require('../models/Favorite');
const Product = require('../models/Product');
const {
  findProductVariant,
  normalizeProductVariants,
  resolveVariantCommercialSnapshot,
  resolveVariantIdentity,
} = require('../lib/products/productVariantConfig');
const {
  defaultCartCanonicalValidationService,
} = require('./cartCanonicalValidationService');
const { endOfLocalDay, safeDate, startOfLocalDay } = require('../utils/dateRange');

const PRODUCT_FIELDS = [
  'title',
  'price',
  'image',
  'images',
  'slug',
  'sku',
  'barcode',
  'category',
  'visible',
  'active',
  'archivedAt',
  'variants',
  'inventory',
  'stock',
  'trackInventory',
  'allowBackorder',
].join(' ');

function clean(value, max = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function escapeRegex(value) {
  return clean(value, 180).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readProductId(item = {}) {
  const raw = item?.productId || item?._id || item?.id || item?.product?._id;
  return clean(raw, 80);
}

function readRequestedIdentity(item = {}) {
  return resolveVariantIdentity({
    variantKey:
      item.variantKey || item.variantId || item.selectedVariantKey || item.selectedVariantId,
    size: item.size || item.talla,
    color: item.colorValue || item.rawColor || item.color,
    attributes:
      item.variantAttributes || item.attributes || item.selectedAttributes || [],
  });
}

function itemIdentity(item = {}) {
  const identity = readRequestedIdentity(item);
  return `${readProductId(item)}|||${identity.variantKey}`;
}

function isProductAvailable(product = {}) {
  return Boolean(
    product &&
      product.active !== false &&
      product.visible !== false &&
      !product.archivedAt
  );
}

async function executeLean(query) {
  let current = query;
  if (current && typeof current.select === 'function') current = current.select(PRODUCT_FIELDS);
  if (current && typeof current.lean === 'function') current = current.lean();
  if (current && typeof current.exec === 'function') return current.exec();
  return current;
}

async function loadProductMap(items, ProductModel = Product) {
  const ids = Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map(readProductId)
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );
  if (!ids.length) return new Map();

  const rows = (await executeLean(ProductModel.find({ _id: { $in: ids } }))) || [];
  return new Map(rows.map((product) => [String(product._id), product]));
}

function canonicalFavoriteItem(product, requested = {}, previous = null) {
  if (!isProductAvailable(product)) return null;

  const identity = readRequestedIdentity(requested);
  const variants = normalizeProductVariants(product.variants || [], product).filter(
    (variant) => variant.active !== false
  );
  const selectionWasExplicit = Boolean(
    clean(requested.variantKey || requested.variantId) ||
      clean(requested.size) ||
      clean(requested.color || requested.colorValue) ||
      (Array.isArray(requested.variantAttributes) && requested.variantAttributes.length) ||
      (Array.isArray(requested.attributes) && requested.attributes.length)
  );
  const selectedVariant = findProductVariant(product, identity);

  if (variants.length && selectionWasExplicit && !selectedVariant) return null;

  const commercial = resolveVariantCommercialSnapshot(product, identity);
  const canonicalIdentity = resolveVariantIdentity({
    variantKey: commercial.variantKey || identity.variantKey,
    size: selectedVariant?.size || identity.size,
    color: selectedVariant?.color || identity.color,
    attributes: commercial.variantAttributes || identity.attributes,
  });

  return {
    productId: String(product._id),
    variantKey: canonicalIdentity.variantKey,
    variantLabel: clean(commercial.variantLabel, 180),
    variantAttributes: canonicalIdentity.attributes,
    title: clean(product.title, 220) || 'Producto',
    image: clean(commercial.image || product.image, 1000),
    price: Math.max(0, Number(commercial.price ?? product.price ?? 0) || 0),
    slug: clean(product.slug, 240),
    sku: clean(commercial.sku || product.sku, 100).toUpperCase(),
    category: clean(product.category, 160),
    color: clean(canonicalIdentity.color, 120),
    size: clean(canonicalIdentity.size, 80),
    addedAt: previous?.addedAt || new Date(),
  };
}

async function canonicalizeFavoriteItems(
  items,
  { ProductModel = Product, previousItems = [] } = {}
) {
  const source = Array.isArray(items) ? items.slice(0, 200) : [];
  const productMap = await loadProductMap(source, ProductModel);
  const previousMap = new Map(
    (Array.isArray(previousItems) ? previousItems : []).map((item) => [
      itemIdentity(item),
      item,
    ])
  );
  const result = [];
  const seen = new Set();

  for (const requested of source) {
    const product = productMap.get(readProductId(requested));
    const key = itemIdentity(requested);
    if (!product || !key || seen.has(key)) continue;

    const canonical = canonicalFavoriteItem(product, requested, previousMap.get(key));
    if (!canonical) continue;

    const canonicalKey = `${canonical.productId}|||${canonical.variantKey}`;
    if (seen.has(canonicalKey)) continue;
    seen.add(canonicalKey);
    result.push(canonical);
    if (result.length >= 200) break;
  }

  return result;
}

function buildAdminFilter(query = {}) {
  const filter = { 'items.0': { $exists: true } };
  const q = clean(query.q, 180);
  if (q) filter.sessionId = { $regex: escapeRegex(q), $options: 'i' };

  const from = safeDate(query.dateFrom);
  const to = safeDate(query.dateTo);
  if (from || to) {
    filter.updatedAt = {};
    if (from) filter.updatedAt.$gte = startOfLocalDay(from);
    if (to) filter.updatedAt.$lte = endOfLocalDay(to);
  }
  return filter;
}

function adminProjection() {
  return {
    _id: 1,
    sessionId: 1,
    itemsCount: { $size: { $ifNull: ['$items', []] } },
    potentialValue: {
      $sum: {
        $map: {
          input: { $ifNull: ['$items', []] },
          as: 'item',
          in: { $ifNull: ['$$item.price', 0] },
        },
      },
    },
    productPreview: {
      $slice: [
        {
          $map: {
            input: { $ifNull: ['$items', []] },
            as: 'item',
            in: {
              productId: '$$item.productId',
              title: '$$item.title',
              image: '$$item.image',
            },
          },
        },
        4,
      ],
    },
    lastUpdate: { $ifNull: ['$updatedAt', '$createdAt'] },
    createdAt: 1,
    updatedAt: 1,
  };
}

async function listAdminFavorites(
  query = {},
  { FavoriteModel = Favorite, maxLimit = 100 } = {}
) {
  const page = Math.max(1, Math.floor(Number(query.page || 1)) || 1);
  const safeMaxLimit = Math.min(10_000, Math.max(1, Number(maxLimit) || 100));
  const limit = Math.min(
    safeMaxLimit,
    Math.max(1, Math.floor(Number(query.limit || 20)) || 20)
  );
  const filter = buildAdminFilter(query);
  const [result] = await FavoriteModel.aggregate([
    { $match: filter },
    { $sort: { updatedAt: -1, _id: -1 } },
    {
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: adminProjection() },
        ],
        meta: [{ $count: 'total' }],
      },
    },
  ]);
  const total = Number(result?.meta?.[0]?.total || 0);
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    data: result?.data || [],
  };
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildFavoritesCsv(rows = []) {
  const output = [
    ['sessionId', 'productos', 'valorPotencial', 'ultimaActualizacion'].map(csvCell).join(','),
  ];
  rows.forEach((row) => {
    output.push(
      [row.sessionId, row.itemsCount, row.potentialValue, row.lastUpdate]
        .map(csvCell)
        .join(',')
    );
  });
  return `\uFEFF${output.join('\n')}`;
}

function mapAvailabilityAlert(reason) {
  const messages = {
    PRODUCT_NOT_FOUND: 'Producto eliminado',
    PRODUCT_NOT_AVAILABLE: 'Producto no disponible',
    INVALID_VARIANT: 'Variante no disponible',
    OUT_OF_STOCK: 'Sin inventario disponible',
    INSUFFICIENT_STOCK: 'Inventario insuficiente',
  };
  return { code: reason, message: messages[reason] || 'Requiere revisión' };
}

async function buildFavoriteDetail(
  favorite,
  { canonicalValidationService = defaultCartCanonicalValidationService } = {}
) {
  const plain = favorite?.toObject
    ? favorite.toObject({ virtuals: true })
    : { ...(favorite || {}) };
  const storedItems = Array.isArray(plain.items) ? plain.items : [];
  const validation = await canonicalValidationService.validateItems(
    storedItems.map((item) => ({ ...item, qty: 1, quantity: 1 })),
    { mode: 'soft' }
  );
  const items = storedItems.map((stored, index) => {
    const current = validation.items[index] || null;
    const alerts = [];
    if (!current?.valid) {
      alerts.push(mapAvailabilityAlert(current?.invalidReason || 'PRODUCT_NOT_AVAILABLE'));
    } else if (Number(current.price) !== Number(stored.price)) {
      alerts.push({ code: 'PRICE_CHANGED', message: 'El precio vigente cambió' });
    }
    return {
      ...stored,
      current,
      alerts,
    };
  });

  return {
    ...plain,
    items,
    itemsCount: items.length,
    potentialValue: items.reduce(
      (sum, item) => sum + Number(item.current?.price ?? item.price ?? 0),
      0
    ),
    lastUpdate: plain.updatedAt || plain.createdAt || null,
  };
}

module.exports = {
  adminProjection,
  buildAdminFilter,
  buildFavoriteDetail,
  buildFavoritesCsv,
  canonicalFavoriteItem,
  canonicalizeFavoriteItems,
  escapeRegex,
  itemIdentity,
  listAdminFavorites,
  mapAvailabilityAlert,
  readProductId,
};
