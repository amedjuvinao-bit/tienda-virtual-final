'use strict';

const {
  SERVICE_FULFILLMENT_STATUSES,
  transitionOrderFulfillmentService,
} = require('../services/orderFulfillment/serviceTransition');
const {
  buildOrderOperationFilter,
  sendOrderScopeError,
} = require('../services/orderRouteAccessService');

async function updateOrderFulfillmentService(req, res) {
  const access = buildOrderOperationFilter(req, req.params.id, {
    requireWholeOrder: true,
  });
  if (!access.ok) return sendOrderScopeError(res, access);

  try {
    const result = await transitionOrderFulfillmentService({
      orderFilter: access.filter,
      serviceId: req.params.serviceId,
      status: req.body?.status,
      scheduledAt: req.body?.scheduledAt,
      notes: req.body?.notes,
      notesProvided: Object.prototype.hasOwnProperty.call(
        req.body || {},
        'notes'
      ),
      actor: {
        id: req.adminUserId || null,
        label: req.adminDisplayName || req.adminUsername || '',
        source: 'admin',
      },
    });

    return res.json({
      ok: true,
      changed: result.changed,
      previousStatus: result.previousStatus,
      fulfillmentStatus: result.order.fulfillmentStatus,
      fulfillment: {
        status: result.order.fulfillment?.status,
        notificationStatus:
          result.order.fulfillment?.notificationStatus,
      },
      service: result.service,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 0);
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({
        ok: false,
        code: error.code || 'FULFILLMENT_SERVICE_UPDATE_REJECTED',
        message: error.message,
        details: error.details || null,
      });
    }

    console.error(
      'PATCH /orders/:id/fulfillment/services/:serviceId',
      error
    );
    return res.status(500).json({
      ok: false,
      code: 'FULFILLMENT_SERVICE_UPDATE_FAILED',
      message: 'No fue posible actualizar el servicio.',
    });
  }
}

module.exports = {
  SERVICE_FULFILLMENT_STATUSES,
  updateOrderFulfillmentService,
};
