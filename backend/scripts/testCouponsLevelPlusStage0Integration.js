'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const couponService = require('../services/couponService');
const {
  applyCouponIndexes,
} = require('../services/couponIndexMigrationService');

const MONGO_URI = String(process.env.COUPONS_STAGE0_MONGO_URI || '').trim();
const PREFIX = 'CUP-STAGE0-';
let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function id() {
  return new mongoose.Types.ObjectId().toHexString();
}

function couponPayload(code, extra = {}) {
  return {
    code,
    name: 'Prueba Etapa 0',
    description: 'Dato comercial de prueba',
    type: 'percentage',
    value: 10,
    minSubtotal: 0,
    maxDiscountAmount: 50000,
    status: 'active',
    startsAt: null,
    endsAt: null,
    usageLimit: 10,
    perCustomerLimit: null,
    appliesTo: 'all',
    productIds: [],
    excludedProductIds: [],
    categories: [],
    excludedCategories: [],
    customerIds: [],
    newCustomersOnly: false,
    tags: ['stage0-ci'],
    internalNotes: 'Nunca debe exponerse públicamente',
    ...extra,
  };
}

async function cleanup() {
  const coupons = await Coupon.find({ code: new RegExp(`^${PREFIX}`) })
    .select('_id')
    .lean();
  const couponIds = coupons.map((coupon) => coupon._id);
  if (couponIds.length) {
    await CouponRedemption.deleteMany({ coupon: { $in: couponIds } });
  }
  await Coupon.deleteMany({ code: new RegExp(`^${PREFIX}`) });
}

async function main() {
  assert.match(MONGO_URI, /^mongodb(?:\+srv)?:\/\//i, 'COUPONS_STAGE0_MONGO_URI_REQUIRED');
  await mongoose.connect(MONGO_URI, { autoIndex: false });

  try {
    await cleanup();
    const migration = await applyCouponIndexes({
      coupons: mongoose.connection.collection('coupons'),
      couponredemptions: mongoose.connection.collection('couponredemptions'),
    });
    ok('los índices canónicos se aplican en MongoDB aislado', migration.collections.length === 2);

    const productA = id();
    const productB = id();
    const freeShipping = await couponService.createCoupon(
      couponPayload(`${PREFIX}ENVIO`, {
        type: 'free_shipping',
        value: 0,
        maxDiscountAmount: null,
        appliesTo: 'products',
        productIds: [productA],
      })
    );
    ok('se crea un cupón de envío restringido a productos', Boolean(freeShipping._id));

    const unrelated = await couponService.validateCoupon({
      code: freeShipping.code,
      subtotal: 100000,
      shippingAmount: 20000,
      items: [{ productId: productB, quantity: 1, price: 100000, lineTotal: 100000 }],
    });
    ok('envío gratis rechaza un carrito fuera del alcance', unrelated.valid === false && unrelated.code === 'COUPON_NOT_APPLICABLE_TO_CART');

    const eligible = await couponService.validateCoupon({
      code: freeShipping.code,
      subtotal: 100000,
      shippingAmount: 20000,
      items: [{ productId: productA, quantity: 1, price: 100000, lineTotal: 100000 }],
    });
    ok('envío gratis descuenta únicamente un carrito elegible', eligible.valid === true && eligible.discount.shippingDiscountAmount === 20000);

    const safe = couponService.serializePublicValidation(eligible);
    const safeJson = JSON.stringify(safe);
    ok('la respuesta pública real elimina metadatos internos', !safeJson.includes('internalNotes') && !safeJson.includes('createdBy') && !safeJson.includes('productIds'));

    const categoryCoupon = await couponService.createCoupon(
      couponPayload(`${PREFIX}CATEGORIA`, {
        appliesTo: 'categories',
        categories: ['Vestidos'],
        excludedCategories: ['Liquidación'],
      })
    );
    const excluded = await couponService.validateCoupon({
      code: categoryCoupon.code,
      subtotal: 100000,
      shippingAmount: 20000,
      items: [{ productId: productA, categories: ['Vestidos', 'Liquidación'], quantity: 1, price: 100000, lineTotal: 100000 }],
    });
    ok('una exclusión de categoría prevalece sobre la inclusión', excluded.valid === false && excluded.code === 'COUPON_NOT_APPLICABLE_TO_CART');

    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const scheduled = await couponService.createCoupon(
      couponPayload(`${PREFIX}PROGRAMADO`, { startsAt, endsAt })
    );
    await assert.rejects(
      () => couponService.updateCoupon(scheduled._id, { startsAt: new Date(endsAt.getTime() + 1000) }),
      (error) => error?.code === 'COUPON_DATE_RANGE_INVALID'
    );
    ok('una edición parcial no puede dejar fechas incoherentes');

    const scheduledList = await couponService.listCoupons({
      q: PREFIX,
      effectiveStatus: 'scheduled',
      limit: 20,
    });
    ok('el filtro efectivo encuentra cupones programados', scheduledList.rows.some((coupon) => String(coupon._id) === String(scheduled._id)));

    const legacyId = new mongoose.Types.ObjectId();
    await Coupon.collection.insertOne({
      _id: legacyId,
      ...couponPayload(`${PREFIX}LEGACY-CERO`, {
        active: true,
        usageCount: 0,
        usageLimit: 0,
        perCustomerLimit: 0,
        maxDiscountAmount: 0,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    const updatedLegacy = await couponService.updateCoupon(legacyId, {
      name: 'Cupón heredado actualizado',
    });
    ok(
      'un cupón heredado con límites en cero puede editarse y se normaliza',
      updatedLegacy.usageLimit === null &&
        updatedLegacy.perCustomerLimit === null &&
        updatedLegacy.maxDiscountAmount === null
    );

    const expired = await couponService.createCoupon(
      couponPayload(`${PREFIX}VENCIDO`, {
        status: 'expired',
        startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60 * 60 * 1000),
      })
    );
    await assert.rejects(
      () => couponService.setCouponStatus(expired._id, { status: 'active', active: true }),
      (error) => error?.code === 'COUPON_REACTIVATION_REQUIRES_END_DATE'
    );
    ok('un cupón vencido no aparenta reactivarse sin ajustar su vigencia');

    await couponService.updateCoupon(expired._id, {
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const reactivated = await couponService.setCouponStatus(
      expired._id,
      { status: 'active', active: true }
    );
    ok('un cupón puede reactivarse después de corregir su vigencia', reactivated.effectiveStatus === 'active');

    const duplicateCode = `${PREFIX}UNICO`;
    const first = await couponService.createCoupon(couponPayload(duplicateCode));
    await assert.rejects(
      () => couponService.createCoupon(couponPayload(duplicateCode)),
      (error) => error?.code === 'COUPON_CODE_DUPLICATED'
    );
    ok('el índice físico impide códigos activos duplicados');

    await couponService.deleteCoupon(first._id);
    const reused = await couponService.createCoupon(couponPayload(duplicateCode));
    ok('el borrado lógico permite reutilizar deliberadamente un código', Boolean(reused._id));

    console.log(`\nCupones Nivel Plus Etapa 0 MongoDB: ${controls}/${controls} controles.`);
  } finally {
    await cleanup().catch(() => null);
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
