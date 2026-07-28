export const ELECTRONIC_INVOICE_TABS = [
  { id: 'summary', label: 'Resumen' },
  { id: 'errors', label: 'Errores' },
  { id: 'documents', label: 'XML / Factus' },
  { id: 'creditNotes', label: 'Notas crédito' },
  { id: 'timeline', label: 'Historial' },
];

export const CREDIT_NOTE_REASONS = [
  {
    value: '1',
    label: 'Devolución parcial o no aceptación parcial del servicio',
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
    label: 'Descuento comercial por pronto pago',
  },
  {
    value: '6',
    label: 'Descuento comercial por volumen de ventas',
  },
];

export function createCreditNoteRequestKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `nc_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function invoiceIsAlreadyValidated(invoice) {
  const status = String(invoice?.status || '').trim().toLowerCase();

  return (
    status === 'accepted' ||
    status === 'validated' ||
    invoice?.provider?.isValidated === true ||
    invoice?.provider?.raw?.is_validated === true
  );
}

export function getOrderItems(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items;
  }

  if (Array.isArray(order?.cart) && order.cart.length) {
    return order.cart;
  }

  return [];
}

export function getInvoiceSyncIdentifier(invoice) {
  return (
    invoice?.id ||
    invoice?._id ||
    invoice?.invoiceNumber ||
    invoice?.provider?.number
  );
}

export function getOrderId(order, currentInvoice, initialInvoice) {
  return order?._id || currentInvoice?.orderId || initialInvoice?.orderId;
}

export function getCreditNoteIdentifier(note) {
  return (
    note?._id ||
    note?.id ||
    note?.provider?.number ||
    note?.referenceCode
  );
}

export function getItemKey(item, index) {
  return String(
    item?.productId ||
      item?.product ||
      item?._id ||
      item?.id ||
      item?.title ||
      index
  );
}

export function getItemQuantity(item) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

export function formatMoney(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

export function formatCreditNoteDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('es-CO');
}

export function formatSyncDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CO');
}

export function getCreditNotePublicUrl(note) {
  return (
    note?.provider?.links?.public_url ||
    note?.provider?.links?.publicUrl ||
    note?.provider?.raw?.data?.links?.public_url ||
    note?.provider?.raw?.links?.public_url ||
    ''
  );
}

export function getCreditNoteQrUrl(note) {
  return (
    note?.provider?.links?.qr ||
    note?.provider?.raw?.data?.links?.qr ||
    note?.provider?.raw?.links?.qr ||
    ''
  );
}
