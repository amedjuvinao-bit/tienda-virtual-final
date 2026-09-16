import api from '../../../lib/api';

export async function fetchStoreSettings() {
  const { data } = await api.get('/api/admin/store-settings');
  return data;
}

export async function saveStoreSettings(payload) {
  const { data } = await api.put('/api/admin/store-settings', payload);
  return data;
}

export async function fetchStoreRegions(country) {
  const { data } = await api.get('/api/geo/regions', { params: { country } });
  return Array.isArray(data) ? data : [];
}

export async function fetchStoreCities(country, region) {
  const { data } = await api.get('/api/geo/cities', {
    params: { country, region, limit: 10000 },
  });
  return Array.isArray(data) ? data : [];
}
