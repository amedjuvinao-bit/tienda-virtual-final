// src/admin/orders/electronicInvoice/invoiceStatusUtils.js

export function getInvoiceStatusInfo(invoice) {
  const status = String(invoice?.status || '').trim().toLowerCase();

  const success =
    invoice?.success === true ||
    invoice?.is_validated === true ||
    invoice?.provider?.isValidated === true ||
    invoice?.provider?.raw?.is_validated === true ||
    invoice?.providerStatus === 201 ||
    status === 'validated' ||
    status === 'success' ||
    status === 'accepted' ||
    status === 'generated';

  const sent = status === 'sent';

  const failed =
    invoice?.success === false ||
    status === 'failed' ||
    status === 'error' ||
    status === 'rejected' ||
    invoice?.providerStatus >= 400;

  if (success) {
    return {
      label: 'Validada',
      tone: 'success',
      className:
        'bg-emerald-50 text-emerald-700 border border-emerald-200',
    };
  }

  if (sent) {
    return {
      label: 'Enviada',
      tone: 'info',
      className:
        'bg-sky-50 text-sky-700 border border-sky-200',
    };
  }

  if (failed) {
    return {
      label: 'Con errores',
      tone: 'danger',
      className:
        'bg-red-50 text-red-700 border border-red-200',
    };
  }

  return {
    label: 'Pendiente',
    tone: 'warning',
    className:
      'bg-amber-50 text-amber-700 border border-amber-200',
  };
}

export function shortText(value, size = 18) {
  const text = String(value || '').trim();

  if (!text) return '—';

  return text.length > size ? `${text.slice(0, size)}...` : text;
}

export function formatMoneyCOP(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(number);
}

export function getInvoiceNumber(invoice) {
  return (
    invoice?.invoiceNumber ||
    invoice?.number ||
    invoice?.provider?.number ||
    invoice?.provider?.raw?.number ||
    invoice?.data?.number ||
    invoice?.providerResponse?.data?.data?.number ||
    'Sin número'
  );
}

export function getInvoiceCufe(invoice) {
  return (
    invoice?.cufe ||
    invoice?.provider?.cufe ||
    invoice?.provider?.raw?.cufe ||
    invoice?.data?.cufe ||
    invoice?.providerResponse?.data?.data?.cufe ||
    ''
  );
}