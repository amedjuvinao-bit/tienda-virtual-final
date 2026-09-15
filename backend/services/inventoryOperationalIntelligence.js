'use strict';

const DEFAULT_LOW_STOCK_LIMIT = 5;
const DEFAULT_STALE_DAYS = 90;
const DEFAULT_COVERAGE_WINDOW_DAYS = 30;
const DEFAULT_STUCK_RESERVATION_MINUTES = 30;
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

function getStockLocationIdentity(row = {}, branchField = 'branch') {
  return `${getId(row?.[branchField])}::${getStockIdentity(row)}`;
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
    label: cleanText(row?.variant?.label || row?.variantLabel),
    size: cleanText(row?.variant?.size || row?.size),
    color: cleanText(row?.variant?.color || row?.color),
    attributes: Array.isArray(row?.variant?.attributes)
      ? row.variant.attributes
      : Array.isArray(row?.variantAttributes)
        ? row.variantAttributes
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

function buildCoverageEstimates(stockRows = [], movementRows = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const windowDays = Math.max(
    Number(options.windowDays || DEFAULT_COVERAGE_WINDOW_DAYS),
    1
  );
  const limit = Math.min(
    Math.max(Number(options.limit || MAX_RECOMMENDATIONS), 1),
    MAX_RECOMMENDATIONS
  );
  const threshold = new Date(now.getTime() - windowDays * 86400000);
  const quantityByStock = new Map();

  movementRows
    .filter((movement) => movement?.status === 'posted')
    .filter((movement) => movement?.type === 'sale_out')
    .filter((movement) => {
      const value = movement?.postedAt || movement?.createdAt;
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) && date >= threshold && date <= now;
    })
    .forEach((movement) => {
      const identity = getStockLocationIdentity(movement, 'branchFrom');
      const quantity = Math.max(0, Number(movement?.quantity || 0));
      quantityByStock.set(identity, Number(quantityByStock.get(identity) || 0) + quantity);
    });

  return stockRows
    .filter((row) => row && row.active !== false && !row.deletedAt)
    .map((row) => {
      const soldQuantity = Number(
        quantityByStock.get(getStockLocationIdentity(row)) || 0
      );

      if (soldQuantity <= 0) return null;

      const availableStock = getAvailableStock(row);
      const dailyDemand = soldQuantity / windowDays;
      const coverageDays = dailyDemand > 0
        ? Math.round((availableStock / dailyDemand) * 10) / 10
        : null;
      const status = availableStock <= 0 || coverageDays < 7
        ? 'critical'
        : coverageDays < 14
          ? 'warning'
          : 'healthy';

      return {
        id: getId(row),
        type: 'coverage',
        severity: status,
        product: getProductSnapshot(row),
        branch: getBranchSnapshot(row),
        variant: getVariantSnapshot(row),
        availableStock,
        soldQuantity,
        windowDays,
        dailyDemand: Math.round(dailyDemand * 100) / 100,
        coverageDays,
        message: coverageDays < 7
          ? `La existencia cubre aproximadamente ${coverageDays} día(s) al ritmo reciente.`
          : `Cobertura estimada de ${coverageDays} día(s) según las ventas recientes.`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.coverageDays - b.coverageDays)
    .slice(0, limit);
}

function buildStuckReservationItems(reservations = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const thresholdMinutes = Math.max(
    Number(
      options.thresholdMinutes || DEFAULT_STUCK_RESERVATION_MINUTES
    ),
    1
  );
  const limit = Math.min(
    Math.max(Number(options.limit || MAX_RECOMMENDATIONS), 1),
    MAX_RECOMMENDATIONS
  );

  return reservations
    .filter((reservation) => reservation?.status === 'pending')
    .map((reservation) => {
      const createdAt = reservation?.createdAt
        ? new Date(reservation.createdAt)
        : null;
      const expiresAt = reservation?.expiresAt
        ? new Date(reservation.expiresAt)
        : null;

      if (!createdAt || Number.isNaN(createdAt.getTime())) return null;

      const ageMinutes = Math.max(
        0,
        Math.floor((now.getTime() - createdAt.getTime()) / 60000)
      );
      const overdue = Boolean(
        expiresAt &&
        !Number.isNaN(expiresAt.getTime()) &&
        expiresAt <= now
      );

      if (!overdue && ageMinutes < thresholdMinutes) return null;

      const firstItem = Array.isArray(reservation?.items)
        ? reservation.items[0]
        : null;

      return {
        id: getId(reservation),
        type: 'stuckReservation',
        severity: overdue ? 'critical' : 'warning',
        reservationCode: cleanText(reservation?.reservationCode),
        orderNumber: cleanText(reservation?.orderNumber),
        totalQuantity: Number(reservation?.totalQuantity || 0),
        createdAt,
        expiresAt,
        ageMinutes,
        overdue,
        product: getProductSnapshot(firstItem),
        branch: getBranchSnapshot(firstItem),
        variant: getVariantSnapshot(firstItem),
        message: overdue
          ? 'La reserva sigue pendiente después de su vencimiento.'
          : `La reserva lleva ${ageMinutes} minutos pendiente.`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return b.ageMinutes - a.ageMinutes;
    })
    .slice(0, limit);
}

function buildInventoryAnomalies(stockRows = [], movementRows = [], options = {}) {
  const limit = Math.min(
    Math.max(Number(options.limit || MAX_RECOMMENDATIONS), 1),
    MAX_RECOMMENDATIONS
  );
  const anomalies = [];

  stockRows
    .filter((row) => row && row.active !== false && !row.deletedAt)
    .forEach((row) => {
      const physicalStock = Number(row?.stock || 0);
      const reservedStock = Number(row?.reservedStock || 0);
      const availableStock = Number(row?.availableStock || 0);
      const expectedAvailable = Math.max(0, physicalStock - reservedStock);
      const base = {
        id: `stock-${getId(row)}`,
        product: getProductSnapshot(row),
        branch: getBranchSnapshot(row),
        variant: getVariantSnapshot(row),
      };

      if (reservedStock > physicalStock) {
        anomalies.push({
          ...base,
          code: 'RESERVED_EXCEEDS_PHYSICAL',
          severity: 'critical',
          message: 'El stock reservado supera el stock físico.',
        });
      } else if (Math.abs(availableStock - expectedAvailable) > 0.001) {
        anomalies.push({
          ...base,
          code: 'AVAILABLE_MISMATCH',
          severity: 'critical',
          message: `El disponible registrado (${availableStock}) no coincide con el esperado (${expectedAvailable}).`,
        });
      }

      if (!getId(row?.product) || !getBranchSnapshot(row).id) {
        anomalies.push({
          ...base,
          code: 'ORPHAN_STOCK',
          severity: 'warning',
          message: 'La existencia no conserva una relación válida con producto o sede.',
        });
      }
    });

  movementRows
    .filter((movement) => movement?.status === 'posted')
    .forEach((movement) => {
      const source = getBranchSnapshot({
        branch: movement?.branchFrom,
        branchSnapshot: movement?.branchFromSnapshot,
      });
      const destination = getBranchSnapshot({
        branch: movement?.branchTo,
        branchSnapshot: movement?.branchToSnapshot,
      });
      const movementId = getId(movement);

      if (!movement?.postedAt) {
        anomalies.push({
          id: `movement-posted-${movementId}`,
          code: 'POSTED_WITHOUT_DATE',
          severity: 'warning',
          movementNumber: cleanText(movement?.movementNumber),
          product: getProductSnapshot(movement),
          branch: source.id ? source : destination,
          variant: getVariantSnapshot(movement),
          message: 'El movimiento figura aplicado, pero no tiene fecha de aplicación.',
        });
      }

      if (
        movement?.type === 'transfer' &&
        (!source.id || !destination.id || source.id === destination.id)
      ) {
        anomalies.push({
          id: `movement-route-${movementId}`,
          code: 'INVALID_TRANSFER_ROUTE',
          severity: 'critical',
          movementNumber: cleanText(movement?.movementNumber),
          product: getProductSnapshot(movement),
          branch: source.id ? source : destination,
          variant: getVariantSnapshot(movement),
          message: 'El traslado aplicado no conserva una ruta válida entre dos sedes.',
        });
      }
    });

  return Array.from(
    new Map(anomalies.map((item) => [item.id, item])).values()
  )
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
      return a.code.localeCompare(b.code);
    })
    .slice(0, limit);
}

function buildBranchAlertSummaries({
  stockAlerts = [],
  stuckReservations = [],
  coverageEstimates = [],
  anomalies = [],
} = {}) {
  const summaries = new Map();

  function add(item = {}, category = '') {
    const branch = item?.branch || {};
    const branchId = getId(branch);
    if (!branchId) return;

    const current = summaries.get(branchId) || {
      id: branchId,
      name: cleanText(branch?.name),
      code: cleanText(branch?.code),
      critical: 0,
      warning: 0,
      lowStock: 0,
      outOfStock: 0,
      stuckReservations: 0,
      coverageRisk: 0,
      anomalies: 0,
      total: 0,
    };

    if (item?.severity === 'critical') current.critical += 1;
    if (item?.severity === 'warning') current.warning += 1;
    if (Object.prototype.hasOwnProperty.call(current, category)) {
      current[category] += 1;
    }
    current.total += 1;
    summaries.set(branchId, current);
  }

  stockAlerts.forEach((item) => add(
    item,
    item?.type === 'outOfStock' ? 'outOfStock' : 'lowStock'
  ));
  stuckReservations.forEach((item) => add(item, 'stuckReservations'));
  coverageEstimates
    .filter((item) => item?.severity !== 'healthy')
    .forEach((item) => add(item, 'coverageRisk'));
  anomalies.forEach((item) => add(item, 'anomalies'));

  return Array.from(summaries.values()).sort((a, b) => {
    if (a.critical !== b.critical) return b.critical - a.critical;
    if (a.warning !== b.warning) return b.warning - a.warning;
    return b.total - a.total;
  });
}

module.exports = {
  DEFAULT_COVERAGE_WINDOW_DAYS,
  DEFAULT_LOW_STOCK_LIMIT,
  DEFAULT_STALE_DAYS,
  DEFAULT_STUCK_RESERVATION_MINUTES,
  buildBranchAlertSummaries,
  buildCoverageEstimates,
  buildInventoryAnomalies,
  buildStaleStockItems,
  buildStuckReservationItems,
  buildTransferRecommendations,
  getAvailableStock,
  getLowStockLimit,
  getStockLocationIdentity,
  getStockIdentity,
};
