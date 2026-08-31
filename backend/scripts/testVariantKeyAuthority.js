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
const Order = require('../models/Order');
const {
  buildVariantSyncPlan,
  normalizeVariantRows,
} = require('../services/productInventorySyncService');
const {
  resolveReservationStockVariant,
} = require('../services/inventoryReservationService');
const {
  normalizeRequestedItems,
} = require('../services/orderRefundService');
const {
  buildReturnEligibility,
} = require('../services/orderReturnService');

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
    assert.equal(cart.items[0].colorLabel, 'Azul rey');
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

  await check('clave v2 heredada traduce el color visible sin cambiar la variante', async () => {
    const legacyKey =
      'v2__capacidad=256gb__color=azul__conectividad=5g__ram=12gb';
    const canonicalKey =
      'v2__capacidad=256gb__color=blue__conectividad=5g__ram=12gb';
    assert.equal(canonicalizeVariantKey(legacyKey), canonicalKey);
    const identity = resolveVariantIdentity({
      variantKey: legacyKey,
      attributes: [
        { key: 'capacidad', value: '256GB' },
        { key: 'color', value: 'Azul' },
        { key: 'conectividad', value: '5G' },
        { key: 'ram', value: '12GB' },
      ],
    });
    assert.equal(identity.variantKey, canonicalKey);
    assert.equal(
      identity.attributes.find((attribute) => attribute.key === 'color')?.value,
      'blue'
    );

    const snapshot = resolveVariantCommercialSnapshot(
      {
        price: 100,
        variants: [
          {
            variantKey: canonicalKey,
            attributes: identity.attributes,
            label: '256GB / Azul / 5G / 12GB',
            price: 120,
          },
        ],
      },
      {
        variantKey: legacyKey,
        variantAttributes: identity.attributes,
      }
    );
    assert.equal(snapshot.variantKey, canonicalKey);

    const duplicateColorKey = `${legacyKey}__color=blue`;
    assert.equal(canonicalizeVariantKey(duplicateColorKey), duplicateColorKey);
    assert.throws(
      () => resolveVariantIdentity({ variantKey: duplicateColorKey }),
      (error) => error?.code === 'VARIANT_KEY_MISMATCH'
    );
  });

  await check('orden heredada se valida y persiste con identidad canonica', async () => {
    const legacyKey =
      'v2__capacidad=256gb__color=azul__conectividad=5g__ram=12gb';
    const canonicalKey =
      'v2__capacidad=256gb__color=blue__conectividad=5g__ram=12gb';
    const order = new Order({
      sessionId: `variant-authority-${Date.now()}`,
      orderNumber: `VARIANT-AUTHORITY-${Date.now()}`,
      items: [
        {
          title: 'Smartphone heredado',
          variantId: legacyKey,
          variantKey: legacyKey,
          variantAttributes: [
            { key: 'capacidad', value: '256GB' },
            { key: 'color', label: 'Color', value: 'Azul' },
            { key: 'conectividad', value: '5G' },
            { key: 'ram', value: '12GB' },
          ],
          quantity: 1,
          price: 100,
        },
      ],
    });
    await order.validate();
    assert.equal(order.items[0].variantKey, canonicalKey);
    assert.equal(order.items[0].variantId, canonicalKey);
  });

  await check('reserva y devolucion aceptan la identidad v2 heredada', async () => {
    const legacyKey =
      'v2__capacidad=256gb__color=azul__conectividad=5g__ram=12gb';
    const canonicalKey =
      'v2__capacidad=256gb__color=blue__conectividad=5g__ram=12gb';
    const attributes = [
      { key: 'capacidad', value: '256GB' },
      { key: 'color', label: 'Color', value: 'Blue' },
      { key: 'conectividad', value: '5G' },
      { key: 'ram', value: '12GB' },
    ];
    const stock = {
      _id: fakeId(),
      variantKey: canonicalKey,
      variant: { attributes },
    };
    assert.equal(
      resolveReservationStockVariant(stock, legacyKey).variantKey,
      canonicalKey
    );

    const orderItemId = fakeId();
    const productId = fakeId();
    const normalizedRefund = normalizeRequestedItems(
      {
        items: [
          {
            _id: orderItemId,
            productId,
            title: 'Smartphone heredado',
            variantKey: canonicalKey,
            variantAttributes: attributes,
            quantity: 1,
          },
        ],
      },
      [{ productId, variantKey: legacyKey, quantity: 1 }]
    );
    assert.equal(normalizedRefund.length, 1);
    assert.equal(normalizedRefund[0].variantKey, canonicalKey);

    const deliveredAt = new Date();
    const eligibility = buildReturnEligibility(
      {
        status: 'delivered',
        updatedAt: deliveredAt,
        items: [
          {
            _id: orderItemId,
            product: productId,
            title: 'Smartphone heredado',
            productType: 'physical',
            variantKey: legacyKey,
            quantity: 1,
            unitPrice: 100,
          },
        ],
      },
      new Map(),
      deliveredAt
    );
    assert.equal(eligibility[0].variantKey, canonicalKey);
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
