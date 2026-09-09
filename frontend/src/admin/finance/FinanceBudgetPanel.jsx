import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';

import {
  createFinanceBudget,
  createFinanceCostCenter,
  getFinanceBudgetControl,
  updateFinanceBudget,
  updateFinanceCostCenter,
} from './api/financeApi';
import './financeBudgetPanel.css';

const EXPENSE_TYPES = [
  ['operating', 'Operativo'],
  ['inventory_purchase', 'Compra de inventario'],
  ['shipping', 'Envíos'],
  ['marketing', 'Marketing'],
  ['payroll', 'Nómina'],
  ['rent', 'Arriendo'],
  ['utilities', 'Servicios'],
  ['tax', 'Impuestos'],
  ['fee', 'Comisiones'],
  ['other', 'Otro'],
];

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currency(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function expenseTypeLabel(value) {
  return EXPENSE_TYPES.find(([key]) => key === value)?.[1] || value || 'Gasto';
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.userMessage || fallback;
}

function lineStatus(line) {
  if (line.level === 'exceeded') return { label: 'Excedido', tone: 'danger' };
  if (line.level === 'warning') return { label: 'En alerta', tone: 'warning' };
  return { label: 'Utilización', tone: 'success' };
}

const emptyBudget = {
  costCenterId: '',
  expenseType: 'operating',
  amount: '',
  warningThresholdPercent: '80',
  changeReason: '',
};

function BudgetManagerModal({
  open,
  onClose,
  periodKey,
  selectedBranchId,
  branches,
  costCenters,
  lines,
  onSaved,
}) {
  const [centerForm, setCenterForm] = useState({ code: '', name: '', description: '' });
  const [budgetForm, setBudgetForm] = useState(emptyBudget);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open, saving]);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setBudgetForm(emptyBudget);
    }
  }, [open]);

  if (!open) return null;

  const selectedBranch = selectedBranchId
    ? branches.find((branch) => String(branch._id) === String(selectedBranchId))
    : null;

  const submitCenter = async (event) => {
    event.preventDefault();
    setSaving('center');
    try {
      await createFinanceCostCenter(centerForm);
      setCenterForm({ code: '', name: '', description: '' });
      toast.success('Centro de costo creado');
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo crear el centro de costo'));
    } finally {
      setSaving('');
    }
  };

  const toggleCenter = async (center) => {
    const nextStatus = center.status === 'active' ? 'inactive' : 'active';
    setSaving(`center-${center._id}`);
    try {
      await updateFinanceCostCenter(center._id, {
        expectedRevision: Number(center.revision || 0),
        status: nextStatus,
        changeReason:
          nextStatus === 'active'
            ? 'Centro de costo reactivado desde control presupuestal.'
            : 'Centro de costo desactivado desde control presupuestal.',
      });
      toast.success(nextStatus === 'active' ? 'Centro activado' : 'Centro desactivado');
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo actualizar el centro de costo'));
    } finally {
      setSaving('');
    }
  };

  const submitBudget = async (event) => {
    event.preventDefault();
    const amount = Number(budgetForm.amount || 0);
    if (amount <= 0) {
      toast.error('El presupuesto debe ser mayor a cero');
      return;
    }
    setSaving('budget');
    try {
      if (editing?._id) {
        await updateFinanceBudget(editing._id, {
          expectedRevision: Number(editing.revision || 0),
          amount,
          warningThresholdPercent: Number(budgetForm.warningThresholdPercent || 80),
          changeReason: budgetForm.changeReason,
        });
        toast.success('Presupuesto ajustado');
      } else {
        await createFinanceBudget({
          periodKey,
          branchId: selectedBranchId || null,
          costCenterId: budgetForm.costCenterId,
          expenseType: budgetForm.expenseType,
          amount,
          warningThresholdPercent: Number(budgetForm.warningThresholdPercent || 80),
        });
        toast.success('Presupuesto creado');
      }
      setEditing(null);
      setBudgetForm(emptyBudget);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar el presupuesto'));
    } finally {
      setSaving('');
    }
  };

  const startEdit = (line) => {
    setEditing(line);
    setBudgetForm({
      costCenterId: line.costCenter || '',
      expenseType: line.expenseType || 'operating',
      amount: String(line.amount || ''),
      warningThresholdPercent: String(line.warningThresholdPercent || 80),
      changeReason: '',
    });
  };

  return createPortal(
    <div className="finance-budget-overlay" role="dialog" aria-modal="true" aria-label="Configurar presupuesto">
      <div className="finance-budget-modal">
        <header className="finance-budget-modal__header">
          <div>
            <p className="finance-budget-eyebrow">Planificación financiera</p>
            <h3>Configurar presupuesto</h3>
            <p>{periodKey} · {selectedBranch?.name || 'Consolidado general'}</p>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(saving)} aria-label="Cerrar configuración">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="finance-budget-modal__body">
          <section className="finance-budget-manager-section">
            <div className="finance-budget-section-heading">
              <div><h4>Centros de costo</h4><p>Organiza dónde se consume el dinero.</p></div>
            </div>
            <form onSubmit={submitCenter} className="finance-budget-form">
              <div className="finance-budget-form__pair">
                <label>Código<input aria-label="Código del centro" value={centerForm.code} onChange={(event) => setCenterForm((value) => ({ ...value, code: event.target.value }))} placeholder="LOGISTICA" required /></label>
                <label>Nombre<input aria-label="Nombre del centro" value={centerForm.name} onChange={(event) => setCenterForm((value) => ({ ...value, name: event.target.value }))} placeholder="Logística" required /></label>
              </div>
              <label>Descripción<input aria-label="Descripción del centro" value={centerForm.description} onChange={(event) => setCenterForm((value) => ({ ...value, description: event.target.value }))} placeholder="Opcional" /></label>
              <button className="finance-budget-secondary-action" type="submit" disabled={Boolean(saving)}>
                {saving === 'center' ? <Loader2 className="animate-spin" /> : <Plus />}
                Crear centro
              </button>
            </form>

            <div className="finance-cost-center-list">
              {costCenters.length ? costCenters.map((center) => (
                <div key={center._id} className="finance-cost-center-row">
                  <div><strong>{center.name}</strong><small>{center.code} · {center.status === 'active' ? 'Activo' : 'Inactivo'}</small></div>
                  <button type="button" onClick={() => toggleCenter(center)} disabled={Boolean(saving)}>
                    {saving === `center-${center._id}` ? 'Guardando…' : center.status === 'active' ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              )) : <p className="finance-budget-empty">Crea el primer centro para asignar presupuestos.</p>}
            </div>
          </section>

          <section className="finance-budget-manager-section">
            <div className="finance-budget-section-heading">
              <div><h4>{editing ? 'Ajustar límite' : 'Asignar límite'}</h4><p>Define el monto mensual y su alerta.</p></div>
            </div>
            <form onSubmit={submitBudget} className="finance-budget-form">
              <label>Centro de costo
                <select aria-label="Centro de costo del presupuesto" value={budgetForm.costCenterId} onChange={(event) => setBudgetForm((value) => ({ ...value, costCenterId: event.target.value }))} required disabled={Boolean(editing)}>
                  <option value="">Selecciona un centro</option>
                  {costCenters.filter((center) => center.status === 'active').map((center) => <option key={center._id} value={center._id}>{center.name}</option>)}
                </select>
              </label>
              <label>Tipo de gasto
                <select aria-label="Tipo del presupuesto" value={budgetForm.expenseType} onChange={(event) => setBudgetForm((value) => ({ ...value, expenseType: event.target.value }))} disabled={Boolean(editing)}>
                  {EXPENSE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="finance-budget-form__pair">
                <label>Monto<input aria-label="Monto del presupuesto" type="number" min="1" value={budgetForm.amount} onChange={(event) => setBudgetForm((value) => ({ ...value, amount: event.target.value }))} required /></label>
                <label>Alerta (%)<input aria-label="Umbral de alerta" type="number" min="1" max="100" value={budgetForm.warningThresholdPercent} onChange={(event) => setBudgetForm((value) => ({ ...value, warningThresholdPercent: event.target.value }))} required /></label>
              </div>
              {editing ? <label>Motivo del ajuste<input aria-label="Motivo del ajuste" value={budgetForm.changeReason} onChange={(event) => setBudgetForm((value) => ({ ...value, changeReason: event.target.value }))} placeholder="Explica por qué cambia el límite" required /></label> : null}
              <div className="finance-budget-form__actions">
                {editing ? <button type="button" className="finance-budget-link-action" onClick={() => { setEditing(null); setBudgetForm(emptyBudget); }}>Cancelar ajuste</button> : null}
                <button className="finance-budget-primary-action" type="submit" disabled={Boolean(saving) || !budgetForm.costCenterId}>
                  {saving === 'budget' ? <Loader2 className="animate-spin" /> : editing ? <CheckCircle2 /> : <Plus />}
                  {editing ? 'Guardar ajuste' : 'Crear presupuesto'}
                </button>
              </div>
            </form>

            {lines.length ? <div className="finance-budget-edit-list">
              {lines.map((line) => <button type="button" key={line._id} onClick={() => startEdit(line)}>
                <span><strong>{line.costCenterSnapshot?.name}</strong><small>{expenseTypeLabel(line.expenseType)}</small></span>
                <span>{currency(line.amount)} <Edit3 /></span>
              </button>)}
            </div> : null}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function FinanceBudgetPanel({
  branches = [],
  selectedBranchId = '',
  costCenters = [],
  canManage = false,
  refreshKey = 0,
  onDataChanged,
}) {
  const [periodKey, setPeriodKey] = useState(currentPeriod);
  const [control, setControl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [managerOpen, setManagerOpen] = useState(false);

  const params = useMemo(() => ({
    periodKey,
    ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
  }), [periodKey, selectedBranchId]);

  const loadControl = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setControl(await getFinanceBudgetControl(params));
    } catch (requestError) {
      setError(errorMessage(requestError, 'No se pudo cargar el control presupuestal.'));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    loadControl();
  }, [loadControl, refreshKey]);

  const saved = async () => {
    await Promise.all([
      loadControl(),
      typeof onDataChanged === 'function' ? onDataChanged() : Promise.resolve(),
    ]);
  };

  const summary = control?.summary || {};
  const lines = Array.isArray(control?.lines) ? control.lines : [];
  const unbudgeted = Array.isArray(control?.unbudgeted) ? control.unbudgeted : [];

  return (
    <section className="finance-budget-panel">
      <BudgetManagerModal
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        periodKey={periodKey}
        selectedBranchId={selectedBranchId}
        branches={branches}
        costCenters={costCenters}
        lines={lines}
        onSaved={saved}
      />

      <header className="finance-budget-panel__header">
        <div className="finance-budget-panel__title">
          <span><BarChart3 aria-hidden="true" /></span>
          <div>
            <p className="finance-budget-eyebrow">Control presupuestal</p>
            <h2>Presupuesto mensual</h2>
            <p>Compara lo reservado, lo pagado y el saldo disponible.</p>
          </div>
        </div>
        <div className="finance-budget-panel__controls">
          <label>Mes<input aria-label="Mes presupuestal" type="month" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} /></label>
          {canManage ? <button type="button" onClick={() => setManagerOpen(true)}><Settings2 />Configurar</button> : null}
        </div>
      </header>

      {loading ? <div className="finance-budget-loading"><Loader2 className="animate-spin" />Calculando presupuesto real…</div> : null}
      {!loading && error ? <div className="finance-budget-error"><AlertTriangle />{error}<button type="button" onClick={loadControl}>Reintentar</button></div> : null}

      {!loading && !error ? <>
        <div className="finance-budget-summary" role="group" aria-label="Resumen presupuestal">
          <div><span>Asignado</span><strong>{currency(summary.allocatedAmount)}</strong></div>
          <div><span>Comprometido</span><strong>{currency(summary.committedAmount)}</strong></div>
          <div><span>Ejecutado</span><strong>{currency(summary.spentAmount)}</strong></div>
          <div data-negative={Number(summary.availableAmount || 0) < 0}><span>Disponible</span><strong>{currency(summary.availableAmount)}</strong></div>
        </div>

        {lines.length ? <div className="finance-budget-lines">
          {lines.map((line) => {
            const state = lineStatus(line);
            const width = Math.min(100, Math.max(0, Number(line.percentUsed || 0)));
            return <article key={line._id} className="finance-budget-line">
              <div className="finance-budget-line__identity">
                <strong>{line.costCenterSnapshot?.name || 'Centro de costo'}</strong>
                <span>{expenseTypeLabel(line.expenseType)} · {line.branchSnapshot?.name || 'General'}</span>
              </div>
              <div className="finance-budget-line__amounts"><span>{currency(line.spentAmount)} pagado</span><strong>{currency(line.availableAmount)} disponible</strong></div>
              <div className="finance-budget-line__progress"><i style={{ width: `${width}%` }} data-tone={state.tone} /></div>
              <div className="finance-budget-line__footer"><span>{currency(line.committedAmount)} comprometido</span><b data-tone={state.tone}>{state.label} · {Number(line.percentUsed || 0).toLocaleString('es-CO')}%</b></div>
            </article>;
          })}
        </div> : <div className="finance-budget-empty-state">
          <BarChart3 />
          <div><strong>Aún no hay presupuesto para este mes</strong><p>Los gastos existentes siguen funcionando y quedarán identificados hasta que configures sus límites.</p></div>
          {canManage ? <button type="button" onClick={() => setManagerOpen(true)}>Crear presupuesto</button> : null}
        </div>}

        {unbudgeted.length ? <div className="finance-budget-unbudgeted"><AlertTriangle /><div><strong>{unbudgeted.length} línea(s) sin presupuesto activo</strong><p>Revisa sus centros de costo antes de aprobar nuevos pagos.</p></div></div> : null}
      </> : null}
    </section>
  );
}
