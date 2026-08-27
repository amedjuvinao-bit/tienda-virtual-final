'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const OrderEvent = require('../../models/OrderEvent');
const { clean } = require('./support');

const SERVICE_FULFILLMENT_STATUSES = Object.freeze([
  'awaiting_scheduling',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

const SERVICE_TRANSITIONS = new Map([
  ['awaiting_scheduling', new Set(['scheduled', 'cancelled'])],
  ['scheduled', new Set(['in_progress', 'cancelled'])],
  ['in_progress', new Set(['completed', 'cancelled'])],
  ['completed', new Set()],
  ['cancelled', new Set()],
]);

const PAID_SERVICE_STATUSES = new Set([
  'scheduled',
  'in_progress',
  'completed',
]);

const SERVICE_SELECTION =
  '+fulfillment.services.bookingUrl ' +
  '+fulfillment.services.internalInstructions';

function transitionError(message, code, statusCode = 409, details = {}) {
  return Object.assign(new Error(message), { code, statusCode, details });
}

function normalizeStatus(value) {
  return clean(value, 40).toLowerCase();
}

function allowedTargets(service = {}) {
  const current = normalizeStatus(service.status);
  const allowed = new Set(SERVICE_TRANSITIONS.get(current) || []);
  if (
    current === 'awaiting_scheduling' &&
    normalizeStatus(service.fulfillmentMode) === 'manual'
  ) {
    allowed.add('in_progress');
  }
  return [...allowed];
}

function assertTransitionAllowed(service, targetStatus) {
  const currentStatus = normalizeStatus(service?.status);
  if (currentStatus === targetStatus) return currentStatus;

  const allowed = allowedTargets(service);
  if (!allowed.includes(targetStatus)) {
    throw transitionError(
      `No se permite cambiar el servicio de ${currentStatus || 'sin estado'} a ${targetStatus}.`,
      'FULFILLMENT_SERVICE_TRANSITION_NOT_ALLOWED',
      409,
      { currentStatus, targetStatus, allowed }
    );
  }
  return currentStatus;
}

function assertPaymentConfirmed(order, targetStatus) {
  if (!PAID_SERVICE_STATUSES.has(targetStatus)) return;
  const paymentStatus = normalizeStatus(order?.payment?.status);
  if (paymentStatus === 'paid') return;

  throw transitionError(
    'El pago debe estar confirmado antes de programar, iniciar o completar el servicio.',
    'FULFILLMENT_PAYMENT_NOT_CONFIRMED',
    409,
    { paymentStatus: paymentStatus || 'unknown', targetStatus }
  );
}

function parseScheduledAt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw transitionError(
      'La fecha programada no es válida.',
      'FULFILLMENT_SCHEDULED_AT_INVALID',
      400
    );
  }
  return parsed;
}

function sameDate(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return new Date(left).getTime() === new Date(right).getTime();
}

function buildServicePatch(service, request, targetStatus, now) {
  const requestedScheduledAt = parseScheduledAt(request.scheduledAt);
  const scheduledAt = ['scheduled', 'in_progress', 'completed'].includes(
    targetStatus
  )
    ? requestedScheduledAt || service.scheduledAt || now
    : service.scheduledAt || null;
  const completedAt =
    targetStatus === 'completed' ? service.completedAt || now : null;
  const notes = Object.prototype.hasOwnProperty.call(request, 'notes')
    ? clean(request.notes, 2000)
    : clean(service.notes, 2000);

  return { status: targetStatus, scheduledAt, completedAt, notes };
}

function servicePatchChanged(service, patch) {
  return (
    normalizeStatus(service.status) !== patch.status ||
    !sameDate(service.scheduledAt, patch.scheduledAt) ||
    !sameDate(service.completedAt, patch.completedAt) ||
    clean(service.notes, 2000) !== patch.notes
  );
}

function fulfillmentAggregate(order, services) {
  const digitalDeliveries = Array.isArray(
    order?.fulfillment?.digitalDeliveries
  )
    ? order.fulfillment.digitalDeliveries
    : [];
  const readyDigital = digitalDeliveries.filter(
    (delivery) => normalizeStatus(delivery?.status) === 'ready'
  ).length;
  const activeServices = services.filter(
    (service) => normalizeStatus(service?.status) !== 'cancelled'
  );
  const completedServices = activeServices.filter(
    (service) => normalizeStatus(service?.status) === 'completed'
  ).length;
  const allDigitalReady =
    digitalDeliveries.length === 0 || readyDigital === digitalDeliveries.length;
  const allServicesCompleted =
    activeServices.length > 0 &&
    completedServices === activeServices.length;
  const hasVirtualDelivery =
    digitalDeliveries.length > 0 || activeServices.length > 0;
  const allVirtualDelivered =
    hasVirtualDelivery &&
    allDigitalReady &&
    (activeServices.length === 0 || allServicesCompleted);
  const hasShipment = (Array.isArray(order?.items) ? order.items : []).some(
    (item) => item?.requiresShipping !== false
  );

  if (allVirtualDelivered && !hasShipment) {
    return { operational: 'delivered', order: 'delivered' };
  }
  if (readyDigital > 0 || completedServices > 0) {
    return {
      operational: 'partially_delivered',
      order: 'partially_delivered',
    };
  }
  return {
    operational: 'action_required',
    order: hasShipment
      ? normalizeStatus(order?.fulfillmentStatus) || 'reserved'
      : 'processing',
  };
}

function serviceIdValue(value) {
  return String(value?._id || value || '').trim();
}

function revisionValue(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : String(value);
}

function concurrentModificationError(serviceId, previousStatus, targetStatus) {
  return transitionError(
    'La prestación cambió mientras se actualizaba. Recarga la orden e inténtalo nuevamente.',
    'FULFILLMENT_SERVICE_CONCURRENT_MODIFICATION',
    409,
    { serviceId: serviceIdValue(serviceId), previousStatus, targetStatus }
  );
}

function findService(order, serviceId) {
  const services = order?.fulfillment?.services;
  if (services && typeof services.id === 'function') {
    return services.id(serviceId);
  }
  return (Array.isArray(services) ? services : []).find(
    (service) => serviceIdValue(service) === serviceIdValue(serviceId)
  );
}

function patchedServices(order, serviceId, patch) {
  return (Array.isArray(order?.fulfillment?.services)
    ? order.fulfillment.services
    : []
  ).map((service) =>
    serviceIdValue(service) === serviceIdValue(serviceId)
      ? { ...service, ...patch }
      : service
  );
}

async function runTransaction(mongooseAdapter, externalSession, work) {
  if (externalSession) return work(externalSession);
  const session = await mongooseAdapter.startSession();
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

async function transitionOrderFulfillmentService(
  {
    orderFilter,
    serviceId,
    status,
    scheduledAt,
    notes,
    notesProvided = false,
    actor = {},
    session: externalSession = null,
  } = {},
  {
    mongooseAdapter = mongoose,
    OrderModel = Order,
    OrderEventModel = OrderEvent,
    now = () => new Date(),
  } = {}
) {
  const targetStatus = normalizeStatus(status);
  if (!SERVICE_FULFILLMENT_STATUSES.includes(targetStatus)) {
    throw transitionError(
      'Estado de servicio inválido.',
      'FULFILLMENT_SERVICE_STATUS_INVALID',
      400,
      { allowed: SERVICE_FULFILLMENT_STATUSES }
    );
  }
  if (!orderFilter || typeof orderFilter !== 'object') {
    throw transitionError(
      'No fue posible autorizar la orden.',
      'FULFILLMENT_ORDER_SCOPE_REQUIRED',
      403
    );
  }
  if (!mongoose.Types.ObjectId.isValid(String(serviceId || ''))) {
    throw transitionError(
      'La prestación de servicio no tiene un identificador válido.',
      'FULFILLMENT_SERVICE_ID_INVALID',
      400
    );
  }

  let observedRevision = null;
  let observedServiceStatus = null;

  return runTransaction(mongooseAdapter, externalSession, async (session) => {
    const order = await OrderModel.findOne(orderFilter)
      .select(SERVICE_SELECTION)
      .session(session);
    if (!order) {
      throw transitionError(
        'Orden no encontrada.',
        'FULFILLMENT_ORDER_NOT_FOUND',
        404
      );
    }
    const service = findService(order, serviceId);
    if (!service) {
      throw transitionError(
        'Prestación de servicio no encontrada.',
        'FULFILLMENT_SERVICE_NOT_FOUND',
        404
      );
    }

    const currentRevision = revisionValue(order.updatedAt);
    const currentServiceStatus = normalizeStatus(service.status);
    if (observedRevision === null) {
      observedRevision = currentRevision;
      observedServiceStatus = currentServiceStatus;
    } else if (
      observedRevision !== currentRevision ||
      observedServiceStatus !== currentServiceStatus
    ) {
      throw concurrentModificationError(
        serviceId,
        observedServiceStatus,
        targetStatus
      );
    }

    assertPaymentConfirmed(order, targetStatus);
    const previousStatus = assertTransitionAllowed(service, targetStatus);
    const changedAt = now();
    const request = {
      scheduledAt,
      ...(notesProvided ? { notes } : {}),
    };
    const patch = buildServicePatch(service, request, targetStatus, changedAt);
    if (!servicePatchChanged(service, patch)) {
      return {
        changed: false,
        previousStatus,
        targetStatus,
        order,
        service,
      };
    }

    const services = patchedServices(order, serviceId, patch);
    const aggregate = fulfillmentAggregate(order, services);
    const serviceMatch = { _id: service._id, status: previousStatus };
    const serviceArrayFilter = {
      'service._id': service._id,
      'service.status': previousStatus,
    };
    const casFilter = {
      $and: [
        orderFilter,
        {
          _id: order._id,
          updatedAt: order.updatedAt,
          'fulfillment.services': { $elemMatch: serviceMatch },
          ...(PAID_SERVICE_STATUSES.has(targetStatus)
            ? { 'payment.status': 'paid' }
            : {}),
        },
      ],
    };
    const updatedQuery = OrderModel.findOneAndUpdate(
      casFilter,
      {
        $set: {
          'fulfillment.services.$[service].status': patch.status,
          'fulfillment.services.$[service].scheduledAt': patch.scheduledAt,
          'fulfillment.services.$[service].completedAt': patch.completedAt,
          'fulfillment.services.$[service].notes': patch.notes,
          'fulfillment.status': aggregate.operational,
          fulfillmentStatus: aggregate.order,
        },
      },
      {
        new: true,
        runValidators: true,
        session,
        arrayFilters: [serviceArrayFilter],
      }
    );
    const updatedOrder =
      updatedQuery && typeof updatedQuery.select === 'function'
        ? await updatedQuery.select(SERVICE_SELECTION)
        : await updatedQuery;
    if (!updatedOrder) {
      throw concurrentModificationError(
        serviceId,
        previousStatus,
        targetStatus
      );
    }

    const updatedService = findService(updatedOrder, serviceId);
    await OrderEventModel.create(
      [
        {
          orderId: updatedOrder._id,
          type: 'fulfillment_service_status_changed',
          message: `Servicio ${clean(updatedService?.title || service.title, 160) || serviceIdValue(serviceId)}: ${previousStatus} -> ${targetStatus}`,
          meta: {
            serviceId: serviceIdValue(serviceId),
            from: previousStatus,
            to: targetStatus,
            scheduledAt: patch.scheduledAt || null,
            adminId: actor.id || null,
            by: clean(actor.label || actor.source || actor.id || 'admin', 160),
            occurredAt: changedAt,
          },
        },
      ],
      { session, ordered: true }
    );

    return {
      changed: true,
      previousStatus,
      targetStatus,
      order: updatedOrder,
      service: updatedService,
    };
  });
}

module.exports = {
  PAID_SERVICE_STATUSES,
  SERVICE_FULFILLMENT_STATUSES,
  SERVICE_TRANSITIONS,
  allowedTargets,
  assertPaymentConfirmed,
  assertTransitionAllowed,
  fulfillmentAggregate,
  transitionOrderFulfillmentService,
};
