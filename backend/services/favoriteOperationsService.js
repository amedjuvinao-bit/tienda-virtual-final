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

const RECENT_FAVORITES_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_FAVORITES_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const HIGH_INTENT_ITEMS = 3;
const HIGH_VALUE_THRESHOLD = 200_000;

const FAVORITE_VIEWS = new Set(['all', 'recent', 'high_intent', 'high_value', 'stale']);
const FAVORITE_SORTS = new Set([
  'recent_activity',
  'oldest_activity',
  'most_items',
  'highest_value',
]);

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

function numberFilter(value, name) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(`El filtro ${name} no es válido.`);
    error.code = 'FAVORITES_ADMIN_FILTER_INVALID';
    throw error;
  }
  return parsed;
}

function invalidAdminFilter(message) {
  const error = new Error(message);
  error.code = 'FAVORITES_ADMIN_FILTER_INVALID';
  return error;
}

function parseAdminFavoritesQuery(query = {}) {
  const page = Math.max(1, Math.floor(Number(query.page || 1)) || 1);
  const limit = Math.max(1, Math.floor(Number(query.limit || 20)) || 20);
  const view = clean(query.view || 'all', 40).toLowerCase();
  const sort = clean(query.sort || 'recent_activity', 40).toLowerCase();
  if (!FAVORITE_VIEWS.has(view)) {
    const error = new Error('La vista rápida no es válida.');
    error.code = 'FAVORITES_ADMIN_FILTER_INVALID';
    throw error;
  }
  if (!FAVORITE_SORTS.has(sort)) {
    const error = new Error('El ordenamiento no es válido.');
    error.code = 'FAVORITES_ADMIN_FILTER_INVALID';
    throw error;
  }
  const parsed = {
    page,
    limit,
    view,
    sort,
    q: clean(query.q, 180),
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    minItems: numberFilter(query.minItems, 'mínimo de productos'),
    maxItems: numberFilter(query.maxItems, 'máximo de productos'),
    minValue: numberFilter(query.minValue, 'valor mínimo'),
    maxValue: numberFilter(query.maxValue, 'valor máximo'),
  };

  const dateFrom = safeDate(parsed.dateFrom);
  const dateTo = safeDate(parsed.dateTo);
  if (parsed.dateFrom && !dateFrom) {
    throw invalidAdminFilter('La fecha inicial no es válida.');
  }
  if (parsed.dateTo && !dateTo) {
    throw invalidAdminFilter('La fecha final no es válida.');
  }
  if (dateFrom && dateTo && startOfLocalDay(dateFrom) > endOfLocalDay(dateTo)) {
    throw invalidAdminFilter('La fecha inicial no puede ser posterior a la final.');
  }
  if (parsed.minItems !== null && parsed.maxItems !== null && parsed.minItems > parsed.maxItems) {
    throw invalidAdminFilter('El mínimo de productos no puede superar el máximo.');
  }
  if (parsed.minValue !== null && parsed.maxValue !== null && parsed.minValue > parsed.maxValue) {
    throw invalidAdminFilter('El valor mínimo no puede superar el máximo.');
  }

  return parsed;
}

function itemCountExpression() {
  return { $size: { $ifNull: ['$items', []] } };
}

function potentialValueExpression() {
  return {
    $sum: {
      $map: {
        input: { $ifNull: ['$items', []] },
        as: 'item',
        in: { $ifNull: ['$$item.price', 0] },
      },
    },
  };
}

function buildAdminFilter(query = {}, { now = new Date() } = {}) {
  const parsed = parseAdminFavoritesQuery(query);
  const filter = { 'items.0': { $exists: true } };
  if (parsed.q) {
    const pattern = { $regex: escapeRegex(parsed.q), $options: 'i' };
    filter.$or = [
      { sessionId: pattern },
      { 'items.title': pattern },
      { 'items.sku': pattern },
      { 'items.category': pattern },
    ];
  }

  const from = safeDate(parsed.dateFrom);
  const to = safeDate(parsed.dateTo);
  if (from || to) {
    filter.updatedAt = {};
    if (from) filter.updatedAt.$gte = startOfLocalDay(from);
    if (to) filter.updatedAt.$lte = endOfLocalDay(to);
  }

  const expressions = [];
  const itemCount = itemCountExpression();
  const potentialValue = potentialValueExpression();
  if (parsed.minItems !== null) expressions.push({ $gte: [itemCount, parsed.minItems] });
  if (parsed.maxItems !== null) expressions.push({ $lte: [itemCount, parsed.maxItems] });
  if (parsed.minValue !== null) expressions.push({ $gte: [potentialValue, parsed.minValue] });
  if (parsed.maxValue !== null) expressions.push({ $lte: [potentialValue, parsed.maxValue] });

  if (parsed.view === 'recent') {
    filter.updatedAt = {
      ...(filter.updatedAt || {}),
      $gte: new Date(now.getTime() - RECENT_FAVORITES_WINDOW_MS),
    };
  } else if (parsed.view === 'stale') {
    filter.updatedAt = {
      ...(filter.updatedAt || {}),
      $lte: new Date(now.getTime() - STALE_FAVORITES_WINDOW_MS),
    };
  } else if (parsed.view === 'high_intent') {
    expressions.push({ $gte: [itemCount, HIGH_INTENT_ITEMS] });
  } else if (parsed.view === 'high_value') {
    expressions.push({ $gte: [potentialValue, HIGH_VALUE_THRESHOLD] });
  }

  if (expressions.length === 1) filter.$expr = expressions[0];
  if (expressions.length > 1) filter.$expr = { $and: expressions };
  return filter;
}

function adminProjection() {
  return {
    _id: 1,
    sessionId: 1,
    itemsCount: '$_itemsCount',
    potentialValue: '$_potentialValue',
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

function buildAdminSort(sort = 'recent_activity') {
  const sorts = {
    recent_activity: { updatedAt: -1, _id: -1 },
    oldest_activity: { updatedAt: 1, _id: 1 },
    most_items: { _itemsCount: -1, updatedAt: -1, _id: -1 },
    highest_value: { _potentialValue: -1, updatedAt: -1, _id: -1 },
  };
  return sorts[sort] || sorts.recent_activity;
}

async function listAdminFavorites(
  query = {},
  { FavoriteModel = Favorite, maxLimit = 100 } = {}
) {
  const parsed = parseAdminFavoritesQuery(query);
  const page = parsed.page;
  const safeMaxLimit = Math.min(10_000, Math.max(1, Number(maxLimit) || 100));
  const limit = Math.min(
    safeMaxLimit,
    parsed.limit
  );
  const filter = buildAdminFilter(query);
  const [result] = await FavoriteModel.aggregate([
    { $match: filter },
    {
      $set: {
        _itemsCount: itemCountExpression(),
        _potentialValue: potentialValueExpression(),
      },
    },
    { $sort: buildAdminSort(parsed.sort) },
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

async function getAdminFavoriteSummary(
  query = {},
  { FavoriteModel = Favorite, now = new Date() } = {}
) {
  const filter = buildAdminFilter(query, { now });
  const [summary] = await FavoriteModel.aggregate([
    { $match: filter },
    {
      $set: {
        _itemsCount: itemCountExpression(),
        _potentialValue: potentialValueExpression(),
      },
    },
    {
      $group: {
        _id: null,
        totalLists: { $sum: 1 },
        totalItems: { $sum: '$_itemsCount' },
        potentialValue: { $sum: '$_potentialValue' },
        averageItems: { $avg: '$_itemsCount' },
        averageListValue: { $avg: '$_potentialValue' },
        recentLists: {
          $sum: {
            $cond: [
              { $gte: ['$updatedAt', new Date(now.getTime() - RECENT_FAVORITES_WINDOW_MS)] },
              1,
              0,
            ],
          },
        },
        highIntentLists: {
          $sum: { $cond: [{ $gte: ['$_itemsCount', HIGH_INTENT_ITEMS] }, 1, 0] },
        },
      },
    },
  ]);
  return {
    totalLists: Number(summary?.totalLists || 0),
    totalItems: Number(summary?.totalItems || 0),
    potentialValue: Number(summary?.potentialValue || 0),
    averageItems: Number(summary?.averageItems || 0),
    averageListValue: Number(summary?.averageListValue || 0),
    recentLists: Number(summary?.recentLists || 0),
    highIntentLists: Number(summary?.highIntentLists || 0),
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
  HIGH_INTENT_ITEMS,
  HIGH_VALUE_THRESHOLD,
  RECENT_FAVORITES_WINDOW_MS,
  STALE_FAVORITES_WINDOW_MS,
  adminProjection,
  buildAdminFilter,
  buildAdminSort,
  buildFavoriteDetail,
  buildFavoritesCsv,
  canonicalFavoriteItem,
  canonicalizeFavoriteItems,
  escapeRegex,
  getAdminFavoriteSummary,
  itemIdentity,
  listAdminFavorites,
  mapAvailabilityAlert,
  parseAdminFavoritesQuery,
  readProductId,
};
