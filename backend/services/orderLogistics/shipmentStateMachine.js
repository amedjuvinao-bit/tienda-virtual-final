'use strict';

const {
  advanceOrderInventoryAllocationsForShipment,
} = require('../orderInventoryAllocationService');
const {
  MAX_SHIPMENT_INCIDENTS,
  SHIPMENT_ACTIONS,
  TERMINAL_LOGISTICS_STATUSES,
} = require('./constants');
const {
  cleanLower,
  cleanText,
  createLogisticsError,
  normalizePackages,
  normalizeTrackingUrl,
  parseOptionalDate,
} = require('./support');

function applyPlanUpdate(shipment, payload = {}) {
  if (TERMINAL_LOGISTICS_STATUSES.has(cleanLower(shipment.status))) {
    throw createLogisticsError(
      'Un envío cerrado no permite editar su plan logístico.',
      'SHIPMENT_ALREADY_CLOSED',
      409
    );
  }
  if (payload.priority !== undefined) {
    const priority = cleanLower(payload.priority);
    if (!['normal', 'high', 'urgent'].includes(priority)) {
      throw createLogisticsError(
        'La prioridad logística no es válida.',
        'INVALID_LOGISTICS_PRIORITY',
        400
      );
    }
    shipment.priority = priority;
  }
  if (!shipment.carrier) shipment.carrier = {};
  const carrier = payload.carrier || {};
  if (Object.prototype.hasOwnProperty.call(carrier, 'code')) {
    shipment.carrier.code = cleanText(carrier.code, 40).toUpperCase();
  }
  if (Object.prototype.hasOwnProperty.call(carrier, 'name')) {
    shipment.carrier.name = cleanText(carrier.name, 120);
  }
  if (Object.prototype.hasOwnProperty.call(carrier, 'serviceLevel')) {
    shipment.carrier.serviceLevel = cleanText(carrier.serviceLevel, 120);
  }
  if (Object.prototype.hasOwnProperty.call(carrier, 'trackingNumber')) {
    shipment.carrier.trackingNumber = cleanText(carrier.trackingNumber, 160);
  }
  if (Object.prototype.hasOwnProperty.call(carrier, 'trackingUrl')) {
    shipment.carrier.trackingUrl = normalizeTrackingUrl(carrier.trackingUrl);
  }

  if (!shipment.sla) shipment.sla = {};
  const sla = payload.sla || {};
  for (const [field, label] of [
    ['pickingDueAt', 'límite de picking'],
    ['dispatchDueAt', 'límite de despacho'],
    ['deliveryDueAt', 'entrega prometida'],
  ]) {
    const parsed = parseOptionalDate(sla[field], label);
    if (parsed !== undefined) shipment.sla[field] = parsed;
  }
  const picking = shipment.sla.pickingDueAt
    ? new Date(shipment.sla.pickingDueAt)
    : null;
  const dispatch = shipment.sla.dispatchDueAt
    ? new Date(shipment.sla.dispatchDueAt)
    : null;
  const delivery = shipment.sla.deliveryDueAt
    ? new Date(shipment.sla.deliveryDueAt)
    : null;
  if (
    (picking && dispatch && picking > dispatch) ||
    (dispatch && delivery && dispatch > delivery)
  ) {
    throw createLogisticsError(
      'Los compromisos SLA deben conservar el orden picking, despacho y entrega.',
      'INVALID_LOGISTICS_SLA_ORDER',
      400
    );
  }
  const packages = normalizePackages(payload.packages, shipment.code);
  if (packages !== undefined) shipment.packages = packages;
}

function ensureExpectedRevision(shipment, expectedRevision) {
  const received = Number(expectedRevision);
  if (!Number.isInteger(received) || received < 0) {
    throw createLogisticsError(
      'Debes enviar la revisión logística visible antes de guardar.',
      'LOGISTICS_REVISION_REQUIRED',
      428
    );
  }
  if (received !== Number(shipment.revision || 0)) {
    throw createLogisticsError(
      'El envío cambió mientras lo estabas revisando. Recarga el detalle.',
      'LOGISTICS_REVISION_CONFLICT',
      409,
      { expected: received, current: Number(shipment.revision || 0) }
    );
  }
}

function applyIncidentAction(shipment, payload, actorView, now) {
  const description = cleanText(payload.description, 1000);
  if (!description) {
    throw createLogisticsError(
      'Describe la incidencia logística.',
      'INCIDENT_DESCRIPTION_REQUIRED',
      400
    );
  }
  if (TERMINAL_LOGISTICS_STATUSES.has(cleanLower(shipment.status))) {
    throw createLogisticsError(
      'Un envío cerrado no admite incidencias nuevas.',
      'SHIPMENT_ALREADY_CLOSED',
      409
    );
  }
  const type = cleanLower(payload.incidentType || 'other');
  const severity = cleanLower(payload.severity || 'medium');
  const allowedTypes = [
    'delay',
    'stock_mismatch',
    'damage',
    'address',
    'carrier',
    'customer_unavailable',
    'other',
  ];
  if (
    !allowedTypes.includes(type) ||
    !['low', 'medium', 'high', 'critical'].includes(severity)
  ) {
    throw createLogisticsError(
      'La clasificación de la incidencia no es válida.',
      'INVALID_LOGISTICS_INCIDENT',
      400
    );
  }
  if ((shipment.incidents || []).some((incident) => incident.status === 'open')) {
    throw createLogisticsError(
      'El envío ya tiene una incidencia abierta.',
      'OPEN_LOGISTICS_INCIDENT_EXISTS',
      409
    );
  }
  shipment.resumeStatus = shipment.status;
  shipment.status = 'exception';
  shipment.incidents = Array.isArray(shipment.incidents)
    ? shipment.incidents
    : [];
  shipment.incidents.push({
    status: 'open',
    type,
    severity,
    description,
    openedAt: now,
    openedBy: actorView,
  });
  shipment.incidents = shipment.incidents.slice(-MAX_SHIPMENT_INCIDENTS);
}

function resolveIncident(shipment, payload, actorView, now) {
  if (cleanLower(shipment.status) !== 'exception') {
    throw createLogisticsError(
      'El envío no tiene una incidencia activa.',
      'NO_OPEN_LOGISTICS_INCIDENT',
      409
    );
  }
  const resolution = cleanText(payload.resolution, 1000);
  if (!resolution) {
    throw createLogisticsError(
      'Registra cómo se resolvió la incidencia.',
      'INCIDENT_RESOLUTION_REQUIRED',
      400
    );
  }
  const incidents = Array.isArray(shipment.incidents)
    ? shipment.incidents
    : [];
  const incident = [...incidents]
    .reverse()
    .find((item) => item.status === 'open');
  if (!incident) {
    throw createLogisticsError(
      'No se encontró la incidencia abierta.',
      'NO_OPEN_LOGISTICS_INCIDENT',
      409
    );
  }
  incident.status = 'resolved';
  incident.resolution = resolution;
  incident.resolvedAt = now;
  incident.resolvedBy = actorView;
  shipment.status = shipment.resumeStatus || 'ready_to_pick';
}

function applyOperationalTransition(order, shipment, action, payload, now) {
  const contract = SHIPMENT_ACTIONS[action];
  if (!contract || !contract.from.includes(cleanLower(shipment.status))) {
    throw createLogisticsError(
      'La transición logística no es válida para el estado actual.',
      'INVALID_LOGISTICS_TRANSITION',
      409,
      { action, status: shipment.status, allowedFrom: contract?.from || [] }
    );
  }

  if (action === 'dispatch') {
    const carrierName = cleanText(
      payload?.carrier?.name || shipment?.carrier?.name,
      120
    );
    const reference = cleanText(payload.dispatchReference, 240);
    if (!carrierName || !reference || !(shipment.packages || []).length) {
      throw createLogisticsError(
        'El despacho exige transportadora, al menos un paquete y referencia de entrega al transportador.',
        'DISPATCH_EVIDENCE_REQUIRED',
        409
      );
    }
    applyPlanUpdate(shipment, payload);
    shipment.dispatchEvidence = { reference, recordedAt: now };
  }

  if (action === 'deliver') {
    const reference = cleanText(payload.deliveryReference, 240);
    if (!reference) {
      throw createLogisticsError(
        'La entrega exige una referencia de evidencia.',
        'DELIVERY_EVIDENCE_REQUIRED',
        409
      );
    }
    shipment.deliveryEvidence = {
      reference,
      recipient: cleanText(payload.recipient, 160),
      recordedAt: now,
    };
  }

  shipment.status = contract.to;
  if (contract.to === 'picking') shipment.startedAt = shipment.startedAt || now;
  if (contract.to === 'picked') shipment.pickedAt = shipment.pickedAt || now;
  if (contract.to === 'packed') {
    shipment.packedAt = shipment.packedAt || now;
    shipment.packages.forEach((item) => {
      item.sealedAt = item.sealedAt || now;
    });
  }
  if (contract.to === 'dispatched') {
    shipment.dispatchedAt = shipment.dispatchedAt || now;
    advanceOrderInventoryAllocationsForShipment(
      order,
      shipment.allocationIds,
      'shipped',
      now
    );
  }
  if (contract.to === 'in_transit') {
    shipment.inTransitAt = shipment.inTransitAt || now;
  }
  if (contract.to === 'delivered') {
    shipment.deliveredAt = shipment.deliveredAt || now;
    advanceOrderInventoryAllocationsForShipment(
      order,
      shipment.allocationIds,
      'delivered',
      now
    );
  }
  return contract.to;
}

module.exports = {
  applyPlanUpdate,
  ensureExpectedRevision,
  applyIncidentAction,
  resolveIncident,
  applyOperationalTransition,
};
