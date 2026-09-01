'use strict';

const mongoose = require('mongoose');

const PRIVILEGED_POS_ROLES = new Set(['owner', 'admin']);
const CASH_SUPERVISOR_ROLES = new Set(['owner', 'admin', 'manager']);

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeBranchId(value, visited = new Set()) {
  if (!value) return '';

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString();
  }

  if (typeof value === 'object') {
    if (visited.has(value)) return '';
    visited.add(value);

    for (const key of ['branch', '_id', 'id']) {
      const nested = value[key];
      if (!nested || nested === value) continue;
      const normalized = normalizeBranchId(nested, visited);
      if (normalized) return normalized;
    }
  }

  const candidate = cleanText(value);
  return mongoose.Types.ObjectId.isValid(candidate) ? candidate : '';
}

function getAdminRole(req = {}) {
  return cleanText(
    req.adminRole ||
      req.adminProfile?.adminRole ||
      req.adminProfile?.actualRole ||
      ''
  ).toLowerCase();
}

function canAccessAllPosBranches(req = {}) {
  return (
    req.adminAuthType !== 'legacy' &&
    PRIVILEGED_POS_ROLES.has(getAdminRole(req))
  );
}

function getAssignedPosBranches(req = {}) {
  const result = new Map();
  const assignments = Array.isArray(req.adminBranches) ? req.adminBranches : [];

  for (const assignment of assignments) {
    const branchId = normalizeBranchId(assignment?.branch || assignment);
    if (!branchId) continue;

    const previous = result.get(branchId) || {
      branchId,
      canSell: false,
      canInvoice: false,
    };

    const isStructured = Boolean(
      assignment && typeof assignment === 'object' && !Array.isArray(assignment)
    );

    previous.canSell =
      previous.canSell || !isStructured || assignment.canSell === true;
    previous.canInvoice =
      previous.canInvoice || !isStructured || assignment.canInvoice === true;

    result.set(branchId, previous);
  }

  return result;
}

function getAllowedPosBranchIds(req = {}, options = {}) {
  if (canAccessAllPosBranches(req)) return [];

  const requireSell = options.requireSell === true;
  const requireInvoice = options.requireInvoice === true;

  return [...getAssignedPosBranches(req).values()]
    .filter((assignment) => !requireSell || assignment.canSell === true)
    .filter((assignment) => !requireInvoice || assignment.canInvoice === true)
    .map((assignment) => assignment.branchId);
}

function createPosAccessError(
  message,
  code = 'POS_BRANCH_FORBIDDEN',
  statusCode = 403,
  details = {}
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function resolvePosBranchScope(req = {}, options = {}) {
  const rawRequestedBranchId = cleanText(options.requestedBranchId || '');
  const requestedBranchId = rawRequestedBranchId
    ? normalizeBranchId(rawRequestedBranchId)
    : '';

  if (rawRequestedBranchId && !requestedBranchId) {
    throw createPosAccessError(
      'La sede indicada no es válida.',
      'POS_BRANCH_INVALID',
      400,
      { branchId: rawRequestedBranchId }
    );
  }

  if (canAccessAllPosBranches(req)) {
    return {
      allBranches: true,
      branchIds: requestedBranchId ? [requestedBranchId] : [],
      requestedBranchId,
    };
  }

  const allowedBranchIds = getAllowedPosBranchIds(req, options);

  if (allowedBranchIds.length === 0) {
    throw createPosAccessError(
      options.requireSell === true
        ? 'Tu usuario no tiene una sede autorizada para realizar ventas POS.'
        : 'Tu usuario no tiene sedes asignadas para consultar el POS.',
      options.requireSell === true
        ? 'POS_BRANCH_SELL_REQUIRED'
        : 'POS_BRANCH_ASSIGNMENT_REQUIRED',
      403
    );
  }

  if (requestedBranchId && !allowedBranchIds.includes(requestedBranchId)) {
    throw createPosAccessError(
      'No tienes acceso a la sede seleccionada.',
      'POS_BRANCH_FORBIDDEN',
      403,
      { branchId: requestedBranchId }
    );
  }

  return {
    allBranches: false,
    branchIds: requestedBranchId ? [requestedBranchId] : allowedBranchIds,
    requestedBranchId,
  };
}

function assertPosBranchAccess(req, branchId, options = {}) {
  const normalizedBranchId = normalizeBranchId(branchId);
  if (!normalizedBranchId) {
    throw createPosAccessError(
      'Debes seleccionar una sede válida.',
      'POS_BRANCH_REQUIRED',
      400
    );
  }

  resolvePosBranchScope(req, {
    ...options,
    requestedBranchId: normalizedBranchId,
  });

  return normalizedBranchId;
}

function buildPosBranchFilter(req, extra = {}, options = {}) {
  const scope = resolvePosBranchScope(req, options);
  const filter = {
    deletedAt: null,
    active: true,
    status: 'active',
    ...extra,
  };

  if (!scope.allBranches || scope.requestedBranchId) {
    filter._id = {
      $in: scope.branchIds.map((branchId) =>
        new mongoose.Types.ObjectId(branchId)
      ),
    };
  }

  return filter;
}

function canSuperviseCashSession(req = {}) {
  return (
    req.adminAuthType !== 'legacy' &&
    CASH_SUPERVISOR_ROLES.has(getAdminRole(req))
  );
}

function buildPosResourceAccess(req = {}, options = {}) {
  const scope = resolvePosBranchScope(req, options);

  return {
    branchIds: scope.allBranches && !scope.requestedBranchId
      ? null
      : scope.branchIds,
  };
}

function buildCashSessionAccess(req = {}, options = {}) {
  return {
    ...buildPosResourceAccess(req, options),
    canSupervise: canSuperviseCashSession(req),
  };
}

module.exports = {
  PRIVILEGED_POS_ROLES,
  CASH_SUPERVISOR_ROLES,
  assertPosBranchAccess,
  buildCashSessionAccess,
  buildPosBranchFilter,
  buildPosResourceAccess,
  canAccessAllPosBranches,
  canSuperviseCashSession,
  createPosAccessError,
  getAdminRole,
  getAllowedPosBranchIds,
  getAssignedPosBranches,
  normalizeBranchId,
  resolvePosBranchScope,
};
