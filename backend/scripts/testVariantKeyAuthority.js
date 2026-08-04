'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  buildVariantKey,
  canonicalizeVariantKey,
  normalizeCanonicalAttributes,
  resolveVariantIdentity,
} = require('../../shared/variantKeyAuthority.cjs');
const {
  resolveVariantCommercialSnapshot,
} = require('../lib/products/productVariantConfig');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Cart = require('../models/Cart');
const {
  buildVariantSyncPlan,
  normalizeVariantRows,
} = require('../services/productInventorySyncService');
const {
  resolveReservationStockVariant,
} = require('../services/inventoryReservationService');

const checks = [];

async function check(name, callback) {
  await callback();
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function fakeId() {
  return new mongoose.Types.ObjectId();
}

async function validateMovement({ variantKey, size, color, attributes = [] }) {
  const movement = new InventoryMovement({
    movementNumber: `IM-TEST-${new mongoose.Types.ObjectId()}`,
    type: 'sale_out',
    status: 'posted',
    product: fakeId(),
    variantKey,
    variant: { size, color, attributes },
    branchFrom: fakeId(),
    quantity: 1,
    stockFrom: { before: 2, quantity: 1, after: 1 },
  });
  await movement.validate();
  return movement;
}

async function main() {
  assert.equal(
    mongoose.connection.readyState,
    0,
    'La prueba debe comenzar sin conexion a MongoDB.'
  );

  await check('conserva exactamente 4__royalblue', async () => {
    const identity = resolveVariantIdentity({
      variantKey: '4__royalblue',
      size: '4',
      color: 'Azul rey',
    });
    assert.equal(identity.variantKey, '4__royalblue');
    assert.equal(identity.size, '4');
    assert.equal(identity.color, 'royalblue');
  });

  await check('reconstruye la misma clave desde valores canonicos', async () => {
    assert.equal(buildVariantKey('4', 'royalblue'), '4__royalblue');
    assert.equal(buildVariantKey('4', 'Azul rey'), '4__royalblue');
  });

  await check('separa valor canonico y etiqueta visible', async () => {
    const attributes = normalizeCanonicalAttributes([
      { key: 'color', label: 'Color mostrado', value: 'Azul rey' },
    ]);
    assert.deepEqual(attributes, [
      { key: 'color', label: 'Color mostrado', value: 'royalblue' },
    ]);
    assert.equal(
      buildVariantKey('', '', attributes),
      'v2__color=royalblue'
    );
  });

  await check('InventoryStock no reemplaza la clave por la etiqueta', async () => {
    const stock = new InventoryStock({
      branch: fakeId(),
      product: fakeId(),
      variantKey: '4__royalblue',
      variant: { size: '4', color: 'Azul rey', label: '4 / Azul rey' },
      stock: 3,
    });
    await stock.validate();
    assert.equal(stock.variantKey, '4__royalblue');
    assert.equal(stock.variant.color, 'royalblue');
    assert.equal(stock.variant.label, '4 / Azul rey');
  });

  await check('carrito conserva clave canonica y texto visible separado', async () => {
    const cart = new Cart({
      sessionId: 'variant-key-isolated-test',
      items: [
        {
          _id: fakeId(),
          variantKey: '4__royalblue',
          size: '4',
          color: 'Azul rey',
          variantLabel: 'Azul rey',
          qty: 1,
        },
      ],
    });
    await cart.validate();
    assert.equal(cart.items[0].variantKey, '4__royalblue');
    assert.equal(cart.items[0].color, 'royalblue');
    assert.equal(cart.items[0].variantLabel, 'Azul rey');
  });

  await check('sincronizacion repetida reutiliza y no desactiva la fila correcta', async () => {
    const branch = fakeId();
    const desiredRows = normalizeVariantRows({
      trackInventory: true,
      variants: [
        {
          variantKey: '4__royalblue',
          size: '4',
          color: 'Azul rey',
          active: true,
        },
      ],
    });
    const existingRows = [
      {
        _id: fakeId(),
        branch,
        variantKey: '4__royalblue',
        variant: { size: '4', color: 'Azul rey' },
        active: true,
      },
    ];
    const first = buildVariantSyncPlan({ desiredRows, existingRows, branchId: branch });
    const second = buildVariantSyncPlan({ desiredRows, existingRows, branchId: branch });
    for (const plan of [first, second]) {
      assert.equal(plan.rowsToReuse.length, 1);
      assert.equal(plan.rowsToCreate.length, 0);
      assert.equal(plan.rowsToDeactivate.length, 0);
      assert.equal(plan.desiredRows[0].variantKey, '4__royalblue');
    }
  });

  await check('sincronizador reconoce una clave heredada equivalente', async () => {
    const branch = fakeId();
    assert.equal(
      canonicalizeVariantKey('4__azul rey'),
      '4__royalblue'
    );
    const desiredRows = [
      { variantKey: '4__royalblue', size: '4', color: 'royalblue' },
    ];
    const legacyRow = {
      _id: fakeId(),
      branch,
      variantKey: '4__azul rey',
      active: true,
    };
    const plan = buildVariantSyncPlan({
      desiredRows,
      existingRows: [legacyRow],
      branchId: branch,
    });
    assert.equal(plan.rowsToReuse.length, 1);
    assert.equal(plan.rowsToReuse[0].existing, legacyRow);
    assert.equal(plan.rowsToCreate.length, 0);
    assert.equal(plan.rowsToDeactivate.length, 0);
  });

  await check('reserva y kardex resuelven la misma clave de la fila', async () => {
    const stock = {
      _id: fakeId(),
      variantKey: '4__royalblue',
      variant: { size: '4', color: 'Azul rey', attributes: [] },
    };
    const reservationIdentity = resolveReservationStockVariant(
      stock,
      '4__royalblue'
    );
    const movement = await validateMovement({
      variantKey: reservationIdentity.variantKey,
      size: reservationIdentity.size,
      color: reservationIdentity.color,
      attributes: reservationIdentity.attributes,
    });
    assert.equal(movement.variantKey, '4__royalblue');
  });

  await check('InventoryMovement rechaza una clave incompatible', async () => {
    await assert.rejects(
      validateMovement({
        variantKey: '4__royalblue',
        size: '4',
        color: 'red',
      }),
      (error) =>
        error?.code === 'VARIANT_KEY_MISMATCH' ||
        String(error?.message || '').includes('variantKey incompatible')
    );
  });

  await check('producto simple usa default__default', async () => {
    const rows = normalizeVariantRows({
      trackInventory: true,
      stock: 7,
      variants: [],
      inventory: [],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].variantKey, 'default__default');
    assert.equal(buildVariantKey(), 'default__default');
  });

  await check('variante de varios atributos es estable e independiente del orden', async () => {
    const first = buildVariantKey('', '', [
      { key: 'material', label: 'Material', value: 'linen' },
      { key: 'color', label: 'Color', value: 'royalblue' },
      { key: 'size', label: 'Talla', value: '4' },
    ]);
    const second = buildVariantKey('', '', [
      { key: 'size', label: 'Talla visible', value: '4' },
      { key: 'color', label: 'Color visible', value: 'Azul rey' },
      { key: 'material', label: 'Material visible', value: 'linen' },
    ]);
    assert.equal(first, 'v2__color=royalblue__material=linen__size=4');
    assert.equal(second, first);
  });

  await check('snapshot comercial conserva la autoridad canonica', async () => {
    const snapshot = resolveVariantCommercialSnapshot(
      {
        price: 100,
        variants: [
          {
            variantKey: '4__royalblue',
            size: '4',
            color: 'Azul rey',
            label: 'Talla 4 / Azul rey',
            price: 120,
          },
        ],
      },
      { variantKey: '4__royalblue', color: 'Azul rey', size: '4' }
    );
    assert.equal(snapshot.variantKey, '4__royalblue');
    assert.equal(snapshot.variant.color, 'royalblue');
    assert.equal(snapshot.variantLabel, 'Talla 4 / Azul rey');
  });

  assert.equal(
    mongoose.connection.readyState,
    0,
    'La prueba no debe abrir una conexion a MongoDB.'
  );
  console.log(`RESULTADO: ${checks.length}/${checks.length} pruebas aprobadas; MongoDB no conectado.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
