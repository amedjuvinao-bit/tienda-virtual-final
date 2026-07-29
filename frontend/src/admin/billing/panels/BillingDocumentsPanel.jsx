import React, { useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';

import ElectronicInvoiceModal from '../../orders/electronicInvoice/ElectronicInvoiceModal';
import useAdminPermissions from '../../security/useAdminPermissions';
import {
  downloadOrderInvoiceXml,
  downloadOrderPdf,
  downloadBlob,
  getBillingDocuments,
  getDownloadErrorMessage,
  sendBillingDocumentEmail,
  syncBillingDocument,
} from '../api/adminBillingApi';
import buildInvoiceModalData from '../buildInvoiceModalData';
import { STATUS_OPTIONS } from '../billingConstants';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  getEmailStatusLabel,
  getEmailStatusStyle,
  getStatusLabel,
  getStatusStyle,
  isValidatedDocument,
  normalizeProviderLabel,
} from '../billingFormatters';
import {
  ActionButton,
  DocumentActionButton,
  EmptyWorkBlock,
  MessageBox,
  PanelHeader,
} from '../components/BillingUi';

export default function BillingDocumentsPanel() {
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
  const [mailConfiguration, setMailConfiguration] = useState({
    loaded: false,
    enabled: false,
    configured: false,
  });

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
      setMailConfiguration(
        data?.mailConfiguration || {
          loaded: true,
          enabled: false,
          configured: false,
        }
      );
      setTotal(Number(data?.total || 0));
      setPages(Math.max(1, Number(data?.pages || 1)));
    } catch (err) {
      setRows([]);
      setMailConfiguration({
        loaded: false,
        enabled: false,
        configured: false,
      });
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

  const emailDocument = async (document) => {
    const identifier = document?.id || document?.invoiceNumber || document?.provider?.number;
    if (!identifier) return;

    try {
      setError('');
      setNotice('');
      setActionLoading(`email-${document.id}`);
      const data = await sendBillingDocumentEmail(identifier);
      const updated = data?.invoice;

      if (updated?.id) {
        setRows((current) =>
          current.map((row) => (row.id === updated.id ? updated : row))
        );
      }

      setNotice(data?.message || 'Factura enviada al correo fiscal del comprador.');
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'No se pudo enviar la factura por correo.';
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
      {mailConfiguration.loaded && !mailConfiguration.configured ? (
        <MessageBox>
          Correo no configurado o desactivado. Revisa Configuración &gt; Correo antes de enviar facturas.
        </MessageBox>
      ) : null}

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
                  <th className="w-[17%] px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em]">Cliente / correo</th>
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
                  const isEmailLoading = actionLoading === `email-${document.id}`;
                  const canOpenPdf = document.hasPdf || document.orderId;
                  const canOpenXml = document.hasXml && document.orderId;
                  const emailDelivery = document.emailDelivery || {};
                  const emailRecipient = emailDelivery.recipient || customer.email || '';
                  const canEmail =
                    mailConfiguration.configured &&
                    Boolean(emailRecipient) &&
                    isValidatedDocument(document);

                  return (
                    <tr key={document.id} style={{ borderTop: '1px solid var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black">{document.invoiceNumber || document.provider?.number || 'Sin número'}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Orden #{document.orderNumber || '—'}</p>
                        {document.cufe ? <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>CUFE {document.cufe}</p> : null}
                      </td>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black">{customerName}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{customer.documentNumber || 'Sin identificación'}</p>
                        <p className="mt-1 truncate text-xs font-bold" title={emailRecipient} style={{ color: 'var(--admin-card-muted-text)' }}>{emailRecipient || 'Sin correo fiscal'}</p>
                        <span className="mt-2 inline-flex max-w-full rounded-full border px-2.5 py-1 text-[10px] font-black uppercase" style={getEmailStatusStyle(emailDelivery.status)}>
                          Correo: {getEmailStatusLabel(emailDelivery.status)}
                        </span>
                        {emailDelivery.status === 'error' && emailDelivery.lastError ? (
                          <p className="mt-1 whitespace-normal break-words text-[11px] font-bold leading-4" title={emailDelivery.lastError} style={{ color: '#be123c' }}>
                            {emailDelivery.lastError}
                          </p>
                        ) : null}
                        {emailDelivery.lastSentAt ? (
                          <p className="mt-1 text-[11px] font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                            Último envío: {formatDateTime(emailDelivery.lastSentAt)}
                          </p>
                        ) : null}
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
                          <DocumentActionButton
                            icon={Send}
                            onClick={() => emailDocument(document)}
                            disabled={!canDownload || !canEmail || isEmailLoading}
                            variant={emailDelivery.status === 'sent' ? 'soft' : 'primary'}
                            className="col-span-2"
                          >
                            {isEmailLoading
                              ? 'Enviando...'
                              : emailDelivery.status === 'sent'
                                ? 'Reenviar'
                                : 'Enviar correo'}
                          </DocumentActionButton>
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
