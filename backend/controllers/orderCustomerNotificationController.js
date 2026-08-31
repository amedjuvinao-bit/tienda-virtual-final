'use strict';

const {
  buildPreview,
  recordWhatsAppOpened,
} = require('../services/orderCustomerNotificationOrchestrator');

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

function createOrderCustomerNotificationController({
  buildPreviewImpl = buildPreview,
  recordWhatsAppOpenedImpl = recordWhatsAppOpened,
} = {}) {
  async function previewOrderWhatsApp(req, res) {
    try {
      const { preview } = await buildPreviewImpl(req);
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

  async function recordOrderWhatsAppOpened(req, res) {
    try {
      const { notification } = await recordWhatsAppOpenedImpl(req);
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

  return {
    previewOrderWhatsApp,
    recordOrderWhatsAppOpened,
  };
}

const defaultController = createOrderCustomerNotificationController();

module.exports = {
  createOrderCustomerNotificationController,
  respondError,
  ...defaultController,
};
