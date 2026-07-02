// frontend/src/admin/dashboard/api/dashboardApi.js

import api from '../../../lib/api';

function unwrapDashboardResponse(response) {
  if (response?.data?.data) {
    return response.data.data;
  }

  return response.data;
}

export async function getDashboardSummary(params = {}) {
  const response = await api.get('/api/admin/dashboard', { params });
  return unwrapDashboardResponse(response);
}

export async function getDashboardSales(params = {}) {
  const response = await api.get('/api/admin/dashboard-sales', { params });
  return unwrapDashboardResponse(response);
}

export default {
  getDashboardSummary,
  getDashboardSales,
};
