'use strict';

const mongoose = require('mongoose');

const InventoryStock = require('../models/InventoryStock');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryMovement = require('../models/InventoryMovement');
const CashSession = require('../models/CashSession');
const Order = require('../models/Order');
const OrderReturn = require('../models/OrderReturn');
const OrderRefund = require('../models/OrderRefund');
const PosHeldSale = require('../models/PosHeldSale');
const FinanceExpense = require('../models/FinanceExpense');
const FinanceBudget = require('../models/FinanceBudget');
const FinancePeriodClose = require('../models/FinancePeriodClose');

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
  pendingReturnsCount: 0,
  pendingRefundsCount: 0,
  pendingExpensesCount: 0,
  activeBudgetsCount: 0,
  provisionalPeriodClosesCount: 0,
  historicalStockRowsCount: 0,
  historicalReservationsCount: 0,
  historicalMovementsCount: 0,
  historicalCashSessionsCount: 0,
  historicalOrdersCount: 0,
  historicalHeldSalesCount: 0,
  historicalReturnsCount: 0,
  historicalRefundsCount: 0,
  historicalExpensesCount: 0,
  historicalBudgetsCount: 0,
  historicalPeriodClosesCount: 0,
});

async function countOrderRelatedRecords(model, branch, statusFilter) {
  const rows = await model.aggregate([
    { $match: statusFilter },
    { $lookup: { from: Order.collection.name, localField: 'order', foreignField: '_id', as: 'linkedOrder' } },
    { $unwind: { path: '$linkedOrder', preserveNullAndEmptyArrays: true } },
    { $match: { $or: [
      { 'linkedOrder.branch': branch },
      { 'linkedOrder.inventoryAllocations.branch': branch },
      { 'linkedOrder.fulfillment.shipments.branch': branch },
      { 'inventoryRestorations.branch': branch },
    ] } },
    { $count: 'count' },
  ]);
  return rows[0]?.count || 0;
}

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
    pendingReturnsCount,
    pendingRefundsCount,
    pendingExpensesCount,
    activeBudgetsCount,
    provisionalPeriodClosesCount,
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
    countOrderRelatedRecords(OrderReturn, branch, { $or: [
      { status: { $in: ['requested', 'authorized', 'in_transit', 'received', 'inspected', 'resolution_required'] } },
      { status: 'resolved', 'resolution.state': { $in: ['pending', 'action_required'] } },
    ] }),
    countOrderRelatedRecords(OrderRefund, branch, { $or: [
      { status: 'processing' },
      { 'reconciliation.state': { $in: ['pending', 'action_required', 'failed'] } },
    ] }),
    FinanceExpense.countDocuments({ branch, deletedAt: null, $or: [
      { status: { $in: ['draft', 'pending'] } },
      { status: 'paid', 'settlement.status': { $in: ['pending', 'partial'] } },
    ] }),
    FinanceBudget.countDocuments({ branch, status: 'active' }),
    FinancePeriodClose.countDocuments({ branch, status: 'provisional' }),
  ]);

  const summary = {
    activeStockCount,
    reservedStockCount,
    pendingReservationsCount,
    pendingMovementsCount,
    openCashSessionsCount,
    pendingOrdersCount,
    heldSalesCount,
    pendingReturnsCount,
    pendingRefundsCount,
    pendingExpensesCount,
    activeBudgetsCount,
    provisionalPeriodClosesCount,
    historicalStockRowsCount: 0,
    historicalReservationsCount: 0,
    historicalMovementsCount: 0,
    historicalCashSessionsCount: 0,
    historicalOrdersCount: 0,
    historicalHeldSalesCount: 0,
    historicalReturnsCount: 0,
    historicalRefundsCount: 0,
    historicalExpensesCount: 0,
    historicalBudgetsCount: 0,
    historicalPeriodClosesCount: 0,
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
      summary.historicalReturnsCount,
      summary.historicalRefundsCount,
      summary.historicalExpensesCount,
      summary.historicalBudgetsCount,
      summary.historicalPeriodClosesCount,
    ] = await Promise.all([
      InventoryStock.countDocuments({ branch }),
      InventoryReservation.countDocuments({ 'items.branch': branch }),
      InventoryMovement.countDocuments({ $or: movementFilter.$or }),
      CashSession.countDocuments({ branch }),
      Order.countDocuments(orderFilter),
      PosHeldSale.countDocuments({ branch }),
      countOrderRelatedRecords(OrderReturn, branch, {}),
      countOrderRelatedRecords(OrderRefund, branch, {}),
      FinanceExpense.countDocuments({ branch }),
      FinanceBudget.countDocuments({ branch }),
      FinancePeriodClose.countDocuments({ branch }),
    ]);
  }

  return summary;
}

function hasBranchOperation(summary = {}) {
  return Object.keys(EMPTY_SUMMARY).some((key) => Number(summary[key] || 0) > 0);
}

module.exports = { getBranchOperationSummary, hasBranchOperation };
