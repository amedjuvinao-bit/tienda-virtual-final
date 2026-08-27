'use strict';

const { clean } = require('./support');

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

module.exports = {
  buildFulfillmentEmail,
  escapeHtml,
  getCustomerEmail,
};
