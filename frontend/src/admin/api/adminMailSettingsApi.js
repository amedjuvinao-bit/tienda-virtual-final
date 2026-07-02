// frontend/src/admin/api/adminMailSettingsApi.js

import api from '../../lib/api';

const BASE_URL = '/api/admin/mail-settings';

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

export async function getAdminMailSettings() {
  try {
    const response = await api.get(BASE_URL);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo cargar la configuración de correo.'
    );
  }
}

export async function updateAdminMailSettings(payload) {
  try {
    const response = await api.put(BASE_URL, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo guardar la configuración de correo.'
    );
  }
}

export async function sendAdminMailTest(payload) {
  try {
    const response = await api.post(`${BASE_URL}/test`, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo enviar el correo de prueba.'
    );
  }
}

export default {
  getAdminMailSettings,
  updateAdminMailSettings,
  sendAdminMailTest,
};