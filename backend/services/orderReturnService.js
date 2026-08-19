'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderRefund = require('../models/OrderRefund');
const OrderReturn = require('../models/OrderReturn');
const {
  normalizeRequestedItems,
  getPreviousRefundState,
  processOrderRefund,
  restoreInventory,
} = require('./orderRefundService');
const {
  hydrateOrderInventoryAllocations,
  applyReturnsToOrderInventoryAllocations,
} = require('./orderInventoryAllocationService');
const {
  canonicalizeVariantKey,
} = require('../lib/products/productVariantConfig');

const ACTIVE_RETURN_STATUSES = [
  'requested',
  'authorized',
  'in_transit',
  'received',
  'inspected',
  'resolution_required',
  'resolved',
];
const MUTABLE_RETURN_STATUSES = new Set([
  'requested',
  'authorized',
  'in_transit',
  'received',
]);
const RETURN_REASON_CODES = new Set(OrderReturn.RETURN_REASON_CODES || []);
const RETURN_RESOLUTION_TYPES = new Set(OrderReturn.RETURN_RESOLUTION_TYPES || []);

function createReturnError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function cleanText(value, maximum = 2000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function cleanLower(value, maximum = 2000) {
  return cleanText(value, maximum).toLowerCase();
}

function cleanUpper(value, maximum = 2000) {
  return cleanText(value, maximum).toUpperCase();
}

function toQuantity(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function toMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function idValue(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString());
    return idValue(value._id || value.id || value.orderItemId || value.product);
  }
  return cleanText(value, 100);
}

function objectId(value, field = 'identificador') {
  const id = idValue(value);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createReturnError(`${field} no es válido.`, 'INVALID_OBJECT_ID', 400, {
      field,
      value: id,
    });
  }
  return new mongoose.Types.ObjectId(id);
}

function actorSnapshot(actor = {}) {
  const id = idValue(actor.id);
  return {
    id: mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null,
    label: cleanText(actor.label || actor.displayName || 'admin', 160),
    role: cleanLower(actor.role, 80),
  };
}

function returnWindowDays() {
  const configured = Math.floor(Number(process.env.ORDER_RETURN_WINDOW_DAYS || 30));
  return Number.isFinite(configured) ? Math.min(365, Math.max(1, configured)) : 30;
}

function orderLines(order = {}) {
  return Array.isArray(order.items) && order.items.length
    ? order.items
    : Array.isArray(order.cart)
      ? order.cart
      : [];
}

function lineQuantity(line = {}) {
  return toQuantity(line.quantity ?? line.qty ?? line.cantidad);
}

function lineUnitAmount(line = {}) {
  const quantity = Math.max(1, lineQuantity(line));
  const lineTotal = toMoney(line.lineTotal);
  if (lineTotal > 0) return toMoney(lineTotal / quantity);
  const taxableBase = toMoney(line.taxableBase);
  const taxAmount = toMoney(line.taxAmount);
  if (taxableBase + taxAmount > 0) {
    return toMoney((taxableBase + taxAmount) / quantity);
  }
  return toMoney(line.unitPrice ?? line.priceNumber ?? line.price);
}

function isPhysicalLine(line = {}) {
  const type = cleanLower(line.productType || 'physical');
  return !['digital', 'service'].includes(type) && line.requiresShipping !== false;
}

function latestDate(values = []) {
  const dates = values
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function earliestDate(values = []) {
  const dates = values
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));
  if (!dates.length) return null;
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function deliveredState(order = {}) {
  const source = cleanLower(order.source);
  if (source === 'pos') return true;
  return ['delivered', 'refunded'].includes(cleanLower(order.status)) ||
    cleanLower(order.fulfillmentStatus) === 'delivered' ||
    cleanLower(order.fulfillment?.status) === 'delivered';
}

function deliveryForLine(order = {}, line = {}) {
  const lineId = idValue(line._id || line.orderItemId);
  const allocations = (order.inventoryAllocations || []).filter(
    (allocation) => idValue(allocation.orderItem) === lineId
  );
  const deliveredQuantity = allocations.reduce(
    (sum, allocation) => sum + toQuantity(allocation.deliveredQuantity),
    0
  );
  const deliveredAt = latestDate(allocations.map((allocation) => allocation.deliveredAt));
  if (deliveredQuantity > 0) return { deliveredQuantity, deliveredAt };

  if (!deliveredState(order)) return { deliveredQuantity: 0, deliveredAt: null };

  const shipmentDate = latestDate(
    (order.fulfillment?.shipments || []).map((shipment) => shipment.deliveredAt)
  );
  return {
    deliveredQuantity: lineQuantity(line),
    deliveredAt:
      shipmentDate ||
      (order.createdAt ? new Date(order.createdAt) : null) ||
      (order.updatedAt ? new Date(order.updatedAt) : null) ||
      new Date(),
  };
}

function addQuantity(map, key, value) {
  const id = idValue(key);
  if (!id) return;
  map.set(id, (map.get(id) || 0) + toQuantity(value));
}

async function loadReturnUsage(orderId, { session = null, excludeReturnId = null } = {}) {
  const refundQuery = OrderRefund.find({
    order: orderId,
    status: 'processed',
    returnCase: null,
  }).lean();
  const returnFilter = {
    order: orderId,
    status: { $in: ACTIVE_RETURN_STATUSES },
  };
  if (excludeReturnId) returnFilter._id = { $ne: objectId(excludeReturnId, 'El RMA') };
  const returnsQuery = OrderReturn.find(returnFilter).lean();
  const allRefundsQuery = OrderRefund.find({ order: orderId, status: 'processed' }).lean();
  const allReturnsQuery = OrderReturn.find({
    order: orderId,
    inventoryProcessedAt: { $ne: null },
  }).lean();
  if (session) {
    refundQuery.session(session);
    returnsQuery.session(session);
    allRefundsQuery.session(session);
    allReturnsQuery.session(session);
  }

  const [directRefunds, returns, allRefunds, inventoryReturns] = await Promise.all([
    refundQuery,
    returnsQuery,
    allRefundsQuery,
    allReturnsQuery,
  ]);
  const returnedByLine = getPreviousRefundState(directRefunds).returnedByLine;
  const unrefundedReturnByLine = new Map();

  for (const returnCase of returns) {
    const inspected = Boolean(returnCase.inspectedAt);
    for (const item of returnCase.items || []) {
      const committedQuantity = inspected
        ? item.acceptedQuantity
        : item.requestedQuantity;
      addQuantity(
        returnedByLine,
        item.orderItemId,
        committedQuantity
      );
      if (!returnCase.resolution?.refund) {
        addQuantity(unrefundedReturnByLine, item.orderItemId, committedQuantity);
      }
    }
  }

  const restoredByStock = getPreviousRefundState(allRefunds).restoredByStock;
  for (const returnCase of inventoryReturns) {
    for (const restoration of returnCase.inventoryRestorations || []) {
      addQuantity(restoredByStock, restoration.inventoryStock, restoration.quantity);
    }
  }

  return { returnedByLine, restoredByStock, unrefundedReturnByLine };
}

function buildReturnEligibility(order = {}, returnedByLine = new Map(), now = new Date()) {
  const windowDays = returnWindowDays();
  return orderLines(order)
    .filter(isPhysicalLine)
    .map((line) => {
      const orderItemId = idValue(line._id || line.orderItemId);
      const purchasedQuantity = lineQuantity(line);
      const delivery = deliveryForLine(order, line);
      const alreadyCommitted = toQuantity(returnedByLine.get(orderItemId) || 0);
      const deliveredQuantity = Math.min(purchasedQuantity, delivery.deliveredQuantity);
      const availableQuantity = Math.max(0, deliveredQuantity - alreadyCommitted);
      const eligibleUntil = delivery.deliveredAt
        ? new Date(delivery.deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
        : null;
      const expired = Boolean(eligibleUntil && now.getTime() > eligibleUntil.getTime());

      return {
        orderItemId,
        product: idValue(line.product || line.productId),
        title: cleanText(line.title || line.name || 'Producto', 240),
        productType: cleanLower(line.productType || 'physical'),
        variantKey:
          canonicalizeVariantKey(line.variantKey || line.variantId) ||
          'default__default',
        size: cleanText(line.size || line.talla, 80),
        color: cleanText(line.colorLabel || line.color, 120),
        purchasedQuantity,
        deliveredQuantity,
        alreadyCommitted,
        availableQuantity,
        unitAmount: lineUnitAmount(line),
        deliveredAt: delivery.deliveredAt,
        eligibleUntil,
        eligible: availableQuantity > 0 && !expired,
        expired,
        blocker:
          deliveredQuantity <= 0
            ? 'ITEM_NOT_DELIVERED'
            : availableQuantity <= 0
              ? 'ITEM_ALREADY_RETURNED'
              : expired
                ? 'RETURN_WINDOW_EXPIRED'
                : '',
      };
    });
}

function requestItemInput(rawItems = [], orderItemId) {
  return rawItems.find(
    (item) => idValue(item?.orderItemId || item?.lineId || item?._id) === orderItemId
  ) || {};
}

function normalizeReturnRequest(
  order,
  rawItems,
  eligibility,
  { overrideEligibility = false, overrideReason = '' } = {}
) {
  if (!Array.isArray(rawItems) || !rawItems.length) {
    throw createReturnError(
      'Selecciona al menos una línea física para la devolución.',
      'RETURN_ITEMS_REQUIRED',
      400
    );
  }
  if (overrideEligibility && cleanText(overrideReason, 500).length < 8) {
    throw createReturnError(
      'Explica por qué se autoriza la devolución fuera de la política.',
      'RETURN_OVERRIDE_REASON_REQUIRED',
      400
    );
  }

  const normalized = normalizeRequestedItems(order, rawItems, new Map());
  const eligibilityMap = new Map(eligibility.map((item) => [item.orderItemId, item]));

  return normalized.map((item) => {
    const policy = eligibilityMap.get(item.orderItemId);
    const input = requestItemInput(rawItems, item.orderItemId);
    const reasonCode = cleanLower(input.reasonCode || 'other', 80);
    if (!policy || policy.deliveredQuantity <= 0) {
      throw createReturnError(
        `${item.title} todavía no tiene una entrega confirmada.`,
        'RETURN_ITEM_NOT_DELIVERED',
        409,
        { orderItemId: item.orderItemId }
      );
    }
    if (item.returnedQuantity > policy.availableQuantity) {
      throw createReturnError(
        `La cantidad solicitada de ${item.title} supera las unidades disponibles para devolución.`,
        'RETURN_QUANTITY_NOT_AVAILABLE',
        409,
        {
          orderItemId: item.orderItemId,
          availableQuantity: policy.availableQuantity,
          requestedQuantity: item.returnedQuantity,
        }
      );
    }
    if (policy.expired && !overrideEligibility) {
      throw createReturnError(
        `La ventana de devolución de ${item.title} ya venció.`,
        'RETURN_WINDOW_EXPIRED',
        409,
        { orderItemId: item.orderItemId, eligibleUntil: policy.eligibleUntil }
      );
    }
    if (!RETURN_REASON_CODES.has(reasonCode)) {
      throw createReturnError('El motivo de devolución no es válido.', 'RETURN_REASON_INVALID', 400);
    }

    return {
      orderItemId: item.orderItemId,
      product: item.product,
      title: item.title,
      productType: item.productType,
      variantKey: item.variantKey,
      size: item.size,
      color: item.color,
      purchasedQuantity: item.purchasedQuantity,
      unitAmount: policy.unitAmount,
      requestedQuantity: item.returnedQuantity,
      reasonCode,
      reasonText: cleanText(input.reasonText, 500),
    };
  });
}

function buildReturnNumber(orderNumber = '') {
  const orderPart = cleanUpper(orderNumber, 40).replace(/[^A-Z0-9-]/g, '') || 'ORDER';
  return `RMA-${orderPart}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

function safeReturnView(returnCase) {
  const value = typeof returnCase?.toObject === 'function'
    ? returnCase.toObject()
    : returnCase;
  return {
    _id: value?._id,
    returnNumber: value?.returnNumber,
    order: value?.order,
    orderNumber: value?.orderNumber,
    status: value?.status,
    revision: Number(value?.revision || 0),
    requestedResolution: value?.requestedResolution,
    items: value?.items || [],
    reasonSummary: value?.reasonSummary || '',
    eligibility: value?.eligibility || {},
    shipping: value?.shipping || {},
    inventoryRestorations: value?.inventoryRestorations || [],
    inventoryProcessedAt: value?.inventoryProcessedAt || null,
    estimatedRefundAmount: Number(value?.estimatedRefundAmount || 0),
    resolution: value?.resolution || {},
    rejectionReason: value?.rejectionReason || '',
    cancellationReason: value?.cancellationReason || '',
    requestedAt: value?.requestedAt || null,
    authorizedAt: value?.authorizedAt || null,
    rejectedAt: value?.rejectedAt || null,
    inTransitAt: value?.inTransitAt || null,
    receivedAt: value?.receivedAt || null,
    inspectedAt: value?.inspectedAt || null,
    resolvedAt: value?.resolvedAt || null,
    cancelledAt: value?.cancelledAt || null,
    requestedBy: value?.requestedBy || {},
    authorizedBy: value?.authorizedBy || {},
    receivedBy: value?.receivedBy || {},
    inspectedBy: value?.inspectedBy || {},
    resolvedBy: value?.resolvedBy || {},
    createdAt: value?.createdAt || null,
    updatedAt: value?.updatedAt || null,
  };
}

async function createOrderEvent(OrderEventModel, payload, session) {
  if (!OrderEventModel) return;
  await OrderEventModel.create([payload], { session });
}

async function listOrderReturns({ orderFilter, now = new Date() } = {}) {
  const order = await Order.findOne(orderFilter).lean();
  if (!order) throw createReturnError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
  const usage = await loadReturnUsage(order._id);
  const [returns, eligibility] = await Promise.all([
    OrderReturn.find({ order: order._id }).sort({ createdAt: -1, _id: -1 }).lean(),
    Promise.resolve(buildReturnEligibility(order, usage.returnedByLine, now)),
  ]);
  return {
    policy: { windowDays: returnWindowDays() },
    eligibility,
    returns: returns.map(safeReturnView),
  };
}

async function createOrderReturn(
  {
    orderFilter,
    items = [],
    requestedResolution = 'refund',
    reasonSummary = '',
    overrideEligibility = false,
    overrideReason = '',
    actor = {},
    now = new Date(),
  } = {},
  { OrderEventModel = null } = {}
) {
  const resolution = cleanLower(requestedResolution, 40);
  if (!RETURN_RESOLUTION_TYPES.has(resolution)) {
    throw createReturnError('La resolución solicitada no es válida.', 'RETURN_RESOLUTION_INVALID', 400);
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne(orderFilter).session(session);
      if (!order) throw createReturnError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
      const usage = await loadReturnUsage(order._id, { session });
      const eligibility = buildReturnEligibility(order, usage.returnedByLine, now);
      const normalizedItems = normalizeReturnRequest(order, items, eligibility, {
        overrideEligibility,
        overrideReason,
      });
      const deliveredAt = earliestDate(
        normalizedItems.map((item) =>
          eligibility.find((entry) => entry.orderItemId === item.orderItemId)?.deliveredAt
        )
      );
      const windowDays = returnWindowDays();
      const returnCase = new OrderReturn({
        returnNumber: buildReturnNumber(order.orderNumber),
        order: order._id,
        orderNumber: order.orderNumber,
        status: 'requested',
        revision: 0,
        requestedResolution: resolution,
        items: normalizedItems,
        reasonSummary: cleanText(reasonSummary, 800),
        eligibility: {
          windowDays,
          deliveredAt,
          eligibleUntil: deliveredAt
            ? new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
            : null,
          overridden: overrideEligibility === true,
          overrideReason: overrideEligibility ? cleanText(overrideReason, 500) : '',
        },
        requestedAt: now,
        requestedBy: actorSnapshot(actor),
        resolution: { type: resolution, state: 'pending' },
      });
      await returnCase.save({ session });
      // Serializa solicitudes concurrentes de la misma orden. Si dos transacciones
      // intentan reservar las mismas unidades, MongoDB fuerza el reintento de una
      // de ellas y la segunda vuelve a calcular la elegibilidad ya comprometida.
      await Order.updateOne(
        { _id: order._id },
        {
          $inc: {
            'returnControl.revision': 1,
            'returnControl.requestCount': 1,
          },
          $set: {
            'returnControl.lastRequestedAt': now,
            'returnControl.lastReturn': returnCase._id,
          },
        },
        { session }
      );
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: 'return_requested',
          message: `RMA ${returnCase.returnNumber} solicitado para ${normalizedItems.reduce(
            (sum, item) => sum + item.requestedQuantity,
            0
          )} unidad(es).`,
          meta: {
            returnId: returnCase._id,
            returnNumber: returnCase.returnNumber,
            requestedResolution: resolution,
            overrideEligibility: overrideEligibility === true,
            items: normalizedItems.map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.requestedQuantity,
              reasonCode: item.reasonCode,
            })),
            by: actorSnapshot(actor),
          },
        },
        session
      );
      result = safeReturnView(returnCase);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function assertExpectedRevision(returnCase, expectedRevision) {
  const revision = Number(expectedRevision);
  if (!Number.isInteger(revision) || revision < 0) {
    throw createReturnError('Debes enviar la revisión actual del RMA.', 'RETURN_REVISION_REQUIRED', 400);
  }
  if (Number(returnCase.revision || 0) !== revision) {
    throw createReturnError(
      'Otro usuario modificó este RMA. Recarga la información antes de continuar.',
      'RETURN_REVISION_CONFLICT',
      409,
      { expectedRevision: revision, currentRevision: Number(returnCase.revision || 0) }
    );
  }
}

function itemPatchMap(items = []) {
  return new Map(
    (Array.isArray(items) ? items : []).map((item) => [
      idValue(item?.orderItemId || item?._id),
      item || {},
    ])
  );
}

function applyAuthorization(returnCase, payload, actor, now) {
  if (returnCase.status !== 'requested') {
    throw createReturnError('Solo un RMA solicitado puede autorizarse.', 'RETURN_STATUS_INVALID', 409);
  }
  const patches = itemPatchMap(payload.items);
  let total = 0;
  for (const item of returnCase.items) {
    const patch = patches.get(idValue(item.orderItemId)) || {};
    const quantity = Object.prototype.hasOwnProperty.call(patch, 'authorizedQuantity')
      ? toQuantity(patch.authorizedQuantity)
      : item.requestedQuantity;
    if (quantity > item.requestedQuantity) {
      throw createReturnError('La autorización supera la cantidad solicitada.', 'RETURN_AUTHORIZED_QUANTITY_INVALID', 400);
    }
    item.authorizedQuantity = quantity;
    total += quantity;
  }
  if (!total) throw createReturnError('Autoriza al menos una unidad.', 'RETURN_AUTHORIZED_ITEMS_REQUIRED', 400);
  returnCase.shipping = {
    ...(returnCase.shipping?.toObject?.() || returnCase.shipping || {}),
    method: cleanLower(payload.shipping?.method || 'pending', 40),
    carrierName: cleanText(payload.shipping?.carrierName, 160),
    trackingNumber: cleanText(payload.shipping?.trackingNumber, 180),
    trackingUrl: cleanText(payload.shipping?.trackingUrl, 1000),
    labelUrl: cleanText(payload.shipping?.labelUrl, 1000),
    instructions: cleanText(payload.shipping?.instructions, 1600),
  };
  returnCase.status = 'authorized';
  returnCase.authorizedAt = now;
  returnCase.authorizedBy = actorSnapshot(actor);
}

function applyReceipt(returnCase, payload, actor, now) {
  if (!['authorized', 'in_transit'].includes(returnCase.status)) {
    throw createReturnError('El RMA no está listo para recepción.', 'RETURN_STATUS_INVALID', 409);
  }
  const patches = itemPatchMap(payload.items);
  let total = 0;
  for (const item of returnCase.items) {
    const patch = patches.get(idValue(item.orderItemId)) || {};
    const quantity = Object.prototype.hasOwnProperty.call(patch, 'receivedQuantity')
      ? toQuantity(patch.receivedQuantity)
      : item.authorizedQuantity;
    if (quantity > item.authorizedQuantity) {
      throw createReturnError('La recepción supera la cantidad autorizada.', 'RETURN_RECEIVED_QUANTITY_INVALID', 400);
    }
    item.receivedQuantity = quantity;
    total += quantity;
  }
  if (!total) throw createReturnError('Registra al menos una unidad recibida.', 'RETURN_RECEIVED_ITEMS_REQUIRED', 400);
  returnCase.status = 'received';
  returnCase.receivedAt = now;
  returnCase.receivedBy = actorSnapshot(actor);
}

function validateInspection(returnCase, inspections = []) {
  const patches = itemPatchMap(inspections);
  return returnCase.items.map((item) => {
    const patch = patches.get(idValue(item.orderItemId));
    if (!patch && item.receivedQuantity > 0) {
      throw createReturnError(`Falta inspeccionar ${item.title}.`, 'RETURN_INSPECTION_REQUIRED', 400);
    }
    const sellableQuantity = toQuantity(patch?.sellableQuantity);
    const damagedQuantity = toQuantity(patch?.damagedQuantity);
    const quarantineQuantity = toQuantity(patch?.quarantineQuantity);
    const rejectedQuantity = toQuantity(patch?.rejectedQuantity);
    const inspectedTotal =
      sellableQuantity + damagedQuantity + quarantineQuantity + rejectedQuantity;
    if (inspectedTotal !== toQuantity(item.receivedQuantity)) {
      throw createReturnError(
        `La inspección de ${item.title} debe clasificar exactamente ${item.receivedQuantity} unidad(es).`,
        'RETURN_INSPECTION_TOTAL_MISMATCH',
        400,
        { orderItemId: idValue(item.orderItemId), receivedQuantity: item.receivedQuantity, inspectedTotal }
      );
    }
    return {
      orderItemId: idValue(item.orderItemId),
      sellableQuantity,
      damagedQuantity,
      quarantineQuantity,
      rejectedQuantity,
      acceptedQuantity: sellableQuantity + damagedQuantity + quarantineQuantity,
      inspectionNote: cleanText(patch?.inspectionNote, 1000),
    };
  });
}

async function updateOrderReturn(
  {
    orderFilter,
    returnId,
    action,
    expectedRevision,
    payload = {},
    actor = {},
    now = new Date(),
  } = {},
  { OrderEventModel = null } = {}
) {
  const cleanAction = cleanLower(action, 60);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne(orderFilter).session(session);
      if (!order) throw createReturnError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
      const returnCase = await OrderReturn.findOne({
        _id: objectId(returnId, 'El RMA'),
        order: order._id,
      }).session(session);
      if (!returnCase) throw createReturnError('RMA no encontrado.', 'RETURN_NOT_FOUND', 404);
      assertExpectedRevision(returnCase, expectedRevision);

      if (cleanAction === 'authorize') {
        applyAuthorization(returnCase, payload, actor, now);
      } else if (cleanAction === 'reject') {
        if (returnCase.status !== 'requested') {
          throw createReturnError('Solo un RMA solicitado puede rechazarse.', 'RETURN_STATUS_INVALID', 409);
        }
        const reason = cleanText(payload.reason, 800);
        if (reason.length < 5) throw createReturnError('Explica el motivo del rechazo.', 'RETURN_REJECTION_REASON_REQUIRED', 400);
        returnCase.status = 'rejected';
        returnCase.rejectionReason = reason;
        returnCase.rejectedAt = now;
        returnCase.resolvedBy = actorSnapshot(actor);
        returnCase.resolution = {
          type: 'no_refund',
          state: 'completed',
          amount: 0,
          reference: 'RMA_REJECTED',
          completedAt: now,
        };
      } else if (cleanAction === 'mark_in_transit') {
        if (returnCase.status !== 'authorized') {
          throw createReturnError('Solo un RMA autorizado puede marcarse en tránsito.', 'RETURN_STATUS_INVALID', 409);
        }
        returnCase.shipping.carrierName = cleanText(payload.shipping?.carrierName || returnCase.shipping?.carrierName, 160);
        returnCase.shipping.trackingNumber = cleanText(payload.shipping?.trackingNumber || returnCase.shipping?.trackingNumber, 180);
        returnCase.shipping.trackingUrl = cleanText(payload.shipping?.trackingUrl || returnCase.shipping?.trackingUrl, 1000);
        returnCase.status = 'in_transit';
        returnCase.inTransitAt = now;
      } else if (cleanAction === 'receive') {
        applyReceipt(returnCase, payload, actor, now);
      } else if (cleanAction === 'cancel') {
        if (!MUTABLE_RETURN_STATUSES.has(returnCase.status) || returnCase.status === 'received') {
          throw createReturnError('Este RMA ya no puede cancelarse.', 'RETURN_STATUS_INVALID', 409);
        }
        const reason = cleanText(payload.reason, 800);
        if (reason.length < 5) throw createReturnError('Explica el motivo de la cancelación.', 'RETURN_CANCELLATION_REASON_REQUIRED', 400);
        returnCase.status = 'cancelled';
        returnCase.cancellationReason = reason;
        returnCase.cancelledAt = now;
        returnCase.resolvedBy = actorSnapshot(actor);
        returnCase.resolution = {
          type: 'no_refund',
          state: 'completed',
          amount: 0,
          reference: 'RMA_CANCELLED',
          completedAt: now,
        };
      } else if (cleanAction === 'inspect') {
        if (returnCase.status !== 'received') {
          throw createReturnError('El RMA debe estar recibido antes de inspeccionarlo.', 'RETURN_STATUS_INVALID', 409);
        }
        const inspections = validateInspection(returnCase, payload.items);
        const usage = await loadReturnUsage(order._id, {
          session,
          excludeReturnId: returnCase._id,
        });
        const normalizedItems = normalizeRequestedItems(
          order,
          inspections
            .filter((item) => item.acceptedQuantity > 0)
            .map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.acceptedQuantity,
              restockQuantity: item.sellableQuantity,
            })),
          usage.returnedByLine
        );
        const restorations = await restoreInventory({
          order,
          returnCase,
          requestedItems: normalizedItems,
          previousRestoredByStock: usage.restoredByStock,
          adminId: actorSnapshot(actor).id,
          session,
        });
        const inspectionMap = new Map(inspections.map((item) => [item.orderItemId, item]));
        for (const item of returnCase.items) {
          const inspection = inspectionMap.get(idValue(item.orderItemId));
          item.sellableQuantity = inspection.sellableQuantity;
          item.damagedQuantity = inspection.damagedQuantity;
          item.quarantineQuantity = inspection.quarantineQuantity;
          item.rejectedQuantity = inspection.rejectedQuantity;
          item.acceptedQuantity = inspection.acceptedQuantity;
          item.inspectionNote = inspection.inspectionNote;
        }
        await hydrateOrderInventoryAllocations(order, { session });
        applyReturnsToOrderInventoryAllocations(order, restorations, now);
        await Order.updateOne(
          { _id: order._id },
          {
            $set: {
              inventoryAllocations: order.inventoryAllocations,
              inventoryAllocationSummary: order.inventoryAllocationSummary,
            },
          },
          { session }
        );
        returnCase.inventoryRestorations = restorations;
        returnCase.inventoryProcessedAt = now;
        returnCase.inspectedAt = now;
        returnCase.inspectedBy = actorSnapshot(actor);
        const acceptedTotal = inspections.reduce((sum, item) => sum + item.acceptedQuantity, 0);
        if (acceptedTotal > 0) {
          returnCase.status = 'resolution_required';
          returnCase.resolution = {
            ...(returnCase.resolution?.toObject?.() || returnCase.resolution || {}),
            type: returnCase.requestedResolution,
            state: 'action_required',
          };
        } else {
          returnCase.status = 'resolved';
          returnCase.resolvedAt = now;
          returnCase.resolvedBy = actorSnapshot(actor);
          returnCase.resolution = {
            type: 'no_refund',
            state: 'completed',
            amount: 0,
            reference: 'INSPECTION_REJECTED',
            completedAt: now,
          };
        }
      } else {
        throw createReturnError('La acción solicitada no es válida.', 'RETURN_ACTION_INVALID', 400);
      }

      returnCase.revision += 1;
      await returnCase.save({ session });
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: `return_${cleanAction}`,
          message: `RMA ${returnCase.returnNumber}: ${cleanAction}.`,
          meta: {
            returnId: returnCase._id,
            returnNumber: returnCase.returnNumber,
            action: cleanAction,
            status: returnCase.status,
            revision: returnCase.revision,
            by: actorSnapshot(actor),
          },
        },
        session
      );
      result = safeReturnView(returnCase);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function resolveOrderReturnRefund(
  {
    orderFilter,
    returnId,
    expectedRevision,
    amount,
    actor = {},
    now = new Date(),
  } = {},
  { OrderEventModel = null } = {}
) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne(orderFilter).session(session);
      if (!order) throw createReturnError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
      const returnCase = await OrderReturn.findOne({
        _id: objectId(returnId, 'El RMA'),
        order: order._id,
      }).session(session);
      if (!returnCase) throw createReturnError('RMA no encontrado.', 'RETURN_NOT_FOUND', 404);
      if (
        returnCase.status === 'resolved' &&
        returnCase.resolution?.type === 'refund' &&
        returnCase.resolution?.refund
      ) {
        const requestedAmount = amount === undefined || amount === null || amount === ''
          ? Number(returnCase.resolution.amount || 0)
          : toMoney(amount);
        if (requestedAmount !== toMoney(returnCase.resolution.amount)) {
          throw createReturnError(
            'El RMA ya fue resuelto con un monto diferente.',
            'RETURN_ALREADY_RESOLVED',
            409
          );
        }
        const existingRefund = await OrderRefund.findById(
          returnCase.resolution.refund
        ).session(session).lean();
        result = {
          returnCase: safeReturnView(returnCase),
          refund: existingRefund,
          idempotent: true,
        };
        return;
      }
      assertExpectedRevision(returnCase, expectedRevision);
      if (returnCase.status !== 'resolution_required' || returnCase.requestedResolution !== 'refund') {
        throw createReturnError('El RMA no está listo para reembolso.', 'RETURN_REFUND_NOT_READY', 409);
      }
      const maximum = toMoney(
        returnCase.items.reduce(
          (sum, item) => sum + toMoney(item.unitAmount) * toQuantity(item.acceptedQuantity),
          0
        )
      );
      const refundAmount = amount === undefined || amount === null || amount === ''
        ? maximum
        : toMoney(amount);
      if (refundAmount <= 0 || refundAmount > maximum) {
        throw createReturnError(
          'El monto debe ser mayor a cero y no superar el valor aceptado en la inspección.',
          'RETURN_REFUND_AMOUNT_INVALID',
          400,
          { maximum, requestedAmount: refundAmount }
        );
      }
      const usage = await loadReturnUsage(order._id, {
        session,
        excludeReturnId: returnCase._id,
      });
      const refundResult = await processOrderRefund(
        {
          orderId: order._id,
          amount: refundAmount,
          reason: `Resolución ${returnCase.returnNumber}`,
          items: returnCase.items
            .filter((item) => item.acceptedQuantity > 0)
            .map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.acceptedQuantity,
              restockQuantity: 0,
            })),
          idempotencyKey: `rma:${returnCase._id}:refund`,
          adminId: actorSnapshot(actor).id,
          adminLabel: actorSnapshot(actor).label,
          returnCaseId: returnCase._id,
        },
        {
          session,
          OrderEventModel,
          additionalReturnedByLine: usage.unrefundedReturnByLine,
        }
      );
      returnCase.status = 'resolved';
      returnCase.resolvedAt = now;
      returnCase.resolvedBy = actorSnapshot(actor);
      returnCase.resolution = {
        type: 'refund',
        state:
          refundResult.refund?.reconciliation?.state === 'completed'
            ? 'completed'
            : 'action_required',
        amount: refundAmount,
        reference: refundResult.refund?.refundNumber || '',
        refund: refundResult.refund?._id || null,
        completedAt:
          refundResult.refund?.reconciliation?.state === 'completed'
            ? now
            : null,
      };
      returnCase.revision += 1;
      await returnCase.save({ session });
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: 'return_resolved_refund',
          message: `RMA ${returnCase.returnNumber} resuelto con reembolso ${refundResult.refund?.refundNumber || ''}.`,
          meta: {
            returnId: returnCase._id,
            refundId: refundResult.refund?._id,
            amount: refundAmount,
            revision: returnCase.revision,
            by: actorSnapshot(actor),
          },
        },
        session
      );
      result = {
        returnCase: safeReturnView(returnCase),
        refund: refundResult.refund,
        idempotent: refundResult.idempotent,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function resolveOrderReturnExchange(
  {
    orderFilter,
    replacementOrderFilter,
    returnId,
    expectedRevision,
    reference,
    actor = {},
    now = new Date(),
  } = {},
  { OrderEventModel = null } = {}
) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const [order, replacementOrder] = await Promise.all([
        Order.findOne(orderFilter).session(session),
        Order.findOne(replacementOrderFilter).session(session),
      ]);
      if (!order) throw createReturnError('Orden original no encontrada.', 'ORDER_NOT_FOUND', 404);
      if (!replacementOrder) {
        throw createReturnError(
          'La orden de reemplazo no existe o está fuera de tus sedes.',
          'REPLACEMENT_ORDER_NOT_FOUND',
          404
        );
      }
      if (idValue(replacementOrder._id) === idValue(order._id)) {
        throw createReturnError('La orden de reemplazo debe ser diferente.', 'REPLACEMENT_ORDER_INVALID', 400);
      }
      if (['failed', 'cancelled', 'canceled', 'refunded'].includes(cleanLower(replacementOrder.status))) {
        throw createReturnError('La orden de reemplazo no está operativamente vigente.', 'REPLACEMENT_ORDER_INVALID', 409);
      }
      const safeReference = cleanText(reference, 240);
      if (safeReference.length < 4) {
        throw createReturnError('Registra la referencia o motivo del cambio.', 'EXCHANGE_REFERENCE_REQUIRED', 400);
      }
      const returnCase = await OrderReturn.findOne({
        _id: objectId(returnId, 'El RMA'),
        order: order._id,
      }).session(session);
      if (!returnCase) throw createReturnError('RMA no encontrado.', 'RETURN_NOT_FOUND', 404);
      if (
        returnCase.status === 'resolved' &&
        returnCase.resolution?.type === 'exchange'
      ) {
        const sameReplacement =
          idValue(returnCase.resolution.replacementOrder) ===
          idValue(replacementOrder._id);
        const sameReference =
          cleanText(returnCase.resolution.reference, 240) === safeReference;
        if (!sameReplacement || !sameReference) {
          throw createReturnError(
            'El RMA ya fue resuelto con otro cambio.',
            'RETURN_ALREADY_RESOLVED',
            409
          );
        }
        result = safeReturnView(returnCase);
        return;
      }
      assertExpectedRevision(returnCase, expectedRevision);
      if (returnCase.status !== 'resolution_required' || returnCase.requestedResolution !== 'exchange') {
        throw createReturnError('El RMA no está listo para cambio.', 'RETURN_EXCHANGE_NOT_READY', 409);
      }
      returnCase.status = 'resolved';
      returnCase.resolvedAt = now;
      returnCase.resolvedBy = actorSnapshot(actor);
      returnCase.resolution = {
        type: 'exchange',
        state: 'completed',
        amount: 0,
        reference: safeReference,
        replacementOrder: replacementOrder._id,
        replacementOrderNumber: replacementOrder.orderNumber,
        completedAt: now,
      };
      returnCase.revision += 1;
      await returnCase.save({ session });
      await createOrderEvent(
        OrderEventModel,
        {
          orderId: order._id,
          type: 'return_resolved_exchange',
          message: `RMA ${returnCase.returnNumber} enlazado con la orden de reemplazo ${replacementOrder.orderNumber}.`,
          meta: {
            returnId: returnCase._id,
            replacementOrderId: replacementOrder._id,
            replacementOrderNumber: replacementOrder.orderNumber,
            reference: safeReference,
            revision: returnCase.revision,
            by: actorSnapshot(actor),
          },
        },
        session
      );
      result = safeReturnView(returnCase);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  ACTIVE_RETURN_STATUSES,
  buildReturnEligibility,
  createOrderReturn,
  createReturnError,
  lineUnitAmount,
  listOrderReturns,
  loadReturnUsage,
  normalizeReturnRequest,
  resolveOrderReturnExchange,
  resolveOrderReturnRefund,
  safeReturnView,
  updateOrderReturn,
  validateInspection,
};
