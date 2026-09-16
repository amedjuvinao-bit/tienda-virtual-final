import api from '../../../lib/api';

function enhanceError(error, fallbackMessage) {
  const payload = error?.response?.data || {};
  const enhanced = new Error(payload.message || error?.message || fallbackMessage);
  enhanced.code = payload.error || error?.code || 'SHIPPING_RATES_REQUEST_FAILED';
  enhanced.details = Array.isArray(payload.details) ? payload.details : [];
  enhanced.status = Number(error?.response?.status || 0);
  enhanced.userMessage = enhanced.message;
  return enhanced;
}

export async function fetchShippingRates() {
  try {
    const { data } = await api.get('/api/admin/shipping-rates');
    return data;
  } catch (error) {
    throw enhanceError(error, 'No fue posible cargar las tarifas de envío.');
  }
}

export async function saveShippingRates(payload) {
  try {
    const { data } = await api.put('/api/admin/shipping-rates', payload);
    return data;
  } catch (error) {
    throw enhanceError(error, 'No fue posible guardar las tarifas de envío.');
  }
}
