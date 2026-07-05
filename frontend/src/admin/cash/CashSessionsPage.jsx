// frontend/src/admin/cash/CashSessionsPage.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  History,
  LockKeyhole,
  RefreshCw,
  Smartphone,
  UnlockKeyhole,
  Wallet,
} from 'lucide-react';

import { getPosBootstrap } from '../api/adminPosApi';
import {
  closeCashSession,
  getCurrentCashSession,
  listCashSessions,
  openCashSession,
} from '../api/adminCashSessionApi';

const DEFAULT_REGISTER_CODE = 'CAJA POS';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', { hour12: false });
}

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function getPaymentTotals(session) {
  return session?.salesSummary?.paymentTotals || {};
}

function getOrdersCount(session) {
  return Number(session?.salesSummary?.ordersCount || 0);
}

function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-3xl border ${className}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
        boxShadow: 'var(--admin-shadow-card, 0 18px 50px rgba(15, 23, 42, 0.08))',
      }}
    >
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span
        className="mb-2 block text-xs font-black uppercase tracking-[0.16em]"
        style={{ color: 'var(--admin-card-muted-text)' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none transition ${props.className || ''}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
        caretColor: 'var(--admin-primary)',
      }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none transition"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className="min-h-[96px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none transition"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
        caretColor: 'var(--admin-primary)',
      }}
    />
  );
}

function Button({ children, onClick, disabled = false, variant = 'primary', type = 'button' }) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        borderColor: isPrimary ? 'var(--admin-primary)' : 'var(--admin-card-border)',
        background: isPrimary ? 'var(--admin-primary)' : 'var(--admin-card-bg)',
        color: isPrimary ? '#fff' : 'var(--admin-card-text)',
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <div
      className="rounded-3xl border p-4"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl border"
          style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>
            {label}
          </p>
          <p className="mt-1 truncate text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
            {value}
          </p>
          {helper ? <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</p> : null}
        </div>
      </div>
    </div>
  );
}

function StatusMessage({ type = 'info', children }) {
  const isError = type === 'error';
  const isSuccess = type === 'success';

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold"
      style={{
        borderColor: isError ? '#fecaca' : isSuccess ? '#bbf7d0' : 'var(--admin-card-border)',
        background: isError ? '#fef2f2' : isSuccess ? '#ecfdf5' : 'var(--admin-primary-soft-bg)',
        color: isError ? '#b91c1c' : isSuccess ? '#047857' : 'var(--admin-card-text)',
      }}
    >
      {isError ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function SessionSummary({ session }) {
  const paymentTotals = getPaymentTotals(session);
  const difference = Number(session?.differenceAmount || 0);
  const differenceLabel = difference > 0 ? 'Sobrante' : difference < 0 ? 'Faltante' : 'Sin diferencia';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} label="Efectivo esperado" value={money(session?.expectedCash)} helper="Monto esperado al cierre" />
        <StatCard icon={Wallet} label="Ventas" value={String(getOrdersCount(session))} helper="Órdenes POS asociadas" />
        <StatCard icon={CreditCard} label="Total vendido" value={money(session?.salesSummary?.netSales)} helper="Ventas netas de la caja" />
        <StatCard icon={LockKeyhole} label={differenceLabel} value={money(Math.abs(difference))} helper="Diferencia al cerrar" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Banknote} label="Efectivo" value={money(paymentTotals.cash)} />
        <StatCard icon={Smartphone} label="Transferencia" value={money(paymentTotals.transfer)} />
        <StatCard icon={CreditCard} label="Tarjeta" value={money(paymentTotals.card)} />
        <StatCard icon={Wallet} label="Otros pagos" value={money((paymentTotals.mixed || 0) + (paymentTotals.other || 0))} />
      </div>
    </div>
  );
}

function HistoryTable({ sessions = [] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>
            <History className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black">Histórico de cierres</h2>
            <p className="text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
              Últimas cajas abiertas o cerradas.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr style={{ color: 'var(--admin-card-muted-text)' }}>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Caja</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Estado</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Apertura</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Ventas</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Esperado</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Contado</th>
              <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.14em]">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                  Todavía no hay movimientos de caja.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="border-t" style={{ borderColor: 'var(--admin-card-border)' }}>
                  <td className="px-5 py-4 font-black">
                    <p>{session.cashRegisterCode}</p>
                    <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{session.sessionCode}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-black uppercase"
                      style={{
                        background: session.status === 'open' ? '#ecfdf5' : 'var(--admin-primary-soft-bg)',
                        color: session.status === 'open' ? '#047857' : 'var(--admin-card-muted-text)',
                      }}
                    >
                      {session.status === 'open' ? 'Abierta' : session.status === 'closed' ? 'Cerrada' : session.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(session.openedAt)}</td>
                  <td className="px-5 py-4 font-black">{getOrdersCount(session)}</td>
                  <td className="px-5 py-4 font-black">{money(session.expectedCash)}</td>
                  <td className="px-5 py-4 font-black">{money(session.countedCash)}</td>
                  <td className="px-5 py-4 font-black">{money(session.differenceAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function CashSessionsPage() {
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [cashRegisterCode, setCashRegisterCode] = useState(DEFAULT_REGISTER_CODE);
  const [openingAmount, setOpeningAmount] = useState('50000');
  const [openingNotes, setOpeningNotes] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [currentSession, setCurrentSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) || null,
    [branches, selectedBranchId]
  );

  const hasOpenSession = Boolean(currentSession?.id && currentSession.status === 'open');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const bootstrap = await getPosBootstrap();
      const branchRows = Array.isArray(bootstrap?.branches) ? bootstrap.branches : [];
      const defaultBranchId =
        selectedBranchId ||
        bootstrap?.defaultBranch?.id ||
        branchRows.find((branch) => branch.isMain)?.id ||
        branchRows[0]?.id ||
        '';

      setBranches(branchRows);
      setSelectedBranchId(defaultBranchId);

      if (defaultBranchId) {
        const [current, history] = await Promise.all([
          getCurrentCashSession({ branchId: defaultBranchId, cashRegisterCode }),
          listCashSessions({ branchId: defaultBranchId, limit: 12 }),
        ]);

        const session = current?.session || null;
        setCurrentSession(session);
        setSessions(Array.isArray(history?.sessions) ? history.sessions : []);
        setCountedCash(session?.expectedCash ? String(session.expectedCash) : '');
      }
    } catch (err) {
      setError(err?.message || 'No fue posible cargar el módulo de caja.');
    } finally {
      setLoading(false);
    }
  }, [cashRegisterCode, selectedBranchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshForBranch = async (branchId = selectedBranchId, registerCode = cashRegisterCode) => {
    if (!branchId) return;

    const [current, history] = await Promise.all([
      getCurrentCashSession({ branchId, cashRegisterCode: registerCode }),
      listCashSessions({ branchId, limit: 12 }),
    ]);

    const session = current?.session || null;
    setCurrentSession(session);
    setSessions(Array.isArray(history?.sessions) ? history.sessions : []);
    setCountedCash(session?.expectedCash ? String(session.expectedCash) : '');
  };

  const handleBranchChange = async (event) => {
    const branchId = event.target.value;
    setSelectedBranchId(branchId);
    setSuccess('');
    setError('');
    try {
      setLoading(true);
      await refreshForBranch(branchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible consultar la caja de la sede.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterChange = async (event) => {
    const nextRegister = event.target.value;
    setCashRegisterCode(nextRegister);
    setSuccess('');
    setError('');
  };

  const handleOpenCash = async (event) => {
    event.preventDefault();
    if (!selectedBranchId) {
      setError('Debes seleccionar una sede.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const response = await openCashSession({
        branchId: selectedBranchId,
        cashRegisterCode,
        cashRegisterName: 'Caja POS',
        openingAmount: numberValue(openingAmount),
        openingNotes,
      });

      setCurrentSession(response?.session || null);
      setCountedCash(response?.session?.expectedCash ? String(response.session.expectedCash) : String(numberValue(openingAmount)));
      setOpeningNotes('');
      setSuccess('Caja abierta correctamente. Ya puedes vender en POS.');
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible abrir la caja.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseCash = async (event) => {
    event.preventDefault();
    if (!currentSession?.id) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const response = await closeCashSession(currentSession.id, {
        countedCash: numberValue(countedCash),
        closingNotes,
      });

      setCurrentSession(null);
      setClosingNotes('');
      setCountedCash('');
      setSuccess(`Caja cerrada correctamente. Diferencia: ${money(response?.session?.differenceAmount || 0)}.`);
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible cerrar la caja.');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      await refreshForBranch(selectedBranchId, cashRegisterCode);
    } catch (err) {
      setError(err?.message || 'No fue posible actualizar la caja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
              style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}
            >
              <Wallet className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>Caja y cierre diario</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                Controla apertura, ventas POS, efectivo esperado y cierre de caja por sede.
              </p>
            </div>
          </div>

          <Button variant="ghost" onClick={handleRefresh} disabled={loading || saving}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar caja
          </Button>
        </div>
      </Card>

      {error ? <StatusMessage type="error">{error}</StatusMessage> : null}
      {success ? <StatusMessage type="success">{success}</StatusMessage> : null}

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px_220px]">
          <Field label="Sede">
            <Select value={selectedBranchId} onChange={handleBranchChange} disabled={loading || saving}>
              {branches.length === 0 ? <option value="">Sin sedes POS</option> : null}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} - {branch.code}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Código de caja">
            <Input value={cashRegisterCode} onChange={handleRegisterChange} disabled={loading || saving || hasOpenSession} />
          </Field>

          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Estado sede</p>
                <p className="text-sm font-black">
                  {selectedBranch?.settings?.requireCashSessionForPos ? 'Exige caja abierta' : 'Caja opcional'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {hasOpenSession ? (
        <Card className="p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Caja abierta</p>
              <h2 className="mt-1 text-xl font-black">{currentSession.sessionCode}</h2>
              <p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                Apertura: {formatDate(currentSession.openedAt)} · Cajero: {currentSession.cashierSnapshot?.displayName || 'Administrador'}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black" style={{ borderColor: '#bbf7d0', background: '#ecfdf5', color: '#047857' }}>
              <UnlockKeyhole className="h-4 w-4" /> Abierta
            </span>
          </div>

          <SessionSummary session={currentSession} />

          <form onSubmit={handleCloseCash} className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_auto] lg:items-end">
            <Field label="Efectivo contado">
              <Input type="number" min="0" step="100" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} disabled={saving} />
            </Field>
            <Field label="Observación de cierre">
              <Textarea value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} placeholder="Ejemplo: cierre sin novedades" disabled={saving} />
            </Field>
            <Button type="submit" disabled={saving}>
              <LockKeyhole className="h-4 w-4" />
              {saving ? 'Cerrando...' : 'Cerrar caja'}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="mb-5 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>
              <UnlockKeyhole className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-black">Abrir caja</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                Abre la caja antes de vender en POS. El código debe coincidir con el POS: CAJA POS.
              </p>
            </div>
          </div>

          <form onSubmit={handleOpenCash} className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_auto] lg:items-end">
            <Field label="Monto inicial">
              <Input type="number" min="0" step="100" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} disabled={saving || loading} />
            </Field>
            <Field label="Observación de apertura">
              <Textarea value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} placeholder="Ejemplo: apertura normal de la tienda" disabled={saving || loading} />
            </Field>
            <Button type="submit" disabled={saving || loading || !selectedBranchId}>
              <UnlockKeyhole className="h-4 w-4" />
              {saving ? 'Abriendo...' : 'Abrir caja'}
            </Button>
          </form>
        </Card>
      )}

      <HistoryTable sessions={sessions} />
    </section>
  );
}
