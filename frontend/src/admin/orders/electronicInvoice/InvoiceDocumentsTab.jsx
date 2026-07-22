// src/admin/orders/electronicInvoice/InvoiceDocumentsTab.jsx

import { useState } from 'react';
import {
  FileDown,
  FileCode2,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import api from '../../../lib/api';
import { getDownloadErrorMessage } from '../../billing/api/adminBillingApi';
import useAdminPermissions from '../../security/useAdminPermissions';

export default function InvoiceDocumentsTab({ order, invoice }) {
  const { can } = useAdminPermissions();
  const canDownload = can('billing:download');
  const orderId = order?._id || order?.id || invoice?.orderId || '';
  const pdfUrl = orderId ? `/api/orders/${encodeURIComponent(orderId)}/pdf` : '';
  const xmlUrl = orderId
    ? `/api/orders/${encodeURIComponent(orderId)}/invoice-xml`
    : '';

  const publicUrl =
    invoice?.publicUrl ||
    invoice?.links?.public_url ||
    invoice?.provider?.links?.public_url ||
    invoice?.provider?.raw?.links?.public_url ||
    invoice?.providerResponse?.data?.data?.links?.public_url ||
    '';

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <DocumentCard
        icon={<FileDown size={22} />}
        title="PDF oficial"
        description="Representación gráfica descargada de Factus con el número oficial de la factura."
        url={pdfUrl}
        fileName={`factura-${getInvoiceReference(invoice)}.pdf`}
        emptyText="PDF oficial no disponible todavía."
        protectedDownload
        allowed={canDownload}
      />

      <DocumentCard
        icon={<FileCode2 size={22} />}
        title="XML oficial"
        description="Archivo electrónico descargado de Factus para la factura consultada."
        url={xmlUrl}
        fileName={`factura-${getInvoiceReference(invoice)}.xml`}
        emptyText="XML no disponible todavía."
        protectedDownload
        allowed={canDownload}
      />

      <DocumentCard
        icon={<ExternalLink size={22} />}
        title="Consulta pública"
        description="Enlace público o QR informado por Factus, cuando esté disponible."
        url={publicUrl}
        fileName={`factura-${getInvoiceReference(invoice)}`}
        emptyText="Enlace público no disponible."
        onlyOpen
        allowed={canDownload}
      />
    </div>
  );
}

function DocumentCard({
  icon,
  title,
  description,
  url,
  fileName,
  emptyText,
  onlyOpen = false,
  protectedDownload = false,
  allowed = true,
}) {
  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');

  const hasUrl = Boolean(url);

  const resolvedFileName = (response) => {
    const disposition = String(response?.headers?.['content-disposition'] || '');
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return match?.[1] || fileName || 'factura';
  };

  const downloadBlob = (blob, response) => {
    const contentType = response?.headers?.['content-type'] || blob?.type || 'application/octet-stream';
    const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: contentType }));

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = resolvedFileName(response);
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  };

  const handleOpen = async () => {
    setError('');

    if (!url) {
      setError(emptyText);
      return;
    }

    if (!protectedDownload) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      setLoadingAction('open');

      const response = await api.get(url, {
        responseType: 'blob',
      });

      const contentType = response?.headers?.['content-type'] || 'application/octet-stream';
      const blobUrl = window.URL.createObjectURL(
        new Blob([response.data], { type: contentType })
      );
      window.open(blobUrl, '_blank', 'noopener,noreferrer');

      window.setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 3000);
    } catch (openError) {
      console.error('Error abriendo documento de factura:', openError);
      setError(
        await getDownloadErrorMessage(
          openError,
          `No fue posible abrir ${title.toLowerCase()}.`
        )
      );
    } finally {
      setLoadingAction('');
    }
  };

  const handleDownload = async () => {
    setError('');

    if (!url) {
      setError(emptyText);
      return;
    }

    try {
      setLoadingAction('download');

      if (protectedDownload) {
        const response = await api.get(url, {
          responseType: 'blob',
        });

        downloadBlob(response.data, response);
        return;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('No fue posible descargar el archivo.');
      }

      const blob = await response.blob();
      downloadBlob(blob);
    } catch (downloadError) {
      console.error('Error descargando documento de factura:', downloadError);
      setError(
        await getDownloadErrorMessage(
          downloadError,
          `No fue posible descargar ${title.toLowerCase()}.`
        )
      );
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div
      className="rounded-3xl border p-5 shadow-sm transition"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
        boxShadow:
          'var(--admin-card-shadow, 0 18px 40px rgba(15, 23, 42, 0.08))',
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background: 'var(--admin-primary-soft-bg)',
          color: 'var(--admin-primary-soft-text, var(--admin-primary))',
          border:
            '1px solid var(--admin-primary-soft-border, var(--admin-card-border))',
        }}
      >
        {icon}
      </div>

      <h3
        className="mt-4 text-base font-bold"
        style={{ color: 'var(--admin-card-text)' }}
      >
        {title}
      </h3>

      <p
        className="mt-2 text-sm"
        style={{ color: 'var(--admin-card-muted-text)' }}
      >
        {description}
      </p>

      {!allowed ? (
        <p
          className="mt-5 rounded-xl px-4 py-3 text-center text-sm font-medium"
          style={{
            background: 'var(--admin-primary-soft-bg)',
            color: 'var(--admin-card-muted-text)',
            border: '1px solid var(--admin-primary-soft-border, var(--admin-card-border))',
          }}
        >
          No tienes permiso para abrir o descargar este documento.
        </p>
      ) : hasUrl ? (
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={handleOpen}
            disabled={loadingAction === 'open'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: 'var(--admin-button-bg, var(--admin-primary))',
              color: 'var(--admin-button-text)',
              border: '1px solid var(--admin-button-border, transparent)',
            }}
          >
            {loadingAction === 'open' ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Abriendo...
              </>
            ) : (
              <>
                Abrir
                <ExternalLink size={15} />
              </>
            )}
          </button>

          {!onlyOpen && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={loadingAction === 'download'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background:
                  'var(--admin-button-soft-bg, var(--admin-primary-soft-bg))',
                color: 'var(--admin-button-soft-text, var(--admin-primary))',
                border:
                  '1px solid var(--admin-button-soft-border, var(--admin-card-border))',
              }}
            >
              {loadingAction === 'download' ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Descargando...
                </>
              ) : (
                <>
                  Descargar
                  <FileDown size={15} />
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <p
          className="mt-5 rounded-xl px-4 py-3 text-center text-sm font-medium"
          style={{
            background: 'var(--admin-primary-soft-bg)',
            color: 'var(--admin-card-muted-text)',
            border:
              '1px solid var(--admin-primary-soft-border, var(--admin-card-border))',
          }}
        >
          {emptyText}
        </p>
      )}

      {error && (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            background: 'var(--admin-danger-soft-bg, rgba(239, 68, 68, 0.12))',
            borderColor:
              'var(--admin-danger-border, rgba(239, 68, 68, 0.25))',
            color: 'var(--admin-danger-text, #dc2626)',
          }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function getInvoiceReference(invoice) {
  return (
    invoice?.number ||
    invoice?.invoiceNumber ||
    invoice?.provider?.number ||
    invoice?.provider?.raw?.number ||
    invoice?.data?.number ||
    invoice?.providerResponse?.data?.data?.number ||
    invoice?._id ||
    'documento'
  );
}
