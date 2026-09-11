'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const couponService = require('../services/couponService');
const { applyCouponIndexes } = require('../services/couponIndexMigrationService');

const MONGO_URI = String(process.env.COUPONS_STAGE2_MONGO_URI || '').trim();
const PREFIX = 'CUP-STAGE2-';
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
  await Customer.deleteMany({ customerCode: new RegExp(`^${PREFIX}`) });
  await Branch.deleteMany({ code: new RegExp(`^${PREFIX}`) });
}

function validationInput(code, customer, branch, extra = {}) {
  return {
    code,
    subtotal: 100000,
    shippingAmount: 10000,
    items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1, price: 100000, lineTotal: 100000, categories: ['Vestidos'] }],
    customerId: customer?._id,
    customerDocument: customer?.documentNumber,
    customerEmail: customer?.email,
    channel: 'web',
    branchId: branch?._id,
    ...extra,
  };
}

async function main() {
  assert.match(MONGO_URI, /^mongodb(?:\+srv)?:\/\//i, 'COUPONS_STAGE2_MONGO_URI_REQUIRED');
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  try {
    await cleanup();
    await applyCouponIndexes({
      coupons: mongoose.connection.collection('coupons'),
      couponredemptions: mongoose.connection.collection('couponredemptions'),
    });

    const [branch, otherBranch] = await Branch.create([
      { name: 'Sede Etapa 2', code: `${PREFIX}SEDE`, type: 'store', status: 'active' },
      { name: 'Otra sede Etapa 2', code: `${PREFIX}OTRA`, type: 'store', status: 'active' },
    ]);
    const [newCustomer, frequentCustomer] = await Customer.create([
      { customerCode: `${PREFIX}NUEVO`, fullName: 'Cliente nuevo etapa dos', email: 'nuevo.etapa2@example.com', documentType: 'CC', documentNumber: '920000001', source: 'admin', stats: { ordersCount: 0 } },
      { customerCode: `${PREFIX}FRECUENTE`, fullName: 'Cliente frecuente etapa dos', email: 'frecuente.etapa2@example.com', documentType: 'CC', documentNumber: '920000002', source: 'admin', stats: { ordersCount: 3, firstPurchaseAt: new Date('2026-01-01') } },
    ]);

    const segmented = await couponService.createCoupon({
      code: `${PREFIX}SEGMENTADO`, name: 'Segmentado', type: 'percentage', value: 10,
      status: 'active', appliesTo: 'all', customerIds: [newCustomer._id],
      allowedChannels: ['web'], branchIds: [branch._id], perCustomerLimit: 1,
    });
    let validation = await couponService.validateCoupon(validationInput(segmented.code, newCustomer, branch));
    ok('cliente, canal y sede autorizados validan en MongoDB', validation.valid === true);
    validation = await couponService.validateCoupon(validationInput(segmented.code, frequentCustomer, branch));
    ok('otro cliente queda bloqueado físicamente', validation.code === 'COUPON_CUSTOMER_NOT_ALLOWED');
    validation = await couponService.validateCoupon(validationInput(segmented.code, newCustomer, branch, { channel: 'pos' }));
    ok('otro canal queda bloqueado físicamente', validation.code === 'COUPON_CHANNEL_NOT_ALLOWED');
    validation = await couponService.validateCoupon(validationInput(segmented.code, newCustomer, otherBranch));
    ok('otra sede queda bloqueada físicamente', validation.code === 'COUPON_BRANCH_NOT_ALLOWED');

    const welcome = await couponService.createCoupon({
      code: `${PREFIX}BIENVENIDA`, name: 'Primera compra', type: 'fixed', value: 5000,
      status: 'active', appliesTo: 'all', newCustomersOnly: true, allowedChannels: ['web', 'pos'],
    });
    validation = await couponService.validateCoupon(validationInput(welcome.code, newCustomer, branch));
    ok('cliente sin compras obtiene bienvenida', validation.valid === true);
    validation = await couponService.validateCoupon(validationInput(welcome.code, frequentCustomer, branch));
    ok('cliente frecuente no obtiene bienvenida', validation.code === 'COUPON_FIRST_PURCHASE_ONLY');
    await couponService.recordCouponRedemption({
      couponId: welcome._id,
      code: welcome.code,
      orderId: new mongoose.Types.ObjectId(),
      orderNumber: `${PREFIX}ORDER-WELCOME`,
      customerId: newCustomer._id,
      customerEmail: newCustomer.email,
      customerDocument: newCustomer.documentNumber,
      source: 'checkout',
      subtotal: 100000,
      discount: { discountAmount: 5000, totalDiscountAmount: 5000 },
    });
    validation = await couponService.validateCoupon(validationInput(welcome.code, newCustomer, branch));
    ok('bienvenida no admite una segunda reserva para la misma identidad', validation.code === 'COUPON_CUSTOMER_LIMIT_REACHED');

    const documentCoupon = await couponService.createCoupon({
      code: `${PREFIX}DOCUMENTO`, name: 'Límite por documento', type: 'fixed', value: 3000,
      status: 'active', appliesTo: 'all', perCustomerLimit: 1, allowedChannels: ['web'],
    });
    await couponService.recordCouponRedemption({
      couponId: documentCoupon._id,
      code: documentCoupon.code,
      orderId: new mongoose.Types.ObjectId(),
      orderNumber: `${PREFIX}ORDER-DOC`,
      customerDocument: '920.123.456',
      source: 'checkout',
      subtotal: 100000,
      discount: { discountAmount: 3000, totalDiscountAmount: 3000 },
    });
    validation = await couponService.validateCoupon(validationInput(documentCoupon.code, null, branch, {
      customerDocument: '920123456', customerEmail: '', customerId: '',
    }));
    ok('el límite por cliente reconoce el documento normalizado', validation.code === 'COUPON_CUSTOMER_LIMIT_REACHED');

    const couponIndexes = await mongoose.connection.collection('coupons').indexes();
    const redemptionIndexes = await mongoose.connection.collection('couponredemptions').indexes();
    ok('los índices físicos cubren segmentación comercial', couponIndexes.some((index) => index.name === 'allowedChannels_1') && couponIndexes.some((index) => index.name === 'branchIds_1') && couponIndexes.some((index) => index.name === 'customerIds_1'));
    ok('los índices físicos cubren límites por documento', redemptionIndexes.some((index) => index.name === 'coupon_1_status_1_customerDocument_1'));

    console.log(`\nCupones Nivel Plus Etapa 2 MongoDB: ${controls}/${controls} controles.`);
  } finally {
    await cleanup().catch(() => null);
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
