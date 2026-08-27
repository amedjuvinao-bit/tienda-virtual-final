'use strict';

const mongoose = require('mongoose');

const PRIVILEGED_ORDER_ROLES = new Set([
  'owner',
  'admin',
]);
const BRANCH_CAPABILITIES = new Set([
  'canManageInventory',
  'canInvoice',
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

function normalizeRequiredCapability(value) {
  const capability = String(value || '').trim();
  return BRANCH_CAPABILITIES.has(capability) ? capability : '';
}

function getAssignedBranchPermissions(req = {}) {
  const permissions = new Map();
  const branches = Array.isArray(req.adminBranches) ? req.adminBranches : [];

  for (const item of branches) {
    const branchId = normalizeBranchId(item?.branch || item);
    if (!branchId) continue;
    const current = permissions.get(branchId) || {
      branchId,
      canManageInventory: false,
      canInvoice: false,
    };
    current.canManageInventory =
      current.canManageInventory || item?.canManageInventory === true;
    current.canInvoice = current.canInvoice || item?.canInvoice === true;
    permissions.set(branchId, current);
  }

  return permissions;
}

function getAllowedBranchIdsFromRequest(req = {}, options = {}) {
  const ids = new Set();
  const requiredCapability = normalizeRequiredCapability(
    options.requiredCapability
  );
  const defaultBranchId = normalizeBranchId(req.adminDefaultBranch);
  const assignedPermissions = getAssignedBranchPermissions(req);

  if (
    !requiredCapability &&
    defaultBranchId &&
    assignedPermissions.has(defaultBranchId)
  ) {
    ids.add(defaultBranchId);
  }

  for (const permission of assignedPermissions.values()) {
    if (!requiredCapability || permission[requiredCapability] === true) {
      ids.add(permission.branchId);
    }
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

function appendWholeOrderBranchScope(filter, branchObjectIds) {
  filter.$and = [
    ...(Array.isArray(filter.$and) ? filter.$and : []),
    {
      $and: [
        {
          $or: [
            { branch: { $exists: false } },
            { branch: null },
            { branch: { $in: branchObjectIds } },
          ],
        },
        {
          inventoryAllocations: {
            $not: {
              $elemMatch: { branch: { $nin: branchObjectIds } },
            },
          },
        },
        {
          'fulfillment.shipments': {
            $not: {
              $elemMatch: { branch: { $nin: branchObjectIds } },
            },
          },
        },
      ],
    },
  ];
}

function applyOrderBranchAccessFilter(req, filter = {}, options = {}) {
  const requiredCapability = normalizeRequiredCapability(
    options.requiredCapability
  );
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
      requiredCapability,
      filter,
    };
  }

  const allowedBranchIds = getAllowedBranchIdsFromRequest(req, {
    requiredCapability,
  });

  if (allowedBranchIds.length === 0) {
    return {
      ok: false,
      status: 403,
      error: requiredCapability
        ? 'BRANCH_CAPABILITY_REQUIRED'
        : 'NO_BRANCH_ASSIGNED',
      message: requiredCapability
        ? 'Tu usuario no tiene una sede autorizada para esta operación.'
        : 'Tu usuario no tiene sedes asignadas para consultar órdenes.',
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
  if (options.requireWholeOrder === true) {
    appendWholeOrderBranchScope(filter, branchObjectIds);
  }

  return {
    ok: true,
    mode: requestedBranchId ? 'single' : 'assigned',
    branchIds: branchIdsToUse,
    requiredCapability,
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

async function authorizeOrderAdminScope(
  req,
  orderId,
  OrderModel,
  options = {}
) {
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
    { ...options, requestedBranchId: '' }
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
  appendWholeOrderBranchScope,
  authorizeOrderAdminScope,
  buildScopedOrderFilter,
  canAdminSeeAllBranches,
  getAdminRoleCode,
  getAssignedBranchPermissions,
  getAllowedBranchIdsFromRequest,
  getRequestedBranchIdFromQuery,
  normalizeBranchId,
  normalizeRequiredCapability,
};
