import { RotateCcw, X } from 'lucide-react';

import {
  CREDIT_NOTE_REASONS,
  getItemKey,
  getItemQuantity,
} from './electronicInvoiceModalUtils';

export default function CreditNoteForm({ controller }) {
  const {
    showCreditNoteForm,
    creditNoteType,
    creditNoteReasonCode,
    setCreditNoteReasonCode,
    creditNoteObservation,
    setCreditNoteObservation,
    selectedCreditNoteItems,
    orderItems,
    creatingCreditNote,
    closeCreditNoteForm,
    handleCreditNoteTypeChange,
    handleToggleCreditNoteItem,
    handleChangeCreditNoteItemQuantity,
    handleCreateCreditNote,
  } = controller;

  if (!showCreditNoteForm) return null;

  return (
    <div
      className="border-b px-6 py-5"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">Crear nota crédito</h3>

          <p
            className="mt-1 text-sm"
            style={{
              color: 'var(--admin-card-muted-text)',
            }}
          >
            Selecciona si la nota será total o parcial y escribe la observación
            que justifica el ajuste ante Factus/DIAN.
          </p>
        </div>

        <button
          type="button"
          onClick={closeCreditNoteForm}
          className="rounded-full border p-2"
          style={{
            borderColor: 'var(--admin-card-border)',
            color: 'var(--admin-card-muted-text)',
            background: 'var(--admin-glass-soft-bg)',
          }}
        >
          <X size={17} />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold">Tipo de nota crédito</span>

          <select
            value={creditNoteType}
            onChange={(event) =>
              handleCreditNoteTypeChange(event.target.value)
            }
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--admin-input-bg)',
              borderColor: 'var(--admin-input-border)',
              color: 'var(--admin-input-text)',
            }}
          >
            <option value="total">Total</option>
            <option value="partial">Parcial</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-bold">Concepto de corrección</span>

          <select
            value={creditNoteReasonCode}
            onChange={(event) => setCreditNoteReasonCode(event.target.value)}
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--admin-input-bg)',
              borderColor: 'var(--admin-input-border)',
              color: 'var(--admin-input-text)',
            }}
          >
            {CREDIT_NOTE_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-bold">Observación obligatoria</span>

        <textarea
          value={creditNoteObservation}
          onChange={(event) => setCreditNoteObservation(event.target.value)}
          maxLength={250}
          rows={3}
          placeholder="Ejemplo: Cliente solicita devolución por talla incorrecta. Se genera nota crédito parcial por el producto devuelto."
          className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
          style={{
            background: 'var(--admin-input-bg)',
            borderColor: 'var(--admin-input-border)',
            color: 'var(--admin-input-text)',
          }}
        />
      </label>

      {creditNoteType === 'partial' && (
        <div className="mt-5">
          <h4 className="text-sm font-bold">
            Productos para nota crédito parcial
          </h4>

          <div className="mt-3 space-y-3">
            {orderItems.map((item, index) => {
              const key = getItemKey(item, index);
              const checked = Boolean(selectedCreditNoteItems[key]);
              const maxQuantity = getItemQuantity(item);
              const selectedQuantity =
                selectedCreditNoteItems[key]?.quantity || 1;

              return (
                <div
                  key={key}
                  className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_120px]"
                  style={{
                    borderColor: 'var(--admin-card-border)',
                    background:
                      'var(--admin-button-soft-bg, var(--admin-primary-soft-bg))',
                  }}
                >
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        handleToggleCreditNoteItem(item, index)
                      }
                      className="mt-1"
                    />

                    <span>
                      <strong>{item?.title || item?.name || 'Producto'}</strong>

                      <span
                        className="mt-1 block"
                        style={{
                          color: 'var(--admin-card-muted-text)',
                        }}
                      >
                        Cantidad comprada: {maxQuantity}
                      </span>
                    </span>
                  </label>

                  <input
                    type="number"
                    min="1"
                    max={maxQuantity}
                    value={selectedQuantity}
                    disabled={!checked}
                    onChange={(event) =>
                      handleChangeCreditNoteItemQuantity(
                        item,
                        index,
                        event.target.value
                      )
                    }
                    className="rounded-xl border px-3 py-2 text-sm outline-none disabled:opacity-50"
                    style={{
                      background: 'var(--admin-input-bg)',
                      borderColor: 'var(--admin-input-border)',
                      color: 'var(--admin-input-text)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={closeCreditNoteForm}
          disabled={creatingCreditNote}
          className="rounded-full border px-5 py-2 text-sm font-semibold disabled:opacity-60"
          style={{
            background: 'var(--admin-button-soft-bg)',
            color: 'var(--admin-button-soft-text)',
            borderColor: 'var(--admin-button-soft-border)',
          }}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={handleCreateCreditNote}
          disabled={creatingCreditNote}
          className="inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
          {creatingCreditNote ? 'Creando nota...' : 'Confirmar nota crédito'}
        </button>
      </div>
    </div>
  );
}
