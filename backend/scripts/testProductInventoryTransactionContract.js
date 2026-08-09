/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
let passed = 0;

function read(relativePath) {
  const fullPath = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Falta el archivo requerido: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(message) {
  passed += 1;
  console.log(`OK  ${message}`);
}

function run() {
  const persistence = read(
    'backend/services/productInventoryPersistenceService.js'
  );
  const sync = read(
    'backend/services/productInventorySyncService.js'
  );
  const productModel = read('backend/models/Product.js');
  const productRoutes = read('backend/routes/productRoutes.js');
  const variantRoutes = read(
    'backend/routes/adminProductVariants.js'
  );
  const backendPackage = JSON.parse(
    read('backend/package.json')
  );
  const workflow = read('.github/workflows/products-ci.yml');

  assert(
    persistence.includes('connection.transaction') &&
      persistence.includes('productDoc.save({ session })'),
    'El producto no se guarda dentro de una transacción MongoDB.'
  );
  ok('Product se guarda dentro de una transacción real');

  assert(
    persistence.includes('syncProductInventoryFromProduct') &&
      persistence.includes('session,') &&
      persistence.includes(
        'ProductInventoryPersistenceError'
      ),
    'La sincronización de inventario no comparte la transacción.'
  );
  ok('Producto e inventario comparten la misma sesión');

  assert(
    sync.includes('writeOptions(session)') &&
      sync.includes('applySession(') &&
      sync.includes('movement.save(writeOptions(session))') &&
      sync.includes('stockRow.save(writeOptions(session))'),
    'InventoryStock o el kardex todavía escriben fuera de la sesión.'
  );
  ok('InventoryStock y el kardex escriben dentro de la sesión');

  assert(
    productModel.includes(
      'inventoryPersistenceManaged === true'
    ) &&
      productModel.includes('throw error;'),
    'El hook heredado puede duplicar o silenciar la sincronización.'
  );
  ok('El hook no duplica ni silencia errores de inventario');

  const productRouteCalls =
    productRoutes.match(
      /saveProductWithInventoryTransaction\s*\(/g
    ) || [];
  assert(
    productRouteCalls.length === 2,
    'Crear y editar productos no usan exactamente el mismo guardado transaccional.'
  );
  assert(
    productRoutes.includes(
      'PRODUCT_INVENTORY_TRANSACTION_FAILED'
    ) ||
      productRoutes.includes(
        'ProductInventoryPersistenceError'
      )
  );
  ok('Crear y editar productos usan el servicio transaccional');

  assert(
    variantRoutes.includes(
      'saveProductWithInventoryTransaction('
    ) &&
      variantRoutes.includes(
        'variantsAuthoritative: true'
      ),
    'La ruta especializada de variantes puede saltarse la transacción.'
  );
  ok('Las variantes usan el mismo guardado transaccional');

  assert(
    productRoutes.includes(
      'No se aplicó ningún cambio.'
    ) &&
      variantRoutes.includes(
        'No se aplicó ningún cambio.'
      ),
    'La API no informa claramente la reversión del guardado.'
  );
  ok('La API informa el fallo sin declarar un éxito falso');

  assert(
    backendPackage.scripts?.[
      'test:product-inventory-transaction-contract'
    ] &&
      backendPackage.scripts?.[
        'test:product-inventory-transaction'
      ] &&
      workflow.includes(
        'test:product-inventory-transaction-contract'
      ) &&
      workflow.includes(
        'test:product-inventory-transaction'
      ),
    'Las pruebas transaccionales no están registradas en CI.'
  );
  ok('El contrato y la integración están protegidos por CI');

  console.log(
    `\nContrato Producto–Inventario transaccional: ${passed}/8 verificaciones aprobadas.`
  );
}

try {
  run();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
