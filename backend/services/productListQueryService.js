'use strict';

const mongoose = require('mongoose');
const Product = require('../models/Product');
const {
  PUBLIC_PRODUCT_PROJECTION,
  buildPublicProductFilter,
  serializePublicProduct,
} = require('../lib/products/productPublicView');

const DEFAULT_PUBLIC_PRODUCT_LIMIT = 24;
const MAX_PRODUCT_LIST_LIMIT = 100;
const MAX_PRODUCT_LIST_PAGE = 100_000;
const MAX_SEARCH_LENGTH = 160;
const MAX_FILTER_VALUES = 30;

const PUBLIC_PRODUCT_SORTS = Object.freeze({
  '-createdAt': Object.freeze({ createdAt: -1, _id: -1 }),
  createdAt: Object.freeze({ createdAt: 1, _id: 1 }),
  title: Object.freeze({ title: 1, _id: 1 }),
  '-title': Object.freeze({ title: -1, _id: -1 }),
  price: Object.freeze({ price: 1, _id: 1 }),
  '-price': Object.freeze({ price: -1, _id: -1 }),
  '-updatedAt': Object.freeze({ updatedAt: -1, _id: -1 }),
});

class ProductListQueryError extends Error {
  constructor(message, code = 'PRODUCT_LIST_QUERY_INVALID') {
    super(message);
    this.name = 'ProductListQueryError';
    this.code = code;
    this.status = 400;
  }
}

function hasOwn(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePositiveInteger(value, {
  field,
  fallback,
  maximum = Number.MAX_SAFE_INTEGER,
}) {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    throw new ProductListQueryError(`${field} debe ser un entero positivo.`);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ProductListQueryError(
      `${field} debe estar entre 1 y ${maximum}.`
    );
  }
  return parsed;
}

function parseBoundedText(value, { field, maximum, fallback = '' }) {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (text.length > maximum) {
    throw new ProductListQueryError(
      `${field} supera la longitud permitida.`
    );
  }
  return text;
}

function parseCsvFilter(value, field, maximum = MAX_FILTER_VALUES) {
  if (value === undefined || value === null || value === '') return [];
  const source = Array.isArray(value) ? value : String(value).split(',');
  const result = [];
  const seen = new Set();
  for (const entry of source) {
    const clean = parseBoundedText(entry, {
      field,
      maximum: 100,
    });
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('es');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length > maximum) {
      throw new ProductListQueryError(
        `${field} contiene demasiados valores.`
      );
    }
  }
  return result;
}

function parseMoneyFilter(value, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new ProductListQueryError(`${field} no es un valor monetario valido.`);
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) {
    throw new ProductListQueryError(`${field} esta fuera del rango permitido.`);
  }
  return parsed;
}

function parsePublicProductListQuery(query = {}) {
  const page = parsePositiveInteger(query.page, {
    field: 'page',
    fallback: 1,
    maximum: MAX_PRODUCT_LIST_PAGE,
  });
  const limit = parsePositiveInteger(query.limit, {
    field: 'limit',
    fallback: DEFAULT_PUBLIC_PRODUCT_LIMIT,
    maximum: MAX_PRODUCT_LIST_LIMIT,
  });
  const q = parseBoundedText(query.q ?? query.search, {
    field: 'q',
    maximum: MAX_SEARCH_LENGTH,
  });
  const status = parseBoundedText(query.status, {
    field: 'status',
    maximum: 30,
    fallback: 'published',
  }).toLowerCase();
  if (status !== 'published') {
    throw new ProductListQueryError(
      'status no esta permitido para el catalogo publico.'
    );
  }
  const sortKey = parseBoundedText(query.sort, {
    field: 'sort',
    maximum: 40,
    fallback: '-createdAt',
  });
  if (!hasOwn(PUBLIC_PRODUCT_SORTS, sortKey)) {
    throw new ProductListQueryError('sort no esta permitido.');
  }
  const minPrice = parseMoneyFilter(query.minPrice, 'minPrice', 0);
  const maxPrice = parseMoneyFilter(
    query.maxPrice,
    'maxPrice',
    1_000_000_000
  );
  if (minPrice > maxPrice) {
    throw new ProductListQueryError(
      'minPrice no puede ser mayor que maxPrice.'
    );
  }

  return {
    page,
    limit,
    q,
    status,
    categories: parseCsvFilter(query.category ?? query.categories, 'category'),
    categoryScope: parseCsvFilter(query.categoryScope, 'categoryScope'),
    colors: parseCsvFilter(query.color ?? query.colors, 'color'),
    productKeys: parseCsvFilter(query.productKeys, 'productKeys', 100),
    minPrice,
    maxPrice,
    sortKey,
    sort: PUBLIC_PRODUCT_SORTS[sortKey],
  };
}

function exactRegex(value) {
  return new RegExp(`^${escapeRegex(value)}$`, 'i');
}

function buildCategoryClause(values) {
  if (!values.length) return null;
  const textRegexes = values.map(exactRegex);
  const objectIds = values
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));
  return {
    $or: [
      { category: { $in: textRegexes } },
      { categories: { $in: textRegexes } },
      ...(objectIds.length
        ? [
            { primaryCategoryRef: { $in: objectIds } },
            { categoryRefs: { $in: objectIds } },
          ]
        : []),
    ],
  };
}

function buildProductKeyClause(values) {
  if (!values.length) return null;
  const objectIds = values
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));
  const slugs = values.filter((value) => !mongoose.Types.ObjectId.isValid(value));
  return {
    $or: [
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      ...(slugs.length ? [{ slug: { $in: slugs } }] : []),
    ],
  };
}

function buildPublicProductListFilter(options) {
  const filter = buildPublicProductFilter();
  const clauses = [];
  if (options.q) {
    const regex = new RegExp(escapeRegex(options.q), 'i');
    clauses.push({
      $or: [
        { title: regex },
        { sku: regex },
        { barcode: regex },
        { 'variants.sku': regex },
        { 'variants.barcode': regex },
      ],
    });
  }
  const selectedCategories = buildCategoryClause(options.categories);
  if (selectedCategories) clauses.push(selectedCategories);
  const categoryScope = buildCategoryClause(options.categoryScope);
  if (categoryScope) clauses.push(categoryScope);
  if (options.colors.length) {
    const colors = options.colors.map(exactRegex);
    clauses.push({
      $or: [
        { colors: { $in: colors } },
        { 'variants.color': { $in: colors } },
      ],
    });
  }
  const productKeys = buildProductKeyClause(options.productKeys);
  if (productKeys) clauses.push(productKeys);
  if (options.minPrice > 0 || options.maxPrice < 1_000_000_000) {
    filter.price = {
      $gte: options.minPrice,
      $lte: options.maxPrice,
    };
  }
  if (clauses.length) filter.$and = clauses;
  return filter;
}

async function defaultFetchPublicProductPage({
  filter,
  sort,
  skip,
  limit,
  ProductModel = Product,
  populate = [],
}) {
  const [products, totalProducts] = await Promise.all([
    ProductModel.find(filter)
      .select(PUBLIC_PRODUCT_PROJECTION)
      .populate(populate)
      .collation({ locale: 'es', strength: 1 })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);
  return { products, totalProducts };
}

function buildPagination({ page, limit, totalProducts }) {
  const safeTotal = Math.max(0, Number(totalProducts || 0));
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / limit);
  return {
    page,
    limit,
    totalProducts: safeTotal,
    totalPages,
    from: safeTotal === 0 || page > totalPages ? 0 : (page - 1) * limit + 1,
    to: safeTotal === 0 || page > totalPages
      ? 0
      : Math.min(safeTotal, page * limit),
    hasPreviousPage: page > 1,
    hasNextPage: totalPages > 0 && page < totalPages,
  };
}

async function listPublicProducts(
  query = {},
  {
    fetchPage = defaultFetchPublicProductPage,
    ProductModel = Product,
    populate = [],
  } = {}
) {
  const options = parsePublicProductListQuery(query);
  const filter = buildPublicProductListFilter(options);
  const skip = (options.page - 1) * options.limit;
  const result = await fetchPage({
    filter,
    sort: options.sort,
    skip,
    limit: options.limit,
    options,
    ProductModel,
    populate,
  });
  const products = Array.isArray(result?.products)
    ? result.products.map(serializePublicProduct).filter(Boolean)
    : [];
  return {
    products,
    pagination: buildPagination({
      page: options.page,
      limit: options.limit,
      totalProducts: result?.totalProducts,
    }),
    filters: {
      q: options.q,
      status: options.status,
      categories: options.categories,
      colors: options.colors,
      minPrice: options.minPrice,
      maxPrice: options.maxPrice,
      sort: options.sortKey,
    },
  };
}

function normalizeFacetValues(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values.flat()) {
    const clean = String(value || '').normalize('NFKC').trim();
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('es');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result
    .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }))
    .slice(0, 500);
}

async function listPublicProductFacets({ ProductModel = Product } = {}) {
  const filter = buildPublicProductFilter();
  const [category, categories, colors, variantColors] = await Promise.all([
    ProductModel.distinct('category', filter),
    ProductModel.distinct('categories', filter),
    ProductModel.distinct('colors', filter),
    ProductModel.distinct('variants.color', filter),
  ]);
  return {
    categories: normalizeFacetValues([category, categories]),
    colors: normalizeFacetValues([colors, variantColors]),
  };
}

module.exports = {
  DEFAULT_PUBLIC_PRODUCT_LIMIT,
  MAX_PRODUCT_LIST_LIMIT,
  MAX_PRODUCT_LIST_PAGE,
  PUBLIC_PRODUCT_SORTS,
  ProductListQueryError,
  buildPagination,
  buildPublicProductListFilter,
  escapeRegex,
  listPublicProductFacets,
  listPublicProducts,
  parsePositiveInteger,
  parsePublicProductListQuery,
};
