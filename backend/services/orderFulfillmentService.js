'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const Product = require('../models/Product');
const { sendMail } = require('../lib/mail/mailer');
const {
  normalizeDigitalDelivery,
  normalizeServiceDelivery,
} = require('../lib/products/productFulfillmentConfig');

function clean(value, maximum = 2000) {
  return String(value || '').trim().slice(0, maximum);
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getFulfillmentSecret() {
  const secret = clean(
    process.env.DIGITAL_DELIVERY_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      process.env.ADMIN_JWT_SECRET,
    1000
  );

  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    const error = new Error(
      'Falta DIGITAL_DELIVERY_TOKEN_SECRET para habilitar descargas digitales.'
    );
    error.code = 'DIGITAL_DELIVERY_SECRET_MISSING';
    throw error;
  }

  return 'development-digital-delivery-secret';
}

function buildDigitalAccessToken({ orderId, orderItemId }) {
  return crypto
    .createHmac('sha256', getFulfillmentSecret())
    .update(`${orderId}:${orderItemId}`)
    .digest('base64url');
}

function hashAccessToken(token) {
  return crypto
    .createHash('sha256')
    .update(clean(token, 500))
    .digest('hex');
}

function buildDeterministicDeliveryId({ orderId, sourceKey }) {
  const hex = crypto
    .createHash('sha256')
    .update(`${orderId}:${sourceKey}`)
    .digest('hex')
    .slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

function safeTokenMatch(actualToken, expectedHash) {
  const actualHash = hashAccessToken(actualToken);
  const expected = clean(expectedHash, 128);

  if (
    actualHash.length !== expected.length ||
    !actualHash ||
    !expected
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(actualHash, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

function getPublicBackendUrl() {
  return clean(
    process.env.PUBLIC_BACKEND_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.API_PUBLIC_URL ||
      'http://localhost:5000',
    1000
  ).replace(/\/+$/, '');
}

function buildDigitalAccessUrl({
  orderNumber,
  deliveryId,
  token,
}) {
  return (
    `${getPublicBackendUrl()}/api/digital-deliveries/` +
    `${encodeURIComponent(orderNumber)}/` +
    `${encodeURIComponent(deliveryId)}` +
    `?token=${encodeURIComponent(token)}`
  );
}

function getCustomerEmail(order = {}) {
  const candidates = [
    order.billing?.email,
    order.customer?.email,
    order.customer?.emailOrPhone,
  ];

  return clean(
    candidates.find((value) => clean(value).includes('@')),
    320
  ).toLowerCase();
}

function getOrderItemProductId(item = {}) {
  return clean(item.product || item.productId, 80);
}

function deliveryIdentity(item = {}) {
  return clean(item.sourceKey || item.orderItemId, 240);
}

function getExpiryDate(accessDays, now = new Date()) {
  return new Date(
    now.getTime() +
      Math.max(1, Number(accessDays || 30)) * 24 * 60 * 60 * 1000
  );
}

function getFulfillmentStatus({
  items,
  digitalDeliveries,
  services,
}) {
  const hasShipment = items.some(
    (item) => item.requiresShipping !== false
  );
  const readyDigital = digitalDeliveries.filter(
    (delivery) => delivery.status === 'ready'
  ).length;
  const manualDigital = digitalDeliveries.some(
    (delivery) => delivery.status === 'manual'
  );

  if (
    digitalDeliveries.length &&
    readyDigital === digitalDeliveries.length &&
    !services.length &&
    !hasShipment
  ) {
    return {
      operational: 'delivered',
      order: 'delivered',
    };
  }

  if (manualDigital || services.length) {
    return {
      operational: 'action_required',
      order:
        readyDigital > 0 || hasShipment
          ? 'partially_delivered'
          : 'processing',
    };
  }

  if (readyDigital > 0 && hasShipment) {
    return {
      operational: 'partially_delivered',
      order: 'partially_delivered',
    };
  }

  return {
    operational: hasShipment ? 'processing' : 'pending',
    order: hasShipment ? 'reserved' : 'pending',
  };
}

function buildFulfillmentEmail(order) {
  const deliveries = order.fulfillment?.digitalDeliveries || [];
  const services = order.fulfillment?.services || [];
  const lines = [];

  for (const delivery of deliveries) {
    if (delivery.status === 'ready' && delivery.accessUrl) {
      lines.push(`
        <li style="margin-bottom:16px">
          <strong>${escapeHtml(delivery.title)}</strong><br>
          <a href="${escapeHtml(delivery.accessUrl)}">Descargar ${escapeHtml(delivery.fileName || 'archivo')}</a><br>
          <small>Disponible hasta ${escapeHtml(
            delivery.expiresAt
              ? new Date(delivery.expiresAt).toLocaleDateString('es-CO')
              : ''
          )}; máximo ${Number(delivery.downloadLimit || 1)} descargas.</small>
        </li>
      `);
    } else {
      lines.push(`
        <li style="margin-bottom:16px">
          <strong>${escapeHtml(delivery.title)}</strong><br>
          ${escapeHtml(
            delivery.customerMessage ||
              'El comercio coordinará la entrega digital.'
          )}
        </li>
      `);
    }
  }

  for (const service of services) {
    lines.push(`
      <li style="margin-bottom:16px">
        <strong>${escapeHtml(service.title)}</strong><br>
        Duración: ${Number(service.durationMinutes || 60)} minutos.<br>
        ${
          service.bookingUrl
            ? `<a href="${escapeHtml(service.bookingUrl)}">Programar servicio</a><br>`
            : ''
        }
        ${escapeHtml(
          service.customerInstructions ||
            'El comercio se comunicará para coordinar la prestación.'
        )}
      </li>
    `);
  }

  return {
    subject: `Entrega de tu pedido ${order.orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
        <h2>Tu compra está lista</h2>
        <p>Pedido <strong>${escapeHtml(order.orderNumber)}</strong>.</p>
        <ul style="padding-left:20px">${lines.join('')}</ul>
        <p>Conserva este correo para acceder a tus entregas.</p>
      </div>
    `,
  };
}

async function processOrderFulfillmentAfterPayment(
  {
    orderId,
    now = new Date(),
  } = {},
  {
    OrderModel = Order,
    ProductModel = Product,
    mailer = sendMail,
  } = {}
) {
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) {
    const error = new Error('La orden no tiene un ID válido.');
    error.code = 'FULFILLMENT_ORDER_ID_INVALID';
    throw error;
  }

  const order = await OrderModel.findById(orderId)
    .select(
      '+fulfillment.digitalDeliveries.assetUrl +fulfillment.digitalDeliveries.accessTokenHash +fulfillment.digitalDeliveries.accessUrl +fulfillment.services.bookingUrl +fulfillment.services.internalInstructions'
    );

  if (!order) {
    const error = new Error('No se encontró la orden para preparar la entrega.');
    error.code = 'FULFILLMENT_ORDER_NOT_FOUND';
    throw error;
  }

  const isPaid =
    clean(order.payment?.status, 40).toLowerCase() === 'paid' ||
    clean(order.status, 40).toLowerCase() === 'paid';

  if (!isPaid) {
    return {
      skipped: true,
      reason: 'payment_not_confirmed',
      order,
    };
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const relevantItems = [];

  for (const item of items) {
    const itemType = clean(item.productType, 30).toLowerCase();
    const orderItemId = String(item._id);

    if (['digital', 'service'].includes(itemType)) {
      relevantItems.push({
        orderItemId: item._id,
        sourceKey: orderItemId,
        product: item.product || item.productId,
        title: item.title || '',
        productType: itemType,
        quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
        fulfillmentSnapshot: item.fulfillmentSnapshot || {},
      });
      continue;
    }

    if (itemType !== 'bundle') continue;

    const components =
      item.fulfillmentSnapshot?.bundle?.components || [];
    for (const component of components) {
      const componentType = clean(
        component?.productType,
        30
      ).toLowerCase();
      if (!['digital', 'service'].includes(componentType)) {
        continue;
      }

      const productId = clean(component.product, 80);
      const variantKey =
        clean(component.variantKey, 180) ||
        'default__default';
      relevantItems.push({
        orderItemId: item._id,
        sourceKey:
          `bundle:${orderItemId}:${productId}:${variantKey}`,
        product: productId,
        title: component.title || item.title || '',
        productType: componentType,
        quantity:
          Math.max(1, Number(item.quantity || item.qty || 1)) *
          Math.max(1, Number(component.quantity || 1)),
        fulfillmentSnapshot: {},
      });
    }
  }

  if (!relevantItems.length) {
    order.fulfillment = {
      ...(order.fulfillment?.toObject
        ? order.fulfillment.toObject()
        : order.fulfillment || {}),
      status: 'processing',
      processedAt: now,
      notificationStatus: 'not_required',
    };
    await order.save();
    return {
      skipped: true,
      reason: 'no_digital_or_service_items',
      order,
    };
  }

  const productIds = Array.from(
    new Set(relevantItems.map(getOrderItemProductId).filter(Boolean))
  );
  const products = await ProductModel.find({
    _id: { $in: productIds },
  })
    .select(
      'title productType digitalDelivery.deliveryMode digitalDelivery.fileName digitalDelivery.mimeType digitalDelivery.fileSizeBytes digitalDelivery.downloadLimit digitalDelivery.accessDays serviceDelivery.fulfillmentMode serviceDelivery.locationType serviceDelivery.durationMinutes serviceDelivery.leadTimeHours serviceDelivery.customerInstructions +digitalDelivery.assetUrl +digitalDelivery.customerMessage +serviceDelivery.bookingUrl +serviceDelivery.internalInstructions'
    )
    .lean();
  const productMap = new Map(
    products.map((product) => [String(product._id), product])
  );
  const previous = order.fulfillment?.toObject
    ? order.fulfillment.toObject()
    : order.fulfillment || {};
  const existingDigital = new Map(
    (previous.digitalDeliveries || []).map((delivery) => [
      deliveryIdentity(delivery),
      delivery,
    ])
  );
  const existingServices = new Map(
    (previous.services || []).map((service) => [
      deliveryIdentity(service),
      service,
    ])
  );
  const digitalDeliveries = [];
  const services = [];

  for (const item of relevantItems) {
    const orderItemId = String(item.orderItemId);
    const sourceKey = deliveryIdentity(item);
    const product = productMap.get(getOrderItemProductId(item)) || {};

    if (item.productType === 'digital') {
      const existing = existingDigital.get(sourceKey);
      if (existing) {
        digitalDeliveries.push(existing);
        continue;
      }

      const config = normalizeDigitalDelivery(
        product.digitalDelivery ||
          item.fulfillmentSnapshot?.digital
      );
      const deliveryId = buildDeterministicDeliveryId({
        orderId: order._id,
        sourceKey,
      });
      const token = buildDigitalAccessToken({
        orderId: order._id,
        orderItemId: sourceKey,
      });
      const automatic =
        config.deliveryMode === 'automatic' &&
        Boolean(config.assetUrl);

      digitalDeliveries.push({
        _id: deliveryId,
        orderItemId: item.orderItemId,
        sourceKey,
        product: item.product || item.productId,
        title: item.title || product.title || '',
        fileName: config.fileName,
        deliveryMode: config.deliveryMode,
        assetUrl: automatic ? config.assetUrl : '',
        accessTokenHash: automatic ? hashAccessToken(token) : '',
        accessUrl: automatic
          ? buildDigitalAccessUrl({
              orderNumber: order.orderNumber,
              deliveryId,
              token,
            })
          : '',
        status: automatic ? 'ready' : 'manual',
        downloadLimit: config.downloadLimit,
        downloadCount: 0,
        expiresAt: automatic
          ? getExpiryDate(config.accessDays, now)
          : null,
        deliveredAt: automatic ? now : null,
        customerMessage: config.customerMessage,
      });
      continue;
    }

    const existing = existingServices.get(sourceKey);
    if (existing) {
      services.push(existing);
      continue;
    }

    const config = normalizeServiceDelivery(
      product.serviceDelivery ||
        item.fulfillmentSnapshot?.service
    );
    services.push({
      orderItemId: item.orderItemId,
      sourceKey,
      product: item.product || item.productId,
      title: item.title || product.title || '',
      quantity: Math.max(1, Number(item.quantity || 1)),
      fulfillmentMode: config.fulfillmentMode,
      locationType: config.locationType,
      durationMinutes: config.durationMinutes,
      leadTimeHours: config.leadTimeHours,
      bookingUrl: config.bookingUrl,
      customerInstructions: config.customerInstructions,
      internalInstructions: config.internalInstructions,
      status: 'awaiting_scheduling',
    });
  }

  const status = getFulfillmentStatus({
    items,
    digitalDeliveries,
    services,
  });
  const alreadySent = previous.notificationStatus === 'sent';

  const fulfillmentSnapshot = {
    ...previous,
    status: status.operational,
    digitalDeliveries,
    services,
    processedAt: now,
    notificationError: '',
  };
  order.fulfillment = fulfillmentSnapshot;
  order.fulfillmentStatus = status.order;
  await OrderModel.updateOne(
    { _id: order._id },
    {
      $set: {
        'fulfillment.status': fulfillmentSnapshot.status,
        'fulfillment.digitalDeliveries': digitalDeliveries,
        'fulfillment.services': services,
        'fulfillment.processedAt': now,
        fulfillmentStatus: status.order,
      },
    }
  );

  if (alreadySent) {
    return { skipped: false, reused: true, order };
  }

  const staleClaimBefore = new Date(
    now.getTime() - 10 * 60 * 1000
  );
  const notificationClaim = await OrderModel.findOneAndUpdate(
    {
      _id: order._id,
      $or: [
        {
          'fulfillment.notificationStatus': {
            $in: ['pending', 'failed'],
          },
        },
        {
          'fulfillment.notificationStatus': 'sending',
          'fulfillment.notificationClaimedAt': {
            $lt: staleClaimBefore,
          },
        },
      ],
    },
    {
      $set: {
        'fulfillment.notificationStatus': 'sending',
        'fulfillment.notificationClaimedAt': now,
        'fulfillment.notificationError': '',
      },
    },
    { new: true }
  );

  if (!notificationClaim) {
    return {
      skipped: false,
      reused: true,
      notificationInProgress: true,
      order,
    };
  }

  const to = getCustomerEmail(order);
  if (!to) {
    await OrderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          'fulfillment.notificationStatus': 'failed',
          'fulfillment.notificationClaimedAt': null,
          'fulfillment.notificationError':
            'La orden no tiene correo del cliente.',
        },
      }
    );
    return {
      skipped: false,
      notified: false,
      order,
    };
  }

  try {
    const message = buildFulfillmentEmail(order);
    await mailer({
      to,
      subject: message.subject,
      html: message.html,
    });
    await OrderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          'fulfillment.notificationStatus': 'sent',
          'fulfillment.notificationClaimedAt': null,
          'fulfillment.notifiedAt': new Date(),
          'fulfillment.notificationError': '',
        },
      }
    );
    return {
      skipped: false,
      notified: true,
      order,
    };
  } catch (error) {
    await OrderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          'fulfillment.notificationStatus': 'failed',
          'fulfillment.notificationClaimedAt': null,
          'fulfillment.notificationError': clean(
            error.message,
            500
          ),
        },
      }
    );
    return {
      skipped: false,
      notified: false,
      notificationError: error.message,
      order,
    };
  }
}

async function consumeDigitalDeliveryAccess(
  {
    orderNumber,
    deliveryId,
    token,
    now = new Date(),
  } = {},
  {
    OrderModel = Order,
  } = {}
) {
  if (!mongoose.Types.ObjectId.isValid(String(deliveryId || ''))) {
    const error = new Error('El enlace de descarga no es válido.');
    error.statusCode = 404;
    error.code = 'DIGITAL_DELIVERY_NOT_FOUND';
    throw error;
  }

  const order = await OrderModel.findOne({
    orderNumber: clean(orderNumber, 120),
  }).select(
    '+fulfillment.digitalDeliveries.assetUrl +fulfillment.digitalDeliveries.accessTokenHash'
  );
  const delivery = order?.fulfillment?.digitalDeliveries?.id(
    deliveryId
  );

  if (
    !order ||
    !delivery ||
    !safeTokenMatch(token, delivery.accessTokenHash)
  ) {
    const error = new Error('El enlace de descarga no es válido.');
    error.statusCode = 404;
    error.code = 'DIGITAL_DELIVERY_NOT_FOUND';
    throw error;
  }

  if (
    delivery.status !== 'ready' ||
    !delivery.assetUrl ||
    !['paid'].includes(clean(order.payment?.status).toLowerCase())
  ) {
    const error = new Error('La descarga todavía no está disponible.');
    error.statusCode = 409;
    error.code = 'DIGITAL_DELIVERY_NOT_READY';
    throw error;
  }

  if (delivery.expiresAt && new Date(delivery.expiresAt) <= now) {
    const error = new Error('El enlace de descarga venció.');
    error.statusCode = 410;
    error.code = 'DIGITAL_DELIVERY_EXPIRED';
    throw error;
  }

  if (
    Number(delivery.downloadCount || 0) >=
    Number(delivery.downloadLimit || 1)
  ) {
    const error = new Error('Se alcanzó el límite de descargas.');
    error.statusCode = 410;
    error.code = 'DIGITAL_DELIVERY_LIMIT_REACHED';
    throw error;
  }

  const updated = await OrderModel.updateOne(
    {
      _id: order._id,
      'fulfillment.digitalDeliveries': {
        $elemMatch: {
          _id: delivery._id,
          status: 'ready',
          downloadCount: {
            $lt: Number(delivery.downloadLimit || 1),
          },
        },
      },
    },
    {
      $inc: {
        'fulfillment.digitalDeliveries.$.downloadCount': 1,
      },
      $set: {
        'fulfillment.digitalDeliveries.$.lastDownloadedAt': now,
      },
    }
  );

  if (!updated.modifiedCount) {
    const error = new Error('Se alcanzó el límite de descargas.');
    error.statusCode = 410;
    error.code = 'DIGITAL_DELIVERY_LIMIT_REACHED';
    throw error;
  }

  return {
    assetUrl: delivery.assetUrl,
    fileName: delivery.fileName,
  };
}

module.exports = {
  buildDigitalAccessToken,
  hashAccessToken,
  safeTokenMatch,
  buildDeterministicDeliveryId,
  buildDigitalAccessUrl,
  processOrderFulfillmentAfterPayment,
  consumeDigitalDeliveryAccess,
};
