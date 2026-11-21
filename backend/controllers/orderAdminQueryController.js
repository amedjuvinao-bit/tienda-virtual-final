'use strict';

const { getPostSaleAlerts } = require('../services/adminPostSaleAlerts');
const Order = require('../models/Order');
const { buildScopedOrderFilter } = require('../services/orderAdminScopeService');
const { buildOperationalSummaryPipeline } = require('../services/orderAdminQueryService');

const {
  queryAdminOrders,
} = require('../services/orderAdminQueryService');
const {
  setOrderCsvResponseHeaders,
} = require('../services/orderCsvSerializationService');

async function listAdminOrders(req, res) {
  try {
    const result = await queryAdminOrders(req);

    if (result.accessError) {
      const access = result.accessError;
      return res.status(access.status || 403).json({
        error: access.error || 'BRANCH_ACCESS_DENIED',
        message:
          access.message ||
          'No tienes permiso para consultar órdenes de esa sede.',
      });
    }

    if (Object.prototype.hasOwnProperty.call(result, 'csv')) {
      setOrderCsvResponseHeaders(res, 'orders.csv');
      return res.status(200).send(result.csv);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error en /api/orders/admin:', error);
    const statusCode = Number(error?.statusCode) === 400 ? 400 : 500;
    return res.status(statusCode).json({
      error:
        statusCode === 400
          ? error.code || 'ORDER_ADMIN_QUERY_INVALID'
          : 'ORDER_ADMIN_QUERY_FAILED',
      message:
        statusCode === 400
          ? error.message
          : 'Error al listar órdenes para admin',
    });
  }
}

async function getOrderOperationalAlerts(req, res) {
  try {
    const scope = buildScopedOrderFilter(req, { archived: { $ne: true } });
    if (!scope.ok) return res.status(scope.status || 403).json({ message: scope.message });
    const [operational] = await Order.aggregate([
      { $match: scope.filter },
      ...buildOperationalSummaryPipeline(new Date()),
    ]).allowDiskUse(true);
    res.set('Cache-Control', 'private, no-store').json({ operational: operational || {} });
  } catch (error) {
    console.error('Error consultando alertas de órdenes:', error.message);
    res.status(500).json({ message: 'No se pudieron consultar las alertas de órdenes.' });
  }
}

async function getOrderPostSaleAlerts(req, res) {
  try {
    const alerts = await getPostSaleAlerts(req);
    res.set('Cache-Control', 'private, no-store').json(alerts);
  } catch (error) {
    console.error('Error consultando alertas de posventa:', error.message);
    res.status(500).json({ message: 'No se pudieron consultar las alertas de posventa.' });
  }
}

module.exports = {
  listAdminOrders,
  getOrderOperationalAlerts,
  getOrderPostSaleAlerts,
};
