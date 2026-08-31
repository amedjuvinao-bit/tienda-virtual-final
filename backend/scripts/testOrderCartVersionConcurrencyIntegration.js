/* eslint-disable no-console */
'use strict';

process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const Cart = require('../models/Cart');
const {
  buildCartConversionAuthority,
} = require('../services/authorizedCartOrderService');
const {
  markCartConverted,
} = require('../services/cartAdminOperationsService');
const {
  createOrderCartSnapshotFingerprint,
} = require('../services/orderCartSnapshotService');

const SOURCE_URI =
  process.env.ORDERS_CART_VERSION_MONGO_URI ||
  process.env.MONGODB_REPLICA_URI ||
  process.env.MONGODB_URI ||
  '';
const RUN_ID = crypto.randomBytes(5).toString('hex');
const RACE_COUNT = Math.max(
  10,
  Math.min(100, Number(process.env.ORDERS_CART_VERSION_RACES || 30))
);
const PRODUCT_ID = new mongoose.Types.ObjectId();

function isolatedMongoUri(uri) {
  const parsed = new URL(uri);
  parsed.pathname = `/orders_cart_version_${RUN_ID}`;
  return parsed.toString();
}

function cartItem(quantity = 1) {
  return {
    _id: PRODUCT_ID,
    title: 'Producto concurrencia',
    image: '/producto-concurrencia.webp',
    price: 25000,
    qty: quantity,
    color: '',
    colorLabel: '',
    size: '',
    variantId: 'default__default',
    variantKey: 'default__default',
    variantLabel: '',
    variantAttributes: [],
  };
}

async function loadPrivateCart(id) {
  return Cart.findById(id)
    .select('+accessTokenHash +accessVersion +accessIssuedAt')
    .exec();
}

async function createRaceCart(index) {
  return Cart.create({
    sessionId: `cart_${RUN_ID}_${String(index).padStart(32, '0')}`,
    accessTokenHash: crypto
      .createHash('sha256')
      .update(`${RUN_ID}:${index}`)
      .digest('hex'),
    accessVersion: 1,
    accessIssuedAt: new Date(),
    items: [cartItem(1)],
    lastCustomerActivityAt: new Date(),
  });
}

async function runRace(index) {
  const created = await createRaceCart(index);
  const current = await loadPrivateCart(created._id);
  const fingerprint = createOrderCartSnapshotFingerprint([
    {
      ...cartItem(1),
      productId: PRODUCT_ID,
      quantity: 1,
      productType: 'physical',
      requiresShipping: true,
    },
  ]);
  const authority = buildCartConversionAuthority(current, fingerprint);
  const orderId = new mongoose.Types.ObjectId();

  const cartWrite = Cart.updateOne(
    {
      _id: current._id,
      sessionId: current.sessionId,
      accessTokenHash: current.accessTokenHash,
      accessVersion: current.accessVersion,
      updatedAt: current.updatedAt,
      convertedOrderId: null,
    },
    {
      $set: {
        items: [cartItem(2)],
        lastCustomerActivityAt: new Date(),
      },
      $currentDate: { updatedAt: true },
    },
    { timestamps: false }
  ).exec();

  const conversion = markCartConverted({
    sessionId: current.sessionId,
    orderId,
    authority,
  });

  const [writeResult, conversionResult] = await Promise.all([
    cartWrite,
    conversion,
  ]);
  const writeWon = Number(writeResult?.matchedCount || 0) === 1;
  const conversionWon = Number(conversionResult?.matchedCount || 0) === 1;
  assert.equal(
    Number(writeWon) + Number(conversionWon),
    1,
    `carrera ${index}: exactamente una operación debe ganar`
  );

  const finalCart = await loadPrivateCart(current._id);
  if (writeWon) {
    assert.equal(finalCart.convertedOrderId, null);
    assert.equal(Number(finalCart.items[0].qty), 2);
  } else {
    assert.equal(String(finalCart.convertedOrderId), String(orderId));
    assert.equal(Number(finalCart.items[0].qty), 1);
  }
  return conversionWon ? 'order' : 'cart';
}

async function main() {
  if (!SOURCE_URI) {
    throw new Error(
      'Falta ORDERS_CART_VERSION_MONGO_URI con replica set para la prueba.'
    );
  }
  await mongoose.connect(isolatedMongoUri(SOURCE_URI), {
    serverSelectionTimeoutMS: 10000,
  });

  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert(
    hello.setName,
    'La prueba exige MongoDB replica set, igual que producción.'
  );

  const winners = { order: 0, cart: 0 };
  for (let index = 0; index < RACE_COUNT; index += 1) {
    const winner = await runRace(index);
    winners[winner] += 1;
  }

  assert.equal(winners.order + winners.cart, RACE_COUNT);
  console.log(
    `OK: ${RACE_COUNT}/${RACE_COUNT} carreras tuvieron un solo ganador atómico.`
  );
  console.log(
    `Resultado no determinista esperado: orden=${winners.order}, carrito=${winners.cart}.`
  );
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  });
