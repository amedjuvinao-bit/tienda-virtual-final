// backend/scripts/seedTestCoupon.js
/* eslint-disable no-console */
'use strict';

const mongoose = require('mongoose');
const { env, assertEnv } = require('../config/env');
const Coupon = require('../models/Coupon');

const COUPON_CODE = 'ROSAPRUEBA10';

async function main() {
  assertEnv();

  await mongoose.connect(env.mongoUri);
  console.log('MongoDB conectado para crear cupón de prueba.');

  const now = new Date();
  const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const payload = {
    code: COUPON_CODE,
    name: 'Cupón de prueba checkout',
    description: 'Cupón temporal para probar el módulo de cupones en checkout.',
    type: 'percentage',
    value: 10,
    maxDiscountAmount: null,
    minSubtotal: 0,
    status: 'active',
    active: true,
    startsAt: now,
    endsAt,
    usageLimit: 100,
    perCustomerLimit: null,
    appliesTo: 'all',
    tags: ['prueba', 'checkout'],
    internalNotes: 'Creado por script seed:test-coupon para pruebas locales.',
    deletedAt: null,
  };

  const coupon = await Coupon.findOneAndUpdate(
    { code: COUPON_CODE },
    {
      $set: payload,
      $setOnInsert: {
        usageCount: 0,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log('Cupón activo listo para probar:');
  console.log(`Código: ${coupon.code}`);
  console.log('Tipo: 10% de descuento');
  console.log(`Vence: ${coupon.endsAt ? coupon.endsAt.toISOString().slice(0, 10) : 'sin vencimiento'}`);
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Error creando cupón de prueba:', error.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
