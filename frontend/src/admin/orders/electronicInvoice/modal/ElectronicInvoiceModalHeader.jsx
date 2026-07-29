import {
  CheckCircle2,
  FileText,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

import { formatSyncDate } from './electronicInvoiceModalUtils';

export default function ElectronicInvoiceModalHeader({
  order,
  onClose,
  controller,
}) {
  const {
    currentInvoice,
    canSync,
    canDelete,
    canCreateCreditNote,
    retrying,
    deletingInvoice,
    creatingCreditNote,
    syncing,
    alreadyValidated,
    handleSyncInvoice,
    handleRetryInvoice,
    handleDeleteInvoice,
    openCreditNoteForm,
  } = controller;

  return (
    <div
      className="flex items-start justify-between gap-4 border-b px-6 py-5"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-glass-soft-bg)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl border"
          style={{
            background: 'var(--admin-primary-soft-bg)',
            color: 'var(--admin-primary-soft-text)',
            borderColor: 'var(--admin-primary-soft-border)',
          }}
        >
          <FileText size={22} />
        </div>

        <div>
          <h2
            className="text-lg font-bold"
            style={{ color: 'var(--admin-modal-text)' }}
          >
            Detalle de factura electrónica
          </h2>

          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--admin-modal-muted-text)' }}
          >
            Orden #{order?.orderNumber || '—'}
          </p>

          {currentInvoice?.sync?.lastAttemptAt ? (
            <p
              className="mt-1 text-xs font-semibold"
              style={{ color: 'var(--admin-modal-muted-text)' }}
            >
              {currentInvoice.sync.status === 'failed'
                ? 'Último intento de sincronización'
                : 'Última sincronización'}
              :{' '}
              {formatSyncDate(
                currentInvoice.sync.lastSuccessAt ||
                  currentInvoice.sync.lastAttemptAt
              )}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canSync ? (
          <button
            type="button"
            onClick={handleSyncInvoice}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: 'var(--admin-button-soft-bg)',
              color: 'var(--admin-button-soft-text)',
              borderColor: 'var(--admin-button-soft-border)',
            }}
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        ) : null}

        {!alreadyValidated && (
          <>
            {canDelete ? (
              <button
                type="button"
                onClick={handleDeleteInvoice}
                disabled={deletingInvoice}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background:
                    'var(--admin-danger-soft-bg, rgba(239,68,68,.12))',
                  color: 'var(--admin-danger-text, #dc2626)',
                  borderColor:
                    'var(--admin-danger-border, rgba(239,68,68,.25))',
                }}
              >
                <Trash2
                  size={16}
                  className={deletingInvoice ? 'animate-pulse' : ''}
                />
                {deletingInvoice ? 'Eliminando...' : 'Eliminar factura'}
              </button>
            ) : null}

            {canSync ? (
              <button
                type="button"
                onClick={handleRetryInvoice}
                disabled={retrying}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'var(--admin-button-soft-bg)',
                  color: 'var(--admin-button-soft-text)',
                  borderColor: 'var(--admin-button-soft-border)',
                }}
              >
                <RefreshCw
                  size={16}
                  className={retrying ? 'animate-spin' : ''}
                />
                {retrying ? 'Reintentando...' : 'Reintentar factura'}
              </button>
            ) : null}
          </>
        )}

        {alreadyValidated && (
          <>
            {canCreateCreditNote ? (
              <button
                type="button"
                onClick={openCreditNoteForm}
                disabled={creatingCreditNote}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background:
                    'var(--admin-warning-soft-bg, rgba(245, 158, 11, 0.12))',
                  color: 'var(--admin-warning-text, #d97706)',
                  borderColor:
                    'var(--admin-warning-border, rgba(245, 158, 11, 0.28))',
                }}
              >
                <RotateCcw
                  size={16}
                  className={creatingCreditNote ? 'animate-spin' : ''}
                />
                {creatingCreditNote ? 'Creando...' : 'Crear nota crédito'}
              </button>
            ) : null}

            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
              style={{
                background:
                  'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))',
                color: 'var(--admin-success-text, #16a34a)',
                borderColor:
                  'var(--admin-success-border, rgba(34, 197, 94, 0.25))',
              }}
            >
              <CheckCircle2 size={16} />
              Factura validada
            </span>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="rounded-full border p-2 transition"
          style={{
            color: 'var(--admin-modal-muted-text)',
            borderColor: 'var(--admin-card-border)',
            background: 'var(--admin-glass-soft-bg)',
          }}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
