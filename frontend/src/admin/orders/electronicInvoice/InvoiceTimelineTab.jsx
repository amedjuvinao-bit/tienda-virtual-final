// src/admin/orders/electronicInvoice/InvoiceTimelineTab.jsx

import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RotateCcw,
  CreditCard,
  Trash2,
  RefreshCw,
} from 'lucide-react';

export default function InvoiceTimelineTab({ order, invoice }) {
  const orderTimeline = Array.isArray(order?.timeline) ? order.timeline : [];
  const creditNotes = Array.isArray(invoice?.creditNotes)
    ? invoice.creditNotes
    : [];

  const invoiceCreatedAt =
    invoice?.generatedAt ||
    invoice?.createdAt ||
    invoice?.created_at ||
    invoice?.data?.created_at ||
    invoice?.providerResponse?.data?.data?.created_at ||
    order?.createdAt;

  const invoiceValidatedAt =
    invoice?.acceptedAt ||
    invoice?.validatedAt ||
    invoice?.validated_at ||
    invoice?.provider?.validatedAt ||
    invoice?.data?.validated_at ||
    invoice?.providerResponse?.data?.data?.validated_at;

  const baseEvents = [
    {
      type: 'created',
      title: 'Orden creada',
      description: `Orden #${order?.orderNumber || '—'} registrada en el sistema.`,
      date: order?.createdAt,
      by: 'system',
    },
    invoiceCreatedAt
      ? {
          type: 'invoice',
          title: 'Factura electrónica generada',
          description: `Factura ${
            invoice?.invoiceNumber || invoice?.provider?.number || ''
          } enviada al proveedor electrónico.`,
          date: invoiceCreatedAt,
          by: 'system',
        }
      : null,
    invoiceValidatedAt
      ? {
          type: 'success',
          title: 'Factura validada',
          description: 'El proveedor confirmó la validación de la factura electrónica.',
          date: invoiceValidatedAt,
          by: 'Factus / DIAN',
        }
      : null,
  ].filter(Boolean);

  const creditNoteEvents = creditNotes.map((note) => {
    const noteNumber = note?.provider?.number || note?.referenceCode || '—';
    const noteType = note?.type === 'partial' ? 'parcial' : 'total';
    const totalAmount = formatMoney(note?.totalAmount || 0);

    return {
      type: 'credit_note',
      title: `Nota crédito ${noteType} creada`,
      description: `Nota crédito #${noteNumber} registrada por valor de ${totalAmount}. Estado: ${note?.status || 'sin estado'}.`,
      date: note?.createdAt || note?.provider?.validatedAt || note?.validatedAt,
      by: note?.createdBy || 'admin',
    };
  });

  const timelineEvents = orderTimeline.map((event) => ({
    type: normalizeEventType(event),
    title: getOrderEventTitle(event),
    description: event?.message || 'Evento registrado en la orden.',
    date: event?.at || event?.createdAt,
    by: event?.by || 'system',
  }));

  const events = removeDuplicatedEvents([
    ...baseEvents,
    ...creditNoteEvents,
    ...timelineEvents,
  ]).sort((a, b) => {
    const dateA = new Date(a?.date || 0).getTime();
    const dateB = new Date(b?.date || 0).getTime();

    return dateB - dateA;
  });

  if (!events.length) {
    return (
      <div
        className="rounded-3xl border p-6 text-sm font-medium"
        style={{
          background: 'var(--admin-primary-soft-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-muted-text)',
        }}
      >
        No hay historial disponible para esta factura.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => {
        const Icon = getIcon(event.type);
        const tone = getTone(event.type);

        return (
          <div
            key={`${event.title}-${event.date || index}-${index}`}
            className="flex gap-4 rounded-3xl border p-5 transition"
            style={{
              background: 'var(--admin-card-bg)',
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-text)',
              boxShadow:
                'var(--admin-card-shadow, 0 18px 40px rgba(15, 23, 42, 0.06))',
            }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: tone.background,
                color: tone.color,
                border: `1px solid ${tone.border}`,
              }}
            >
              <Icon size={21} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3
                  className="text-sm font-bold"
                  style={{
                    color: 'var(--admin-card-text)',
                  }}
                >
                  {event.title}
                </h3>

                {event.by && (
                  <span
                    className="rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{
                      background: 'var(--admin-button-soft-bg)',
                      color: 'var(--admin-button-soft-text)',
                      borderColor: 'var(--admin-button-soft-border)',
                    }}
                  >
                    {event.by}
                  </span>
                )}
              </div>

              <p
                className="mt-1 text-sm"
                style={{
                  color: 'var(--admin-card-muted-text)',
                }}
              >
                {event.description}
              </p>

              <p
                className="mt-2 text-xs font-semibold"
                style={{
                  color: 'var(--admin-card-muted-text)',
                  opacity: 0.75,
                }}
              >
                {formatDate(event.date)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function normalizeEventType(event) {
  const type = String(event?.type || 'system').toLowerCase();
  const message = String(event?.message || '').toLowerCase();

  if (type.includes('credit_note') || message.includes('nota crédito')) {
    return 'credit_note';
  }

  if (type.includes('retry') || message.includes('reintento')) {
    return 'retry';
  }

  if (type.includes('deleted') || message.includes('eliminada')) {
    return 'deleted';
  }

  if (type.includes('payment') || message.includes('wompi') || message.includes('payu')) {
    return 'payment';
  }

  if (type.includes('failed') || type.includes('error') || message.includes('error')) {
    return 'error';
  }

  if (type === 'status') {
    return 'status';
  }

  return type;
}

function getOrderEventTitle(event) {
  const type = String(event?.type || '').toLowerCase();
  const message = String(event?.message || '').toLowerCase();

  if (type === 'credit_note_created' || message.includes('nota crédito')) {
    return 'Nota crédito creada';
  }

  if (type === 'electronic_invoice_retry' || message.includes('reintento')) {
    return 'Reintento de factura electrónica';
  }

  if (type === 'electronic_invoice_deleted' || message.includes('eliminada')) {
    return 'Factura eliminada en Factus';
  }

  if (type === 'payment_updated' || message.includes('wompi') || message.includes('payu')) {
    return 'Pago actualizado';
  }

  if (event?.statusTo) {
    return `Estado cambiado a ${event.statusTo}`;
  }

  return 'Evento de orden';
}

function removeDuplicatedEvents(events) {
  const seen = new Set();

  return events.filter((event) => {
    const key = [
      event?.type || '',
      event?.title || '',
      event?.description || '',
      formatDateKey(event?.date),
    ].join('|');

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function getIcon(type) {
  if (type === 'success') return CheckCircle2;
  if (type === 'failed' || type === 'error') return AlertTriangle;
  if (type === 'invoice') return FileText;
  if (type === 'credit_note' || type === 'credit_note_created') return RotateCcw;
  if (type === 'payment') return CreditCard;
  if (type === 'deleted') return Trash2;
  if (type === 'retry') return RefreshCw;

  return Clock;
}

function getTone(type) {
  if (type === 'success') {
    return {
      background: 'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))',
      color: 'var(--admin-success-text, #16a34a)',
      border: 'var(--admin-success-border, rgba(34, 197, 94, 0.25))',
    };
  }

  if (type === 'failed' || type === 'error') {
    return {
      background: 'var(--admin-danger-soft-bg, rgba(239, 68, 68, 0.12))',
      color: 'var(--admin-danger-text, #dc2626)',
      border: 'var(--admin-danger-border, rgba(239, 68, 68, 0.25))',
    };
  }

  if (type === 'invoice') {
    return {
      background: 'var(--admin-primary-soft-bg)',
      color: 'var(--admin-primary-soft-text, var(--admin-primary))',
      border: 'var(--admin-primary-soft-border, var(--admin-card-border))',
    };
  }

  if (type === 'credit_note' || type === 'credit_note_created') {
    return {
      background: 'var(--admin-warning-soft-bg, rgba(245, 158, 11, 0.12))',
      color: 'var(--admin-warning-text, #d97706)',
      border: 'var(--admin-warning-border, rgba(245, 158, 11, 0.28))',
    };
  }

  if (type === 'payment') {
    return {
      background: 'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))',
      color: 'var(--admin-success-text, #16a34a)',
      border: 'var(--admin-success-border, rgba(34, 197, 94, 0.25))',
    };
  }

  if (type === 'deleted') {
    return {
      background: 'var(--admin-danger-soft-bg, rgba(239, 68, 68, 0.12))',
      color: 'var(--admin-danger-text, #dc2626)',
      border: 'var(--admin-danger-border, rgba(239, 68, 68, 0.25))',
    };
  }

  if (type === 'retry') {
    return {
      background: 'var(--admin-warning-soft-bg, rgba(245, 158, 11, 0.12))',
      color: 'var(--admin-warning-text, #d97706)',
      border: 'var(--admin-warning-border, rgba(245, 158, 11, 0.28))',
    };
  }

  return {
    background: 'var(--admin-button-soft-bg, var(--admin-primary-soft-bg))',
    color: 'var(--admin-card-muted-text)',
    border: 'var(--admin-button-soft-border, var(--admin-card-border))',
  };
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) return 'Fecha no disponible';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDateKey(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString();
}