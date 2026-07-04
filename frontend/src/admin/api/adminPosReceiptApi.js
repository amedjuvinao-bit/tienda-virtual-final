// frontend/src/admin/api/adminPosReceiptApi.js

import api from '../../lib/api';

const BASE_URL = '/api/admin/pos';

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function getErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data || {};
  return data?.message || error?.userMessage || error?.message || fallbackMessage;
}

function throwReceiptError(error, fallbackMessage) {
  const enhancedError = new Error(getErrorMessage(error, fallbackMessage));
  enhancedError.originalError = error;
  enhancedError.response = error?.response || null;
  throw enhancedError;
}

function getOrderId(orderOrId) {
  if (typeof orderOrId === 'string') return cleanText(orderOrId);
  return cleanText(orderOrId?._id || orderOrId?.id || orderOrId?.orderId || orderOrId?.orderNumber || '');
}

function assertOrderId(orderOrId) {
  const orderId = getOrderId(orderOrId);

  if (!orderId) {
    throw new Error('No se encontró la orden para generar el comprobante.');
  }

  return orderId;
}

export async function getPosReceipt(orderOrId, options = {}) {
  const orderId = assertOrderId(orderOrId);
  const query = options.generateInvoice === true ? '?generateInvoice=true' : '';

  try {
    const response = await api.get(`${BASE_URL}/sales/${orderId}/receipt${query}`);
    return response.data;
  } catch (error) {
    throwReceiptError(error, 'No fue posible cargar el comprobante POS.');
  }
}

export async function sendPosReceiptEmail(orderOrId, options = {}) {
  const orderId = assertOrderId(orderOrId);

  try {
    const response = await api.post(`${BASE_URL}/sales/${orderId}/send-email`, {
      to: cleanText(options.to || ''),
      generateInvoice: options.generateInvoice !== false,
    });

    return response.data;
  } catch (error) {
    throwReceiptError(error, 'No fue posible enviar el comprobante por correo.');
  }
}

export async function openPosReceiptPdf(orderOrId, options = {}) {
  const orderId = assertOrderId(orderOrId);
  const query = options.generateInvoice === true ? '?generateInvoice=true' : '';

  try {
    const response = await api.get(`${BASE_URL}/sales/${orderId}/receipt/pdf${query}`, {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf',
      },
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');

    if (!opened) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `comprobante-pos-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    return true;
  } catch (error) {
    throwReceiptError(error, 'No fue posible abrir el PDF del comprobante.');
  }
}

const adminPosReceiptApi = {
  getPosReceipt,
  sendPosReceiptEmail,
  openPosReceiptPdf,
};

export default adminPosReceiptApi;
