// frontend/src/admin/api/adminPasswordRecoveryApi.js

import api from '../../lib/api';

const BASE_URL = '/api/admin/auth';

function getApiErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data;

  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (typeof data?.error === 'string' && data.error.trim()) {
    return data.error;
  }

  return error?.message || fallbackMessage;
}

function normalizeApiError(error, fallbackMessage) {
  const message = getApiErrorMessage(error, fallbackMessage);

  error.userMessage = message;

  return error;
}

export async function requestAdminPasswordReset(payload) {
  try {
    const response = await api.post(`${BASE_URL}/forgot-password`, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo solicitar la recuperación de contraseña.'
    );
  }
}

export async function resetAdminPassword(payload) {
  try {
    const response = await api.post(`${BASE_URL}/reset-password`, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo restablecer la contraseña.'
    );
  }
}

export default {
  requestAdminPasswordReset,
  resetAdminPassword,
};