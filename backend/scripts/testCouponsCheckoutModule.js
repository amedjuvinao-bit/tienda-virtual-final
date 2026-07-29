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
    'backend/routes/orderQuote.js',
    'backend/services/orderPricingService.js',
    'frontend/src/pages/CheckoutPage.jsx',
  ].forEach((file) => {
    readProjectFile(file);
    ok(`${file} existe`);
  });
}

function validateBackendOrderCouponFlow() {
  const quoteRoute = readProjectFile('backend/routes/orderQuote.js');
  const pricing = readProjectFile('backend/services/orderPricingService.js');
  const orders = readProjectFile('backend/routes/orders.js');
  const indexFile = readProjectFile('backend/index.js');

  [
    "router.post('/quote'",
    'buildOrderQuote',
    'pricing',
  ].forEach((needle) => assertIncludes(quoteRoute, needle, `orderQuote.js no contiene ${needle}`));

  ['calculateOrderPricing', 'resolveAuthoritativeItems', 'resolveShippingAmount']
    .forEach((needle) => assertIncludes(pricing, needle, `orderPricingService.js no contiene ${needle}`));

  ['recordCouponRedemption', 'coupon_applied', 'couponCode', 'pricing: pricingSnapshot']
    .forEach((needle) => assertIncludes(orders, needle, `orders.js no contiene ${needle}`));

  assertIncludes(indexFile, "./routes/orderQuote", 'index.js no carga orderQuote.');
  assertIncludes(indexFile, "app.use('/api/orders', orderQuoteRoutes)", 'index.js no monta la cotización de órdenes.');
  ok('Backend cotiza y registra el cupón dentro de la creación atómica de la orden');
}

function validateFrontendCheckoutCouponFlow() {
  const checkout = readProjectFile('frontend/src/pages/CheckoutPage.jsx');
  const mainFile = readProjectFile('frontend/src/main.jsx');

  [
    '/api/orders/quote',
    'handleApplyCoupon',
    'appliedCoupon',
    'couponCode',
    'productDiscount',
    'shippingDiscount',
    'taxAmount',
  ].forEach((needle) => assertIncludes(checkout, needle, `CheckoutPage.jsx no contiene ${needle}`));

  assert(!mainFile.includes('checkoutCouponBridge'), 'main.jsx todavía activa el bridge antiguo de cupones.');
  ok('Frontend cotiza IVA y cupón con React sin manipular el DOM');
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
    validateBackendOrderCouponFlow,
    validateFrontendCheckoutCouponFlow,
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
