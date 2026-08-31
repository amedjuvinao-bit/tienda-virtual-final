'use strict';

const {
  PREPARATION_SHIPMENT_STATUSES,
  TRANSIT_SHIPMENT_STATUSES,
} = require('./constants');

function shipmentDueAt(shipment) {
  const status = String(shipment?.status || '').trim().toLowerCase();
  if (['ready_to_pick', 'picking'].includes(status)) {
    return shipment?.sla?.pickingDueAt || null;
  }
  if (['picked', 'packing', 'packed'].includes(status)) {
    return shipment?.sla?.dispatchDueAt || null;
  }
  if (TRANSIT_SHIPMENT_STATUSES.includes(status)) {
    return shipment?.sla?.deliveryDueAt || null;
  }
  return null;
}

function deriveOrderOperationalView(order, now = new Date()) {
  const status = String(order?.status || '').trim().toLowerCase();
  const paymentStatus = String(order?.payment?.status || '').trim().toLowerCase();
  const paymentConfirmed =
    paymentStatus === 'paid' ||
    ['paid', 'shipped', 'delivered', 'refunded'].includes(status);
  const shipments = Array.isArray(order?.fulfillment?.shipments)
    ? order.fulfillment.shipments.filter(
        (shipment) => String(shipment?.status || '').toLowerCase() !== 'cancelled'
      )
    : [];
  const statuses = shipments.map((shipment) =>
    String(shipment?.status || '').trim().toLowerCase()
  );
  const hasPhysicalAllocation = (Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : []
  ).some(
    (allocation) =>
      Number(allocation?.soldQuantity || 0) -
        Number(allocation?.returnedQuantity || 0) >
      0
  );
  const openIncidentCount = shipments.reduce(
    (total, shipment) =>
      total +
      (Array.isArray(shipment?.incidents)
        ? shipment.incidents.filter((incident) => incident?.status === 'open').length
        : 0),
    0
  );
  const dueDates = shipments
    .map((shipment) => ({
      shipment,
      dueAt: shipmentDueAt(shipment),
    }))
    .filter((entry) => entry.dueAt)
    .map((entry) => ({ ...entry, dueDate: new Date(entry.dueAt) }))
    .filter((entry) => !Number.isNaN(entry.dueDate.getTime()))
    .sort((left, right) => left.dueDate - right.dueDate);
  const nextDue = dueDates[0] || null;
  const hasRecordedBreach = shipments.some((shipment) => shipment?.sla?.breachedAt);
  const dueDelta = nextDue ? nextDue.dueDate.getTime() - now.getTime() : null;
  const slaState = hasRecordedBreach || (dueDelta !== null && dueDelta < 0)
    ? 'breached'
    : dueDelta !== null && dueDelta <= 24 * 60 * 60 * 1000
      ? 'risk'
      : nextDue
        ? 'on_track'
        : 'none';
  const progressMap = {
    ready_to_pick: 8,
    picking: 20,
    picked: 35,
    packing: 48,
    packed: 60,
    dispatched: 72,
    in_transit: 86,
    delivered: 100,
    exception: 0,
  };
  const progress = shipments.length
    ? Math.round(
        statuses.reduce(
          (total, shipmentStatus) => total + (progressMap[shipmentStatus] || 0),
          0
        ) / shipments.length
      )
    : status === 'delivered'
      ? 100
      : 0;

  let queue = 'monitor';
  let urgency = 'normal';
  let nextAction = 'Revisar orden';

  if (status === 'failed') {
    queue = 'attention';
    urgency = 'critical';
    nextAction = 'Revisar pago fallido';
  } else if (openIncidentCount > 0 || statuses.includes('exception')) {
    queue = 'incidents';
    urgency = 'critical';
    nextAction = 'Resolver incidencia';
  } else if (slaState === 'breached') {
    queue = 'sla_risk';
    urgency = 'critical';
    nextAction = 'Atender SLA vencido';
  } else if (slaState === 'risk') {
    queue = 'sla_risk';
    urgency = 'high';
    nextAction = 'Priorizar cumplimiento';
  } else if (
    ['pending', 'processing'].includes(status) &&
    !paymentConfirmed &&
    shipments.length === 0
  ) {
    queue = 'awaiting_payment';
    urgency = 'normal';
    nextAction = 'Esperar confirmación de pago';
  } else if (
    paymentConfirmed &&
    !['delivered', 'refunded'].includes(status) &&
    shipments.length === 0 &&
    hasPhysicalAllocation
  ) {
    queue = 'prepare';
    urgency = 'high';
    nextAction = status === 'shipped'
      ? 'Reconstruir trazabilidad logística'
      : 'Preparar logística';
  } else if (statuses.includes('packed')) {
    queue = 'dispatch';
    urgency = 'high';
    nextAction = 'Registrar despacho';
  } else if (statuses.some((value) => TRANSIT_SHIPMENT_STATUSES.includes(value))) {
    queue = 'transit';
    urgency = 'normal';
    nextAction = statuses.includes('dispatched')
      ? 'Confirmar salida a tránsito'
      : 'Confirmar entrega';
  } else if (statuses.some((value) => PREPARATION_SHIPMENT_STATUSES.includes(value))) {
    queue = 'prepare';
    urgency = 'normal';
    nextAction = statuses.includes('packing') || statuses.includes('picked')
      ? 'Completar empaque'
      : statuses.includes('picking')
        ? 'Completar picking'
        : 'Iniciar picking';
  } else if (
    status === 'delivered' ||
    (shipments.length && statuses.every((value) => value === 'delivered'))
  ) {
    queue = 'completed';
    urgency = 'low';
    nextAction = 'Entrega completada';
  }

  return {
    queue,
    urgency,
    nextAction,
    shipmentCount: shipments.length,
    openIncidentCount,
    progress,
    sla: {
      state: slaState,
      dueAt: nextDue?.dueDate || null,
      remainingMs: dueDelta,
    },
  };
}

module.exports = {
  deriveOrderOperationalView,
  shipmentDueAt,
};
