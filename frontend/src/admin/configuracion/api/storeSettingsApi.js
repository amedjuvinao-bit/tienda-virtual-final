import api from '../../../lib/api';

export async function fetchStoreSettings() {
  const { data } = await api.get('/api/admin/store-settings');
  return data;
}

export async function saveStoreSettings(payload) {
  const { data } = await api.put('/api/admin/store-settings', payload);
  return data;
}
