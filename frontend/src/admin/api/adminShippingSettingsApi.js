import api from '../../lib/api';

const BASE_URL = '/api/admin/shipping-settings';

function normalizeApiError(error, fallbackMessage) {
  const data = error?.response?.data;
  error.userMessage =
    (typeof data?.message === 'string' && data.message.trim()) ||
    (typeof data?.error === 'string' && data.error.trim()) ||
    error?.message ||
    fallbackMessage;
  error.details = data?.details || null;
  return error;
}

async function request(action, fallbackMessage) {
  try {
    const response = await action();
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, fallbackMessage);
  }
}

export function getAdminShippingSettings() {
  return request(
    () => api.get(BASE_URL),
    'No se pudo cargar la configuración de transportadoras.'
  );
}

export function updateAdminShippingSettings(payload) {
  return request(
    () => api.put(BASE_URL, payload),
    'No se pudo guardar la configuración de transportadoras.'
  );
}

export function testAdminShippingConnection() {
  return request(
    () => api.post(`${BASE_URL}/test`),
    'No se pudo probar la conexión con la transportadora.'
  );
}

export function confirmAdminShippingWebhook() {
  return request(
    () => api.post(`${BASE_URL}/webhook/confirm`),
    'No se pudo confirmar la configuración del webhook.'
  );
}

export function activateAdminShippingProvider(confirmProduction = false) {
  return request(
    () => api.post(`${BASE_URL}/activate`, { confirmProduction }),
    'No se pudo activar la transportadora.'
  );
}

export function disableAdminShippingProvider() {
  return request(
    () => api.post(`${BASE_URL}/disable`),
    'No se pudo volver a la operación manual.'
  );
}
