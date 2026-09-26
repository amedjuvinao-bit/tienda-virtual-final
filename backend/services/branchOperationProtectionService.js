'use strict';

const mongoose = require('mongoose');

const InventoryStock = require('../models/InventoryStock');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryMovement = require('../models/InventoryMovement');
const CashSession = require('../models/CashSession');
const Order = require('../models/Order');
const PosHeldSale = require('../models/PosHeldSale');

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

const EMPTY_SUMMARY = Object.freeze({
  activeStockCount: 0,
  reservedStockCount: 0,
  pendingReservationsCount: 0,
  pendingMovementsCount: 0,
  openCashSessionsCount: 0,
  pendingOrdersCount: 0,
  heldSalesCount: 0,
  historicalStockRowsCount: 0,
  historicalReservationsCount: 0,
  historicalMovementsCount: 0,
  historicalCashSessionsCount: 0,
  historicalOrdersCount: 0,
  historicalHeldSalesCount: 0,
});

async function getBranchOperationSummary(branchId, { action = 'disable' } = {}) {
  if (!isValidObjectId(branchId)) return { ...EMPTY_SUMMARY };

  const branch = new mongoose.Types.ObjectId(String(branchId));
  const movementFilter = {
    deletedAt: null,
    $or: [{ branchFrom: branch }, { branchTo: branch }],
  };
  const orderFilter = {
    $or: [
      { branch },
      { 'inventoryAllocations.branch': branch },
      { 'fulfillment.shipments.branch': branch },
    ],
  };

  const [
    activeStockCount,
    reservedStockCount,
    pendingReservationsCount,
    pendingMovementsCount,
    openCashSessionsCount,
    pendingOrdersCount,
    heldSalesCount,
  ] = await Promise.all([
    InventoryStock.countDocuments({ branch, deletedAt: null, stock: { $gt: 0 } }),
    InventoryStock.countDocuments({ branch, deletedAt: null, reservedStock: { $gt: 0 } }),
    InventoryReservation.countDocuments({ status: 'pending', 'items.branch': branch }),
    InventoryMovement.countDocuments({ ...movementFilter, status: 'draft' }),
    CashSession.countDocuments({ branch, status: 'open' }),
    Order.countDocuments({
      ...orderFilter,
      status: { $in: ['pending', 'processing', 'paid', 'shipped'] },
      fulfillmentStatus: { $nin: ['delivered', 'returned', 'cancelled'] },
    }),
    PosHeldSale.countDocuments({ branch, status: 'active' }),
  ]);

  const summary = {
    activeStockCount,
    reservedStockCount,
    pendingReservationsCount,
    pendingMovementsCount,
    openCashSessionsCount,
    pendingOrdersCount,
    heldSalesCount,
    historicalStockRowsCount: 0,
    historicalReservationsCount: 0,
    historicalMovementsCount: 0,
    historicalCashSessionsCount: 0,
    historicalOrdersCount: 0,
    historicalHeldSalesCount: 0,
  };

  // Al desactivar se conserva el historial. Al eliminar se protegen también
  // las referencias cerradas para que sigan siendo consultables.
  if (action === 'delete') {
    [
      summary.historicalStockRowsCount,
      summary.historicalReservationsCount,
      summary.historicalMovementsCount,
      summary.historicalCashSessionsCount,
      summary.historicalOrdersCount,
      summary.historicalHeldSalesCount,
    ] = await Promise.all([
      InventoryStock.countDocuments({ branch }),
      InventoryReservation.countDocuments({ 'items.branch': branch }),
      InventoryMovement.countDocuments({ $or: movementFilter.$or }),
      CashSession.countDocuments({ branch }),
      Order.countDocuments(orderFilter),
      PosHeldSale.countDocuments({ branch }),
    ]);
  }

  return summary;
}

function hasBranchOperation(summary = {}) {
  return Object.keys(EMPTY_SUMMARY).some((key) => Number(summary[key] || 0) > 0);
}

module.exports = { getBranchOperationSummary, hasBranchOperation };
