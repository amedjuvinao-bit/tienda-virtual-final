import api from '../lib/api';

function cleanFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) =>
      value !== '' && value !== null && value !== undefined
    )
  );
}

export const favoriteAdminApi = {
  list(filters) {
    return api.get('/api/favorites/admin', { params: cleanFilters(filters) });
  },

  summary(filters) {
    return api.get('/api/favorites/admin/summary', {
      params: cleanFilters(filters),
    });
  },

  detail(id) {
    return api.get(`/api/favorites/admin/${encodeURIComponent(id)}`);
  },

  removeItem(id, itemId) {
    return api.delete(
      `/api/favorites/admin/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`
    );
  },

  remove(id) {
    return api.delete(`/api/favorites/admin/${encodeURIComponent(id)}`);
  },

  export(filters) {
    return api.get('/api/favorites/admin/export', {
      params: cleanFilters(filters),
      responseType: 'blob',
    });
  },
};

export default favoriteAdminApi;
