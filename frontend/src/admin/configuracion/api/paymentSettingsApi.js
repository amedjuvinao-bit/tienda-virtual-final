import api from '../../../lib/api';

export async function fetchPaymentSettings() {
  const { data } = await api.get('/api/admin/payment-settings');
  return data;
}

export async function savePaymentSettings(payload) {
  const { data } = await api.put('/api/admin/payment-settings', payload);
  return data;
}

export async function testWompiMerchant(payload) {
  const { data } = await api.post('/api/payments/admin/wompi/test-merchant', payload);
  return data;
}
