// backend/scripts/testProductsPublicSecurity.js
/* eslint-disable no-console */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  PUBLIC_PRODUCT_PRIVATE_FIELDS,
  PUBLIC_VARIANT_PRIVATE_FIELDS,
  PUBLIC_PRODUCT_PROJECTION,
  buildPublicProductFilter,
  serializePublicProduct,
} = require('../lib/products/productPublicView');

const routeSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'productRoutes.js'),
  'utf8'
);
const listServiceSource = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'productListQueryService.js'),
  'utf8'
);
const adminFormSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'admin', 'FormularioProducto.jsx'),
  'utf8'
);

let passed = 0;

function check(label, callback) {
  callback();
  passed += 1;
  console.log(`OK  ${label}`);
}

check('El filtro público exige producto activo y visible', () => {
  assert.deepStrictEqual(buildPublicProductFilter(), {
    active: true,
    visible: { $ne: false },
    archivedAt: null,
  });
});

check('Un criterio externo no puede habilitar productos inactivos', () => {
  assert.deepStrictEqual(
    buildPublicProductFilter({ active: false, visible: false, slug: 'privado' }),
    {
      active: true,
      visible: { $ne: false },
      archivedAt: null,
      slug: 'privado',
    }
  );
});

check('La proyección excluye todos los campos privados del producto', () => {
  for (const field of PUBLIC_PRODUCT_PRIVATE_FIELDS) {
    assert.strictEqual(PUBLIC_PRODUCT_PROJECTION[field], 0, field);
  }
});

check('La proyección excluye campos privados de las variantes', () => {
  for (const field of PUBLIC_VARIANT_PRIVATE_FIELDS) {
    assert.strictEqual(PUBLIC_PRODUCT_PROJECTION[`variants.${field}`], 0, field);
  }
});

const privateProduct = {
  _id: 'product-1',
  title: 'Producto público',
  price: 120000,
  cost: 70000,
  averageCost: 68000,
  supplier: { name: 'Proveedor privado' },
  notes: 'Nota interna',
  taxRate: 19,
  taxIncluded: true,
  reorderPoint: 4,
  reorderQty: 12,
  warehouseLocation: 'Bodega A-3',
  variants: [
    {
      variantKey: 'azul__m',
      label: 'Azul / M',
      price: 125000,
      cost: 72000,
      active: true,
    },
    {
      variantKey: 'rojo__l',
      label: 'Rojo / L',
      price: 130000,
      cost: 75000,
      active: false,
    },
  ],
};

const publicProduct = serializePublicProduct(privateProduct);

check('La respuesta pública conserva la información comercial necesaria', () => {
  assert.strictEqual(publicProduct.title, privateProduct.title);
  assert.strictEqual(publicProduct.price, privateProduct.price);
  assert.strictEqual(publicProduct.variants[0].price, privateProduct.variants[0].price);
});

check('La respuesta pública elimina datos internos y financieros', () => {
  for (const field of PUBLIC_PRODUCT_PRIVATE_FIELDS) {
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(publicProduct, field),
      false,
      field
    );
  }

  for (const field of PUBLIC_VARIANT_PRIVATE_FIELDS) {
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(publicProduct.variants[0], field),
      false,
      field
    );
  }
});

check('La respuesta pública excluye variantes inactivas', () => {
  assert.strictEqual(publicProduct.variants.length, 1);
  assert.strictEqual(publicProduct.variants[0].variantKey, 'azul__m');
});

check('La serialización no modifica el documento original', () => {
  assert.strictEqual(privateProduct.cost, 70000);
  assert.strictEqual(privateProduct.variants[0].cost, 72000);
});

check('Todas las lecturas públicas usan filtro y serialización protegidos', () => {
  const publicReadSource = `${routeSource}\n${listServiceSource}`;
  const filterUses = publicReadSource.match(/buildPublicProductFilter\(/g) || [];
  const serializerUses = publicReadSource.match(/serializePublicProduct/g) || [];

  assert(filterUses.length >= 4, 'Faltan filtros públicos en una o más rutas');
  assert(serializerUses.length >= 4, 'Falta serialización pública en una o más rutas');
  assert(
    !/const\s*\{\s*all\s*\}\s*=\s*req\.query/.test(routeSource),
    'El catálogo público todavía acepta ?all=1'
  );
});

check('El detalle administrativo permanece protegido y conserva datos completos', () => {
  assert(
    /router\.get\(\s*'\/admin\/:id',\s*requireAdmin,\s*requirePermission\('products:view'\)/s.test(
      routeSource
    ),
    'Falta protección requireAdmin en el detalle administrativo'
  );
  assert(
    /api\.get\(\s*`\/api\/products\/admin\/\$\{id\}`(?:\s*,|\s*\))/.test(
      adminFormSource
    ),
    'El formulario administrativo todavía consulta el detalle público'
  );
});

console.log(`\nRESULTADO: ${passed}/${passed} controles aprobados`);
