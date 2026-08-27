'use strict';

const { normalizeBranchId } = require('./orderAdminScopeService');

function createOrderBranchPresentationScope(access = {}) {
  return {
    allowAllBranches: access.mode === 'all',
    authorizedBranchIds: new Set(
      (Array.isArray(access.branchIds) ? access.branchIds : [])
        .map((value) => normalizeBranchId(value))
        .filter(Boolean)
    ),
  };
}

function canPresentBranch(scope, branch, fallbackBranch = null) {
  if (scope?.allowAllBranches) return true;
  const branchId = normalizeBranchId(branch) || normalizeBranchId(fallbackBranch);
  return Boolean(branchId && scope?.authorizedBranchIds?.has(branchId));
}

function filterBranchEntries(entries, scope, fallbackBranch = null) {
  const source = Array.isArray(entries) ? entries : [];
  if (scope?.allowAllBranches) return source;
  return source.filter((entry) =>
    canPresentBranch(scope, entry?.branch, fallbackBranch)
  );
}

function scopeOrderForBranchPresentation(order = {}, scope = {}) {
  if (scope.allowAllBranches) return order;

  const primaryBranchVisible = canPresentBranch(scope, order.branch);
  const fulfillment = order.fulfillment && typeof order.fulfillment === 'object'
    ? {
        ...order.fulfillment,
        shipments: filterBranchEntries(
          order.fulfillment.shipments,
          scope,
          order.branch
        ),
        // El resumen persistido es global a la orden y no es presentable por sede.
        logisticsSummary: null,
      }
    : order.fulfillment;

  return {
    ...order,
    branch: primaryBranchVisible ? order.branch : null,
    branchSnapshot: primaryBranchVisible ? order.branchSnapshot : {},
    inventoryAllocations: filterBranchEntries(
      order.inventoryAllocations,
      scope,
      order.branch
    ),
    // Los acumulados globales permitirían inferir cantidades de otra sede.
    // El consumidor restringido debe calcularlos con las entradas ya filtradas.
    inventoryAllocationSummary: null,
    fulfillment,
  };
}

module.exports = {
  canPresentBranch,
  createOrderBranchPresentationScope,
  filterBranchEntries,
  scopeOrderForBranchPresentation,
};
