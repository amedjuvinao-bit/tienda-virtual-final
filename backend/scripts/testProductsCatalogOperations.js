/* eslint-disable no-console */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  MAX_LIMIT,
  ProductCatalogInputError,
  normalizeProductIds,
  parseAdminProductCatalogQuery,
} = require('../services/adminProductCatalogService');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const REPO_ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(
    path.join(REPO_ROOT, relativePath),
    'utf8'
  );
}

let passed = 0;

function check(label, callback) {
  callback();
  passed += 1;
  console.log(`OK  ${label}`);
}

check('La consulta normaliza página, límite, filtros y orden', () => {
  const query = parseAdminProductCatalogQuery({
    page: '3',
    limit: '5000',
    q: '  CAMISETA  ',
    productType: 'physical',
    status: 'inactive',
    inventory: 'low_stock',
    sort: '-stock',
  });

  assert.strictEqual(query.page, 3);
  assert.strictEqual(query.limit, MAX_LIMIT);
  assert.strictEqual(query.q, 'CAMISETA');
  assert.strictEqual(query.productType, 'physical');
  assert.strictEqual(query.status, 'inactive');
  assert.strictEqual(query.inventory, 'low_stock');
  assert.strictEqual(query.sortKey, '-stock');
});

check('Los parámetros inválidos vuelven a valores seguros', () => {
  const query = parseAdminProductCatalogQuery({
    page: '-4',
    limit: '0',
    productType: 'inventado',
    status: 'deleted',
    inventory: 'anything',
    sort: 'dropDatabase',
  });

  assert.strictEqual(query.page, 1);
  assert.strictEqual(query.limit, 20);
  assert.strictEqual(query.productType, 'all');
  assert.strictEqual(query.status, 'all');
  assert.strictEqual(query.inventory, 'all');
  assert.strictEqual(query.sortKey, '-createdAt');
});

check('Las selecciones masivas eliminan duplicados y validan IDs', () => {
  const first = '64b7f1f1f1f1f1f1f1f1f1f1';
  const second = '64b7f1f1f1f1f1f1f1f1f1f2';
  const ids = normalizeProductIds([first, first, second]);

  assert.strictEqual(ids.length, 2);
  assert.strictEqual(String(ids[0]), first);
  assert.strictEqual(String(ids[1]), second);

  assert.throws(
    () => normalizeProductIds(['no-es-un-id']),
    (error) => error instanceof ProductCatalogInputError
  );
});

check('El listado y el detalle exigen permiso de lectura', () => {
  assert.strictEqual(
    findAdminRoutePermission(
      'GET',
      '/api/products/admin/list?page=2'
    )?.permission,
    'products:view'
  );
  assert.strictEqual(
    findAdminRoutePermission(
      'GET',
      '/api/products/admin/64b7f1f1f1f1f1f1f1f1f1f1'
    )?.permission,
    'products:view'
  );
});

check('Las reseñas conservan su permiso especializado', () => {
  assert.strictEqual(
    findAdminRoutePermission(
      'GET',
      '/api/products/admin/reviews'
    )?.permission,
    'products:reviews'
  );
});

check('Cada acción masiva exige el permiso correcto', () => {
  const update = findAdminRoutePermission(
    'POST',
    '/api/products/admin/bulk/update'
  );
  const archive = findAdminRoutePermission(
    'POST',
    '/api/products/admin/bulk/archive'
  );

  assert.strictEqual(update?.permission, 'products:update');
  assert.strictEqual(update?.audit, true);
  assert.strictEqual(archive?.permission, 'products:delete');
  assert.strictEqual(archive?.audit, true);
  assert.strictEqual(archive?.danger, true);
});

check('La API entrega paginación, resumen y filtros del servidor', () => {
  const routeSource = read('backend/routes/productRoutes.js');

  for (const pattern of [
    'listAdminProducts(req.query)',
    'pagination: result.pagination',
    'summary: result.summary',
    'filters: result.filters',
    "'/admin/bulk/update'",
    "'/admin/bulk/archive'",
  ]) {
    assert(
      routeSource.includes(pattern),
      `Falta ${pattern} en productRoutes.js`
    );
  }
});

check('El panel consume páginas reales y no filtra el catálogo completo', () => {
  const panelSource = read(
    'frontend/src/admin/ProductosAdmin.jsx'
  );

  for (const pattern of [
    'page,',
    'limit,',
    'q: serverQ',
    'status: statusFilter',
    'inventory: inventoryFilter',
    'sort,',
    'res.data?.pagination',
    'res.data?.summary',
    'selectedIds',
    'toggleCurrentPage',
    "'/api/products/admin/bulk/update'",
    "'/api/products/admin/bulk/archive'",
  ]) {
    assert(
      panelSource.includes(pattern),
      `Falta ${pattern} en ProductosAdmin.jsx`
    );
  }

  assert(
    !panelSource.includes('products.filter((product) =>'),
    'El panel todavía filtra en memoria todos los productos.'
  );
  assert(
    !panelSource.includes('all: 1'),
    'El panel todavía solicita el catálogo completo.'
  );
});

console.log(`\nProductos catálogo y operaciones: ${passed}/${passed} OK`);
