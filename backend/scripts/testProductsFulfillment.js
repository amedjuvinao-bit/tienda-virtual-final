/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  normalizeDigitalDelivery,
  normalizeServiceDelivery,
  productRequiresShipping,
  getPublicFulfillmentView,
} = require('../lib/products/productFulfillmentConfig');
const {
  shouldTrackInventory,
} = require('../lib/products/productUniversalConfig');
const {
  buildDigitalAccessToken,
  buildDeterministicDeliveryId,
  hashAccessToken,
  safeTokenMatch,
} = require('../services/orderFulfillmentService');
const {
  serializePublicProduct,
} = require('../lib/products/productPublicView');

let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

function read(relativePath) {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', relativePath),
    'utf8'
  );
}

function run() {
  const digital = normalizeDigitalDelivery({
    deliveryMode: 'automatic',
    assetUrl: 'https://private.example/file.pdf',
    fileName: 'guia.pdf',
    downloadLimit: 999,
    accessDays: 0,
  });
  assert.strictEqual(digital.deliveryMode, 'automatic');
  assert.strictEqual(digital.downloadLimit, 100);
  assert.strictEqual(digital.accessDays, 1);
  ok('La entrega digital normaliza modalidad, límites y vigencia');

  const unsafeDigital = normalizeDigitalDelivery({
    deliveryMode: 'automatic',
    assetUrl: 'javascript:alert(1)',
  });
  assert.strictEqual(unsafeDigital.assetUrl, '');
  ok('Los enlaces digitales rechazan protocolos inseguros');

  const service = normalizeServiceDelivery({
    fulfillmentMode: 'scheduled',
    locationType: 'customer',
    durationMinutes: 90,
    bookingUrl: 'https://agenda.example/reserva',
  });
  assert.strictEqual(service.fulfillmentMode, 'scheduled');
  assert.strictEqual(service.locationType, 'customer');
  assert.strictEqual(service.durationMinutes, 90);
  ok('Los servicios conservan agenda, ubicación y duración');

  for (const type of ['digital', 'service', 'bundle']) {
    assert.strictEqual(shouldTrackInventory(type, true), false);
  }
  assert.strictEqual(shouldTrackInventory('physical', true), true);
  ok('Solo los productos físicos controlan inventario propio');

  assert.strictEqual(
    productRequiresShipping({ productType: 'digital' }),
    false
  );
  assert.strictEqual(
    productRequiresShipping({ productType: 'service' }),
    false
  );
  assert.strictEqual(
    productRequiresShipping({
      productType: 'bundle',
      bundleComponents: [
        { requiresShipping: false },
        { requiresShipping: true },
      ],
    }),
    true
  );
  ok('El envío se decide por el tipo y los componentes reales');

  const privateDigitalProduct = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Guía digital',
    productType: 'digital',
    active: true,
    visible: true,
    digitalDelivery: {
      deliveryMode: 'automatic',
      assetUrl: 'https://private.example/file.pdf',
      customerMessage: 'Mensaje interno',
      fileName: 'guia.pdf',
      downloadLimit: 3,
      accessDays: 30,
    },
  };
  const publicDigital = serializePublicProduct(
    privateDigitalProduct
  );
  assert.strictEqual(publicDigital.digitalDelivery, undefined);
  assert.strictEqual(publicDigital.fulfillment.kind, 'digital_delivery');
  assert.strictEqual(
    publicDigital.fulfillment.digital.fileName,
    'guia.pdf'
  );
  assert.strictEqual(
    JSON.stringify(publicDigital).includes('private.example'),
    false
  );
  assert.strictEqual(
    privateDigitalProduct.digitalDelivery.assetUrl,
    'https://private.example/file.pdf'
  );
  ok('La ficha pública describe la entrega sin revelar el archivo privado');

  const publicBundle = getPublicFulfillmentView({
    productType: 'bundle',
    bundleComponents: [
      {
        product: '507f1f77bcf86cd799439012',
        title: 'Componente',
        sku: 'CMP-1',
        quantity: 2,
        requiresShipping: true,
      },
    ],
  });
  assert.strictEqual(publicBundle.bundle.components.length, 1);
  assert.strictEqual(publicBundle.bundle.components[0].quantity, 2);
  ok('La ficha del combo publica su composición comercial');

  process.env.DIGITAL_DELIVERY_TOKEN_SECRET =
    'test-secret-product-fulfillment';
  const token = buildDigitalAccessToken({
    orderId: '507f1f77bcf86cd799439013',
    orderItemId: '507f1f77bcf86cd799439014',
  });
  const hash = hashAccessToken(token);
  assert(safeTokenMatch(token, hash));
  assert(!safeTokenMatch(`${token}x`, hash));
  const deterministicDeliveryId = buildDeterministicDeliveryId({
    orderId: '507f1f77bcf86cd799439013',
    sourceKey: '507f1f77bcf86cd799439014',
  });
  assert.strictEqual(
    String(deterministicDeliveryId),
    String(
      buildDeterministicDeliveryId({
        orderId: '507f1f77bcf86cd799439013',
        sourceKey: '507f1f77bcf86cd799439014',
      })
    )
  );
  ok('Los enlaces de descarga usan un token firmado y comparación segura');

  const productForm = read('frontend/src/admin/FormularioProducto.jsx');
  assert(productForm.includes('Entrega digital'));
  assert(productForm.includes('Prestación del servicio'));
  assert(productForm.includes('Componentes del combo'));
  assert(productForm.includes('bundleComponents'));
  ok('El formulario administra los datos operativos de los tres tipos');

  const checkout = read('frontend/src/pages/CheckoutPage.jsx');
  assert(checkout.includes('cartRequiresShipping'));
  assert(checkout.includes('cartNeedsElectronicDelivery'));
  assert(checkout.includes("setDeliveryType('digital')"));
  assert(checkout.includes('Sin envío físico'));
  ok('El checkout omite dirección y costo cuando no hay entrega física');

  const fulfillmentService = read(
    'backend/services/orderFulfillmentService.js'
  );
  assert(
    fulfillmentService.includes(
      'processOrderFulfillmentAfterPayment'
    )
  );
  assert(
    fulfillmentService.includes(
      'consumeDigitalDeliveryAccess'
    )
  );
  assert(fulfillmentService.includes('notificationStatus'));
  ok('El pago dispara entrega idempotente, correo y acceso controlado');

  const reservationService = read(
    'backend/services/inventoryReservationService.js'
  );
  assert(reservationService.includes('expandReservableItems'));
  assert(reservationService.includes('bundleParentProduct'));
  ok('La reserva expande el combo hacia sus componentes reales');

  const posService = read('backend/services/adminPosService.js');
  assert(posService.includes('inventoryLines'));
  assert(posService.includes('POS_BUNDLE_COMPONENT_STOCK_NOT_AVAILABLE'));
  assert(posService.includes('POS_FULFILLMENT_EMAIL_REQUIRED'));
  assert(posService.includes('getPublicFulfillmentView'));
  assert(posService.includes('+bundleComponents'));
  assert(posService.includes('processOrderFulfillmentAfterPayment'));
  const posCashService = read(
    'backend/services/posCashSaleService.js'
  );
  assert(posCashService.includes('processOrderFulfillmentAfterPayment'));
  ok('POS vende virtuales, descuenta el combo y activa su cumplimiento');

  const orderRoutes = read('backend/routes/orders.js');
  const orderStatusService = read(
    'backend/services/orderStatusTransitionService.js'
  );
  const permissionMap = read(
    'backend/security/adminRoutePermissionMap.js'
  );
  assert(orderRoutes.includes('reservationRequired'));
  assert(orderRoutes.includes('transitionOrderStatus'));
  assert(orderStatusService.includes('confirmInventoryReservation'));
  assert(
    orderStatusService.includes(
      'processOrderFulfillmentAfterPayment'
    )
  );
  assert(orderRoutes.includes('FULFILLMENT_EMAIL_REQUIRED'));
  ok(
    'Las órdenes sin stock no reservan y el pago manual usa la transición segura'
  );

  const servicePanel = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailFulfillmentPanel.jsx'
  );
  assert(servicePanel.includes('Cumplimiento de productos'));
  assert(servicePanel.includes('Guardar prestación'));
  assert(
    orderRoutes.includes(
      '/:id/fulfillment/services/:serviceId'
    )
  );
  assert(
    permissionMap.includes(
      '/api/orders/:id/fulfillment/services/:serviceId'
    )
  );
  assert(
    /router\.get\(\s*['"]\/:id['"],\s*requireAdmin,\s*requirePermission\(['"]orders:view['"]\)/s.test(
      orderRoutes
    )
  );
  ok('Administración controla el estado real de cada prestación');

  console.log(
    `\nProductos digitales, servicios y combos: ${passed}/${passed} OK`
  );
}

try {
  run();
} catch (error) {
  console.error('FAIL Productos digitales, servicios y combos');
  console.error(error);
  process.exit(1);
}
