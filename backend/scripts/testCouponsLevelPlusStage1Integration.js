'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const couponService = require('../services/couponService');
const { applyCouponIndexes } = require('../services/couponIndexMigrationService');

const MONGO_URI = String(process.env.COUPONS_STAGE1_MONGO_URI || '').trim();
const PREFIX = 'CUP-STAGE1-';
let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

async function cleanup() {
  const coupons = await Coupon.find({ code: new RegExp(`^${PREFIX}`) }).select('_id').lean();
  const ids = coupons.map((coupon) => coupon._id);
  if (ids.length) await CouponRedemption.deleteMany({ coupon: { $in: ids } });
  await Coupon.deleteMany({ code: new RegExp(`^${PREFIX}`) });
}

function order(coupon, suffix, email = 'cliente@example.com') {
  return {
    _id: new mongoose.Types.ObjectId(),
    coupon: { coupon: coupon._id, code: coupon.code, redemption: null },
    customerEmail: email,
    orderNumber: `${PREFIX}ORDER-${suffix}`,
  };
}

function reservationInput(coupon, currentOrder, email = 'cliente@example.com') {
  return {
    couponId: coupon._id,
    code: coupon.code,
    orderId: currentOrder._id,
    orderNumber: currentOrder.orderNumber,
    customerEmail: email,
    source: 'checkout',
    subtotal: 100000,
    shippingAmount: 10000,
    discount: { discountAmount: 10000, totalDiscountAmount: 10000 },
  };
}

async function main() {
  assert.match(MONGO_URI, /^mongodb(?:\+srv)?:\/\//i, 'COUPONS_STAGE1_MONGO_URI_REQUIRED');
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  try {
    await cleanup();
    await applyCouponIndexes({
      coupons: mongoose.connection.collection('coupons'),
      couponredemptions: mongoose.connection.collection('couponredemptions'),
    });

    const coupon = await couponService.createCoupon({
      code: `${PREFIX}LIMITADO`,
      name: 'Concurrencia Etapa 1',
      type: 'percentage',
      value: 10,
      minSubtotal: 0,
      status: 'active',
      usageLimit: 2,
      perCustomerLimit: 1,
      appliesTo: 'all',
    });
    const orders = [order(coupon, 1), order(coupon, 2), order(coupon, 3)];
    const attempts = await Promise.allSettled(
      orders.map((current) => couponService.recordCouponRedemption(
        reservationInput(coupon, current, `cliente${current.orderNumber.slice(-1)}@example.com`)
      ))
    );
    ok('la concurrencia respeta el límite total', attempts.filter((item) => item.status === 'fulfilled').length === 2);
    ok('la solicitud excedente falla con un código comercial', attempts.some((item) => item.status === 'rejected' && item.reason?.code === 'COUPON_USAGE_LIMIT_REACHED'));

    const refreshed = await Coupon.findById(coupon._id).lean();
    ok('el contador conserva exactamente las dos reservas', refreshed.usageCount === 2);
    const reservations = await CouponRedemption.find({ coupon: coupon._id }).sort({ createdAt: 1 });
    ok('cada orden aceptada tiene una sola reserva', reservations.length === 2 && reservations.every((item) => item.status === 'reserved'));

    const firstOrder = { ...orders.find((item) => String(item._id) === String(reservations[0].order)) };
    firstOrder.coupon.redemption = reservations[0]._id;
    const applied = await couponService.reconcileOrderCouponForStatus(firstOrder, 'paid', { source: 'test_payment' });
    ok('el pago confirma la reserva', applied.changed === true && applied.status === 'applied');
    const appliedAgain = await couponService.reconcileOrderCouponForStatus(firstOrder, 'paid', { source: 'test_payment' });
    ok('confirmar dos veces es idempotente', appliedAgain.changed === false && appliedAgain.duplicate === true);

    const secondOrder = { ...orders.find((item) => String(item._id) === String(reservations[1].order)) };
    secondOrder.coupon.redemption = reservations[1]._id;
    const released = await couponService.reconcileOrderCouponForStatus(secondOrder, 'failed', { source: 'test_gateway' });
    ok('un pago fallido libera la reserva', released.changed === true && released.status === 'released');
    await couponService.reconcileOrderCouponForStatus(secondOrder, 'failed', { source: 'test_gateway' });
    const afterRelease = await Coupon.findById(coupon._id).lean();
    ok('la liberación repetida no descuenta dos veces', afterRelease.usageCount === 1);

    const refunded = await couponService.transitionOrderCouponRedemption(firstOrder, {
      to: 'refunded',
      source: 'test_refund',
      reason: 'Reembolso total de prueba.',
    });
    ok('el reembolso total libera el uso aplicado', refunded.changed === true && refunded.status === 'refunded');
    const finalCoupon = await Coupon.findById(coupon._id).lean();
    ok('el contador vuelve a cero sin quedar negativo', finalCoupon.usageCount === 0);

    const histories = await CouponRedemption.find({ coupon: coupon._id }).lean();
    ok('cada redención conserva su historial completo', histories.every((item) => Array.isArray(item.lifecycle) && item.lifecycle.length >= 2));

    console.log(`\nCupones Nivel Plus Etapa 1 MongoDB: ${controls}/${controls} controles.`);
  } finally {
    await cleanup().catch(() => null);
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
