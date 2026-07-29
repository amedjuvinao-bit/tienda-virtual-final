import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  FileText,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
} from 'lucide-react';

import {
  getBillingDocuments,
  getBillingSummary,
  getPendingBillingOrders,
} from '../api/adminBillingApi';
import { BASE_PATH } from '../billingConstants';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getStatusLabel,
  getStatusStyle,
  normalizeChannelLabel,
  normalizeModeLabel,
  normalizeProviderLabel,
  uniqueById,
} from '../billingFormatters';
import {
  ActionButton,
  BillingMetricCard,
  MessageBox,
  PanelHeader,
  SummaryPanelCard,
  SummaryQuickLink,
} from '../components/BillingUi';

export default function BillingSummaryPanel() {
  const [summary, setSummary] = useState(null);
  const [latestDocuments, setLatestDocuments] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [errorDocuments, setErrorDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError('');

      const [summaryData, latestData, pendingData, errorData, failedData, rejectedData] = await Promise.all([
        getBillingSummary(),
        getBillingDocuments({ page: 1, limit: 3, status: 'all' }),
        getPendingBillingOrders({ page: 1, limit: 3 }),
        getBillingDocuments({ page: 1, limit: 3, status: 'error' }),
        getBillingDocuments({ page: 1, limit: 3, status: 'failed' }),
        getBillingDocuments({ page: 1, limit: 3, status: 'rejected' }),
      ]);

      setSummary(summaryData || {});
      setLatestDocuments(Array.isArray(latestData?.rows) ? latestData.rows : []);
      setPendingOrders(Array.isArray(pendingData?.rows) ? pendingData.rows : []);
      setErrorDocuments(uniqueById([
        ...(Array.isArray(errorData?.rows) ? errorData.rows : []),
        ...(Array.isArray(failedData?.rows) ? failedData.rows : []),
        ...(Array.isArray(rejectedData?.rows) ? rejectedData.rows : []),
      ]).slice(0, 3));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo cargar el resumen de facturación.');
      setSummary({});
      setLatestDocuments([]);
      setPendingOrders([]);
      setErrorDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const latest = latestDocuments[0];
  const resolution = summary?.resolution || {};
  const remaining = Number(summary?.rangeTo || 0) > 0
    ? Math.max(0, Number(summary?.rangeTo || 0) - Number(summary?.nextNumber || 0) + 1)
    : null;

  return (
    <div className="grid gap-5">
      <PanelHeader
        eyebrow="Control general"
        title="Módulo unificado de facturación"
        text="Indicadores reales tomados de ElectronicInvoice, notas crédito, órdenes pendientes y configuración actual."
      >
        <div className="flex flex-wrap gap-2">
          <SummaryQuickLink to={`${BASE_PATH}/documentos`} icon={FileText}>Ver documentos</SummaryQuickLink>
          <SummaryQuickLink to={`${BASE_PATH}/notas-credito`} icon={RotateCcw}>Notas crédito</SummaryQuickLink>
          <SummaryQuickLink to={`${BASE_PATH}/ordenes`} icon={ClipboardList}>Órdenes pendientes</SummaryQuickLink>
          <SummaryQuickLink to={`${BASE_PATH}/reportes`} icon={BarChart3}>Reportes</SummaryQuickLink>
          <ActionButton icon={RefreshCw} onClick={loadSummary} disabled={loading}>Actualizar</ActionButton>
        </div>
      </PanelHeader>

      {error ? <MessageBox>{error}</MessageBox> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <BillingMetricCard icon={FileText} label="Emitidas" value={loading ? '...' : formatNumber(summary?.emitted || 0)} helper={`${formatNumber(summary?.validated || 0)} validadas`} />
        <BillingMetricCard icon={ClipboardList} label="Pendientes" value={loading ? '...' : formatNumber(summary?.pending || 0)} helper="Órdenes por facturar" />
        <BillingMetricCard icon={RotateCcw} label="Notas crédito" value={loading ? '...' : formatNumber(summary?.creditNotes || 0)} helper="Devoluciones y ajustes" />
        <BillingMetricCard icon={AlertTriangle} label="Errores" value={loading ? '...' : formatNumber(summary?.errors || 0)} helper="Rechazadas o fallidas" />
        <BillingMetricCard icon={Send} label="Proveedor" value={normalizeProviderLabel(summary?.provider)} helper={normalizeModeLabel(summary?.mode)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SummaryPanelCard
          eyebrow="Última emisión"
          title="Último documento generado"
          footer={<SummaryQuickLink to={`${BASE_PATH}/documentos`} icon={FileText}>Abrir Documentos</SummaryQuickLink>}
        >
          {latest ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xl font-black">{latest.invoiceNumber || latest.provider?.number || 'Sin número'}</p>
                <p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden #{latest.orderNumber || '—'}</p>
                <p className="mt-2 truncate text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>CUFE {latest.cufe || '—'}</p>
              </div>
              <div className="grid gap-2">
                <span className="inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.06em]" style={getStatusStyle(latest.status)}>
                  {getStatusLabel(latest.status)}
                </span>
                <p className="text-sm font-black">{normalizeProviderLabel(latest.provider?.name)}</p>
                <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Creado: {formatDate(latest.createdAt || latest.generatedAt)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>Todavía no hay documentos generados.</p>
          )}
        </SummaryPanelCard>

        <SummaryPanelCard
          eyebrow="Resolución"
          title="Numeración y proveedor"
          footer={<SummaryQuickLink to={`${BASE_PATH}/configuracion`} icon={Settings2}>Abrir configuración</SummaryQuickLink>}
        >
          <div className="grid gap-3 text-sm font-bold">
            <div className="flex items-center justify-between gap-3">
              <span style={{ color: 'var(--admin-card-muted-text)' }}>Prefijo</span>
              <span>{resolution.prefix || 'FE'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span style={{ color: 'var(--admin-card-muted-text)' }}>Siguiente número</span>
              <span>{formatNumber(summary?.nextNumber || 1)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span style={{ color: 'var(--admin-card-muted-text)' }}>Restantes</span>
              <span>{remaining === null ? 'Sin rango' : formatNumber(remaining)}</span>
            </div>
          </div>
        </SummaryPanelCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SummaryPanelCard
          eyebrow="Pendientes"
          title="Órdenes próximas por facturar"
          footer={<SummaryQuickLink to={`${BASE_PATH}/ordenes`} icon={ClipboardList}>Gestionar órdenes</SummaryQuickLink>}
        >
          {pendingOrders.length > 0 ? (
            <div className="grid gap-3">
              {pendingOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">#{order.orderNumber || '—'} · {order.customerName || 'Cliente'}</p>
                    <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{normalizeChannelLabel(order.source)} · {formatDate(order.createdAt)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-black">{formatCurrency(order.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay órdenes pendientes por facturar.</p>
          )}
        </SummaryPanelCard>

        <SummaryPanelCard
          eyebrow="Alertas"
          title="Últimos errores de emisión"
          footer={<SummaryQuickLink to={`${BASE_PATH}/documentos`} icon={AlertTriangle}>Revisar documentos</SummaryQuickLink>}
        >
          {errorDocuments.length > 0 ? (
            <div className="grid gap-3">
              {errorDocuments.map((document) => (
                <div key={document.id} className="rounded-2xl border px-3 py-2" style={{ borderColor: 'rgba(244, 63, 94, 0.28)', background: 'rgba(244, 63, 94, 0.08)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black">{document.invoiceNumber || document.provider?.number || 'Sin número'}</p>
                    <span className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase" style={getStatusStyle(document.status)}>{getStatusLabel(document.status)}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden #{document.orderNumber || '—'} · {document.errorMessage || document.provider?.status || 'Sin detalle'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay errores recientes de emisión.</p>
          )}
        </SummaryPanelCard>
      </div>
    </div>
  );
}
