'use strict';

const requireAdmin = require('./requireAdmin');

function hasAdminCredential(req = {}) {
  const authorization = String(req.headers?.authorization || '').trim();
  const headerToken = String(req.headers?.['x-admin-token'] || '').trim();
  return Boolean(authorization || headerToken);
}

function optionalAdminAuth(req, res, next) {
  if (!hasAdminCredential(req)) return next();
  return requireAdmin(req, res, next);
}

module.exports = optionalAdminAuth;
module.exports.hasAdminCredential = hasAdminCredential;
