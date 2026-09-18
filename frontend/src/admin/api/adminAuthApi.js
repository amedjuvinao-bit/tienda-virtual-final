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

export async function startAdminTwoFactorReconfiguration(payload) {
  try {
    const response = await api.post(`${BASE_URL}/2fa/reconfigure`, payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo iniciar el cambio de aplicación 2FA.');
  }
}

export async function confirmAdminTwoFactorReconfiguration(code) {
  try {
    const response = await api.post(`${BASE_URL}/2fa/reconfigure/confirm`, { code });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo confirmar el cambio de aplicación 2FA.');
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

export async function getAdminSecurityCenter() {
  try {
    const response = await api.get(`${BASE_URL}/security-center`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo consultar el centro de seguridad.');
  }
}

export async function revokeAdminSession(sessionId, payload) {
  try {
    const response = await api.post(
      `${BASE_URL}/sessions/${encodeURIComponent(sessionId)}/revoke`,
      payload
    );
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudo cerrar la sesión seleccionada.');
  }
}

export async function revokeOtherAdminSessions(payload) {
  try {
    const response = await api.post(`${BASE_URL}/sessions/revoke-others`, payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudieron cerrar las demás sesiones.');
  }
}

export async function revokeAllAdminSessions(payload) {
  try {
    const response = await api.post(`${BASE_URL}/sessions/revoke-all`, payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, 'No se pudieron cerrar todas las sesiones.');
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
  confirmAdminTwoFactorReconfiguration,
  confirmAdminTwoFactorSetup,
  disableAdminTwoFactor,
  getAdminSecurityCenter,
  getAdminTwoFactorStatus,
  loginAdmin,
  regenerateAdminRecoveryCodes,
  revokeAdminSession,
  revokeAllAdminSessions,
  revokeOtherAdminSessions,
  startAdminTwoFactorReconfiguration,
  startAdminTwoFactorSetup,
  verifyAdminTwoFactor,
  verifyAdminSession,
  logoutAdminSession,
  changeRequiredAdminPassword,
};

export default adminAuthApi;
