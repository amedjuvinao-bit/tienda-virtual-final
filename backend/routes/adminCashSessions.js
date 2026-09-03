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
const {
  addManualCashMovement,
  reviewCashMovement,
} = require('../services/cashMovementService');
const {
  assertPosBranchAccess,
  buildCashSessionAccess,
} = require('../services/adminPosAccessService');

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

function serializeForAccess(session, access = {}) {
  return serializeCashSession(session, {
    canSupervise: access.canSupervise === true,
    blindCount: access.canSupervise !== true,
  });
}

router.use(requireAdmin);

router.get('/current', requirePermission('pos:view'), async (req, res) => {
  try {
    const branchId = req.query.branchId || req.query.branch;
    assertPosBranchAccess(req, branchId);
    const access = buildCashSessionAccess(req, {
      requestedBranchId: branchId,
    });
    const session = await getCurrentCashSession({
      branchId,
      cashRegisterCode: req.query.cashRegisterCode || req.query.registerCode || 'CAJA PRINCIPAL',
      branchIds: access.branchIds,
    });

    return res.json({
      ok: true,
      hasOpenSession: Boolean(session),
      session: session ? serializeForAccess(session, access) : null,
      access: { canSupervise: access.canSupervise === true },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/open', requirePermission('pos:sell'), async (req, res) => {
  try {
    const branchId = req.body?.branchId || req.body?.branch;
    assertPosBranchAccess(
      req,
      branchId,
      { requireSell: true }
    );
    const access = buildCashSessionAccess(req, {
      requestedBranchId: branchId,
      requireSell: true,
    });
    const session = await openCashSession(req.body || {}, {
      admin: buildAdminContext(req),
    });

    return res.status(201).json({
      ok: true,
      session: serializeForAccess(session, access),
      message: 'Caja abierta correctamente.',
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/close', requirePermission('pos:sell'), async (req, res) => {
  try {
    const access = buildCashSessionAccess(req, { requireSell: true });
    const session = await closeCashSession(req.params.id, req.body || {}, {
      admin: buildAdminContext(req),
      ...access,
    });

    return res.json({
      ok: true,
      session: serializeForAccess(session, access),
      message: 'Caja cerrada correctamente.',
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/movements', requirePermission('pos:sell'), async (req, res) => {
  try {
    const access = buildCashSessionAccess(req, { requireSell: true });
    const session = await addManualCashMovement(req.params.id, req.body || {}, {
      admin: buildAdminContext(req),
      ...access,
    });
    const outcome = session.$locals.cashMovementOutcome || {};

    return res.status(201).json({
      ok: true,
      session: serializeForAccess(session, access),
      movement: outcome,
      requiresApproval: outcome.approvalRequired === true,
      message: outcome.approvalRequired === true
        ? 'Movimiento enviado a aprobación. Todavía no afecta el efectivo esperado.'
        : 'Movimiento de caja registrado correctamente.',
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/movements/:movementId/review', requirePermission('pos:sell'), async (req, res) => {
  try {
    const access = buildCashSessionAccess(req, { requireSell: true });
    const session = await reviewCashMovement(
      req.params.id,
      req.params.movementId,
      req.body || {},
      {
        admin: buildAdminContext(req),
        ...access,
      }
    );
    const outcome = session.$locals.cashMovementOutcome || {};

    return res.json({
      ok: true,
      session: serializeForAccess(session, access),
      movement: outcome,
      message: outcome.approvalStatus === 'approved'
        ? 'Movimiento aprobado y aplicado a la caja.'
        : 'Movimiento rechazado sin modificar el efectivo esperado.',
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/', requirePermission('pos:view'), async (req, res) => {
  try {
    const requestedBranchId = req.query.branchId || req.query.branch || '';
    const access = buildCashSessionAccess(req, { requestedBranchId });
    const result = await listCashSessions({
      ...(req.query || {}),
      branchIds: access.branchIds,
    });

    return res.json({
      ok: true,
      sessions: result.sessions.map((session) => serializeForAccess(session, access)),
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
    const access = buildCashSessionAccess(req);
    const session = await getCashSessionById(req.params.id, access);

    return res.json({
      ok: true,
      session: serializeForAccess(session, access),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
