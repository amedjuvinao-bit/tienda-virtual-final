// backend/routes/orderEmailRoutes.js
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const requireAdmin = require('../middleware/requireAdmin');
const Order = require('../models/Order');
const { sendMail } = require('../lib/mail/mailer');

const OrderEvent =
  mongoose.models.OrderEvent ||
  mongoose.model(
    'OrderEvent',
    new mongoose.Schema(
      {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true, required: true },
        type: { type: String, required: true },
        message: { type: String },
        meta: { type: Object },
      },
      { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
    ),
    'order_events'
  );

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function moneyCOP(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function statusLabel(status) {
  const normalized = String(status || '').toLowerCase();

  const labels = {
    pending: 'Pendiente',
    processing: 'Procesando',
    paid: 'Pagada',
    shipped: 'Enviada',
    delivered: 'Entregada',
    cancelled: 'Cancelada',
    canceled: 'Cancelada',
    refunded: 'Reembolsada',
    failed: 'Fallida',
  };

  return labels[normalized] || cleanText(status, 'Pendiente');
}

function normalizeEmailAction(value) {
  const raw = String(value || 'confirmation').toLowerCase().trim();

  const aliases = {
    confirmation: 'confirmation',
    confirmacion: 'confirmation',
    confirmación: 'confirmation',
    invoice: 'invoice',
    factura: 'invoice',
    status: 'status',
    status_update: 'status',
    update: 'status',
    estado: 'status',
    payment: 'payment',
    payment_info: 'payment',
    pago: 'payment',
  };

  return aliases[raw] || '';
}

function getCustomerEmail(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};

  return cleanText(
    customer.email || customer.emailOrPhone || billing.email || '',
    ''
  ).toLowerCase();
}

function getCustomerName(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};

  return (
    [customer.name, customer.lastname].filter(Boolean).join(' ').trim() ||
    [billing.name, billing.lastname].filter(Boolean).join(' ').trim() ||
    'Cliente'
  );
}

function getOrderItems(order = {}) {
  if (Array.isArray(order.items) && order.items.length) return order.items;
  if (Array.isArray(order.cart) && order.cart.length) return order.cart;
  return [];
}

function getQty(item = {}) {
  return Number(item.quantity ?? item.qty ?? 1) || 1;
}

function getUnitPrice(item = {}) {
  return Number(item.price ?? item.unitPrice ?? item.priceNumber ?? 0) || 0;
}

function getVariantLabel(item = {}) {
  const explicit = cleanText(item.variantLabel, '');
  if (explicit) return explicit;

  const attributes = Array.isArray(item.variantAttributes)
    ? item.variantAttributes
        .map((attribute) => cleanText(attribute?.value, ''))
        .filter(Boolean)
    : [];

  return (
    attributes.join(' / ') ||
    [item.size, item.color].filter(Boolean).join(' / ')
  );
}

function itemsHtml(order = {}) {
  const items = getOrderItems(order);

  if (!items.length) {
    return '<p style="margin:0;color:#64748b;">Sin productos registrados.</p>';
  }

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:8px;">Producto</th>
          <th style="text-align:center;border-bottom:1px solid #e5e7eb;padding:8px;">Cant.</th>
          <th style="text-align:right;border-bottom:1px solid #e5e7eb;padding:8px;">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map((item) => {
            const qty = getQty(item);
            const unit = getUnitPrice(item);
            const variant = getVariantLabel(item);

            return `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;">
                  <strong>${cleanText(item.title || item.name, 'Producto')}</strong>
                  ${variant ? `<div style="font-size:12px;color:#64748b;">${variant}</div>` : ''}
                </td>
                <td style="padding:8px;text-align:center;border-bottom:1px solid #f1f5f9;">${qty}</td>
                <td style="padding:8px;text-align:right;border-bottom:1px solid #f1f5f9;">${moneyCOP(unit * qty)}</td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function itemsText(order = {}) {
  const items = getOrderItems(order);

  if (!items.length) return 'Sin productos registrados.';

  return items
    .map((item) => {
      const qty = getQty(item);
      const unit = getUnitPrice(item);
      const variant = getVariantLabel(item);
      return `- ${cleanText(item.title || item.name, 'Producto')} x ${qty}${variant ? ` (${variant})` : ''}: ${moneyCOP(unit * qty)}`;
    })
    .join('\n');
}

function buildEmailContent(order = {}, type = 'confirmation') {
  const customerName = getCustomerName(order);
  const orderNumber = cleanText(order.orderNumber, '—');
  const status = statusLabel(order.status);
  const payment = order.payment || {};
  const paymentLabel = cleanText(payment.methodLabel || payment.providerLabel || payment.method || payment.provider, 'Pago no especificado');
  const paymentStatus = statusLabel(payment.status || order.status);
  const total = moneyCOP(order.total || order.summary?.subtotal || 0);
  const sourceLabel = String(order.source || '').toLowerCase() === 'pos' ? 'Punto de venta / venta física' : 'Tienda virtual';

  const config = {
    confirmation: {
      title: `Confirmación de compra #${orderNumber}`,
      subject: `Confirmación de tu compra #${orderNumber}`,
      intro: `Hola ${customerName}, recibimos tu compra correctamente.`,
      eventMessage: `Email confirmation enviado a ${getCustomerEmail(order)}`,
    },
    invoice: {
      title: `Factura / soporte de compra #${orderNumber}`,
      subject: `Factura de tu compra #${orderNumber}`,
      intro: `Hola ${customerName}, te compartimos la información de facturación de tu compra.`,
      eventMessage: `Email invoice enviado a ${getCustomerEmail(order)}`,
    },
    status: {
      title: `Actualización de estado #${orderNumber}`,
      subject: `Actualización de tu pedido #${orderNumber}`,
      intro: `Hola ${customerName}, tu orden fue actualizada. Estado actual: ${status}.`,
      eventMessage: `Email status enviado a ${getCustomerEmail(order)}`,
    },
    payment: {
      title: `Información de pago #${orderNumber}`,
      subject: `Información de pago de tu compra #${orderNumber}`,
      intro: `Hola ${customerName}, te compartimos el resumen del pago de tu compra.`,
      eventMessage: `Email payment enviado a ${getCustomerEmail(order)}`,
    },
  }[type];

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:680px;margin:0 auto;">
      <h2 style="margin:0 0 12px;color:#111827;">${config.title}</h2>
      <p style="margin:0 0 16px;">${config.intro}</p>
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f8fafc;margin-bottom:16px;">
        <div><strong>Orden:</strong> #${orderNumber}</div>
        <div><strong>Estado:</strong> ${status}</div>
        <div><strong>Origen:</strong> ${sourceLabel}</div>
        <div><strong>Pago:</strong> ${paymentLabel}</div>
        <div><strong>Estado del pago:</strong> ${paymentStatus}</div>
        <div><strong>Total:</strong> ${total}</div>
      </div>
      ${itemsHtml(order)}
      <p style="margin-top:18px;color:#64748b;font-size:13px;">Gracias por tu compra.</p>
    </div>
  `;

  const text = [
    config.title,
    '',
    config.intro,
    '',
    `Orden: #${orderNumber}`,
    `Estado: ${status}`,
    `Origen: ${sourceLabel}`,
    `Pago: ${paymentLabel}`,
    `Estado del pago: ${paymentStatus}`,
    `Total: ${total}`,
    '',
    itemsText(order),
    '',
    'Gracias por tu compra.',
  ].join('\n');

  return {
    subject: config.subject,
    html,
    text,
    eventMessage: config.eventMessage,
  };
}

router.post('/:id/email', requireAdmin, async (req, res) => {
  const orderId = req.params.id;
  const type = normalizeEmailAction(req.body?.action || req.body?.type || 'confirmation');

  if (!type) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_EMAIL_TYPE',
      message: 'Tipo de correo inválido. Usa confirmación, factura, actualización de estado o información de pago.',
      allowed: ['confirmation', 'invoice', 'status', 'payment'],
    });
  }

  try {
    const order = await Order.findById(orderId).lean();

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

    const content = buildEmailContent(order, type);
    const sent = await sendMail({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    await OrderEvent.create({
      orderId: order._id,
      type: 'email_sent',
      message: content.eventMessage,
      meta: {
        to,
        type,
        messageId: sent?.messageId || '',
        response: sent?.response || '',
        by: req.headers['x-admin-user'] || req.adminUsername || 'admin',
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
});

module.exports = router;
