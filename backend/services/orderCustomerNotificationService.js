const crypto = require('crypto');

const WHATSAPP_TEMPLATE_VERSION = 'orders-whatsapp-assisted-v1';

const CUSTOMER_NOTIFIABLE_EVENT_TYPES = Object.freeze([
  'status_changed',
  'payment_updated',
  'logistics_initialized',
  'logistics_start_picking',
  'logistics_complete_picking',
  'logistics_start_packing',
  'logistics_complete_packing',
  'logistics_dispatch',
  'logistics_mark_in_transit',
  'logistics_deliver',
  'logistics_report_incident',
  'logistics_resolve_incident',
  'electronic_invoice_retry',
]);

const CUSTOMER_NOTIFIABLE_EVENT_SET = new Set(
  CUSTOMER_NOTIFIABLE_EVENT_TYPES
);

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function normalizeStatus(value) {
  return cleanText(value).toLowerCase();
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsappPhone(value) {
  const raw = cleanText(value);
  if (!raw || raw.includes('@')) return '';

  let digits = digitsOnly(raw);
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.length === 10 && digits.startsWith('3')) {
    return `57${digits}`;
  }

  if (
    digits.length === 12 &&
    digits.startsWith('57') &&
    digits[2] === '3'
  ) {
    return digits;
  }

  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }

  return '';
}

function maskPhone(phone) {
  const digits = digitsOnly(phone);
  if (!digits) return '';
  const visible = digits.slice(-4);
  const country = digits.startsWith('57') ? '+57 ' : '+';
  return `${country}${'•'.repeat(Math.max(4, digits.length - (digits.startsWith('57') ? 6 : 4)))}${visible}`;
}

function resolveCustomerWhatsapp(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};
  const candidates = [
    customer.phone,
    billing.phone,
    customer.emailOrPhone,
  ];

  for (const candidate of candidates) {
    const phone = normalizeWhatsappPhone(candidate);
    if (phone) {
      return {
        available: true,
        phone,
        maskedPhone: maskPhone(phone),
      };
    }
  }

  return {
    available: false,
    phone: '',
    maskedPhone: '',
    reason:
      'La orden no tiene un celular válido del cliente. Registra un número antes de preparar el WhatsApp.',
  };
}

function getCustomerName(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};
  return cleanText(
    [customer.name, customer.lastname].filter(Boolean).join(' ') ||
      [billing.firstName || billing.name, billing.lastName || billing.lastname]
        .filter(Boolean)
        .join(' '),
    'cliente'
  );
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'Sin fecha registrada';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusStory(status) {
  const stories = {
    pending: {
      stage: 'Pago pendiente',
      happened: 'Recibimos la orden correctamente.',
      current: 'La orden está esperando la confirmación del pago.',
      next: 'Cuando el pago sea aprobado comenzará la preparación del pedido.',
    },
    processing: {
      stage: 'Preparación iniciada',
      happened: 'La orden ingresó al proceso de preparación.',
      current: 'El equipo está preparando el pedido.',
      next: 'El siguiente paso será completar el empaque y organizar el despacho.',
    },
    paid: {
      stage: 'Pago confirmado',
      happened: 'El pago de la orden fue confirmado.',
      current: 'La orden está habilitada para preparación.',
      next: 'El equipo iniciará la preparación y el alistamiento del pedido.',
    },
    shipped: {
      stage: 'Pedido enviado',
      happened: 'La orden fue entregada a la operación de transporte.',
      current: 'El pedido se encuentra camino a su destino.',
      next: 'La transportadora continuará el recorrido hasta realizar la entrega.',
    },
    delivered: {
      stage: 'Entrega confirmada',
      happened: 'La entrega de la orden fue confirmada.',
      current: 'El recorrido operativo del pedido está completado.',
      next: 'Conserva esta información como soporte del estado de tu compra.',
    },
    failed: {
      stage: 'Pago no aprobado',
      happened: 'La transacción de pago no fue aprobada.',
      current: 'La preparación de la orden permanece detenida.',
      next: 'Revisa el medio de pago o comunícate con la tienda para recibir ayuda.',
    },
    cancelled: {
      stage: 'Orden cancelada',
      happened: 'La orden fue cancelada.',
      current: 'El proceso de preparación y entrega está detenido.',
      next: 'Si necesitas más información, comunícate con la tienda.',
    },
    canceled: {
      stage: 'Orden cancelada',
      happened: 'La orden fue cancelada.',
      current: 'El proceso de preparación y entrega está detenido.',
      next: 'Si necesitas más información, comunícate con la tienda.',
    },
    refunded: {
      stage: 'Reembolso registrado',
      happened: 'La orden registra un proceso de reembolso.',
      current: 'El ciclo comercial de la orden fue cerrado con devolución.',
      next: 'Conserva el soporte y verifica el movimiento con tu entidad financiera.',
    },
  };

  return stories[normalizeStatus(status)] || stories.pending;
}

function eventStory(event = {}, order = {}) {
  const type = normalizeStatus(event.type);
  const meta = event.meta || {};

  if (type === 'status_changed') {
    return statusStory(meta.to || meta.toOrderStatus || order.status);
  }

  if (type === 'payment_updated') {
    return statusStory(meta.toOrderStatus || order.status);
  }

  const logisticsStories = {
    logistics_initialized: {
      stage: 'Preparación habilitada',
      happened: 'La preparación logística del pedido fue iniciada.',
      current: 'La orden ya tiene un envío asignado para su alistamiento.',
      next: 'El equipo realizará la selección y preparación de los productos.',
    },
    logistics_start_picking: {
      stage: 'Preparación iniciada',
      happened: 'Comenzó la selección de los productos de la orden.',
      current: 'El pedido está siendo preparado en la sede asignada.',
      next: 'Al completar la selección, los productos pasarán a empaque.',
    },
    logistics_complete_picking: {
      stage: 'Productos seleccionados',
      happened: 'La selección de los productos fue completada.',
      current: 'El pedido está listo para iniciar el empaque.',
      next: 'El equipo protegerá y sellará los productos para su despacho.',
    },
    logistics_start_packing: {
      stage: 'Empaque iniciado',
      happened: 'El pedido ingresó a la etapa de empaque.',
      current: 'Los productos están siendo organizados y protegidos.',
      next: 'Cuando termine el empaque, el pedido quedará listo para despacho.',
    },
    logistics_complete_packing: {
      stage: 'Pedido empacado',
      happened: 'El empaque del pedido fue completado.',
      current: 'La orden está lista para ser entregada a la transportadora.',
      next: 'El siguiente paso será confirmar el despacho y la guía de transporte.',
    },
    logistics_dispatch: {
      stage: 'Pedido despachado',
      happened: 'El pedido fue entregado a la operación de transporte.',
      current: 'La orden salió de la sede y comenzó su recorrido de entrega.',
      next: 'La transportadora actualizará el recorrido hasta llegar al destino.',
    },
    logistics_mark_in_transit: {
      stage: 'Pedido en tránsito',
      happened: 'La transportadora confirmó que el pedido está en tránsito.',
      current: 'La orden se encuentra camino a la dirección registrada.',
      next: 'La transportadora realizará el intento de entrega.',
    },
    logistics_deliver: {
      stage: 'Entrega confirmada',
      happened: 'La entrega del pedido fue confirmada.',
      current: 'El recorrido logístico de la orden está completado.',
      next: 'Conserva este mensaje como constancia de la actualización.',
    },
    logistics_report_incident: {
      stage: 'Novedad en la entrega',
      happened: 'Se presentó una novedad durante la operación del pedido.',
      current: 'El equipo está revisando la situación para continuar el proceso.',
      next: 'La tienda informará cuando la novedad sea resuelta.',
    },
    logistics_resolve_incident: {
      stage: 'Novedad solucionada',
      happened: 'La novedad registrada en el envío fue solucionada.',
      current: 'La operación del pedido puede continuar.',
      next: 'El equipo retomará la siguiente etapa de preparación o entrega.',
    },
    electronic_invoice_retry: {
      stage: 'Factura procesada',
      happened: 'La factura electrónica de la orden fue procesada nuevamente.',
      current: 'El documento fiscal se encuentra en proceso de validación o disponible.',
      next: 'La tienda confirmará la disponibilidad del documento definitivo.',
    },
  };

  return logisticsStories[type] || statusStory(order.status);
}

function idValue(value) {
  if (!value) return '';
  return cleanText(value._id || value.id || value);
}

function findEventShipment(order = {}, event = {}) {
  const shipments = Array.isArray(order.fulfillment?.shipments)
    ? order.fulfillment.shipments
    : [];
  const shipmentId = idValue(event.meta?.shipmentId);
  const shipmentCode = cleanText(event.meta?.shipmentCode);

  const matched = shipments.find(
    (shipment) =>
      (shipmentId && idValue(shipment?._id) === shipmentId) ||
      (shipmentCode && cleanText(shipment?.code) === shipmentCode)
  );

  if (matched) return matched;

  return shipments
    .slice()
    .sort((left, right) => {
      const leftDate = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
      const rightDate = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
      return rightDate - leftDate;
    })[0] || null;
}

function safeTrackingUrl(value) {
  const text = cleanText(value);
  if (!text) return '';
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function shipmentDetails(order, event) {
  const type = normalizeStatus(event?.type);
  if (!type.startsWith('logistics_')) return [];

  const shipment = findEventShipment(order, event);
  if (!shipment) return [];

  const details = [];
  const branchName = cleanText(
    shipment.branchSnapshot?.name || shipment.branchSnapshot?.code
  );
  const carrierName = cleanText(shipment.carrier?.name);
  const trackingNumber = cleanText(shipment.carrier?.trackingNumber);
  const trackingUrl = safeTrackingUrl(shipment.carrier?.trackingUrl);
  const deliveryDueAt = shipment.sla?.deliveryDueAt;

  if (branchName) details.push({ label: 'Sede', value: branchName });
  if (carrierName) details.push({ label: 'Transportadora', value: carrierName });
  if (trackingNumber) details.push({ label: 'Guía', value: trackingNumber });
  if (trackingUrl) details.push({ label: 'Seguimiento', value: trackingUrl });
  if (deliveryDueAt) {
    details.push({
      label: 'Entrega estimada',
      value: formatDate(deliveryDueAt),
    });
  }

  return details;
}

function buildMessage({ customerName, orderNumber, story, details, updatedAt, storeName }) {
  const detailLines = details.map(
    (detail) => `*${detail.label}:* ${detail.value}`
  );

  return [
    `Hola, ${customerName}.`,
    '',
    `Te compartimos una actualización de tu orden #${orderNumber}.`,
    '',
    `*Qué pasó:* ${story.happened}`,
    `*Estado actual:* ${story.current}`,
    `*Qué sigue:* ${story.next}`,
    ...(detailLines.length ? ['', ...detailLines] : []),
    '',
    `*Fecha de actualización:* ${formatDate(updatedAt)}`,
    '',
    storeName,
  ].join('\n');
}

function buildOrderWhatsAppPreview({ order = {}, event = null, store = {} }) {
  const recipient = resolveCustomerWhatsapp(order);
  if (!recipient.available) {
    const error = new Error(recipient.reason);
    error.code = 'ORDER_WHATSAPP_PHONE_REQUIRED';
    error.statusCode = 422;
    throw error;
  }

  const customerName = getCustomerName(order);
  const orderNumber = cleanText(order.orderNumber, idValue(order._id) || '—');
  const storeName = cleanText(store.name || store.businessName, 'Rosa Boutique');
  const story = eventStory(event || {}, order);
  const details = shipmentDetails(order, event || {});
  const updatedAt = event?.createdAt || order.updatedAt || order.createdAt || new Date();
  const message = buildMessage({
    customerName,
    orderNumber,
    story,
    details,
    updatedAt,
    storeName,
  });
  const sourceEventId = idValue(event?._id);
  const fingerprint = crypto
    .createHash('sha256')
    .update(
      [
        WHATSAPP_TEMPLATE_VERSION,
        idValue(order._id),
        sourceEventId,
        recipient.phone,
        message,
      ].join('|')
    )
    .digest('hex');

  return {
    channel: 'whatsapp',
    templateVersion: WHATSAPP_TEMPLATE_VERSION,
    recipient: {
      name: customerName,
      maskedPhone: recipient.maskedPhone,
    },
    report: {
      orderNumber,
      stage: story.stage,
      happened: story.happened,
      current: story.current,
      next: story.next,
      details,
      updatedAt,
    },
    sourceEventId,
    sourceEventType: cleanText(event?.type, 'order_snapshot'),
    fingerprint,
    message,
    whatsappUrl: `https://wa.me/${recipient.phone}?text=${encodeURIComponent(message)}`,
  };
}

function isCustomerNotifiableEventType(type) {
  return CUSTOMER_NOTIFIABLE_EVENT_SET.has(normalizeStatus(type));
}

module.exports = {
  WHATSAPP_TEMPLATE_VERSION,
  CUSTOMER_NOTIFIABLE_EVENT_TYPES,
  buildOrderWhatsAppPreview,
  isCustomerNotifiableEventType,
  normalizeWhatsappPhone,
  resolveCustomerWhatsapp,
  maskPhone,
};
