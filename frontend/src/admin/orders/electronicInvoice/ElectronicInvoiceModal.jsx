// src/admin/orders/electronicInvoice/ElectronicInvoiceModal.jsx

import { useState } from 'react';
import {
  X,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RotateCcw,
} from 'lucide-react';

import api from '../../../lib/api';
import { syncBillingDocument } from '../../billing/api/adminBillingApi';

import InvoiceSummaryTab from './InvoiceSummaryTab';
import InvoiceErrorsTab from './InvoiceErrorsTab';
import InvoiceDocumentsTab from './InvoiceDocumentsTab';
import InvoiceTimelineTab from './InvoiceTimelineTab';

const TABS = [
  { id: 'summary', label: 'Resumen' },
  { id: 'errors', label: 'Errores' },
  { id: 'documents', label: 'XML / Factus' },
  { id: 'creditNotes', label: 'Notas crédito' },
  { id: 'timeline', label: 'Historial' },
];

const CREDIT_NOTE_REASONS = [
  {
    value: '1',
    label: 'Devolución total o parcial de los bienes',
  },
  {
    value: '2',
    label: 'Anulación de factura electrónica',
  },
  {
    value: '3',
    label: 'Rebaja o descuento aplicado',
  },
  {
    value: '4',
    label: 'Ajuste de precio',
  },
  {
    value: '5',
    label: 'Otros motivos',
  },
];

function invoiceIsAlreadyValidated(invoice) {
  const status = String(invoice?.status || '').trim().toLowerCase();

  return (
    status === 'accepted' ||
    status === 'generated' ||
    invoice?.provider?.isValidated === true ||
    invoice?.provider?.raw?.is_validated === true
  );
}

function getOrderItems(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items;
  }

  if (Array.isArray(order?.cart) && order.cart.length) {
    return order.cart;
  }

  return [];
}

function getItemKey(item, index) {
  return String(
    item?.productId ||
      item?.product ||
      item?._id ||
      item?.id ||
      item?.title ||
      index
  );
}

function getItemQuantity(item) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function formatCreditNoteDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('es-CO');
}

function formatSyncDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CO');
}

function getCreditNotePublicUrl(note) {
  return (
    note?.provider?.links?.public_url ||
    note?.provider?.links?.publicUrl ||
    note?.provider?.raw?.data?.links?.public_url ||
    note?.provider?.raw?.links?.public_url ||
    ''
  );
}

function getCreditNoteQrUrl(note) {
  return (
    note?.provider?.links?.qr ||
    note?.provider?.raw?.data?.links?.qr ||
    note?.provider?.raw?.links?.qr ||
    ''
  );
}

export default function ElectronicInvoiceModal({ order, invoice, onClose }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [currentInvoice, setCurrentInvoice] = useState(invoice);

  const [retrying, setRetrying] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [creatingCreditNote, setCreatingCreditNote] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [retryMessage, setRetryMessage] = useState('');
  const [retryError, setRetryError] = useState('');

  const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);
  const [creditNoteType, setCreditNoteType] = useState('total');
  const [creditNoteReasonCode, setCreditNoteReasonCode] = useState('1');
  const [creditNoteObservation, setCreditNoteObservation] = useState('');
  const [selectedCreditNoteItems, setSelectedCreditNoteItems] = useState({});

  const alreadyValidated = invoiceIsAlreadyValidated(currentInvoice);
  const orderItems = getOrderItems(order);
  const creditNotes = Array.isArray(currentInvoice?.creditNotes)
    ? currentInvoice.creditNotes
    : [];

  const clearMessages = () => {
    setRetryMessage('');
    setRetryError('');
  };

  const handleSyncInvoice = async () => {
    const identifier =
      currentInvoice?.id ||
      currentInvoice?._id ||
      currentInvoice?.invoiceNumber ||
      currentInvoice?.provider?.number;

    if (!identifier) {
      setRetryMessage('');
      setRetryError('No se encontró la factura que se debe sincronizar.');
      return;
    }

    try {
      setSyncing(true);
      clearMessages();
      const data = await syncBillingDocument(identifier);

      if (data?.invoice) {
        setCurrentInvoice((previous) => ({
          ...previous,
          ...data.invoice,
          creditNotes: previous?.creditNotes || data.invoice?.creditNotes || [],
        }));
      }

      setRetryMessage(data?.message || 'Estado de la factura sincronizado correctamente.');
    } catch (error) {
      setRetryMessage('');
      setRetryError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'No fue posible sincronizar la factura.'
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryInvoice = async () => {
    const orderId = order?._id || currentInvoice?.orderId || invoice?.orderId;

    if (alreadyValidated) {
      setRetryMessage('');
      setRetryError(
        'Esta factura ya está validada. No se debe reenviar para evitar duplicados.'
      );
      return;
    }

    if (!orderId) {
      setRetryError('No se encontró el ID de la orden.');
      return;
    }

    try {
      setRetrying(true);
      clearMessages();

      const response = await api.post(
        `/api/payments/admin/retry-electronic-invoice/${orderId}`
      );

      if (response?.data?.invoice) {
        setCurrentInvoice(response.data.invoice);
      }

      if (response?.data?.success) {
        setRetryMessage('Factura reenviada correctamente al proveedor.');
      } else {
        setRetryError(
          response?.data?.error ||
            'El proveedor respondió, pero no confirmó el reintento.'
        );
      }
    } catch (error) {
      console.error('Error reintentando factura electrónica:', error);

      setRetryError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'No fue posible reintentar la factura electrónica.'
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleDeleteInvoice = async () => {
    const orderId = order?._id || currentInvoice?.orderId || invoice?.orderId;

    if (!orderId) {
      setRetryError('No se encontró el ID de la orden.');
      return;
    }

    try {
      setDeletingInvoice(true);
      clearMessages();

      const response = await api.post(
        `/api/payments/admin/delete-factus-invoice/${orderId}`
      );

      if (response?.data?.success) {
        setRetryMessage('Factura no validada eliminada correctamente en Factus.');

        setCurrentInvoice((prev) => ({
          ...prev,
          status: 'pending',
        }));
      } else {
        setRetryError(
          response?.data?.deleteResult?.error ||
            response?.data?.message ||
            response?.data?.error ||
            'No se pudo eliminar la factura en Factus.'
        );
      }
    } catch (error) {
      console.error('Error eliminando factura Factus:', error);

      setRetryError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'No fue posible eliminar la factura en Factus.'
      );
    } finally {
      setDeletingInvoice(false);
    }
  };

  const openCreditNoteForm = () => {
    if (!alreadyValidated) {
      setRetryMessage('');
      setRetryError('Solo se puede crear nota crédito sobre una factura validada.');
      return;
    }

    clearMessages();
    setShowCreditNoteForm(true);
  };

  const closeCreditNoteForm = () => {
    if (creatingCreditNote) return;

    setShowCreditNoteForm(false);
  };

  const handleToggleCreditNoteItem = (item, index) => {
    const key = getItemKey(item, index);
    const maxQuantity = getItemQuantity(item);

    setSelectedCreditNoteItems((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }

      return {
        ...prev,
        [key]: {
          ...item,
          quantity: 1,
          maxQuantity,
        },
      };
    });
  };

  const handleChangeCreditNoteItemQuantity = (item, index, value) => {
    const key = getItemKey(item, index);
    const maxQuantity = getItemQuantity(item);
    const quantity = Math.max(
      1,
      Math.min(Number(value || 1), maxQuantity)
    );

    setSelectedCreditNoteItems((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || item),
        quantity,
        maxQuantity,
      },
    }));
  };

  const handleCreateCreditNote = async () => {
    const orderId = order?._id || currentInvoice?.orderId || invoice?.orderId;

    if (!alreadyValidated) {
      setRetryMessage('');
      setRetryError('Solo se puede crear nota crédito sobre una factura validada.');
      return;
    }

    if (!orderId) {
      setRetryError('No se encontró el ID de la orden.');
      return;
    }

    if (!creditNoteObservation.trim()) {
      setRetryMessage('');
      setRetryError(
        'Debes escribir una observación explicando el motivo de la nota crédito.'
      );
      return;
    }

    const partialItems = Object.values(selectedCreditNoteItems);

    if (creditNoteType === 'partial' && !partialItems.length) {
      setRetryMessage('');
      setRetryError(
        'Para una nota crédito parcial debes seleccionar al menos un producto.'
      );
      return;
    }

    try {
      setCreatingCreditNote(true);
      clearMessages();

      const response = await api.post(
        `/api/payments/admin/create-credit-note/${orderId}`,
        {
          type: creditNoteType,
          reasonCode: creditNoteReasonCode,
          reason: creditNoteObservation.trim(),
          selectedItems: creditNoteType === 'partial' ? partialItems : [],
          items: creditNoteType === 'partial' ? partialItems : [],
        }
      );

      if (response?.data?.success) {
        setRetryMessage('Nota crédito creada correctamente en Factus.');
        setShowCreditNoteForm(false);

        if (response?.data?.invoice) {
          setCurrentInvoice(response.data.invoice);
        }
      } else {
        setRetryError(
          response?.data?.message ||
            response?.data?.error ||
            'No se pudo crear la nota crédito.'
        );
      }
    } catch (error) {
      console.error('Error creando nota crédito:', error);

      const backendError = error?.response?.data;

      if (backendError?.code === 'FACTUS_PENDING_CREDIT_NOTE') {
        setRetryError(
          'Factus reporta una nota crédito pendiente para esta factura. Debes sincronizar el estado antes de crear otra nota crédito.'
        );
      } else {
        setRetryError(
          backendError?.message ||
            backendError?.error ||
            'No fue posible crear la nota crédito.'
        );
      }
    } finally {
      setCreatingCreditNote(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'var(--admin-modal-overlay)' }}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          background: 'var(--admin-modal-bg)',
          color: 'var(--admin-modal-text)',
          borderColor: 'var(--admin-glass-border)',
          boxShadow: 'var(--admin-glass-shadow)',
        }}
      >
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
                <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-modal-muted-text)' }}>
                  {currentInvoice.sync.status === 'failed' ? 'Último intento de sincronización' : 'Última sincronización'}: {formatSyncDate(currentInvoice.sync.lastSuccessAt || currentInvoice.sync.lastAttemptAt)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
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

            {!alreadyValidated && (
              <>
                <button
                  type="button"
                  onClick={handleDeleteInvoice}
                  disabled={deletingInvoice}
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: 'var(--admin-danger-soft-bg, rgba(239,68,68,.12))',
                    color: 'var(--admin-danger-text, #dc2626)',
                    borderColor: 'var(--admin-danger-border, rgba(239,68,68,.25))',
                  }}
                >
                  <Trash2
                    size={16}
                    className={deletingInvoice ? 'animate-pulse' : ''}
                  />
                  {deletingInvoice ? 'Eliminando...' : 'Eliminar factura'}
                </button>

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
              </>
            )}

            {alreadyValidated && (
              <>
                <button
                  type="button"
                  onClick={openCreditNoteForm}
                  disabled={creatingCreditNote}
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: 'var(--admin-warning-soft-bg, rgba(245, 158, 11, 0.12))',
                    color: 'var(--admin-warning-text, #d97706)',
                    borderColor: 'var(--admin-warning-border, rgba(245, 158, 11, 0.28))',
                  }}
                >
                  <RotateCcw
                    size={16}
                    className={creatingCreditNote ? 'animate-spin' : ''}
                  />
                  {creatingCreditNote ? 'Creando...' : 'Crear nota crédito'}
                </button>

                <span
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
                  style={{
                    background: 'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))',
                    color: 'var(--admin-success-text, #16a34a)',
                    borderColor: 'var(--admin-success-border, rgba(34, 197, 94, 0.25))',
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

        {(retryMessage || retryError) && (
          <div
            className="border-b px-6 py-3"
            style={{
              borderColor: 'var(--admin-card-border)',
              background: retryError
                ? 'var(--admin-danger-soft-bg, rgba(239, 68, 68, 0.12))'
                : 'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))',
              color: retryError
                ? 'var(--admin-danger-text, #dc2626)'
                : 'var(--admin-success-text, #16a34a)',
            }}
          >
            <div className="flex items-start gap-2 text-sm font-semibold">
              {retryError ? (
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              )}

              <span>{retryError || retryMessage}</span>
            </div>
          </div>
        )}

        {showCreditNoteForm && (
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
                <h3 className="text-base font-bold">
                  Crear nota crédito
                </h3>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: 'var(--admin-card-muted-text)',
                  }}
                >
                  Selecciona si la nota será total o parcial y escribe la
                  observación que justifica el ajuste ante Factus/DIAN.
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
                <span className="text-sm font-bold">
                  Tipo de nota crédito
                </span>

                <select
                  value={creditNoteType}
                  onChange={(event) => {
                    setCreditNoteType(event.target.value);
                    setSelectedCreditNoteItems({});
                  }}
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
                <span className="text-sm font-bold">
                  Concepto de corrección
                </span>

                <select
                  value={creditNoteReasonCode}
                  onChange={(event) =>
                    setCreditNoteReasonCode(event.target.value)
                  }
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
              <span className="text-sm font-bold">
                Observación obligatoria
              </span>

              <textarea
                value={creditNoteObservation}
                onChange={(event) =>
                  setCreditNoteObservation(event.target.value)
                }
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
                            <strong>
                              {item?.title || item?.name || 'Producto'}
                            </strong>

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
                  background: 'var(--admin-warning-soft-bg, rgba(245, 158, 11, 0.12))',
                  color: 'var(--admin-warning-text, #d97706)',
                  borderColor: 'var(--admin-warning-border, rgba(245, 158, 11, 0.28))',
                }}
              >
                <RotateCcw
                  size={16}
                  className={creatingCreditNote ? 'animate-spin' : ''}
                />
                {creatingCreditNote
                  ? 'Creando nota...'
                  : 'Confirmar nota crédito'}
              </button>
            </div>
          </div>
        )}

        <div
          className="border-b px-6"
          style={{
            borderColor: 'var(--admin-card-border)',
            background: 'var(--admin-modal-bg)',
          }}
        >
          <div className="flex gap-2 overflow-x-auto py-3">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition"
                  style={{
                    background: active
                      ? 'var(--admin-button-bg)'
                      : 'var(--admin-button-soft-bg)',
                    color: active
                      ? 'var(--admin-button-text)'
                      : 'var(--admin-button-soft-text)',
                    borderColor: active
                      ? 'var(--admin-button-bg)'
                      : 'var(--admin-button-soft-border)',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="max-h-[65vh] overflow-y-auto px-6 py-5"
          style={{
            background: 'var(--admin-page-glass-overlay)',
            color: 'var(--admin-card-text)',
          }}
        >
          {activeTab === 'summary' && (
            <InvoiceSummaryTab order={order} invoice={currentInvoice} />
          )}

          {activeTab === 'errors' && (
            <InvoiceErrorsTab invoice={currentInvoice} />
          )}

          {activeTab === 'documents' && (
            <InvoiceDocumentsTab order={order} invoice={currentInvoice} />
          )}

          {activeTab === 'creditNotes' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold">
                  Notas crédito registradas
                </h3>

                <p
                  className="mt-1 text-sm"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  Aquí se muestran las notas crédito guardadas en MongoDB para
                  esta factura electrónica.
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
                          Referencia: {note?.referenceCode || '—'} · Factura:
                          {' '}
                          {note?.billNumber || '—'}
                        </p>
                      </div>

                      <div className="text-right text-sm">
                        <p className="font-bold">
                          {formatMoney(note?.totalAmount)}
                        </p>

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
                        <p className="mb-2 text-sm font-bold">
                          Productos incluidos
                        </p>

                        <div className="space-y-2">
                          {note.items.map((item, itemIndex) => (
                            <div
                              key={
                                item?.codeReference ||
                                item?.productId ||
                                itemIndex
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
          )}

          {activeTab === 'timeline' && (
            <InvoiceTimelineTab order={order} invoice={currentInvoice} />
          )}
        </div>
      </div>
    </div>
  );
}
