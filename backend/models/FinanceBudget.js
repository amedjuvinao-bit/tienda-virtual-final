'use strict';

const mongoose = require('mongoose');

const BUDGET_STATUSES = ['active', 'inactive'];
const BUDGET_ACTIONS = ['created', 'updated', 'activated', 'deactivated'];
const EXPENSE_TYPES = [
  'operating',
  'inventory_purchase',
  'shipping',
  'marketing',
  'payroll',
  'rent',
  'utilities',
  'tax',
  'fee',
  'other',
];

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 80) {
  return cleanText(value, max).toLowerCase();
}

function cleanMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

const AdminSnapshotSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, lowercase: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, lowercase: true, default: '' },
    adminRole: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const BranchSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, uppercase: true, default: '' },
    type: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const CostCenterSnapshotSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, uppercase: true, default: '' },
    name: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const BudgetHistorySchema = new mongoose.Schema(
  {
    action: { type: String, enum: BUDGET_ACTIONS, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    actorSnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    at: { type: Date, default: Date.now, required: true },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
    revision: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 1, set: cleanMoney },
    warningThresholdPercent: { type: Number, min: 1, max: 100 },
  },
  { _id: true }
);

const FinanceBudgetSchema = new mongoose.Schema(
  {
    budgetKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 220,
    },
    periodKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    branchSnapshot: {
      type: BranchSnapshotSchema,
      default: () => ({}),
    },
    costCenter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinanceCostCenter',
      required: true,
    },
    costCenterSnapshot: {
      type: CostCenterSnapshotSchema,
      required: true,
    },
    expenseType: {
      type: String,
      enum: EXPENSE_TYPES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      set: cleanMoney,
    },
    warningThresholdPercent: {
      type: Number,
      min: 1,
      max: 100,
      default: 80,
    },
    status: {
      type: String,
      enum: BUDGET_STATUSES,
      default: 'active',
    },
    revision: { type: Number, min: 0, default: 0 },
    controlRevision: { type: Number, min: 0, default: 0 },
    approvalLock: {
      token: { type: String, trim: true, default: '' },
      acquiredAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    createdBySnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    updatedBySnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    history: {
      type: [BudgetHistorySchema],
      default: [],
      validate: [
        (events) => Array.isArray(events) && events.length <= 120,
        'Máximo 120 eventos por presupuesto.',
      ],
    },
  },
  { timestamps: true }
);

FinanceBudgetSchema.index(
  { budgetKey: 1 },
  { unique: true, name: 'budgetKey_1_unique' }
);
FinanceBudgetSchema.index(
  { periodStart: 1, branch: 1, status: 1 },
  { name: 'periodStart_1_branch_1_status_1' }
);
FinanceBudgetSchema.index(
  { costCenter: 1, periodStart: 1, status: 1 },
  { name: 'costCenter_1_periodStart_1_status_1' }
);
FinanceBudgetSchema.index(
  { 'approvalLock.expiresAt': 1 },
  { name: 'approvalLock.expiresAt_1' }
);

FinanceBudgetSchema.pre('validate', function normalizeBudget(next) {
  try {
    this.budgetKey = cleanLower(this.budgetKey, 220);
    this.periodKey = cleanText(this.periodKey, 7);
    this.expenseType = cleanLower(this.expenseType, 40);
    this.amount = cleanMoney(this.amount);
    this.warningThresholdPercent = Math.min(
      100,
      Math.max(1, Math.round(Number(this.warningThresholdPercent || 80)))
    );
    this.status = BUDGET_STATUSES.includes(cleanLower(this.status))
      ? cleanLower(this.status)
      : 'active';
    this.revision = Math.max(0, Math.floor(Number(this.revision || 0)));
    this.controlRevision = Math.max(
      0,
      Math.floor(Number(this.controlRevision || 0))
    );
    next();
  } catch (error) {
    next(error);
  }
});

FinanceBudgetSchema.methods.toSafeObject = function toSafeObject() {
  const value = this.toObject({ virtuals: true });
  delete value.__v;
  delete value.approvalLock;
  return value;
};

FinanceBudgetSchema.statics.getExpenseTypes = function getExpenseTypes() {
  return [...EXPENSE_TYPES];
};

module.exports =
  mongoose.models.FinanceBudget ||
  mongoose.model('FinanceBudget', FinanceBudgetSchema);
