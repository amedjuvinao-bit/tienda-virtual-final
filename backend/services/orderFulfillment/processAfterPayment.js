'use strict';

const mongoose = require('mongoose');

const { sendMail } = require('../../lib/mail/mailer');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const { sendFulfillmentNotification } = require('./notification');
const {
  collectRelevantFulfillmentItems,
  getRelevantProductIds,
  materializeFulfillment,
} = require('./planning');
const { clean } = require('./support');

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
  const relevantItems = collectRelevantFulfillmentItems(items);

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

  const productIds = getRelevantProductIds(relevantItems);
  const products = await ProductModel.find({
    _id: { $in: productIds },
  })
    .select(
      'title productType digitalDelivery.deliveryMode digitalDelivery.fileName digitalDelivery.mimeType digitalDelivery.fileSizeBytes digitalDelivery.downloadLimit digitalDelivery.accessDays serviceDelivery.fulfillmentMode serviceDelivery.locationType serviceDelivery.durationMinutes serviceDelivery.leadTimeHours serviceDelivery.customerInstructions +digitalDelivery.assetUrl +digitalDelivery.customerMessage +serviceDelivery.bookingUrl +serviceDelivery.internalInstructions'
    )
    .lean();
  const previous = order.fulfillment?.toObject
    ? order.fulfillment.toObject()
    : order.fulfillment || {};
  const {
    digitalDeliveries,
    services,
    status,
  } = materializeFulfillment({
    order,
    items,
    relevantItems,
    products,
    previous,
    now,
  });

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

  return sendFulfillmentNotification({
    order,
    previous,
    now,
    OrderModel,
    mailer,
  });
}

module.exports = {
  processOrderFulfillmentAfterPayment,
};
