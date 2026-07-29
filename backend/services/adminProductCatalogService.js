const mongoose = require('mongoose');

const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const ProductTaxonomy = require('../models/ProductTaxonomy');
const {
  PRODUCT_TYPE_VALUES,
} = require('../lib/products/productUniversalConfig');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_BULK_IDS = 100;

const STATUS_VALUES = new Set([
  'all',
  'published',
  'hidden',
  'active',
  'inactive',
]);
const INVENTORY_FILTER_VALUES = new Set([
  'all',
  'tracked',
  'not_tracked',
  'with_stock',
  'without_stock',
  'low_stock',
]);

const SORT_OPTIONS = Object.freeze({
  '-createdAt': { createdAt: -1, _id: -1 },
  createdAt: { createdAt: 1, _id: 1 },
  '-updatedAt': { updatedAt: -1, _id: -1 },
  updatedAt: { updatedAt: 1, _id: 1 },
  title: { title: 1, _id: 1 },
  '-title': { title: -1, _id: -1 },
  price: { price: 1, _id: 1 },
  '-price': { price: -1, _id: -1 },
  stock: { 'inventorySummary.stock': 1, _id: 1 },
  '-stock': { 'inventorySummary.stock': -1, _id: -1 },
  availableStock: {
    'inventorySummary.availableStock': 1,
    _id: 1,
  },
  '-availableStock': {
    'inventorySummary.availableStock': -1,
    _id: -1,
  },
});

const BULK_UPDATE_ACTIONS = Object.freeze({
  activate: {
    active: true,
  },
  deactivate: {
    active: false,
    visible: false,
  },
  publish: {
    active: true,
    visible: true,
  },
  hide: {
    visible: false,
  },
});

class ProductCatalogInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ProductCatalogInputError';
    this.status = status;
  }
}

function clampPositiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(parsed) || parsed < 1) return fallback;

  return Math.min(parsed, maximum);
}

function cleanChoice(value, allowed, fallback = 'all') {
  const normalized = String(value || '').trim().toLowerCase();

  return allowed.has(normalized) ? normalized : fallback;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseOptionalObjectId(value) {
  const text = String(value || '').trim();

  return mongoose.Types.ObjectId.isValid(text)
    ? new mongoose.Types.ObjectId(text)
    : null;
}

function parseAdminProductCatalogQuery(query = {}) {
  const rawProductType = String(query.productType || 'all')
    .trim()
    .toLowerCase();
  const productType = PRODUCT_TYPE_VALUES.includes(rawProductType)
    ? rawProductType
    : 'all';
  const sortKey = Object.prototype.hasOwnProperty.call(
    SORT_OPTIONS,
    String(query.sort || '')
  )
    ? String(query.sort)
    : '-createdAt';

  return {
    page: clampPositiveInteger(query.page, DEFAULT_PAGE),
    limit: clampPositiveInteger(query.limit, DEFAULT_LIMIT, MAX_LIMIT),
    q: String(query.q || '').trim().slice(0, 160),
    productType,
    status: cleanChoice(query.status, STATUS_VALUES),
    inventory: cleanChoice(
      query.inventory || query.inventoryFilter,
      INVENTORY_FILTER_VALUES
    ),
    categoryId: parseOptionalObjectId(query.categoryId),
    collectionId: parseOptionalObjectId(query.collectionId),
    tag: String(query.tag || '').trim().slice(0, 80),
    sortKey,
    sort: SORT_OPTIONS[sortKey],
  };
}

function buildBaseMatch(options) {
  const match = {
    archivedAt: null,
  };

  if (options.productType !== 'all') {
    match.productType = options.productType;
  }

  if (options.status === 'published') {
    match.active = { $ne: false };
    match.visible = { $ne: false };
  } else if (options.status === 'hidden') {
    match.visible = false;
  } else if (options.status === 'active') {
    match.active = { $ne: false };
  } else if (options.status === 'inactive') {
    match.active = false;
  }

  if (options.inventory === 'tracked') {
    match.trackInventory = true;
  } else if (options.inventory === 'not_tracked') {
    match.trackInventory = { $ne: true };
  }

  if (options.categoryId) {
    const categoryAlternatives = [
      { categoryRefs: options.categoryId },
      { primaryCategoryRef: options.categoryId },
    ];

    if (options.categoryName) {
      categoryAlternatives.push(
        { category: options.categoryName },
        { categories: options.categoryName }
      );
    }

    match.$and = match.$and || [];
    match.$and.push({
      $or: categoryAlternatives,
    });
  }

  if (options.collectionId) {
    match.collectionRefs = options.collectionId;
  }

  if (options.tag) {
    match.tags = new RegExp(
      `^${escapeRegex(options.tag)}$`,
      'i'
    );
  }

  if (options.q) {
    const regex = new RegExp(escapeRegex(options.q), 'i');
    const textFilters = [
      { title: regex },
      { description: regex },
      { sku: regex },
      { category: regex },
      { categories: regex },
      { tags: regex },
      { 'commercialFields.label': regex },
      { 'commercialFields.value': regex },
      { barcode: regex },
      { 'variants.sku': regex },
      { 'variants.barcode': regex },
    ];

    if (mongoose.Types.ObjectId.isValid(options.q)) {
      textFilters.unshift({
        _id: new mongoose.Types.ObjectId(options.q),
      });
    }

    match.$and = match.$and || [];
    match.$and.push({
      $or: textFilters,
    });
  }

  return match;
}

function buildInventoryLookupStage() {
  return {
    $lookup: {
      from: InventoryStock.collection.name,
      let: {
        productId: '$_id',
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$product', '$$productId'] },
                {
                  $eq: [
                    { $ifNull: ['$deletedAt', null] },
                    null,
                  ],
                },
                { $ne: ['$active', false] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            stock: {
              $sum: { $ifNull: ['$stock', 0] },
            },
            reservedStock: {
              $sum: { $ifNull: ['$reservedStock', 0] },
            },
            availableStock: {
              $sum: { $ifNull: ['$availableStock', 0] },
            },
            variantsCount: { $sum: 1 },
            branches: { $addToSet: '$branch' },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $gt: [
                          { $ifNull: ['$reorderPoint', 0] },
                          0,
                        ],
                      },
                      {
                        $lte: [
                          { $ifNull: ['$availableStock', 0] },
                          { $ifNull: ['$reorderPoint', 0] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ],
      as: '_inventoryAggregation',
    },
  };
}

function buildInventorySummaryStages() {
  return [
    {
      $set: {
        _inventoryRow: {
          $arrayElemAt: ['$_inventoryAggregation', 0],
        },
      },
    },
    {
      $set: {
        inventorySummary: {
          stock: {
            $cond: [
              {
                $gt: [
                  { $ifNull: ['$_inventoryRow.variantsCount', 0] },
                  0,
                ],
              },
              { $ifNull: ['$_inventoryRow.stock', 0] },
              { $ifNull: ['$stock', 0] },
            ],
          },
          reservedStock: {
            $ifNull: ['$_inventoryRow.reservedStock', 0],
          },
          availableStock: {
            $cond: [
              {
                $gt: [
                  { $ifNull: ['$_inventoryRow.variantsCount', 0] },
                  0,
                ],
              },
              { $ifNull: ['$_inventoryRow.availableStock', 0] },
              { $ifNull: ['$stock', 0] },
            ],
          },
          variantsCount: {
            $cond: [
              {
                $gt: [
                  { $ifNull: ['$_inventoryRow.variantsCount', 0] },
                  0,
                ],
              },
              { $ifNull: ['$_inventoryRow.variantsCount', 0] },
              {
                $size: {
                  $ifNull: ['$inventory', []],
                },
              },
            ],
          },
          branchesCount: {
            $size: {
              $ifNull: ['$_inventoryRow.branches', []],
            },
          },
          lowStockCount: {
            $cond: [
              {
                $gt: [
                  { $ifNull: ['$_inventoryRow.variantsCount', 0] },
                  0,
                ],
              },
              { $ifNull: ['$_inventoryRow.lowStockCount', 0] },
              {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$trackInventory', true] },
                      {
                        $gt: [
                          { $ifNull: ['$reorderPoint', 0] },
                          0,
                        ],
                      },
                      {
                        $lte: [
                          { $ifNull: ['$stock', 0] },
                          { $ifNull: ['$reorderPoint', 0] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            ],
          },
          source: {
            $cond: [
              {
                $gt: [
                  { $ifNull: ['$_inventoryRow.variantsCount', 0] },
                  0,
                ],
              },
              'InventoryStock',
              'Product.stock',
            ],
          },
        },
      },
    },
    {
      $unset: ['_inventoryAggregation', '_inventoryRow'],
    },
  ];
}

function buildInventoryMatch(inventoryFilter) {
  if (inventoryFilter === 'with_stock') {
    return {
      'inventorySummary.stock': { $gt: 0 },
    };
  }

  if (inventoryFilter === 'without_stock') {
    return {
      trackInventory: true,
      'inventorySummary.stock': { $lte: 0 },
    };
  }

  if (inventoryFilter === 'low_stock') {
    return {
      'inventorySummary.lowStockCount': { $gt: 0 },
    };
  }

  return null;
}

function buildCatalogSummaryStage() {
  return {
    $group: {
      _id: null,
      total: { $sum: 1 },
      active: {
        $sum: {
          $cond: [{ $ne: ['$active', false] }, 1, 0],
        },
      },
      tracked: {
        $sum: {
          $cond: [{ $eq: ['$trackInventory', true] }, 1, 0],
        },
      },
      stock: {
        $sum: { $ifNull: ['$inventorySummary.stock', 0] },
      },
      available: {
        $sum: {
          $ifNull: ['$inventorySummary.availableStock', 0],
        },
      },
      reserved: {
        $sum: {
          $ifNull: ['$inventorySummary.reservedStock', 0],
        },
      },
      costValue: {
        $sum: {
          $multiply: [
            { $ifNull: ['$cost', 0] },
            { $ifNull: ['$inventorySummary.stock', 0] },
          ],
        },
      },
      saleValue: {
        $sum: {
          $multiply: [
            { $ifNull: ['$price', 0] },
            { $ifNull: ['$inventorySummary.stock', 0] },
          ],
        },
      },
    },
  };
}

function buildDataProjectionStage() {
  return {
    $project: {
      _id: 1,
      title: 1,
      slug: 1,
      sku: 1,
      barcode: 1,
      productType: 1,
      category: 1,
      categories: 1,
      primaryCategoryRef: 1,
      categoryRefs: 1,
      collectionRefs: 1,
      tags: 1,
      image: 1,
      price: 1,
      cost: 1,
      active: 1,
      visible: 1,
      trackInventory: 1,
      createdAt: 1,
      updatedAt: 1,
      inventorySummary: 1,
    },
  };
}

function emptySummary() {
  return {
    total: 0,
    active: 0,
    tracked: 0,
    stock: 0,
    available: 0,
    reserved: 0,
    costValue: 0,
    saleValue: 0,
  };
}

function normalizeSummary(value = {}) {
  const result = emptySummary();

  for (const key of Object.keys(result)) {
    result[key] = Number(value?.[key] || 0);
  }

  return result;
}

async function aggregateCatalog(options) {
  const skip = (options.page - 1) * options.limit;
  const inventoryMatch = buildInventoryMatch(options.inventory);
  const pipeline = [
    { $match: buildBaseMatch(options) },
    buildInventoryLookupStage(),
    ...buildInventorySummaryStages(),
  ];

  if (inventoryMatch) {
    pipeline.push({ $match: inventoryMatch });
  }

  pipeline.push({
    $facet: {
      data: [
        { $sort: options.sort },
        { $skip: skip },
        { $limit: options.limit },
        buildDataProjectionStage(),
      ],
      summary: [buildCatalogSummaryStage()],
    },
  });

  const [result = {}] = await Product.aggregate(pipeline)
    .collation({ locale: 'es', strength: 1 });

  return {
    data: Array.isArray(result.data) ? result.data : [],
    summary: normalizeSummary(result.summary?.[0]),
  };
}

async function listAdminProducts(query = {}) {
  const requested = parseAdminProductCatalogQuery(query);
  if (requested.categoryId) {
    const category = await ProductTaxonomy.findOne({
      _id: requested.categoryId,
      kind: 'category',
      archivedAt: null,
    })
      .select('name')
      .lean();

    requested.categoryName = category?.name || '';
  }
  let page = requested.page;
  let result = await aggregateCatalog(requested);
  let pages = Math.max(
    1,
    Math.ceil(result.summary.total / requested.limit)
  );

  if (result.summary.total > 0 && page > pages) {
    page = pages;
    result = await aggregateCatalog({
      ...requested,
      page,
    });
    pages = Math.max(
      1,
      Math.ceil(result.summary.total / requested.limit)
    );
  }

  const from =
    result.summary.total === 0
      ? 0
      : (page - 1) * requested.limit + 1;
  const to = Math.min(
    result.summary.total,
    page * requested.limit
  );

  return {
    data: result.data,
    summary: result.summary,
    pagination: {
      page,
      limit: requested.limit,
      total: result.summary.total,
      pages,
      from,
      to,
      hasPrevious: page > 1,
      hasNext: page < pages,
    },
    filters: {
      q: requested.q,
      productType: requested.productType,
      status: requested.status,
      inventory: requested.inventory,
      categoryId: requested.categoryId
        ? String(requested.categoryId)
        : '',
      collectionId: requested.collectionId
        ? String(requested.collectionId)
        : '',
      tag: requested.tag,
      sort: requested.sortKey,
    },
  };
}

function normalizeProductIds(ids, maximum = MAX_BULK_IDS) {
  if (!Array.isArray(ids)) {
    throw new ProductCatalogInputError(
      'Debes enviar una lista de productos.'
    );
  }

  const unique = [];
  const seen = new Set();

  for (const value of ids) {
    const text = String(value || '').trim();

    if (!mongoose.Types.ObjectId.isValid(text)) {
      throw new ProductCatalogInputError(
        'La selección contiene un producto inválido.'
      );
    }

    const objectId = new mongoose.Types.ObjectId(text);
    const canonicalId = objectId.toHexString();

    if (seen.has(canonicalId)) continue;
    seen.add(canonicalId);
    unique.push(objectId);
  }

  if (!unique.length) {
    throw new ProductCatalogInputError(
      'Selecciona al menos un producto.'
    );
  }

  if (unique.length > maximum) {
    throw new ProductCatalogInputError(
      `Solo puedes procesar hasta ${maximum} productos a la vez.`
    );
  }

  return unique;
}

async function updateProductsInBulk({
  ids,
  action,
}) {
  const normalizedIds = normalizeProductIds(ids);
  const cleanAction = String(action || '').trim().toLowerCase();
  const update = BULK_UPDATE_ACTIONS[cleanAction];

  if (!update) {
    throw new ProductCatalogInputError(
      'La acción masiva solicitada no es válida.'
    );
  }

  const result = await Product.updateMany(
    {
      _id: { $in: normalizedIds },
      archivedAt: null,
    },
    {
      $set: update,
    },
    {
      runValidators: true,
    }
  );

  return {
    action: cleanAction,
    requested: normalizedIds.length,
    matched: Number(result.matchedCount || 0),
    modified: Number(result.modifiedCount || 0),
    skipped:
      normalizedIds.length - Number(result.matchedCount || 0),
  };
}

module.exports = {
  BULK_UPDATE_ACTIONS,
  DEFAULT_LIMIT,
  MAX_BULK_IDS,
  MAX_LIMIT,
  ProductCatalogInputError,
  listAdminProducts,
  normalizeProductIds,
  parseAdminProductCatalogQuery,
  updateProductsInBulk,
};
