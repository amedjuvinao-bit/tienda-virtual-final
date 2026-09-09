'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const FinancePeriodClose = require('../models/FinancePeriodClose');
const financeService = require('./adminFinanceService');
const financeBudgetService = require('./adminFinanceBudgetService');
const financeTreasuryService = require('./adminFinanceTreasuryService');

function cleanText(value, max = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 200) {
  return cleanText(value, max).toLowerCase();
}

function signedMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function toObjectId(value) {
  const source = value && typeof value === 'object' ? value._id || value.id : value;
  return mongoose.Types.ObjectId.isValid(String(source || ''))
    ? new mongoose.Types.ObjectId(String(source))
    : null;
}

function createClosingError(message, code, status = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function periodMeta(value, now = new Date()) {
  const periodKey = cleanText(value, 7);
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey);
  if (!match) {
    throw createClosingError(
      'El periodo del cierre debe tener el formato AAAA-MM.',
      'FINANCE_CLOSE_PERIOD_INVALID'
    );
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const endExclusive = new Date(Date.UTC(year, monthIndex + 1, 1));
  const end = new Date(endExclusive.getTime() - 1);
  const reference = new Date(now);
  if (Number.isNaN(reference.getTime())) {
    throw createClosingError(
      'La fecha de referencia del cierre no es válida.',
      'FINANCE_CLOSE_REFERENCE_DATE_INVALID'
    );
  }
  const currentStart = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    1
  ));
  if (start > currentStart) {
    throw createClosingError(
      'No se puede certificar un periodo futuro.',
      'FINANCE_CLOSE_FUTURE_PERIOD'
    );
  }

  return {
    periodKey,
    start,
    end,
    endExclusive,
    fromLocal: `${periodKey}-01`,
    toLocal: `${periodKey}-${String(new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()).padStart(2, '0')}`,
    status: end < currentStart ? 'certified' : 'provisional',
    label: end < currentStart ? 'Cierre mensual' : 'Corte provisional',
  };
}

function normalizeBranchIds(values) {
  if (!Array.isArray(values)) return null;
  return values.map(toObjectId).filter(Boolean).map(String);
}

function assertBranchScope(branchId, scope = {}) {
  const allowed = normalizeBranchIds(scope.branchIds);
  if (allowed !== null && !allowed.includes(String(branchId))) {
    throw createClosingError(
      'No tienes acceso al cierre financiero de esta sede.',
      'FINANCE_CLOSE_BRANCH_FORBIDDEN',
      403
    );
  }
}

async function resolveBranch(branchId, scope = {}) {
  const branch = toObjectId(branchId);
  if (!branch) {
    throw createClosingError(
      'Selecciona una sede para consultar o certificar el cierre.',
      'FINANCE_CLOSE_BRANCH_REQUIRED'
    );
  }
  assertBranchScope(branch, scope);
  const row = await Branch.findOne({
    _id: branch,
    deletedAt: null,
    active: true,
    status: 'active',
  }).select('name code type').lean();
  if (!row) {
    throw createClosingError(
      'La sede del cierre no existe o no está activa.',
      'FINANCE_CLOSE_BRANCH_NOT_AVAILABLE',
      409
    );
  }
  return row;
}

function control(code, label, status, actual, expected, message) {
  return { code, label, status, actual, expected, message };
}

function buildControls({ summary = {}, budget = {}, treasury = {} } = {}) {
  const kpis = summary.kpis || {};
  const cash = summary.cash || {};
  const budgetSummary = budget.summary || {};
  const treasurySummary = treasury.summary || {};
  const workflow = summary.expenses?.workflow || {};
  const grossEquation = signedMoney(
    Number(kpis.revenue || 0) - Number(kpis.cogs || 0)
  );
  const netEquation = signedMoney(
    Number(kpis.grossProfit || 0) - Number(kpis.operatingExpenses || 0)
  );
  const budgetEquation = signedMoney(
    Number(budgetSummary.allocatedAmount || 0) -
      Number(budgetSummary.committedAmount || 0) -
      Number(budgetSummary.spentAmount || 0)
  );
  const treasuryEquation = signedMoney(
    Number(treasurySummary.dueNext30Receivable || 0) -
      Number(treasurySummary.dueNext30Payable || 0)
  );
  const missingCosts = Number(kpis.costQuality?.missingCostItems || 0);
  const estimatedCosts = Number(kpis.costQuality?.estimatedCostItems || 0);
  const openSessions = Number(cash.openSessions || 0);
  const cashDifference = signedMoney(kpis.cashDifference);
  const pendingExpenses = Number(workflow.pending?.count || 0);
  const exceededBudgets = Number(budgetSummary.exceededCount || 0);
  const unbudgeted = Number(budgetSummary.unbudgetedCount || 0);
  const overdueReceivable = signedMoney(treasurySummary.overdueReceivable);
  const overduePayable = signedMoney(treasurySummary.overduePayable);

  const checks = [
    control(
      'gross_profit_equation',
      'Ingresos menos costos',
      grossEquation === signedMoney(kpis.grossProfit) ? 'ok' : 'blocker',
      grossEquation,
      signedMoney(kpis.grossProfit),
      'La utilidad bruta debe coincidir con ingresos netos menos costo neto.'
    ),
    control(
      'net_profit_equation',
      'Utilidad neta',
      netEquation === signedMoney(kpis.netProfit) ? 'ok' : 'blocker',
      netEquation,
      signedMoney(kpis.netProfit),
      'La utilidad neta debe coincidir con utilidad bruta menos gastos operativos.'
    ),
    control(
      'budget_equation',
      'Saldo presupuestal',
      budgetEquation === signedMoney(budgetSummary.availableAmount) ? 'ok' : 'blocker',
      budgetEquation,
      signedMoney(budgetSummary.availableAmount),
      'El disponible debe coincidir con asignado menos comprometido y ejecutado.'
    ),
    control(
      'treasury_projection_equation',
      'Proyección de tesorería',
      treasuryEquation === signedMoney(treasurySummary.projectedNet30) ? 'ok' : 'blocker',
      treasuryEquation,
      signedMoney(treasurySummary.projectedNet30),
      'El flujo próximo debe coincidir con cobros menos pagos por vencer.'
    ),
    control(
      'open_cash_sessions',
      'Sesiones de caja abiertas',
      openSessions === 0 ? 'ok' : 'blocker',
      openSessions,
      0,
      openSessions === 0
        ? 'No hay cajas abiertas dentro del periodo consultado.'
        : 'Cierra las sesiones de caja antes de certificar el periodo.'
    ),
    control(
      'cash_difference',
      'Diferencia de efectivo',
      cashDifference === 0 ? 'ok' : 'blocker',
      cashDifference,
      0,
      cashDifference === 0
        ? 'El efectivo contado coincide con el efectivo esperado.'
        : 'Existe una diferencia de caja pendiente de explicación.'
    ),
    control(
      'missing_product_costs',
      'Productos sin costo',
      missingCosts === 0 ? 'ok' : 'blocker',
      missingCosts,
      0,
      missingCosts === 0
        ? 'Los productos vendidos tienen costo disponible.'
        : 'La utilidad contiene productos sin costo disponible.'
    ),
    control(
      'estimated_product_costs',
      'Costos estimados',
      estimatedCosts === 0 ? 'ok' : 'warning',
      estimatedCosts,
      0,
      estimatedCosts === 0
        ? 'Todos los costos provienen del histórico de inventario.'
        : 'Algunos productos usan el costo actual como estimación.'
    ),
    control(
      'pending_expenses',
      'Gastos pendientes de aprobación',
      pendingExpenses === 0 ? 'ok' : 'warning',
      pendingExpenses,
      0,
      pendingExpenses === 0
        ? 'No hay solicitudes pendientes dentro del periodo.'
        : 'Existen solicitudes que todavía no afectan la utilidad.'
    ),
    control(
      'budget_exceptions',
      'Presupuestos excedidos',
      exceededBudgets === 0 ? 'ok' : 'warning',
      exceededBudgets,
      0,
      exceededBudgets === 0
        ? 'No hay líneas presupuestales excedidas.'
        : 'Hay líneas por encima del límite aprobado.'
    ),
    control(
      'unbudgeted_expenses',
      'Gastos sin presupuesto activo',
      unbudgeted === 0 ? 'ok' : 'warning',
      unbudgeted,
      0,
      unbudgeted === 0
        ? 'Los gastos están asociados a líneas presupuestales activas.'
        : 'Hay gastos o compromisos sin una línea presupuestal activa.'
    ),
    control(
      'overdue_treasury',
      'Cartera vencida',
      overdueReceivable === 0 && overduePayable === 0 ? 'ok' : 'warning',
      { receivable: overdueReceivable, payable: overduePayable },
      { receivable: 0, payable: 0 },
      overdueReceivable === 0 && overduePayable === 0
        ? 'No hay cobros ni pagos vencidos.'
        : 'Existen saldos vencidos que requieren seguimiento de tesorería.'
    ),
  ];

  const blockerCount = checks.filter((item) => item.status === 'blocker').length;
  const warningCount = checks.filter((item) => item.status === 'warning').length;
  return {
    status: blockerCount > 0 ? 'blocked' : warningCount > 0 ? 'attention' : 'ready',
    blockerCount,
    warningCount,
    okCount: checks.filter((item) => item.status === 'ok').length,
    checks,
  };
}

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function hashSnapshot(snapshot = {}) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(snapshot)))
    .digest('hex');
}

function buildSnapshot({ period, branch, summary, budget, treasury, readiness }) {
  const facts = {
    periodKey: period.periodKey,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    branch: {
      _id: String(branch._id),
      name: branch.name || '',
      code: branch.code || '',
      type: branch.type || '',
    },
    financial: {
      kpis: summary.kpis || {},
      sales: summary.sales || {},
      profit: summary.profit || {},
      cash: summary.cash || {},
      expenses: {
        manualTotal: summary.expenses?.manualTotal || 0,
        manualCount: summary.expenses?.manualCount || 0,
        workflow: summary.expenses?.workflow || {},
      },
    },
    budget: {
      summary: budget.summary || {},
      lines: Array.isArray(budget.lines) ? budget.lines.slice(0, 100) : [],
      unbudgeted: Array.isArray(budget.unbudgeted)
        ? budget.unbudgeted.slice(0, 100)
        : [],
    },
    treasury: {
      summary: treasury.summary || {},
      receivables: {
        count: treasury.receivables?.count || 0,
        amount: treasury.receivables?.amount || 0,
        aging: treasury.receivables?.aging || [],
      },
      payables: {
        count: treasury.payables?.count || 0,
        amount: treasury.payables?.amount || 0,
        aging: treasury.payables?.aging || [],
      },
    },
    readiness,
  };
  return { facts, snapshotHash: hashSnapshot(facts) };
}

function safeClose(close) {
  if (!close) return null;
  const value = typeof close.toSafeObject === 'function'
    ? close.toSafeObject()
    : { ...close };
  delete value.__v;
  return value;
}

async function getClosingControl(query = {}, scope = {}, options = {}) {
  const now = options.now || new Date();
  const period = periodMeta(query.periodKey || query.period, now);
  const branch = await resolveBranch(query.branchId || query.branch, scope);
  const reportQuery = {
    dateFrom: period.fromLocal,
    dateTo: period.toLocal,
    branchIds: [String(branch._id)],
  };
  const [summary, budget, treasury, storedClose] = await Promise.all([
    financeService.getFinanceSummary(reportQuery),
    financeBudgetService.getBudgetControl(
      { periodKey: period.periodKey },
      { branchIds: [String(branch._id)] }
    ),
    financeTreasuryService.getTreasury({
      branchIds: [String(branch._id)],
      asOf: period.status === 'provisional' ? now : period.end,
    }),
    FinancePeriodClose.findOne({
      closeKey: `${period.periodKey}:${String(branch._id)}`,
    }).lean(),
  ]);
  const readiness = buildControls({ summary, budget, treasury });
  const { facts, snapshotHash } = buildSnapshot({
    period,
    branch,
    summary,
    budget,
    treasury,
    readiness,
  });
  const close = safeClose(storedClose);
  return {
    generatedAt: new Date(now),
    period: {
      periodKey: period.periodKey,
      periodStart: period.start,
      periodEnd: period.end,
      status: period.status,
      label: period.label,
    },
    branch: facts.branch,
    snapshotHash,
    drifted: Boolean(
      close && (
        close.snapshotHash !== snapshotHash ||
        close.status !== period.status
      )
    ),
    readiness,
    financial: facts.financial,
    budget: facts.budget,
    treasury: facts.treasury,
    close,
  };
}

function actorContext(actor = {}) {
  const source = actor.snapshot || actor;
  const id = toObjectId(actor.adminUserId || actor.id || actor._id);
  if (!id) {
    throw createClosingError(
      'La certificación requiere un usuario administrativo identificado.',
      'FINANCE_CLOSE_ACTOR_REQUIRED',
      403
    );
  }
  return {
    id,
    snapshot: {
      username: cleanLower(source.username || actor.username, 80),
      displayName: cleanText(
        source.displayName || actor.displayName || source.username || actor.username || 'Administrador',
        160
      ),
      role: cleanLower(source.role || actor.role || actor.adminRole, 40),
      adminRole: cleanLower(
        source.adminRole || actor.adminRole || source.role || actor.role,
        40
      ),
    },
    canOverride: actor.canOverride === true,
  };
}

function expectedRevision(value) {
  if (value === '' || value === null || value === undefined) {
    throw createClosingError(
      'Debes enviar la versión vigente del cierre.',
      'FINANCE_CLOSE_REVISION_REQUIRED',
      428
    );
  }
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) {
    throw createClosingError(
      'Debes enviar la versión vigente del cierre.',
      'FINANCE_CLOSE_REVISION_REQUIRED',
      428
    );
  }
  return revision;
}

function certificationRequestKey(value) {
  const key = cleanLower(value, 128);
  if (key.length < 16) {
    throw createClosingError(
      'La certificación requiere una clave de solicitud válida.',
      'FINANCE_CLOSE_REQUEST_KEY_REQUIRED'
    );
  }
  return key;
}

function snapshotFromControl(controlData) {
  return {
    generatedAt: controlData.generatedAt,
    period: controlData.period,
    branch: controlData.branch,
    snapshotHash: controlData.snapshotHash,
    readiness: controlData.readiness,
    financial: controlData.financial,
    budget: controlData.budget,
    treasury: controlData.treasury,
  };
}

async function certifyPeriod(payload = {}, actor = {}, scope = {}) {
  const certifier = actorContext(actor);
  const requestKey = certificationRequestKey(payload.requestKey);
  const notes = cleanText(payload.notes, 1000);
  const overrideReason = cleanText(payload.overrideReason, 1000);
  const controlData = await getClosingControl(
    {
      periodKey: payload.periodKey || payload.period,
      branchId: payload.branchId || payload.branch,
    },
    scope
  );
  const closeKey = `${controlData.period.periodKey}:${controlData.branch._id}`;
  const current = await FinancePeriodClose.findOne({ closeKey });
  const replay = current?.certifications?.find(
    (item) => item.requestKey === requestKey
  );
  if (replay) {
    return { ...current.toSafeObject(), idempotentReplay: true };
  }
  if (
    current &&
    current.snapshotHash === controlData.snapshotHash &&
    current.status === controlData.period.status
  ) {
    return { ...current.toSafeObject(), unchanged: true };
  }

  const blocked = controlData.readiness.blockerCount > 0;
  if (blocked && (!certifier.canOverride || overrideReason.length < 12)) {
    throw createClosingError(
      certifier.canOverride
        ? 'Explica claramente por qué debe certificarse con controles pendientes.'
        : 'El periodo tiene controles bloqueantes y requiere una autorización excepcional.',
      'FINANCE_CLOSE_BLOCKED',
      409,
      {
        blockerCount: controlData.readiness.blockerCount,
        blockers: controlData.readiness.checks
          .filter((item) => item.status === 'blocker')
          .map((item) => item.code),
      }
    );
  }
  if (current && notes.length < 8) {
    throw createClosingError(
      'Explica el motivo de la nueva certificación del periodo.',
      'FINANCE_CLOSE_RECERTIFICATION_NOTES_REQUIRED'
    );
  }

  const at = new Date();
  const revision = current ? Number(current.revision || 0) + 1 : 0;
  const snapshot = snapshotFromControl(controlData);
  const event = {
    requestKey,
    revision,
    status: controlData.period.status,
    snapshotHash: controlData.snapshotHash,
    snapshot,
    notes,
    overrideUsed: blocked,
    overrideReason: blocked ? overrideReason : '',
    actor: certifier.id,
    actorSnapshot: certifier.snapshot,
    at,
  };

  if (!current) {
    try {
      const created = await FinancePeriodClose.create({
        closeKey,
        periodKey: controlData.period.periodKey,
        periodStart: controlData.period.periodStart,
        periodEnd: controlData.period.periodEnd,
        branch: toObjectId(controlData.branch._id),
        branchSnapshot: controlData.branch,
        status: controlData.period.status,
        revision,
        snapshotHash: controlData.snapshotHash,
        snapshot,
        certifiedAt: at,
        certifiedBy: certifier.id,
        certifiedBySnapshot: certifier.snapshot,
        certifications: [event],
      });
      return created.toSafeObject();
    } catch (error) {
      if (error?.code === 11000) {
        throw createClosingError(
          'Otra persona certificó este periodo. Recarga antes de continuar.',
          'FINANCE_CLOSE_VERSION_CONFLICT',
          409
        );
      }
      throw error;
    }
  }

  const revisionToReplace = expectedRevision(payload.expectedRevision);
  const updated = await FinancePeriodClose.findOneAndUpdate(
    { _id: current._id, revision: revisionToReplace },
    {
      $set: {
        status: controlData.period.status,
        revision,
        snapshotHash: controlData.snapshotHash,
        snapshot,
        certifiedAt: at,
        certifiedBy: certifier.id,
        certifiedBySnapshot: certifier.snapshot,
      },
      $push: { certifications: event },
    },
    { new: true, runValidators: true }
  );
  if (!updated) {
    throw createClosingError(
      'El cierre cambió antes de guardar. Recarga e inténtalo de nuevo.',
      'FINANCE_CLOSE_VERSION_CONFLICT',
      409
    );
  }
  return updated.toSafeObject();
}

function csvCell(value) {
  const serial = value && typeof value === 'object'
    ? JSON.stringify(value)
    : String(value ?? '');
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(serial)
    ? `'${serial}`
    : serial;
  return `"${safe.replace(/"/g, '""')}"`;
}

function buildExecutiveCsv(controlData = {}) {
  const kpis = controlData.financial?.kpis || {};
  const budget = controlData.budget?.summary || {};
  const treasury = controlData.treasury?.summary || {};
  const rows = [
    ['Sección', 'Indicador', 'Valor', 'Estado', 'Detalle'],
    ['Identificación', 'Periodo', controlData.period?.periodKey, controlData.period?.status, controlData.period?.label],
    ['Identificación', 'Sede', controlData.branch?.name, '', controlData.branch?.code],
    ['Resultados', 'Ingresos netos', kpis.revenue, '', ''],
    ['Resultados', 'Costo neto', kpis.cogs, '', ''],
    ['Resultados', 'Gastos operativos', kpis.operatingExpenses, '', ''],
    ['Resultados', 'Utilidad neta', kpis.netProfit, '', `Margen ${kpis.netMarginPercent || 0}%`],
    ['Presupuesto', 'Asignado', budget.allocatedAmount, '', ''],
    ['Presupuesto', 'Comprometido', budget.committedAmount, '', ''],
    ['Presupuesto', 'Ejecutado', budget.spentAmount, '', ''],
    ['Presupuesto', 'Disponible', budget.availableAmount, '', ''],
    ['Tesorería', 'Por cobrar', treasury.accountsReceivable, '', ''],
    ['Tesorería', 'Por pagar', treasury.accountsPayable, '', ''],
    ['Tesorería', 'Flujo próximo 30 días', treasury.projectedNet30, '', ''],
    ...(controlData.readiness?.checks || []).map((item) => [
      'Control',
      item.label,
      item.actual,
      item.status,
      item.message,
    ]),
    ['Trazabilidad', 'Huella SHA-256', controlData.snapshotHash, '', ''],
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
}

module.exports = {
  buildExecutiveCsv,
  certifyPeriod,
  createClosingError,
  getClosingControl,
  __test: {
    actorContext,
    assertBranchScope,
    buildControls,
    buildSnapshot,
    certificationRequestKey,
    expectedRevision,
    hashSnapshot,
    periodMeta,
    stableValue,
  },
};
