import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  CircleDollarSign,
  Landmark,
  Loader2,
  ReceiptText,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';

import {
  getFinanceTreasury,
  registerFinancePayablePayment,
} from './api/financeApi';
import './financeTreasuryPanel.css';

const PAYMENT_METHODS = [
  ['cash', 'Efectivo'],
  ['transfer', 'Transferencia'],
  ['card', 'Tarjeta'],
  ['mixed', 'Mixto'],
  ['other', 'Otro'],
];

function currency(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function dateLabel(value) {
  if (!value) return 'Sin fecha';
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function todayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function requestKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `treasury-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.userMessage || fallback;
}

function statusLabel(aging = {}) {
  if (!aging.overdue) return aging.label || 'Al día';
  return `Vencido ${Number(aging.daysOverdue || 0)} d`;
}

function PaymentModal({ payable, onClose, onSaved }) {
  const [form, setForm] = useState({
    amount: String(payable?.balanceAmount || ''),
    paymentMethod: 'transfer',
    paidAt: todayValue(),
    reference: '',
    notes: '',
    requestKey: requestKey(),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, saving]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('El abono debe ser mayor a cero');
      return;
    }
    if (amount > Number(payable.balanceAmount || 0)) {
      toast.error('El abono no puede superar el saldo pendiente');
      return;
    }
    if (form.paymentMethod !== 'cash' && !form.reference.trim()) {
      toast.error('Registra la referencia del pago');
      return;
    }

    setSaving(true);
    try {
      await registerFinancePayablePayment(payable._id, {
        ...form,
        amount,
        expectedRevision: Number(payable.revision || 0),
      });
      toast.success(amount === Number(payable.balanceAmount || 0)
        ? 'Cuenta por pagar saldada'
        : 'Abono registrado con trazabilidad');
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo registrar el abono'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="finance-treasury-overlay" role="dialog" aria-modal="true" aria-label="Registrar abono">
      <div className="finance-treasury-modal">
        <header>
          <div>
            <p className="finance-treasury-eyebrow">Salida de tesorería</p>
            <h3>Registrar abono</h3>
            <p>{payable.vendor} · Saldo {currency(payable.balanceAmount)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar abono">
            <X aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="finance-treasury-payable-context">
            <ReceiptText aria-hidden="true" />
            <div>
              <strong>{payable.category}</strong>
              <span>{payable.description || payable.invoiceNumber || 'Cuenta por pagar aprobada'}</span>
            </div>
            <b>{currency(payable.balanceAmount)}</b>
          </div>

          <div className="finance-treasury-form-grid">
            <label>
              Valor del abono
              <input type="number" min="1" max={payable.balanceAmount} value={form.amount} onChange={(event) => update('amount', event.target.value)} required autoFocus />
            </label>
            <label>
              Fecha del pago
              <input type="date" max={todayValue()} value={form.paidAt} onChange={(event) => update('paidAt', event.target.value)} required />
            </label>
            <label>
              Método
              <select value={form.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value)}>
                {PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Referencia
              <input value={form.reference} onChange={(event) => update('reference', event.target.value)} placeholder={form.paymentMethod === 'cash' ? 'Opcional' : 'Comprobante o referencia'} required={form.paymentMethod !== 'cash'} />
            </label>
          </div>

          <label className="finance-treasury-notes">
            Nota interna
            <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Observación opcional para la trazabilidad" />
          </label>

          <div className="finance-treasury-modal__actions">
            <button type="button" onClick={onClose} disabled={saving}>Volver</button>
            <button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <WalletCards />}
              Confirmar abono
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function TreasuryList({ type, rows, canManage, onPay }) {
  const receivable = type === 'receivable';
  const Icon = receivable ? ArrowDownToLine : ArrowUpFromLine;
  const title = receivable ? 'Cobros pendientes' : 'Pagos pendientes';
  const empty = receivable
    ? 'No hay órdenes pendientes de cobro.'
    : 'No hay cuentas por pagar activas.';

  return (
    <section className="finance-treasury-list">
      <div className="finance-treasury-list__heading">
        <span><Icon aria-hidden="true" /></span>
        <div><h3>{title}</h3><p>{receivable ? 'Derivados de órdenes reales sin pago confirmado.' : 'Gastos aprobados con condición de pago a crédito.'}</p></div>
      </div>

      {!rows.length ? (
        <div className="finance-treasury-empty"><CircleDollarSign /><p>{empty}</p></div>
      ) : (
        <div className="finance-treasury-list__rows">
          {rows.map((row) => (
            <article key={row._id} data-overdue={row.aging?.overdue === true}>
              <div className="finance-treasury-list__identity">
                <strong>{receivable ? row.orderNumber : row.vendor}</strong>
                <span>{receivable ? row.customer?.name : row.category}</span>
                <small>{row.branchSnapshot?.name || 'General'} · Vence {dateLabel(row.dueDate)}</small>
              </div>
              <div className="finance-treasury-list__amount">
                <strong>{currency(row.balanceAmount)}</strong>
                {!receivable && Number(row.paidAmount || 0) > 0 ? <small>Abonado {currency(row.paidAmount)}</small> : null}
                <span data-overdue={row.aging?.overdue === true}>{statusLabel(row.aging)}</span>
              </div>
              {!receivable && canManage ? (
                <button type="button" onClick={() => onPay(row)}>Registrar abono</button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function FinanceTreasuryPanel({
  selectedBranchId = '',
  canManage = false,
  refreshKey = 0,
  onDataChanged = async () => {},
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payable, setPayable] = useState(null);

  const loadTreasury = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getFinanceTreasury(
        selectedBranchId ? { branchId: selectedBranchId } : {}
      );
      setData(result || null);
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudo cargar cartera y vencimientos'));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    loadTreasury();
  }, [loadTreasury, refreshKey]);

  const closePayment = useCallback(() => setPayable(null), []);
  const paymentSaved = useCallback(async () => {
    setPayable(null);
    await loadTreasury();
    await onDataChanged();
  }, [loadTreasury, onDataChanged]);

  const summary = data?.summary || {};
  const cards = useMemo(() => [
    { label: 'Por cobrar', value: summary.accountsReceivable, sub: `${data?.receivables?.count || 0} orden(es)`, icon: ArrowDownToLine, tone: 'success' },
    { label: 'Por pagar', value: summary.accountsPayable, sub: `${data?.payables?.count || 0} cuenta(s)`, icon: ArrowUpFromLine, tone: 'warning' },
    { label: 'Vencido por pagar', value: summary.overduePayable, sub: `Por cobrar vencido ${currency(summary.overdueReceivable)}`, icon: CalendarClock, tone: 'danger' },
    { label: 'Flujo próximo 30 días', value: summary.projectedNet30, sub: 'Cobros menos pagos por vencer', icon: Landmark, tone: Number(summary.projectedNet30 || 0) >= 0 ? 'success' : 'danger' },
  ], [data, summary]);

  return (
    <section className="finance-treasury-panel">
      {payable ? <PaymentModal payable={payable} onClose={closePayment} onSaved={paymentSaved} /> : null}

      <header className="finance-treasury-panel__header">
        <div className="finance-treasury-panel__title">
          <span><Landmark aria-hidden="true" /></span>
          <div>
            <p className="finance-treasury-eyebrow">Tesorería operativa</p>
            <h2>Cartera y vencimientos</h2>
            <p>Anticipa entradas y salidas sin duplicar ventas ni gastos.</p>
          </div>
        </div>
        <span className="finance-treasury-horizon"><CalendarClock /> Próximos 30 días</span>
      </header>

      {loading ? <div className="finance-treasury-loading"><Loader2 className="animate-spin" />Actualizando saldos operativos…</div> : null}
      {!loading && error ? <div className="finance-treasury-error"><AlertTriangle />{error}<button type="button" onClick={loadTreasury}>Reintentar</button></div> : null}

      {!loading && !error ? (
        <>
          <div className="finance-treasury-summary" role="group" aria-label="Resumen de tesorería">
            {cards.map(({ label, value, sub, icon: Icon, tone }) => (
              <div key={label} data-tone={tone}>
                <span><Icon /></span>
                <p>{label}</p>
                <strong>{currency(value)}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </div>
          <div className="finance-treasury-columns">
            <TreasuryList type="receivable" rows={data?.receivables?.data || []} />
            <TreasuryList type="payable" rows={data?.payables?.data || []} canManage={canManage} onPay={setPayable} />
          </div>
        </>
      ) : null}
    </section>
  );
}
