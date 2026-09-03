import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BarChart3,
  ExternalLink,
  FileDown,
  Loader2,
  RefreshCw,
  Scale,
  WalletCards,
} from 'lucide-react';
import { getPosShiftSummary } from '../api/adminPosApi';
import {
  downloadPosShiftReportCsv,
  getPaymentRows,
  getPosReportStatus,
  POS_REPORT_RANGES,
} from './posShiftReportModel';

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
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function toneStyle(tone) {
  if (tone === 'critical') {
    return { borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' };
  }
  if (tone === 'attention') {
    return { borderColor: '#fde68a', background: '#fffbeb', color: '#b45309' };
  }
  return { borderColor: '#bbf7d0', background: '#ecfdf5', color: '#047857' };
}

function ReportButton({ children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}
    >
      {children}
    </button>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="border-l-2 pl-4" style={{ borderColor: 'var(--admin-primary)' }}>
      <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      {detail ? <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{detail}</p> : null}
    </div>
  );
}

function AmountRow({ label, value, strong = false, subtract = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2 text-sm ${strong ? 'border-t pt-3 font-black' : ''}`} style={strong ? { borderColor: 'var(--admin-card-border)' } : undefined}>
      <span style={{ color: strong ? 'var(--admin-card-text)' : 'var(--admin-card-muted-text)' }}>{label}</span>
      <span className={strong ? 'text-base' : 'font-black'}>{subtract ? '- ' : ''}{money(value)}</span>
    </div>
  );
}

export default function PosShiftReportPanel({ branchId }) {
  const [range, setRange] = useState('current_shift');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      setError('');
      const data = await getPosShiftSummary({ branchId, range });
      setReport(data?.report || null);
    } catch (err) {
      setError(err?.message || 'No fue posible cargar el control de jornada.');
    } finally {
      setLoading(false);
    }
  }, [branchId, range]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    const refresh = () => loadReport();
    window.addEventListener('pos:sale-created', refresh);
    window.addEventListener('pos:held-sales-changed', refresh);
    return () => {
      window.removeEventListener('pos:sale-created', refresh);
      window.removeEventListener('pos:held-sales-changed', refresh);
    };
  }, [loadReport]);

  if (loading && !report) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} />
        <p className="mt-3 text-sm font-bold">Calculando jornada desde el servidor...</p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        <AlertTriangle className="mx-auto h-9 w-9" />
        <p className="mt-3 font-black">No se pudo consultar la jornada</p>
        <p className="mt-2 text-sm">{error}</p>
        <button type="button" onClick={loadReport} className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-black">Reintentar</button>
      </div>
    );
  }

  const metrics = report?.metrics || {};
  const reconciliation = report?.reconciliation || {};
  const paymentRows = getPaymentRows(report);
  const status = getPosReportStatus(report);
  const statusColors = toneStyle(status.tone);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black">{report?.branch?.name || 'Sede POS'} · {report?.cashRegisterCode || 'CAJA POS'}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
            {formatDate(report?.period?.start)} — {formatDate(report?.period?.end)} · Hora Colombia
          </p>
          {report?.period?.fallback ? <p className="mt-1 text-xs font-bold text-amber-700">No hay jornada abierta; se muestran los resultados de hoy.</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={range} onChange={(event) => setRange(event.target.value)} className="min-h-10 rounded-xl border bg-transparent px-3 text-xs font-black outline-none" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
            {POS_REPORT_RANGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ReportButton onClick={loadReport} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar</ReportButton>
          <ReportButton onClick={() => downloadPosShiftReportCsv(report)} disabled={!report}><FileDown className="h-4 w-4" /> Descargar CSV</ReportButton>
        </div>
      </div>

      {error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">Se conservan los últimos datos disponibles. {error}</p> : null}

      <section className="flex items-start gap-3 rounded-2xl border p-4" style={statusColors}>
        {status.tone === 'healthy' ? <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
        <div><p className="font-black">{status.label}</p><p className="mt-1 text-sm font-semibold">{status.detail}</p></div>
      </section>

      <section className="grid gap-5 rounded-2xl border p-5 sm:grid-cols-2 xl:grid-cols-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
        <Metric label="Venta neta" value={money(metrics.netSales)} detail={`Bruta ${money(metrics.grossSales)}`} />
        <Metric label="Ventas" value={Number(metrics.ordersCount || 0)} detail={`${Number(metrics.cancelledOrdersCount || 0)} anulada(s)`} />
        <Metric label="Ticket promedio" value={money(metrics.averageTicket)} detail={`${Number(metrics.itemsCount || 0)} unidad(es)`} />
        <Metric label="Reembolsos" value={money(metrics.refunds)} detail={`${Number(metrics.refundedOrdersCount || 0)} orden(es)`} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex items-center gap-3"><WalletCards className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} /><div><h3 className="font-black">Medios de pago</h3><p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Valor cobrado antes de descontar reembolsos.</p></div></div>
          <div className="mt-4">
            {paymentRows.length > 0 ? paymentRows.map((row) => <AmountRow key={row.key} label={row.label} value={row.amount} />) : <p className="py-6 text-center text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay cobros en este periodo.</p>}
            <AmountRow label="Total cobrado" value={report?.paymentBreakdown?.total} strong />
          </div>
        </section>

        <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex items-center gap-3"><Scale className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} /><div><h3 className="font-black">Conciliación de caja actual</h3><p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>{report?.cashSession ? `${report.cashSession.sessionCode} · Pendiente de arqueo` : 'No existe una sesión abierta para esta caja.'}</p></div></div>
          {report?.cashSession ? (
            <div className="mt-4">
              <AmountRow label="Base inicial" value={reconciliation.openingAmount} />
              <AmountRow label="Ventas en efectivo" value={reconciliation.cashSales} />
              <AmountRow label="Entradas manuales" value={reconciliation.cashIn} />
              <AmountRow label="Salidas manuales" value={reconciliation.cashOut} subtract />
              <AmountRow label="Efectivo esperado" value={reconciliation.expectedCash} strong />
              <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>El valor contado y la diferencia se fijan al cerrar la caja.</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><p className="font-black">Conciliación no disponible</p><p className="mt-1">Abre la caja para iniciar el control de efectivo.</p></div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
        <div className="flex items-center gap-3"><BarChart3 className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} /><div><h3 className="font-black">Control operativo</h3><p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Hallazgos automáticos del periodo y de la caja vigente.</p></div></div>
        <div className="mt-4 divide-y" style={{ borderColor: 'var(--admin-card-border)' }}>
          {report?.alerts?.length > 0 ? report.alerts.map((alert) => (
            <div key={alert.code} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-black" style={{ color: alert.severity === 'critical' ? '#b91c1c' : '#b45309' }}>{alert.title}</p><p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{alert.message}</p></div>
              {alert.action?.href ? <Link to={alert.action.href} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black" style={{ borderColor: 'var(--admin-card-border)' }}>{alert.action.label}<ExternalLink className="h-3.5 w-3.5" /></Link> : null}
            </div>
          )) : <div className="flex items-center gap-3 py-5 text-sm font-bold text-emerald-700"><BadgeCheck className="h-5 w-5" /> Sin pendientes operativos detectados.</div>}
        </div>
      </section>

      <footer className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
        <p className="text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>Cifras generadas por el servidor · Actualizado {formatDate(report?.generatedAt)}</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/caja" className="inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black" style={{ borderColor: 'var(--admin-card-border)' }}><Banknote className="h-4 w-4" /> Gestionar caja</Link>
          <Link to="/admin/finanzas" className="inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black" style={{ borderColor: 'var(--admin-card-border)' }}><BarChart3 className="h-4 w-4" /> Abrir Finanzas</Link>
        </div>
      </footer>
    </div>
  );
}
