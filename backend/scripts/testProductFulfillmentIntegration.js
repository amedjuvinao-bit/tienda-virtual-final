/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

process.env.DIGITAL_DELIVERY_TOKEN_SECRET =
  process.env.DIGITAL_DELIVERY_TOKEN_SECRET ||
  'products-ci-digital-delivery-secret';
process.env.PUBLIC_BACKEND_URL =
  process.env.PUBLIC_BACKEND_URL ||
  'https://backend.example';

const Product = require('../models/Product');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const {
  resolveBundleComponents,
  getBundleAvailableQuantity,
} = require('../services/productBundleService');
const {
  expandReservableItems,
} = require('../services/inventoryReservationService');
const {
  buildOrderQuote,
} = require('../services/orderPricingService');
const {
  buildDigitalAccessToken,
  processOrderFulfillmentAfterPayment,
  consumeDigitalDeliveryAccess,
} = require('../services/orderFulfillmentService');
const {
  loadAndValidatePosItems,
  applyPosInventoryOut,
} = require('../services/adminPosService');
const {
  assertVariantIdentity,
} = require('../lib/products/productVariantConfig');

const MONGO_URI =
  process.env.PRODUCTS_TEST_MONGO_URI ||
  process.env.MONGODB_URI ||
  '';
const RUN_ID = Math.random()
  .toString(36)
  .slice(2, 9)
  .toUpperCase();
const PREFIX = `ITEM5-${RUN_ID}`;

const productIds = [];
const orderIds = [];
let branchId = null;
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK  ${label}`);
}

async function cleanup() {
  if (orderIds.length) {
    await Order.deleteMany({ _id: { $in: orderIds } });
  }
  if (productIds.length) {
    await InventoryMovement.deleteMany({
      product: { $in: productIds },
    });
    await InventoryStock.deleteMany({
      product: { $in: productIds },
    });
    await Product.deleteMany({ _id: { $in: productIds } });
  }
  if (branchId) {
    await Branch.deleteOne({ _id: branchId });
    branchId = null;
  }
}

function productInput(overrides = {}) {
  return {
    sku: `${PREFIX}-${Math.random().toString(36).slice(2, 7)}`,
    title: `${PREFIX} Producto`,
    description: 'Producto temporal de cumplimiento.',
    category: `${PREFIX} Pruebas`,
    price: 50000,
    active: true,
    visible: true,
    ...overrides,
  };
}

async function run() {
  assert(
    MONGO_URI,
    'PRODUCTS_TEST_MONGO_URI/MONGODB_URI no está configurado.'
  );

  await mongoose.connect(MONGO_URI);

  try {
    await cleanup();

    const branch = await Branch.create({
      name: `${PREFIX} Sede`,
      code: `${PREFIX}-BR`,
      type: 'store',
      status: 'active',
      active: true,
      settings: {
        allowPosSales: true,
        allowNegativeStock: false,
      },
    });
    branchId = branch._id;

    const physical = await Product.create(
      productInput({
        sku: `${PREFIX}-PHY`,
        title: `${PREFIX} Físico`,
        productType: 'physical',
        trackInventory: true,
        variants: [
          {
            label: 'Unica / Azul',
            size: 'Unica',
            color: 'Azul',
            sku: `${PREFIX}-PHY-AZ`,
            initialStock: 0,
          },
        ],
      })
    );
    const physicalBlueVariant = physical.variants.find(
      (variant) => variant.sku === `${PREFIX}-PHY-AZ`
    );
    assert(physicalBlueVariant, 'No se resolvió la variante física canónica.');
    const digital = await Product.create(
      productInput({
        sku: `${PREFIX}-DIG`,
        title: `${PREFIX} Digital`,
        productType: 'digital',
        trackInventory: true,
        digitalDelivery: {
          deliveryMode: 'automatic',
          assetUrl: 'https://private.example/guia.pdf',
          fileName: 'guia.pdf',
          mimeType: 'application/pdf',
          downloadLimit: 2,
          accessDays: 10,
          customerMessage: 'Descarga y conserva tu guía.',
        },
      })
    );
    const service = await Product.create(
      productInput({
        sku: `${PREFIX}-SRV`,
        title: `${PREFIX} Servicio`,
        productType: 'service',
        trackInventory: true,
        serviceDelivery: {
          fulfillmentMode: 'scheduled',
          locationType: 'online',
          durationMinutes: 90,
          leadTimeHours: 24,
          bookingUrl: 'https://agenda.example/reservar',
          customerInstructions: 'Agenda después de pagar.',
          internalInstructions: 'Asignar profesional.',
        },
      })
    );
    productIds.push(physical._id, digital._id, service._id);
    ok('Productos físico, digital y servicio creados');

    assert.strictEqual(digital.trackInventory, false);
    assert.strictEqual(service.trackInventory, false);
    ok('Digital y servicio ignoran inventario propio');

    await InventoryStock.deleteMany({
      product: physical._id,
      branch: branch._id,
    });
    await InventoryStock.create({
      branch: branch._id,
      product: physical._id,
      variantKey: physicalBlueVariant.variantKey,
      variant: {
        size: physicalBlueVariant.size,
        color: physicalBlueVariant.color,
        sku: `${PREFIX}-PHY-AZ`,
      },
      stock: 8,
      reservedStock: 0,
      availableStock: 8,
      active: true,
      deletedAt: null,
    });

    assert.throws(
      () =>
        assertVariantIdentity({
          variantKey: 'otra__different',
          size: physicalBlueVariant.size,
          color: physicalBlueVariant.color,
          attributes: physicalBlueVariant.attributes || [],
        }),
      (error) => error?.code === 'VARIANT_KEY_MISMATCH'
    );
    ok('Una clave de variante realmente diferente continúa rechazada');

    const components = await resolveBundleComponents([
      {
        product: physical._id,
        variantKey: physicalBlueVariant.variantKey,
        quantity: 2,
      },
      {
        product: digital._id,
        quantity: 1,
      },
      {
        product: service._id,
        quantity: 1,
      },
    ]);
    const bundle = await Product.create(
      productInput({
        sku: `${PREFIX}-BND`,
        title: `${PREFIX} Combo`,
        productType: 'bundle',
        trackInventory: true,
        price: 150000,
        bundleComponents: components,
      })
    );
    productIds.push(bundle._id);
    ok('Combo creado con instantáneas de sus componentes');

    const bundleCapacity =
      await getBundleAvailableQuantity(bundle);
    assert.strictEqual(bundleCapacity, 4);
    ok('La disponibilidad del combo depende del componente limitante');

    const reservable = await expandReservableItems([
      {
        productId: bundle._id,
        quantity: 2,
        price: bundle.price,
      },
    ]);
    assert.strictEqual(reservable.length, 1);
    assert.strictEqual(
      String(reservable[0].productId),
      String(physical._id)
    );
    assert.strictEqual(reservable[0].quantity, 4);
    assert.strictEqual(
      String(reservable[0].bundleParentProduct),
      String(bundle._id)
    );
    ok('Reservar dos combos expande cuatro unidades físicas');

    const virtualQuote = await buildOrderQuote(
      {
        items: [
          { productId: digital._id, quantity: 1 },
          { productId: service._id, quantity: 1 },
        ],
        customer: {
          deliveryType: 'envio',
          country: '',
          city: '',
        },
      },
      {
        settings: {},
      }
    );
    assert.strictEqual(virtualQuote.pricing.shipping, 0);
    assert(
      virtualQuote.pricing.items.every(
        (item) => item.requiresShipping === false
      )
    );
    ok('Digital y servicio no cobran envío aunque el cliente envíe envio');

    const bundleQuote = await buildOrderQuote(
      {
        items: [{ productId: bundle._id, quantity: 1 }],
        customer: { deliveryType: 'envio' },
      },
      {
        settings: {},
      }
    );
    assert.strictEqual(bundleQuote.pricing.shipping, 20000);
    assert.strictEqual(
      bundleQuote.pricing.items[0].fulfillmentKind,
      'bundle'
    );
    ok('El combo mixto conserva envío y fotografía de cumplimiento');

    const posItems = await loadAndValidatePosItems(
      [
        {
          productId: bundle._id,
          quantity: 1,
        },
        {
          productId: digital._id,
          quantity: 1,
        },
        {
          productId: service._id,
          quantity: 1,
        },
      ],
      branch
    );
    const posBundle = posItems.find(
      (item) => item.product.productType === 'bundle'
    );
    const posDigital = posItems.find(
      (item) => item.product.productType === 'digital'
    );
    const posService = posItems.find(
      (item) => item.product.productType === 'service'
    );
    assert.strictEqual(posBundle.inventoryLines.length, 1);
    assert.strictEqual(posBundle.inventoryLines[0].quantity, 2);
    assert.strictEqual(posDigital.inventoryLines.length, 0);
    assert.strictEqual(posService.inventoryLines.length, 0);
    ok('POS acepta virtuales y expande el combo en la sede');

    const posOrderId = new mongoose.Types.ObjectId();
    await applyPosInventoryOut({
      order: {
        _id: posOrderId,
        orderNumber: `${PREFIX}-POS`,
      },
      validatedItems: posItems,
      branch,
      admin: {},
      session: null,
    });
    const stockAfterPos = await InventoryStock.findOne({
      product: physical._id,
      branch: branch._id,
      variantKey: physicalBlueVariant.variantKey,
    }).lean();
    assert.strictEqual(stockAfterPos.stock, 6);
    const posMovement = await InventoryMovement.findOne({
      order: posOrderId,
      product: physical._id,
      type: 'sale_out',
    }).lean();
    assert(posMovement);
    ok('La venta POS descuenta el componente y registra su movimiento');

    const order = await Order.create({
      sessionId: `${PREFIX}-SESSION`,
      orderNumber: `${PREFIX}-ORDER`,
      status: 'paid',
      items: [
        ...virtualQuote.pricing.items,
        ...bundleQuote.pricing.items,
      ],
      cart: [],
      subtotal:
        virtualQuote.pricing.subtotal +
        bundleQuote.pricing.subtotal,
      shipping: bundleQuote.pricing.shipping,
      total:
        virtualQuote.pricing.total +
        bundleQuote.pricing.total,
      customer: {
        name: 'Cliente',
        lastname: 'Prueba',
        email: 'cliente@example.com',
        emailOrPhone: 'cliente@example.com',
        deliveryType: 'envio',
      },
      billing: {
        email: 'cliente@example.com',
      },
      payment: {
        status: 'paid',
        provider: 'manual',
      },
    });
    orderIds.push(order._id);

    const sentMessages = [];
    const fulfillmentResult =
      await processOrderFulfillmentAfterPayment(
        { orderId: order._id },
        {
          mailer: async (message) => {
            sentMessages.push(message);
            return { messageId: `${PREFIX}-MAIL` };
          },
        }
      );

    assert.strictEqual(fulfillmentResult.notified, true);
    assert.strictEqual(sentMessages.length, 1);
    const fulfilled = await Order.findById(order._id)
      .select(
        '+fulfillment.digitalDeliveries.accessUrl +fulfillment.digitalDeliveries.accessTokenHash'
      );
    assert.strictEqual(
      fulfilled.fulfillment.digitalDeliveries.length,
      2
    );
    assert.strictEqual(fulfilled.fulfillment.services.length, 2);
    assert.strictEqual(
      fulfilled.fulfillment.notificationStatus,
      'sent'
    );
    ok('El pago prepara entregas directas y componentes virtuales del combo');

    const rerun = await processOrderFulfillmentAfterPayment(
      { orderId: order._id },
      {
        mailer: async () => {
          throw new Error('No debe reenviar');
        },
      }
    );
    assert.strictEqual(rerun.reused, true);
    const afterRerun = await Order.findById(order._id).lean();
    assert.strictEqual(
      afterRerun.fulfillment.digitalDeliveries.length,
      2
    );
    assert.strictEqual(afterRerun.fulfillment.services.length, 2);
    ok('Reprocesar el pago no duplica entregas ni correos');

    const directDigitalItem = fulfilled.items.find(
      (item) => item.productType === 'digital'
    );
    const delivery =
      fulfilled.fulfillment.digitalDeliveries.find(
        (entry) =>
          entry.sourceKey === String(directDigitalItem._id)
      );
    const token = buildDigitalAccessToken({
      orderId: fulfilled._id,
      orderItemId: delivery.sourceKey,
    });
    const access = await consumeDigitalDeliveryAccess({
      orderNumber: fulfilled.orderNumber,
      deliveryId: delivery._id,
      token,
    });
    assert.strictEqual(
      access.assetUrl,
      'https://private.example/guia.pdf'
    );
    const afterDownload = await Order.findById(order._id).lean();
    const downloaded =
      afterDownload.fulfillment.digitalDeliveries.find(
        (entry) => String(entry._id) === String(delivery._id)
      );
    assert.strictEqual(downloaded.downloadCount, 1);
    ok('El enlace firmado autoriza y contabiliza la descarga');

    await assert.rejects(
      () =>
        consumeDigitalDeliveryAccess({
          orderNumber: fulfilled.orderNumber,
          deliveryId: delivery._id,
          token: `${token}-alterado`,
        }),
      (error) => error.code === 'DIGITAL_DELIVERY_NOT_FOUND'
    );
    ok('Un token alterado no expone el archivo');

    console.log(
      `\nProductos cumplimiento MongoDB: ${passed}/${passed} OK`
    );
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('FAIL Productos cumplimiento MongoDB');
  console.error(error);
  process.exit(1);
});
