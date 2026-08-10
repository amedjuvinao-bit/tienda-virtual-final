import api from '../lib/api';

function cleanFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) =>
      value !== '' && value !== null && value !== undefined
    )
  );
}

function versionHeaders(version) {
  return { 'If-Match-Updated-At': String(version || '') };
}

export const cartAdminApi = {
  list(filters) {
    return api.get('/api/cart/admin', { params: cleanFilters(filters) });
  },

  summary(filters) {
    return api.get('/api/cart/admin/summary', { params: cleanFilters(filters) });
  },

  detail(sessionId) {
    return api.get(`/api/cart/admin/${encodeURIComponent(sessionId)}`);
  },

  updateItems(sessionId, version, items) {
    return api.patch(
      `/api/cart/admin/${encodeURIComponent(sessionId)}/items`,
      { items },
      { headers: versionHeaders(version) }
    );
  },

  addNote(sessionId, version, text) {
    return api.post(
      `/api/cart/admin/${encodeURIComponent(sessionId)}/notes`,
      { text },
      { headers: versionHeaders(version) }
    );
  },

  updateTags(sessionId, version, tags) {
    return api.put(
      `/api/cart/admin/${encodeURIComponent(sessionId)}/tags`,
      { tags },
      { headers: versionHeaders(version) }
    );
  },

  clear(sessionId, version) {
    return this.updateItems(sessionId, version, []);
  },

  remove(sessionId, version) {
    return api.delete(`/api/cart/admin/${encodeURIComponent(sessionId)}`, {
      headers: versionHeaders(version),
    });
  },

  generateRecoveryLink(sessionId, expirationMinutes) {
    return api.post(
      `/api/cart/admin/${encodeURIComponent(sessionId)}/recovery-link`,
      { expirationMinutes }
    );
  },

  sendRecovery(sessionId, payload, idempotencyKey) {
    return api.post(
      `/api/cart/admin/${encodeURIComponent(sessionId)}/recoveries`,
      payload,
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
  },

  registerFollowUps(targets, note) {
    return api.post('/api/cart/admin/follow-ups', { targets, note });
  },

  export(filters, sessionIds) {
    return api.post(
      '/api/cart/admin/export',
      { filters: cleanFilters(filters), sessionIds },
      { responseType: 'blob' }
    );
  },
};

export default cartAdminApi;
