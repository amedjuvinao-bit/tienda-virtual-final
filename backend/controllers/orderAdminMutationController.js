const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const { normalizeOrderTags } = require('../lib/orders/orderRouteUtils');
const {
  getAllowedOrderStatuses,
  transitionOrderStatus,
} = require('../services/orderStatusTransitionService');
const {
  buildOrderOperationFilter,
  sendOrderScopeError,
} = require('../services/orderRouteAccessService');

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return ['1', 'true', 'yes', 'y', 'on', 'si', 'sí'].includes(normalized);
}

async function updateOrderStatus(req, res) {
  try {
    const access = buildOrderOperationFilter(req, req.params.id, {
      requiredCapability: 'canManageInventory',
      requireWholeOrder: true,
    });
    if (!access.ok) return sendOrderScopeError(res, access);

    const result = await transitionOrderStatus(
      {
        orderId: req.params.id,
        orderFilter: access.filter,
        status: req.body?.status,
        actor: {
          id: req.adminUserId || req.user?._id || req.user?.id || null,
          label:
            req.adminDisplayName ||
            req.adminUsername ||
            'admin',
          source: 'admin',
          ip: req.ip,
        },
      },
      {
        OrderEventModel: OrderEvent,
        allowInventoryRestock: false,
      }
    );

    return res.json({
      ok: true,
      changed: result.changed,
      order: result.order,
      fulfillmentWarning: result.fulfillmentWarning,
    });
  } catch (error) {
    console.error('PATCH /orders/:id/status', error);
    return res.status(error.statusCode || error.status || 500).json({
      error: error.code || 'ORDER_STATUS_TRANSITION_FAILED',
      message: error.message,
      code: error.code || '',
      details: error.details || undefined,
      allowed:
        error.code === 'INVALID_ORDER_STATUS'
          ? getAllowedOrderStatuses()
          : undefined,
    });
  }
}

async function updateOrderPrinted(req, res) {
  try {
    if (typeof req.body?.printed === 'undefined') {
      return res.status(400).json({
        error: 'PRINTED_REQUIRED',
        message: 'Debes enviar { printed: true|false }',
      });
    }

    const id = req.params.id;
    const access = buildOrderOperationFilter(req, id, {
      requireWholeOrder: true,
    });

    if (!access.ok) return sendOrderScopeError(res, access);

    const order = await Order.findOne(access.filter);

    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const before = !!order.printed;
    const after = parseBoolean(req.body.printed);

    order.printed = after;
    await order.save();

    await OrderEvent.create({
      orderId: order._id,
      type: 'note_updated',
      message: after ? 'Orden marcada como impresa' : 'Se quitó la marca de impresa',
      meta: {
        flag: 'printed',
        before,
        after,
        by: req.adminUsername || req.adminUserId || 'admin',
      },
    });

    return res.json({ ok: true, printed: order.printed });
  } catch (error) {
    console.error('PATCH /orders/:id/printed', error);
    return res.status(500).json({ error: 'No se pudo actualizar printed' });
  }
}

async function updateOrderArchived(req, res) {
  try {
    if (typeof req.body?.archived === 'undefined') {
      return res.status(400).json({
        error: 'ARCHIVED_REQUIRED',
        message: 'Debes enviar { archived: true|false }',
      });
    }

    const id = req.params.id;
    const access = buildOrderOperationFilter(req, id, {
      requireWholeOrder: true,
    });

    if (!access.ok) return sendOrderScopeError(res, access);

    const order = await Order.findOne(access.filter);

    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const before = !!order.archived;
    const after = parseBoolean(req.body.archived);

    order.archived = after;
    await order.save();

    await OrderEvent.create({
      orderId: order._id,
      type: 'note_updated',
      message: after ? 'Orden archivada' : 'Orden desarchivada',
      meta: {
        flag: 'archived',
        before,
        after,
        by: req.adminUsername || req.adminUserId || 'admin',
      },
    });

    return res.json({ ok: true, archived: order.archived });
  } catch (error) {
    console.error('PATCH /orders/:id/archived', error);
    return res.status(500).json({ error: 'No se pudo actualizar archived' });
  }
}

async function updateOrderTags(req, res) {
  try {
    const id = req.params.id;
    const tags = normalizeOrderTags(req.body?.tags || []);
    const access = buildOrderOperationFilter(req, id, {
      requireWholeOrder: true,
    });

    if (!access.ok) return sendOrderScopeError(res, access);

    const order = await Order.findOne(access.filter);

    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const before = Array.isArray(order.tags) ? order.tags.slice() : [];

    order.tags = tags;
    await order.save();

    await OrderEvent.create({
      orderId: order._id,
      type: 'tags_updated',
      message: `Tags actualizados: ${tags.join(', ') || '—'}`,
      meta: {
        before,
        after: order.tags,
        by: req.adminUsername || req.adminUserId || 'admin',
      },
    });

    return res.json({ ok: true, tags: order.tags });
  } catch (error) {
    console.error('PUT /orders/:id/tags', error);
    return res.status(500).json({ error: 'No se pudieron guardar los tags' });
  }
}

module.exports = {
  parseBoolean,
  updateOrderArchived,
  updateOrderPrinted,
  updateOrderStatus,
  updateOrderTags,
};
