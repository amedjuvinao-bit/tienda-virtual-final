'use strict';

const DEFAULT_LOW_STOCK_LIMIT = 5;
const DEFAULT_STALE_DAYS = 90;
const MAX_RECOMMENDATIONS = 50;

function cleanText(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value = '') {
  return cleanText(value).toLowerCase();
}

function getId(value) {
  return cleanText(value?._id || value?.id || value);
}

function getAvailableStock(row = {}) {
  const explicit = Number(row?.availableStock);

  if (Number.isFinite(explicit)) return Math.max(0, explicit);

  return Math.max(
    0,
    Number(row?.stock || 0) - Number(row?.reservedStock || 0)
  );
}

function getLowStockLimit(row = {}, defaultLimit = DEFAULT_LOW_STOCK_LIMIT) {
  const candidates = [
    row?.reorderPoint,
    row?.product?.reorderPoint,
    row?.productSnapshot?.reorderPoint,
    row?.product?.stockMin,
    row?.productSnapshot?.stockMin,
    defaultLimit,
  ];

  return (
    candidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value > 0) || defaultLimit
  );
}

function getVariantIdentity(row = {}) {
  const variantKey = cleanLower(row?.variantKey);

  if (variantKey) return variantKey;

  const size = cleanLower(row?.variant?.size || row?.size);
  const color = cleanLower(row?.variant?.color || row?.color);
  const attributes = Array.isArray(row?.variant?.attributes)
    ? row.variant.attributes
        .map((attribute) =>
          `${cleanLower(attribute?.key || attribute?.label)}:${cleanLower(attribute?.value)}`
        )
        .filter((value) => value !== ':')
        .sort()
        .join('|')
    : '';

  return attributes || `${size}|${color}`;
}

function getStockIdentity(row = {}) {
  return `${getId(row?.product)}::${getVariantIdentity(row)}`;
}

function getBranchSnapshot(row = {}) {
  return {
    id: getId(row?.branch),
    name: cleanText(row?.branch?.name || row?.branchSnapshot?.name),
    code: cleanText(row?.branch?.code || row?.branchSnapshot?.code),
    type: cleanText(row?.branch?.type || row?.branchSnapshot?.type),
  };
}

function getProductSnapshot(row = {}) {
  return {
    id: getId(row?.product),
    title: cleanText(row?.product?.title || row?.productSnapshot?.title),
    sku: cleanText(row?.product?.sku || row?.productSnapshot?.sku),
    image: cleanText(row?.product?.image || row?.productSnapshot?.image),
  };
}

function getVariantSnapshot(row = {}) {
  return {
    variantKey: cleanText(row?.variantKey),
    label: cleanText(row?.variant?.label),
    size: cleanText(row?.variant?.size || row?.size),
    color: cleanText(row?.variant?.color || row?.color),
    attributes: Array.isArray(row?.variant?.attributes)
      ? row.variant.attributes
      : [],
    sku: cleanText(row?.variant?.sku),
  };
}

function getRequestedReplenishment(row = {}, lowStockLimit = DEFAULT_LOW_STOCK_LIMIT) {
  const configuredQuantity = Number(row?.reorderQty || 0);

  if (Number.isFinite(configuredQuantity) && configuredQuantity > 0) {
    return Math.max(1, Math.floor(configuredQuantity));
  }

  const available = getAvailableStock(row);
  const targetLevel = Math.max(lowStockLimit * 2, lowStockLimit + 1);

  return Math.max(1, Math.ceil(targetLevel - available));
}

function buildTransferRecommendations(stockRows = [], options = {}) {
  const limit = Math.min(
    Math.max(Number(options.limit || MAX_RECOMMENDATIONS), 1),
    MAX_RECOMMENDATIONS
  );
  const activeRows = stockRows.filter(
    (row) => row && row.active !== false && !row.deletedAt
  );
  const rowsByIdentity = new Map();

  activeRows.forEach((row) => {
    const identity = getStockIdentity(row);
    if (!identity || identity.startsWith('::')) return;
    const group = rowsByIdentity.get(identity) || [];
    group.push(row);
    rowsByIdentity.set(identity, group);
  });

  const recommendations = [];
  const allocatedBySource = new Map();
  const targets = [...activeRows].sort((a, b) => {
    const availableA = getAvailableStock(a);
    const availableB = getAvailableStock(b);

    if ((availableA <= 0) !== (availableB <= 0)) {
      return availableA <= 0 ? -1 : 1;
    }

    return availableA - availableB;
  });

  targets.forEach((target) => {
    const targetAvailable = getAvailableStock(target);
    const targetLimit = getLowStockLimit(target);

    if (targetAvailable > targetLimit) return;

    const targetBranch = getBranchSnapshot(target);
    const candidates = (rowsByIdentity.get(getStockIdentity(target)) || [])
      .filter((source) => getId(source) !== getId(target))
      .filter((source) => getBranchSnapshot(source).id !== targetBranch.id)
      .map((source) => {
        const sourceAvailable = getAvailableStock(source);
        const protectedStock = getLowStockLimit(source);
        const sourceId = getId(source);
        const alreadyAllocated = Number(allocatedBySource.get(sourceId) || 0);

        return {
          row: source,
          sourceAvailable,
          protectedStock,
          alreadyAllocated,
          surplus: Math.max(
            0,
            sourceAvailable - protectedStock - alreadyAllocated
          ),
        };
      })
      .filter((candidate) => candidate.surplus > 0)
      .sort((a, b) => b.surplus - a.surplus);

    const bestSource = candidates[0];
    if (!bestSource) return;

    const requestedQuantity = getRequestedReplenishment(target, targetLimit);
    const quantity = Math.min(requestedQuantity, bestSource.surplus);
    if (quantity <= 0) return;

    const sourceBranch = getBranchSnapshot(bestSource.row);
    const product = getProductSnapshot(target);
    const sourceId = getId(bestSource.row);

    allocatedBySource.set(
      sourceId,
      bestSource.alreadyAllocated + quantity
    );

    recommendations.push({
      id: `${sourceId}-${getId(target)}`,
      severity: targetAvailable <= 0 ? 'critical' : 'warning',
      sourceStockId: sourceId,
      destinationStockId: getId(target),
      product,
      variant: getVariantSnapshot(target),
      source: {
        ...sourceBranch,
        availableStock: bestSource.sourceAvailable,
        protectedStock: bestSource.protectedStock,
        remainingAfterTransfer:
          bestSource.sourceAvailable - bestSource.alreadyAllocated - quantity,
      },
      destination: {
        ...targetBranch,
        availableStock: targetAvailable,
        lowStockLimit: targetLimit,
        expectedAvailableStock: targetAvailable + quantity,
      },
      quantity,
      reason: `Reposición sugerida para ${product.title || product.sku || 'producto'} en ${targetBranch.name || 'sede destino'}.`,
    });
  });

  return recommendations
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
      return a.destination.availableStock - b.destination.availableStock;
    })
    .slice(0, limit);
}

function buildStaleStockItems(stockRows = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const staleDays = Math.max(
    Number(options.staleDays || DEFAULT_STALE_DAYS),
    1
  );
  const limit = Math.min(
    Math.max(Number(options.limit || MAX_RECOMMENDATIONS), 1),
    MAX_RECOMMENDATIONS
  );
  const threshold = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);

  return stockRows
    .filter((row) => row && row.active !== false && !row.deletedAt)
    .filter((row) => getAvailableStock(row) > 0)
    .map((row) => {
      const lastActivityValue = row?.lastMovementAt || row?.createdAt;
      const lastActivityAt = lastActivityValue ? new Date(lastActivityValue) : null;

      if (
        !(lastActivityAt instanceof Date) ||
        Number.isNaN(lastActivityAt.getTime()) ||
        lastActivityAt > threshold
      ) {
        return null;
      }

      return {
        id: getId(row),
        type: 'staleStock',
        severity: 'info',
        product: getProductSnapshot(row),
        branch: getBranchSnapshot(row),
        variant: getVariantSnapshot(row),
        availableStock: getAvailableStock(row),
        lastActivityAt,
        inactiveDays: Math.max(
          0,
          Math.floor((now.getTime() - lastActivityAt.getTime()) / 86400000)
        ),
        message: `Este inventario lleva ${Math.max(
          0,
          Math.floor((now.getTime() - lastActivityAt.getTime()) / 86400000)
        )} días sin movimientos aplicados.`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.inactiveDays - a.inactiveDays)
    .slice(0, limit);
}

module.exports = {
  DEFAULT_LOW_STOCK_LIMIT,
  DEFAULT_STALE_DAYS,
  buildStaleStockItems,
  buildTransferRecommendations,
  getAvailableStock,
  getLowStockLimit,
  getStockIdentity,
};
