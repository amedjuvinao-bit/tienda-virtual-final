/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Product = require('../models/Product');
const {
  normalizeCommercialFields,
  normalizeSeo,
  normalizeStringArray,
} = require('../lib/products/productCommercialConfig');
const {
  serializePublicProduct,
} = require('../lib/products/productPublicView');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');

const REPO_ROOT = path.join(__dirname, '..', '..');
let passed = 0;

function read(relativePath) {
  return fs.readFileSync(
    path.join(REPO_ROOT, relativePath),
    'utf8'
  );
}

function check(label, callback) {
  callback();
  passed += 1;
  console.log(`OK  ${label}`);
}

check('Etiquetas comerciales se limpian y no se duplican', () => {
  assert.deepStrictEqual(
    normalizeStringArray(
      [' Nuevo ', 'nuevo', 'Regalo', '', 'Destacado'],
      30,
      80
    ),
    ['Nuevo', 'Regalo', 'Destacado']
  );
});

check('SEO aplica límites y configuración de indexación', () => {
  const normalized = normalizeSeo({
    title: 'x'.repeat(90),
    description: 'Descripción comercial',
    keywords: ['Moda', 'moda', 'Regalo'],
    noIndex: true,
  });

  assert.strictEqual(normalized.title.length, 70);
  assert.deepStrictEqual(normalized.keywords, ['Moda', 'Regalo']);
  assert.strictEqual(normalized.noIndex, true);
});

check('Campos extensibles normalizan clave, tipo y visibilidad', () => {
  const fields = normalizeCommercialFields([
    {
      label: 'Material principal',
      group: 'Detalles',
      type: 'text',
      value: 'Algodón',
      public: true,
    },
    {
      label: 'Es reciclable',
      type: 'boolean',
      value: true,
      public: false,
    },
  ]);

  assert.strictEqual(fields.length, 2);
  assert.strictEqual(fields[0].key, 'material-principal');
  assert.strictEqual(fields[1].value, 'true');
  assert.strictEqual(fields[1].public, false);
});

check('El modelo contiene taxonomía, SEO y campos extensibles', () => {
  for (const pathName of [
    'primaryCategoryRef',
    'categoryRefs',
    'collectionRefs',
    'tags',
    'seo',
    'commercialFields',
  ]) {
    assert(Product.schema.path(pathName), `Falta ${pathName}`);
  }
});

check('La vista pública retira referencias y campos privados', () => {
  const publicProduct = serializePublicProduct({
    _id: 'product-id',
    title: 'Producto',
    primaryCategoryRef: {
      _id: 'category-id',
      name: 'Ropa',
      slug: 'ropa',
    },
    categoryRefs: [
      { _id: 'category-id', name: 'Ropa', slug: 'ropa' },
    ],
    collectionRefs: [
      {
        _id: 'collection-id',
        name: 'Verano',
        slug: 'verano',
      },
    ],
    cost: 5000,
    commercialFields: [
      {
        key: 'material',
        label: 'Material',
        value: 'Algodón',
        public: true,
      },
      {
        key: 'margen',
        label: 'Margen interno',
        value: '50',
        public: false,
      },
    ],
  });

  assert.strictEqual(publicProduct.cost, undefined);
  assert.strictEqual(publicProduct.primaryCategoryRef, undefined);
  assert.strictEqual(
    publicProduct.taxonomy.primaryCategory.name,
    'Ropa'
  );
  assert.strictEqual(publicProduct.commercialFields.length, 1);
});

check('Las rutas de taxonomía exigen permisos administrativos', () => {
  assert.strictEqual(
    findAdminRoutePermission(
      'GET',
      '/api/products/admin/taxonomy'
    )?.permission,
    'products:view'
  );
  assert.strictEqual(
    findAdminRoutePermission(
      'POST',
      '/api/products/admin/taxonomy'
    )?.permission,
    'products:update'
  );
  assert.strictEqual(
    findAdminRoutePermission(
      'DELETE',
      '/api/products/admin/taxonomy/64b7f1f1f1f1f1f1f1f1f1f1'
    )?.danger,
    true
  );
});

check('La API pública carga las clasificaciones estructuradas', () => {
  const routeSource = read('backend/routes/productRoutes.js');

  assert(
    routeSource.includes('.populate(PUBLIC_TAXONOMY_POPULATE)')
  );
  assert(
    routeSource.includes(
      "resolveProductTaxonomyPayload(req.body"
    )
  );
});

check('El formulario administra jerarquía, colecciones y SEO', () => {
  const source = read(
    'frontend/src/admin/FormularioProducto.jsx'
  );

  for (const pattern of [
    'Categoría principal',
    'Categorías asociadas',
    'Colecciones',
    'Crear clasificación rápida',
    'SEO del producto',
    'Campos comerciales personalizados',
    'primaryCategoryId',
    'collectionIds',
    'commercialFields',
  ]) {
    assert(source.includes(pattern), `Falta ${pattern}`);
  }
});

check('El panel filtra por categoría, colección y etiqueta', () => {
  const source = read(
    'frontend/src/admin/ProductosAdmin.jsx'
  );

  for (const pattern of [
    'categoryId: categoryFilter',
    'collectionId: collectionFilter',
    'tag: tagFilter',
    'Todas las categorías',
    'Todas las colecciones',
    'Filtrar por etiqueta exacta',
  ]) {
    assert(source.includes(pattern), `Falta ${pattern}`);
  }
});

check('La ficha pública aplica SEO y campos visibles', () => {
  const detailSource = read(
    'frontend/src/pages/ProductDetail.jsx'
  );
  const viewSource = read(
    'frontend/src/components/product-detail/ProductDetailView.jsx'
  );
  const seoSource = read('frontend/src/lib/productSeo.js');

  assert(detailSource.includes('applyProductSeo'));
  assert(viewSource.includes('publicCommercialFields'));
  assert(viewSource.includes('Especificaciones'));
  assert(seoSource.includes('application/ld+json'));
  assert(seoSource.includes('twitter:card'));
  assert(seoSource.includes('link[rel="canonical"]'));
});

console.log(
  `\nProductos clasificación y SEO: ${passed}/${passed} OK`
);
