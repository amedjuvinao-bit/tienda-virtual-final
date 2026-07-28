import { Download, FileText } from 'lucide-react';

import {
  formatCreditNoteDate,
  formatMoney,
  getCreditNoteIdentifier,
  getCreditNotePublicUrl,
  getCreditNoteQrUrl,
} from './electronicInvoiceModalUtils';

export default function InvoiceCreditNotesTab({ controller }) {
  const {
    creditNotes,
    canDownload,
    noteDocumentLoading,
    handleDownloadCreditNote,
  } = controller;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold">Notas crédito registradas</h3>

        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--admin-card-muted-text)' }}
        >
          Aquí se muestran las notas crédito guardadas en MongoDB para esta
          factura electrónica.
        </p>
      </div>

      {!creditNotes.length && (
        <div
          className="rounded-2xl border p-5 text-sm"
          style={{
            background: 'var(--admin-card-bg)',
            borderColor: 'var(--admin-card-border)',
            color: 'var(--admin-card-muted-text)',
          }}
        >
          Esta factura todavía no tiene notas crédito registradas.
        </div>
      )}

      {creditNotes.map((note, index) => {
        const publicUrl = getCreditNotePublicUrl(note);
        const qrUrl = getCreditNoteQrUrl(note);
        const noteId = getCreditNoteIdentifier(note);
        const noteValidated =
          note?.provider?.isValidated === true || note?.status === 'validated';

        return (
          <div
            key={note?._id || note?.referenceCode || index}
            className="rounded-2xl border p-5"
            style={{
              background: 'var(--admin-card-bg)',
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-text)',
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold">
                    Nota crédito #{note?.provider?.number || '—'}
                  </h4>

                  <span
                    className="rounded-full border px-3 py-1 text-xs font-bold uppercase"
                    style={{
                      background:
                        note?.type === 'total'
                          ? 'var(--admin-warning-soft-bg, rgba(245, 158, 11, 0.12))'
                          : 'var(--admin-primary-soft-bg)',
                      color:
                        note?.type === 'total'
                          ? 'var(--admin-warning-text, #d97706)'
                          : 'var(--admin-primary-soft-text)',
                      borderColor:
                        note?.type === 'total'
                          ? 'var(--admin-warning-border, rgba(245, 158, 11, 0.28))'
                          : 'var(--admin-primary-soft-border)',
                    }}
                  >
                    {note?.type === 'total' ? 'Total' : 'Parcial'}
                  </span>

                  <span
                    className="rounded-full border px-3 py-1 text-xs font-bold uppercase"
                    style={{
                      background:
                        note?.status === 'validated'
                          ? 'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))'
                          : 'var(--admin-button-soft-bg)',
                      color:
                        note?.status === 'validated'
                          ? 'var(--admin-success-text, #16a34a)'
                          : 'var(--admin-button-soft-text)',
                      borderColor:
                        note?.status === 'validated'
                          ? 'var(--admin-success-border, rgba(34, 197, 94, 0.25))'
                          : 'var(--admin-button-soft-border)',
                    }}
                  >
                    {note?.status || 'Sin estado'}
                  </span>
                </div>

                <p
                  className="mt-2 text-sm"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  Referencia: {note?.referenceCode || '—'} · Factura:{' '}
                  {note?.billNumber || '—'}
                </p>

                <p
                  className="mt-1 break-all text-xs"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  CUDE: {note?.provider?.cude || note?.provider?.cufe || '—'}
                </p>
              </div>

              <div className="text-right text-sm">
                <p className="font-bold">{formatMoney(note?.totalAmount)}</p>

                <p
                  className="mt-1"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  {formatCreditNoteDate(note?.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <div>
                <p
                  className="text-xs font-bold uppercase"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  Subtotal
                </p>

                <p className="mt-1 font-semibold">
                  {formatMoney(note?.subtotal)}
                </p>
              </div>

              <div>
                <p
                  className="text-xs font-bold uppercase"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  Impuesto
                </p>

                <p className="mt-1 font-semibold">
                  {formatMoney(note?.taxAmount)}
                </p>
              </div>

              <div>
                <p
                  className="text-xs font-bold uppercase"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  CUDE / CUFE
                </p>

                <p className="mt-1 break-all text-xs font-semibold">
                  {note?.provider?.cufe || '—'}
                </p>
              </div>
            </div>

            {note?.reasonText && (
              <div
                className="mt-4 rounded-2xl border p-3 text-sm"
                style={{
                  background: 'var(--admin-button-soft-bg)',
                  borderColor: 'var(--admin-button-soft-border)',
                  color: 'var(--admin-button-soft-text)',
                }}
              >
                <strong>Observación:</strong> {note.reasonText}
              </div>
            )}

            {Array.isArray(note?.items) && note.items.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-bold">Productos incluidos</p>

                <div className="space-y-2">
                  {note.items.map((item, itemIndex) => (
                    <div
                      key={
                        item?.codeReference || item?.productId || itemIndex
                      }
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                      style={{
                        background: 'var(--admin-glass-soft-bg)',
                        borderColor: 'var(--admin-card-border)',
                      }}
                    >
                      <span className="font-semibold">
                        {item?.name || 'Producto'}
                      </span>

                      <span
                        style={{
                          color: 'var(--admin-card-muted-text)',
                        }}
                      >
                        Cantidad: {item?.quantity || 0} · Precio:{' '}
                        {formatMoney(item?.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  !canDownload ||
                  !noteValidated ||
                  noteDocumentLoading === `pdf-${noteId}`
                }
                onClick={() => handleDownloadCreditNote(note, 'pdf')}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: 'var(--admin-primary-soft-bg)',
                  color: 'var(--admin-primary-soft-text)',
                  borderColor: 'var(--admin-primary-soft-border)',
                }}
              >
                <Download size={15} />
                {noteDocumentLoading === `pdf-${noteId}`
                  ? 'Descargando...'
                  : 'PDF oficial'}
              </button>
              <button
                type="button"
                disabled={
                  !canDownload ||
                  !noteValidated ||
                  noteDocumentLoading === `xml-${noteId}`
                }
                onClick={() => handleDownloadCreditNote(note, 'xml')}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: 'var(--admin-button-soft-bg)',
                  color: 'var(--admin-button-soft-text)',
                  borderColor: 'var(--admin-button-soft-border)',
                }}
              >
                <FileText size={15} />
                {noteDocumentLoading === `xml-${noteId}`
                  ? 'Descargando...'
                  : 'XML oficial'}
              </button>
            </div>

            {(publicUrl || qrUrl) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {publicUrl && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border px-4 py-2 text-sm font-semibold"
                    style={{
                      background: 'var(--admin-button-soft-bg)',
                      color: 'var(--admin-button-soft-text)',
                      borderColor: 'var(--admin-button-soft-border)',
                    }}
                  >
                    Ver en Factus
                  </a>
                )}

                {qrUrl && (
                  <a
                    href={qrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border px-4 py-2 text-sm font-semibold"
                    style={{
                      background: 'var(--admin-primary-soft-bg)',
                      color: 'var(--admin-primary-soft-text)',
                      borderColor: 'var(--admin-primary-soft-border)',
                    }}
                  >
                    Ver QR DIAN
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
