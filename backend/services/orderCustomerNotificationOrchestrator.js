'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const OrderCustomerNotification = require('../models/OrderCustomerNotification');
const SiteSettings = require('../models/SiteSettings');
const {
  buildScopedOrderFilter,
} = require('./orderAdminScopeService');
const {
  CUSTOMER_NOTIFIABLE_EVENT_TYPES,
  buildOrderWhatsAppPreview,
} = require('./orderCustomerNotificationService');

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function actorFromRequest(req) {
  return {
    id: cleanText(req.adminUserId || req.user?._id || req.user?.id),
    label: cleanText(
      req.adminDisplayName || req.adminUsername || req.adminUser || 'admin'
    ),
  };
}

function notificationError(message, code, statusCode) {
  return Object.assign(new Error(message), { code, statusCode });
}

function createOrderCustomerNotificationOrchestrator({
  mongooseImpl = mongoose,
  OrderModel = Order,
  OrderEventModel = OrderEvent,
  OrderCustomerNotificationModel = OrderCustomerNotification,
  SiteSettingsModel = SiteSettings,
  buildScopedOrderFilterImpl = buildScopedOrderFilter,
  buildOrderWhatsAppPreviewImpl = buildOrderWhatsAppPreview,
  now = () => new Date(),
} = {}) {
  async function loadScopedOrder(req) {
    if (!mongooseImpl.Types.ObjectId.isValid(req.params.id)) {
      throw notificationError(
        'El identificador de la orden no es válido.',
        'INVALID_ORDER_ID',
        400
      );
    }

    const access = buildScopedOrderFilterImpl(
      req,
      { _id: new mongooseImpl.Types.ObjectId(req.params.id) },
      { requestedBranchId: '', requireWholeOrder: true }
    );
    if (!access.ok) {
      throw notificationError(
        access.message || 'No tienes permiso para operar órdenes de esa sede.',
        access.error || 'ORDER_BRANCH_ACCESS_DENIED',
        access.status || 403
      );
    }

    const order = await OrderModel.findOne(access.filter).lean();
    if (!order) {
      throw notificationError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
    }
    return order;
  }

  async function loadSourceEvent(orderId, requestedEventId = '') {
    const filter = {
      orderId,
      type: { $in: CUSTOMER_NOTIFIABLE_EVENT_TYPES },
    };
    const cleanEventId = cleanText(requestedEventId);
    if (cleanEventId) {
      if (!mongooseImpl.Types.ObjectId.isValid(cleanEventId)) {
        throw notificationError(
          'El evento seleccionado no es válido.',
          'INVALID_ORDER_EVENT_ID',
          400
        );
      }
      filter._id = new mongooseImpl.Types.ObjectId(cleanEventId);
    }
    return OrderEventModel.findOne(filter).sort({ _id: -1 }).lean();
  }

  async function buildPreview(req) {
    const order = await loadScopedOrder(req);
    const requestedEventId =
      req.query?.eventId || req.body?.sourceEventId || req.body?.eventId || '';
    const [event, settings] = await Promise.all([
      loadSourceEvent(order._id, requestedEventId),
      SiteSettingsModel.findOne().select('store').lean().catch(() => null),
    ]);
    return {
      order,
      preview: buildOrderWhatsAppPreviewImpl({
        order,
        event,
        store: settings?.store || {},
      }),
    };
  }

  async function recordWhatsAppOpened(req) {
    const { order, preview } = await buildPreview(req);
    const actor = actorFromRequest(req);
    const openedAt = now();
    const sourceEventId = preview.sourceEventId
      ? new mongooseImpl.Types.ObjectId(preview.sourceEventId)
      : null;
    const notification = await OrderCustomerNotificationModel.findOneAndUpdate(
      {
        orderId: order._id,
        sourceEventId,
        channel: 'whatsapp',
        fingerprint: preview.fingerprint,
      },
      {
        $set: {
          status: 'opened',
          sourceEventType: preview.sourceEventType,
          templateVersion: preview.templateVersion,
          recipientMasked: preview.recipient.maskedPhone,
          stage: preview.report.stage,
          lastOpenedAt: openedAt,
          lastOpenedBy: actor,
        },
        $setOnInsert: { firstOpenedAt: openedAt },
        $inc: { openCount: 1 },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    await OrderEventModel.create({
      orderId: order._id,
      type: 'whatsapp_opened',
      message: `WhatsApp preparado para ${preview.recipient.maskedPhone}: ${preview.report.stage}.`,
      meta: {
        channel: 'whatsapp',
        assisted: true,
        deliveryConfirmed: false,
        sourceEventId: preview.sourceEventId || null,
        sourceEventType: preview.sourceEventType,
        notificationId: notification._id,
        fingerprint: preview.fingerprint,
        recipientMasked: preview.recipient.maskedPhone,
        stage: preview.report.stage,
        by: actor,
      },
    });

    return { notification, order, preview };
  }

  return {
    buildPreview,
    loadScopedOrder,
    loadSourceEvent,
    recordWhatsAppOpened,
  };
}

const defaultOrchestrator = createOrderCustomerNotificationOrchestrator();

module.exports = {
  actorFromRequest,
  cleanText,
  createOrderCustomerNotificationOrchestrator,
  notificationError,
  ...defaultOrchestrator,
};
