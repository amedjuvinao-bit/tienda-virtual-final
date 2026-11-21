import api from '../../lib/api';

const BASE_URL = '/api/admin/customers/subscriptions';

async function read(path, params, signal) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  try {
    const response = await api.get(`${BASE_URL}${path}?${query}`, { signal });
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'No se pudieron consultar las suscripciones. Intenta actualizar.');
  }
}

export function getAdminSubscriptions({ q = '', status = 'all', page = 1 } = {}, { signal } = {}) {
  return read('', { q: q.trim(), status, page, limit: 20 }, signal);
}

export function getAdminSubscription(id, { page = 1 } = {}, { signal } = {}) {
  return read(`/${encodeURIComponent(id)}`, { page }, signal);
}
