// backend/scripts/seedTestCoupon.js
/* eslint-disable no-console */
'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const { env, assertEnv } = require('../config/env');
const Coupon = require('../models/Coupon');

const COUPON_PREFIX = 'CUP';
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LEGACY_TEST_CODES = ['ROSAPRUEBA10'];

function randomSafeChar() {
  return SAFE_CHARS[crypto.randomInt(0, SAFE_CHARS.length)];
}

function randomSegment(length = 4) {
  return Array.from({ length }, randomSafeChar).join('');
}

function generatePublicCouponCode() {
  return `${COUPON_PREFIX}-${randomSegment(4)}-${randomSegment(4)}`;
}

async function generateUniqueCouponCode(existingCouponId = null) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generatePublicCouponCode();
    const existing = await Coupon.findOne({ code, deletedAt: null }).select('_id').lean();

    if (!existing) return code;
    if (existingCouponId && String(existing._id) === String(existingCouponId)) return code;
  }

  throw new Error('No se pudo generar un código único de cupón de prueba.');
}

async function main() {
  assertEnv();

  await mongoose.connect(env.mongoUri);
  console.log('MongoDB conectado para crear cupón de prueba.');

  const now = new Date();
  const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const existingTestCoupon = await Coupon.findOne({
    $or: [
      { code: { $in: LEGACY_TEST_CODES } },
      { tags: 'seed-test-coupon' },
    ],
  });

  const generatedCode = await generateUniqueCouponCode(existingTestCoupon?._id || null);

  const payload = {
    code: generatedCode,
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
    tags: ['prueba', 'checkout', 'seed-test-coupon'],
    internalNotes: 'Creado por script seed:test-coupon para pruebas locales con código público aleatorio.',
    deletedAt: null,
  };

  let coupon;

  if (existingTestCoupon?._id) {
    coupon = await Coupon.findByIdAndUpdate(
      existingTestCoupon._id,
      { $set: payload },
      {
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  } else {
    coupon = await Coupon.create({
      ...payload,
      usageCount: 0,
    });
  }

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