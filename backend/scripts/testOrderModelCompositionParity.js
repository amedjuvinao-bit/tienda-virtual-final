const assert = require('assert');
const crypto = require('crypto');

const Order = require('../models/Order');

const EXPECTED_SCHEMA_FINGERPRINT =
  '1385bd5dae9935f071ca5407505ca4e0f6943ebc5de8a4af7ed6176efd7ad86b';

function normalizeValue(value) {
  if (value === undefined) return '__undefined__';
  if (value instanceof RegExp) return String(value);
  if (typeof value === 'function') return value.name || String(value);
  return value;
}

function describePath(path) {
  const options = path.options || {};
  return {
    instance: path.instance,
    required: Boolean(path.isRequired),
    enum: (path.enumValues || []).map(String),
    default:
      typeof options.default === 'function'
        ? `fn:${options.default.name || String(options.default)}`
        : options.default,
    min: normalizeValue(path.minValidator?.min ?? options.min),
    max: normalizeValue(path.maxValidator?.max ?? options.max),
    select: options.select,
    ref: options.ref,
    lowercase: options.lowercase,
    uppercase: options.uppercase,
    trim: options.trim,
  };
}

function buildSchemaFingerprint(schema) {
  const shape = {
    paths: Object.fromEntries(
      Object.entries(schema.paths)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, path]) => [name, describePath(path)])
    ),
    nested: Object.keys(schema.nested || {}).sort(),
    singleNested: Object.keys(schema.singleNestedPaths || {}).sort(),
    indexes: schema.indexes(),
    pre: Object.fromEntries(
      [...schema.s.hooks._pres.entries()]
        .map(([name, hooks]) => [name, hooks.length])
        .sort(([left], [right]) => left.localeCompare(right))
    ),
    post: Object.fromEntries(
      [...schema.s.hooks._posts.entries()]
        .map(([name, hooks]) => [name, hooks.length])
        .sort(([left], [right]) => left.localeCompare(right))
    ),
    options: {
      timestamps: schema.options.timestamps,
      toJSON: schema.options.toJSON,
      toObject: schema.options.toObject,
    },
  };

  const serialized = JSON.stringify(shape, (_key, value) =>
    value === undefined ? '__undefined__' : value
  );
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

async function validateBehaviorParity() {
  const order = new Order({
    sessionId: ' parity ',
    orderNumber: 'PARITY-001',
    source: ' POS ',
    branchSnapshot: {
      name: ' Main   store ',
      code: ' ab-1 ',
      type: ' STORE ',
    },
    createdByAdminSnapshot: {
      username: ' ADMIN ',
      displayName: ' Ana   Admin ',
      role: ' OWNER ',
      adminRole: ' SUPER ',
    },
    cashierSnapshot: {
      username: ' CASHIER ',
      displayName: ' Caja   Uno ',
      role: ' CASHIER ',
      adminRole: ' SALES ',
    },
    tags: [' VIP ', 'vip', 'x', 'Nuevo   Cliente'],
    cart: [
      {
        title: 'Producto',
        productId: 'product-1',
        quantity: 2,
        price: 1250,
        size: ' M ',
        color: ' Azul ',
        variantAttributes: [{ key: ' RAM ', label: 'Ram', value: '8 GB' }],
      },
    ],
    discount: {
      type: 'invalid',
      value: -5,
      amount: -10,
      reason: '   Prueba   descuento ',
    },
    payment: {
      provider: ' POS ',
      status: 'invalid',
      amount: 0,
    },
    pos: {
      registerCode: ' caja-1 ',
      customerMode: 'invalid',
    },
  });

  await order.validate();

  assert.deepStrictEqual(
    {
      source: order.source,
      channel: order.channel,
      saleType: order.saleType,
      fulfillmentStatus: order.fulfillmentStatus,
    },
    {
      source: 'pos',
      channel: 'physical_store',
      saleType: 'pos_sale',
      fulfillmentStatus: 'delivered',
    }
  );
  assert.deepStrictEqual(order.tags, ['vip', 'nuevo cliente']);
  assert.deepStrictEqual(order.branchSnapshot.toObject(), {
    name: 'Main store',
    code: 'AB-1',
    type: 'store',
  });
  assert.deepStrictEqual(order.createdByAdminSnapshot.toObject(), {
    username: 'admin',
    displayName: 'Ana Admin',
    role: 'owner',
    adminRole: 'super',
  });
  assert.deepStrictEqual(order.cashierSnapshot.toObject(), {
    username: 'cashier',
    displayName: 'Caja Uno',
    role: 'cashier',
    adminRole: 'sales',
  });

  assert.strictEqual(order.items.length, 1);
  assert.deepStrictEqual(
    {
      quantity: order.items[0].quantity,
      qty: order.items[0].qty,
      price: order.items[0].price,
      unitPrice: order.items[0].unitPrice,
      priceNumber: order.items[0].priceNumber,
      variantKey: order.items[0].variantKey,
      size: order.items[0].size,
      color: order.items[0].color,
      colorLabel: order.items[0].colorLabel,
    },
    {
      quantity: 2,
      qty: 2,
      price: 1250,
      unitPrice: 1250,
      priceNumber: 1250,
      variantKey: 'v2__ram=8%20gb',
      size: 'M',
      color: 'blue',
      colorLabel: 'Azul',
    }
  );
  assert.deepStrictEqual(order.summary.toObject(), {
    itemsCount: 1,
    totalItems: 2,
    subtotal: 2500,
  });
  assert.strictEqual(order.subtotal, 2500);
  assert.strictEqual(order.shipping, 0);
  assert.strictEqual(order.total, 2500);
  assert.strictEqual(order.discount.type, 'none');
  assert.strictEqual(order.discount.value, 0);
  assert.strictEqual(order.discount.amount, 0);
  assert.strictEqual(order.discount.reason, 'Prueba descuento');
  assert.strictEqual(order.payment.provider, 'pos');
  assert.strictEqual(order.payment.status, 'paid');
  assert.strictEqual(order.payment.amount, 2500);
  assert.strictEqual(order.payment.amountInCents, 250000);
  assert.ok(order.payment.paidAt instanceof Date);
  assert.strictEqual(order.pos.registerCode, 'CAJA-1');
  assert.strictEqual(order.pos.customerMode, 'guest');
  assert.strictEqual(order.pos.confirmedAt.getTime(), order.payment.paidAt.getTime());
  assert.strictEqual(order.inventoryControl.discountedAtCheckout, false);
  assert.strictEqual(order.exchangeOrigin, undefined);
  assert.strictEqual(order.coupon, undefined);
  assert.strictEqual(order.pricing, undefined);
  assert.strictEqual(order.paymentProcessing, undefined);

  const saveHook = Order.schema.s.hooks._pres
    .get('save')
    ?.find(({ fn }) => String(fn).includes('Estado inicial'));
  assert.ok(saveHook, 'No se encontró el hook de timeline inicial de Order.');
  await new Promise((resolve, reject) => {
    saveHook.fn.call(order, (error) => (error ? reject(error) : resolve()));
  });
  assert.deepStrictEqual(
    order.timeline.map(({ type, statusTo, message, by }) => ({
      type,
      statusTo,
      message,
      by,
    })),
    [
      {
        type: 'status',
        statusTo: 'pending',
        message: 'Estado inicial',
        by: 'system',
      },
      {
        type: 'system',
        statusTo: undefined,
        message: 'Venta física POS creada',
        by: 'system',
      },
    ]
  );

  const emptyOrder = new Order({ sessionId: 'empty', orderNumber: 'PARITY-EMPTY' });
  await assert.rejects(
    emptyOrder.validate(),
    (error) =>
      error?.errors?.items?.message === 'La orden debe contener al menos un ítem.'
  );
}

async function main() {
  const schema = Order.schema;

  assert.strictEqual(Object.keys(schema.paths).length, 116);
  assert.strictEqual(Object.keys(schema.nested).length, 8);
  assert.strictEqual(Object.keys(schema.singleNestedPaths).length, 345);
  assert(schema.path('payment.manualConfirmation.requestFingerprint'));
  assert.strictEqual(schema.indexes().length, 44);
  assert.strictEqual(schema.s.hooks._pres.get('validate')?.length, 1);
  assert.strictEqual(schema.s.hooks._pres.get('save')?.length, 6);
  assert.strictEqual(buildSchemaFingerprint(schema), EXPECTED_SCHEMA_FINGERPRINT);

  await validateBehaviorParity();
  console.log('OK  Paridad estructural y de comportamiento del modelo Order');
}

main().catch((error) => {
  console.error('FAIL Paridad del modelo Order');
  console.error(error);
  process.exitCode = 1;
});
