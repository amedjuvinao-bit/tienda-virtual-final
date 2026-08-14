const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const Order = require('../models/Order');
const OrderCustomerNotification = require('../models/OrderCustomerNotification');
const SiteSettings = require('../models/SiteSettings');
const {
  buildScopedOrderFilter,
} = require('../services/orderAdminScopeService');
const {
  CUSTOMER_NOTIFIABLE_EVENT_TYPES,
  buildOrderWhatsAppPreview,
} = require('../services/orderCustomerNotificationService');

const OrderEvent =
  mongoose.models.OrderEvent ||
  mongoose.model(
    'OrderEvent',
    new mongoose.Schema(
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Order',
          index: true,
          required: true,
        },
        type: { type: String, required: true },
        message: { type: String },
        meta: { type: Object },
      },
      {
        timestamps: { createdAt: true, updatedAt: false },
        versionKey: false,
      }
    ),
    'order_events'
  );

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

function respondError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);
  return res.status(status).json({
    ok: false,
    error: error?.code || 'ORDER_WHATSAPP_PREVIEW_ERROR',
    message:
      error?.message ||
      'No fue posible preparar el informe de WhatsApp de la orden.',
  });
}

async function loadScopedOrder(req) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    const error = new Error('El identificador de la orden no es válido.');
    error.code = 'INVALID_ORDER_ID';
    error.statusCode = 400;
    throw error;
  }

  const access = buildScopedOrderFilter(
    req,
    { _id: new mongoose.Types.ObjectId(req.params.id) },
    { requestedBranchId: '' }
  );

  if (!access.ok) {
    const error = new Error(
      access.message || 'No tienes permiso para operar órdenes de esa sede.'
    );
    error.code = access.error || 'ORDER_BRANCH_ACCESS_DENIED';
    error.statusCode = access.status || 403;
    throw error;
  }

  const order = await Order.findOne(access.filter).lean();
  if (!order) {
    const error = new Error('Orden no encontrada.');
    error.code = 'ORDER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
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
    if (!mongoose.Types.ObjectId.isValid(cleanEventId)) {
      const error = new Error('El evento seleccionado no es válido.');
      error.code = 'INVALID_ORDER_EVENT_ID';
      error.statusCode = 400;
      throw error;
    }
    filter._id = new mongoose.Types.ObjectId(cleanEventId);
  }

  return OrderEvent.findOne(filter).sort({ _id: -1 }).lean();
}

async function buildPreview(req) {
  const order = await loadScopedOrder(req);
  const requestedEventId =
    req.query?.eventId || req.body?.sourceEventId || req.body?.eventId || '';
  const [event, settings] = await Promise.all([
    loadSourceEvent(order._id, requestedEventId),
    SiteSettings.findOne().select('store').lean().catch(() => null),
  ]);

  return {
    order,
    preview: buildOrderWhatsAppPreview({
      order,
      event,
      store: settings?.store || {},
    }),
  };
}

router.get(
  '/:id/customer-notifications/whatsapp/preview',
  requireAdmin,
  requirePermission('orders:email'),
  async (req, res) => {
    try {
      const { preview } = await buildPreview(req);
      return res.json({
        ok: true,
        mode: 'assisted',
        deliveryConfirmed: false,
        preview,
      });
    } catch (error) {
      console.error('[orderCustomerNotificationRoutes][preview]', error);
      return respondError(res, error);
    }
  }
);

router.post(
  '/:id/customer-notifications/whatsapp/opened',
  requireAdmin,
  requirePermission('orders:email'),
  async (req, res) => {
    try {
      const { order, preview } = await buildPreview(req);
      const actor = actorFromRequest(req);
      const now = new Date();
      const sourceEventId = preview.sourceEventId
        ? new mongoose.Types.ObjectId(preview.sourceEventId)
        : null;

      const notification = await OrderCustomerNotification.findOneAndUpdate(
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
            lastOpenedAt: now,
            lastOpenedBy: actor,
          },
          $setOnInsert: {
            firstOpenedAt: now,
          },
          $inc: {
            openCount: 1,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      await OrderEvent.create({
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

      return res.json({
        ok: true,
        mode: 'assisted',
        deliveryConfirmed: false,
        notificationId: notification._id,
        openCount: notification.openCount,
        message:
          'WhatsApp abierto con el informe preparado. El administrador debe confirmar el envío dentro de WhatsApp.',
      });
    } catch (error) {
      console.error('[orderCustomerNotificationRoutes][opened]', error);
      return respondError(res, error);
    }
  }
);

module.exports = router;
