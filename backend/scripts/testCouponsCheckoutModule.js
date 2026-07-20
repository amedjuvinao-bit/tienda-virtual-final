// backend/scripts/testCouponsCheckoutModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

const results = {
  ok: 0,
  warn: 0,
  fail: 0,
};

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readProjectFile(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe el archivo ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertIncludes(content, expected, message) {
  assert(String(content).includes(expected), message || `No se encontró: ${expected}`);
}

function validateFilesExist() {
  [
    'backend/routes/orderCouponCheckout.js',
    'frontend/src/checkout/checkoutCouponBridge.js',
  ].forEach((file) => {
    readProjectFile(file);
    ok(`${file} existe`);
  });
}

function validateBackendOrderCouponMiddleware() {
  const middleware = readProjectFile('backend/routes/orderCouponCheckout.js');
  const indexFile = readProjectFile('backend/index.js');

  [
    "require('../services/couponService')",
    'validateIncomingCoupon',
    'applyCouponToCreatedOrder',
    'recordCouponRedemption',
    'coupon_applied',
    'COUPON_INVALID',
    'Order.collection.updateOne',
  ].forEach((needle) => assertIncludes(middleware, needle, `orderCouponCheckout.js no contiene ${needle}`));

  assertIncludes(indexFile, "./routes/orderCouponCheckout", 'index.js no carga orderCouponCheckout.');
  assertIncludes(indexFile, "app.use('/api/orders', orderCouponCheckoutRoutes)", 'index.js no monta middleware de cupones antes de órdenes.');
  ok('Backend aplica y registra cupones al crear órdenes de checkout');
}

function validateFrontendCheckoutCouponBridge() {
  const bridge = readProjectFile('frontend/src/checkout/checkoutCouponBridge.js');
  const mainFile = readProjectFile('frontend/src/main.jsx');

  [
    '/api/coupons/validate',
    'co-discount-row',
    'co-btn-secondary',
    'rb_checkout_coupon_applied',
    'api.interceptors.request.use',
    'couponCode',
    'renderCouponTotals',
  ].forEach((needle) => assertIncludes(bridge, needle, `checkoutCouponBridge.js no contiene ${needle}`));

  assertIncludes(mainFile, "./checkout/checkoutCouponBridge", 'main.jsx no activa checkoutCouponBridge.');
  ok('Frontend valida cupones, actualiza resumen y adjunta cupón a la orden');
}

function validatePackageScript() {
  const pkg = readProjectFile('backend/package.json');
  assertIncludes(pkg, 'test:coupons-checkout', 'package.json no tiene script test:coupons-checkout');
  ok('Script test:coupons-checkout registrado');
}

function main() {
  console.log('Validando conexión de cupones al checkout...');

  [
    validateFilesExist,
    validateBackendOrderCouponMiddleware,
    validateFrontendCheckoutCouponBridge,
    validatePackageScript,
  ].forEach((step) => {
    try {
      step();
    } catch (error) {
      fail(step.name, error);
    }
  });

  console.log('');
  console.log(`Resumen cupones checkout -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);

  if (results.fail > 0) process.exit(1);
}

main();
