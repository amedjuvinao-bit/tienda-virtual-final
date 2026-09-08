// frontend/src/admin/finance/AdminFinancePage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  History,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';

import {
  cancelFinanceExpense,
  createFinanceExpense,
  exportFinanceCsv,
  getAdminBranches,
  getFinanceCash,
  getFinanceExpenses,
  getFinanceProfit,
  getFinanceSales,
  getFinanceSummary,
  reviewFinanceExpense,
  updateFinanceExpense,
} from './api/financeApi';
import useAdminPermissions from '../security/useAdminPermissions';

const RANGE_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'last_7_days', label: 'Últimos 7 días' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'previous_month', label: 'Mes anterior' },
  { value: 'this_year', label: 'Este año' },
];

const EXPENSE_TYPES = [
  { value: 'operating', label: 'Operativo' },
  { value: 'inventory_purchase', label: 'Compra inventario' },
  { value: 'shipping', label: 'Envíos' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'payroll', label: 'Nómina' },
  { value: 'rent', label: 'Arriendo' },
  { value: 'utilities', label: 'Servicios' },
  { value: 'tax', label: 'Impuestos' },
  { value: 'fee', label: 'Comisiones' },
  { value: 'other', label: 'Otro' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'mixed', label: 'Mixto' },
  { value: 'other', label: 'Otro' },
];

const EXPENSE_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'paid', label: 'Aprobados' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'cancelled', label: 'Anulados' },
];

const EXPENSE_STATUS_META = {
  pending: { label: 'Pendiente', tone: 'warning' },
  paid: { label: 'Aprobado', tone: 'success' },
  rejected: { label: 'Rechazado', tone: 'danger' },
  cancelled: { label: 'Anulado', tone: 'neutral' },
  draft: { label: 'Borrador', tone: 'neutral' },
};

const WORKFLOW_ACTION_LABELS = {
  submitted: 'Solicitud enviada',
  updated: 'Solicitud actualizada',
  resubmitted: 'Solicitud reenviada',
  approved: 'Gasto aprobado',
  rejected: 'Gasto rechazado',
  cancelled: 'Gasto anulado',
};

const emptyExpenseForm = {
  date: '',
  amount: '',
  type: 'operating',
  category: '',
  subcategory: '',
  description: '',
  vendor: '',
  invoiceNumber: '',
  reference: '',
  paymentMethod: 'cash',
  branchId: '',
  notes: '',
  requestKey: '',
};

function createRequestKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `finance-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-CO');
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('es-CO', {
    maximumFractionDigits: 1,
  })}%`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLabel(options, value, fallback = '—') {
  return options.find((item) => item.value === value)?.label || fallback;
}

function getRangeLabel(range) {
  return RANGE_OPTIONS.find((item) => item.value === range)?.label || 'Periodo';
}

function buildFinanceParams(filters) {
  const params = {};

  if (filters.dateFrom || filters.dateTo) {
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
  } else {
    params.range = filters.range || 'this_month';
  }

  if (filters.branchId) params.branchId = filters.branchId;

  return params;
}

function getExpenseBranchId(expense, fallback = '') {
  if (!expense) return fallback;
  if (typeof expense.branch === 'object' && expense.branch?._id) return String(expense.branch._id);
  if (expense.branch) return String(expense.branch);
  if (expense.branchId) return String(expense.branchId);
  return fallback;
}

function getAdminId(adminUser) {
  return String(adminUser?.id || adminUser?._id || adminUser?.profile?._id || '');
}

function getExpenseCreatorId(expense) {
  if (typeof expense?.createdBy === 'object') {
    return String(expense.createdBy?._id || expense.createdBy?.id || '');
  }
  return String(expense?.createdBy || '');
}

function expenseStatusMeta(status) {
  return EXPENSE_STATUS_META[status] || {
    label: status || 'Sin estado',
    tone: 'neutral',
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toneStyle(tone = 'neutral') {
  const tones = {
    primary: {
      background: 'var(--admin-primary-soft-bg)',
      color: 'var(--admin-primary)',
      borderColor: 'var(--admin-primary-soft-border)',
    },
    success: {
      background: 'var(--admin-success-soft-bg)',
      color: 'var(--admin-success-text)',
      borderColor: 'var(--admin-success-border)',
    },
    warning: {
      background: 'var(--admin-warning-soft-bg)',
      color: 'var(--admin-warning-text)',
      borderColor: 'var(--admin-warning-border)',
    },
    danger: {
      background: 'var(--admin-danger-soft-bg)',
      color: 'var(--admin-danger-text)',
      borderColor: 'var(--admin-danger-border)',
    },
    neutral: {
      background: 'var(--admin-button-soft-bg)',
      color: 'var(--admin-card-text)',
      borderColor: 'var(--admin-button-soft-border)',
    },
  };

  return tones[tone] || tones.neutral;
}

const styles = {
  page: {
    padding: 'var(--admin-padding)',
    color: 'var(--admin-card-text)',
  },
  shell: {
    border: '1px solid var(--admin-card-border)',
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    background: 'var(--admin-glass-bg)',
    boxShadow: 'var(--admin-glass-shadow)',
    overflow: 'hidden',
  },
  header: {
    borderBottom: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 88%, var(--admin-primary) 12%), var(--admin-card-bg))',
  },
  card: {
    border: '1px solid var(--admin-card-border)',
    borderRadius: 'calc(var(--admin-radius) + 5px)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 96%, var(--admin-primary) 4%), var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
    boxShadow: '0 14px 32px color-mix(in srgb, var(--admin-primary) 7%, transparent)',
  },
  softCard: {
    border: '1px solid var(--admin-card-border)',
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    background: 'color-mix(in srgb, var(--admin-card-bg) 90%, var(--admin-primary) 5%)',
  },
  input: {
    border: '1px solid var(--admin-input-border)',
    borderRadius: 999,
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  },
  textarea: {
    border: '1px solid var(--admin-input-border)',
    borderRadius: 'calc(var(--admin-radius) * 0.75)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  },
  muted: {
    color: 'var(--admin-card-muted-text)',
  },
  eyebrow: {
    color: 'var(--admin-primary)',
    letterSpacing: '0.22em',
  },
  primaryButton: {
    border: '1px solid var(--admin-button-bg)',
    borderRadius: 999,
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
    boxShadow: '0 12px 28px color-mix(in srgb, var(--admin-button-bg) 20%, transparent)',
  },
  softButton: {
    border: '1px solid var(--admin-button-soft-border)',
    borderRadius: 999,
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-card-text)',
  },
  dangerButton: {
    border: '1px solid var(--admin-danger)',
    borderRadius: 999,
    background: 'var(--admin-danger)',
    color: 'var(--admin-danger-text-on-bg)',
  },
  modalOverlay: {
    background: 'rgba(0,0,0,0.58)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  modalCard: {
    border: '1px solid var(--admin-card-border)',
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: '0 30px 90px rgba(0,0,0,0.30)',
  },
};

function FinanceMetricCard({ icon: Icon, label, value, sub, tone = 'primary' }) {
  return (
    <div className="p-4" style={styles.card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={styles.muted}>
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-black leading-none" style={{ color: 'var(--admin-card-text)' }}>
            {value}
          </p>
          <p className="mt-2 text-xs font-semibold" style={styles.muted}>
            {sub}
          </p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border" style={toneStyle(tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function BreakdownList({ title, rows = [], emptyText = 'Sin datos para este periodo' }) {
  const total = rows.reduce((acc, item) => acc + Number(item.amount || 0), 0);

  return (
    <div className="p-4" style={styles.card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={styles.eyebrow}>
            Distribución
          </p>
          <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
            {title}
          </h3>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-black" style={toneStyle('primary')}>
          {formatCurrency(total)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm font-semibold" style={styles.muted}>
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const percent = Number(row.percent || 0);
            return (
              <div key={row.key || row.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold capitalize" style={{ color: 'var(--admin-card-text)' }}>
                    {String(row.label || row.key || 'Sin definir').replace(/_/g, ' ')}
                  </span>
                  <span className="font-black" style={{ color: 'var(--admin-primary)' }}>
                    {formatCurrency(row.amount)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--admin-card-border) 60%, transparent)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, percent))}%`,
                      background:
                        'linear-gradient(90deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary) 55%, white 45%))',
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] font-semibold" style={styles.muted}>
                  {formatPercent(percent)} del total · {formatNumber(row.orders || 0)} órdenes
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExpenseForm({ branches, form, setForm, onSubmit, onCancel, saving, editing }) {
  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="border-l-4 px-4 py-3 text-sm font-semibold" style={{ ...styles.softCard, borderLeftColor: 'var(--admin-primary)' }} role="status">
        {editing
          ? 'Los cambios conservarán la trazabilidad y la solicitud volverá a revisión cuando haya sido rechazada.'
          : 'La solicitud quedará pendiente y solo afectará la utilidad cuando una persona autorizada la apruebe.'}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Fecha
          <input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input} required />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Valor
          <input type="number" min="0" value={form.amount} onChange={(event) => update('amount', event.target.value)} className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input} placeholder="0" required />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Tipo
          <select value={form.type} onChange={(event) => update('type', event.target.value)} className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input}>
            {EXPENSE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Método
          <select value={form.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value)} className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input}>
            {PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Categoría
          <input value={form.category} onChange={(event) => update('category', event.target.value)} className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input} placeholder="Ej: Transporte, empaque, publicidad" required />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Proveedor
          <input value={form.vendor} onChange={(event) => update('vendor', event.target.value)} className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input} placeholder="Opcional" />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Factura / soporte
          <input value={form.invoiceNumber} onChange={(event) => update('invoiceNumber', event.target.value)} className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input} placeholder="Opcional" />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Sede
          <select value={form.branchId} onChange={(event) => update('branchId', event.target.value)} className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input}>
            <option value="">General</option>
            {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name || branch.code || 'Sede'}</option>)}
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
        Descripción
        <textarea value={form.description} onChange={(event) => update('description', event.target.value)} className="min-h-[92px] w-full px-4 py-3 text-sm font-semibold normal-case tracking-normal" style={styles.textarea} placeholder="Explica claramente el concepto del gasto" required />
      </label>

      <label className="block space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
        Notas internas
        <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} className="min-h-[72px] w-full px-4 py-3 text-sm font-semibold normal-case tracking-normal" style={styles.textarea} placeholder="Observaciones internas opcionales" />
      </label>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--admin-card-border)' }}>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black transition hover:-translate-y-0.5" style={styles.softButton}>
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60" style={styles.primaryButton}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {editing ? 'Guardar solicitud' : 'Enviar a aprobación'}
        </button>
      </div>
    </form>
  );
}

function ExpenseModal({ open, branches, form, setForm, onSubmit, onCancel, saving, editing }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto px-4 py-8 sm:py-10" style={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl overflow-hidden" style={{ ...styles.modalCard, maxHeight: 'calc(100vh - 5rem)' }}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 md:px-6" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={styles.eyebrow}>{editing ? 'Editar gasto' : 'Nuevo gasto'}</p>
            <h3 className="mt-1 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>Registro financiero</h3>
            <p className="mt-1 text-sm font-semibold" style={styles.muted}>Registra egresos operativos para calcular utilidad neta real.</p>
          </div>

          <button type="button" onClick={onCancel} className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:-translate-y-0.5" style={styles.softButton} aria-label="Cerrar gasto">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 md:px-6" style={{ maxHeight: 'calc(100vh - 13rem)' }}>
          <ExpenseForm branches={branches} form={form} setForm={setForm} onSubmit={onSubmit} onCancel={onCancel} saving={saving} editing={editing} />
        </div>
      </div>
    </div>,
    document.body
  );
}

function ExpenseActionModal({
  action,
  expense,
  notes,
  setNotes,
  onConfirm,
  onCancel,
  saving,
  selfApproval = false,
}) {
  const open = Boolean(action && expense);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const rejecting = action === 'reject';
  const cancelling = action === 'cancel';
  const requiresNotes = rejecting || cancelling || selfApproval;
  const title = cancelling
    ? 'Anular gasto'
    : rejecting
      ? 'Rechazar solicitud'
      : 'Aprobar solicitud';
  const description = cancelling
    ? 'La anulación retirará este valor del resultado financiero y conservará el historial completo.'
    : rejecting
      ? 'La solicitud volverá a quien la registró para que pueda corregirla y reenviarla.'
      : selfApproval
        ? 'Como propietario estás resolviendo tu propia solicitud. La justificación quedará marcada como excepción de control.'
        : 'Al aprobar, el gasto será reconocido en la utilidad del periodo.';
  const Icon = cancelling || rejecting ? XCircle : UserCheck;
  const tone = cancelling || rejecting ? 'danger' : 'success';

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto p-4" style={styles.modalOverlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-xl overflow-hidden" style={styles.modalCard}>
        <div className="flex items-start gap-4 px-5 py-5" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border" style={toneStyle(tone)}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-relaxed" style={styles.muted}>{description}</p>
          </div>
          <button type="button" onClick={onCancel} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={styles.softButton} aria-label="Cerrar decisión">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]" style={styles.softCard}>
            <div className="min-w-0 p-4">
              <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{expense.category || 'Gasto'}</p>
              <p className="mt-1 text-xs font-semibold" style={styles.muted}>{expense.description || 'Sin descripción'}</p>
              <p className="mt-2 text-xs font-bold" style={styles.muted}>Solicitó {expense.createdBySnapshot?.displayName || expense.createdBySnapshot?.username || 'Administrador'}</p>
            </div>
            <p className="p-4 text-lg font-black" style={{ color: 'var(--admin-primary)' }}>{formatCurrency(expense.amount)}</p>
          </div>

          <label className="block space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
            {cancelling ? 'Motivo de anulación' : rejecting ? 'Motivo del rechazo' : selfApproval ? 'Justificación de la excepción' : 'Nota de aprobación'}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-[100px] w-full px-4 py-3 text-sm font-semibold normal-case tracking-normal"
              style={styles.textarea}
              placeholder={requiresNotes ? 'Escribe una justificación clara' : 'Opcional: deja constancia de la verificación realizada'}
              required={requiresNotes}
              autoFocus
            />
          </label>

          <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--admin-card-border)' }}>
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-black" style={styles.softButton}>Volver</button>
            <button type="button" onClick={onConfirm} disabled={saving || (requiresNotes && !notes.trim())} className="inline-flex items-center gap-2 px-5 py-2 text-sm font-black disabled:opacity-60" style={tone === 'danger' ? styles.dangerButton : styles.primaryButton}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {saving ? 'Guardando…' : cancelling ? 'Confirmar anulación' : rejecting ? 'Confirmar rechazo' : 'Confirmar aprobación'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ExpenseHistoryModal({ expense, onClose }) {
  const open = Boolean(expense);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const events = Array.isArray(expense.workflow) ? expense.workflow : [];
  const statusMeta = expenseStatusMeta(expense.status);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto p-4" style={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Trazabilidad del gasto">
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col overflow-hidden" style={styles.modalCard}>
        <div className="flex items-start justify-between gap-4 px-5 py-5" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={styles.eyebrow}>Trazabilidad financiera</p>
            <h3 className="mt-1 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>{expense.category || 'Gasto'} · {formatCurrency(expense.amount)}</h3>
            <p className="mt-1 text-sm font-semibold" style={styles.muted}>Versión {Number(expense.revision || 0)} · {statusMeta.label}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={styles.softButton} aria-label="Cerrar trazabilidad">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold" style={styles.muted}>Este registro pertenece al historial anterior y no tiene eventos detallados.</p>
          ) : (
            <div className="space-y-3">
              {events.map((event, index) => {
                const eventTone = event.action === 'approved' ? 'success' : ['rejected', 'cancelled'].includes(event.action) ? 'danger' : event.action === 'submitted' || event.action === 'resubmitted' ? 'warning' : 'neutral';
                return (
                  <div key={event._id || `${event.action}-${index}`} className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto]" style={styles.softCard}>
                    <span className="grid h-9 w-9 place-items-center rounded-xl border" style={toneStyle(eventTone)}>
                      {event.action === 'approved' ? <CheckCircle2 className="h-4 w-4" /> : ['rejected', 'cancelled'].includes(event.action) ? <XCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{WORKFLOW_ACTION_LABELS[event.action] || event.action}</p>
                      <p className="mt-1 text-xs font-semibold" style={styles.muted}>{event.actorSnapshot?.displayName || event.actorSnapshot?.username || 'Administrador'}{event.selfApprovalOverride ? ' · Excepción del propietario' : ''}</p>
                      {event.notes ? <p className="mt-2 text-xs font-semibold leading-relaxed" style={{ color: 'var(--admin-card-text)' }}>{event.notes}</p> : null}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-bold" style={styles.muted}>{formatDateTime(event.at)}</p>
                      <p className="mt-1 text-[10px] font-black uppercase" style={styles.muted}>Versión {Number(event.revision || 0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AdminFinancePage() {
  const { can, adminUser, role } = useAdminPermissions();
  const canManageExpenses = can('finance:expenses');
  const canApproveExpenses = can('finance:expenses:approve');
  const canCancelExpenses = can('finance:expenses:cancel');
  const canExport = can('finance:export');
  const [filters, setFilters] = useState({ range: 'this_month', dateFrom: '', dateTo: '', branchId: '' });
  const [expenseStatus, setExpenseStatus] = useState('all');
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState(null);
  const [profit, setProfit] = useState(null);
  const [cash, setCash] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({ ...emptyExpenseForm, date: todayInputValue(), requestKey: createRequestKey() });
  const [expenseAction, setExpenseAction] = useState(null);
  const [expenseActionNotes, setExpenseActionNotes] = useState('');
  const [savingExpenseAction, setSavingExpenseAction] = useState(false);
  const [historyExpense, setHistoryExpense] = useState(null);

  const queryParams = useMemo(() => buildFinanceParams(filters), [filters]);
  const kpis = summary?.kpis || {};
  const sourceRows = sales?.bySource || summary?.sales?.bySource || [];
  const paymentRows = sales?.byPaymentMethod || summary?.sales?.byPaymentMethod || [];
  const topProducts = profit?.byProduct || summary?.profit?.byProduct || [];
  const expenseRows = Array.isArray(expenses?.data) ? expenses.data : summary?.expenses?.latest || [];
  const workflowSummary = expenses?.workflow || summary?.expenses?.workflow || {};
  const currentAdminId = getAdminId(adminUser);
  const isOwner = String(role || adminUser?.adminRole || '').toLowerCase() === 'owner';

  const activePeriodLabel = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom || 'Inicio'} → ${filters.dateTo || 'Hoy'}`
    : getRangeLabel(filters.range);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [summaryData, salesData, profitData, cashData, expensesData, branchesData] = await Promise.all([
        getFinanceSummary(queryParams),
        getFinanceSales(queryParams),
        getFinanceProfit(queryParams),
        getFinanceCash(queryParams),
        getFinanceExpenses({ ...queryParams, status: expenseStatus, limit: 20 }),
        getAdminBranches().catch(() => []),
      ]);

      setSummary(summaryData || null);
      setSales(salesData || null);
      setProfit(profitData || null);
      setCash(cashData || null);
      setExpenses(expensesData || null);
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch (err) {
      console.error('Error cargando finanzas admin:', err);
      setError(err?.response?.data?.message || err?.userMessage || 'No se pudo cargar el módulo financiero.');
    } finally {
      setLoading(false);
    }
  }, [expenseStatus, queryParams]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  const updateFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  const clearCustomDates = () => setFilters((prev) => ({ ...prev, dateFrom: '', dateTo: '' }));

  const closeExpenseModal = useCallback(() => {
    setEditingExpense(null);
    setExpenseForm({ ...emptyExpenseForm, date: todayInputValue(), branchId: filters.branchId || '', requestKey: createRequestKey() });
    setExpenseModalOpen(false);
  }, [filters.branchId]);

  const openCreateExpenseForm = () => {
    setEditingExpense(null);
    setExpenseForm({ ...emptyExpenseForm, date: todayInputValue(), branchId: filters.branchId || '', requestKey: createRequestKey() });
    setExpenseModalOpen(true);
  };

  const openEditExpenseForm = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      date: expense?.date ? String(expense.date).slice(0, 10) : todayInputValue(),
      amount: String(expense?.amount ?? ''),
      type: expense?.type || 'operating',
      category: expense?.category || '',
      subcategory: expense?.subcategory || '',
      description: expense?.description || '',
      vendor: expense?.vendor || '',
      invoiceNumber: expense?.invoiceNumber || '',
      reference: expense?.reference || '',
      paymentMethod: expense?.paymentMethod || 'cash',
      branchId: getExpenseBranchId(expense, filters.branchId || ''),
      notes: expense?.notes || '',
      requestKey: expense?.requestKey || '',
    });
    setExpenseModalOpen(true);
  };

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();

    const amount = Number(expenseForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('El valor del gasto debe ser mayor a cero');
      return;
    }
    if (!expenseForm.description.trim()) {
      toast.error('Debes explicar el concepto del gasto');
      return;
    }

    setSavingExpense(true);

    try {
      const payload = {
        ...expenseForm,
        amount,
        branchId: expenseForm.branchId || null,
        ...(editingExpense?._id
          ? { expectedRevision: Number(editingExpense.revision || 0) }
          : {}),
      };

      if (editingExpense?._id) {
        await updateFinanceExpense(editingExpense._id, payload);
        toast.success(editingExpense.status === 'rejected' ? 'Solicitud corregida y reenviada' : 'Solicitud actualizada');
      } else {
        await createFinanceExpense(payload);
        toast.success('Gasto enviado a aprobación');
      }

      closeExpenseModal();
      await loadFinance();
    } catch (err) {
      console.error('Error guardando gasto financiero:', err);
      toast.error(err?.response?.data?.message || err?.userMessage || 'No se pudo guardar el gasto');
    } finally {
      setSavingExpense(false);
    }
  };

  const closeExpenseAction = useCallback(() => {
    if (savingExpenseAction) return;
    setExpenseAction(null);
    setExpenseActionNotes('');
  }, [savingExpenseAction]);

  const openExpenseAction = (expense, action) => {
    setExpenseAction({ expense, action });
    setExpenseActionNotes('');
  };

  const handleExpenseAction = async () => {
    const expense = expenseAction?.expense;
    const action = expenseAction?.action;
    if (!expense?._id || !action) return;

    setSavingExpenseAction(true);
    try {
      if (action === 'cancel') {
        await cancelFinanceExpense(expense._id, {
          expectedRevision: Number(expense.revision || 0),
          cancellationReason: expenseActionNotes,
        });
        toast.success('Gasto anulado con trazabilidad');
      } else {
        await reviewFinanceExpense(expense._id, {
          expectedRevision: Number(expense.revision || 0),
          decision: action,
          reviewNotes: expenseActionNotes,
        });
        toast.success(action === 'approve' ? 'Gasto aprobado' : 'Solicitud rechazada');
      }

      setExpenseAction(null);
      setExpenseActionNotes('');
      await loadFinance();
    } catch (err) {
      console.error('Error resolviendo gasto financiero:', err);
      toast.error(err?.response?.data?.message || err?.userMessage || 'No se pudo completar la decisión');
      if (err?.response?.status === 409) await loadFinance();
    } finally {
      setSavingExpenseAction(false);
    }
  };

  const handleExport = async (type) => {
    setExporting(type);

    try {
      const blob = await exportFinanceCsv(type, queryParams);
      const suffix = type === 'expenses' ? 'gastos' : 'ventas';
      downloadBlob(blob, `finanzas-${suffix}.csv`);
      toast.success('Archivo CSV generado');
    } catch (err) {
      console.error('Error exportando finanzas:', err);
      toast.error(err?.response?.data?.message || err?.userMessage || 'No se pudo exportar');
    } finally {
      setExporting('');
    }
  };

  return (
    <div style={styles.page}>
      {canManageExpenses ? (
        <ExpenseModal
          open={expenseModalOpen}
          branches={branches}
          form={expenseForm}
          setForm={setExpenseForm}
          onSubmit={handleExpenseSubmit}
          onCancel={closeExpenseModal}
          saving={savingExpense}
          editing={Boolean(editingExpense)}
        />
      ) : null}

      <ExpenseActionModal
        action={expenseAction?.action || ''}
        expense={expenseAction?.expense || null}
        notes={expenseActionNotes}
        setNotes={setExpenseActionNotes}
        onConfirm={handleExpenseAction}
        onCancel={closeExpenseAction}
        saving={savingExpenseAction}
        selfApproval={Boolean(
          expenseAction?.action === 'approve' &&
            currentAdminId &&
            getExpenseCreatorId(expenseAction?.expense) === currentAdminId &&
            isOwner
        )}
      />

      <ExpenseHistoryModal
        expense={historyExpense}
        onClose={() => setHistoryExpense(null)}
      />

      <div style={styles.shell}>
        <div className="px-5 py-5 md:px-7 md:py-6" style={styles.header}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase" style={styles.eyebrow}>Centro financiero</p>
              <h1 className="mt-1 text-3xl font-black leading-tight" style={{ color: 'var(--admin-card-text)' }}>Finanzas</h1>
              <p className="mt-2 text-sm leading-relaxed" style={styles.muted}>Controla ingresos, costos, caja, gastos y utilidad con datos reales de órdenes, POS e inventario.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canExport ? (
                <>
                  <button type="button" onClick={() => handleExport('sales')} disabled={Boolean(exporting)} className="inline-flex items-center gap-2 px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60" style={styles.softButton}>
                    {exporting === 'sales' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Ventas CSV
                  </button>
                  <button type="button" onClick={() => handleExport('expenses')} disabled={Boolean(exporting)} className="inline-flex items-center gap-2 px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60" style={styles.softButton}>
                    {exporting === 'expenses' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Gastos CSV
                  </button>
                </>
              ) : null}
              {canManageExpenses ? (
                <button type="button" onClick={openCreateExpenseForm} className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition hover:-translate-y-0.5" style={styles.primaryButton}>
                  <Plus className="h-4 w-4" />
                  Nuevo gasto
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[180px_160px_160px_1fr_auto]">
            <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
              Periodo
              <select value={filters.range} onChange={(event) => updateFilter('range', event.target.value)} className="h-12 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input} disabled={Boolean(filters.dateFrom || filters.dateTo)}>
                {RANGE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
              Desde
              <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} className="h-12 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input} />
            </label>

            <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
              Hasta
              <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} className="h-12 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input} />
            </label>

            <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
              Sede
              <select value={filters.branchId} onChange={(event) => updateFilter('branchId', event.target.value)} className="h-12 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input}>
                <option value="">Todas las sedes</option>
                {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name || branch.code || 'Sede'}</option>)}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button type="button" onClick={loadFinance} className="inline-flex h-12 items-center gap-2 px-4 text-sm font-black transition hover:-translate-y-0.5" style={styles.softButton}>
                <RefreshCw className="h-4 w-4" />
                Actualizar
              </button>
              {(filters.dateFrom || filters.dateTo) && (
                <button type="button" onClick={clearCustomDates} className="grid h-12 w-12 place-items-center rounded-full transition hover:-translate-y-0.5" style={styles.softButton} aria-label="Limpiar fechas">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold" style={styles.muted}>
            <Filter className="h-4 w-4" />
            Periodo activo: <span style={{ color: 'var(--admin-primary)' }}>{activePeriodLabel}</span>
          </div>
        </div>

        {error ? (
          <div className="m-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold" style={toneStyle('danger')}>
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid min-h-[420px] place-items-center p-10">
            <div className="text-center">
              <Loader2 className="mx-auto h-9 w-9 animate-spin" style={{ color: 'var(--admin-primary)' }} />
              <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Cargando información financiera real…</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-5 py-5 md:px-7 md:py-6">
            {(kpis.costQuality?.usesEstimatedCosts || kpis.costQuality?.hasMissingCosts) && (
              <div className="flex items-start gap-3 border-l-4 px-4 py-3 text-sm" style={{ ...styles.softCard, borderLeftColor: 'var(--admin-warning)' }} role="status">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--admin-warning-text)' }} />
                <div>
                  <p className="font-black" style={{ color: 'var(--admin-card-text)' }}>Costo histórico incompleto</p>
                  <p className="mt-1 font-semibold" style={styles.muted}>
                    {kpis.costQuality?.estimatedCostItems || 0} producto(s) usan el costo actual como estimación y {kpis.costQuality?.missingCostItems || 0} no tienen costo disponible. La utilidad los identifica para no presentarlos como datos certificados.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard icon={ArrowUpRight} label="Ingresos netos" value={formatCurrency(kpis.revenue)} sub={`Bruto ${formatCurrency(kpis.grossRevenue)} · Devoluciones ${formatCurrency(kpis.refunds)}`} tone="success" />
              <FinanceMetricCard icon={ReceiptText} label="Costos netos" value={formatCurrency(kpis.cogs)} sub={`Costo devuelto ${formatCurrency(kpis.returnedCogs)} · Margen ${formatPercent(kpis.grossMarginPercent)}`} tone="primary" />
              <FinanceMetricCard icon={ArrowDownRight} label="Gastos" value={formatCurrency(kpis.operatingExpenses)} sub={`Manual ${formatCurrency(kpis.manualExpenses)} · Caja ${formatCurrency(kpis.cashOperatingExpenses)}`} tone="warning" />
              <FinanceMetricCard icon={CircleDollarSign} label="Utilidad neta" value={formatCurrency(kpis.netProfit)} sub={`Margen neto ${formatPercent(kpis.netMarginPercent)}`} tone={Number(kpis.netProfit || 0) >= 0 ? 'success' : 'danger'} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <BreakdownList title="Ventas POS vs Web" rows={sourceRows} />
              <BreakdownList title="Métodos de pago" rows={paymentRows} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <div className="p-4" style={styles.card}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={styles.eyebrow}>Rentabilidad</p>
                    <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Productos con mayor utilidad</h3>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-black" style={toneStyle('success')}>Bruta {formatCurrency(kpis.grossProfit)}</span>
                </div>

                {topProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm font-semibold" style={styles.muted}>Sin productos vendidos en este periodo.</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.slice(0, 8).map((product) => (
                      <div key={product.productId || product.title} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto]" style={styles.softCard}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{product.title || 'Producto'}</p>
                          <p className="mt-1 text-xs font-semibold" style={styles.muted}>{formatNumber(product.qty)} uds · Venta {formatCurrency(product.revenue)} · Costo {formatCurrency(product.cogs)}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-black" style={{ color: 'var(--admin-primary)' }}>{formatCurrency(product.grossProfit)}</p>
                          <p className="text-xs font-bold" style={styles.muted}>{formatPercent(product.grossMarginPercent)} margen</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4" style={styles.card}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={styles.eyebrow}>Caja POS</p>
                    <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Resumen de caja</h3>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border" style={toneStyle('primary')}>
                    <WalletCards className="h-5 w-5" />
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Sesiones', value: formatNumber(cash?.sessionsCount || summary?.cash?.sessionsCount), sub: `${formatNumber(cash?.openSessions || summary?.cash?.openSessions)} abiertas` },
                    { label: 'Efectivo esperado', value: formatCurrency(cash?.expectedCash || summary?.cash?.expectedCash), sub: 'Según caja POS' },
                    { label: 'Efectivo contado', value: formatCurrency(cash?.countedCash || summary?.cash?.countedCash), sub: 'Cierres registrados' },
                    { label: 'Diferencia', value: formatCurrency(kpis.cashDifference), sub: 'Esperado vs contado' },
                  ].map((item) => (
                    <div key={item.label} className="p-3" style={styles.softCard}>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>{item.label}</p>
                      <p className="mt-2 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>{item.value}</p>
                      <p className="mt-1 text-xs font-semibold" style={styles.muted}>{item.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {Object.entries(cash?.paymentTotals || summary?.cash?.paymentTotals || {})
                    .filter(([key]) => key !== 'total')
                    .map(([key, value]) => (
                      <div key={key} className="rounded-2xl border px-3 py-2" style={toneStyle('neutral')}>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em]">{key}</p>
                        <p className="mt-1 text-sm font-black">{formatCurrency(value)}</p>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="finance-expense-workflow overflow-hidden" style={styles.card}>
              <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-4 md:px-5" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={styles.eyebrow}>Control de gastos</p>
                  <h3 className="mt-1 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>Solicitudes y aprobaciones</h3>
                  <p className="mt-1 text-sm font-semibold" style={styles.muted}>Solo los gastos aprobados se incluyen en la utilidad neta.</p>
                </div>

                <label className="w-full space-y-1 text-xs font-black uppercase tracking-[0.08em] sm:w-[220px]" style={styles.muted}>
                  Mostrar
                  <select value={expenseStatus} onChange={(event) => setExpenseStatus(event.target.value)} className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal" style={styles.input}>
                    {EXPENSE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderBottom: '1px solid var(--admin-card-border)' }}>
                {[
                  { key: 'pending', label: 'Pendientes', tone: 'warning' },
                  { key: 'paid', label: 'Aprobados', tone: 'success' },
                  { key: 'rejected', label: 'Rechazados', tone: 'danger' },
                  { key: 'cancelled', label: 'Anulados', tone: 'neutral' },
                ].map((item, index) => (
                  <div key={item.key} className="px-4 py-3 md:px-5" style={{ borderRight: index === 3 ? 'none' : '1px solid var(--admin-card-border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: toneStyle(item.tone).color }} />
                      <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={styles.muted}>{item.label}</p>
                    </div>
                    <p className="mt-1 text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>{formatNumber(workflowSummary[item.key]?.count || 0)} · {formatCurrency(workflowSummary[item.key]?.amount || 0)}</p>
                  </div>
                ))}
              </div>

              {expenseRows.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock3 className="mx-auto h-7 w-7" style={styles.muted} />
                  <p className="mt-3 text-sm font-semibold" style={styles.muted}>No hay gastos en este estado y periodo.</p>
                  {canManageExpenses && expenseStatus === 'all' ? (
                    <button type="button" onClick={openCreateExpenseForm} className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-black" style={styles.primaryButton}><Plus className="h-4 w-4" />Nueva solicitud</button>
                  ) : null}
                </div>
              ) : (
                <div className="finance-expense-table-shell overflow-x-auto">
                  <table className="finance-expense-table w-full min-w-[1040px] text-left text-sm">
                    <thead>
                      <tr style={{ color: 'var(--admin-card-muted-text)' }}>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Fecha</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Solicitud</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Estado</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Valor</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Responsables</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseRows.map((expense) => {
                        const statusMeta = expenseStatusMeta(expense.status);
                        const creatorId = getExpenseCreatorId(expense);
                        const ownExpense = Boolean(currentAdminId && creatorId === currentAdminId);
                        const privilegedEditor = ['owner', 'admin'].includes(String(role || adminUser?.adminRole || '').toLowerCase());
                        const editable = canManageExpenses && ['pending', 'rejected'].includes(expense.status) && (ownExpense || privilegedEditor || !creatorId);
                        const reviewable = canApproveExpenses && expense.status === 'pending' && (!ownExpense || isOwner);
                        const cancellable = canCancelExpenses && ['pending', 'rejected', 'paid'].includes(expense.status);

                        return (
                          <tr key={expense._id} style={{ borderTop: '1px solid var(--admin-card-border)' }}>
                            <td className="px-4 py-4 font-bold" style={{ color: 'var(--admin-card-text)' }}>
                              {formatDate(expense.date)}
                              <p className="mt-1 text-[10px] font-bold" style={styles.muted}>v{Number(expense.revision || 0)}</p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-black" style={{ color: 'var(--admin-card-text)' }}>{expense.category || 'General'}</p>
                              <p className="mt-1 max-w-[280px] truncate text-xs font-semibold" style={styles.muted}>{expense.description || expense.vendor || 'Sin descripción'}</p>
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={styles.muted}>{getLabel(EXPENSE_TYPES, expense.type, expense.type)}</p>
                            </td>
                            <td className="px-4 py-4"><span className="inline-flex border px-3 py-1 text-xs font-black" style={{ ...toneStyle(statusMeta.tone), borderRadius: 'calc(var(--admin-radius) * 0.65)' }}>{statusMeta.label}</span></td>
                            <td className="px-4 py-4 text-base font-black" style={{ color: 'var(--admin-primary)' }}>{formatCurrency(expense.amount)}</td>
                            <td className="px-4 py-4">
                              <p className="finance-expense-responsive-label">Responsables</p>
                              <p className="text-xs font-black" style={{ color: 'var(--admin-card-text)' }}>{expense.createdBySnapshot?.displayName || expense.createdBySnapshot?.username || 'Registro anterior'}</p>
                              <p className="mt-1 text-xs font-semibold" style={styles.muted}>{expense.reviewedBySnapshot?.displayName || expense.reviewedBySnapshot?.username ? `Revisó ${expense.reviewedBySnapshot.displayName || expense.reviewedBySnapshot.username}` : 'Sin revisión'}</p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="finance-expense-responsive-label">Acciones disponibles</p>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => setHistoryExpense(expense)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black" style={styles.softButton}><History className="h-3.5 w-3.5" />Historial</button>
                                {editable ? <button type="button" onClick={() => openEditExpenseForm(expense)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black" style={styles.softButton}><Edit3 className="h-3.5 w-3.5" />Corregir</button> : null}
                                {reviewable ? <button type="button" onClick={() => openExpenseAction(expense, 'approve')} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black" style={styles.primaryButton}><CheckCircle2 className="h-3.5 w-3.5" />Aprobar</button> : null}
                                {reviewable ? <button type="button" onClick={() => openExpenseAction(expense, 'reject')} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black" style={styles.softButton}><XCircle className="h-3.5 w-3.5" />Rechazar</button> : null}
                                {cancellable ? <button type="button" onClick={() => openExpenseAction(expense, 'cancel')} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black" style={styles.dangerButton}><Trash2 className="h-3.5 w-3.5" />Anular</button> : null}
                              </div>
                              {canApproveExpenses && expense.status === 'pending' && ownExpense && !isOwner ? <p className="mt-2 max-w-[240px] text-[10px] font-bold" style={styles.muted}>Debe revisarlo otra persona autorizada.</p> : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4" style={styles.card}>
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl border" style={toneStyle('primary')}><CalendarDays className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>Rango técnico</p><p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{formatDate(summary?.dateRange?.fromISO)} → {formatDate(summary?.dateRange?.toISO)}</p></div></div>
              </div>
              <div className="p-4" style={styles.card}>
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl border" style={toneStyle('success')}><Banknote className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>Ventas netas caja</p><p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{formatCurrency(cash?.netSales || summary?.cash?.netSales)}</p></div></div>
              </div>
              <div className="p-4" style={styles.card}>
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl border" style={toneStyle('primary')}><Store className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>Sede filtrada</p><p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{filters.branchId ? branches.find((branch) => String(branch._id) === String(filters.branchId))?.name || 'Sede seleccionada' : 'Todas las sedes'}</p></div></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
