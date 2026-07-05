// backend/routes/adminCashSessions.js

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  serializeCashSession,
  openCashSession,
  closeCashSession,
  getCurrentCashSession,
  listCashSessions,
  getCashSessionById,
} = require('../services/cashSessionService');

const router = express.Router();

function buildAdminContext(req) {
  return {
    id: req.adminUserId || null,
    username: req.adminUsername || req.adminUser || 'admin',
    displayName:
      req.adminProfile?.displayName ||
      req.adminProfile?.fullName ||
      req.adminUsername ||
      'Administrador',
    role: req.adminRole || req.adminProfile?.role || 'admin',
    adminRole: req.adminRole || req.adminProfile?.adminRole || 'admin',
  };
}

function sendError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);

  if (status >= 500) {
    console.error('[adminCashSessions] Error:', error);
  }

  return res.status(status).json({
    ok: false,
    error: error?.code || 'CASH_SESSION_ROUTE_ERROR',
    message: error?.message || 'No se pudo procesar la caja.',
    details: error?.details || {},
  });
}

router.use(requireAdmin);

router.get('/current', requirePermission('pos:view'), async (req, res) => {
  try {
    const session = await getCurrentCashSession({
      branchId: req.query.branchId || req.query.branch,
      cashRegisterCode: req.query.cashRegisterCode || req.query.registerCode || 'CAJA PRINCIPAL',
    });

    return res.json({
      ok: true,
      hasOpenSession: Boolean(session),
      session: session ? serializeCashSession(session) : null,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/open', requirePermission('pos:sell'), async (req, res) => {
  try {
    const session = await openCashSession(req.body || {}, {
      admin: buildAdminContext(req),
    });

    return res.status(201).json({
      ok: true,
      session: serializeCashSession(session),
      message: 'Caja abierta correctamente.',
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/close', requirePermission('pos:sell'), async (req, res) => {
  try {
    const session = await closeCashSession(req.params.id, req.body || {}, {
      admin: buildAdminContext(req),
    });

    return res.json({
      ok: true,
      session: serializeCashSession(session),
      message: 'Caja cerrada correctamente.',
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/', requirePermission('pos:view'), async (req, res) => {
  try {
    const result = await listCashSessions(req.query || {});

    return res.json({
      ok: true,
      sessions: result.sessions.map(serializeCashSession),
      page: result.page,
      limit: result.limit,
      total: result.total,
      pages: result.pages,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', requirePermission('pos:view'), async (req, res) => {
  try {
    const session = await getCashSessionById(req.params.id);

    return res.json({
      ok: true,
      session: serializeCashSession(session),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
