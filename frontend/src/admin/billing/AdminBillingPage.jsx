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
  RotateCcw,
  Search,
  Send,
  Settings2,
} from 'lucide-react';

import api from '../../lib/api';
import FacturacionSection from '../configuracion/sections/FacturacionSection';
import ElectronicInvoiceModal from '../orders/electronicInvoice/ElectronicInvoiceModal';
import useAdminPermissions from '../security/useAdminPermissions';
import {
  downloadOrderInvoiceXml,
  downloadOrderPdf,
  downloadBlob,
  generateBillingInvoiceForOrder,
  getBillingCreditNotes,
  getBillingDocuments,
  getDownloadErrorMessage,
  getBillingSummary,
  getPendingBillingOrders,
  syncBillingCreditNote,
  syncBillingDocument,
} from './api/adminBillingApi';

const BILLING_TABS = [
  {
    id: 'resumen',
    label: 'Resumen',
    icon: ReceiptText,
    permission: 'billing:view',
    description: 'Estado general de facturación, pendientes y alertas.',
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: FileText,
    permission: 'billing:view',
    description: 'Facturas, comprobantes y soportes generados.',
  },
  {
    id: 'notas-credito',
    label: 'Notas crédito',
    icon: RotateCcw,
    permission: 'billing:view',
    description: 'Bandeja de notas crédito asociadas a facturas electrónicas.',
  },
  {
    id: 'ordenes',
    label: 'Órdenes por facturar',
    icon: ClipboardList,
    permission: 'billing:view',
    description: 'Ventas pagadas que aún requieren comprobante.',
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings2,
    permission: 'billing:settings',
    description: 'Datos fiscales, proveedor, resolución, impuestos y textos legales.',
  },
];

const BASE_PATH = '/admin/facturacion';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'processing', label: 'Procesando' },
  { value: 'generated', label: 'Generadas' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'accepted', label: 'Aceptadas' },
  { value: 'validated', label: 'Validadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'failed', label: 'Fallidas' },
  { value: 'error', label: 'Error' },
];

const CREDIT_NOTE_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'created', label: 'Creadas' },
  { value: 'validated', label: 'Validadas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'failed', label: 'Fallidas' },
];

const CREDIT_NOTE_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'total', label: 'Total' },
  { value: 'partial', label: 'Parcial' },
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

function normalizeProviderLabel(value) {
  const text = String(value || '').trim();
  if (!text) return 'Interno';
  if (text === 'mock') return 'Interno';
  if (text === 'factus') return 'Factus';
  if (text === 'dian') return 'DIAN directa';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeModeLabel(value) {
  const text = String(value || '').toLowerCase();
  if (text === 'production') return 'Producción';
  if (text === 'test' || text === 'sandbox') return 'Pruebas';
  if (text === 'internal') return 'Interno';
  return value || 'Interno';
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
    processing: 'Procesando',
    generated: 'Generada',
    created: 'Creada',
    sent: 'Enviada',
    accepted: 'Aceptada',
    validated: 'Validada',
    rejected: 'Rechazada',
    failed: 'Fallida',
    error: 'Error',
  };

  return labels[value] || status || 'Pendiente';
}

function getCreditNoteTypeLabel(type) {
  return String(type || '').toLowerCase() === 'partial' ? 'Parcial' : 'Total';
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

  if (['sent', 'generated', 'created'].includes(value)) {
    return {
      borderColor: 'rgba(245, 158, 11, 0.36)',
      background: 'rgba(245, 158, 11, 0.12)',
      color: '#92400e',
    };
  }

  if (value === 'processing') {
    return {
      borderColor: 'rgba(59, 130, 246, 0.36)',
      background: 'rgba(59, 130, 246, 0.12)',
      color: '#1d4ed8',
    };
  }

  return {
    borderColor: 'var(--admin-card-border)',
    background: 'var(--admin-soft-bg)',
    color: 'var(--admin-card-text)',
  };
}

function uniqueById(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row?.id || row?._id || `${row?.invoiceNumber || ''}-${row?.orderNumber || ''}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
      className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border px-2 text-[11px] font-black transition hover:-translate-y-px hover:shadow-sm disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
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

function SummaryPanelCard({ title, eyebrow, children, footer }) {
  return (
    <section
      className="rounded-[28px] border p-4 shadow-sm"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>
        {eyebrow}
      </p>
      <h3 className="mt-1 text-lg font-black">{title}</h3>
      <div className="mt-4">{children}</div>
      {footer ? <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--admin-card-border)' }}>{footer}</div> : null}
    </section>
  );
}

function SummaryQuickLink({ to, children, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-xs font-black transition"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-soft-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </NavLink>
  );
}

function buildFallbackOrderForInvoice(document = {}) {
  const customer = document.customer || {};

  return {
    _id: document.orderId || '',
    orderNumber: document.orderNumber || '',
    customer: {
      name: customer.businessName || customer.name || 'Cliente',
      email: customer.email || '',
      documentNumber: customer.documentNumber || '',
    },
    billing: customer,
    items: [],
    cart: [],
    electronicInvoice: document,
  };
}

function unwrapOrderResponse(response) {
  const payload = response?.data;
  return payload?.data || payload?.order || payload || null;
}

async function buildInvoiceModalData(document = {}) {
  let order = null;
  if (document.orderId) {
    const response = await api.get(`/api/orders/${document.orderId}`);
    order = unwrapOrderResponse(response);
  }

  const fallbackOrder = buildFallbackOrderForInvoice(document);
  const resolvedOrder = order && (order._id || order.id) ? order : fallbackOrder;
  const resolvedInvoice =
    resolvedOrder?.electronicInvoice ||
    resolvedOrder?.invoice ||
    resolvedOrder?.dian ||
    resolvedOrder?.factus ||
    document;

  return {
    order: {
      ...fallbackOrder,
      ...resolvedOrder,
      _id: resolvedOrder?._id || resolvedOrder?.id || fallbackOrder._id,
      electronicInvoice: resolvedInvoice,
    },
    invoice: resolvedInvoice,
  };
}

function BillingDocumentsPanel() {
  const { can } = useAdminPermissions();
  const canDownload = can('billing:download');
  const canSync = can('billing:retry');
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
  const [notice, setNotice] = useState('');
  const [invoiceModalData, setInvoiceModalData] = useState(null);

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
    if (!document?.orderId) return;

    try {
      setError('');
      setActionLoading(`pdf-${document.id}`);
      const download = await downloadOrderPdf(document.orderId);
      downloadBlob(
        download,
        `factura-${document.invoiceNumber || document.provider?.number || document.orderNumber || document.id}.pdf`
      );
    } catch (err) {
      setError(await getDownloadErrorMessage(err, 'No se pudo descargar el PDF oficial.'));
    } finally {
      setActionLoading('');
    }
  };

  const openDocumentXml = async (document) => {
    if (!document?.orderId) return;

    try {
      setError('');
      setActionLoading(`xml-${document.id}`);
      const download = await downloadOrderInvoiceXml(document.orderId);
      downloadBlob(
        download,
        `factura-${document.invoiceNumber || document.provider?.number || document.orderNumber || document.id}.xml`
      );
    } catch (err) {
      setError(await getDownloadErrorMessage(err, 'No se pudo descargar el XML oficial.'));
    } finally {
      setActionLoading('');
    }
  };

  const openInvoiceManager = async (document) => {
    if (!document?.id) return;

    try {
      setError('');
      setActionLoading(`manage-${document.id}`);
      setInvoiceModalData(await buildInvoiceModalData(document));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo abrir la administración de la factura.');
    } finally {
      setActionLoading('');
    }
  };

  const syncDocument = async (document) => {
    const identifier = document?.id || document?.invoiceNumber || document?.provider?.number;
    if (!identifier) return;

    try {
      setError('');
      setNotice('');
      setActionLoading(`sync-${document.id}`);
      const data = await syncBillingDocument(identifier);
      const updated = data?.invoice;

      if (updated?.id) {
        setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      }

      setNotice(data?.message || 'Estado de la factura sincronizado correctamente.');
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'No se pudo sincronizar la factura.';
      await loadDocuments();
      setError(message);
    } finally {
      setActionLoading('');
    }
  };

  const closeInvoiceManager = () => {
    setInvoiceModalData(null);
    loadDocuments();
  };

  return (
    <section className="grid min-w-0 gap-4">
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
      {notice ? <MessageBox tone="success">{notice}</MessageBox> : null}

      <div className="overflow-hidden rounded-[28px] border shadow-sm" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="text-sm font-black">{loading ? 'Cargando documentos...' : `${formatNumber(total)} documento(s)`}</div>
          <div className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Página {formatNumber(page)} de {formatNumber(pages)}</div>
        </div>

        {rows.length === 0 && !loading ? (
          <EmptyWorkBlock icon={FileText} title="Sin documentos generados" text="Cuando una orden tenga factura electrónica o comprobante registrado en ElectronicInvoice, aparecerá en esta lista." />
        ) : (
          <div className="w-full min-w-0 overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <thead style={{ background: 'var(--admin-soft-bg)' }}>
                <tr style={{ color: 'var(--admin-card-muted-text)' }}>
                  <th className="w-[24%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Documento</th>
                  <th className="w-[17%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Cliente</th>
                  <th className="w-[19%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Estado / proveedor</th>
                  <th className="w-[16%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Fechas</th>
                  <th className="w-[24%] px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.12em]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((document) => {
                  const statusStyle = getStatusStyle(document.status);
                  const customer = document.customer || {};
                  const customerName = customer.businessName || customer.name || customer.email || 'Cliente';
                  const isPdfLoading = actionLoading === `pdf-${document.id}`;
                  const isXmlLoading = actionLoading === `xml-${document.id}`;
                  const isManageLoading = actionLoading === `manage-${document.id}`;
                  const isSyncLoading = actionLoading === `sync-${document.id}`;
                  const canOpenPdf = document.hasPdf || document.orderId;
                  const canOpenXml = document.hasXml && document.orderId;

                  return (
                    <tr key={document.id} style={{ borderTop: '1px solid var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black">{document.invoiceNumber || document.provider?.number || 'Sin número'}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden #{document.orderNumber || '—'}</p>
                        {document.cufe ? <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>CUFE {document.cufe}</p> : null}
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black">{customerName}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{customer.documentNumber || customer.email || 'Sin identificación'}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <span className="inline-flex max-w-full rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.04em]" style={statusStyle}>
                          <span className="truncate">{getStatusLabel(document.status)}</span>
                        </span>
                        <p className="mt-2 truncate text-sm font-black">{normalizeProviderLabel(document.provider?.name)}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{document.provider?.status || document.dianResponse?.code || 'Sin respuesta'}</p>
                        {document.sync?.status === 'failed' ? (
                          <p className="mt-1 whitespace-normal break-words text-[11px] font-bold leading-4" title={document.sync?.message || ''} style={{ color: '#be123c' }}>
                            {document.sync?.message || 'Falló la última sincronización'}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="font-bold leading-5">Creado: {formatDate(document.createdAt || document.generatedAt)}</p>
                        <p className="mt-1 text-xs font-bold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>Validado: {formatDate(document.acceptedAt || document.provider?.validatedAt)}</p>
                        <p className="mt-1 text-xs font-bold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>
                          {document.sync?.status === 'failed' ? 'Último intento' : 'Sincronizado'}: {formatDateTime(document.sync?.lastSuccessAt || document.sync?.lastAttemptAt)}
                        </p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <div className="grid grid-cols-2 gap-1.5">
                          <DocumentActionButton icon={Download} onClick={() => openDocumentPdf(document)} disabled={!canDownload || !canOpenPdf || isPdfLoading} variant="primary">{isPdfLoading ? '...' : 'PDF'}</DocumentActionButton>
                          <DocumentActionButton icon={FileText} onClick={() => openDocumentXml(document)} disabled={!canDownload || !canOpenXml || isXmlLoading}>{isXmlLoading ? '...' : 'XML'}</DocumentActionButton>
                          <DocumentActionButton icon={ExternalLink} onClick={() => openInvoiceManager(document)} disabled={isManageLoading}>{isManageLoading ? '...' : 'Factura'}</DocumentActionButton>
                          <DocumentActionButton icon={RefreshCw} onClick={() => syncDocument(document)} disabled={!canSync || isSyncLoading}>{isSyncLoading ? '...' : 'Sincronizar'}</DocumentActionButton>
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

      {invoiceModalData ? (
        <ElectronicInvoiceModal
          order={invoiceModalData.order}
          invoice={invoiceModalData.invoice}
          onClose={closeInvoiceManager}
        />
      ) : null}
    </section>
  );
}

function BillingCreditNotesPanel() {
  const { can } = useAdminPermissions();
  const canDownload = can('billing:download');
  const canSync = can('billing:retry');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [typingQuery, setTypingQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [invoiceModalData, setInvoiceModalData] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(typingQuery.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [typingQuery]);

  const loadCreditNotes = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getBillingCreditNotes({ page, limit: 20, q: query, status, type });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
      setPages(Math.max(1, Number(data?.pages || 1)));
    } catch (err) {
      setRows([]);
      setTotal(0);
      setPages(1);
      setError(err?.response?.data?.message || err?.message || 'No se pudieron cargar las notas crédito.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCreditNotes();
  }, [page, query, status, type]);

  const openCreditNoteInvoice = async (note) => {
    const document = note?.invoice || {
      id: note.invoiceId,
      orderId: note.orderId,
      orderNumber: note.orderNumber,
      invoiceNumber: note.invoiceNumber,
      cufe: note.invoiceCufe,
      customer: note.customer,
      provider: note.provider,
      status: note.invoiceStatus,
      creditNotes: [note],
    };

    try {
      setError('');
      setActionLoading(`invoice-${note.id}`);
      setInvoiceModalData(await buildInvoiceModalData(document));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo abrir la factura relacionada.');
    } finally {
      setActionLoading('');
    }
  };

  const openExternalCreditNote = (note) => {
    const url = note?.links?.publicUrl || note?.links?.pdfUrl || note?.links?.qrUrl || '';
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const syncCreditNote = async (note) => {
    const invoiceIdentifier = note?.invoiceId || note?.invoiceNumber;
    const noteIdentifier = note?.id || note?.noteNumber || note?.referenceCode;
    if (!invoiceIdentifier || !noteIdentifier) return;

    try {
      setError('');
      setNotice('');
      setActionLoading(`sync-${note.id}`);
      const data = await syncBillingCreditNote(invoiceIdentifier, noteIdentifier);
      const updated = data?.creditNote;

      if (updated?.id) {
        setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      }

      setNotice(data?.message || 'Estado de la nota crédito sincronizado correctamente.');
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'No se pudo sincronizar la nota crédito.';
      await loadCreditNotes();
      setError(message);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <section className="grid min-w-0 gap-4">
      <PanelHeader
        eyebrow="Bandeja fiscal"
        title="Notas crédito"
        text="Administración central de notas crédito guardadas dentro de ElectronicInvoice.creditNotes."
      >
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <label
            className="flex min-w-[260px] items-center gap-2 rounded-2xl border px-3 py-2"
            style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg, var(--admin-card-bg))' }}
          >
            <Search className="h-4 w-4" style={{ color: 'var(--admin-card-muted-text)' }} />
            <input
              value={typingQuery}
              onChange={(event) => setTypingQuery(event.target.value)}
              placeholder="Buscar nota, factura, cliente o motivo"
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
            {CREDIT_NOTE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border px-3 py-2 text-sm font-black outline-none"
            style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-input-bg, var(--admin-card-bg))', color: 'var(--admin-card-text)' }}
          >
            {CREDIT_NOTE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ActionButton icon={RefreshCw} onClick={loadCreditNotes} disabled={loading}>Actualizar</ActionButton>
        </div>
      </PanelHeader>

      {error ? <MessageBox>{error}</MessageBox> : null}
      {notice ? <MessageBox tone="success">{notice}</MessageBox> : null}

      <div className="overflow-hidden rounded-[28px] border shadow-sm" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="text-sm font-black">{loading ? 'Cargando notas crédito...' : `${formatNumber(total)} nota(s) crédito`}</div>
          <div className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Página {formatNumber(page)} de {formatNumber(pages)}</div>
        </div>

        {rows.length === 0 && !loading ? (
          <EmptyWorkBlock icon={RotateCcw} title="Sin notas crédito registradas" text="Cuando una factura tenga nota crédito total o parcial, aparecerá aquí sin salir del módulo de Facturación." />
        ) : (
          <div className="w-full min-w-0 overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <thead style={{ background: 'var(--admin-soft-bg)' }}>
                <tr style={{ color: 'var(--admin-card-muted-text)' }}>
                  <th className="w-[16%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Nota crédito</th>
                  <th className="w-[18%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Factura</th>
                  <th className="w-[16%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Cliente</th>
                  <th className="w-[18%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Estado / tipo</th>
                  <th className="w-[11%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Valor</th>
                  <th className="w-[21%] px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.12em]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((note) => {
                  const customer = note.customer || {};
                  const customerName = customer.businessName || customer.name || customer.email || 'Cliente';
                  const isOpening = actionLoading === `invoice-${note.id}`;
                  const isSyncing = actionLoading === `sync-${note.id}`;
                  const hasExternal = Boolean(note?.links?.publicUrl || note?.links?.pdfUrl || note?.links?.qrUrl);

                  return (
                    <tr key={note.id} style={{ borderTop: '1px solid var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black">{note.noteNumber || note.referenceCode || 'Sin número'}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Ref. {note.referenceCode || '—'}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(note.createdAt)}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black">{note.invoiceNumber || note.billNumber || 'Sin factura'}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden #{note.orderNumber || '—'}</p>
                        <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>CUFE {note.invoiceCufe || '—'}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black">{customerName}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{customer.documentNumber || customer.email || 'Sin identificación'}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <span className="inline-flex max-w-full rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.04em]" style={getStatusStyle(note.status)}>
                          <span className="truncate">{getStatusLabel(note.status)}</span>
                        </span>
                        <p className="mt-2 truncate text-sm font-black">{getCreditNoteTypeLabel(note.type)}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{normalizeProviderLabel(note.provider?.name)}</p>
                        <p className="mt-1 truncate text-[11px] font-bold" title={note.sync?.message || ''} style={{ color: note.sync?.status === 'failed' ? '#be123c' : 'var(--admin-card-muted-text)' }}>
                          {note.sync?.lastAttemptAt
                            ? `${note.sync?.status === 'failed' ? 'Último intento' : 'Sincronizada'}: ${formatDateTime(note.sync?.lastSuccessAt || note.sync?.lastAttemptAt)}`
                            : 'Sin sincronizar'}
                        </p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="font-black">{formatCurrency(note.totalAmount)}</p>
                        <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatNumber(note.itemsCount || 0)} ítem(s)</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <div className="grid gap-1.5">
                          <DocumentActionButton icon={ExternalLink} onClick={() => openCreditNoteInvoice(note)} disabled={isOpening}>{isOpening ? '...' : 'Factura'}</DocumentActionButton>
                          <DocumentActionButton icon={Download} onClick={() => openExternalCreditNote(note)} disabled={!canDownload || !hasExternal} variant="primary">Soporte</DocumentActionButton>
                          <DocumentActionButton icon={RefreshCw} onClick={() => syncCreditNote(note)} disabled={!canSync || isSyncing}>{isSyncing ? '...' : 'Sincronizar'}</DocumentActionButton>
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
          <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Fuente: ElectronicInvoice.creditNotes. No se crea módulo separado.</p>
          <div className="flex gap-2">
            <ActionButton disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</ActionButton>
            <ActionButton disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))}>Siguiente</ActionButton>
          </div>
        </div>
      </div>

      {invoiceModalData ? (
        <ElectronicInvoiceModal
          order={invoiceModalData.order}
          invoice={invoiceModalData.invoice}
          onClose={() => {
            setInvoiceModalData(null);
            loadCreditNotes();
          }}
        />
      ) : null}
    </section>
  );
}

function BillingPendingOrdersPanel() {
  const { can } = useAdminPermissions();
  const canGenerate = can('billing:create');
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
                          {canGenerate ? (
                            <ActionButton icon={ReceiptText} onClick={() => handleGenerateInvoice(order)} disabled={isGenerating || loading} variant="primary">
                              {isGenerating ? 'Generando...' : 'Generar'}
                            </ActionButton>
                          ) : (
                            <span className="rounded-xl border px-3 py-2 text-xs font-black" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>
                              Solo lectura
                            </span>
                          )}
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

export default function AdminBillingPage() {
  const location = useLocation();
  const { can } = useAdminPermissions();
  const canView = can('billing:view');
  const canConfigure = can('billing:settings');

  const visibleTabs = useMemo(
    () =>
      BILLING_TABS.filter((tab) =>
        tab.permission === 'billing:settings' ? canConfigure : canView
      ),
    [canConfigure, canView]
  );

  const activeTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return visibleTabs.some((tab) => tab.id === last)
      ? last
      : visibleTabs[0]?.id || 'resumen';
  }, [location.pathname, visibleTabs]);

  const activeData = visibleTabs.find((tab) => tab.id === activeTab) || visibleTabs[0] || BILLING_TABS[0];
  const ActiveIcon = activeData.icon || ReceiptText;

  const renderContent = () => {
    if (activeTab === 'configuracion') {
      return <FacturacionSection />;
    }

    if (activeTab === 'documentos') {
      return <BillingDocumentsPanel />;
    }

    if (activeTab === 'notas-credito') {
      return <BillingCreditNotesPanel />;
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
          {visibleTabs.map((tab) => {
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
