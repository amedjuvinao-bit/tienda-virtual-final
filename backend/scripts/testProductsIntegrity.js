/* eslint-disable no-console */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  buildLegacyFromVariants,
} = require('../lib/products/productVariantLegacy');
const {
  findProductVariant,
  resolveVariantCommercialSnapshot,
} = require('../lib/products/productVariantConfig');
const {
  normalizeVariantRows,
} = require('../services/productInventorySyncService');
const Product = require('../models/Product');

const readRepoFile = (relativePath) =>
  fs.readFileSync(
    path.join(__dirname, '..', '..', relativePath),
    'utf8'
  );

const productRoutes = readRepoFile('backend/routes/productRoutes.js');
const productModel = readRepoFile('backend/models/Product.js');
const syncService = readRepoFile(
  'backend/services/productInventorySyncService.js'
);
const archiveService = readRepoFile(
  'backend/services/productArchiveService.js'
);
const adminVariants = readRepoFile(
  'backend/routes/adminProductVariants.js'
);
const formSource = readRepoFile(
  'frontend/src/admin/FormularioProducto.jsx'
);
const adminListSource = readRepoFile(
  'frontend/src/admin/ProductosAdmin.jsx'
);

let passed = 0;

function check(label, callback) {
  callback();
  passed += 1;
  console.log(`OK  ${label}`);
}

const variants = [
  {
    size: 'M',
    color: 'Azul',
    sku: 'CAM-AZU-M',
    barcode: '770000000001',
    initialStock: 5,
    active: true,
  },
  {
    size: 'L',
    color: 'Rojo',
    sku: 'CAM-ROJ-L',
    barcode: '770000000002',
    initialStock: 8,
    active: false,
  },
];

check('La compatibilidad heredada conserva variantes y excluye inactivas del stock operativo', () => {
  const legacy = buildLegacyFromVariants(variants, {
    title: 'Camiseta',
    price: 50000,
    cost: 25000,
    trackInventory: true,
  });

  assert.strictEqual(legacy.variants.length, 2);
  assert.deepStrictEqual(legacy.sizes, ['M']);
  assert.deepStrictEqual(legacy.colors, ['blue']);
  assert.deepStrictEqual(legacy.inventory, [
    { size: 'M', color: 'blue', stock: 5 },
  ]);
});

check('La API rechaza combinaciones repetidas antes de normalizarlas', () => {
  assert.throws(
    () =>
      buildLegacyFromVariants(
        [
          { size: 'M', color: 'Azul', active: true },
          { size: ' m ', color: ' azul ', active: true },
        ],
        {
          title: 'Camiseta',
          price: 50000,
          trackInventory: true,
        }
      ),
    (error) =>
      error?.name === 'ValidationError' &&
      error.message.includes('Combinación de variante duplicada')
  );
});

check('Las variantes avanzadas son la fuente autoritativa del inventario', () => {
  const rows = normalizeVariantRows(
    {
      _id: 'product-1',
      trackInventory: true,
      variants,
      inventory: [
        { size: 'M', color: 'Azul', stock: 5 },
        { size: 'L', color: 'Rojo', stock: 8 },
      ],
    },
    { variantsAuthoritative: true }
  );

  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].size, 'M');
  assert.strictEqual(rows[0].sku, 'CAM-AZU-M');
});

check('Desactivar todas las variantes no crea una variante fantasma', () => {
  const rows = normalizeVariantRows(
    {
      _id: 'product-1',
      trackInventory: true,
      variants: variants.map((variant) => ({
        ...variant,
        active: false,
      })),
      inventory: [
        { size: 'M', color: 'Azul', stock: 5 },
      ],
    },
    { variantsAuthoritative: true }
  );

  assert.deepStrictEqual(rows, []);
});

check('La compatibilidad con productos heredados permanece activa', () => {
  const rows = normalizeVariantRows({
    _id: 'legacy-product',
    trackInventory: true,
    variants: [],
    inventory: [
      { size: 'Única', color: 'Negro', stock: 3 },
    ],
  });

  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].stock, 3);
});

check('El resolver comercial ignora variantes inactivas', () => {
  const product = {
    title: 'Camiseta',
    price: 50000,
    cost: 25000,
    variants: [
      {
        size: 'L',
        color: 'Rojo',
        price: 90000,
        active: false,
      },
    ],
  };

  assert.strictEqual(
    findProductVariant(product, { size: 'L', color: 'Rojo' }),
    null
  );
  assert.strictEqual(
    resolveVariantCommercialSnapshot(
      product,
      { size: 'L', color: 'Rojo' }
    ).price,
    50000
  );
});

check('El formulario guarda ficha y variantes en una sola petición', () => {
  assert(
    formSource.includes(
      'variants: trackInventory ? variantPayload : []'
    )
  );
  assert(
    !formSource.includes(
      'api.put(`/api/admin/product-variants/${productId}`'
    )
  );
});

check('Crear y editar productos persiste variantes dentro del mismo documento', () => {
  assert(productRoutes.includes('variants: variantsProvided ? variantLegacy.variants : []'));
  assert(productRoutes.includes('prod.variants = productConfig.trackInventory'));
  assert(productRoutes.includes('prod.$locals.variantsAuthoritative'));
});

check('Los campos opcionales vacíos se pueden limpiar realmente', () => {
  for (const field of [
    'description',
    'image',
    'warehouseLocation',
    'brand',
    'season',
    'supplier',
    'barcode',
    'notes',
    'dimensionsCm',
  ]) {
    assert(
      productRoutes.includes(`hasField('${field}')`),
      `Falta limpieza explícita de ${field}`
    );
  }
});

check('Retirar un producto usa archivo lógico transaccional', () => {
  assert(productRoutes.includes('archiveProductSafely'));
  assert(archiveService.includes('session.withTransaction'));
  assert(archiveService.includes('transactionIsUnavailable'));
  assert(archiveService.includes('compensateOnFailure: true'));
  assert(archiveService.includes('archivedAt,'));
  assert(archiveService.includes('visible: false'));
  assert(archiveService.includes('inventoryRowsArchived'));
  assert(!productRoutes.includes('Product.findByIdAndDelete'));
  assert(!archiveService.includes('Product.findByIdAndDelete'));
  assert(!archiveService.includes('cloudinary.uploader.destroy'));
});

check('El modelo conserva trazabilidad y valida códigos comerciales', () => {
  assert(productModel.includes('archivedAt: { type: Date'));
  assert(productModel.includes('archivedBy: {'));
  assert(productModel.includes('SKU duplicado dentro del producto'));
  assert(productModel.includes('ya pertenece a otro producto o variante'));
});

check('Las existencias retiradas se desactivan sin borrarse', () => {
  assert(syncService.includes('const retiredIds = syncPlan.rowsToDeactivate'));
  assert(syncService.includes('{ _id: { $in: retiredIds }, active: true }'));
  assert(syncService.includes("action: 'variants_retired'"));
  assert(syncService.includes('deactivatedRows'));
  assert(!syncService.includes('InventoryStock.deleteMany'));
});

check('La ruta especializada de variantes comparte el mismo flujo seguro', () => {
  assert(adminVariants.includes("require('../lib/products/productVariantLegacy')"));
  assert(adminVariants.includes('product.$locals.variantsAuthoritative = true'));
  assert(adminVariants.includes('product.inventory = legacy.inventory'));
  assert(!adminVariants.includes('await syncProductInventoryFromProduct(saved)'));
});

check('El panel informa que el retiro conserva los datos', () => {
  assert(adminListSource.includes('Producto retirado del catálogo'));
  assert(adminListSource.includes(
    'Se conservarán su historial, inventario e imágenes.'
  ));
});

async function validateModelRejectsDuplicateCodes() {
  const product = new Product({
    sku: 'PRODUCTO-UNICO',
    title: 'Producto con códigos repetidos',
    price: 10000,
    variants: [
      {
        size: 'M',
        color: 'Azul',
        sku: 'VARIANTE-REPETIDA',
        active: true,
      },
      {
        size: 'L',
        color: 'Rojo',
        sku: 'VARIANTE-REPETIDA',
        active: true,
      },
    ],
  });

  let validationError = null;
  try {
    await product.validate();
  } catch (error) {
    validationError = error;
  }

  assert(validationError, 'El modelo aceptó SKU repetido.');
  assert.strictEqual(validationError.name, 'ValidationError');
  assert(
    validationError.message.includes(
      'SKU duplicado dentro del producto'
    )
  );

  passed += 1;
  console.log(
    'OK  El modelo rechaza códigos repetidos antes de guardar'
  );

  const duplicateCombination = new Product({
    sku: 'PRODUCTO-COMBINACION',
    title: 'Producto con combinación repetida',
    price: 10000,
    variants: [
      {
        size: 'M',
        color: 'Azul',
        active: true,
      },
      {
        size: 'M',
        color: 'Azul',
        active: true,
      },
    ],
  });

  let combinationError = null;
  try {
    await duplicateCombination.validate();
  } catch (error) {
    combinationError = error;
  }

  assert(
    combinationError?.message.includes(
      'Combinación de variante duplicada'
    ),
    'El modelo aceptó una combinación de variante repetida.'
  );

  passed += 1;
  console.log(
    'OK  El modelo rechaza combinaciones de variante repetidas'
  );
}

validateModelRejectsDuplicateCodes()
  .then(() => {
    console.log(
      `\nRESULTADO: ${passed}/${passed} controles aprobados`
    );
  })
  .catch((error) => {
    console.error('FAIL Validación dinámica del modelo');
    console.error(error);
    process.exit(1);
  });
