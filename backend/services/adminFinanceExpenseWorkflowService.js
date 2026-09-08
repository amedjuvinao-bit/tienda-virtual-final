'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');

const FinanceExpense = require('../models/FinanceExpense');
const financeService = require('./adminFinanceService');
const financeBudgetService = require('./adminFinanceBudgetService');
const { safeDate } = require('../utils/dateRange');

const REVIEW_DECISIONS = new Set(['approve', 'reject']);
const EDITABLE_STATUSES = new Set(['pending', 'rejected']);
const CANCELLABLE_STATUSES = new Set(['pending', 'rejected', 'paid']);
const EXPENSE_TYPES = new Set([
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
]);
const PAYMENT_METHODS = new Set(['cash', 'transfer', 'card', 'mixed', 'other']);

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 500) {
  return cleanText(value, max).toLowerCase();
}

function toObjectId(value) {
  const cleanValue = cleanText(value, 80);
  return mongoose.Types.ObjectId.isValid(cleanValue)
    ? new mongoose.Types.ObjectId(cleanValue)
    : null;
}

function createFinanceWorkflowError(message, code, status = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function actorContext(actor = {}) {
  const source = actor.snapshot || actor;
  const id = toObjectId(actor.adminUserId || actor.id || actor._id);
  const snapshot = {
    username: cleanLower(
      source.username || actor.username || actor.adminUsername || '',
      80
    ),
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
    role: cleanLower(source.role || actor.role || actor.adminRole || '', 40),
    adminRole: cleanLower(
      source.adminRole || actor.adminRole || source.role || actor.role || '',
      40
    ),
  };

  if (!id) {
    throw createFinanceWorkflowError(
      'La aprobación de gastos requiere un usuario administrativo identificado.',
      'FINANCE_EXPENSE_ACTOR_REQUIRED',
      403
    );
  }

  return {
    id,
    idString: String(id),
    snapshot,
    privileged: ['owner', 'admin'].includes(snapshot.adminRole),
    owner: snapshot.adminRole === 'owner',
    canOverrideBudget: actor.canOverrideBudget === true,
  };
}

function normalizeBranchIds(values) {
  if (!Array.isArray(values)) return null;
  const result = [];
  const seen = new Set();

  for (const value of values) {
    const id = toObjectId(value);
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    result.push(id);
  }

  return result;
}

function buildResourceFilter(expenseId, scope = {}) {
  const id = toObjectId(expenseId);
  if (!id) {
    throw createFinanceWorkflowError(
      'ID de gasto inválido.',
      'FINANCE_EXPENSE_ID_INVALID',
      400
    );
  }

  const filter = { _id: id };
  const branchIds = normalizeBranchIds(scope.branchIds);
  if (branchIds !== null) filter.branch = { $in: branchIds };
  return filter;
}

function expectedRevision(value) {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) {
    throw createFinanceWorkflowError(
      'Debes enviar la versión vigente del gasto.',
      'FINANCE_EXPENSE_REVISION_REQUIRED',
      428
    );
  }
  return revision;
}

function normalizeRequestKey(value, actorId) {
  const raw = cleanText(value, 160);
  if (raw.length < 8) {
    throw createFinanceWorkflowError(
      'No fue posible identificar de forma segura la solicitud del gasto.',
      'FINANCE_EXPENSE_REQUEST_KEY_REQUIRED',
      400
    );
  }

  return crypto
    .createHash('sha256')
    .update(`${actorId}:${raw}`)
    .digest('hex');
}

function normalizeExpenseData(payload = {}, fallback = {}) {
  const amount = Number(payload.amount ?? fallback.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createFinanceWorkflowError(
      'El valor del gasto debe ser mayor a cero.',
      'FINANCE_EXPENSE_AMOUNT_INVALID',
      400
    );
  }

  const type = cleanLower(payload.type ?? fallback.type ?? 'operating', 40);
  if (!EXPENSE_TYPES.has(type)) {
    throw createFinanceWorkflowError(
      'El tipo de gasto seleccionado no es válido.',
      'FINANCE_EXPENSE_TYPE_INVALID',
      400
    );
  }

  const paymentMethod = cleanLower(
    payload.paymentMethod ?? fallback.paymentMethod,
    40
  );
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw createFinanceWorkflowError(
      'Debes seleccionar un método de pago válido.',
      'FINANCE_EXPENSE_PAYMENT_METHOD_REQUIRED',
      400
    );
  }

  const category = cleanText(payload.category ?? fallback.category, 120);
  if (!category) {
    throw createFinanceWorkflowError(
      'Debes indicar la categoría del gasto.',
      'FINANCE_EXPENSE_CATEGORY_REQUIRED',
      400
    );
  }

  const description = cleanText(
    payload.description ?? fallback.description,
    500
  );
  if (!description) {
    throw createFinanceWorkflowError(
      'Debes explicar el concepto del gasto.',
      'FINANCE_EXPENSE_DESCRIPTION_REQUIRED',
      400
    );
  }

  return {
    date: safeDate(payload.date ?? fallback.date) || new Date(),
    amount: Math.round(amount),
    type,
    category,
    subcategory: cleanText(
      payload.subcategory ?? fallback.subcategory,
      120
    ),
    description,
    vendor: cleanText(payload.vendor ?? fallback.vendor, 160),
    invoiceNumber: cleanText(
      payload.invoiceNumber ?? fallback.invoiceNumber,
      80
    ).toUpperCase(),
    reference: cleanText(payload.reference ?? fallback.reference, 120),
    paymentMethod,
    tags: payload.tags ?? fallback.tags ?? [],
    attachments: payload.attachments ?? fallback.attachments ?? [],
    notes: cleanText(payload.notes ?? fallback.notes, 1000),
  };
}

function workflowEvent({
  action,
  fromStatus = '',
  toStatus,
  actor,
  notes = '',
  revision,
  selfApprovalOverride = false,
  budgetOutcome = '',
  budgetOverrideUsed = false,
  budgetOverrideReason = '',
  at = new Date(),
}) {
  return {
    action,
    fromStatus,
    toStatus,
    actor: actor.id,
    actorSnapshot: actor.snapshot,
    at,
    notes: cleanText(notes, 500),
    revision,
    selfApprovalOverride,
    budgetOutcome,
    budgetOverrideUsed,
    budgetOverrideReason: cleanText(budgetOverrideReason, 500),
  };
}

function sameActor(expense, actor) {
  return Boolean(
    expense?.createdBy && String(expense.createdBy) === actor.idString
  );
}

async function loadExpense(expenseId, scope = {}) {
  const expense = await FinanceExpense.findOne(
    buildResourceFilter(expenseId, scope)
  );
  if (!expense) {
    throw createFinanceWorkflowError(
      'Gasto no encontrado dentro de tus sedes autorizadas.',
      'FINANCE_EXPENSE_NOT_FOUND',
      404
    );
  }
  return expense;
}

function assertCurrentRevision(expense, revision) {
  if (Number(expense.revision || 0) !== revision) {
    throw createFinanceWorkflowError(
      'El gasto cambió en otra sesión. Recarga la información antes de continuar.',
      'FINANCE_EXPENSE_VERSION_CONFLICT',
      409,
      {
        expectedRevision: revision,
        currentRevision: Number(expense.revision || 0),
        currentStatus: expense.status,
      }
    );
  }
}

async function requestExpense(payload = {}, actor = {}) {
  const requester = actorContext(actor);
  const requestKey = normalizeRequestKey(payload.requestKey, requester.idString);
  const existing = await FinanceExpense.findOne({ requestKey });
  if (existing) {
    return { ...existing.toSafeObject(), idempotentReplay: true };
  }

  const normalized = normalizeExpenseData(payload);
  const branchInfo = await financeService.resolveExpenseBranch(
    payload.branchId ?? payload.branch
  );
  const planning = await financeBudgetService.prepareExpensePlanning({
    ...normalized,
    branch: branchInfo.branch,
    costCenterId: payload.costCenterId ?? payload.costCenter,
  });
  const now = new Date();
  const submitted = workflowEvent({
    action: 'submitted',
    toStatus: 'pending',
    actor: requester,
    notes: 'Solicitud de gasto enviada a aprobación.',
    revision: 0,
    at: now,
  });

  try {
    return await financeService.createExpense(
      {
        ...payload,
        ...normalized,
        status: 'pending',
        requestKey,
        revision: 0,
        submittedAt: now,
        ...planning,
        workflow: [submitted],
      },
      actor
    );
  } catch (error) {
    if (Number(error?.code) !== 11000) throw error;
    const replay = await FinanceExpense.findOne({ requestKey });
    if (!replay) throw error;
    return { ...replay.toSafeObject(), idempotentReplay: true };
  }
}

async function updateExpenseRequest(
  expenseId,
  payload = {},
  actor = {},
  scope = {}
) {
  const editor = actorContext(actor);
  const revision = expectedRevision(payload.expectedRevision);
  const expense = await loadExpense(expenseId, scope);
  assertCurrentRevision(expense, revision);

  if (!EDITABLE_STATUSES.has(expense.status)) {
    throw createFinanceWorkflowError(
      'Un gasto aprobado o anulado no se puede editar. Debes anularlo y registrar uno nuevo.',
      'FINANCE_EXPENSE_IMMUTABLE',
      409,
      { status: expense.status }
    );
  }

  if (!sameActor(expense, editor) && !editor.privileged) {
    throw createFinanceWorkflowError(
      'Solo quien solicitó el gasto puede corregirlo antes de la aprobación.',
      'FINANCE_EXPENSE_EDIT_FORBIDDEN',
      403
    );
  }

  const current = expense.toObject();
  const normalized = normalizeExpenseData(payload, current);
  const branchRequested =
    payload.branchId !== undefined || payload.branch !== undefined;
  let branchUpdate = {};
  if (branchRequested) {
    const branchInfo = await financeService.resolveExpenseBranch(
      payload.branchId ?? payload.branch
    );
    branchUpdate = {
      branch: branchInfo.branch,
      branchSnapshot: branchInfo.snapshot,
    };
  }

  const effectiveBranch = branchRequested
    ? branchUpdate.branch
    : expense.branch;
  const costCenterRequested =
    payload.costCenterId !== undefined || payload.costCenter !== undefined;
  const planning = await financeBudgetService.prepareExpensePlanning(
    {
      ...normalized,
      branch: effectiveBranch,
      costCenterId: costCenterRequested
        ? payload.costCenterId ?? payload.costCenter
        : expense.costCenter,
    },
    { excludeExpenseId: expense._id }
  );

  const nextRevision = revision + 1;
  const resubmitting = expense.status === 'rejected';
  const nextStatus = 'pending';
  const event = workflowEvent({
    action: resubmitting ? 'resubmitted' : 'updated',
    fromStatus: expense.status,
    toStatus: nextStatus,
    actor: editor,
    notes:
      cleanText(payload.changeNotes, 500) ||
      (resubmitting
        ? 'Solicitud corregida y reenviada a aprobación.'
        : 'Solicitud actualizada antes de la decisión.'),
    revision: nextRevision,
  });

  const updated = await FinanceExpense.findOneAndUpdate(
    {
      ...buildResourceFilter(expenseId, scope),
      revision,
      status: expense.status,
    },
    {
      $set: {
        ...normalized,
        ...branchUpdate,
        ...planning,
        status: nextStatus,
        updatedBy: editor.id,
        ...(resubmitting
          ? {
              reviewedBy: null,
              reviewedBySnapshot: {},
              reviewedAt: null,
              reviewNotes: '',
              selfApprovalOverride: false,
              budgetOverride: { used: false },
              submittedAt: new Date(),
            }
          : {}),
      },
      $inc: { revision: 1 },
      $push: { workflow: event },
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    const latest = await loadExpense(expenseId, scope);
    assertCurrentRevision(latest, revision);
    throw createFinanceWorkflowError(
      'El estado del gasto cambió antes de guardar la corrección.',
      'FINANCE_EXPENSE_STATE_CONFLICT',
      409,
      { currentStatus: latest.status }
    );
  }

  return updated.toSafeObject();
}

async function reviewExpenseRequest(
  expenseId,
  payload = {},
  actor = {},
  scope = {}
) {
  const reviewer = actorContext(actor);
  const revision = expectedRevision(payload.expectedRevision);
  const decision = cleanLower(payload.decision, 20);
  if (!REVIEW_DECISIONS.has(decision)) {
    throw createFinanceWorkflowError(
      'La decisión debe ser aprobar o rechazar.',
      'FINANCE_EXPENSE_REVIEW_DECISION_INVALID',
      400
    );
  }

  const reviewNotes = cleanText(
    payload.reviewNotes || payload.notes || '',
    500
  );
  if (decision === 'reject' && !reviewNotes) {
    throw createFinanceWorkflowError(
      'Debes explicar el motivo del rechazo.',
      'FINANCE_EXPENSE_REVIEW_NOTES_REQUIRED',
      400
    );
  }

  const expense = await loadExpense(expenseId, scope);
  assertCurrentRevision(expense, revision);
  if (expense.status !== 'pending') {
    throw createFinanceWorkflowError(
      'Este gasto ya fue revisado y no admite una segunda decisión.',
      'FINANCE_EXPENSE_ALREADY_REVIEWED',
      409,
      { currentStatus: expense.status }
    );
  }

  const selfApproval = sameActor(expense, reviewer);
  if (selfApproval && !reviewer.owner) {
    throw createFinanceWorkflowError(
      'Quien solicita un gasto no puede aprobarlo ni rechazarlo.',
      'FINANCE_EXPENSE_SELF_APPROVAL_FORBIDDEN',
      403
    );
  }
  if (selfApproval && !reviewNotes) {
    throw createFinanceWorkflowError(
      'El propietario debe justificar la excepción de autoaprobación.',
      'FINANCE_EXPENSE_SELF_APPROVAL_REASON_REQUIRED',
      400
    );
  }

  const now = new Date();
  const nextStatus = decision === 'approve' ? 'paid' : 'rejected';
  const nextRevision = revision + 1;
  const persistDecision = async (
    budgetEvaluation = expense.budgetEvaluation || {},
    budgetOverride = expense.budgetOverride || { used: false }
  ) => {
    const event = workflowEvent({
      action: decision === 'approve' ? 'approved' : 'rejected',
      fromStatus: 'pending',
      toStatus: nextStatus,
      actor: reviewer,
      notes: reviewNotes,
      revision: nextRevision,
      selfApprovalOverride: selfApproval,
      budgetOutcome: budgetEvaluation?.outcome || '',
      budgetOverrideUsed: budgetOverride?.used === true,
      budgetOverrideReason: budgetOverride?.reason || '',
      at: now,
    });

    const updated = await FinanceExpense.findOneAndUpdate(
      {
        ...buildResourceFilter(expenseId, scope),
        revision,
        status: 'pending',
      },
      {
        $set: {
          status: nextStatus,
          reviewedBy: reviewer.id,
          reviewedBySnapshot: reviewer.snapshot,
          reviewedAt: now,
          reviewNotes,
          selfApprovalOverride: selfApproval,
          updatedBy: reviewer.id,
          ...(decision === 'approve'
            ? { budgetEvaluation, budgetOverride }
            : {}),
        },
        $inc: { revision: 1 },
        $push: { workflow: event },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      const latest = await loadExpense(expenseId, scope);
      assertCurrentRevision(latest, revision);
      throw createFinanceWorkflowError(
        'El gasto ya recibió una decisión en otra sesión.',
        'FINANCE_EXPENSE_ALREADY_REVIEWED',
        409,
        { currentStatus: latest.status }
      );
    }

    return updated.toSafeObject();
  };

  if (decision === 'reject') return persistDecision();

  return financeBudgetService.runExpenseApprovalControl({
    expense,
    actor: reviewer,
    overrideReason: payload.budgetOverrideReason,
    approve: persistDecision,
  });
}

async function cancelExpenseRequest(
  expenseId,
  payload = {},
  actor = {},
  scope = {}
) {
  const canceller = actorContext(actor);
  const revision = expectedRevision(payload.expectedRevision);
  const reason = cleanText(
    payload.cancellationReason || payload.reason || payload.notes || '',
    500
  );
  if (!reason) {
    throw createFinanceWorkflowError(
      'Debes indicar el motivo de la anulación.',
      'FINANCE_EXPENSE_CANCELLATION_REASON_REQUIRED',
      400
    );
  }

  const expense = await loadExpense(expenseId, scope);
  assertCurrentRevision(expense, revision);
  if (!CANCELLABLE_STATUSES.has(expense.status)) {
    throw createFinanceWorkflowError(
      'El gasto no se encuentra en un estado que permita anularlo.',
      'FINANCE_EXPENSE_CANCELLATION_NOT_ALLOWED',
      409,
      { currentStatus: expense.status }
    );
  }

  const now = new Date();
  const nextRevision = revision + 1;
  const event = workflowEvent({
    action: 'cancelled',
    fromStatus: expense.status,
    toStatus: 'cancelled',
    actor: canceller,
    notes: reason,
    revision: nextRevision,
    at: now,
  });

  const updated = await FinanceExpense.findOneAndUpdate(
    {
      ...buildResourceFilter(expenseId, scope),
      revision,
      status: expense.status,
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: canceller.id,
        cancelledBySnapshot: canceller.snapshot,
        cancellationReason: reason,
        updatedBy: canceller.id,
      },
      $inc: { revision: 1 },
      $push: { workflow: event },
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    const latest = await loadExpense(expenseId, scope);
    assertCurrentRevision(latest, revision);
    throw createFinanceWorkflowError(
      'El gasto cambió antes de completar la anulación.',
      'FINANCE_EXPENSE_STATE_CONFLICT',
      409,
      { currentStatus: latest.status }
    );
  }

  return updated.toSafeObject();
}

module.exports = {
  cancelExpenseRequest,
  createFinanceWorkflowError,
  requestExpense,
  reviewExpenseRequest,
  updateExpenseRequest,
  __test: {
    actorContext,
    expectedRevision,
    normalizeExpenseData,
    normalizeRequestKey,
    workflowEvent,
  },
};
