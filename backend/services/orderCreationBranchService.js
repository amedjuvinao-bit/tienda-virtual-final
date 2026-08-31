'use strict';

const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const {
  resolveVariantIdentity,
} = require('../lib/products/productVariantConfig');

const ONLINE_INVENTORY_BRANCH_TYPES = Object.freeze([
  'store',
  'warehouse',
  'pickup_point',
]);

const ACTIVE_BRANCH_FILTER = Object.freeze({
  deletedAt: null,
  active: true,
  status: 'active',
});

function clean(value) {
  return String(value || '').trim();
}

function normalizeLocation(value) {
  return clean(value).toLowerCase();
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function buildBranchSnapshot(branch) {
  if (!branch) return { name: '', code: '', type: '' };

  return {
    name: clean(branch.name),
    code: clean(branch.code).toUpperCase(),
    type: clean(branch.type).toLowerCase(),
  };
}

// Compatibilidad para consumidores internos que solo necesitan inspeccionar el
// dato recibido. La resolución autoritativa no usa este valor no confiable.
function getBranchIdFromRequest(rawBody = {}, cleaned = {}) {
  return (
    rawBody.branch ||
    rawBody.branchId ||
    rawBody.defaultBranch ||
    cleaned.branch ||
    cleaned.branchId ||
    cleaned.defaultBranch ||
    ''
  );
}

async function executeLean(query, { session } = {}) {
  let current = query;
  if (session && typeof current?.session === 'function') {
    current = current.session(session);
  }
  if (typeof current?.lean === 'function') current = current.lean();
  return typeof current?.exec === 'function' ? current.exec() : current;
}

async function getDefaultOnlineBranch({
  session,
  BranchModel = Branch,
} = {}) {
  const findOne = async (extraFilter) => {
    const query = BranchModel.findOne({
      ...ACTIVE_BRANCH_FILTER,
      ...extraFilter,
    });
    return executeLean(query, { session });
  };

  return (
    (await findOne({ isDefaultForOnlineOrders: true })) ||
    (await findOne({ isMain: true })) ||
    (await findOne({}))
  );
}

function demandIdentity(item = {}) {
  const productId = clean(item.productId || item.product || item._id);
  const variant = resolveVariantIdentity({
    variantKey: item.variantKey || item.variantId,
    size: item.size,
    color: item.color,
    attributes: item.variantAttributes || item.attributes || [],
  });
  return {
    productId,
    variantKey: variant.variantKey,
    quantity: nonNegativeNumber(item.quantity ?? item.qty ?? 0),
  };
}

function demandKey({ productId, variantKey } = {}) {
  return `${clean(productId)}::${clean(variantKey).toLowerCase()}`;
}

function aggregateDemands(items = []) {
  const demands = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const demand = demandIdentity(item);
    if (!demand.productId || demand.quantity <= 0) continue;
    const key = demandKey(demand);
    const previous = demands.get(key) || { ...demand, quantity: 0 };
    previous.quantity += demand.quantity;
    demands.set(key, previous);
  }
  return demands;
}

function availableFromStock(stock = {}) {
  return Math.max(
    0,
    nonNegativeNumber(stock.stock) - nonNegativeNumber(stock.reservedStock)
  );
}

function buildAvailabilityByBranch(stocks = [], demands = new Map()) {
  const availability = new Map();
  for (const stock of Array.isArray(stocks) ? stocks : []) {
    const identity = demandIdentity({
      productId: stock.product,
      variantKey: stock.variantKey,
      size: stock.size || stock.variant?.size,
      color: stock.color || stock.variant?.color,
      variantAttributes: stock.variant?.attributes || [],
      quantity: 1,
    });
    const key = demandKey(identity);
    const available = availableFromStock(stock);
    const branchId = clean(stock.branch);
    if (!branchId || available <= 0 || !demands.has(key)) continue;
    if (!availability.has(branchId)) availability.set(branchId, new Map());
    const branchAvailability = availability.get(branchId);
    branchAvailability.set(key, (branchAvailability.get(key) || 0) + available);
  }
  return availability;
}

function coverageScore(branch = {}, cleaned = {}) {
  const destination = {
    ...(cleaned.billing || {}),
    ...(cleaned.customer || {}),
  };
  const origin = branch.address || {};
  const destinationCityCode = normalizeLocation(
    destination.municipalityCode ||
      destination.municipalityId ||
      destination.cityCode
  );
  const originCityCode = normalizeLocation(origin.cityCode);
  if (destinationCityCode && destinationCityCode === originCityCode) return 4;

  const destinationCity = normalizeLocation(destination.city);
  const originCity = normalizeLocation(origin.city);
  if (destinationCity && destinationCity === originCity) return 3;

  const destinationDepartmentCode = normalizeLocation(
    destination.departmentCode
  );
  const originDepartmentCode = normalizeLocation(origin.departmentCode);
  if (
    destinationDepartmentCode &&
    destinationDepartmentCode === originDepartmentCode
  ) {
    return 2;
  }

  const destinationDepartment = normalizeLocation(destination.department);
  const originDepartment = normalizeLocation(origin.department);
  return destinationDepartment && destinationDepartment === originDepartment
    ? 1
    : 0;
}

function buildBranchCandidate(branch, branchAvailability, demands, cleaned) {
  let coveredUnits = 0;
  let fullyFulfills = true;
  for (const [key, demand] of demands) {
    const available = Number(branchAvailability.get(key) || 0);
    coveredUnits += Math.min(demand.quantity, available);
    if (available < demand.quantity) fullyFulfills = false;
  }
  return {
    branch,
    branchId: clean(branch._id),
    coveredUnits,
    fullyFulfills,
    coverage: coverageScore(branch, cleaned),
  };
}

function sortCandidates(left, right) {
  if (left.fullyFulfills !== right.fullyFulfills) {
    return left.fullyFulfills ? -1 : 1;
  }
  if (left.coverage !== right.coverage) return right.coverage - left.coverage;
  if (
    left.branch.isDefaultForOnlineOrders !==
    right.branch.isDefaultForOnlineOrders
  ) {
    return left.branch.isDefaultForOnlineOrders ? -1 : 1;
  }
  if (left.branch.isMain !== right.branch.isMain) {
    return left.branch.isMain ? -1 : 1;
  }
  if (left.coveredUnits !== right.coveredUnits) {
    return right.coveredUnits - left.coveredUnits;
  }
  return clean(left.branch.code || left.branch.name || left.branchId).localeCompare(
    clean(right.branch.code || right.branch.name || right.branchId)
  );
}

function createInsufficientStockError(demands, availability, eligibleIds) {
  const insufficientItems = [];
  for (const [key, demand] of demands) {
    const available = eligibleIds.reduce(
      (total, branchId) => total + Number(availability.get(branchId)?.get(key) || 0),
      0
    );
    if (available < demand.quantity) {
      insufficientItems.push({
        productId: demand.productId,
        variantKey: demand.variantKey,
        requestedQuantity: demand.quantity,
        missingQuantity: demand.quantity - available,
      });
    }
  }
  if (!insufficientItems.length) return null;
  return Object.assign(
    new Error('No hay inventario elegible para completar la compra.'),
    {
      code: 'INSUFFICIENT_STOCK',
      statusCode: 409,
      details: { reason: 'NO_ELIGIBLE_BRANCH_STOCK', insufficientItems },
    }
  );
}

async function resolveInventoryBranchData({
  cleaned,
  reservableItems,
  session,
  BranchModel,
  InventoryStockModel,
}) {
  const demands = aggregateDemands(reservableItems);
  const productIds = [...new Set([...demands.values()].map((item) => item.productId))];
  const stockQuery = InventoryStockModel.find({
    product: { $in: productIds },
    active: true,
    deletedAt: null,
  }).select('product branch stock reservedStock variantKey size color variant');
  const stocks = await executeLean(stockQuery, { session });
  const availability = buildAvailabilityByBranch(stocks, demands);
  const stockedBranchIds = [...availability.keys()];

  const branchQuery = BranchModel.find({
    ...ACTIVE_BRANCH_FILTER,
    _id: { $in: stockedBranchIds },
    type: { $in: ONLINE_INVENTORY_BRANCH_TYPES },
    'settings.allowInventoryMovements': { $ne: false },
  }).select('name code type isMain isDefaultForOnlineOrders address settings');
  const branches = await executeLean(branchQuery, { session });
  const candidates = (Array.isArray(branches) ? branches : [])
    .map((branch) =>
      buildBranchCandidate(
        branch,
        availability.get(clean(branch._id)) || new Map(),
        demands,
        cleaned
      )
    )
    .filter((candidate) => candidate.coveredUnits > 0)
    .sort(sortCandidates);
  const eligibleBranchIds = candidates.map((candidate) => candidate.branchId);
  const stockError = createInsufficientStockError(
    demands,
    availability,
    eligibleBranchIds
  );
  if (stockError) throw stockError;

  const selected = candidates[0];
  return {
    branchId: selected?.branch?._id || null,
    branchSnapshot: buildBranchSnapshot(selected?.branch),
    branchPriorityIds: eligibleBranchIds,
    eligibleBranchIds,
    selectionReason: selected?.fullyFulfills
      ? 'single_branch_stock'
      : 'multi_branch_stock',
  };
}

async function resolveOrderBranchData(
  _rawBody = {},
  cleaned = {},
  {
    session,
    reservableItems = [],
    BranchModel = Branch,
    InventoryStockModel = InventoryStock,
  } = {}
) {
  if (Array.isArray(reservableItems) && reservableItems.length > 0) {
    return resolveInventoryBranchData({
      cleaned,
      reservableItems,
      session,
      BranchModel,
      InventoryStockModel,
    });
  }

  const branch = await getDefaultOnlineBranch({ session, BranchModel });
  const branchId = branch?._id || null;
  return {
    branchId,
    branchSnapshot: buildBranchSnapshot(branch),
    branchPriorityIds: branchId ? [clean(branchId)] : [],
    eligibleBranchIds: branchId ? [clean(branchId)] : [],
    selectionReason: branchId ? 'online_default' : 'not_required',
  };
}

module.exports = {
  ACTIVE_BRANCH_FILTER,
  ONLINE_INVENTORY_BRANCH_TYPES,
  aggregateDemands,
  buildBranchSnapshot,
  getBranchIdFromRequest,
  getDefaultOnlineBranch,
  resolveOrderBranchData,
};
