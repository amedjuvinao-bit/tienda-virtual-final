// frontend/src/admin/api/adminCashSessionApi.js

import api from '../../lib/api';

const BASE_URL = '/api/admin/cash-sessions';

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeError(error, fallbackMessage) {
  const data = error?.response?.data || {};
  const message = data?.message || error?.userMessage || error?.message || fallbackMessage;
  const enhancedError = new Error(message);
  enhancedError.originalError = error;
  enhancedError.response = error?.response || null;
  enhancedError.code = data?.error || data?.code || '';
  enhancedError.details = data?.details || {};
  throw enhancedError;
}

export async function getCurrentCashSession({ branchId, cashRegisterCode = 'CAJA POS' } = {}) {
  try {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', cleanText(branchId));
    if (cashRegisterCode) params.set('cashRegisterCode', cleanText(cashRegisterCode));

    const response = await api.get(`${BASE_URL}/current?${params.toString()}`);
    return response.data;
  } catch (error) {
    normalizeError(error, 'No fue posible consultar la caja actual.');
  }
}

export async function getCashJourneySummary({ branchId, range = 'today' } = {}) {
  try {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', cleanText(branchId));
    params.set('range', cleanText(range || 'today'));
    const response = await api.get(`${BASE_URL}/journey-summary?${params.toString()}`);
    return response.data;
  } catch (error) {
    normalizeError(error, 'No fue posible consultar el control consolidado de caja.');
  }
}

export async function openCashSession(payload = {}) {
  try {
    const response = await api.post(`${BASE_URL}/open`, {
      branchId: cleanText(payload.branchId),
      cashRegisterCode: cleanText(payload.cashRegisterCode || 'CAJA POS'),
      cashRegisterName: cleanText(payload.cashRegisterName || 'Caja POS'),
      openingAmount: Number(payload.openingAmount || 0),
      openingNotes: cleanText(payload.openingNotes || ''),
    });

    return response.data;
  } catch (error) {
    normalizeError(error, 'No fue posible abrir la caja.');
  }
}

export async function closeCashSession(sessionId, payload = {}) {
  try {
    const cleanId = cleanText(sessionId);
    const response = await api.post(`${BASE_URL}/${cleanId}/close`, {
      countedCash: Number(payload.countedCash || 0),
      denominations: Array.isArray(payload.denominations)
        ? payload.denominations.map((entry) => ({
            value: Number(entry.value || 0),
            quantity: Number(entry.quantity || 0),
          }))
        : [],
      closingNotes: cleanText(payload.closingNotes || ''),
    });

    return response.data;
  } catch (error) {
    normalizeError(error, 'No fue posible cerrar la caja.');
  }
}

export async function reviewCashClosing(sessionId, reviewId, payload = {}) {
  try {
    const cleanSessionId = cleanText(sessionId);
    const cleanReviewId = cleanText(reviewId);
    const response = await api.post(
      `${BASE_URL}/${cleanSessionId}/closing-reviews/${cleanReviewId}/review`,
      {
        decision: cleanText(payload.decision),
        reviewNotes: cleanText(payload.reviewNotes || ''),
      }
    );
    return response.data;
  } catch (error) {
    normalizeError(error, 'No fue posible revisar el arqueo de cierre.');
  }
}

export async function addCashMovement(sessionId, payload = {}) {
  try {
    const cleanId = cleanText(sessionId);
    const response = await api.post(`${BASE_URL}/${cleanId}/movements`, {
      type: cleanText(payload.type || 'cash_in'),
      amount: Number(payload.amount || 0),
      direction: cleanText(payload.direction || ''),
      reason: cleanText(payload.reason || ''),
      reference: cleanText(payload.reference || ''),
    });

    return response.data;
  } catch (error) {
    normalizeError(error, 'No fue posible registrar el movimiento de caja.');
  }
}

export async function reviewCashMovement(sessionId, movementId, payload = {}) {
  try {
    const cleanSessionId = cleanText(sessionId);
    const cleanMovementId = cleanText(movementId);
    const response = await api.post(
      `${BASE_URL}/${cleanSessionId}/movements/${cleanMovementId}/review`,
      {
        decision: cleanText(payload.decision),
        reviewNotes: cleanText(payload.reviewNotes || ''),
      }
    );

    return response.data;
  } catch (error) {
    normalizeError(error, 'No fue posible revisar el movimiento de caja.');
  }
}

export async function listCashSessions(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.branchId) query.set('branchId', cleanText(params.branchId));
    if (params.status) query.set('status', cleanText(params.status));
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const response = await api.get(`${BASE_URL}?${query.toString()}`);
    return response.data;
  } catch (error) {
    normalizeError(error, 'No fue posible cargar el histórico de caja.');
  }
}

export async function getCashSessionById(sessionId) {
  try {
    const cleanId = cleanText(sessionId);
    const response = await api.get(`${BASE_URL}/${cleanId}`);
    return response.data;
  } catch (error) {
    normalizeError(error, 'No fue posible cargar el detalle de la caja.');
  }
}

const adminCashSessionApi = {
  getCurrentCashSession,
  getCashJourneySummary,
  openCashSession,
  closeCashSession,
  addCashMovement,
  reviewCashMovement,
  reviewCashClosing,
  listCashSessions,
  getCashSessionById,
};

export default adminCashSessionApi;
