// backend/routes/adminCashSessions.js

const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  serializeCashSession,
  openCashSession,
  closeCashSession,
  reviewCashClosing,
  getCurrentCashSession,
  listCashSessions,
  getCashSessionById,
  getCashVarianceTolerance,
} = require('../services/cashSessionService');
const { buildCashJourneySummary } = require('../services/cashReconciliationService');
const {
  certifyCashJourney,
  getCashJourneyClose,
  serializeJourneyClose,
} = require('../services/cashJourneyCloseService');
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

router.get('/journey-summary', requirePermission('pos:view'), async (req, res) => {
  try {
    const branchId = req.query.branchId || req.query.branch;
    assertPosBranchAccess(req, branchId);
    const access = buildCashSessionAccess(req, { requestedBranchId: branchId });
    if (access.canSupervise !== true) {
      const error = new Error('Solo un supervisor puede consultar el consolidado monetario de caja.');
      error.code = 'CASH_JOURNEY_FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }
    const summary = await buildCashJourneySummary({
      branchId,
      branchIds: access.branchIds,
      range: req.query.range || 'today',
      toleranceAmount: getCashVarianceTolerance(),
    });
    const journeyClose = await getCashJourneyClose({ branchId });
    return res.json({
      ok: true,
      summary: { ...summary, journeyClose: serializeJourneyClose(journeyClose) },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/journey-close', requirePermission('pos:sell'), async (req, res) => {
  try {
    const branchId = req.body?.branchId || req.body?.branch;
    assertPosBranchAccess(req, branchId, { requireSell: true });
    const access = buildCashSessionAccess(req, { requestedBranchId: branchId, requireSell: true });
    if (access.canSupervise !== true) {
      const error = new Error('Solo un supervisor puede certificar el cierre diario de caja.');
      error.code = 'CASH_JOURNEY_CLOSE_FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }
    const outcome = await certifyCashJourney({
      branchId,
      branchIds: access.branchIds,
      notes: req.body?.notes,
      admin: buildAdminContext(req),
    });
    return res.status(outcome.alreadyCertified ? 200 : 201).json({
      ok: true,
      alreadyCertified: outcome.alreadyCertified,
      journeyClose: serializeJourneyClose(outcome.close),
      message: outcome.alreadyCertified
        ? 'La jornada ya estaba certificada.'
        : 'Jornada certificada. El cierre diario quedó protegido contra nuevas aperturas.',
    });
  } catch (error) {
    return sendError(res, error);
  }
});

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

    const outcome = session.$locals.cashClosingOutcome || {};
    return res.status(outcome.requiresApproval === true ? 202 : 200).json({
      ok: true,
      session: serializeForAccess(session, access),
      closing: outcome,
      requiresApproval: outcome.requiresApproval === true,
      message: outcome.requiresApproval === true
        ? 'Arqueo enviado a supervisión. La caja queda congelada hasta la decisión.'
        : 'Caja cerrada correctamente.',
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/closing-reviews/:reviewId/review', requirePermission('pos:sell'), async (req, res) => {
  try {
    const access = buildCashSessionAccess(req, { requireSell: true });
    const session = await reviewCashClosing(req.params.id, req.params.reviewId, req.body || {}, {
      admin: buildAdminContext(req),
      ...access,
    });
    const outcome = session.$locals.cashClosingOutcome || {};
    return res.json({
      ok: true,
      session: serializeForAccess(session, access),
      closing: outcome,
      message: outcome.decision === 'approve'
        ? 'Arqueo aprobado y caja cerrada correctamente.'
        : 'Arqueo rechazado. El cajero puede realizar un nuevo conteo.',
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
