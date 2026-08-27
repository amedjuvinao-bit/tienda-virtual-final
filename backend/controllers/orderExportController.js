'use strict';

const Order = require('../models/Order');
const {
  buildAuthorizedSelectionFilter,
  parseSelectedOrderIds,
} = require('../services/orderRouteAccessService');
const {
  calculateItemsSummary,
} = require('../lib/orders/orderRouteUtils');
const {
  csvCell,
  setOrderCsvResponseHeaders,
} = require('../services/orderCsvSerializationService');
const {
  ADMIN_ORDER_CSV_DB_PROJECTION,
} = require('../services/orderAdminQuery/listProjection');

function orderToCsvRow(order) {
  const items = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.cart)
      ? order.cart
      : [];
  const summary = order.summary || calculateItemsSummary(items);
  const customer = order.customer || {};

  return [
    csvCell(order.orderNumber || ''),
    csvCell(order._id),
    csvCell([customer.name, customer.lastname].filter(Boolean).join(' ').trim()),
    csvCell(customer.emailOrPhone || customer.email || ''),
    csvCell(items.length || 0, { trustedNumber: true }),
    csvCell(summary.totalItems || 0, { trustedNumber: true }),
    csvCell(summary.subtotal || 0, { trustedNumber: true }),
    csvCell(order.total || summary.subtotal + Number(order.shipping || 0) || 0, {
      trustedNumber: true,
    }),
    csvCell(order.status || ''),
    csvCell(Array.isArray(order.tags) ? order.tags.join('|') : ''),
    csvCell(order.createdAt || ''),
    csvCell(order.updatedAt || ''),
  ].join(',');
}

async function exportSelectedOrders(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ error: 'IDS_REQUIRED' });

    const selection = parseSelectedOrderIds(ids);
    if (selection.tooMany) {
      return res.status(413).json({
        error: 'ORDER_SELECTION_LIMIT_EXCEEDED',
        message: `Puedes exportar máximo ${selection.maximum} órdenes por archivo.`,
        maximum: selection.maximum,
      });
    }
    if (!selection.valid) return res.status(400).json({ error: 'INVALID_IDS' });

    const selectionFilter = await buildAuthorizedSelectionFilter(
      req,
      res,
      selection.objectIds
    );
    if (!selectionFilter) return;

    const docs = await Order.find(selectionFilter)
      .select(ADMIN_ORDER_CSV_DB_PROJECTION)
      .sort({ createdAt: -1 })
      .lean();
    const rows = [
      [
        'orderNumber',
        '_id',
        'customerName',
        'customerEmailOrPhone',
        'itemsCount',
        'totalItems',
        'subtotal',
        'total',
        'status',
        'tags',
        'createdAt',
        'updatedAt',
      ].join(','),
      ...docs.map(orderToCsvRow),
    ];

    setOrderCsvResponseHeaders(res, 'orders-selected.csv');
    return res.status(200).send(rows.join('\n'));
  } catch (error) {
    console.error('POST /orders/admin/export', error);
    return res.status(500).json({ error: 'No se pudo exportar el CSV de seleccionadas' });
  }
}

module.exports = {
  exportSelectedOrders,
  orderToCsvRow,
};
