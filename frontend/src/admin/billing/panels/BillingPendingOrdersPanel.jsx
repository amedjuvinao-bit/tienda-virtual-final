import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  ExternalLink,
  RefreshCw,
  ReceiptText,
  Search,
} from 'lucide-react';

import useAdminPermissions from '../../security/useAdminPermissions';
import {
  generateBillingInvoiceForOrder,
  getPendingBillingOrders,
} from '../api/adminBillingApi';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  normalizeChannelLabel,
  normalizePaymentStatus,
} from '../billingFormatters';
import {
  ActionButton,
  EmptyWorkBlock,
  MessageBox,
  PanelHeader,
} from '../components/BillingUi';

function collectProviderMessages(value, output = [], depth = 0) {
  if (depth > 4 || value === null || value === undefined) return output;

  if (typeof value === 'string' || typeof value === 'number') {
    const message = String(value).trim();
    if (message && !output.includes(message)) output.push(message);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectProviderMessages(item, output, depth + 1));
    return output;
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((item) =>
      collectProviderMessages(item, output, depth + 1)
    );
  }

  return output;
}

function billingIssueMessage(issue = null) {
  if (!issue) return '';

  const summary = String(issue.errorMessage || '').trim();
  const details = collectProviderMessages(issue.providerErrors).slice(0, 3);
  const genericSummary = /^(error de validaci[oó]n|the given data was invalid\.?|factus rechaz[oó] la factura)\.?$/i.test(summary);

  if (details.length && genericSummary) return details.join(' ');
  if (details.length && !details.some((message) => summary.includes(message))) {
    return [summary, ...details].filter(Boolean).join(' ');
  }

  return summary || details.join(' ') || 'Factus rechazó la emisión y requiere corrección.';
}

export default function BillingPendingOrdersPanel() {
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
      const message = err?.response?.data?.message || err?.message || 'No se pudo generar la factura.';
      await loadPendingOrders();
      setError(message);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <section className="grid min-w-0 gap-4">
      <PanelHeader
        eyebrow="Pendientes de emisión"
        title="Órdenes por facturar"
        text="Ventas pagadas sin factura validada o con una emisión que requiere corrección."
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

      <div className="min-w-0 overflow-hidden rounded-[28px] border shadow-sm" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="text-sm font-black">{loading ? 'Cargando órdenes...' : `${formatNumber(total)} orden(es) por emitir o corregir`}</div>
          <div className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Página {formatNumber(page)} de {formatNumber(pages)}</div>
        </div>

        {rows.length === 0 && !loading ? (
          <EmptyWorkBlock icon={ClipboardList} title="Sin órdenes pendientes" text="Cuando una orden pagada no tenga ElectronicInvoice, aparecerá aquí para generar la factura." />
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-left text-sm">
              <thead style={{ background: 'var(--admin-soft-bg)' }}>
                <tr style={{ color: 'var(--admin-card-muted-text)' }}>
                  <th className="w-[13%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Orden</th>
                  <th className="w-[28%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Cliente</th>
                  <th className="w-[11%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Canal</th>
                  <th className="w-[14%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Pago</th>
                  <th className="w-[14%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Total</th>
                  <th className="w-[20%] px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.12em]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const isGenerating = actionLoading === `generate-${order.id}`;
                  const issueMessage = billingIssueMessage(order.billingIssue);

                  return (
                    <tr key={order.id} style={{ borderTop: '1px solid var(--admin-card-border)' }}>
                      <td className="px-3 py-4 align-top">
                        <p className="break-words font-black">#{order.orderNumber || '—'}</p>
                        <p className="mt-1 text-xs font-bold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>Creada: {formatDate(order.createdAt)}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="break-words font-black leading-5">{order.customerName || 'Cliente'}</p>
                        <p className="mt-1 break-words text-xs font-bold leading-5 [overflow-wrap:anywhere]" style={{ color: 'var(--admin-card-muted-text)' }}>{order.customerEmail || 'Sin correo'}</p>
                        {issueMessage ? (
                          <div className="mt-2 rounded-xl border px-2.5 py-2 text-[11px] font-bold leading-4" style={{ borderColor: 'rgba(220, 38, 38, 0.28)', background: 'rgba(220, 38, 38, 0.08)', color: '#b91c1c' }}>
                            <p className="font-black uppercase tracking-[0.06em]">Emisión rechazada</p>
                            <p className="mt-1 break-words [overflow-wrap:anywhere]">{issueMessage}</p>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="font-black">{normalizeChannelLabel(order.source)}</p>
                        <p className="mt-1 text-xs font-bold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>{formatNumber(order.itemsCount || 0)} producto(s)</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <span className="inline-flex max-w-full rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.06em]" style={{ borderColor: 'rgba(16, 185, 129, 0.36)', background: 'rgba(16, 185, 129, 0.12)', color: '#047857' }}>
                          {normalizePaymentStatus(order.paymentStatus)}
                        </span>
                        <p className="mt-1 break-words text-xs font-bold leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>{order.paymentProvider || 'Sin proveedor'}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="whitespace-nowrap font-black">{formatCurrency(order.total)}</p>
                        <p className="mt-1 whitespace-nowrap text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Envío {formatCurrency(order.shipping)}</p>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <div className="grid gap-1.5">
                          <ActionButton className="w-full whitespace-nowrap rounded-xl" icon={ExternalLink} onClick={() => window.open(`/admin/ordenes?order=${order.id}`, '_blank', 'noopener,noreferrer')}>Ver orden</ActionButton>
                          {canGenerate ? (
                            <ActionButton className="w-full whitespace-nowrap rounded-xl" icon={ReceiptText} onClick={() => handleGenerateInvoice(order)} disabled={isGenerating || loading} variant="primary">
                              {isGenerating ? 'Procesando...' : order.billingIssue?.retryable ? 'Reintentar' : 'Generar'}
                            </ActionButton>
                          ) : (
                            <span className="w-full rounded-xl border px-3 py-2 text-center text-xs font-black" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>
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
          <p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Incluye órdenes pagadas sin factura y emisiones rechazadas que pueden corregirse y reintentarse.</p>
          <div className="flex gap-2">
            <ActionButton disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</ActionButton>
            <ActionButton disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))}>Siguiente</ActionButton>
          </div>
        </div>
      </div>
    </section>
  );
}
