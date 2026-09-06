'use strict';

const {
  canAdminSeeAllBranches,
  getAllowedBranchIdsFromRequest,
  normalizeBranchId,
} = require('./orderAdminScopeService');

function clean(value) {
  return String(value || '').trim();
}

function requestedBranchValue(req = {}, explicitValue) {
  if (explicitValue !== undefined) return clean(explicitValue);
  return clean(
    req.query?.branchId ||
      req.query?.branch ||
      req.body?.branchId ||
      req.body?.branch ||
      ''
  );
}

function createFinanceAccessError(message, code, statusCode, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function resolveFinanceBranchAccess(req = {}, options = {}) {
  const rawRequestedBranch = requestedBranchValue(
    req,
    Object.prototype.hasOwnProperty.call(options, 'requestedBranchId')
      ? options.requestedBranchId
      : undefined
  );
  const requestedBranchId = ['all', 'todas'].includes(
    rawRequestedBranch.toLowerCase()
  )
    ? ''
    : normalizeBranchId(rawRequestedBranch);

  if (
    rawRequestedBranch &&
    !requestedBranchId &&
    !['all', 'todas'].includes(rawRequestedBranch.toLowerCase())
  ) {
    throw createFinanceAccessError(
      'La sede indicada no es válida.',
      'FINANCE_BRANCH_INVALID',
      400,
      { branchId: rawRequestedBranch }
    );
  }

  if (canAdminSeeAllBranches(req)) {
    return {
      mode: requestedBranchId ? 'single' : 'all',
      branchIds: requestedBranchId ? [requestedBranchId] : null,
      requestedBranchId,
    };
  }

  const allowedBranchIds = getAllowedBranchIdsFromRequest(req);
  if (!allowedBranchIds.length) {
    throw createFinanceAccessError(
      'Tu usuario no tiene sedes asignadas para consultar Finanzas.',
      'FINANCE_BRANCH_ASSIGNMENT_REQUIRED',
      403
    );
  }

  if (requestedBranchId && !allowedBranchIds.includes(requestedBranchId)) {
    throw createFinanceAccessError(
      'No tienes acceso financiero a la sede seleccionada.',
      'FINANCE_BRANCH_FORBIDDEN',
      403,
      { branchId: requestedBranchId }
    );
  }

  return {
    mode: requestedBranchId ? 'single' : 'assigned',
    branchIds: requestedBranchId ? [requestedBranchId] : allowedBranchIds,
    requestedBranchId,
  };
}

function resolveFinanceWriteBranch(req = {}, requestedValue) {
  const rawRequestedBranch = requestedBranchValue(req, requestedValue);
  const access = resolveFinanceBranchAccess(req, {
    requestedBranchId: rawRequestedBranch,
  });

  if (access.requestedBranchId) {
    return { ...access, branchId: access.requestedBranchId };
  }

  if (access.mode === 'all') {
    return { ...access, branchId: null };
  }

  const defaultBranchId = normalizeBranchId(req.adminDefaultBranch);
  const branchId =
    (defaultBranchId && access.branchIds.includes(defaultBranchId)
      ? defaultBranchId
      : access.branchIds[0]) || '';

  if (!branchId) {
    throw createFinanceAccessError(
      'Debes seleccionar una sede autorizada para registrar el gasto.',
      'FINANCE_BRANCH_REQUIRED',
      400
    );
  }

  return { ...access, branchId };
}

function financeScopeQuery(req = {}, query = {}) {
  const access = resolveFinanceBranchAccess(req, {
    requestedBranchId: query.branchId || query.branch || '',
  });

  return {
    access,
    query: {
      ...query,
      branchIds: access.branchIds,
    },
  };
}

module.exports = {
  createFinanceAccessError,
  financeScopeQuery,
  resolveFinanceBranchAccess,
  resolveFinanceWriteBranch,
};
