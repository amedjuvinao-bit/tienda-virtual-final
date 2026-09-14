'use strict';

const mongoose = require('mongoose');

const {
  canAdminSeeAllBranches,
  getAllowedBranchIdsFromRequest,
  getRequestedBranchIdFromQuery,
  normalizeBranchId,
} = require('./orderAdminScopeService');

function buildInventoryBranchAccess(req = {}, options = {}) {
  const requestedBranchRaw = Object.prototype.hasOwnProperty.call(
    options,
    'requestedBranchId'
  )
    ? String(options.requestedBranchId || '').trim()
    : getRequestedBranchIdFromQuery(req);
  const requestedBranchId = normalizeBranchId(requestedBranchRaw);
  const requireManage = options.requireManage === true;

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
      requireManage,
    };
  }

  const allowedBranchIds = getAllowedBranchIdsFromRequest(req, {
    requiredCapability: requireManage ? 'canManageInventory' : '',
  });

  if (!allowedBranchIds.length) {
    return {
      ok: false,
      status: 403,
      error: requireManage
        ? 'INVENTORY_BRANCH_MANAGEMENT_REQUIRED'
        : 'INVENTORY_BRANCH_ASSIGNMENT_REQUIRED',
      message: requireManage
        ? 'Tu usuario no tiene una sede autorizada para administrar inventario.'
        : 'Tu usuario no tiene sedes asignadas para consultar inventario.',
      branchIds: [],
    };
  }

  if (requestedBranchId && !allowedBranchIds.includes(requestedBranchId)) {
    return {
      ok: false,
      status: 403,
      error: 'INVENTORY_BRANCH_FORBIDDEN',
      message: requireManage
        ? 'No tienes permiso para administrar inventario de esa sede.'
        : 'No tienes permiso para consultar inventario de esa sede.',
      branchIds: [],
    };
  }

  return {
    ok: true,
    mode: requestedBranchId ? 'single' : 'assigned',
    branchIds: requestedBranchId ? [requestedBranchId] : allowedBranchIds,
    requireManage,
  };
}

function toObjectIds(branchIds = []) {
  return branchIds.map((branchId) => new mongoose.Types.ObjectId(branchId));
}

function appendAndClause(filter, clause) {
  filter.$and = [
    ...(Array.isArray(filter.$and) ? filter.$and : []),
    clause,
  ];
  return filter;
}

function buildScopedInventoryStockFilter(req = {}, baseFilter = {}, options = {}) {
  const filter = { ...baseFilter };
  const access = buildInventoryBranchAccess(req, options);

  if (!access.ok || access.mode === 'all') return { ...access, filter };

  filter.branch = { $in: toObjectIds(access.branchIds) };
  return { ...access, filter };
}

function buildScopedInventoryReservationFilter(
  req = {},
  baseFilter = {},
  options = {}
) {
  const filter = { ...baseFilter };
  const access = buildInventoryBranchAccess(req, options);

  if (!access.ok || access.mode === 'all') return { ...access, filter };

  const branchObjectIds = toObjectIds(access.branchIds);
  appendAndClause(filter, {
    'items.branch': { $in: branchObjectIds },
  });
  appendAndClause(filter, {
    items: {
      $not: {
        $elemMatch: {
          branch: { $nin: branchObjectIds },
        },
      },
    },
  });
  return { ...access, filter };
}

function buildScopedInventoryMovementFilter(
  req = {},
  baseFilter = {},
  options = {}
) {
  const filter = { ...baseFilter };
  const access = buildInventoryBranchAccess(req, options);

  if (!access.ok || access.mode === 'all') return { ...access, filter };

  const branchObjectIds = toObjectIds(access.branchIds);
  appendAndClause(filter, {
    $and: [
      {
        $or: [
          { branchFrom: { $in: branchObjectIds } },
          { branchTo: { $in: branchObjectIds } },
        ],
      },
      {
        $or: [
          { branchFrom: { $exists: false } },
          { branchFrom: null },
          { branchFrom: { $in: branchObjectIds } },
        ],
      },
      {
        $or: [
          { branchTo: { $exists: false } },
          { branchTo: null },
          { branchTo: { $in: branchObjectIds } },
        ],
      },
    ],
  });

  return { ...access, filter };
}

function getMovementBranchIds(payload = {}) {
  const values = [
    payload.branchFrom,
    payload.branchTo,
    payload.branch,
    payload.branchId,
  ];

  return [
    ...new Set(values.map((value) => normalizeBranchId(value)).filter(Boolean)),
  ];
}

function assertInventoryBranchesAccess(req = {}, branchValues = [], options = {}) {
  const branchIds = [
    ...new Set(
      branchValues.map((value) => normalizeBranchId(value)).filter(Boolean)
    ),
  ];

  if (!branchIds.length) {
    return {
      ok: false,
      status: 400,
      error: 'INVENTORY_BRANCH_REQUIRED',
      message: 'Debes seleccionar una sede válida para la operación de inventario.',
      branchIds: [],
    };
  }

  if (canAdminSeeAllBranches(req)) {
    return {
      ok: true,
      mode: 'all',
      branchIds,
      requireManage: options.requireManage === true,
    };
  }

  const requireManage = options.requireManage === true;
  const allowedBranchIds = getAllowedBranchIdsFromRequest(req, {
    requiredCapability: requireManage ? 'canManageInventory' : '',
  });
  const forbiddenBranchIds = branchIds.filter(
    (branchId) => !allowedBranchIds.includes(branchId)
  );

  if (forbiddenBranchIds.length) {
    return {
      ok: false,
      status: 403,
      error: 'INVENTORY_BRANCH_FORBIDDEN',
      message: requireManage
        ? 'No tienes permiso para administrar inventario en todas las sedes seleccionadas.'
        : 'No tienes permiso para consultar inventario en todas las sedes seleccionadas.',
      branchIds: [],
      forbiddenBranchIds,
    };
  }

  return {
    ok: true,
    mode: 'assigned',
    branchIds,
    requireManage,
  };
}

function assertInventoryMovementAccess(req = {}, payload = {}, options = {}) {
  return assertInventoryBranchesAccess(
    req,
    getMovementBranchIds(payload),
    options
  );
}

module.exports = {
  appendAndClause,
  assertInventoryBranchesAccess,
  assertInventoryMovementAccess,
  buildInventoryBranchAccess,
  buildScopedInventoryMovementFilter,
  buildScopedInventoryReservationFilter,
  buildScopedInventoryStockFilter,
  getMovementBranchIds,
};
