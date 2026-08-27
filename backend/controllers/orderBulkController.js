'use strict';

const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const {
  processBulkOrderStatusTransitions,
} = require('../services/orderStatusTransitionService');
const {
  buildAuthorizedSelectionFilter,
  parseSelectedOrderIds,
} = require('../services/orderRouteAccessService');
const {
  normalizeOrderTags,
} = require('../lib/orders/orderRouteUtils');

function actorFromRequest(req) {
  return {
    id: req.adminUserId || req.user?._id || req.user?.id || null,
    label: req.adminDisplayName || req.adminUsername || 'admin',
    source: 'admin_bulk',
    ip: req.ip,
  };
}

async function applyOrderBulkAction(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ error: 'IDS_REQUIRED' });

    const selection = parseSelectedOrderIds(ids);
    if (selection.tooMany) {
      return res.status(413).json({
        error: 'ORDER_SELECTION_LIMIT_EXCEEDED',
        message: `Puedes procesar máximo ${selection.maximum} órdenes por operación.`,
        maximum: selection.maximum,
      });
    }
    if (!selection.valid) {
      return res.status(400).json({
        error: 'INVALID_IDS',
        message: 'La selección contiene identificadores de orden inválidos.',
      });
    }

    const action = req.body?.action || {};
    const type = String(action.type || '').toLowerCase();
    const selectionFilter = await buildAuthorizedSelectionFilter(
      req,
      res,
      selection.objectIds,
      {
        requireWholeOrder: true,
        ...(type === 'status'
          ? { requiredCapability: 'canManageInventory' }
          : {}),
      }
    );
    if (!selectionFilter) return;

    if (type === 'status') {
      const result = await processBulkOrderStatusTransitions(
        {
          orderIds: selection.objectIds,
          orderFilter: selectionFilter,
          status: action.value,
          actor: actorFromRequest(req),
        },
        { OrderEventModel: OrderEvent }
      );

      return res.status(result.failed > 0 ? 207 : 200).json(result);
    }

    if (!['tags_add', 'tags_remove'].includes(type)) {
      return res.status(400).json({ error: 'INVALID_ACTION' });
    }

    const tags = normalizeOrderTags(action.value || action.values || []);
    if (tags.length === 0) return res.status(400).json({ error: 'TAGS_REQUIRED' });

    const adding = type === 'tags_add';
    const update = adding
      ? { $addToSet: { tags: { $each: tags } } }
      : { $pull: { tags: { $in: tags } } };
    const result = await Order.updateMany(selectionFilter, update);
    const message = adding
      ? `Tags añadidos: ${tags.join(', ')}`
      : `Tags retirados: ${tags.join(', ')}`;

    await OrderEvent.insertMany(
      selection.objectIds.map((orderId) => ({
        orderId,
        type: 'tags_updated',
        message,
        meta: { by: 'admin_bulk' },
      }))
    );

    return res.json({ ok: true, modified: result.modifiedCount || 0 });
  } catch (error) {
    console.error('POST /orders/admin/bulk', error);
    return res.status(error.statusCode || error.status || 500).json({
      error: error.code || 'ORDER_BULK_ACTION_FAILED',
      message: error.message || 'No se pudieron aplicar las acciones masivas',
      details: error.details || undefined,
    });
  }
}

module.exports = {
  actorFromRequest,
  applyOrderBulkAction,
};
