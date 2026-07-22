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

export async function getBillingCreditNotes(params = {}) {
  const response = await api.get('/api/admin/billing/credit-notes', { params });
  return unwrap(response);
}

export async function getPendingBillingOrders(params = {}) {
  const response = await api.get('/api/admin/billing/pending-orders', { params });
  return unwrap(response);
}

export async function generateBillingInvoiceForOrder(orderId) {
  const response = await api.post(`/api/admin/billing/orders/${orderId}/generate`);
  return unwrap(response);
}

export async function syncBillingDocument(invoiceId) {
  const response = await api.post(`/api/admin/billing/documents/${encodeURIComponent(invoiceId)}/sync`);
  return unwrap(response);
}

export async function sendBillingDocumentEmail(invoiceId) {
  const response = await api.post(
    `/api/admin/billing/documents/${encodeURIComponent(invoiceId)}/email`
  );
  return unwrap(response);
}

export async function syncBillingCreditNote(invoiceId, noteId) {
  const response = await api.post(
    `/api/admin/billing/credit-notes/${encodeURIComponent(invoiceId)}/${encodeURIComponent(noteId)}/sync`
  );
  return unwrap(response);
}

export async function createBillingCreditNote(invoiceId, payload) {
  const response = await api.post(
    `/api/admin/billing/credit-notes/${encodeURIComponent(invoiceId)}`,
    payload
  );
  return unwrap(response);
}

export async function downloadBillingCreditNotePdf(invoiceId, noteId) {
  const response = await api.get(
    `/api/admin/billing/credit-notes/${encodeURIComponent(invoiceId)}/${encodeURIComponent(noteId)}/pdf`,
    { responseType: 'blob' }
  );
  return normalizeDownloadResponse(response, `nota-credito-${noteId}.pdf`);
}

export async function downloadBillingCreditNoteXml(invoiceId, noteId) {
  const response = await api.get(
    `/api/admin/billing/credit-notes/${encodeURIComponent(invoiceId)}/${encodeURIComponent(noteId)}/xml`,
    { responseType: 'blob' }
  );
  return normalizeDownloadResponse(response, `nota-credito-${noteId}.xml`);
}

export async function getBillingSettings() {
  const response = await api.get('/api/admin/billing/settings');
  return unwrap(response);
}

export async function downloadOrderPdf(orderId) {
  const response = await api.get(`/api/orders/${orderId}/pdf`, {
    responseType: 'blob',
  });
  return normalizeDownloadResponse(response, `factura-${orderId}.pdf`);
}

export async function downloadOrderInvoiceXml(orderId) {
  const response = await api.get(`/api/orders/${orderId}/invoice-xml`, {
    responseType: 'blob',
  });
  return normalizeDownloadResponse(response, `factura-${orderId}.xml`);
}

function normalizeDownloadResponse(response, fallbackFileName) {
  const disposition = String(response?.headers?.['content-disposition'] || '');
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
  let fileName = fallbackFileName;

  try {
    fileName = decodeURIComponent(utf8Match?.[1] || basicMatch?.[1] || fallbackFileName);
  } catch {
    fileName = basicMatch?.[1] || fallbackFileName;
  }

  return {
    blob: response.data,
    fileName,
    contentType: response?.headers?.['content-type'] || 'application/octet-stream',
    source: response?.headers?.['x-invoice-document-source'] || '',
    invoiceNumber: response?.headers?.['x-invoice-number'] || '',
  };
}

export function downloadBlob(download, fallbackFileName = 'factura') {
  const blob = download?.blob || download;
  const fileName = download?.fileName || fallbackFileName;
  const contentType = download?.contentType || blob?.type || 'application/octet-stream';
  const url = URL.createObjectURL(new Blob([blob], { type: contentType }));
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function getDownloadErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data;

  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      return parsed?.message || parsed?.error || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  return data?.message || data?.error || error?.message || fallbackMessage;
}

export function openBlob(blob, mimeType = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default {
  getBillingSummary,
  getBillingDocuments,
  getBillingCreditNotes,
  getPendingBillingOrders,
  generateBillingInvoiceForOrder,
  syncBillingDocument,
  sendBillingDocumentEmail,
  syncBillingCreditNote,
  createBillingCreditNote,
  downloadBillingCreditNotePdf,
  downloadBillingCreditNoteXml,
  getBillingSettings,
  downloadOrderPdf,
  downloadOrderInvoiceXml,
  downloadBlob,
  getDownloadErrorMessage,
  openBlob,
};
