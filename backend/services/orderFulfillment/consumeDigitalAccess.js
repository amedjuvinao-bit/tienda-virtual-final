'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const { safeTokenMatch } = require('./digitalAccess');
const { clean } = require('./support');

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
  consumeDigitalDeliveryAccess,
};
