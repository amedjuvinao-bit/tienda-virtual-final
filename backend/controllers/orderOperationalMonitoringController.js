'use strict';

const {
  buildScopedOrderFilter,
} = require('../services/orderAdminScopeService');
const {
  getOperationalHealth,
} = require('../services/orderOperationalMonitoringService');

async function getOrderOperationalHealth(req, res) {
  try {
    const access = buildScopedOrderFilter(req, {});
    if (!access.ok) {
      return res.status(access.status || 403).json({
        ok: false,
        error: access.error || 'ORDER_BRANCH_ACCESS_DENIED',
        message:
          access.message ||
          'No tienes permiso para consultar las métricas de esa sede.',
      });
    }

    const result = await getOperationalHealth({ filter: access.filter });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({
      ok: true,
      scope: {
        mode: access.mode,
        branchCount: Array.isArray(access.branchIds)
          ? access.branchIds.length
          : 0,
      },
      ...result,
    });
  } catch (error) {
    console.error('Error en /api/orders/admin/operations/health:', error);
    return res.status(500).json({
      ok: false,
      error: 'ORDER_OPERATIONAL_HEALTH_FAILED',
      message: 'No fue posible calcular el diagnóstico operativo de órdenes.',
    });
  }
}

module.exports = {
  getOrderOperationalHealth,
};
