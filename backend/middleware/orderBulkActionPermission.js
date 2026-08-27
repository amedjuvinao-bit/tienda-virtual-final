'use strict';

const requirePermission = require('./requirePermission');

const ACTION_PERMISSIONS = Object.freeze({
  status: 'orders:status',
  tags_add: 'orders:tags',
  tags_remove: 'orders:tags',
});

function requireOrderBulkActionPermission(req, res, next) {
  const actionType = String(req.body?.action?.type || '').trim().toLowerCase();
  const actionPermission = ACTION_PERMISSIONS[actionType];

  if (!actionPermission) return next();

  return requirePermission.all(['orders:bulk', actionPermission])(req, res, next);
}

module.exports = {
  ACTION_PERMISSIONS,
  requireOrderBulkActionPermission,
};
