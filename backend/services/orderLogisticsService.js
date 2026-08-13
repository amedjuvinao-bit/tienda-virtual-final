'use strict';

const mongoose = require('mongoose');

const Order = require('../models/Order');
const {
  advanceOrderInventoryAllocationsForShipment,
  hydrateOrderInventoryAllocations,
} = require('./orderInventoryAllocationService');

const SHIPMENT_ACTIONS = Object.freeze({
  start_picking: { from: ['ready_to_pick'], to: 'picking' },
  complete_picking: { from: ['picking'], to: 'picked' },
  start_packing: { from: ['picked'], to: 'packing' },
  complete_packing: { from: ['packing'], to: 'packed' },
  dispatch: { from: ['packed'], to: 'dispatched' },
  mark_in_transit: { from: ['dispatched'], to: 'in_transit' },
  deliver: { from: ['dispatched', 'in_transit'], to: 'delivered' },
});

const ACTIVE_LOGISTICS_STATUSES = new Set([
  'picking',
  'picked',
  'packing',
  'packed',
  'dispatched',
  'in_transit',
]);
const DISPATCHED_LOGISTICS_STATUSES = new Set([
  'dispatched',
  'in_transit',
  'delivered',
]);
const TERMINAL_LOGISTICS_STATUSES = new Set(['delivered', 'cancelled']);
const MAX_SHIPMENT_HISTORY = 100;
const MAX_SHIPMENT_INCIDENTS = 30;
const MAX_PACKAGES = 20;

function cleanText(value, maxLength = 240) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function cleanLower(value, maxLength = 80) {
  return cleanText(value, maxLength).toLowerCase();
}

function idValue(value) {
  return String(value?._id || value || '').trim();
}

function asPlain(value) {
  if (!value) return {};
  return typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true })
    : { ...value };
}

function createLogisticsError(message, code, statusCode = 409, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function actorSnapshot(actor = {}) {
  const rawId = idValue(actor.id || actor.admin);
  return {
    admin: mongoose.Types.ObjectId.isValid(rawId) ? rawId : null,
    displayName: cleanText(actor.displayName || actor.label || actor.username, 120),
    role: cleanLower(actor.role, 80),
    source: cleanLower(actor.source || 'admin', 80),
  };
}

function isPaymentConfirmed(order) {
  const paymentStatus = cleanLower(order?.payment?.status);
  const orderStatus = cleanLower(order?.status);
  return (
    paymentStatus === 'paid' ||
    ['paid', 'shipped', 'delivered', 'refunded'].includes(orderStatus)
  );
}

function hasIncompleteVirtualFulfillment(order) {
  const digital = Array.isArray(order?.fulfillment?.digitalDeliveries)
    ? order.fulfillment.digitalDeliveries
    : [];
  const services = Array.isArray(order?.fulfillment?.services)
    ? order.fulfillment.services
    : [];

  return (
    digital.some((item) => cleanLower(item?.status) !== 'ready') ||
    services.some(
      (item) => !['completed', 'cancelled'].includes(cleanLower(item?.status))
    )
  );
}

function parseOptionalDate(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createLogisticsError(
      `La fecha ${field} no es válida.`,
      'INVALID_LOGISTICS_DATE',
      400,
      { field }
    );
  }
  return parsed;
}

function normalizeTrackingUrl(value) {
  const url = cleanText(value, 1000);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
    return parsed.toString();
  } catch {
    throw createLogisticsError(
      'La URL de seguimiento debe usar HTTP o HTTPS.',
      'INVALID_TRACKING_URL',
      400
    );
  }
}

function normalizePackages(input, shipmentCode) {
  if (input === undefined) return undefined;
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_PACKAGES) {
    throw createLogisticsError(
      `Debes registrar entre 1 y ${MAX_PACKAGES} paquetes.`,
      'INVALID_SHIPMENT_PACKAGES',
      400
    );
  }

  const seen = new Set();
  return input.map((item, index) => {
    const code = cleanText(
      item?.code || `${shipmentCode}-P${String(index + 1).padStart(2, '0')}`,
      80
    ).toUpperCase();
    if (!code || seen.has(code)) {
      throw createLogisticsError(
        'Cada paquete debe tener un código único.',
        'DUPLICATE_PACKAGE_CODE',
        400,
        { code }
      );
    }
    seen.add(code);

    const boundedNumber = (value, max) => {
      const number = Number(value || 0);
      if (!Number.isFinite(number) || number < 0 || number > max) {
        throw createLogisticsError(
          `Las medidas del paquete ${code} no son válidas.`,
          'INVALID_PACKAGE_MEASUREMENT',
          400,
          { code }
        );
      }
      return number;
    };

    return {
      code,
      weightGrams: boundedNumber(item?.weightGrams, 1000000),
      lengthCm: boundedNumber(item?.lengthCm, 1000),
      widthCm: boundedNumber(item?.widthCm, 1000),
      heightCm: boundedNumber(item?.heightCm, 1000),
      labelReference: cleanText(item?.labelReference, 240),
      sealedAt: item?.sealedAt ? parseOptionalDate(item.sealedAt, 'sellado') : null,
    };
  });
}

function getRelevantDueAt(shipment) {
  const status = cleanLower(shipment?.status);
  if (['ready_to_pick', 'picking'].includes(status)) return shipment?.sla?.pickingDueAt || null;
  if (['picked', 'packing', 'packed'].includes(status)) return shipment?.sla?.dispatchDueAt || null;
  if (['dispatched', 'in_transit'].includes(status)) return shipment?.sla?.deliveryDueAt || null;
  return null;
}

function evaluateShipmentSla(shipment, now = new Date()) {
  if (!shipment?.sla) shipment.sla = {};
  shipment.sla.lastEvaluatedAt = now;
  const dueAt = getRelevantDueAt(shipment);
  if (dueAt && new Date(dueAt).getTime() < now.getTime()) {
    shipment.sla.breachedAt = shipment.sla.breachedAt || now;
  }
  return shipment;
}

function summarizeShipments(shipments = [], now = new Date()) {
  const list = Array.isArray(shipments) ? shipments : [];
  list.forEach((shipment) => evaluateShipmentSla(shipment, now));
  const statusCounts = (status) =>
    list.filter((shipment) => cleanLower(shipment?.status) === status).length;
  const deliveredCount = statusCounts('delivered');
  const exceptionCount = statusCounts('exception');
  const cancelledCount = statusCounts('cancelled');
  const dispatchedCount = list.filter((shipment) =>
    DISPATCHED_LOGISTICS_STATUSES.has(cleanLower(shipment?.status))
  ).length;
  const relevantDates = list
    .map(getRelevantDueAt)
    .filter(Boolean)
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left - right);

  let status = 'not_initialized';
  if (list.length && cancelledCount === list.length) status = 'cancelled';
  else if (exceptionCount > 0) status = 'exception';
  else if (list.length && deliveredCount === list.length) status = 'delivered';
  else if (deliveredCount > 0) status = 'partially_delivered';
  else if (list.length && dispatchedCount === list.length) status = 'dispatched';
  else if (dispatchedCount > 0) status = 'partially_dispatched';
  else if (list.some((shipment) => ACTIVE_LOGISTICS_STATUSES.has(cleanLower(shipment?.status)))) {
    status = 'in_progress';
  } else if (list.length) status = 'ready';

  return {
    status,
    shipmentCount: list.length,
    readyCount: statusCounts('ready_to_pick'),
    activeCount: list.filter((shipment) =>
      ACTIVE_LOGISTICS_STATUSES.has(cleanLower(shipment?.status))
    ).length,
    dispatchedCount,
    deliveredCount,
    exceptionCount,
    slaBreachedCount: list.filter((shipment) => Boolean(shipment?.sla?.breachedAt)).length,
    nextDueAt: relevantDates[0] || null,
    updatedAt: now,
  };
}

function logisticsView(order, now = new Date()) {
  const shipments = Array.isArray(order?.fulfillment?.shipments)
    ? order.fulfillment.shipments
    : [];
  return {
    orderId: order?._id || null,
    orderNumber: cleanText(order?.orderNumber, 120),
    orderStatus: cleanLower(order?.status),
    fulfillmentStatus: cleanLower(order?.fulfillmentStatus),
    summary: summarizeShipments(shipments, now),
    shipments,
  };
}

function activeAllocationQuantity(allocation) {
  return Math.max(
    0,
    Number(allocation?.soldQuantity || 0) - Number(allocation?.returnedQuantity || 0)
  );
}

function buildShipmentGroups(order) {
  const allocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const groups = new Map();

  for (const allocation of allocations) {
    const quantity = activeAllocationQuantity(allocation);
    const branchId = idValue(allocation?.branch);
    if (!quantity || !branchId || !allocation?._id) continue;
    const current = groups.get(branchId) || {
      branch: allocation.branch,
      branchSnapshot: asPlain(allocation.branchSnapshot),
      allocationIds: [],
      quantity: 0,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      shippedAt: null,
      deliveredAt: null,
    };
    current.allocationIds.push(allocation._id);
    current.quantity += quantity;
    current.shippedQuantity += Math.min(
      quantity,
      Number(allocation?.shippedQuantity || 0)
    );
    current.deliveredQuantity += Math.min(
      quantity,
      Number(allocation?.deliveredQuantity || 0)
    );
    current.shippedAt = current.shippedAt || allocation?.shippedAt || null;
    current.deliveredAt = current.deliveredAt || allocation?.deliveredAt || null;
    groups.set(branchId, current);
  }

  return [...groups.values()];
}

function defaultShipmentCode(order, group, index) {
  const orderPart = cleanText(order?.orderNumber || idValue(order?._id), 40)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-12)
    .toUpperCase();
  const branchPart = cleanText(group?.branchSnapshot?.code, 12)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return `SHP-${orderPart || 'ORDER'}-${branchPart || String(index + 1).padStart(2, '0')}`;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function appendShipmentHistory(shipment, entry) {
  const history = Array.isArray(shipment.history) ? shipment.history : [];
  history.push(entry);
  shipment.history = history.slice(-MAX_SHIPMENT_HISTORY);
}

function reconcileOrderFromLogistics(order, now = new Date()) {
  const shipments = Array.isArray(order?.fulfillment?.shipments)
    ? order.fulfillment.shipments
    : [];
  const summary = summarizeShipments(shipments, now);
  order.fulfillment.logisticsSummary = summary;

  if (summary.status === 'exception') {
    order.fulfillment.status = 'action_required';
    order.fulfillmentStatus = 'processing';
    return summary;
  }

  const activeShipments = shipments.filter(
    (shipment) => cleanLower(shipment?.status) !== 'cancelled'
  );
  const allDispatched =
    activeShipments.length > 0 &&
    activeShipments.every((shipment) =>
      DISPATCHED_LOGISTICS_STATUSES.has(cleanLower(shipment?.status))
    );
  const allDelivered =
    activeShipments.length > 0 &&
    activeShipments.every((shipment) => cleanLower(shipment?.status) === 'delivered');
  const virtualPending = hasIncompleteVirtualFulfillment(order);

  if (allDelivered && !virtualPending) {
    if (!['cancelled', 'refunded'].includes(cleanLower(order.status))) {
      order.status = 'delivered';
    }
    order.fulfillmentStatus = 'delivered';
    order.fulfillment.status = 'delivered';
  } else if (allDelivered) {
    order.fulfillmentStatus = 'partially_delivered';
    order.fulfillment.status = 'partially_delivered';
  } else {
    if (
      allDispatched &&
      !['cancelled', 'failed', 'refunded', 'delivered'].includes(cleanLower(order.status))
    ) {
      order.status = 'shipped';
    }
    order.fulfillmentStatus = 'processing';
    order.fulfillment.status = 'processing';
  }

  return summary;
}

async function createOrderEvent(OrderEventModel, payload, session) {
  if (!OrderEventModel) return;
  await OrderEventModel.create([payload], { session });
}

async function runInTransaction(work, externalSession = null) {
  if (externalSession) return work(externalSession);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function initializeOrderLogistics(
  {
    orderFilter,
    actor = {},
    now = new Date(),
    authorizedBranchIds = [],
    allowAllBranches = false,
  } = {},
  { OrderModel = Order, OrderEventModel = null, session: externalSession = null } = {}
) {
  if (!orderFilter || typeof orderFilter !== 'object') {
    throw createLogisticsError('Falta el alcance autorizado de la orden.', 'ORDER_SCOPE_REQUIRED', 403);
  }

  return runInTransaction(async (session) => {
    const order = await OrderModel.findOne(orderFilter).session(session);
    if (!order) {
      throw createLogisticsError('Orden no encontrada dentro de tus sedes autorizadas.', 'ORDER_NOT_FOUND', 404);
    }
    if (!isPaymentConfirmed(order)) {
      throw createLogisticsError(
        'La logística solo puede iniciar después de confirmar el pago.',
        'ORDER_PAYMENT_REQUIRED_FOR_LOGISTICS',
        409
      );
    }
    if (['cancelled', 'failed', 'refunded'].includes(cleanLower(order.status))) {
      throw createLogisticsError(
        'El estado comercial de la orden no permite iniciar logística.',
        'ORDER_STATUS_BLOCKS_LOGISTICS',
        409
      );
    }

    await hydrateOrderInventoryAllocations(order, { session });
    const allowedBranches = new Set(
      (Array.isArray(authorizedBranchIds) ? authorizedBranchIds : [])
        .map(idValue)
        .filter(Boolean)
    );
    const groups = buildShipmentGroups(order).filter(
      (group) => allowAllBranches || allowedBranches.has(idValue(group.branch))
    );
    if (!groups.length) {
      throw createLogisticsError(
        'La orden no tiene asignaciones físicas vendidas para preparar.',
        'ORDER_LOGISTICS_ALLOCATIONS_REQUIRED',
        409
      );
    }

    if (!order.fulfillment) order.fulfillment = {};
    const existing = Array.isArray(order.fulfillment.shipments)
      ? order.fulfillment.shipments
      : [];
    const byBranch = new Map(
      existing.map((shipment) => [idValue(shipment.branch), shipment])
    );
    const actorView = actorSnapshot(actor);

    for (const [index, group] of groups.entries()) {
      const branchId = idValue(group.branch);
      const current = byBranch.get(branchId);
      if (current) {
        if (!DISPATCHED_LOGISTICS_STATUSES.has(cleanLower(current.status))) {
          current.allocationIds = group.allocationIds;
          current.quantity = group.quantity;
          current.branchSnapshot = group.branchSnapshot;
          current.updatedAt = now;
        }
        continue;
      }

      const code = defaultShipmentCode(order, group, index);
      const initialStatus =
        group.deliveredQuantity >= group.quantity
          ? 'delivered'
          : group.shippedQuantity >= group.quantity
            ? 'dispatched'
            : 'ready_to_pick';
      const legacyState = initialStatus !== 'ready_to_pick';
      existing.push({
        code,
        branch: group.branch,
        branchSnapshot: group.branchSnapshot,
        allocationIds: group.allocationIds,
        quantity: group.quantity,
        initializationSource: legacyState
          ? 'legacy_allocation_state'
          : 'inventory_allocations',
        status: initialStatus,
        resumeStatus: initialStatus,
        priority: 'normal',
        revision: 0,
        packages: [{ code: `${code}-P01` }],
        sla: {
          pickingDueAt: addHours(now, 4),
          dispatchDueAt: addHours(now, 24),
          deliveryDueAt: addHours(now, 72),
          lastEvaluatedAt: now,
        },
        history: [
          {
            action: 'initialize',
            statusFrom: '',
            statusTo: initialStatus,
            note: legacyState
              ? 'Envío reconstruido desde cantidades históricas de inventario; la referencia externa anterior no estaba disponible.'
              : 'Envío creado desde las asignaciones confirmadas de inventario.',
            actor: actorView,
            at: now,
          },
        ],
        dispatchedAt: ['dispatched', 'delivered'].includes(initialStatus)
          ? group.shippedAt || group.deliveredAt || now
          : null,
        deliveredAt: initialStatus === 'delivered' ? group.deliveredAt || now : null,
        updatedAt: now,
      });
    }

    order.fulfillment.shipments = existing;
    reconcileOrderFromLogistics(order, now);
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    order.timeline.push({
      type: 'system',
      message: `Logística preparada: ${existing.length} envío(s) por sede.`,
      by: actorView.displayName || actorView.source,
      at: now,
    });
    await order.save({ session });

    await createOrderEvent(
      OrderEventModel,
      {
        orderId: order._id,
        type: 'logistics_initialized',
        message: `Logística preparada con ${existing.length} envío(s).`,
        meta: {
          shipmentCount: existing.length,
          branches: existing.map((shipment) => idValue(shipment.branch)),
          by: actorView,
        },
      },
      session
    );

    return { order, ...logisticsView(order, now) };
  }, externalSession);
}

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
      throw createLogisticsError('La prioridad logística no es válida.', 'INVALID_LOGISTICS_PRIORITY', 400);
    }
    shipment.priority = priority;
  }
  if (!shipment.carrier) shipment.carrier = {};
  const carrier = payload.carrier || {};
  if (Object.prototype.hasOwnProperty.call(carrier, 'code')) shipment.carrier.code = cleanText(carrier.code, 40).toUpperCase();
  if (Object.prototype.hasOwnProperty.call(carrier, 'name')) shipment.carrier.name = cleanText(carrier.name, 120);
  if (Object.prototype.hasOwnProperty.call(carrier, 'serviceLevel')) shipment.carrier.serviceLevel = cleanText(carrier.serviceLevel, 120);
  if (Object.prototype.hasOwnProperty.call(carrier, 'trackingNumber')) shipment.carrier.trackingNumber = cleanText(carrier.trackingNumber, 160);
  if (Object.prototype.hasOwnProperty.call(carrier, 'trackingUrl')) shipment.carrier.trackingUrl = normalizeTrackingUrl(carrier.trackingUrl);

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
  const picking = shipment.sla.pickingDueAt ? new Date(shipment.sla.pickingDueAt) : null;
  const dispatch = shipment.sla.dispatchDueAt ? new Date(shipment.sla.dispatchDueAt) : null;
  const delivery = shipment.sla.deliveryDueAt ? new Date(shipment.sla.deliveryDueAt) : null;
  if ((picking && dispatch && picking > dispatch) || (dispatch && delivery && dispatch > delivery)) {
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
    throw createLogisticsError('Describe la incidencia logística.', 'INCIDENT_DESCRIPTION_REQUIRED', 400);
  }
  if (TERMINAL_LOGISTICS_STATUSES.has(cleanLower(shipment.status))) {
    throw createLogisticsError('Un envío cerrado no admite incidencias nuevas.', 'SHIPMENT_ALREADY_CLOSED', 409);
  }
  const type = cleanLower(payload.incidentType || 'other');
  const severity = cleanLower(payload.severity || 'medium');
  const allowedTypes = ['delay', 'stock_mismatch', 'damage', 'address', 'carrier', 'customer_unavailable', 'other'];
  if (!allowedTypes.includes(type) || !['low', 'medium', 'high', 'critical'].includes(severity)) {
    throw createLogisticsError('La clasificación de la incidencia no es válida.', 'INVALID_LOGISTICS_INCIDENT', 400);
  }
  if ((shipment.incidents || []).some((incident) => incident.status === 'open')) {
    throw createLogisticsError('El envío ya tiene una incidencia abierta.', 'OPEN_LOGISTICS_INCIDENT_EXISTS', 409);
  }
  shipment.resumeStatus = shipment.status;
  shipment.status = 'exception';
  shipment.incidents = Array.isArray(shipment.incidents) ? shipment.incidents : [];
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
    throw createLogisticsError('El envío no tiene una incidencia activa.', 'NO_OPEN_LOGISTICS_INCIDENT', 409);
  }
  const resolution = cleanText(payload.resolution, 1000);
  if (!resolution) {
    throw createLogisticsError('Registra cómo se resolvió la incidencia.', 'INCIDENT_RESOLUTION_REQUIRED', 400);
  }
  const incidents = Array.isArray(shipment.incidents) ? shipment.incidents : [];
  const incident = [...incidents].reverse().find((item) => item.status === 'open');
  if (!incident) {
    throw createLogisticsError('No se encontró la incidencia abierta.', 'NO_OPEN_LOGISTICS_INCIDENT', 409);
  }
  incident.status = 'resolved';
  incident.resolution = resolution;
  incident.resolvedAt = now;
  incident.resolvedBy = actorView;
  shipment.status = shipment.resumeStatus || 'ready_to_pick';
}

function applyOperationalTransition(order, shipment, action, payload, actorView, now) {
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
    const carrierName = cleanText(payload?.carrier?.name || shipment?.carrier?.name, 120);
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
    advanceOrderInventoryAllocationsForShipment(order, shipment.allocationIds, 'shipped', now);
  }
  if (contract.to === 'in_transit') shipment.inTransitAt = shipment.inTransitAt || now;
  if (contract.to === 'delivered') {
    shipment.deliveredAt = shipment.deliveredAt || now;
    advanceOrderInventoryAllocationsForShipment(order, shipment.allocationIds, 'delivered', now);
  }
  return contract.to;
}

async function updateOrderShipment(
  {
    orderFilter,
    shipmentId,
    action,
    expectedRevision,
    payload = {},
    actor = {},
    now = new Date(),
    authorizedBranchIds = [],
    allowAllBranches = false,
  } = {},
  { OrderModel = Order, OrderEventModel = null, session: externalSession = null } = {}
) {
  const normalizedAction = cleanLower(action);
  const allowedActions = new Set([
    ...Object.keys(SHIPMENT_ACTIONS),
    'update_plan',
    'report_incident',
    'resolve_incident',
  ]);
  if (!allowedActions.has(normalizedAction)) {
    throw createLogisticsError('La acción logística no es válida.', 'INVALID_LOGISTICS_ACTION', 400);
  }

  return runInTransaction(async (session) => {
    const order = await OrderModel.findOne(orderFilter).session(session);
    if (!order) throw createLogisticsError('Orden no encontrada dentro de tus sedes autorizadas.', 'ORDER_NOT_FOUND', 404);
    const shipment = order.fulfillment?.shipments?.id(shipmentId);
    if (!shipment) throw createLogisticsError('Envío logístico no encontrado.', 'SHIPMENT_NOT_FOUND', 404);
    const allowedBranches = new Set(
      (Array.isArray(authorizedBranchIds) ? authorizedBranchIds : [])
        .map(idValue)
        .filter(Boolean)
    );
    if (!allowAllBranches && !allowedBranches.has(idValue(shipment.branch))) {
      throw createLogisticsError(
        'No tienes permiso para operar el envío de esa sede.',
        'SHIPMENT_BRANCH_FORBIDDEN',
        403
      );
    }
    ensureExpectedRevision(shipment, expectedRevision);

    const previousStatus = cleanLower(shipment.status);
    const actorView = actorSnapshot(actor);
    if (normalizedAction === 'update_plan') applyPlanUpdate(shipment, payload);
    else if (normalizedAction === 'report_incident') applyIncidentAction(shipment, payload, actorView, now);
    else if (normalizedAction === 'resolve_incident') resolveIncident(shipment, payload, actorView, now);
    else applyOperationalTransition(order, shipment, normalizedAction, payload, actorView, now);

    shipment.revision = Number(shipment.revision || 0) + 1;
    shipment.updatedAt = now;
    evaluateShipmentSla(shipment, now);
    appendShipmentHistory(shipment, {
      action: normalizedAction,
      statusFrom: previousStatus,
      statusTo: cleanLower(shipment.status),
      note: cleanText(payload.note || payload.description || payload.resolution, 1000),
      evidenceReference: cleanText(payload.dispatchReference || payload.deliveryReference, 240),
      actor: actorView,
      at: now,
    });
    const summary = reconcileOrderFromLogistics(order, now);
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    order.timeline.push({
      type: 'system',
      message: `Logística ${shipment.code}: ${previousStatus} → ${shipment.status}.`,
      by: actorView.displayName || actorView.source,
      at: now,
    });
    await order.save({ session });

    await createOrderEvent(
      OrderEventModel,
      {
        orderId: order._id,
        type: `logistics_${normalizedAction}`,
        message: `Envío ${shipment.code}: ${previousStatus} → ${shipment.status}.`,
        meta: {
          shipmentId: idValue(shipment._id),
          shipmentCode: shipment.code,
          action: normalizedAction,
          revision: shipment.revision,
          branchId: idValue(shipment.branch),
          by: actorView,
        },
      },
      session
    );

    return {
      order,
      orderStatus: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      summary,
      shipment,
      shipments: order.fulfillment.shipments,
    };
  }, externalSession);
}

module.exports = {
  SHIPMENT_ACTIONS,
  summarizeShipments,
  logisticsView,
  initializeOrderLogistics,
  updateOrderShipment,
  reconcileOrderFromLogistics,
  createLogisticsError,
};
