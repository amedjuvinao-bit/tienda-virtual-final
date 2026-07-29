import React, { useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';

import ElectronicInvoiceModal from '../../orders/electronicInvoice/ElectronicInvoiceModal';
import useAdminPermissions from '../../security/useAdminPermissions';
import {
  downloadBillingCreditNotePdf,
  downloadBillingCreditNoteXml,
  downloadBlob,
  getBillingCreditNotes,
  getDownloadErrorMessage,
  syncBillingCreditNote,
} from '../api/adminBillingApi';
import buildInvoiceModalData from '../buildInvoiceModalData';
import {
  CREDIT_NOTE_STATUS_OPTIONS,
  CREDIT_NOTE_TYPE_OPTIONS,
} from '../billingConstants';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  getCreditNoteTypeLabel,
  getStatusLabel,
  getStatusStyle,
  normalizeProviderLabel,
} from '../billingFormatters';
import {
  ActionButton,
  DocumentActionButton,
  EmptyWorkBlock,
  MessageBox,
  PanelHeader,
} from '../components/BillingUi';

export default function BillingCreditNotesPanel() {
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

  const downloadCreditNoteDocument = async (note, documentType) => {
    const invoiceIdentifier = note?.invoiceId || note?.invoiceNumber;
    const noteIdentifier = note?.id || note?.noteNumber || note?.referenceCode;
    if (!invoiceIdentifier || !noteIdentifier) return;

    try {
      setError('');
      setNotice('');
      setActionLoading(`${documentType}-${note.id}`);
      const result = documentType === 'pdf'
        ? await downloadBillingCreditNotePdf(invoiceIdentifier, noteIdentifier)
        : await downloadBillingCreditNoteXml(invoiceIdentifier, noteIdentifier);
      downloadBlob(result, `nota-credito-${note.noteNumber || note.id}.${documentType}`);
    } catch (err) {
      setError(await getDownloadErrorMessage(
        err,
        `No se pudo descargar el ${documentType.toUpperCase()} oficial de la nota crédito.`
      ));
    } finally {
      setActionLoading('');
    }
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
                  const isPdfLoading = actionLoading === `pdf-${note.id}`;
                  const isXmlLoading = actionLoading === `xml-${note.id}`;
                  const isValidated = note?.provider?.isValidated === true || note.status === 'validated';

                  return (
                    <tr key={note.id} style={{ borderTop: '1px solid var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                      <td className="px-3 py-4 align-top">
                        <p className="truncate font-black">{note.noteNumber || note.referenceCode || 'Sin número'}</p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Ref. {note.referenceCode || '—'}</p>
                        <p className="mt-1 truncate text-[11px] font-semibold" title={note.provider?.cude || note.provider?.cufe || ''} style={{ color: 'var(--admin-card-muted-text)' }}>CUDE {note.provider?.cude || note.provider?.cufe || '—'}</p>
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
                        <div className="grid grid-cols-2 gap-1.5">
                          <DocumentActionButton icon={ExternalLink} onClick={() => openCreditNoteInvoice(note)} disabled={isOpening}>{isOpening ? '...' : 'Factura'}</DocumentActionButton>
                          <DocumentActionButton icon={RefreshCw} onClick={() => syncCreditNote(note)} disabled={!canSync || isSyncing}>{isSyncing ? '...' : 'Sincronizar'}</DocumentActionButton>
                          <DocumentActionButton icon={Download} onClick={() => downloadCreditNoteDocument(note, 'pdf')} disabled={!canDownload || !isValidated || isPdfLoading} variant="primary">{isPdfLoading ? '...' : 'PDF'}</DocumentActionButton>
                          <DocumentActionButton icon={FileText} onClick={() => downloadCreditNoteDocument(note, 'xml')} disabled={!canDownload || !isValidated || isXmlLoading}>{isXmlLoading ? '...' : 'XML'}</DocumentActionButton>
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
