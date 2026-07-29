// frontend/src/admin/orders/components/orderDetail/orderDetailUtils.js

export function toCOP(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(number);
}

export function fmtDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function cleanText(value, fallback = '—') {
  const text = String(value || '').trim();

  return text || fallback;
}

export function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function getOrderItems(order) {
  if (Array.isArray(order?.items) && order.items.length > 0) {
    return order.items;
  }

  if (Array.isArray(order?.cart) && order.cart.length > 0) {
    return order.cart;
  }

  return [];
}

export function getItemQuantity(item) {
  return Number(item?.quantity ?? item?.qty ?? 0) || 0;
}

export function getItemPrice(item) {
  return Number(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0) || 0;
}

export function getOrderSummary(order) {
  const items = getOrderItems(order);

  const totalItems = items.reduce((acc, item) => acc + getItemQuantity(item), 0);

  const subtotalFromItems = items.reduce(
    (acc, item) => acc + getItemQuantity(item) * getItemPrice(item),
    0
  );

  const subtotal = Number(order?.subtotal ?? order?.summary?.subtotal ?? subtotalFromItems) || 0;
  const shipping = Number(order?.shipping || 0) || 0;
  const total = Number(order?.total ?? subtotal + shipping) || 0;

  return {
    items,
    itemsCount: items.length,
    totalItems,
    subtotal,
    shipping,
    total,
  };
}

export function getCustomerName(order) {
  const customer = order?.customer || {};

  return (
    [customer.name, customer.lastname].filter(Boolean).join(' ').trim() ||
    'Cliente sin nombre'
  );
}

export function getBillingName(order) {
  const billing = order?.billing || {};

  return (
    billing.businessName ||
    [billing.firstName || billing.name, billing.lastName || billing.lastname]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    getCustomerName(order)
  );
}

export function getOrderBranchInfo(order) {
  const branchSnapshot = order?.branchSnapshot || {};
  const branch = order?.branch || {};

  const name =
    branchSnapshot.name ||
    branch.name ||
    order?.branchName ||
    order?.branch_label ||
    '';

  const code =
    branchSnapshot.code ||
    branch.code ||
    order?.branchCode ||
    '';

  const type =
    branchSnapshot.type ||
    branch.type ||
    '';

  return {
    name: cleanText(name, 'Sin sede'),
    code: String(code || '').trim().toUpperCase(),
    type: cleanText(type, '—'),
    hasBranch: Boolean(name || code),
  };
}

export function getOrderSourceLabel(source) {
  const normalized = normalizeText(source);

  const labels = {
    online: 'Tienda online',
    admin: 'Panel admin',
    pos: 'Punto de venta',
    manual: 'Manual',
    import: 'Importada',
    system: 'Sistema',
  };

  return labels[normalized] || 'Tienda online';
}

export function getAdminSnapshot(order) {
  const snapshot = order?.createdByAdminSnapshot || {};
  const admin = order?.createdByAdmin || {};

  const username =
    snapshot.username ||
    admin.username ||
    order?.adminUsername ||
    '';

  const displayName =
    snapshot.displayName ||
    admin.displayName ||
    admin.fullName ||
    username ||
    '';

  const role =
    snapshot.role ||
    snapshot.adminRole ||
    admin.role ||
    admin.adminRole ||
    '';

  return {
    username: cleanText(username),
    displayName: cleanText(displayName),
    role: cleanText(role),
  };
}

export function getPaymentInfo(order) {
  const payment = order?.payment || {};

  const provider = cleanText(payment.providerLabel || payment.provider, 'Sin proveedor');
  const status = cleanText(payment.status, 'Pendiente');
  const currency = cleanText(payment.currency, 'COP');

  return {
    provider,
    status,
    currency,
    active: payment.active !== false,
  };
}

export function getInvoiceInfo(order) {
  const invoice = order?.electronicInvoice || order?.invoice || {};

  const number =
    invoice.invoiceNumber ||
    invoice.number ||
    invoice?.provider?.number ||
    invoice?.provider?.raw?.number ||
    '';

  const cufe =
    invoice.cufe ||
    invoice?.provider?.cufe ||
    invoice?.provider?.raw?.cufe ||
    '';

  const status =
    invoice.status ||
    invoice?.provider?.status ||
    '';

  return {
    number: cleanText(number, 'Sin número'),
    cufe: cleanText(cufe, '—'),
    status: cleanText(status, 'Sin factura'),
    hasInvoice: Boolean(number || cufe || status),
  };
}

export function titleForEvent(event) {
  const type = normalizeText(event?.type);

  const labels = {
    status_changed: 'Cambio de estado',
    order_created: 'Orden creada',
    note_created: 'Nota creada',
    note_updated: 'Nota actualizada',
    note_deleted: 'Nota eliminada',
    tags_updated: 'Etiquetas actualizadas',
    email_sent: 'Correo enviado',
    refund_created: 'Reembolso creado',
    order_retry_updated: 'Orden actualizada',
  };

  return labels[type] || cleanText(event?.message, 'Evento');
}

export function descriptionForEvent(event) {
  return cleanText(event?.message, 'Sin descripción');
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  return tags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean);
}
