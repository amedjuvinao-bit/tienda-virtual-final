// backend/middleware/requireAdmin.js
/**
 * Middleware de protección para rutas admin.
 * - Valida JWT en header `Authorization: Bearer ...` o `x-admin-token`.
 * - Requiere JWT_SECRET configurado.
 * - Solo permite tokens con role: "admin".
 * - Deja pasar preflights (OPTIONS) para que CORS responda.
 * - Propaga req.adminUser, req.adminRole y req.adminAuthType.
 */

const jwt = require('jsonwebtoken');

function parseBearer(authHeader = '') {
  const [type, value] = String(authHeader).split(' ');
  return type?.toLowerCase() === 'bearer' && value ? value.trim() : '';
}

function getTokenFromRequest(req) {
  const bearerToken = parseBearer(req.headers.authorization || '');
  const headerToken = req.headers['x-admin-token'] || '';

  return bearerToken || headerToken;
}

module.exports = function requireAdmin(req, res, next) {
  try {
    if (req.method === 'OPTIONS') return next();

    if (!process.env.JWT_SECRET) {
      console.error('[requireAdmin] JWT_SECRET no configurado');
      return res.status(500).json({
        error: 'SERVER_MISCONFIG',
        message: 'JWT_SECRET no configurado.',
      });
    }

    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Token de administrador ausente.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded?.role !== 'admin') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No tienes permisos de administrador.',
      });
    }

    req.adminUser = decoded.username || 'admin';
    req.adminRole = decoded.role || 'admin';
    req.adminAuthType = 'jwt';

    return next();
  } catch (error) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token de administrador inválido o expirado.',
    });
  }
};