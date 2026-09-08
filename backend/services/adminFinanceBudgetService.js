'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const FinanceBudget = require('../models/FinanceBudget');
const FinanceCostCenter = require('../models/FinanceCostCenter');
const FinanceExpense = require('../models/FinanceExpense');

const EXPENSE_TYPES = new Set(FinanceBudget.getExpenseTypes());
const BUDGET_STATUSES = new Set(['active', 'inactive']);
const COST_CENTER_STATUSES = new Set(['active', 'inactive']);
const APPROVAL_LOCK_TTL_MS = 10_000;
const APPROVAL_LOCK_RETRIES = 30;

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 100) {
  return cleanText(value, max).toLowerCase();
}

function cleanCode(value) {
  return cleanText(value, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function signedMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function percent(part, total) {
  const safeTotal = Number(total || 0);
  const safePart = Number(part || 0);
  if (!Number.isFinite(safePart) || !Number.isFinite(safeTotal) || safeTotal <= 0) {
    return 0;
  }
  return Math.round((safePart / safeTotal) * 10_000) / 100;
}

function toObjectId(value) {
  const source = value && typeof value === 'object' ? value._id || value.id : value;
  const cleanValue = cleanText(source, 80);
  return mongoose.Types.ObjectId.isValid(cleanValue)
    ? new mongoose.Types.ObjectId(cleanValue)
    : null;
}

function createBudgetError(message, code, status = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function actorContext(actor = {}) {
  const source = actor.snapshot || actor;
  const id = toObjectId(actor.adminUserId || actor.id || actor._id);
  if (!id) {
    throw createBudgetError(
      'La planificación financiera requiere un usuario administrativo identificado.',
      'FINANCE_BUDGET_ACTOR_REQUIRED',
      403
    );
  }

  return {
    id,
    idString: String(id),
    snapshot: {
      username: cleanLower(source.username || actor.username, 80),
      displayName: cleanText(
        source.displayName ||
          source.fullName ||
          actor.displayName ||
          actor.fullName ||
          source.username ||
          actor.username ||
          'Administrador',
        160
      ),
      role: cleanLower(source.role || actor.role || actor.adminRole, 40),
      adminRole: cleanLower(
        source.adminRole || actor.adminRole || source.role || actor.role,
        40
      ),
    },
    canOverrideBudget: actor.canOverrideBudget === true,
  };
}

function expectedRevision(value) {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) {
    throw createBudgetError(
      'Debes enviar la versión vigente del registro financiero.',
      'FINANCE_BUDGET_REVISION_REQUIRED',
      428
    );
  }
  return revision;
}

function parsePeriod(value) {
  const periodKey = cleanText(value, 7);
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey);
  if (!match) {
    throw createBudgetError(
      'El periodo presupuestal debe tener el formato AAAA-MM.',
      'FINANCE_BUDGET_PERIOD_INVALID',
      400
    );
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const endExclusive = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    periodKey,
    start,
    endExclusive,
    end: new Date(endExclusive.getTime() - 1),
  };
}

function periodForDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    throw createBudgetError(
      'La fecha del gasto no es válida para consultar el presupuesto.',
      'FINANCE_BUDGET_EXPENSE_DATE_INVALID',
      400
    );
  }
  return parsePeriod(
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  );
}

function normalizeBranchIds(values) {
  if (!Array.isArray(values)) return null;
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const id = toObjectId(value);
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    result.push(id);
  }
  return result;
}

function branchScopeFilter(scope = {}) {
  const ids = normalizeBranchIds(scope.branchIds);
  return ids === null ? {} : { branch: { $in: ids } };
}

function exactBranchFilter(value) {
  const branch = toObjectId(value);
  return branch ? { branch } : { branch: null };
}

function budgetIdentity({ periodKey, branch, costCenter, expenseType }) {
  return [
    periodKey,
    toObjectId(branch) ? String(toObjectId(branch)) : 'general',
    String(toObjectId(costCenter) || ''),
    cleanLower(expenseType, 40),
  ].join(':');
}

function historyEvent({ action, actor, notes, revision, amount, warningThresholdPercent }) {
  return {
    action,
    actor: actor.id,
    actorSnapshot: actor.snapshot,
    at: new Date(),
    notes: cleanText(notes, 500),
    revision,
    amount: money(amount),
    warningThresholdPercent: Math.min(
      100,
      Math.max(1, Math.round(Number(warningThresholdPercent || 80)))
    ),
  };
}

async function resolveBranch(branchId) {
  const id = toObjectId(branchId);
  if (!id) return { branch: null, snapshot: {} };
  const branch = await Branch.findOne({
    _id: id,
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .select('name code type')
    .lean();
  if (!branch) {
    throw createBudgetError(
      'La sede seleccionada no existe o no está activa.',
      'FINANCE_BUDGET_BRANCH_NOT_AVAILABLE',
      409
    );
  }
  return {
    branch: branch._id,
    snapshot: {
      name: branch.name || '',
      code: branch.code || '',
      type: branch.type || '',
    },
  };
}

async function resolveCostCenter(costCenterId, { activeOnly = true } = {}) {
  const id = toObjectId(costCenterId);
  if (!id) return null;
  const filter = { _id: id };
  if (activeOnly) filter.status = 'active';
  const center = await FinanceCostCenter.findOne(filter);
  if (!center) {
    throw createBudgetError(
      'El centro de costo seleccionado no existe o no está activo.',
      'FINANCE_COST_CENTER_NOT_AVAILABLE',
      409
    );
  }
  return center;
}

async function listCostCenters(query = {}) {
  const status = cleanLower(query.status || 'active', 20);
  const filter = {};
  if (status !== 'all') filter.status = COST_CENTER_STATUSES.has(status) ? status : 'active';
  return FinanceCostCenter.find(filter).sort({ status: 1, name: 1 }).lean();
}

async function createCostCenter(payload = {}, actor = {}) {
  const administrator = actorContext(actor);
  const code = cleanCode(payload.code);
  const name = cleanText(payload.name, 120);
  if (code.length < 2) {
    throw createBudgetError(
      'El código del centro de costo debe tener al menos 2 caracteres.',
      'FINANCE_COST_CENTER_CODE_REQUIRED'
    );
  }
  if (!name) {
    throw createBudgetError(
      'El nombre del centro de costo es obligatorio.',
      'FINANCE_COST_CENTER_NAME_REQUIRED'
    );
  }

  const center = new FinanceCostCenter({
    code,
    name,
    description: cleanText(payload.description, 500),
    status: 'active',
    revision: 0,
    createdBy: administrator.id,
    createdBySnapshot: administrator.snapshot,
    history: [
      historyEvent({
        action: 'created',
        actor: administrator,
        notes: cleanText(payload.notes, 500) || 'Centro de costo creado.',
        revision: 0,
      }),
    ],
  });

  try {
    await center.save();
  } catch (error) {
    if (Number(error?.code) === 11000) {
      throw createBudgetError(
        'Ya existe un centro de costo con ese código.',
        'FINANCE_COST_CENTER_CODE_CONFLICT',
        409,
        { code }
      );
    }
    throw error;
  }
  return center.toSafeObject();
}

async function updateCostCenter(centerId, payload = {}, actor = {}) {
  const administrator = actorContext(actor);
  const revision = expectedRevision(payload.expectedRevision);
  const id = toObjectId(centerId);
  if (!id) {
    throw createBudgetError(
      'ID de centro de costo inválido.',
      'FINANCE_COST_CENTER_ID_INVALID'
    );
  }

  const current = await FinanceCostCenter.findById(id);
  if (!current) {
    throw createBudgetError(
      'Centro de costo no encontrado.',
      'FINANCE_COST_CENTER_NOT_FOUND',
      404
    );
  }
  if (Number(current.revision || 0) !== revision) {
    throw createBudgetError(
      'El centro de costo cambió en otra sesión.',
      'FINANCE_COST_CENTER_VERSION_CONFLICT',
      409,
      { currentRevision: Number(current.revision || 0) }
    );
  }

  const status = cleanLower(payload.status ?? current.status, 20);
  if (!COST_CENTER_STATUSES.has(status)) {
    throw createBudgetError(
      'El estado del centro de costo no es válido.',
      'FINANCE_COST_CENTER_STATUS_INVALID'
    );
  }
  const name = cleanText(payload.name ?? current.name, 120);
  if (!name) {
    throw createBudgetError(
      'El nombre del centro de costo es obligatorio.',
      'FINANCE_COST_CENTER_NAME_REQUIRED'
    );
  }
  const nextRevision = revision + 1;
  const action = status !== current.status
    ? status === 'active' ? 'activated' : 'deactivated'
    : 'updated';
  const notes = cleanText(payload.changeReason || payload.notes, 500);
  if (status !== current.status && !notes) {
    throw createBudgetError(
      'Debes explicar el cambio de estado del centro de costo.',
      'FINANCE_COST_CENTER_CHANGE_REASON_REQUIRED'
    );
  }

  const updated = await FinanceCostCenter.findOneAndUpdate(
    { _id: id, revision },
    {
      $set: {
        name,
        description: cleanText(payload.description ?? current.description, 500),
        status,
        updatedBy: administrator.id,
        updatedBySnapshot: administrator.snapshot,
      },
      $inc: { revision: 1 },
      $push: {
        history: historyEvent({
          action,
          actor: administrator,
          notes: notes || 'Centro de costo actualizado.',
          revision: nextRevision,
        }),
      },
    },
    { new: true, runValidators: true }
  );
  if (!updated) {
    throw createBudgetError(
      'El centro de costo cambió antes de guardar.',
      'FINANCE_COST_CENTER_VERSION_CONFLICT',
      409
    );
  }
  return updated.toSafeObject();
}

function normalizeBudgetValues(payload = {}, fallback = {}) {
  const period = parsePeriod(payload.periodKey ?? fallback.periodKey);
  const amount = money(payload.amount ?? fallback.amount);
  if (amount <= 0) {
    throw createBudgetError(
      'El valor del presupuesto debe ser mayor a cero.',
      'FINANCE_BUDGET_AMOUNT_INVALID'
    );
  }
  const expenseType = cleanLower(
    payload.expenseType ?? fallback.expenseType,
    40
  );
  if (!EXPENSE_TYPES.has(expenseType)) {
    throw createBudgetError(
      'La categoría presupuestal no es válida.',
      'FINANCE_BUDGET_EXPENSE_TYPE_INVALID'
    );
  }
  const warningThresholdPercent = Math.round(
    Number(payload.warningThresholdPercent ?? fallback.warningThresholdPercent ?? 80)
  );
  if (warningThresholdPercent < 1 || warningThresholdPercent > 100) {
    throw createBudgetError(
      'El umbral de alerta debe estar entre 1% y 100%.',
      'FINANCE_BUDGET_WARNING_THRESHOLD_INVALID'
    );
  }
  const status = cleanLower(payload.status ?? fallback.status ?? 'active', 20);
  if (!BUDGET_STATUSES.has(status)) {
    throw createBudgetError(
      'El estado del presupuesto no es válido.',
      'FINANCE_BUDGET_STATUS_INVALID'
    );
  }
  return { period, amount, expenseType, warningThresholdPercent, status };
}

async function createBudget(payload = {}, actor = {}) {
  const administrator = actorContext(actor);
  const normalized = normalizeBudgetValues(payload);
  const center = await resolveCostCenter(payload.costCenterId || payload.costCenter);
  if (!center) {
    throw createBudgetError(
      'Debes seleccionar un centro de costo activo.',
      'FINANCE_BUDGET_COST_CENTER_REQUIRED'
    );
  }
  const branchInfo = await resolveBranch(payload.branchId || payload.branch);
  const key = budgetIdentity({
    periodKey: normalized.period.periodKey,
    branch: branchInfo.branch,
    costCenter: center._id,
    expenseType: normalized.expenseType,
  });
  const notes = cleanText(payload.changeReason || payload.notes, 500);
  const budget = new FinanceBudget({
    budgetKey: key,
    periodKey: normalized.period.periodKey,
    periodStart: normalized.period.start,
    periodEnd: normalized.period.end,
    branch: branchInfo.branch,
    branchSnapshot: branchInfo.snapshot,
    costCenter: center._id,
    costCenterSnapshot: { code: center.code, name: center.name },
    expenseType: normalized.expenseType,
    amount: normalized.amount,
    warningThresholdPercent: normalized.warningThresholdPercent,
    status: normalized.status,
    revision: 0,
    controlRevision: 0,
    createdBy: administrator.id,
    createdBySnapshot: administrator.snapshot,
    history: [
      historyEvent({
        action: 'created',
        actor: administrator,
        notes: notes || 'Presupuesto creado.',
        revision: 0,
        amount: normalized.amount,
        warningThresholdPercent: normalized.warningThresholdPercent,
      }),
    ],
  });
  try {
    await budget.save();
  } catch (error) {
    if (Number(error?.code) === 11000) {
      throw createBudgetError(
        'Ya existe un presupuesto para ese periodo, sede, centro y categoría.',
        'FINANCE_BUDGET_ALREADY_EXISTS',
        409,
        { budgetKey: key }
      );
    }
    throw error;
  }
  return budget.toSafeObject();
}

async function loadBudgetWithinScope(budgetId, scope = {}) {
  const id = toObjectId(budgetId);
  if (!id) {
    throw createBudgetError('ID de presupuesto inválido.', 'FINANCE_BUDGET_ID_INVALID');
  }
  const budget = await FinanceBudget.findOne({
    _id: id,
    ...branchScopeFilter(scope),
  });
  if (!budget) {
    throw createBudgetError(
      'Presupuesto no encontrado dentro de tus sedes autorizadas.',
      'FINANCE_BUDGET_NOT_FOUND',
      404
    );
  }
  return budget;
}

async function updateBudget(budgetId, payload = {}, actor = {}, scope = {}) {
  const administrator = actorContext(actor);
  const revision = expectedRevision(payload.expectedRevision);
  const current = await loadBudgetWithinScope(budgetId, scope);
  if (Number(current.revision || 0) !== revision) {
    throw createBudgetError(
      'El presupuesto cambió en otra sesión.',
      'FINANCE_BUDGET_VERSION_CONFLICT',
      409,
      { currentRevision: Number(current.revision || 0) }
    );
  }
  const normalized = normalizeBudgetValues(payload, current.toObject());
  const nextRevision = revision + 1;
  const action = normalized.status !== current.status
    ? normalized.status === 'active' ? 'activated' : 'deactivated'
    : 'updated';
  const reason = cleanText(payload.changeReason || payload.notes, 500);
  if (!reason) {
    throw createBudgetError(
      'Debes explicar el ajuste del presupuesto.',
      'FINANCE_BUDGET_CHANGE_REASON_REQUIRED'
    );
  }
  const now = new Date();
  const updated = await FinanceBudget.findOneAndUpdate(
    {
      _id: current._id,
      revision,
      $or: [
        { 'approvalLock.token': { $in: ['', null] } },
        { 'approvalLock.expiresAt': { $lte: now } },
      ],
    },
    {
      $set: {
        amount: normalized.amount,
        warningThresholdPercent: normalized.warningThresholdPercent,
        status: normalized.status,
        updatedBy: administrator.id,
        updatedBySnapshot: administrator.snapshot,
      },
      $inc: { revision: 1, controlRevision: 1 },
      $push: {
        history: historyEvent({
          action,
          actor: administrator,
          notes: reason,
          revision: nextRevision,
          amount: normalized.amount,
          warningThresholdPercent: normalized.warningThresholdPercent,
        }),
      },
    },
    { new: true, runValidators: true }
  );
  if (!updated) {
    throw createBudgetError(
      'El presupuesto cambió o está procesando una aprobación. Recarga e intenta nuevamente.',
      'FINANCE_BUDGET_VERSION_CONFLICT',
      409
    );
  }
  return updated.toSafeObject();
}

async function listBudgets(query = {}, scope = {}) {
  const period = parsePeriod(query.periodKey || query.period);
  const status = cleanLower(query.status || 'all', 20);
  const filter = {
    periodKey: period.periodKey,
    ...branchScopeFilter(scope),
  };
  if (status !== 'all') filter.status = BUDGET_STATUSES.has(status) ? status : 'active';
  return FinanceBudget.find(filter)
    .sort({ status: 1, 'costCenterSnapshot.name': 1, expenseType: 1 })
    .lean()
    .then((rows) => rows.map((row) => {
      const safe = { ...row };
      delete safe.approvalLock;
      delete safe.__v;
      return safe;
    }));
}

async function aggregateUsage({ period, scope = {}, branch, costCenter, expenseType, excludeExpenseId } = {}) {
  const match = {
    date: { $gte: period.start, $lt: period.endExclusive },
    status: { $in: ['pending', 'paid'] },
    deletedAt: null,
  };
  if (branch !== undefined) Object.assign(match, exactBranchFilter(branch));
  else Object.assign(match, branchScopeFilter(scope));
  if (costCenter !== undefined) match.costCenter = toObjectId(costCenter);
  if (expenseType) match.type = cleanLower(expenseType, 40);
  const excluded = toObjectId(excludeExpenseId);
  if (excluded) match._id = { $ne: excluded };

  return FinanceExpense.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          branch: '$branch',
          costCenter: '$costCenter',
          expenseType: '$type',
          status: '$status',
        },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);
}

function usageKey({ branch, costCenter, expenseType }) {
  return [
    toObjectId(branch) ? String(toObjectId(branch)) : 'general',
    toObjectId(costCenter) ? String(toObjectId(costCenter)) : 'unassigned',
    cleanLower(expenseType, 40),
  ].join(':');
}

function indexUsage(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = usageKey({
      branch: row?._id?.branch,
      costCenter: row?._id?.costCenter,
      expenseType: row?._id?.expenseType,
    });
    const current = map.get(key) || {
      pending: { amount: 0, count: 0 },
      paid: { amount: 0, count: 0 },
      identity: row?._id || {},
    };
    const status = cleanLower(row?._id?.status, 20);
    if (current[status]) {
      current[status] = {
        amount: money(row.amount),
        count: Number(row.count || 0),
      };
    }
    map.set(key, current);
  }
  return map;
}

function budgetLevel({ amount, exposure, warningThresholdPercent }) {
  if (exposure > amount) return 'exceeded';
  if (percent(exposure, amount) >= warningThresholdPercent) return 'warning';
  return 'healthy';
}

function budgetLine(budget, usage = {}) {
  const committedAmount = money(usage.pending?.amount);
  const spentAmount = money(usage.paid?.amount);
  const exposureAmount = committedAmount + spentAmount;
  const amount = money(budget.amount);
  return {
    _id: String(budget._id),
    periodKey: budget.periodKey,
    branch: budget.branch ? String(budget.branch) : null,
    branchSnapshot: budget.branchSnapshot || {},
    costCenter: budget.costCenter ? String(budget.costCenter) : null,
    costCenterSnapshot: budget.costCenterSnapshot || {},
    expenseType: budget.expenseType,
    amount,
    warningThresholdPercent: Number(budget.warningThresholdPercent || 80),
    status: budget.status,
    revision: Number(budget.revision || 0),
    committedAmount,
    committedCount: Number(usage.pending?.count || 0),
    spentAmount,
    spentCount: Number(usage.paid?.count || 0),
    exposureAmount,
    availableAmount: signedMoney(amount - exposureAmount),
    percentUsed: percent(exposureAmount, amount),
    level: budgetLevel({
      amount,
      exposure: exposureAmount,
      warningThresholdPercent: Number(budget.warningThresholdPercent || 80),
    }),
    history: Array.isArray(budget.history) ? budget.history : [],
  };
}

async function getBudgetControl(query = {}, scope = {}) {
  const period = parsePeriod(query.periodKey || query.period);
  const [budgets, usageRows] = await Promise.all([
    listBudgets({ periodKey: period.periodKey, status: 'active' }, scope),
    aggregateUsage({ period, scope }),
  ]);
  const usage = indexUsage(usageRows);
  const matchedKeys = new Set();
  const lines = budgets.map((budget) => {
    const key = usageKey({
      branch: budget.branch,
      costCenter: budget.costCenter,
      expenseType: budget.expenseType,
    });
    matchedKeys.add(key);
    return budgetLine(budget, usage.get(key));
  });

  const unbudgeted = [];
  for (const [key, row] of usage.entries()) {
    if (matchedKeys.has(key)) continue;
    const pendingAmount = money(row.pending?.amount);
    const spentAmount = money(row.paid?.amount);
    if (!pendingAmount && !spentAmount) continue;
    unbudgeted.push({
      key,
      branch: row.identity?.branch ? String(row.identity.branch) : null,
      costCenter: row.identity?.costCenter ? String(row.identity.costCenter) : null,
      expenseType: row.identity?.expenseType || 'other',
      committedAmount: pendingAmount,
      committedCount: Number(row.pending?.count || 0),
      spentAmount,
      spentCount: Number(row.paid?.count || 0),
    });
  }

  const summary = lines.reduce(
    (acc, line) => {
      acc.allocatedAmount += line.amount;
      acc.committedAmount += line.committedAmount;
      acc.spentAmount += line.spentAmount;
      acc.availableAmount += line.availableAmount;
      if (line.level === 'warning') acc.warningCount += 1;
      if (line.level === 'exceeded') acc.exceededCount += 1;
      return acc;
    },
    {
      budgetCount: lines.length,
      allocatedAmount: 0,
      committedAmount: 0,
      spentAmount: 0,
      availableAmount: 0,
      warningCount: 0,
      exceededCount: 0,
      unbudgetedCommittedAmount: 0,
      unbudgetedSpentAmount: 0,
      unbudgetedCount: unbudgeted.length,
    }
  );
  for (const row of unbudgeted) {
    summary.unbudgetedCommittedAmount += row.committedAmount;
    summary.unbudgetedSpentAmount += row.spentAmount;
  }
  summary.allocatedAmount = money(summary.allocatedAmount);
  summary.committedAmount = money(summary.committedAmount);
  summary.spentAmount = money(summary.spentAmount);
  summary.availableAmount = signedMoney(summary.availableAmount);
  summary.unbudgetedCommittedAmount = money(summary.unbudgetedCommittedAmount);
  summary.unbudgetedSpentAmount = money(summary.unbudgetedSpentAmount);

  return {
    periodKey: period.periodKey,
    periodStart: period.start,
    periodEnd: period.end,
    summary,
    lines,
    unbudgeted,
  };
}

async function findExpenseBudget(expense = {}) {
  const center = toObjectId(expense.costCenter || expense.costCenterId);
  if (!center) return null;
  const period = periodForDate(expense.date);
  return FinanceBudget.findOne({
    periodKey: period.periodKey,
    ...exactBranchFilter(expense.branch || expense.branchId),
    costCenter: center,
    expenseType: cleanLower(expense.type, 40),
    status: 'active',
  });
}

async function prepareExpensePlanning(expense = {}, options = {}) {
  const center = await resolveCostCenter(
    expense.costCenterId || expense.costCenter,
    { activeOnly: true }
  );
  if (!center) {
    return {
      costCenter: null,
      costCenterSnapshot: {},
      budgetEvaluation: {
        outcome: 'unassigned',
        periodKey: periodForDate(expense.date).periodKey,
        evaluatedAt: new Date(),
      },
    };
  }
  const normalizedExpense = { ...expense, costCenter: center._id };
  const budget = await findExpenseBudget(normalizedExpense);
  const period = periodForDate(expense.date);
  if (!budget) {
    return {
      costCenter: center._id,
      costCenterSnapshot: { code: center.code, name: center.name },
      budgetEvaluation: {
        outcome: 'unbudgeted',
        periodKey: period.periodKey,
        evaluatedAt: new Date(),
      },
    };
  }

  const usageRows = await aggregateUsage({
    period,
    branch: expense.branch || expense.branchId,
    costCenter: center._id,
    expenseType: expense.type,
    excludeExpenseId: options.excludeExpenseId,
  });
  const indexed = indexUsage(usageRows);
  const current = indexed.get(
    usageKey({
      branch: expense.branch || expense.branchId,
      costCenter: center._id,
      expenseType: expense.type,
    })
  ) || {};
  const committedAmount = money(current.pending?.amount);
  const spentAmount = money(current.paid?.amount);
  const requestedAmount = money(expense.amount);
  const exposureAmount = committedAmount + spentAmount + requestedAmount;
  const level = budgetLevel({
    amount: money(budget.amount),
    exposure: exposureAmount,
    warningThresholdPercent: Number(budget.warningThresholdPercent || 80),
  });

  return {
    costCenter: center._id,
    costCenterSnapshot: { code: center.code, name: center.name },
    budgetEvaluation: {
      budget: budget._id,
      periodKey: period.periodKey,
      limitAmount: money(budget.amount),
      committedAmount,
      spentAmount,
      projectedAmount: exposureAmount,
      availableAmount: signedMoney(money(budget.amount) - exposureAmount),
      percentUsed: percent(exposureAmount, budget.amount),
      outcome: level,
      evaluatedAt: new Date(),
    },
  };
}

async function acquireApprovalLock(budgetId) {
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < APPROVAL_LOCK_RETRIES; attempt += 1) {
    const now = new Date();
    const locked = await FinanceBudget.findOneAndUpdate(
      {
        _id: budgetId,
        status: 'active',
        $or: [
          { 'approvalLock.token': { $in: ['', null] } },
          { 'approvalLock.expiresAt': { $lte: now } },
        ],
      },
      {
        $set: {
          approvalLock: {
            token,
            acquiredAt: now,
            expiresAt: new Date(now.getTime() + APPROVAL_LOCK_TTL_MS),
          },
        },
        $inc: { controlRevision: 1 },
      },
      { new: true }
    );
    if (locked) return { budget: locked, token };
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw createBudgetError(
    'El presupuesto está procesando otra aprobación. Intenta nuevamente.',
    'FINANCE_BUDGET_APPROVAL_BUSY',
    409
  );
}

async function releaseApprovalLock(budgetId, token) {
  await FinanceBudget.updateOne(
    { _id: budgetId, 'approvalLock.token': token },
    {
      $set: {
        'approvalLock.token': '',
        'approvalLock.acquiredAt': null,
        'approvalLock.expiresAt': null,
      },
    }
  );
}

function overrideRequirement({ canOverrideBudget, reason, code, message, details }) {
  if (!canOverrideBudget) {
    throw createBudgetError(message, code, 409, details);
  }
  if (!reason) {
    throw createBudgetError(
      'Debes justificar la excepción al presupuesto.',
      'FINANCE_BUDGET_OVERRIDE_REASON_REQUIRED',
      400,
      details
    );
  }
}

async function runExpenseApprovalControl({ expense, actor = {}, overrideReason = '', approve }) {
  if (typeof approve !== 'function') {
    throw new TypeError('FINANCE_BUDGET_APPROVAL_CALLBACK_REQUIRED');
  }
  const reviewer = actorContext(actor);
  const reason = cleanText(overrideReason, 500);
  const center = toObjectId(expense.costCenter);
  const period = periodForDate(expense.date);

  if (!center) {
    return approve(
      {
        outcome: 'unassigned',
        periodKey: period.periodKey,
        evaluatedAt: new Date(),
      },
      { used: false }
    );
  }

  const budget = await findExpenseBudget(expense);
  if (!budget) {
    const details = {
      periodKey: period.periodKey,
      costCenter: String(center),
      expenseType: expense.type,
    };
    overrideRequirement({
      canOverrideBudget: reviewer.canOverrideBudget,
      reason,
      code: 'FINANCE_BUDGET_REQUIRED_FOR_APPROVAL',
      message: 'No existe un presupuesto activo para este gasto.',
      details,
    });
    return approve(
      {
        outcome: 'unbudgeted',
        periodKey: period.periodKey,
        projectedAmount: money(expense.amount),
        evaluatedAt: new Date(),
      },
      {
        used: true,
        reason,
        actor: reviewer.id,
        actorSnapshot: reviewer.snapshot,
        at: new Date(),
      }
    );
  }

  const lock = await acquireApprovalLock(budget._id);
  try {
    const usageRows = await aggregateUsage({
      period,
      branch: expense.branch,
      costCenter: expense.costCenter,
      expenseType: expense.type,
      excludeExpenseId: expense._id,
    });
    const indexed = indexUsage(usageRows);
    const current = indexed.get(
      usageKey({
        branch: expense.branch,
        costCenter: expense.costCenter,
        expenseType: expense.type,
      })
    ) || {};
    const spentAmount = money(current.paid?.amount);
    const committedAmount = money(current.pending?.amount);
    const projectedAmount = spentAmount + money(expense.amount);
    const exposureAmount = projectedAmount + committedAmount;
    const exceeded = projectedAmount > money(lock.budget.amount);
    const details = {
      budgetId: String(lock.budget._id),
      periodKey: period.periodKey,
      limitAmount: money(lock.budget.amount),
      spentAmount,
      requestedAmount: money(expense.amount),
      projectedAmount,
    };
    if (exceeded) {
      overrideRequirement({
        canOverrideBudget: reviewer.canOverrideBudget,
        reason,
        code: 'FINANCE_BUDGET_LIMIT_EXCEEDED',
        message: 'La aprobación supera el presupuesto disponible.',
        details,
      });
    }
    const outcome = exceeded
      ? 'exceeded'
      : budgetLevel({
          amount: money(lock.budget.amount),
          exposure: exposureAmount,
          warningThresholdPercent: Number(lock.budget.warningThresholdPercent || 80),
        });
    const evaluation = {
      budget: lock.budget._id,
      periodKey: period.periodKey,
      limitAmount: money(lock.budget.amount),
      committedAmount,
      spentAmount,
      projectedAmount,
      availableAmount: signedMoney(money(lock.budget.amount) - exposureAmount),
      percentUsed: percent(exposureAmount, lock.budget.amount),
      outcome,
      evaluatedAt: new Date(),
    };
    const override = exceeded
      ? {
          used: true,
          reason,
          actor: reviewer.id,
          actorSnapshot: reviewer.snapshot,
          at: new Date(),
        }
      : { used: false };
    return await approve(evaluation, override);
  } finally {
    await releaseApprovalLock(budget._id, lock.token).catch(() => null);
  }
}

module.exports = {
  createBudget,
  createBudgetError,
  createCostCenter,
  getBudgetControl,
  listBudgets,
  listCostCenters,
  prepareExpensePlanning,
  runExpenseApprovalControl,
  updateBudget,
  updateCostCenter,
  __test: {
    actorContext,
    budgetIdentity,
    budgetLevel,
    expectedRevision,
    indexUsage,
    parsePeriod,
    periodForDate,
    usageKey,
  },
};
