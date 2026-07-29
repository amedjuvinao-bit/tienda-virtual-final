import api from '../../lib/api';

function buildFallbackOrderForInvoice(document = {}) {
  const customer = document.customer || {};

  return {
    _id: document.orderId || '',
    orderNumber: document.orderNumber || '',
    customer: {
      name: customer.businessName || customer.name || 'Cliente',
      email: customer.email || '',
      documentNumber: customer.documentNumber || '',
    },
    billing: customer,
    items: [],
    cart: [],
    electronicInvoice: document,
  };
}

function unwrapOrderResponse(response) {
  const payload = response?.data;
  return payload?.data || payload?.order || payload || null;
}

export default async function buildInvoiceModalData(document = {}) {
  let order = null;
  if (document.orderId) {
    const response = await api.get(`/api/orders/${document.orderId}`);
    order = unwrapOrderResponse(response);
  }

  const fallbackOrder = buildFallbackOrderForInvoice(document);
  const resolvedOrder = order && (order._id || order.id) ? order : fallbackOrder;
  const resolvedInvoice =
    resolvedOrder?.electronicInvoice ||
    resolvedOrder?.invoice ||
    resolvedOrder?.dian ||
    resolvedOrder?.factus ||
    document;

  return {
    order: {
      ...fallbackOrder,
      ...resolvedOrder,
      _id: resolvedOrder?._id || resolvedOrder?.id || fallbackOrder._id,
      electronicInvoice: resolvedInvoice,
    },
    invoice: resolvedInvoice,
  };
}
