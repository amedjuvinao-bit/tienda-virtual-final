// frontend/src/admin/billing/api/adminBillingApi.js
import api from '../../../lib/api';

function unwrap(response) {
  if (response?.data?.data !== undefined) return response.data.data;
  return response?.data;
}

export async function getBillingSummary(params = {}) {
  const response = await api.get('/api/admin/billing/summary', { params });
  return unwrap(response);
}

export async function getBillingDocuments(params = {}) {
  const response = await api.get('/api/admin/billing/documents', { params });
  return unwrap(response);
}

export async function getPendingBillingOrders(params = {}) {
  const response = await api.get('/api/admin/billing/pending-orders', { params });
  return unwrap(response);
}

export async function getBillingSettings() {
  const response = await api.get('/api/admin/billing/settings');
  return unwrap(response);
}

export async function downloadOrderPdf(orderId) {
  const response = await api.get(`/api/orders/${orderId}/pdf`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function downloadOrderInvoiceXml(orderId) {
  const response = await api.get(`/api/orders/${orderId}/invoice-xml`, {
    responseType: 'blob',
  });
  return response.data;
}

export function openBlob(blob, mimeType = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default {
  getBillingSummary,
  getBillingDocuments,
  getPendingBillingOrders,
  getBillingSettings,
  downloadOrderPdf,
  downloadOrderInvoiceXml,
  openBlob,
};
