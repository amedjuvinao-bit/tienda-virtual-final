// frontend/src/admin/finance/AdminFinancePage.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  Landmark,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Store,
  Trash2,
  WalletCards,
  X,
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
  updateFinanceExpense,
} from './api/financeApi';

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
};

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
      background: 'color-mix(in srgb, #22c55e 13%, var(--admin-card-bg))',
      color: 'color-mix(in srgb, #22c55e 76%, var(--admin-card-text))',
      borderColor: 'color-mix(in srgb, #22c55e 55%, var(--admin-card-border))',
    },
    warning: {
      background: 'var(--admin-warning-soft-bg)',
      color: 'var(--admin-warning-text)',
      borderColor: 'color-mix(in srgb, var(--admin-warning) 58%, var(--admin-card-border))',
    },
    danger: {
      background: 'var(--admin-danger-soft-bg)',
      color: 'var(--admin-danger-text)',
      borderColor: 'color-mix(in srgb, var(--admin-danger) 58%, var(--admin-card-border))',
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
    border:
      '1px solid color-mix(in srgb, var(--admin-button-bg) 72%, rgba(255,255,255,0.45) 28%)',
    borderRadius: 999,
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-button-bg) 88%, #0f172a 12%), color-mix(in srgb, var(--admin-button-bg) 66%, #0f172a 34%))',
    color: '#ffffff',
    boxShadow:
      '0 14px 30px color-mix(in srgb, var(--admin-button-bg) 20%, transparent), inset 0 1px 0 rgba(255,255,255,0.28)',
    textShadow: '0 1px 8px rgba(0,0,0,0.38)',
  },
  softButton: {
    border: '1px solid var(--admin-button-soft-border)',
    borderRadius: 999,
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-card-text)',
  },
  dangerButton: {
    border:
      '1px solid color-mix(in srgb, var(--admin-danger) 70%, rgba(255,255,255,0.30) 30%)',
    borderRadius: 999,
    background:
      'linear-gradient(135deg, var(--admin-danger), color-mix(in srgb, var(--admin-danger) 78%, #0f172a 22%))',
    color: '#ffffff',
    textShadow: '0 1px 8px rgba(0,0,0,0.38)',
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
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border"
          style={toneStyle(tone)}
        >
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
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--admin-card-border) 60%, transparent)' }}
                >
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
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Fecha
          <input
            type="date"
            value={form.date}
            onChange={(event) => update('date', event.target.value)}
            className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal"
            style={styles.input}
            required
          />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Valor
          <input
            type="number"
            min="0"
            value={form.amount}
            onChange={(event) => update('amount', event.target.value)}
            className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal"
            style={styles.input}
            placeholder="0"
            required
          />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Tipo
          <select
            value={form.type}
            onChange={(event) => update('type', event.target.value)}
            className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal"
            style={styles.input}
          >
            {EXPENSE_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Método
          <select
            value={form.paymentMethod}
            onChange={(event) => update('paymentMethod', event.target.value)}
            className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal"
            style={styles.input}
          >
            {PAYMENT_METHODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Categoría
          <input
            value={form.category}
            onChange={(event) => update('category', event.target.value)}
            className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal"
            style={styles.input}
            placeholder="Ej: Transporte, empaque, publicidad"
            required
          />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Proveedor
          <input
            value={form.vendor}
            onChange={(event) => update('vendor', event.target.value)}
            className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal"
            style={styles.input}
            placeholder="Opcional"
          />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Factura / soporte
          <input
            value={form.invoiceNumber}
            onChange={(event) => update('invoiceNumber', event.target.value)}
            className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal"
            style={styles.input}
            placeholder="Opcional"
          />
        </label>

        <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
          Sede
          <select
            value={form.branchId}
            onChange={(event) => update('branchId', event.target.value)}
            className="h-11 w-full px-4 text-sm font-bold normal-case tracking-normal"
            style={styles.input}
          >
            <option value="">General</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name || branch.code || 'Sede'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
        Descripción
        <textarea
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          className="min-h-[92px] w-full px-4 py-3 text-sm font-semibold normal-case tracking-normal"
          style={styles.textarea}
          placeholder="Detalle del gasto"
        />
      </label>

      <label className="block space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
        Notas internas
        <textarea
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          className="min-h-[72px] w-full px-4 py-3 text-sm font-semibold normal-case tracking-normal"
          style={styles.textarea}
          placeholder="Observaciones internas opcionales"
        />
      </label>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--admin-card-border)' }}>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black transition hover:-translate-y-0.5"
          style={styles.softButton}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60"
          style={styles.primaryButton}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {editing ? 'Guardar cambios' : 'Registrar gasto'}
        </button>
      </div>
    </form>
  );
}

function ExpenseModal({ open, branches, form, setForm, onSubmit, onCancel, saving, editing }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4"
      style={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl overflow-hidden" style={styles.modalCard}>
        <div
          className="flex items-start justify-between gap-4 px-5 py-4 md:px-6"
          style={{ borderBottom: '1px solid var(--admin-card-border)' }}
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={styles.eyebrow}>
              {editing ? 'Editar gasto' : 'Nuevo gasto'}
            </p>
            <h3 className="mt-1 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>
              Registro financiero
            </h3>
            <p className="mt-1 text-sm font-semibold" style={styles.muted}>
              Registra egresos operativos para calcular utilidad neta real.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:-translate-y-0.5"
            style={styles.softButton}
            aria-label="Cerrar gasto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-5 md:px-6">
          <ExpenseForm
            branches={branches}
            form={form}
            setForm={setForm}
            onSubmit={onSubmit}
            onCancel={onCancel}
            saving={saving}
            editing={editing}
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminFinancePage() {
  const [filters, setFilters] = useState({
    range: 'this_month',
    dateFrom: '',
    dateTo: '',
    branchId: '',
  });
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
  const [expenseForm, setExpenseForm] = useState({
    ...emptyExpenseForm,
    date: todayInputValue(),
  });

  const queryParams = useMemo(() => buildFinanceParams(filters), [filters]);
  const kpis = summary?.kpis || {};
  const sourceRows = sales?.bySource || summary?.sales?.bySource || [];
  const paymentRows = sales?.byPaymentMethod || summary?.sales?.byPaymentMethod || [];
  const topProducts = profit?.byProduct || summary?.profit?.byProduct || [];
  const expenseRows = Array.isArray(expenses?.data) ? expenses.data : summary?.expenses?.latest || [];

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
        getFinanceExpenses({ ...queryParams, limit: 20 }),
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
  }, [queryParams]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  const updateFilter = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearCustomDates = () => {
    setFilters((prev) => ({
      ...prev,
      dateFrom: '',
      dateTo: '',
    }));
  };

  const closeExpenseModal = () => {
    setEditingExpense(null);
    setExpenseForm({
      ...emptyExpenseForm,
      date: todayInputValue(),
      branchId: filters.branchId || '',
    });
    setExpenseModalOpen(false);
  };

  const openCreateExpenseForm = () => {
    setEditingExpense(null);
    setExpenseForm({
      ...emptyExpenseForm,
      date: todayInputValue(),
      branchId: filters.branchId || '',
    });
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

    setSavingExpense(true);

    try {
      const payload = {
        ...expenseForm,
        amount,
        branchId: expenseForm.branchId || null,
      };

      if (editingExpense?._id) {
        await updateFinanceExpense(editingExpense._id, payload);
        toast.success('Gasto actualizado');
      } else {
        await createFinanceExpense(payload);
        toast.success('Gasto registrado');
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

  const handleCancelExpense = async (expense) => {
    if (!expense?._id) return;
    const ok = window.confirm('¿Seguro que deseas anular este gasto?');
    if (!ok) return;

    try {
      await cancelFinanceExpense(expense._id);
      toast.success('Gasto anulado');
      await loadFinance();
    } catch (err) {
      console.error('Error anulando gasto:', err);
      toast.error(err?.response?.data?.message || err?.userMessage || 'No se pudo anular el gasto');
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

      <div style={styles.shell}>
        <div className="px-5 py-5 md:px-7 md:py-6" style={styles.header}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase" style={styles.eyebrow}>
                Centro financiero
              </p>
              <h1 className="mt-1 text-3xl font-black leading-tight" style={{ color: 'var(--admin-card-text)' }}>
                Finanzas
              </h1>
              <p className="mt-2 text-sm leading-relaxed" style={styles.muted}>
                Controla ingresos, costos, caja, gastos y utilidad con datos reales de órdenes, POS e inventario.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleExport('sales')}
                disabled={Boolean(exporting)}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60"
                style={styles.softButton}
              >
                {exporting === 'sales' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Ventas CSV
              </button>
              <button
                type="button"
                onClick={() => handleExport('expenses')}
                disabled={Boolean(exporting)}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 disabled:opacity-60"
                style={styles.softButton}
              >
                {exporting === 'expenses' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Gastos CSV
              </button>
              <button
                type="button"
                onClick={openCreateExpenseForm}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition hover:-translate-y-0.5"
                style={styles.primaryButton}
              >
                <Plus className="h-4 w-4" />
                Nuevo gasto
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[180px_160px_160px_1fr_auto]">
            <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
              Periodo
              <select
                value={filters.range}
                onChange={(event) => updateFilter('range', event.target.value)}
                className="h-12 w-full px-4 text-sm font-bold normal-case tracking-normal"
                style={styles.input}
                disabled={Boolean(filters.dateFrom || filters.dateTo)}
              >
                {RANGE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
              Desde
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => updateFilter('dateFrom', event.target.value)}
                className="h-12 w-full px-4 text-sm font-bold normal-case tracking-normal"
                style={styles.input}
              />
            </label>

            <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
              Hasta
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => updateFilter('dateTo', event.target.value)}
                className="h-12 w-full px-4 text-sm font-bold normal-case tracking-normal"
                style={styles.input}
              />
            </label>

            <label className="space-y-1 text-xs font-black uppercase tracking-[0.08em]" style={styles.muted}>
              Sede
              <select
                value={filters.branchId}
                onChange={(event) => updateFilter('branchId', event.target.value)}
                className="h-12 w-full px-4 text-sm font-bold normal-case tracking-normal"
                style={styles.input}
              >
                <option value="">Todas las sedes</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name || branch.code || 'Sede'}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={loadFinance}
                className="inline-flex h-12 items-center gap-2 px-4 text-sm font-black transition hover:-translate-y-0.5"
                style={styles.softButton}
              >
                <RefreshCw className="h-4 w-4" />
                Actualizar
              </button>
              {(filters.dateFrom || filters.dateTo) && (
                <button
                  type="button"
                  onClick={clearCustomDates}
                  className="grid h-12 w-12 place-items-center rounded-full transition hover:-translate-y-0.5"
                  style={styles.softButton}
                  aria-label="Limpiar fechas"
                >
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
              <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                Cargando información financiera real…
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-5 py-5 md:px-7 md:py-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FinanceMetricCard icon={ArrowUpRight} label="Ingresos" value={formatCurrency(kpis.revenue)} sub={`${formatNumber(kpis.ordersCount)} órdenes · Ticket ${formatCurrency(kpis.averageTicket)}`} tone="success" />
              <FinanceMetricCard icon={ReceiptText} label="Costos" value={formatCurrency(kpis.cogs)} sub={`Margen bruto ${formatPercent(kpis.grossMarginPercent)}`} tone="primary" />
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
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={styles.eyebrow}>
                      Rentabilidad
                    </p>
                    <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
                      Productos con mayor utilidad
                    </h3>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-black" style={toneStyle('success')}>
                    Bruta {formatCurrency(kpis.grossProfit)}
                  </span>
                </div>

                {topProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm font-semibold" style={styles.muted}>
                    Sin productos vendidos en este periodo.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.slice(0, 8).map((product) => (
                      <div key={product.productId || product.title} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto]" style={styles.softCard}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                            {product.title || 'Producto'}
                          </p>
                          <p className="mt-1 text-xs font-semibold" style={styles.muted}>
                            {formatNumber(product.qty)} uds · Venta {formatCurrency(product.revenue)} · Costo {formatCurrency(product.cogs)}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-black" style={{ color: 'var(--admin-primary)' }}>
                            {formatCurrency(product.grossProfit)}
                          </p>
                          <p className="text-xs font-bold" style={styles.muted}>
                            {formatPercent(product.grossMarginPercent)} margen
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4" style={styles.card}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={styles.eyebrow}>
                      Caja POS
                    </p>
                    <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
                      Resumen de caja
                    </h3>
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
                      <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>
                        {item.label}
                      </p>
                      <p className="mt-2 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs font-semibold" style={styles.muted}>
                        {item.sub}
                      </p>
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

            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="p-4" style={styles.card}>
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-3xl border" style={toneStyle('primary')}>
                    <Landmark className="h-7 w-7" />
                  </span>
                  <h3 className="mt-4 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>
                    Control de gastos operativos
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed" style={styles.muted}>
                    El botón abre una ventana visible para registrar o editar egresos sin perder el contexto del reporte.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateExpenseForm}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition hover:-translate-y-0.5"
                    style={styles.primaryButton}
                  >
                    <Plus className="h-4 w-4" />
                    Registrar gasto
                  </button>
                </div>
              </div>

              <div className="p-4" style={styles.card}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={styles.eyebrow}>
                      Gastos
                    </p>
                    <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
                      Últimos registros
                    </h3>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-black" style={toneStyle('warning')}>
                    {formatCurrency(expenses?.manualTotal || summary?.expenses?.manualTotal)}
                  </span>
                </div>

                {expenseRows.length === 0 ? (
                  <p className="py-10 text-center text-sm font-semibold" style={styles.muted}>
                    No hay gastos registrados en este periodo.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr style={{ color: 'var(--admin-card-muted-text)' }}>
                          <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Fecha</th>
                          <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Categoría</th>
                          <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Tipo</th>
                          <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Valor</th>
                          <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseRows.map((expense) => (
                          <tr key={expense._id} style={{ borderTop: '1px solid var(--admin-card-border)' }}>
                            <td className="px-3 py-3 font-bold" style={{ color: 'var(--admin-card-text)' }}>
                              {formatDate(expense.date)}
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-black" style={{ color: 'var(--admin-card-text)' }}>
                                {expense.category || 'General'}
                              </p>
                              <p className="max-w-[260px] truncate text-xs font-semibold" style={styles.muted}>
                                {expense.description || expense.vendor || 'Sin descripción'}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <span className="rounded-full border px-3 py-1 text-xs font-black" style={toneStyle('neutral')}>
                                {getLabel(EXPENSE_TYPES, expense.type, expense.type)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm font-black" style={{ color: 'var(--admin-primary)' }}>
                              {formatCurrency(expense.amount)}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditExpenseForm(expense)}
                                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-black transition hover:-translate-y-0.5"
                                  style={styles.softButton}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelExpense(expense)}
                                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-black transition hover:-translate-y-0.5"
                                  style={styles.dangerButton}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Anular
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4" style={styles.card}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border" style={toneStyle('primary')}>
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>
                      Rango técnico
                    </p>
                    <p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                      {formatDate(summary?.dateRange?.fromISO)} → {formatDate(summary?.dateRange?.toISO)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4" style={styles.card}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border" style={toneStyle('success')}>
                    <Banknote className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>
                      Ventas netas caja
                    </p>
                    <p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                      {formatCurrency(cash?.netSales || summary?.cash?.netSales)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4" style={styles.card}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border" style={toneStyle('primary')}>
                    <Store className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={styles.muted}>
                      Sede filtrada
                    </p>
                    <p className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                      {filters.branchId
                        ? branches.find((branch) => String(branch._id) === String(filters.branchId))?.name || 'Sede seleccionada'
                        : 'Todas las sedes'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
