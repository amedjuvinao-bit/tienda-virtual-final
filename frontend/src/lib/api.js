// src/lib/api.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ===== Claves de storage =====
const ADMIN_TOKEN_KEY = 'admin_token';
const SESSION_ID_KEY = 'session_id';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/* ============ Helpers públicos ============ */
export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
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
  let adminToken = '';
  try {
    adminToken = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch { /* ignore */ }

  if (adminToken) {
    if (!config.headers['x-admin-token']) {
      config.headers['x-admin-token'] = adminToken;
    }

    if (!config.headers['Authorization'] && !config.headers['authorization']) {
      config.headers['Authorization'] = `Bearer ${adminToken}`;
    }

    if (!config.headers['x-admin-user']) {
      config.headers['x-admin-user'] = 'admin';
    }
  }

  try {
    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    if (sessionId) {
      if (!config.headers['X-Session-Id']) config.headers['X-Session-Id'] = sessionId;
      if (!config.headers['x-session-id']) config.headers['x-session-id'] = sessionId;
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
  (error) => {
    const status = error?.response?.status;

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