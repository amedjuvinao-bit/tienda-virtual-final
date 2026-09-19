import api from '../../lib/api';

export async function getAdminLoginSettings() {
  const { data } = await api.get('/api/admin/login-settings');
  return data;
}

export async function updateAdminLoginSettings(payload) {
  const { data } = await api.put('/api/admin/login-settings', payload);
  return data;
}

export async function uploadAdminLoginBackground(file) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.post('/api/uploads?profile=login-background', form);
  return data?.url || '';
}
