'use strict';

const {
  normalizeDigitalDelivery,
  normalizeServiceDelivery,
} = require('../../lib/products/productFulfillmentConfig');
const {
  buildDeterministicDeliveryId,
  buildDigitalAccessToken,
  buildDigitalAccessUrl,
  getExpiryDate,
  hashAccessToken,
} = require('./digitalAccess');
const {
  clean,
  deliveryIdentity,
  getOrderItemProductId,
} = require('./support');

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

function collectRelevantFulfillmentItems(items = []) {
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

  return relevantItems;
}

function getRelevantProductIds(relevantItems = []) {
  return Array.from(
    new Set(relevantItems.map(getOrderItemProductId).filter(Boolean))
  );
}

function materializeFulfillment({
  order,
  items,
  relevantItems,
  products,
  previous,
  now,
}) {
  const productMap = new Map(
    products.map((product) => [String(product._id), product])
  );
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

  return {
    digitalDeliveries,
    services,
    status: getFulfillmentStatus({
      items,
      digitalDeliveries,
      services,
    }),
  };
}

module.exports = {
  collectRelevantFulfillmentItems,
  getFulfillmentStatus,
  getRelevantProductIds,
  materializeFulfillment,
};
