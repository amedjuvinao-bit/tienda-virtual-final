'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const Favorite = require('../models/Favorite');
const {
  getFavoriteAccessFromRequest,
  issueFavoriteAccess,
  verifyFavoriteAccess,
} = require('../services/favoriteAccessService');
const {
  buildAdminFilter,
  buildFavoriteDetail,
  buildFavoritesCsv,
  canonicalizeFavoriteItems,
  listAdminFavorites,
} = require('../services/favoriteOperationsService');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const SECRET = 'favorite-access-test-secret-123456789012345678901234';
const PRODUCT_ID = '68a4a78a59706e44cade0316';
const OTHER_PRODUCT_ID = '68a4a78a59706e44cade0317';

const routeSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'favoriteRoutes.js'),
  'utf8'
);
const contextSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'context', 'FavoritesContext.jsx'),
  'utf8'
);
const accessSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'favoriteAccess.js'),
  'utf8'
);
const adminSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'admin', 'FavoritosAdmin.jsx'),
  'utf8'
);

let passed = 0;
async function test(name, callback) {
  assert.equal(mongoose.connection.readyState, 0, 'La prueba no debe conectarse a MongoDB.');
  await callback();
  assert.equal(mongoose.connection.readyState, 0, 'La prueba no debe conectarse a MongoDB.');
  passed += 1;
  console.log(`OK ${passed}: ${name}`);
}

function queryResult(value) {
  return {
    select() { return this; },
    lean() { return this; },
    exec: async () => value,
  };
}

function routeSlice(method, route, nextMarker) {
  const marker = `router.${method}('${route}'`;
  const start = routeSource.indexOf(marker);
  assert(start >= 0, `${method.toUpperCase()} ${route} no existe.`);
  const end = nextMarker ? routeSource.indexOf(nextMarker, start + marker.length) : -1;
  return routeSource.slice(start, end > start ? end : routeSource.length);
}

async function main() {
  await test('la credencial está firmada, ligada a una sola sesión y nunca usa MongoDB', () => {
    const first = issueFavoriteAccess({ secret: SECRET });
    const second = issueFavoriteAccess({ secret: SECRET });
    assert.match(first.sessionId, /^fav_[A-Za-z0-9_-]{32,100}$/);
    assert.match(first.token, /^ft1_[A-Za-z0-9_-]{40,100}\.[A-Za-z0-9_-]{40,100}$/);
    assert.equal(
      verifyFavoriteAccess({ sessionId: first.sessionId, token: first.token, secret: SECRET }),
      true
    );
    assert.equal(
      verifyFavoriteAccess({ sessionId: second.sessionId, token: first.token, secret: SECRET }),
      false
    );
    assert.equal(
      verifyFavoriteAccess({
        sessionId: first.sessionId,
        token: `${first.token.slice(0, -1)}x`,
        secret: SECRET,
      }),
      false
    );
  });

  await test('el acceso se recibe solamente en encabezados dedicados', () => {
    assert.deepEqual(
      getFavoriteAccessFromRequest({
        headers: {
          'x-favorite-session-id': 'fav_safe',
          'x-favorite-access-token': 'ft1_safe.signature',
        },
      }),
      { sessionId: 'fav_safe', token: 'ft1_safe.signature' }
    );
    assert(accessSource.includes("'X-Favorite-Session-Id'"));
    assert(accessSource.includes("'X-Favorite-Access-Token'"));
    assert(!accessSource.includes('token=${'));
    assert(!contextSource.includes('cartAccess'));
  });

  await test('las rutas públicas de lectura, escritura y borrado exigen propiedad', () => {
    const getRoute = routeSlice('get', '/:sessionId', "router.put('/:sessionId'");
    const putRoute = routeSlice('put', '/:sessionId', "router.delete('/:sessionId'");
    const deleteRoute = routeSlice('delete', '/:sessionId');
    assert(getRoute.includes("router.get('/:sessionId', requireFavoriteOwner"));
    assert(putRoute.includes("router.put('/:sessionId', requireFavoriteOwner"));
    assert(deleteRoute.includes("router.delete('/:sessionId', requireFavoriteOwner"));
    assert(routeSource.indexOf("router.post('/access'") < routeSource.indexOf("router.get('/:sessionId'"));
  });

  await test('el modelo impide sesiones duplicadas y limita listas descontroladas', () => {
    const indexes = Favorite.schema.indexes();
    assert(indexes.some(([fields, options]) => fields.sessionId === 1 && options.unique));
    const document = new Favorite({
      sessionId: `fav_${'a'.repeat(32)}`,
      items: Array.from({ length: 201 }, () => ({
        productId: PRODUCT_ID,
        title: 'Producto',
        price: 1,
      })),
    });
    const validation = document.validateSync();
    assert(validation?.errors?.items);
  });

  await test('el servidor reemplaza título, imagen, precio y SKU manipulados', async () => {
    const products = [{
      _id: PRODUCT_ID,
      title: 'Vestido oficial',
      image: '/oficial.jpg',
      price: 129900,
      sku: 'OFICIAL-01',
      category: 'Vestidos',
      active: true,
      visible: true,
      variants: [],
    }];
    const ProductModel = { find: () => queryResult(products) };
    const items = await canonicalizeFavoriteItems(
      [
        {
          productId: PRODUCT_ID,
          title: 'Producto falso',
          image: 'https://ataque.example/falso.jpg',
          price: 1,
          sku: 'FALSO',
        },
        { productId: PRODUCT_ID, price: 2 },
        { productId: OTHER_PRODUCT_ID, price: 3 },
        { productId: 'no-es-object-id', price: 4 },
      ],
      { ProductModel }
    );
    assert.equal(items.length, 1);
    assert.deepEqual(
      {
        title: items[0].title,
        image: items[0].image,
        price: items[0].price,
        sku: items[0].sku,
      },
      {
        title: 'Vestido oficial',
        image: '/oficial.jpg',
        price: 129900,
        sku: 'OFICIAL-01',
      }
    );
  });

  await test('el listado excluye documentos vacíos, escapa búsquedas y pagina en MongoDB', async () => {
    const filter = buildAdminFilter({ q: 'cliente.*(vip)', dateFrom: '2026-08-01' });
    assert.deepEqual(filter['items.0'], { $exists: true });
    assert.equal(filter.sessionId.$regex, 'cliente\\.\\*\\(vip\\)');
    let pipeline;
    const FavoriteModel = {
      aggregate(value) {
        pipeline = value;
        return Promise.resolve([{ data: [{ sessionId: 'fav_1' }], meta: [{ total: 21 }] }]);
      },
    };
    const result = await listAdminFavorites(
      { page: 2, limit: 10 },
      { FavoriteModel }
    );
    assert.equal(result.total, 21);
    assert.equal(result.totalPages, 3);
    assert(pipeline.some((stage) => stage.$facet?.data));
  });

  await test('el detalle informa disponibilidad y cambios de precio', async () => {
    const canonicalValidationService = {
      validateItems: async () => ({
        items: [{
          valid: true,
          title: 'Vestido vigente',
          image: '/vigente.jpg',
          price: 140000,
          variantSku: 'VIGENTE-01',
          availableStock: 3,
          inventoryTracked: true,
        }],
      }),
    };
    const detail = await buildFavoriteDetail(
      {
        sessionId: `fav_${'a'.repeat(32)}`,
        items: [{ _id: '68a4a78a59706e44cade0399', productId: PRODUCT_ID, price: 129900 }],
      },
      { canonicalValidationService }
    );
    assert.equal(detail.items[0].current.availableStock, 3);
    assert.deepEqual(detail.items[0].alerts.map((alert) => alert.code), ['PRICE_CHANGED']);
  });

  await test('la exportación usa UTF-8, escapa celdas y no queda limitada a cien filas', () => {
    const csv = buildFavoritesCsv([{ sessionId: 'fav_"vip"', itemsCount: 2, potentialValue: 50000 }]);
    assert.equal(csv.charCodeAt(0), 0xFEFF);
    assert(csv.includes('fav_""vip""'));
    const exportRoute = routeSlice('get', '/admin/export', "router.get('/admin'");
    assert(exportRoute.includes('limit: 10_000'));
    assert(exportRoute.includes('maxLimit: 10_000'));
  });

  await test('cada operación administrativa conserva su permiso específico', () => {
    const cases = [
      ['GET', '/api/favorites/admin', 'favorites:view'],
      ['GET', '/api/favorites/admin/export', 'favorites:export'],
      ['GET', `/api/favorites/admin/${PRODUCT_ID}`, 'favorites:view'],
      ['DELETE', `/api/favorites/admin/${PRODUCT_ID}/items/${OTHER_PRODUCT_ID}`, 'favorites:delete'],
      ['DELETE', `/api/favorites/admin/${PRODUCT_ID}`, 'favorites:delete'],
    ];
    for (const [method, pathname, permission] of cases) {
      assert.equal(findAdminRoutePermission(method, pathname)?.permission, permission);
    }
    assert(adminSource.includes('can("favorites:delete")'));
    assert(!adminSource.includes('api.put(`/api/favorites/${'));
    assert(!adminSource.includes('api.delete(`/api/favorites/${'));
  });

  console.log(`\nFavoritos etapa 1: ${passed} comprobaciones superadas.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
