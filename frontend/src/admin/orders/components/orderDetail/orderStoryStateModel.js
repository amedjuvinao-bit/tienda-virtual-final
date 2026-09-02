import {
  fmtDate,
  getInvoiceInfo,
  normalizeText,
} from './orderDetailUtils';

const PAID_ORDER_STATUSES = new Set([
  'paid',
  'processing',
  'shipped',
  'delivered',
  'refunded',
]);

const COMPLETE_PAYMENT_WORDS = ['paid', 'approved', 'aprob', 'pagado', 'complete'];
const FAILED_WORDS = ['failed', 'rechaz', 'cancel', 'error', 'declin'];
const COMPLETE_INVOICE_WORDS = [
  'accepted',
  'acept',
  'validated',
  'valid',
  'issued',
  'emit',
  'success',
  'complet',
];

const SHIPMENT_LABELS = {
  ready_to_pick: 'Lista para iniciar picking',
  picking: 'Picking en proceso',
  picked: 'Picking completado',
  packing: 'Empaque en proceso',
  packed: 'Empaque completado',
  dispatched: 'Despachada a transportadora',
  in_transit: 'En tránsito',
  delivered: 'Entrega confirmada',
  exception: 'Incidencia logística activa',
  cancelled: 'Envío cancelado',
};

function containsAny(value, fragments) {
  const normalized = normalizeText(value);
  return fragments.some((fragment) => normalized.includes(fragment));
}

export function dateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function latestDate(...values) {
  return values
    .flat(Infinity)
    .map(dateValue)
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime())[0] || null;
}

export function phaseDate(value) {
  return value ? fmtDate(value) : 'Sin registro horario';
}

function getInvoiceRecord(order) {
  return order?.electronicInvoice || order?.invoice || order?.factusInvoice || {};
}

export function getPaymentState(order) {
  const orderStatus = normalizeText(order?.status);
  const payment = order?.payment || {};
  const paymentStatus = normalizeText(payment.status);
  const failed = containsAny(paymentStatus, FAILED_WORDS) || orderStatus === 'failed';
  const complete =
    !failed &&
    (containsAny(paymentStatus, COMPLETE_PAYMENT_WORDS) ||
      PAID_ORDER_STATUSES.has(orderStatus));

  return {
    complete,
    failed,
    date: latestDate(
      payment.paidAt,
      payment.paymentDate,
      order?.paymentDetails?.paidAt,
      order?.paymentDetails?.paymentDate,
      order?.transaction?.finalized_at,
      order?.pos?.confirmedAt,
      order?.paidAt
    ),
  };
}

export function getInvoiceState(order, paymentComplete) {
  const invoice = getInvoiceRecord(order);
  const info = getInvoiceInfo(order);
  const status = normalizeText(info.status);
  const failed = containsAny(status, FAILED_WORDS) || status.includes('reject');
  const hasDocument = info.number !== 'Sin número' || info.cufe !== '—';
  const complete =
    hasDocument &&
    !failed &&
    (!status || containsAny(status, COMPLETE_INVOICE_WORDS) || !status.includes('pend'));

  return {
    complete,
    failed,
    hasDocument,
    status: info.status,
    number: info.number,
    date: latestDate(
      invoice.validatedAt,
      invoice.acceptedAt,
      invoice.issuedAt,
      invoice.generatedAt,
      invoice.createdAt,
      invoice?.provider?.raw?.validated_at,
      invoice?.provider?.raw?.created_at
    ),
    pendingAfterPayment: paymentComplete && !complete,
  };
}

export function getFulfillmentState(order, paymentComplete) {
  const fulfillment = order?.fulfillment || {};
  const shipments = Array.isArray(fulfillment.shipments) ? fulfillment.shipments : [];
  const digital = Array.isArray(fulfillment.digitalDeliveries)
    ? fulfillment.digitalDeliveries
    : [];
  const services = Array.isArray(fulfillment.services) ? fulfillment.services : [];
  const allocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const orderStatus = normalizeText(order?.status);
  const source = normalizeText(order?.source);
  const logisticsStatus = normalizeText(fulfillment?.logisticsSummary?.status);
  const fulfillmentStatus = normalizeText(fulfillment.status);
  const orderFulfillmentStatus = normalizeText(order?.fulfillmentStatus);
  const shipmentStatuses = shipments.map((shipment) => normalizeText(shipment?.status));
  const hasIncident =
    logisticsStatus === 'exception' ||
    Number(fulfillment?.logisticsSummary?.exceptionCount || 0) > 0 ||
    shipmentStatuses.includes('exception') ||
    shipments.some((shipment) =>
      (shipment?.incidents || []).some((incident) => !incident?.resolvedAt)
    );
  const allShipmentsDelivered =
    shipments.length > 0 && shipmentStatuses.every((status) => status === 'delivered');
  const dispatched = shipmentStatuses.some((status) =>
    ['dispatched', 'in_transit', 'delivered'].includes(status)
  );
  const activeShipment = shipments
    .slice()
    .reverse()
    .find((shipment) => shipment?.status && shipment.status !== 'delivered');
  const soldQuantity = allocations.reduce(
    (total, allocation) => total + Number(allocation?.soldQuantity || 0),
    0
  );
  const deliveredQuantity = allocations.reduce(
    (total, allocation) => total + Number(allocation?.deliveredQuantity || 0),
    0
  );
  const digitalComplete =
    digital.length > 0 &&
    digital.every((delivery) =>
      ['ready', 'delivered', 'completed', 'manual'].includes(normalizeText(delivery?.status))
    );
  const servicesComplete =
    services.length > 0 &&
    services.every((service) => normalizeText(service?.status) === 'completed');
  const isPos = source === 'pos' || normalizeText(order?.saleType).includes('pos');
  const finalDelivered =
    orderStatus === 'delivered' ||
    fulfillmentStatus === 'delivered' ||
    orderFulfillmentStatus === 'delivered' ||
    logisticsStatus === 'delivered';
  const delivered =
    finalDelivered ||
    allShipmentsDelivered ||
    (soldQuantity > 0 && deliveredQuantity >= soldQuantity) ||
    ((digital.length > 0 || services.length > 0) &&
      (!digital.length || digitalComplete) &&
      (!services.length || servicesComplete));
  const hasPhysicalOperation = shipments.length > 0 || allocations.length > 0;
  const hasDigitalOrService = digital.length > 0 || services.length > 0;
  const operationComplete =
    delivered ||
    dispatched ||
    (isPos && finalDelivered) ||
    (hasDigitalOrService && digitalComplete && (!services.length || servicesComplete));
  const operationStarted =
    operationComplete ||
    hasIncident ||
    shipments.length > 0 ||
    logisticsStatus === 'ready' ||
    logisticsStatus === 'in_progress' ||
    soldQuantity > 0 ||
    ['processing', 'shipped'].includes(orderStatus);

  const operationDate = latestDate(
    shipments.map((shipment) => [
      shipment?.inTransitAt,
      shipment?.dispatchedAt,
      shipment?.packedAt,
      shipment?.pickedAt,
      shipment?.startedAt,
    ]),
    allocations.map((allocation) => [allocation?.shippedAt, allocation?.soldAt]),
    fulfillment.processedAt,
    isPos ? order?.pos?.confirmedAt : null
  );
  const deliveredAt = latestDate(
    shipments.map((shipment) => [
      shipment?.deliveredAt,
      shipment?.deliveryEvidence?.recordedAt,
    ]),
    allocations.map((allocation) => allocation?.deliveredAt),
    digital.map((delivery) => delivery?.deliveredAt),
    services.map((service) => service?.completedAt),
    order?.deliveredAt
  );

  let operationTitle = 'Preparación pendiente';
  let operationDescription = paymentComplete
    ? 'El pago permite iniciar la preparación de la orden.'
    : 'La operación comenzará cuando el pago quede confirmado.';

  if (isPos && finalDelivered) {
    operationTitle = 'Venta física completada en sede';
    operationDescription = 'La preparación y entrega se resolvieron en el punto de venta.';
  } else if (hasIncident) {
    operationTitle = 'Incidencia logística activa';
    operationDescription = 'La operación requiere revisión antes de continuar el recorrido.';
  } else if (activeShipment) {
    operationTitle = SHIPMENT_LABELS[normalizeText(activeShipment.status)] || 'Operación en curso';
    operationDescription = `El envío ${activeShipment.code || 'activo'} registra el avance más reciente.`;
  } else if (dispatched) {
    operationTitle = 'Despacho completado';
    operationDescription = 'La orden salió de la sede y continúa hacia su entrega.';
  } else if (hasDigitalOrService && operationComplete) {
    operationTitle = 'Cumplimiento completado';
    operationDescription = 'Las entregas digitales o prestaciones quedaron atendidas.';
  } else if (operationStarted) {
    operationTitle = 'Preparación habilitada';
    operationDescription = hasPhysicalOperation
      ? 'Existe inventario vendido o una operación logística en curso.'
      : 'La orden ya entró en su proceso de cumplimiento.';
  }

  return {
    delivered,
    deliveredAt,
    dispatched,
    hasIncident,
    operationComplete,
    operationStarted,
    operationDate,
    operationTitle,
    operationDescription,
    isPos,
    hasDigitalOrService,
    needsLogisticsInitialization:
      paymentComplete &&
      !isPos &&
      shipments.length === 0 &&
      soldQuantity > 0 &&
      !hasDigitalOrService,
  };
}

export function isRefundReconciliationComplete(refunds) {
  const normalizedRefunds = Array.isArray(refunds) ? refunds.filter(Boolean) : [];

  return normalizedRefunds.length > 0 && normalizedRefunds.every((refund) => {
    const reconciliation = refund?.reconciliation || {};
    const terminalStageStates = new Set(['completed', 'not_required']);
    const stages = ['inventory', 'payment', 'cash', 'billing'];

    return normalizeText(reconciliation.state) === 'completed' && stages.every((stage) =>
      terminalStageStates.has(normalizeText(reconciliation?.[stage]?.state))
    );
  });
}
