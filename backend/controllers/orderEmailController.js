'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const { sendMail } = require('../lib/mail/mailer');
const {
  buildScopedOrderFilter,
} = require('../services/orderAdminScopeService');
const {
  buildEmailContent,
  getCustomerEmail,
  normalizeEmailAction,
} = require('../services/orderEmailContentService');

function createOrderEmailController({
  mongooseImpl = mongoose,
  OrderModel = Order,
  OrderEventModel = OrderEvent,
  sendMailImpl = sendMail,
  buildScopedOrderFilterImpl = buildScopedOrderFilter,
  buildEmailContentImpl = buildEmailContent,
} = {}) {
  return async function sendOrderEmail(req, res) {
    const orderId = req.params.id;
    const type = normalizeEmailAction(
      req.body?.action || req.body?.type || 'confirmation'
    );

    if (!type) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_EMAIL_TYPE',
        message:
          'Tipo de correo inválido. Usa confirmación, factura, actualización de estado o información de pago.',
        allowed: ['confirmation', 'invoice', 'status', 'payment'],
      });
    }

    try {
      if (!mongooseImpl.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
          ok: false,
          error: 'INVALID_ORDER_ID',
          message: 'El identificador de la orden no es válido.',
        });
      }

      const access = buildScopedOrderFilterImpl(
        req,
        { _id: new mongooseImpl.Types.ObjectId(orderId) },
        { requestedBranchId: '', requireWholeOrder: true }
      );
      if (!access.ok) {
        return res.status(access.status || 403).json({
          ok: false,
          error: access.error || 'ORDER_BRANCH_ACCESS_DENIED',
          message:
            access.message ||
            'No tienes permiso para operar órdenes de esta sede.',
        });
      }

      const order = await OrderModel.findOne(access.filter).lean();
      if (!order) {
        return res.status(404).json({
          ok: false,
          error: 'ORDER_NOT_FOUND',
          message: 'Orden no encontrada.',
        });
      }

      const to = getCustomerEmail(order);
      if (!to || !to.includes('@')) {
        return res.status(422).json({
          ok: false,
          error: 'ORDER_EMAIL_REQUIRED',
          message: 'La orden no tiene un correo válido del cliente.',
        });
      }

      const content = buildEmailContentImpl(order, type);
      const sent = await sendMailImpl({
        to,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });

      await OrderEventModel.create({
        orderId: order._id,
        type: 'email_sent',
        message: content.eventMessage,
        meta: {
          to,
          type,
          messageId: sent?.messageId || '',
          response: sent?.response || '',
          by: req.adminUsername || req.adminUserId || 'admin',
        },
      });

      return res.json({
        ok: true,
        type,
        to,
        message: `Correo enviado correctamente a ${to}.`,
        messageId: sent?.messageId || '',
      });
    } catch (error) {
      console.error('[orderEmailRoutes][POST /:id/email]', error);
      return res.status(400).json({
        ok: false,
        error: 'ORDER_EMAIL_SEND_ERROR',
        message: error.message || 'No se pudo enviar el correo.',
      });
    }
  };
}

const sendOrderEmail = createOrderEmailController();

module.exports = {
  createOrderEmailController,
  sendOrderEmail,
};
