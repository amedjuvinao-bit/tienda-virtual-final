'use strict';

const {
  queryAdminOrders,
} = require('../services/orderAdminQueryService');

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
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
      return res.status(200).send(result.csv);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error en /api/orders/admin:', error);
    return res.status(500).json({
      message: 'Error al listar órdenes para admin',
    });
  }
}

module.exports = {
  listAdminOrders,
};
