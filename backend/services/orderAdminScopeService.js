'use strict';

const mongoose = require('mongoose');

const PRIVILEGED_ORDER_ROLES = new Set([
  'owner',
  'admin',
]);

function normalizeBranchId(value, visited = new Set()) {
  if (!value) return '';

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString();
  }

  if (typeof value === 'object') {
    if (visited.has(value)) return '';
    visited.add(value);

    for (const key of ['_id', 'id', 'branch']) {
      const nestedValue = value[key];

      // Los ObjectId de BSON exponen un getter `_id` que devuelve el mismo
      // objeto. Ignorarlo evita una recursión infinita sin relajar el alcance.
      if (!nestedValue || nestedValue === value) continue;

      const normalized = normalizeBranchId(nestedValue, visited);
      if (normalized) return normalized;
    }
  }

  const id = String(value || '').trim();
  return mongoose.Types.ObjectId.isValid(id) ? id : '';
}

function getAdminRoleCode(req = {}) {
  return String(
    req.adminRole ||
      req.adminProfile?.adminRole ||
      req.adminProfile?.actualRole ||
      req.user?.role ||
      ''
  )
    .trim()
    .toLowerCase();
}

function canAdminSeeAllBranches(req = {}) {
  return PRIVILEGED_ORDER_ROLES.has(getAdminRoleCode(req));
}

function getAllowedBranchIdsFromRequest(req = {}) {
  const ids = new Set();
  const defaultBranchId = normalizeBranchId(req.adminDefaultBranch);

  if (defaultBranchId) ids.add(defaultBranchId);

  const branches = Array.isArray(req.adminBranches) ? req.adminBranches : [];

  for (const item of branches) {
    const branchId = normalizeBranchId(item?.branch || item);
    if (branchId) ids.add(branchId);
  }

  return Array.from(ids);
}

function getRequestedBranchIdFromQuery(req = {}) {
  const raw =
    req.query?.branchId ||
    req.query?.branch ||
    req.query?.sedeId ||
    req.query?.sede ||
    '';
  const value = String(raw || '').trim();

  if (!value || ['all', 'todas'].includes(value.toLowerCase())) return '';
  return value;
}

function appendBranchScope(filter, branchObjectIds) {
  filter.$and = [
    ...(Array.isArray(filter.$and) ? filter.$and : []),
    {
      $or: [
        { branch: { $in: branchObjectIds } },
        { 'inventoryAllocations.branch': { $in: branchObjectIds } },
      ],
    },
  ];
}

function applyOrderBranchAccessFilter(req, filter = {}, options = {}) {
  const requestedBranchRaw = Object.prototype.hasOwnProperty.call(
    options,
    'requestedBranchId'
  )
    ? String(options.requestedBranchId || '').trim()
    : getRequestedBranchIdFromQuery(req);
  const requestedBranchId = normalizeBranchId(requestedBranchRaw);

  if (requestedBranchRaw && !requestedBranchId) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_BRANCH_ID',
      message: 'La sede enviada no es válida.',
    };
  }

  if (canAdminSeeAllBranches(req)) {
    if (requestedBranchId) {
      appendBranchScope(filter, [new mongoose.Types.ObjectId(requestedBranchId)]);
    }

    return {
      ok: true,
      mode: requestedBranchId ? 'single' : 'all',
      branchIds: requestedBranchId ? [requestedBranchId] : [],
      filter,
    };
  }

  const allowedBranchIds = getAllowedBranchIdsFromRequest(req);

  if (allowedBranchIds.length === 0) {
    return {
      ok: false,
      status: 403,
      error: 'NO_BRANCH_ASSIGNED',
      message: 'Tu usuario no tiene sedes asignadas para consultar órdenes.',
    };
  }

  if (requestedBranchId && !allowedBranchIds.includes(requestedBranchId)) {
    return {
      ok: false,
      status: 403,
      error: 'BRANCH_FORBIDDEN',
      message: 'No tienes permiso para consultar órdenes de esa sede.',
    };
  }

  const branchIdsToUse = requestedBranchId
    ? [requestedBranchId]
    : allowedBranchIds;
  const branchObjectIds = branchIdsToUse.map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  appendBranchScope(filter, branchObjectIds);

  return {
    ok: true,
    mode: requestedBranchId ? 'single' : 'assigned',
    branchIds: branchIdsToUse,
    filter,
  };
}

function buildScopedOrderFilter(req, baseFilter = {}, options = {}) {
  const filter = { ...baseFilter };
  const access = applyOrderBranchAccessFilter(req, filter, options);

  return {
    ...access,
    filter,
  };
}

async function authorizeOrderAdminScope(req, orderId, OrderModel) {
  const normalizedOrderId = normalizeBranchId(orderId);

  if (!normalizedOrderId) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_ORDER_ID',
      message: 'El identificador de la orden no es válido.',
      filter: null,
    };
  }

  if (!OrderModel || typeof OrderModel.exists !== 'function') {
    throw new TypeError('authorizeOrderAdminScope requiere un modelo de órdenes.');
  }

  const access = buildScopedOrderFilter(
    req,
    { _id: new mongoose.Types.ObjectId(normalizedOrderId) },
    { requestedBranchId: '' }
  );

  if (!access.ok) return access;

  const exists = await OrderModel.exists(access.filter);

  if (!exists) {
    return {
      ...access,
      ok: false,
      status: 404,
      error: 'ORDER_NOT_FOUND',
      message: 'Orden no encontrada dentro de tus sedes autorizadas.',
    };
  }

  return access;
}

module.exports = {
  applyOrderBranchAccessFilter,
  authorizeOrderAdminScope,
  buildScopedOrderFilter,
  canAdminSeeAllBranches,
  getAdminRoleCode,
  getAllowedBranchIdsFromRequest,
  getRequestedBranchIdFromQuery,
  normalizeBranchId,
};
