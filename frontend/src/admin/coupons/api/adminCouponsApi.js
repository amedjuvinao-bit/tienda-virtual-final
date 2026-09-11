// frontend/src/admin/coupons/api/adminCouponsApi.js
import api from '../../../lib/api';

function cleanParams(params = {}) {
  const result = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    result[key] = value;
  });
  return result;
}

export async function fetchAdminCoupons(params = {}) {
  const { data } = await api.get('/api/admin/coupons', {
    params: cleanParams(params),
  });
  return data?.data || { rows: [], total: 0, page: 1, limit: 20, pages: 1 };
}

export async function fetchCouponCampaignMetadata() {
  const { data } = await api.get('/api/admin/coupons/metadata');
  return data?.data || { products: [], categories: [], customers: [], branches: [] };
}

export async function simulateAdminCoupon(payload = {}) {
  try {
    const { data } = await api.post('/api/admin/coupons/simulate', payload);
    return data?.data;
  } catch (error) {
    if (error?.response?.data?.data) return error.response.data.data;
    throw error;
  }
}

export async function createAdminCoupon(payload = {}) {
  const { data } = await api.post('/api/admin/coupons', payload);
  return data?.data;
}

export async function updateAdminCoupon(id, payload = {}) {
  const { data } = await api.put(`/api/admin/coupons/${id}`, payload);
  return data?.data;
}

export async function changeAdminCouponStatus(id, payload = {}) {
  const { data } = await api.patch(`/api/admin/coupons/${id}/status`, payload);
  return data?.data;
}

export async function deleteAdminCoupon(id) {
  const { data } = await api.delete(`/api/admin/coupons/${id}`);
  return data?.data;
}

export async function validateAdminCoupon(payload = {}) {
  const { data } = await api.post('/api/admin/coupons/validate', payload);
  return data?.data;
}
