'use strict';

const mongoose = require('mongoose');

const { transitionOrderStatus } = require('./singleTransition');
const {
  MAX_BULK_ORDERS,
  cleanText,
  createTransitionError,
  getAllowedOrderStatuses,
  normalizeOrderStatus,
} = require('./stateMachine');

function serializeTransitionError(error, orderId) {
  return {
    orderId: String(orderId || ''),
    ok: false,
    changed: false,
    code: error?.code || 'ORDER_STATUS_TRANSITION_FAILED',
    message: error?.message || 'No se pudo cambiar el estado de la orden.',
    statusCode: Number(error?.statusCode || error?.status || 500),
    details: error?.details || undefined,
  };
}

async function processBulkOrderStatusTransitions(
  { orderIds = [], orderFilter = null, status, actor = {} } = {},
  dependencies = {}
) {
  const targetStatus = normalizeOrderStatus(status);

  if (!targetStatus) {
    throw createTransitionError(
      'El estado solicitado no es válido.',
      'INVALID_ORDER_STATUS',
      400,
      {
        received: cleanText(status),
        allowed: getAllowedOrderStatuses(),
      }
    );
  }

  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(orderIds) ? orderIds : [])
        .map((orderId) => String(orderId || '').trim())
        .filter(Boolean)
    )
  );

  if (!uniqueIds.length) {
    throw createTransitionError(
      'Debes seleccionar al menos una orden.',
      'IDS_REQUIRED',
      400
    );
  }

  if (uniqueIds.length > MAX_BULK_ORDERS) {
    throw createTransitionError(
      `Solo puedes actualizar hasta ${MAX_BULK_ORDERS} órdenes por operación.`,
      'BULK_ORDER_LIMIT_EXCEEDED',
      400,
      {
        max: MAX_BULK_ORDERS,
        received: uniqueIds.length,
      }
    );
  }

  const invalidIds = uniqueIds.filter(
    (orderId) => !mongoose.Types.ObjectId.isValid(orderId)
  );

  if (invalidIds.length) {
    throw createTransitionError(
      'La selección contiene identificadores de orden inválidos.',
      'INVALID_ORDER_IDS',
      400,
      { invalidIds }
    );
  }

  const results = [];

  for (const orderId of uniqueIds) {
    try {
      const result = await transitionOrderStatus(
        {
          orderId,
          orderFilter,
          status: targetStatus,
          actor: {
            ...actor,
            bulk: true,
            source: actor.source || 'admin_bulk',
          },
        },
        dependencies
      );

      results.push({
        orderId,
        orderNumber: result.snapshot?.orderNumber || '',
        ok: true,
        changed: result.changed,
        statusChanged: result.statusChanged === true,
        reconciled: result.reconciled === true,
        status: result.snapshot?.status || targetStatus,
        paymentStatus: result.snapshot?.paymentStatus || '',
        fulfillmentStatus: result.snapshot?.fulfillmentStatus || '',
        fulfillmentWarning: result.fulfillmentWarning,
      });
    } catch (error) {
      results.push(serializeTransitionError(error, orderId));
    }
  }

  const modified = results.filter(
    (result) => result.ok && result.changed
  ).length;
  const unchanged = results.filter(
    (result) => result.ok && !result.changed
  ).length;
  const failed = results.filter((result) => !result.ok).length;

  return {
    ok: failed === 0,
    requested: uniqueIds.length,
    modified,
    unchanged,
    failed,
    targetStatus,
    results,
  };
}

module.exports = {
  processBulkOrderStatusTransitions,
};
