// backend/middleware/adminOnly.js

const requireAdmin = require('./requireAdmin');
const requirePermission = require('./requirePermission');

function adminOnly(permission, options = {}) {
  return [
    requireAdmin,
    requirePermission(permission, options),
  ];
}

adminOnly.any = function adminOnlyAny(permissions = [], options = {}) {
  return [
    requireAdmin,
    requirePermission.any(permissions, options),
  ];
};

adminOnly.all = function adminOnlyAll(permissions = [], options = {}) {
  return [
    requireAdmin,
    requirePermission.all(permissions, options),
  ];
};

module.exports = adminOnly;