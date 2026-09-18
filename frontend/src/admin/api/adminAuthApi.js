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

export async function verifyAdminTwoFactor(code) {
  try {
    const response = await api.post(
      `${BASE_URL}/2fa/verify`,
      { code: code || '' },
      { skipAdminRefresh: true }
    );
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo verificar el segundo factor.');
  }
}

export async function cancelAdminTwoFactorChallenge() {
  try {
    const response = await api.post(
      `${BASE_URL}/2fa/cancel`,
      null,
      { skipAdminRefresh: true }
    );
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo cancelar el segundo factor.');
  }
}

export async function getAdminTwoFactorStatus() {
  try {
    const response = await api.get(`${BASE_URL}/2fa/status`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo consultar el estado del segundo factor.');
  }
}

export async function startAdminTwoFactorSetup(currentPassword) {
  try {
    const response = await api.post(`${BASE_URL}/2fa/setup`, { currentPassword });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo iniciar la configuración del segundo factor.');
  }
}

export async function confirmAdminTwoFactorSetup(code) {
  try {
    const response = await api.post(`${BASE_URL}/2fa/confirm`, { code });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo activar el segundo factor.');
  }
}

export async function regenerateAdminRecoveryCodes(payload) {
  try {
    const response = await api.post(`${BASE_URL}/2fa/recovery-codes`, payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudieron regenerar los códigos.');
  }
}

export async function disableAdminTwoFactor(payload) {
  try {
    const response = await api.post(`${BASE_URL}/2fa/disable`, payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo desactivar el segundo factor.');
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

export async function logoutAdminSession() {
  try {
    const response = await api.post(`${BASE_URL}/logout`, null, {
      skipAdminRefresh: true,
    });
    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo confirmar el cierre de la sesión administrativa.'
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
  cancelAdminTwoFactorChallenge,
  confirmAdminTwoFactorSetup,
  disableAdminTwoFactor,
  getAdminTwoFactorStatus,
  loginAdmin,
  regenerateAdminRecoveryCodes,
  startAdminTwoFactorSetup,
  verifyAdminTwoFactor,
  verifyAdminSession,
  logoutAdminSession,
  changeRequiredAdminPassword,
};

export default adminAuthApi;
