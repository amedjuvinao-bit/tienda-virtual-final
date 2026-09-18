// src/lib/api.js
import axios from 'axios';
import { API_BASE_URL } from '../config/apiBaseUrl';

const API_BASE = API_BASE_URL;

const SESSION_ID_KEY = 'session_id';
const ADMIN_REFRESH_URL = '/api/admin/auth/refresh';
const ADMIN_SESSION_EXPIRED_EVENT = 'admin-session-expired';

let adminSessionActive = false;
let refreshPromise = null;

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

async function refreshAdminSessionCookie() {
  try {
    return await api.post(ADMIN_REFRESH_URL, null, { skipAdminRefresh: true });
  } catch (error) {
    if (error?.response?.status !== 409) throw error;
    await wait(150);
    return api.post(ADMIN_REFRESH_URL, null, { skipAdminRefresh: true });
  }
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/* ============ Helpers públicos ============ */
export function setAdminSessionActive(active) {
  adminSessionActive = Boolean(active);
}

export function clearLegacyAdminToken() {
  try {
    localStorage.removeItem('admin_token');
  } catch { /* ignore */ }
}

export function setSessionId(sessionId) {
  try {
    if (sessionId) localStorage.setItem(SESSION_ID_KEY, sessionId);
    else localStorage.removeItem(SESSION_ID_KEY);
  } catch { /* ignore */ }
}

export function withIdempotency(config = {}, idempotencyKey) {
  const key = String(idempotencyKey || '').trim();
  if (!key) return { ...config };
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      'Idempotency-Key': key,
    },
  };
}

export function postIdempotent(url, data, idempotencyKey, config = {}) {
  return api.post(url, data, withIdempotency(config, idempotencyKey));
}

/* ============ Interceptors ============ */
api.interceptors.request.use((config) => {
  try {
    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    const headerNames = Object.keys(config.headers || {}).map((key) =>
      String(key).toLowerCase()
    );
    const hasExplicitSessionHeader =
      (typeof config.headers?.has === 'function' &&
        config.headers.has('X-Session-Id')) ||
      headerNames.includes('x-session-id');
    if (sessionId && !hasExplicitSessionHeader) {
      config.headers['X-Session-Id'] = sessionId;
    }
  } catch { /* ignore */ }

  if (config.idempotencyKey && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = String(config.idempotencyKey);
  }

  if (config.data instanceof FormData) {
    if (config.headers && config.headers['Content-Type'] === 'application/json') {
      delete config.headers['Content-Type'];
    }
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};
    const requestUrl = String(originalRequest.url || '');
    const isVerifyRequest = requestUrl.includes('/api/admin/auth/verify');
    const excludedAuthRequest = [
      '/api/admin/auth/login',
      '/api/admin/auth/forgot-password',
      '/api/admin/auth/reset-password',
      ADMIN_REFRESH_URL,
    ].some((path) => requestUrl.includes(path));

    if (
      status === 401 &&
      !originalRequest._adminSessionRetry &&
      !originalRequest.skipAdminRefresh &&
      !excludedAuthRequest &&
      (adminSessionActive || isVerifyRequest)
    ) {
      originalRequest._adminSessionRetry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAdminSessionCookie().finally(() => {
            refreshPromise = null;
          });
        }

        await refreshPromise;
        adminSessionActive = true;
        return api(originalRequest);
      } catch {
        adminSessionActive = false;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EXPIRED_EVENT));
        }
      }
    }

    if (status === 409) return Promise.reject(error);

    const backendMsg =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message;

    const statusMsgMap = {
      400: 'Solicitud inválida. Revisa los datos.',
      401: 'No autorizado. Inicia sesión.',
      403: 'Acceso denegado.',
      404: 'Recurso no encontrado.',
      422: 'Datos incompletos o inválidos.',
      500: 'Error del servidor. Intenta nuevamente.',
      502: 'Puerta de enlace inválida.',
      503: 'Servicio no disponible. Intenta en unos minutos.',
      504: 'Tiempo de espera excedido. Verifica tu conexión.',
    };

    error.userMessage =
      backendMsg || statusMsgMap[status] || 'Error de red o servidor. Intenta nuevamente.';

    return Promise.reject(error);
  }
);

export default api;
