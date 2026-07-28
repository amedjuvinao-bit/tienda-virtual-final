import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  CircleDollarSign,
  CreditCard,
  FileSpreadsheet,
  Percent,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

import useAdminPermissions from '../../security/useAdminPermissions';
import {
  downloadBillingReportCsv,
  downloadBlob,
  getBillingReport,
  getDownloadErrorMessage,
} from '../api/adminBillingApi';
import {
  REPORT_STATUS_OPTIONS,
  REPORT_TYPE_OPTIONS,
} from '../billingConstants';
import {
  defaultReportFilters,
  formatCurrency,
  formatNumber,
  formatReportDate,
  getStatusStyle,
} from '../billingFormatters';
import {
  ActionButton,
  BillingMetricCard,
  MessageBox,
  PanelHeader,
  SummaryPanelCard,
} from '../components/BillingUi';

export default function BillingReportsPanel() {
  const { can } = useAdminPermissions();
  const canDownload = can('billing:download');
  const [draftFilters, setDraftFilters] = useState(defaultReportFilters);
  const [filters, setFilters] = useState(defaultReportFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadReport = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getBillingReport(filters);
      setReport(data || {});
    } catch (err) {
      setReport(null);
      setError(err?.response?.data?.message || err?.message || 'No se pudo generar el reporte de facturación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [filters]);

  const applyFilters = (event) => {
    event.preventDefault();
    setNotice('');
    if (!draftFilters.from || !draftFilters.to) {
      setError('Selecciona la fecha inicial y la fecha final.');
      return;
    }
    if (draftFilters.from > draftFilters.to) {
      setError('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    setError('');
    setFilters({ ...draftFilters });
  };

  const resetFilters = () => {
    const next = defaultReportFilters();
    setDraftFilters(next);
    setFilters(next);
    setError('');
    setNotice('');
  };

  const exportReport = async () => {
    if (!canDownload) return;
    try {
      setExporting(true);
      setError('');
      setNotice('');
      const download = await downloadBillingReportCsv(filters);
      downloadBlob(download, `reporte-facturacion-${filters.from}-a-${filters.to}.csv`);
      setNotice('Reporte CSV exportado con los mismos filtros visibles.');
    } catch (err) {
      setError(await getDownloadErrorMessage(err, 'No se pudo exportar el reporte de facturación.'));
    } finally {
      setExporting(false);
    }
  };

  const metrics = report?.metrics || {};
  const breakdowns = report?.breakdowns || {};
  const rows = Array.isArray(report?.rows) ? report.rows : [];
  const statuses = Array.isArray(breakdowns.statuses) ? breakdowns.statuses : [];
  const paymentMethods = Array.isArray(breakdowns.paymentMethods) ? breakdowns.paymentMethods : [];
  const daily = Array.isArray(breakdowns.daily) ? breakdowns.daily : [];
  const paymentMaximum = Math.max(1, ...paymentMethods.map((row) => Math.abs(Number(row.net) || 0)));
  const dailyMaximum = Math.max(1, ...daily.map((row) => Math.abs(Number(row.net) || 0)));

  return (
    <section className="grid min-w-0 gap-5">
      <PanelHeader
        eyebrow="Control financiero y fiscal"
        title="Reportes de facturación"
        text="Una vista clara de ventas, impuestos y devoluciones, con cada nota crédito aplicada en su fecha real de emisión."
      >
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
          <ActionButton className="min-h-10 whitespace-nowrap px-4" icon={RefreshCw} onClick={loadReport} disabled={loading}>Actualizar</ActionButton>
          <ActionButton className="min-h-10 whitespace-nowrap px-4" icon={FileSpreadsheet} onClick={exportReport} disabled={!canDownload || exporting || loading} variant="primary">
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </ActionButton>
        </div>
      </PanelHeader>

      <section
        className="rounded-[28px] border p-4 shadow-sm md:p-5"
        style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}
      >
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-accent, #ec4899)' }}>Consulta personalizada</p>
            <h3 className="mt-1 text-lg font-black">Filtros del reporte</h3>
          </div>
          <p className="text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>El CSV conservará esta misma selección.</p>
        </div>

        <form onSubmit={applyFilters} className="grid gap-4">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Desde</span>
              <input
                type="date"
                value={draftFilters.from}
                max={draftFilters.to || undefined}
                onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))}
                className="h-11 min-w-0 w-full rounded-2xl border px-3 text-sm font-black outline-none"
                style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg, var(--admin-card-bg))', color: 'var(--admin-card-text)' }}
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Hasta</span>
              <input
                type="date"
                value={draftFilters.to}
                min={draftFilters.from || undefined}
                onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))}
                className="h-11 min-w-0 w-full rounded-2xl border px-3 text-sm font-black outline-none"
                style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg, var(--admin-card-bg))', color: 'var(--admin-card-text)' }}
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Documentos</span>
              <select
                value={draftFilters.type}
                onChange={(event) => setDraftFilters((current) => ({ ...current, type: event.target.value }))}
                className="h-11 min-w-0 w-full rounded-2xl border px-3 text-sm font-black outline-none"
                style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg, var(--admin-card-bg))', color: 'var(--admin-card-text)' }}
              >
                {REPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Estado</span>
              <select
                value={draftFilters.status}
                onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
                className="h-11 min-w-0 w-full rounded-2xl border px-3 text-sm font-black outline-none"
                style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg, var(--admin-card-bg))', color: 'var(--admin-card-text)' }}
              >
                {REPORT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--admin-card-border)' }}>
            <p className="break-words text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
              Período aplicado: <strong style={{ color: 'var(--admin-card-text)' }}>{formatReportDate(filters.from)} – {formatReportDate(filters.to)}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <ActionButton className="min-h-10 min-w-[116px] whitespace-nowrap px-4" icon={BarChart3} onClick={applyFilters} disabled={loading} variant="primary">{loading ? 'Generando...' : 'Aplicar filtros'}</ActionButton>
              <ActionButton className="min-h-10 min-w-[96px] whitespace-nowrap px-4" disabled={loading} onClick={resetFilters}>Limpiar</ActionButton>
            </div>
          </div>
        </form>
      </section>

      {error ? <MessageBox>{error}</MessageBox> : null}
      {notice ? (
        <div
          role="status"
          className="flex min-w-0 items-center gap-3 rounded-[20px] border px-4 py-3 text-sm font-bold"
          style={{ borderColor: 'rgba(16, 185, 129, 0.36)', background: 'rgba(16, 185, 129, 0.1)', color: '#047857' }}
        >
          <Check className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{notice}</span>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <BillingMetricCard className="xl:col-span-6" featured icon={BarChart3} label="Facturación neta" value={loading ? '...' : formatCurrency(metrics.net)} helper="Facturas validadas menos notas crédito validadas" />
        <BillingMetricCard className="xl:col-span-3" icon={CircleDollarSign} label="Total facturado" value={loading ? '...' : formatCurrency(metrics.invoiced)} helper={`${formatNumber(metrics.validatedInvoices)} factura(s) validada(s)`} />
        <BillingMetricCard className="xl:col-span-3" icon={RotateCcw} label="Notas crédito" value={loading ? '...' : formatCurrency(metrics.credited)} helper={`${formatNumber(metrics.validatedCreditNotes)} nota(s) validada(s)`} />
        <BillingMetricCard className="xl:col-span-4" icon={Percent} label="IVA neto" value={loading ? '...' : formatCurrency(metrics.netTax)} helper={`${formatCurrency(metrics.invoiceTax)} facturado · ${formatCurrency(metrics.creditedTax)} reversado`} />
        <BillingMetricCard className="xl:col-span-4" icon={CreditCard} label="Descuentos" value={loading ? '...' : formatCurrency(metrics.discounts)} helper={`${formatCurrency(metrics.shipping)} cobrado por envíos`} />
        <BillingMetricCard className="xl:col-span-4" icon={FileSpreadsheet} label="Documentos" value={loading ? '...' : formatNumber(metrics.documents)} helper={`${formatNumber(metrics.invoices)} factura(s) · ${formatNumber(metrics.creditNotes)} nota(s)`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SummaryPanelCard eyebrow="Estados fiscales" title="Documentos por estado">
          {statuses.length ? (
            <div className="grid gap-2">
              {statuses.map((row) => (
                <div
                  key={row.key}
                  className="grid min-w-0 gap-3 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}
                >
                  <div className="min-w-0">
                    <span className="inline-flex max-w-full break-words rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase" style={getStatusStyle(row.key)}>{row.label}</span>
                    <p className="mt-2 break-words text-xs font-semibold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>
                      {formatNumber(row.invoices)} factura(s) · {formatNumber(row.creditNotes)} nota(s)
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Neto fiscal</p>
                    <p className="mt-1 break-words text-base font-black [overflow-wrap:anywhere]">{formatCurrency(row.net)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay documentos para los filtros seleccionados.</p>}
        </SummaryPanelCard>

        <SummaryPanelCard eyebrow="Recaudo" title="Resultado por medio de pago">
          {paymentMethods.length ? (
            <div className="grid gap-2">
              {paymentMethods.slice(0, 8).map((row) => (
                <div key={row.key} className="grid min-w-0 gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black">{row.label}</p>
                      <p className="mt-1 break-words text-xs font-bold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>{formatNumber(row.invoices)} factura(s) · {formatNumber(row.creditNotes)} nota(s)</p>
                    </div>
                    <span className="shrink-0 text-right text-sm font-black">{formatCurrency(row.net)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--admin-card-bg)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (Math.abs(Number(row.net) || 0) / paymentMaximum) * 100)}%`,
                        background: 'var(--admin-accent, #ec4899)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay medios de pago para mostrar.</p>}
        </SummaryPanelCard>
      </div>

      <SummaryPanelCard eyebrow="Comportamiento diario" title="Facturación neta por fecha">
        {daily.length ? (
          <div className="grid max-h-[430px] gap-2 overflow-y-auto pr-1">
            {daily.map((row) => {
              const netValue = Number(row.net) || 0;
              return (
                <div
                  key={row.key}
                  className="grid min-w-0 gap-3 rounded-2xl border p-3 md:grid-cols-[120px_minmax(0,1fr)_150px] md:items-center"
                  style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}
                >
                  <div>
                    <p className="text-sm font-black">{formatReportDate(row.key)}</p>
                    <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatNumber(row.invoices)} factura(s) · {formatNumber(row.creditNotes)} nota(s)</p>
                  </div>
                  <div className="min-w-0">
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--admin-card-bg)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(3, (Math.abs(netValue) / dailyMaximum) * 100)}%`,
                          background: netValue < 0 ? '#e11d48' : 'var(--admin-accent, #ec4899)',
                        }}
                      />
                    </div>
                    <p className="mt-2 break-words text-[11px] font-semibold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>
                      {formatCurrency(row.invoiced)} facturado · {formatCurrency(row.credited)} acreditado
                    </p>
                  </div>
                  <p className="break-words text-base font-black md:text-right [overflow-wrap:anywhere]">{formatCurrency(row.net)}</p>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay movimiento diario para mostrar.</p>}
      </SummaryPanelCard>

      <SummaryPanelCard
        eyebrow="Detalle verificable"
        title="Últimos documentos del período"
        footer={<p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Se muestran hasta 30 registros. El CSV incluye los {formatNumber(report?.totalRows || 0)} documentos que cumplen los filtros.</p>}
      >
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead style={{ color: 'var(--admin-card-muted-text)' }}>
                <tr>
                  <th className="w-[12%] px-3 py-2 text-[10px] font-black uppercase">Fecha</th>
                  <th className="w-[19%] px-3 py-2 text-[10px] font-black uppercase">Documento</th>
                  <th className="w-[27%] px-3 py-2 text-[10px] font-black uppercase">Cliente</th>
                  <th className="w-[13%] px-3 py-2 text-[10px] font-black uppercase">Estado</th>
                  <th className="w-[13%] px-3 py-2 text-right text-[10px] font-black uppercase">Total</th>
                  <th className="w-[16%] px-3 py-2 text-right text-[10px] font-black uppercase">Impacto fiscal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.documentType}-${row.id}`} style={{ borderTop: '1px solid var(--admin-card-border)' }}>
                    <td className="px-3 py-3 align-top font-bold">{formatReportDate(row.dateKey)}</td>
                    <td className="px-3 py-3 align-top">
                      <p className="break-words font-black [overflow-wrap:anywhere]">{row.number}</p>
                      <p className="mt-1 break-words text-xs font-bold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>{row.documentTypeLabel}{row.referenceNumber ? ` · Factura ${row.referenceNumber}` : ''}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="break-words font-black [overflow-wrap:anywhere]">{row.customerName}</p>
                      <p className="mt-1 break-words text-xs font-bold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>Orden #{row.orderNumber || '—'} · {row.channel} · {row.paymentMethod}</p>
                    </td>
                    <td className="px-3 py-3 align-top"><span className="inline-flex max-w-full break-words rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase" style={getStatusStyle(row.status)}>{row.statusLabel}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-top font-black">{formatCurrency(row.total)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-top font-black">{row.validated ? formatCurrency(row.fiscalImpact) : 'Sin impacto'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay detalle para los filtros seleccionados.</p>}
      </SummaryPanelCard>

      <div className="rounded-[22px] border px-4 py-3 text-xs font-bold leading-5" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)', color: 'var(--admin-card-muted-text)' }}>
        Los valores fiscales solo suman facturas y notas crédito validadas. Los documentos pendientes, rechazados o fallidos aparecen en los conteos y en el detalle, pero no alteran el total facturado ni el neto.
      </div>
    </section>
  );
}
