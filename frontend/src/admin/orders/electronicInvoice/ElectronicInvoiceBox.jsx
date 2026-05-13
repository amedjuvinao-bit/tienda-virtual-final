// src/admin/orders/electronicInvoice/ElectronicInvoiceBox.jsx

import { useState } from 'react';
import { FileText, Eye, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import ElectronicInvoiceModal from './ElectronicInvoiceModal';
import {
  getInvoiceStatusInfo,
  getInvoiceNumber,
  getInvoiceCufe,
  shortText,
} from './invoiceStatusUtils';

export default function ElectronicInvoiceBox({ order }) {
  const [open, setOpen] = useState(false);

  const invoice =
    order?.electronicInvoice ||
    order?.invoice ||
    order?.dian ||
    order?.factus ||
    null;

  const statusInfo = getInvoiceStatusInfo(invoice);
  const invoiceNumber = getInvoiceNumber(invoice);
  const cufe = getInvoiceCufe(invoice);

  const Icon =
    statusInfo.tone === 'success'
      ? CheckCircle2
      : statusInfo.tone === 'danger'
        ? AlertTriangle
        : Clock;

  return (
    <>
      <div
        className="rounded-2xl border p-4 shadow-sm"
        style={{
          background: 'var(--admin-glass-bg)',
          borderColor: 'var(--admin-glass-border)',
          color: 'var(--admin-card-text)',
          boxShadow: 'var(--admin-glass-shadow)',
          backdropFilter: 'blur(var(--admin-glass-blur))',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: 'var(--admin-primary-soft-bg)',
                color: 'var(--admin-primary-soft-text)',
                border: '1px solid var(--admin-primary-soft-border)',
              }}
            >
              <FileText size={20} />
            </div>

            <div>
              <h3
                className="text-sm font-bold"
                style={{ color: 'var(--admin-card-text)' }}
              >
                Factura electrónica
              </h3>

              <p
                className="mt-1 text-xs"
                style={{ color: 'var(--admin-card-muted-text)' }}
              >
                Estado, CUFE, PDF, XML y errores del proveedor DIAN.
              </p>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background:
                statusInfo.tone === 'success'
                  ? 'rgba(16, 185, 129, 0.12)'
                  : statusInfo.tone === 'danger'
                    ? 'var(--admin-danger-soft-bg)'
                    : 'var(--admin-warning-soft-bg)',
              color:
                statusInfo.tone === 'success'
                  ? '#047857'
                  : statusInfo.tone === 'danger'
                    ? 'var(--admin-danger-text)'
                    : 'var(--admin-warning-text)',
              border:
                statusInfo.tone === 'success'
                  ? '1px solid rgba(16, 185, 129, 0.28)'
                  : statusInfo.tone === 'danger'
                    ? '1px solid var(--admin-danger)'
                    : '1px solid var(--admin-warning)',
            }}
          >
            <Icon size={13} />
            {statusInfo.label}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoCard label="Número" value={invoiceNumber} />
          <InfoCard label="CUFE" value={shortText(cufe, 24)} />
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
          style={{
            background: 'var(--admin-button-bg)',
            color: 'var(--admin-button-text)',
            border: '1px solid var(--admin-button-bg)',
          }}
        >
          <Eye size={16} />
          Ver detalle de factura
        </button>
      </div>

      {open && (
        <ElectronicInvoiceModal
          order={order}
          invoice={invoice}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function InfoCard({ label, value }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        background: 'var(--admin-glass-soft-bg)',
        borderColor: 'var(--admin-card-border)',
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--admin-card-muted-text)' }}
      >
        {label}
      </p>

      <p
        className="mt-1 text-sm font-semibold break-words"
        style={{ color: 'var(--admin-card-text)' }}
      >
        {value || '—'}
      </p>
    </div>
  );
}