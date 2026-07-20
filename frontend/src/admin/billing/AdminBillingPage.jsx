// frontend/src/admin/billing/AdminBillingPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  ReceiptText,
  Search,
  Send,
  Settings2,
} from 'lucide-react';

import FacturacionSection from '../configuracion/sections/FacturacionSection';
import {
  downloadOrderInvoiceXml,
  downloadOrderPdf,
  generateBillingInvoiceForOrder,
  getBillingDocuments,
  getBillingSummary,
  getPendingBillingOrders,
  openBlob,
} from './api/adminBillingApi';

const BILLING_TABS = [
  {
    id: 'resumen',
    label: 'Resumen',
    icon: ReceiptText,
    description: 'Estado general de facturación, pendientes y alertas.',
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: FileText,
    description: 'Facturas, comprobantes y soportes generados.',
  },
  {
    id: 'ordenes',
    label: 'Órdenes por facturar',
    icon: ClipboardList,
    description: 'Ventas pagadas que aún requieren comprobante.',
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings2,
    description: 'Datos fiscales, proveedor, resolución, impuestos y textos legales.',
  },
];

const BASE_PATH = '/admin/facturacion';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'generated', label: 'Generadas' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'accepted', label: 'Aceptadas' },
  { value: 'validated', label: 'Validadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'failed', label: 'Fallidas' },
  { value: 'error', label: 'Error' },
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-CO');
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
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

function normalizeProviderLabel(value) {
  const text = String(value || '').trim();
  if (!text) return 'Interno';
  if (text === 'mock') return 'Interno';
  if (text === 'factus') return 'Factus';
  if (text === 'dian') return 'DIAN directa';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeChannelLabel(value) {
  const text = String(value || '').toLowerCase();
  if (text === 'pos') return 'POS';
  if (text === 'web' || text === 'online') return 'Tienda web';
  return value || 'Sin canal';
}

function normalizePaymentStatus(value) {
  const text = String(value || '').toLowerCase();
  const labels = {
    paid: 'Pagado',
    approved: 'Aprobado',
    captured: 'Capturado',
    success: 'Pagado',
    pending: 'Pendiente',
    failed: 'Fallido',
    rejected: 'Rechazado',
  };

  return labels[text] || value || 'Sin estado';
}

function getStatusLabel(status) {
  const value = String(status || '').toLowerCase();
  const labels = {
    pending: 'Pendiente',
    generated: 'Generada',
    sent: 'Enviada',
    accepted: 'Aceptada',
    validated: 'Validada',
    rejected: 'Rechazada',
    failed: 'Fallida',
    error: 'Error',
  };

  return labels[value] || status || 'Pendiente';
}

function getStatusStyle(status) {
  const value = String(status || '').toLowerCase();

  if (['accepted', 'validated'].includes(value)) {
    return {
      borderColor: 'rgba(16, 185, 129, 0.36)',
      background: 'rgba(16, 185, 129, 0.12)',
      color: '#047857',
    };
  }

  if (['rejected', 'failed', 'error'].includes(value)) {
    return {
      borderColor: 'rgba(244, 63, 94, 0.36)',
      background: 'rgba(244, 63, 94, 0.12)',
      color: '#be123c',
    };
  }

  if (['sent', 'generated'].includes(value)) {
    return {
      borderColor: 'rgba(245, 158, 11, 0.36)',
      background: 'rgba(245, 158, 11, 0.12)',
      color: '#92400e',
    };
  }

  return {
    borderColor: 'var(--admin-card-border)',
    background: 'var(--admin-soft-bg)',
    color: 'var(--admin-card-text)',
  };
}

function MessageBox({ children, tone = 'error' }) {
  const isError = tone === 'error';

  return (
    <div
      className="rounded-[22px] border px-4 py-3 text-sm font-bold"
      style={{
        borderColor: isError ? 'rgba(244, 63, 94, 0.36)' : 'rgba(16, 185, 129, 0.36)',
        background: isError ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
        color: isError ? '#be123c' : '#047857',
      }}
    >
      {children}
    </div>
  );
}

function BillingMetricCard({ label, value, helper, icon: Icon }) {
  return (
    <article
      className="rounded-[26px] border p-4 shadow-sm"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-black">{value}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
            {helper}
          </p>
        </div>
        <span
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border"
          style={{
            borderColor: 'var(--admin-card-border)',
            background: 'var(--admin-soft-bg)',
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function EmptyWorkBlock({ title, text, icon: Icon }) {
  return (
    <section
      className="rounded-[28px] border p-6 text-center shadow-sm"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <span
        className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-3xl border"
        style={{
          borderColor: 'var(--admin-card-border)',
          background: 'var(--admin-soft-bg)',
        }}
      >
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6" style={{ color: 'var(--admin-card-muted-text)' }}>
        {text}
      </p>
    </section>
  );
}

function ActionButton({ children, icon: Icon, disabled, onClick, variant = 'soft' }) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55"
      style={{
        borderColor: isPrimary ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)',
        background: isPrimary ? 'var(--admin-accent, #ec4899)' : 'var(--admin-soft-bg)',
        color: isPrimary ? '#fff' : 'var(--admin-card-text)',
      }}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

function DocumentActionButton({ children, icon: Icon, disabled, onClick, variant = 'soft' }) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 min-w-[54px] items-center justify-center gap-1 rounded-xl border px-2 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: isPrimary ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)',
        background: isPrimary ? 'var(--admin-accent, #ec4899)' : 'var(--admin-soft-bg)',
        color: isPrimary ? '#fff' : 'var(--admin-card-text)',
      }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
      <span className="leading-none">{children}</span>
    </button>
  );
}

function PanelHeader({ eyebrow, title, text, children }) {
  return (
    <div
      className="rounded-[28px] border p-4 shadow-sm"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-accent, #ec4899)' }}>
            {eyebrow}
          </p>
          <h3 className="mt-1 text-2xl font-black">{title}</h3>
          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
            {text}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function BillingDocumentsPanel() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [typingQuery, setTypingQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(typingQuery.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [typingQuery]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getBillingDocuments({ page, limit: 20, q: query, status });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
      setPages(Math.max(1, Number(data?.pages || 1)));
    } catch (err) {
      setRows([]);
      setTotal(0);
      setPages(1);
      setError(err?.response?.data?.message || err?.message || 'No se pudieron cargar los documentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [page, query, status]);

  const openDocumentPdf = async (document) => {
    const publicUrl = document?.links?.pdfUrl || document?.links?.publicUrl || '';
    if (publicUrl) {
      window.open(publicUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!document?.orderId) return;

    try {
      setActionLoading(`pdf-${document.id}`);
      const blob = await downloadOrderPdf(document.orderId);
      openBlob(blob, 'application/pdf');
    } finally {
      setActionLoading('');
    }
  };

  const openDocumentXml = async (document) => {
    const publicUrl = document?.links?.xmlUrl || '';
    if (publicUrl) {
      window.open(publicUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!document?.orderId) return;

    try {
      setActionLoading(`xml-${document.id}`);
      const blob = await downloadOrderInvoiceXml(document.orderId);
      openBlob(blob, 'application/xml');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <section className="grid gap-4">
      <PanelHeader
        eyebrow="Documentos reales"
        title="Facturas y comprobantes emitidos"
        text="Información tomada de ElectronicInvoice, la misma usada por Órdenes."
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label
            className="flex min-w-[260px] items-center gap-2 rounded-2xl border px-3 py-2"
            style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg, var(--admin-card-bg))' }}
          >
            <Search className="h-4 w-4" style={{ color: 'var(--admin-card-muted-text)' }} />
            <input
              value={typingQuery}
              onChange={(event) => setTypingQuery(event.target.value)}
              placeholder="Buscar orden, factura, cliente o CUFE"
              className="w-full bg-transparent text-sm font-bold outline-none"
              style={{ color: 'var(--admin-card-text)' }}
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border px-3 py-2 text-sm font-black outline-none"
            style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg, var(--admin-card-bg))', color: 'var(--admin-card-text)' }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ActionButton icon={RefreshCw} onClick={loadDocuments} disabled={loading}>Actualizar</ActionButton>
        </div>
      </PanelHeader>

      {error ? <MessageBox>{error}</MessageBox> : null}

      <div className="overflow-hidden rounded-[28px] border shadow-sm" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="text-sm font-black">{loading ? 'Cargando documentos...' : `${formatNumber(total)} documento(s)`}</div>
          <div className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Página {formatNumber(page)} de {formatNumber(pages)}</div>
        </div>

        {rows.length === 0 && !loading ? (
          <EmptyWorkBlock icon={FileText} title="Sin documentos generados" text="Cuando una orden tenga factura electrónica o comprobante registrado en ElectronicInvoice, aparecerá en esta lista." />
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--admin-card-muted-text)' }}>
                  <th className="w-[26%] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Documento</th>
                  <th className="w-[19%] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Cliente</th>
                  <th className="w-[18%] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Estado / proveedor</th>
                  <th className="w-[17%] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Fechas</th>
                  <th className="w-[20%] px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em]">Soportes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((document) => {
                  const statusStyle = getStatusStyle(document.status);
                  const customer = document.customer || {};
                  const customerName = customer.businessName || customer.name || customer.email || 'Cliente';
                  const isPdfLoading = actionLoading === `pdf-${document.id}`;
                  const isXmlLoading = actionLoading === `xml-${document.id}`;
                  const canOpenPdf = document.hasPdf || document.orderId;
                  const canOpenXml = document.hasXml || document.links?.xmlUrl;

                  return (
                    <tr key={document.id} style={{ borderTop: '1px solid var(--admin-card-border)' }}>
                      <td className="px-4 py-4 align-top">
                        <p className="truncate font-black">{document.invoiceNumber || document.provider?.number || 'Sin número'}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden #{document.orderNumber || '—'}</p>
                        {document.cufe ? <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>CUFE {document.cufe}</p> : null}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="truncate font-black">{customerName}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{customer.documentNumber || customer.email || 'Sin identificación'}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex max-w-full rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.04em]" style={statusStyle}>
                          <span className="truncate">{getStatusLabel(document.status)}</span>
                        </span>
                        <p className="mt-2 truncate text-sm font-black">{normalizeProviderLabel(document.provider?.name)}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{document.provider?.status || document.dianResponse?.code || 'Sin respuesta'}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold leading-5">Creado: {formatDate(document.createdAt || document.generatedAt)}</p>
                        <p className="mt-1 text-xs font-bold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>Validado: {formatDate(document.acceptedAt || document.provider?.validatedAt)}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <DocumentActionButton icon={Download} onClick={() => openDocumentPdf(document)} disabled={!canOpenPdf || isPdfLoading} variant="primary">{isPdfLoading ? '...' : 'PDF'}</DocumentActionButton>
                          <DocumentActionButton icon={FileText} onClick={() => openDocumentXml(document)} disabled={!canOpenXml || isXmlLoading}>{isXmlLoading ? '...' : 'XML'}</DocumentActionButton>
                          {document.links?.publicUrl ? <DocumentActionButton icon={ExternalLink} onClick={() => window.open(document.links.publicUrl, '_blank', 'noopener,noreferrer')}>Ver</DocumentActionButton> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--admin-card-border)' }}>
          <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Fuente: ElectronicInvoice. No se usa ningún modelo Invoice paralelo.</p>
          <div className="flex gap-2">
            <ActionButton disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</ActionButton>
            <ActionButton disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))}>Siguiente</ActionButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function BillingPendingOrdersPanel() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [typingQuery, setTypingQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(typingQuery.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [typingQuery]);

  const loadPendingOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getPendingBillingOrders({ page, limit: 20, q: query });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
      setPages(Math.max(1, Number(data?.pages || 1)));
    } catch (err) {
      setRows([]);
      setTotal(0);
      setPages(1);
      setError(err?.response?.data?.message || err?.message || 'No se pudieron cargar las órdenes por facturar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingOrders();
  }, [page, query]);

  const handleGenerateInvoice = async (order) => {
    if (!order?.id) return;

    try {
      setNotice('');
      setError('');
      setActionLoading(`generate-${order.id}`);
      const result = await generateBillingInvoiceForOrder(order.id);
      const number = result?.invoice?.invoiceNumber || result?.invoice?.provider?.number || '';
      setNotice(number ? `Factura ${number} generada correctamente.` : 'Factura generada correctamente.');
      await loadPendingOrders();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo generar la factura.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <section className="grid gap-4">
      <PanelHeader
        eyebrow="Pendientes de emisión"
        title="Órdenes por facturar"
        text="Ventas pagadas que todavía no tienen registro en ElectronicInvoice."
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label
            className="flex min-w-[280px] items-center gap-2 rounded-2xl border px-3 py-2"
            style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg, var(--admin-card-bg))' }}
          >
            <Search className="h-4 w-4" style={{ color: 'var(--admin-card-muted-text)' }} />
            <input
              value={typingQuery}
              onChange={(event) => setTypingQuery(event.target.value)}
              placeholder="Buscar orden o cliente"
              className="w-full bg-transparent text-sm font-bold outline-none"
              style={{ color: 'var(--admin-card-text)' }}
            />
          </label>
          <ActionButton icon={RefreshCw} onClick={loadPendingOrders} disabled={loading}>Actualizar</ActionButton>
        </div>
      </PanelHeader>

      {error ? <MessageBox>{error}</MessageBox> : null}
      {notice ? <MessageBox tone="success">{notice}</MessageBox> : null}

      <div className="overflow-hidden rounded-[28px] border shadow-sm" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="text-sm font-black">{loading ? 'Cargando órdenes...' : `${formatNumber(total)} orden(es) pendiente(s)`}</div>
          <div className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Página {formatNumber(page)} de {formatNumber(pages)}</div>
        </div>

        {rows.length === 0 && !loading ? (
          <EmptyWorkBlock icon={ClipboardList} title="Sin órdenes pendientes" text="Cuando una orden pagada no tenga ElectronicInvoice, aparecerá aquí para generar la factura." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--admin-card-muted-text)' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Orden</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Cliente</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Canal</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Pago</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Total</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const isGenerating = actionLoading === `generate-${order.id}`;

                  return (
                    <tr key={order.id} style={{ borderTop: '1px solid var(--admin-card-border)' }}>
                      <td className="px-4 py-4 align-top">
                        <p className="font-black">#{order.orderNumber || '—'}</p>
                        <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Creada: {formatDate(order.createdAt)}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-black">{order.customerName || 'Cliente'}</p>
                        <p className="mt-1 max-w-[260px] truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{order.customerEmail || 'Sin correo'}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-black">{normalizeChannelLabel(order.source)}</p>
                        <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatNumber(order.itemsCount || 0)} producto(s)</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em]" style={{ borderColor: 'rgba(16, 185, 129, 0.36)', background: 'rgba(16, 185, 129, 0.12)', color: '#047857' }}>
                          {normalizePaymentStatus(order.paymentStatus)}
                        </span>
                        <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{order.paymentProvider || 'Sin proveedor'}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-black">{formatCurrency(order.total)}</p>
                        <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Envío {formatCurrency(order.shipping)}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionButton icon={ExternalLink} onClick={() => window.open(`/admin/ordenes?order=${order.id}`, '_blank', 'noopener,noreferrer')}>Ver orden</ActionButton>
                          <ActionButton icon={ReceiptText} onClick={() => handleGenerateInvoice(order)} disabled={isGenerating || loading} variant="primary">
                            {isGenerating ? 'Generando...' : 'Generar'}
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--admin-card-border)' }}>
          <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Fuente: Order menos órdenes que ya existen en ElectronicInvoice.</p>
          <div className="flex gap-2">
            <ActionButton disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</ActionButton>
            <ActionButton disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))}>Siguiente</ActionButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function BillingSummaryPanel() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getBillingSummary();
      setSummary(data || {});
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo cargar el resumen.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <div className="grid gap-5">
      {error ? <MessageBox>{error}</MessageBox> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BillingMetricCard icon={FileText} label="Emitidas" value={loading ? '...' : formatNumber(summary?.emitted || 0)} helper="Documentos generados" />
        <BillingMetricCard icon={ClipboardList} label="Pendientes" value={loading ? '...' : formatNumber(summary?.pending || 0)} helper="Órdenes por facturar" />
        <BillingMetricCard icon={AlertTriangle} label="Errores" value={loading ? '...' : formatNumber(summary?.errors || 0)} helper="Emisiones fallidas" />
        <BillingMetricCard icon={Send} label="Proveedor" value={normalizeProviderLabel(summary?.provider)} helper="Según configuración actual" />
      </div>
      <EmptyWorkBlock icon={ReceiptText} title="Módulo unificado de facturación" text="Esta pantalla centraliza la operación de facturación. Conserva la configuración existente y usa ElectronicInvoice como documento oficial para documentos, órdenes pendientes, comprobantes PDF y emisión electrónica." />
    </div>
  );
}

export default function AdminBillingPage() {
  const location = useLocation();

  const activeTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return BILLING_TABS.some((tab) => tab.id === last) ? last : 'resumen';
  }, [location.pathname]);

  const activeData = BILLING_TABS.find((tab) => tab.id === activeTab) || BILLING_TABS[0];
  const ActiveIcon = activeData.icon || ReceiptText;

  const renderContent = () => {
    if (activeTab === 'configuracion') {
      return <FacturacionSection />;
    }

    if (activeTab === 'documentos') {
      return <BillingDocumentsPanel />;
    }

    if (activeTab === 'ordenes') {
      return <BillingPendingOrdersPanel />;
    }

    return <BillingSummaryPanel />;
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-3 md:p-5">
      <section className="overflow-hidden rounded-[32px] border shadow-sm" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between md:p-6" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex items-start gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
              <ActiveIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--admin-accent, #ec4899)' }}>Facturación</p>
              <h1 className="mt-1 text-3xl font-black">{activeData.label}</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6" style={{ color: 'var(--admin-card-muted-text)' }}>{activeData.description}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b px-5 py-3 md:px-6" style={{ borderColor: 'var(--admin-card-border)' }}>
          {BILLING_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.id}
                to={`${BASE_PATH}/${tab.id}`}
                className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black transition"
                style={({ isActive }) => ({
                  borderColor: isActive ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)',
                  background: isActive ? 'var(--admin-active-nav-bg)' : 'var(--admin-soft-bg)',
                  color: isActive ? 'var(--admin-active-nav-text)' : 'var(--admin-card-text)',
                })}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="p-5 md:p-6">{renderContent()}</div>
      </section>
    </div>
  );
}
