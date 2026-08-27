export const STATUS_LABELS = {
  ready_to_pick: 'Lista para preparar',
  picking: 'Reuniendo productos',
  picked: 'Productos reunidos',
  packing: 'Empacando',
  packed: 'Paquete listo',
  dispatched: 'Entregada a la transportadora',
  in_transit: 'En tránsito',
  delivered: 'Entregada',
  exception: 'Con incidencia',
  cancelled: 'Cancelada',
};

export const NEXT_ACTIONS = {
  ready_to_pick: ['start_picking', 'Comenzar a reunir productos'],
  picking: ['complete_picking', 'Confirmar productos reunidos'],
  picked: ['start_packing', 'Comenzar a empacar'],
  packing: ['complete_packing', 'Confirmar paquete cerrado'],
  packed: ['dispatch', 'Confirmar entrega a la transportadora'],
  dispatched: ['mark_in_transit', 'Marcar en tránsito'],
  in_transit: ['deliver', 'Confirmar entrega'],
};

export const STEPS = [
  ['ready_to_pick', 'Preparar'],
  ['picking', 'Reunir productos'],
  ['packing', 'Empacar'],
  ['dispatched', 'Transportadora'],
  ['in_transit', 'En tránsito'],
  ['delivered', 'Entrega'],
];

export const WEBHOOK_TEST_LABELS = {
  'Picked Up': 'el paquete fue recolectado',
  Shipped: 'el paquete está en tránsito',
  Delivered: 'el paquete fue entregado',
  Canceled: 'el envío fue cancelado',
};

export const STATUS_POSITION = {
  ready_to_pick: 0,
  picking: 1,
  picked: 2,
  packing: 3,
  packed: 3,
  dispatched: 4,
  in_transit: 5,
  delivered: 6,
};

export const CUSTOMER_STAGE_LABELS = {
  initialize: 'Preparación logística iniciada',
  start_picking: 'Preparación iniciada',
  complete_picking: 'Productos seleccionados',
  start_packing: 'Empaque iniciado',
  complete_packing: 'Pedido empacado',
  dispatch: 'Pedido despachado',
  mark_in_transit: 'Pedido en tránsito',
  deliver: 'Entrega confirmada',
  report_incident: 'Novedad registrada',
  resolve_incident: 'Novedad solucionada',
};

export function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function localDateAfter(days = 1) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function formatDeadline(value) {
  if (!value) return 'Sin compromiso';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin compromiso';
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoney(value, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function isPublicHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function carrierActions(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((action) => String(action || '').trim().toLowerCase())
    .filter(Boolean))];
}

export function shipmentForm(shipment = {}) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const carrier = shipment.carrier || {};
  const sla = shipment.sla || {};
  return {
    priority: shipment.priority || 'normal',
    carrierCode: carrier.code || '',
    carrierName: carrier.name || '',
    serviceLevel: carrier.serviceLevel || '',
    trackingNumber: carrier.trackingNumber || '',
    trackingUrl: carrier.trackingUrl || '',
    pickingDueAt: toLocalDateTime(sla.pickingDueAt),
    dispatchDueAt: toLocalDateTime(sla.dispatchDueAt),
    deliveryDueAt: toLocalDateTime(sla.deliveryDueAt),
    packageCount: Math.max(1, packages.length || 1),
    weightGrams: Number(packages[0]?.weightGrams || 0),
    lengthCm: Number(packages[0]?.lengthCm || 0),
    widthCm: Number(packages[0]?.widthCm || 0),
    heightCm: Number(packages[0]?.heightCm || 0),
    selectedRate: null,
    rateStrategy: 'balanced',
    pickupDate: shipment.shippingIntegration?.pickup?.requestedDate || localDateAfter(1),
    pickupTimeStart: shipment.shippingIntegration?.pickup?.timeFrom || '09:00',
    pickupTimeEnd: shipment.shippingIntegration?.pickup?.timeTo || '14:00',
    pickupInstructions: shipment.shippingIntegration?.pickup?.instructions || '',
    testStatus: 'Shipped',
    dispatchReference: shipment.dispatchEvidence?.reference || '',
    deliveryReference: shipment.deliveryEvidence?.reference || '',
    recipient: shipment.deliveryEvidence?.recipient || '',
    incidentType: 'delay',
    severity: 'medium',
    incidentDescription: '',
    resolution: '',
    note: '',
  };
}

export function planPayload(shipment, form) {
  const existingPackages = Array.isArray(shipment.packages)
    ? shipment.packages
    : [];
  const packageCount = Math.min(20, Math.max(1, Number(form.packageCount || 1)));
  const packages = Array.from({ length: packageCount }, (_, index) => ({
    ...(existingPackages[index] || {}),
    code:
      existingPackages[index]?.code ||
      `${shipment.code}-P${String(index + 1).padStart(2, '0')}`,
    weightGrams: Number(form.weightGrams || 0),
    lengthCm: Number(form.lengthCm || 0),
    widthCm: Number(form.widthCm || 0),
    heightCm: Number(form.heightCm || 0),
  }));
  return {
    priority: form.priority,
    carrier: {
      code: form.carrierCode,
      name: form.carrierName,
      serviceLevel: form.serviceLevel,
      trackingNumber: form.trackingNumber,
      trackingUrl: form.trackingUrl,
    },
    packages,
    sla: {
      pickingDueAt: form.pickingDueAt || null,
      dispatchDueAt: form.dispatchDueAt || null,
      deliveryDueAt: form.deliveryDueAt || null,
    },
  };
}

export function hasPhysicalFulfillment(order) {
  if ((order?.inventoryAllocations || []).some(
    (item) => Number(item?.soldQuantity || 0) > Number(item?.returnedQuantity || 0)
  )) {
    return true;
  }
  return (order?.items || order?.cart || []).some((item) => {
    const type = String(item?.productType || '').toLowerCase();
    return !['digital', 'service'].includes(type) && item?.requiresShipping !== false;
  });
}

export function shipmentIdempotencyKey(orderId, shipment, action, rate = null) {
  const safe = (value) => String(value || '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 50);
  return [
    action,
    safe(orderId),
    safe(shipment?._id),
    `r${Number(shipment?.revision || 0)}`,
    safe(rate?.carrier),
    safe(rate?.service),
  ].filter(Boolean).join(':');
}
