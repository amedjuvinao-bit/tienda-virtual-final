'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const {
  MAX_PRODUCT_LIST_LIMIT,
  ProductListQueryError,
  buildPublicProductListFilter,
  escapeRegex,
  listPublicProducts,
  parsePublicProductListQuery,
} = require('../services/productListQueryService');
const {
  ProductCatalogInputError,
  parseAdminProductCatalogQuery,
} = require('../services/adminProductCatalogService');

const PRODUCTS = [
  {
    _id: '01',
    title: 'Camisa Basica',
    slug: 'camisa-basica',
    sku: 'CAM-001',
    barcode: '770001',
    category: 'Camisas',
    categories: ['Ropa'],
    colors: ['white'],
    price: 50_000,
    createdAt: '2026-01-01T00:00:00.000Z',
    active: true,
    visible: true,
  },
  {
    _id: '02',
    title: 'Vestido Royal',
    slug: 'vestido-royal',
    sku: 'VES-001',
    barcode: '770002',
    category: 'Vestidos',
    categories: ['Ropa'],
    colors: ['royalblue'],
    price: 120_000,
    variants: [{
      variantKey: '4__royalblue',
      sku: 'VES-4-ROYAL',
      barcode: 'VAR-770002',
      color: 'royalblue',
      active: true,
    }],
    createdAt: '2026-01-02T00:00:00.000Z',
    active: true,
    visible: true,
  },
  {
    _id: '03',
    title: 'Zapato Clasico',
    slug: 'zapato-clasico',
    sku: 'ZAP-001',
    barcode: '770003',
    category: 'Calzado',
    categories: [],
    colors: ['black'],
    price: 180_000,
    createdAt: '2026-01-03T00:00:00.000Z',
    active: true,
    visible: true,
  },
  {
    _id: '04',
    title: 'Oferta .* especial',
    slug: 'oferta-literal',
    sku: 'OFE-001',
    barcode: '770004',
    category: 'Ofertas',
    categories: [],
    colors: ['red'],
    price: 30_000,
    createdAt: '2026-01-04T00:00:00.000Z',
    active: true,
    visible: true,
  },
  {
    _id: '05',
    title: 'Producto Igual',
    slug: 'igual-a',
    sku: 'IGU-001',
    barcode: '770005',
    category: 'General',
    categories: [],
    colors: ['green'],
    price: 90_000,
    createdAt: '2026-01-05T00:00:00.000Z',
    active: true,
    visible: true,
  },
  {
    _id: '06',
    title: 'Producto Igual',
    slug: 'igual-b',
    sku: 'IGU-002',
    barcode: '770006',
    category: 'General',
    categories: [],
    colors: ['green'],
    price: 90_000,
    createdAt: '2026-01-05T00:00:00.000Z',
    active: true,
    visible: true,
  },
  {
    _id: '07',
    title: 'Producto Oculto',
    slug: 'oculto',
    sku: 'OCU-001',
    barcode: '770007',
    category: 'General',
    categories: [],
    colors: ['gray'],
    price: 10_000,
    createdAt: '2026-01-06T00:00:00.000Z',
    active: true,
    visible: false,
  },
];

const includesText = (value, query) => String(value || '')
  .toLocaleLowerCase('es')
  .includes(String(query || '').toLocaleLowerCase('es'));

function matchesAny(values, expected) {
  const normalized = values.map((value) => String(value).toLocaleLowerCase('es'));
  return expected.some((value) => normalized.includes(String(value).toLocaleLowerCase('es')));
}

function inMemoryFetchPage({ options, skip, limit }) {
  let rows = PRODUCTS.filter(
    (product) => product.active === true && product.visible !== false
  );
  if (options.q) {
    rows = rows.filter((product) => [
      product.title,
      product.sku,
      product.barcode,
      ...(product.variants || []).flatMap((variant) => [variant.sku, variant.barcode]),
    ].some((value) => includesText(value, options.q)));
  }
  const categoriesOf = (product) => [product.category, ...(product.categories || [])].filter(Boolean);
  if (options.categories.length) {
    rows = rows.filter((product) => matchesAny(categoriesOf(product), options.categories));
  }
  if (options.categoryScope.length) {
    rows = rows.filter((product) => matchesAny(categoriesOf(product), options.categoryScope));
  }
  if (options.colors.length) {
    rows = rows.filter((product) => matchesAny([
      ...(product.colors || []),
      ...(product.variants || []).map((variant) => variant.color),
    ], options.colors));
  }
  if (options.productKeys.length) {
    rows = rows.filter((product) => options.productKeys.includes(product.slug));
  }
  rows = rows.filter((product) => (
    product.price >= options.minPrice && product.price <= options.maxPrice
  ));

  const direction = options.sortKey.startsWith('-') ? -1 : 1;
  const field = options.sortKey.replace(/^-/, '');
  rows.sort((left, right) => {
    const leftValue = left[field];
    const rightValue = right[field];
    const primary = typeof leftValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), 'es', { sensitivity: 'base' });
    if (primary !== 0) return primary * direction;
    return String(left._id).localeCompare(String(right._id)) * direction;
  });
  return Promise.resolve({
    products: rows.slice(skip, skip + limit),
    totalProducts: rows.length,
  });
}

async function page(query) {
  return listPublicProducts(query, { fetchPage: inMemoryFetchPage });
}

async function run() {
  assert.equal(mongoose.connection.readyState, 0);
  const checks = [];
  const test = async (name, callback) => {
    assert.equal(mongoose.connection.readyState, 0);
    await callback();
    assert.equal(mongoose.connection.readyState, 0);
    checks.push(name);
    console.log(`OK ${checks.length} - ${name}`);
  };

  await test('primera pagina aplica limite en backend', async () => {
    const result = await page({ page: 1, limit: 2, sort: 'title' });
    assert.equal(result.products.length, 2);
    assert.deepEqual(result.products.map((item) => item._id), ['01', '04']);
    assert.equal(result.pagination.page, 1);
  });

  await test('paginas posteriores usan skip correcto', async () => {
    const result = await page({ page: 2, limit: 2, sort: 'title' });
    assert.deepEqual(result.products.map((item) => item._id), ['05', '06']);
    assert.equal(result.pagination.from, 3);
    assert.equal(result.pagination.to, 4);
  });

  await test('total de registros y paginas es global', async () => {
    const result = await page({ page: 1, limit: 2 });
    assert.equal(result.pagination.totalProducts, 6);
    assert.equal(result.pagination.totalPages, 3);
    assert.equal(result.pagination.hasNextPage, true);
  });

  await test('limites minimo y maximo son estrictos', async () => {
    assert.equal(parsePublicProductListQuery({ limit: 1 }).limit, 1);
    assert.equal(
      parsePublicProductListQuery({ limit: MAX_PRODUCT_LIST_LIMIT }).limit,
      MAX_PRODUCT_LIST_LIMIT
    );
    assert.throws(() => parsePublicProductListQuery({ limit: 0 }), ProductListQueryError);
    assert.throws(() => parsePublicProductListQuery({ limit: 101 }), ProductListQueryError);
    assert.throws(() => parsePublicProductListQuery({ page: '1x' }), ProductListQueryError);
  });

  await test('pagina inexistente devuelve lista vacia sin alterar la solicitada', async () => {
    const result = await page({ page: 99, limit: 2 });
    assert.deepEqual(result.products, []);
    assert.equal(result.pagination.page, 99);
    assert.equal(result.pagination.totalPages, 3);
  });

  await test('busqueda por nombre', async () => {
    const result = await page({ q: 'vestido' });
    assert.deepEqual(result.products.map((item) => item._id), ['02']);
  });

  await test('busqueda por SKU de producto', async () => {
    const result = await page({ q: 'CAM-001' });
    assert.deepEqual(result.products.map((item) => item._id), ['01']);
  });

  await test('busqueda por barcode de producto o variante', async () => {
    const root = await page({ q: '770003' });
    const variant = await page({ q: 'VAR-770002' });
    assert.deepEqual(root.products.map((item) => item._id), ['03']);
    assert.deepEqual(variant.products.map((item) => item._id), ['02']);
  });

  await test('filtros combinados se aplican antes de paginar', async () => {
    const result = await page({
      category: 'Vestidos',
      color: 'royalblue',
      minPrice: 100000,
      maxPrice: 130000,
      limit: 1,
    });
    assert.deepEqual(result.products.map((item) => item._id), ['02']);
    assert.equal(result.pagination.totalProducts, 1);
  });

  await test('orden ascendente y descendente usa lista permitida', async () => {
    const ascending = await page({ sort: 'price', limit: 2 });
    const descending = await page({ sort: '-price', limit: 2 });
    assert.deepEqual(ascending.products.map((item) => item._id), ['04', '01']);
    assert.deepEqual(descending.products.map((item) => item._id), ['03', '02']);
  });

  await test('ordenamiento no permitido es rechazado', async () => {
    await assert.rejects(() => page({ sort: '$where' }), ProductListQueryError);
    assert.throws(
      () => parseAdminProductCatalogQuery({ sort: 'constructor' }),
      ProductCatalogInputError
    );
  });

  await test('expresiones especiales de busqueda se escapan literalmente', async () => {
    assert.equal(escapeRegex('.*(azul)'), '\\.\\*\\(azul\\)');
    const options = parsePublicProductListQuery({ q: '.*' });
    const filter = buildPublicProductListFilter(options);
    const regex = filter.$and[0].$or[0].title;
    assert.equal(regex.test('Oferta .* especial'), true);
    assert.equal(regex.test('Oferta cualquier especial'), false);
    const result = await page({ q: '.*' });
    assert.deepEqual(result.products.map((item) => item._id), ['04']);
  });

  await test('orden es deterministico cuando el campo principal coincide', async () => {
    const ascending = await page({ q: 'Producto Igual', sort: 'title' });
    const descending = await page({ q: 'Producto Igual', sort: '-title' });
    assert.deepEqual(ascending.products.map((item) => item._id), ['05', '06']);
    assert.deepEqual(descending.products.map((item) => item._id), ['06', '05']);
  });

  await test('productos simples y variantes conservan compatibilidad', async () => {
    const simple = await page({ q: 'Camisa' });
    const variant = await page({ q: 'VES-4-ROYAL' });
    assert.equal(simple.products[0].sku, 'CAM-001');
    assert.equal(variant.products[0].variants[0].variantKey, '4__royalblue');
  });

  await test('frontend consume products y pagination sin filtrar arreglos completos', async () => {
    const root = path.join(__dirname, '..', '..');
    const catalog = fs.readFileSync(
      path.join(root, 'frontend', 'src', 'components', 'catalog', 'CatalogPageView.jsx'),
      'utf8'
    );
    const admin = fs.readFileSync(
      path.join(root, 'frontend', 'src', 'admin', 'ProductosAdmin.jsx'),
      'utf8'
    );
    assert.match(catalog, /normalizeProductPageResponse/);
    assert.match(catalog, /page:\s*String\(catalogPage\)/);
    assert.ok(!catalog.includes('products.filter((product)'));
    assert.match(admin, /productPage\.products/);
  });

  assert.equal(mongoose.connection.readyState, 0);
  console.log(`\nRESULTADO: ${checks.length}/${checks.length} pruebas aprobadas.`);
  console.log('MongoDB readyState:', mongoose.connection.readyState);
}

run().catch((error) => {
  console.error('FALLO SEGURO:', error?.code || error?.name || 'TEST_FAILED');
  process.exitCode = 1;
});
