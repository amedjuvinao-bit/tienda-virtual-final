// frontend/src/admin/finance/api/financeApi.js
import api from '../../../lib/api';

function unwrap(response) {
  if (response?.data?.data !== undefined) return response.data.data;
  return response?.data;
}

export async function getFinanceSummary(params = {}) {
  const response = await api.get('/api/admin/finance/summary', { params });
  return unwrap(response);
}

export async function getFinanceSales(params = {}) {
  const response = await api.get('/api/admin/finance/sales', { params });
  return unwrap(response);
}

export async function getFinanceProfit(params = {}) {
  const response = await api.get('/api/admin/finance/profit', { params });
  return unwrap(response);
}

export async function getFinanceCash(params = {}) {
  const response = await api.get('/api/admin/finance/cash', { params });
  return unwrap(response);
}

export async function getFinanceExpenses(params = {}) {
  const response = await api.get('/api/admin/finance/expenses', { params });
  return unwrap(response);
}

export async function createFinanceExpense(payload = {}) {
  const response = await api.post('/api/admin/finance/expenses', payload);
  return unwrap(response);
}

export async function updateFinanceExpense(id, payload = {}) {
  const response = await api.put(`/api/admin/finance/expenses/${id}`, payload);
  return unwrap(response);
}

export async function cancelFinanceExpense(id) {
  const response = await api.delete(`/api/admin/finance/expenses/${id}`);
  return unwrap(response);
}

export async function exportFinanceCsv(type = 'sales', params = {}) {
  const response = await api.get('/api/admin/finance/export', {
    params: {
      ...params,
      type,
    },
    responseType: 'blob',
  });

  return response.data;
}

export async function getAdminBranches(params = {}) {
  const response = await api.get('/api/admin/finance/branches', {
    params: {
      limit: 100,
      status: 'active',
      ...params,
    },
  });

  return Array.isArray(response?.data?.data) ? response.data.data : [];
}

export default {
  getFinanceSummary,
  getFinanceSales,
  getFinanceProfit,
  getFinanceCash,
  getFinanceExpenses,
  createFinanceExpense,
  updateFinanceExpense,
  cancelFinanceExpense,
  exportFinanceCsv,
  getAdminBranches,
};
