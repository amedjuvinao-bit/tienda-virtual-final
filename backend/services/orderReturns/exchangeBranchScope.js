'use strict';

const {
  createReturnError,
  idValue,
} = require('./normalization');

function assertReplacementOrderBranchScope(
  replacementOrder = {},
  { authorizedBranchIds = [], allowAllBranches = false } = {}
) {
  if (allowAllBranches) return;
  const allowed = new Set(
    (Array.isArray(authorizedBranchIds) ? authorizedBranchIds : [])
      .map(idValue)
      .filter(Boolean)
  );
  const fallbackBranch = idValue(replacementOrder.branch);
  const branchIds = new Set();
  const addBranch = (value) => {
    const branchId = idValue(value) || fallbackBranch;
    if (branchId) branchIds.add(branchId);
  };

  addBranch(replacementOrder.branch);
  for (const allocation of Array.isArray(replacementOrder.inventoryAllocations)
    ? replacementOrder.inventoryAllocations
    : []) {
    addBranch(allocation?.branch);
  }
  for (const shipment of Array.isArray(replacementOrder.fulfillment?.shipments)
    ? replacementOrder.fulfillment.shipments
    : []) {
    addBranch(shipment?.branch);
  }
  for (const branchId of Array.isArray(
    replacementOrder.inventoryAllocationSummary?.branchIds
  )
    ? replacementOrder.inventoryAllocationSummary.branchIds
    : []) {
    addBranch(branchId);
  }

  if (!branchIds.size || [...branchIds].some((branchId) => !allowed.has(branchId))) {
    throw createReturnError(
      'La orden de cambio usa inventario fuera de tus sedes autorizadas.',
      'RETURN_EXCHANGE_BRANCH_FORBIDDEN',
      403
    );
  }
}

module.exports = { assertReplacementOrderBranchScope };
