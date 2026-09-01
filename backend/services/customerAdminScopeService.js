'use strict';

const mongoose = require('mongoose');

const {
  canAdminSeeAllBranches,
  getAllowedBranchIdsFromRequest,
  getRequestedBranchIdFromQuery,
  normalizeBranchId,
} = require('./orderAdminScopeService');

function appendCustomerBranchScope(filter, branchObjectIds) {
  filter.$and = [
    ...(Array.isArray(filter.$and) ? filter.$and : []),
    {
      $or: [
        { branchIds: { $in: branchObjectIds } },
        { defaultBranch: { $in: branchObjectIds } },
      ],
    },
  ];
  return filter;
}

function getRequestedBranchId(req = {}, explicitValue) {
  if (explicitValue !== undefined) return String(explicitValue || '').trim();
  return getRequestedBranchIdFromQuery(req);
}

function buildCustomerBranchAccess(req = {}, options = {}) {
  const requestedBranchRaw = getRequestedBranchId(
    req,
    options.requestedBranchId
  );
  const requestedBranchId = normalizeBranchId(requestedBranchRaw);

  if (requestedBranchRaw && !requestedBranchId) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_BRANCH_ID',
      message: 'La sede enviada no es válida.',
      branchIds: [],
    };
  }

  if (canAdminSeeAllBranches(req)) {
    return {
      ok: true,
      mode: requestedBranchId ? 'single' : 'all',
      branchIds: requestedBranchId ? [requestedBranchId] : [],
    };
  }

  const allowedBranchIds = getAllowedBranchIdsFromRequest(req);

  if (!allowedBranchIds.length) {
    return {
      ok: false,
      status: 403,
      error: 'NO_BRANCH_ASSIGNED',
      message: 'Tu usuario no tiene sedes asignadas para consultar clientes.',
      branchIds: [],
    };
  }

  if (requestedBranchId && !allowedBranchIds.includes(requestedBranchId)) {
    return {
      ok: false,
      status: 403,
      error: 'BRANCH_FORBIDDEN',
      message: 'No tienes permiso para consultar clientes de esa sede.',
      branchIds: [],
    };
  }

  return {
    ok: true,
    mode: requestedBranchId ? 'single' : 'assigned',
    branchIds: requestedBranchId ? [requestedBranchId] : allowedBranchIds,
  };
}

function buildScopedCustomerFilter(req = {}, baseFilter = {}, options = {}) {
  const filter = { ...baseFilter };
  const access = buildCustomerBranchAccess(req, options);

  if (!access.ok || access.mode === 'all') {
    return { ...access, filter };
  }

  const branchObjectIds = access.branchIds.map(
    (branchId) => new mongoose.Types.ObjectId(branchId)
  );
  appendCustomerBranchScope(filter, branchObjectIds);

  return { ...access, filter };
}

function resolveCustomerWriteBranch(req = {}, requestedBranchValue) {
  const access = buildCustomerBranchAccess(req, {
    requestedBranchId: requestedBranchValue,
  });
  if (!access.ok) return access;

  if (access.mode === 'single') {
    return { ...access, branchId: access.branchIds[0] };
  }

  const defaultBranchId = normalizeBranchId(req.adminDefaultBranch);

  if (access.mode === 'all') {
    return {
      ...access,
      branchId: defaultBranchId || '',
    };
  }

  return {
    ...access,
    branchId:
      (defaultBranchId && access.branchIds.includes(defaultBranchId)
        ? defaultBranchId
        : access.branchIds[0]) || '',
  };
}

function buildScopedFollowUpFilter(req = {}, baseFilter = {}, options = {}) {
  const filter = { ...baseFilter };
  const access = buildCustomerBranchAccess(req, options);

  if (!access.ok || access.mode === 'all') {
    return { ...access, filter };
  }

  filter.branch = {
    $in: access.branchIds.map(
      (branchId) => new mongoose.Types.ObjectId(branchId)
    ),
  };

  return { ...access, filter };
}

module.exports = {
  appendCustomerBranchScope,
  buildCustomerBranchAccess,
  buildScopedCustomerFilter,
  buildScopedFollowUpFilter,
  resolveCustomerWriteBranch,
};
