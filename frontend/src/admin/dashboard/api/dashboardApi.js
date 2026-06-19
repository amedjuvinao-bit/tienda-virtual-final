// frontend/src/admin/dashboard/api/dashboardApi.js

import api from '../../../lib/api';

export async function getDashboardSummary() {
  const response = await api.get('/api/admin/dashboard');

  if (response?.data?.data) {
    return response.data.data;
  }

  return response.data;
}

export default {
  getDashboardSummary,
};