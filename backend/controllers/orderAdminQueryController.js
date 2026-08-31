'use strict';

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

module.exports = {
  listAdminOrders,
};
