// backend/services/cashMovementService.js

const mongoose = require('mongoose');

const CashSession = require('../models/CashSession');
const {
  assertCashSessionOperator,
  buildScopedCashSessionFilter,
  createCashError,
  parseCashAmount,
  recalculateCashSession,
  saveCashSession,
} = require('./cashSessionService');

const MOVEMENT_CONFIG = {
  cash_in: { direction: 'in', label: 'Ingreso manual' },
  cash_out: { direction: 'out', label: 'Salida manual' },
  expense: { direction: 'out', label: 'Gasto' },
  withdrawal: { direction: 'out', label: 'Retiro de efectivo' },
  adjustment: { direction: 'neutral', label: 'Ajuste' },
};

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 500) {
  return cleanText(value, max).toLowerCase();
}

function cleanMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}

function toObjectId(value) {
  const id = cleanText(value, 80);
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function buildAdminSnapshot(admin = {}) {
  return {
    username: cleanLower(admin.username || admin.adminUsername || 'admin', 80),
    displayName: cleanText(admin.displayName || admin.fullName || admin.adminDisplayName || admin.username || 'Administrador', 160),
    role: cleanLower(admin.role || admin.adminRole || 'admin', 40),
    adminRole: cleanLower(admin.adminRole || admin.role || 'admin', 40),
  };
}

function resolveMovementConfig(type, direction) {
  const cleanType = cleanLower(type || 'adjustment', 40);
  const config = MOVEMENT_CONFIG[cleanType];

  if (!config) {
    throw createCashError(
      'Tipo de movimiento de caja no válido.',
      'CASH_MOVEMENT_TYPE_INVALID',
      400,
      { type: cleanType }
    );
  }

  if (cleanType !== 'adjustment') return { type: cleanType, direction: config.direction };

  const cleanDirection = cleanLower(direction || 'neutral', 20);
  const allowedDirections = ['in', 'out', 'neutral'];

  return {
    type: cleanType,
    direction: allowedDirections.includes(cleanDirection) ? cleanDirection : 'neutral',
  };
}

function assertMovementDoesNotOverdrawCash(session, { amount, type, direction }) {
  const expectedCash = cleanMoney(session?.expectedCash || 0);
  const isCashOut = direction === 'out';

  if (!isCashOut) return;

  if (amount > expectedCash) {
    throw createCashError(
      'No puedes registrar una salida mayor al efectivo esperado en caja.',
      'CASH_MOVEMENT_EXCEEDS_EXPECTED_CASH',
      409,
      {
        type,
        direction,
        amount,
        expectedCash,
        availableCash: expectedCash,
      }
    );
  }
}

async function addManualCashMovement(sessionId, payload = {}, options = {}) {
  const admin = options.admin || {};
  const session = await CashSession.findOne(
    buildScopedCashSessionFilter(sessionId, options)
  );

  if (!session) {
    throw createCashError(
      'Caja no encontrada dentro de tus sedes autorizadas.',
      'CASH_SESSION_NOT_FOUND',
      404
    );
  }

  if (session.status !== 'open') {
    throw createCashError('Solo se pueden registrar movimientos en una caja abierta.', 'CASH_SESSION_NOT_OPEN', 409);
  }

  const amount = parseCashAmount(payload.amount, {
    required: true,
    allowZero: false,
    field: 'monto del movimiento',
    code: 'CASH_MOVEMENT_AMOUNT_REQUIRED',
  });

  const { type, direction } = resolveMovementConfig(payload.type, payload.direction);
  const reason = cleanText(payload.reason || payload.notes || '', 300);

  if (!reason) {
    throw createCashError('Debes escribir el motivo del movimiento.', 'CASH_MOVEMENT_REASON_REQUIRED', 400);
  }

  const adminObjectId = toObjectId(admin.id || admin._id || admin.adminUserId);
  assertCashSessionOperator(
    session,
    { id: adminObjectId },
    options
  );
  const recalculatedSession = await recalculateCashSession(session);
  assertMovementDoesNotOverdrawCash(recalculatedSession, { amount, type, direction });

  recalculatedSession.addCashMovement({
    type,
    amount,
    direction,
    reason,
    reference: cleanText(payload.reference || '', 120),
    createdBy: adminObjectId || null,
    createdBySnapshot: buildAdminSnapshot(admin),
  });

  await saveCashSession(recalculatedSession);
  return recalculatedSession;
}

module.exports = {
  MOVEMENT_CONFIG,
  addManualCashMovement,
};
