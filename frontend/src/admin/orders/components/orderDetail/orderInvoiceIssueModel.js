const FAILED_STATUSES = new Set(['failed', 'rejected', 'error']);
const FINAL_STATUSES = new Set(['accepted', 'validated']);

export function getManualOrderIdentityIssue(order = {}) {
  if (order?.source !== 'manual' || order?.payment?.status !== 'pending_manual') return null;
  const customer = order.customer || {};
  const billing = order.billing || {};
  const normalizeDocument = (value) => String(value || '').replace(/[.\-\s]/g, '').toUpperCase();
  const normalizeName = (first, last) => [first, last].filter(Boolean).join(' ')
    .trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const customerDocument = normalizeDocument(customer.id || customer.documentNumber);
  const billingDocument = normalizeDocument(billing.documentNumber || billing.id);
  const customerName = normalizeName(customer.name, customer.lastname);
  const billingName = normalizeName(billing.firstName || billing.name, billing.lastName || billing.lastname);
  if (
    (customerDocument && billingDocument && customerDocument !== billingDocument) ||
    (billing.personType !== 'juridica' && customerName && billingName && customerName !== billingName)
  ) {
    return 'El nombre o documento del cliente es diferente de facturación. Corrige ambos antes de confirmar el pago.';
  }
  return null;
}

export function getOrderInvoiceIssue(order = {}) {
  const payment = String(order?.payment?.status || '').toLowerCase();
  if (!['paid', 'approved', 'captured', 'success'].includes(payment)) return null;

  const invoice = order?.electronicInvoice || {};
  const status = String(invoice.status || '').toLowerCase();
  if (FINAL_STATUSES.has(status) || invoice?.provider?.isValidated === true) return null;
  if (status && !FAILED_STATUSES.has(status) && status !== 'pending') return null;

  const billing = order?.billing || {};
  const customer = order?.customer || {};
  const identifiedNaturalPerson = billing.isFinalConsumer !== true &&
    String(billing.personType || 'natural').toLowerCase() !== 'juridica';
  const lastName = billing.lastName || billing.lastname || customer.lastname;

  if (identifiedNaturalPerson && !String(lastName || '').trim()) {
    return 'Falta el apellido fiscal del comprador. Corrígelo en Cliente e historial; después revisa la factura en Facturación.';
  }

  if (FAILED_STATUSES.has(status)) {
    return invoice.failureReason ||
      'No se pudo emitir la factura. Revisa el motivo en Facturación, Órdenes por facturar.';
  }

  return null;
}
