// frontend/src/admin/api/adminAuthApi.js

import api from '../../lib/api';

/* ============================================================
 * ADMIN AUTH API
 * Conecta el frontend con:
 * backend/routes/adminAuth.js
 * ============================================================ */

const BASE_URL = '/api/admin/auth';

function getErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

function normalizeApiError(error, fallbackMessage) {
  const message = getErrorMessage(error, fallbackMessage);

  error.userMessage = message;

  return error;
}

export async function loginAdmin(credentials) {
  try {
    const response = await api.post(`${BASE_URL}/login`, {
      username: credentials?.username || '',
      password: credentials?.password || '',
    });

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo iniciar sesión en el panel administrativo.'
    );
  }
}

export async function verifyAdminSession() {
  try {
    const response = await api.get(`${BASE_URL}/verify`);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo verificar la sesión administrativa.'
    );
  }
}

export async function changeRequiredAdminPassword(payload) {
  try {
    const response = await api.post(`${BASE_URL}/change-password-required`, {
      currentPassword: payload?.currentPassword || '',
      newPassword: payload?.newPassword || '',
      confirmPassword: payload?.confirmPassword || '',
    });

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo cambiar la contraseña obligatoria.'
    );
  }
}

const adminAuthApi = {
  loginAdmin,
  verifyAdminSession,
  changeRequiredAdminPassword,
};

export default adminAuthApi;