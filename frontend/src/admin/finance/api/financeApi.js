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

export async function cancelFinanceExpense(id, payload = {}) {
  const response = await api.delete(`/api/admin/finance/expenses/${id}`, {
    data: payload,
  });
  return unwrap(response);
}

export async function reviewFinanceExpense(id, payload = {}) {
  const response = await api.post(
    `/api/admin/finance/expenses/${id}/review`,
    payload
  );
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

export async function getFinanceCostCenters(params = {}) {
  const response = await api.get('/api/admin/finance/cost-centers', { params });
  return unwrap(response) || [];
}

export async function createFinanceCostCenter(payload = {}) {
  const response = await api.post('/api/admin/finance/cost-centers', payload);
  return unwrap(response);
}

export async function updateFinanceCostCenter(id, payload = {}) {
  const response = await api.put(
    `/api/admin/finance/cost-centers/${id}`,
    payload
  );
  return unwrap(response);
}

export async function getFinanceBudgets(params = {}) {
  const response = await api.get('/api/admin/finance/budgets', { params });
  return unwrap(response) || [];
}

export async function getFinanceBudgetControl(params = {}) {
  const response = await api.get('/api/admin/finance/budget-control', { params });
  return unwrap(response);
}

export async function getFinanceTreasury(params = {}) {
  const response = await api.get('/api/admin/finance/treasury', { params });
  return unwrap(response);
}

export async function registerFinancePayablePayment(id, payload = {}) {
  const response = await api.post(
    `/api/admin/finance/payables/${id}/payments`,
    payload
  );
  return unwrap(response);
}

export async function getFinanceClosingControl(params = {}) {
  const response = await api.get('/api/admin/finance/closing-control', {
    params,
  });
  return unwrap(response);
}

export async function certifyFinancePeriod(payload = {}) {
  const response = await api.post('/api/admin/finance/period-closes', payload);
  return unwrap(response);
}

export async function exportFinanceClosingCsv(params = {}) {
  const response = await api.get('/api/admin/finance/closing-export', {
    params,
    responseType: 'blob',
  });
  return response.data;
}

export async function createFinanceBudget(payload = {}) {
  const response = await api.post('/api/admin/finance/budgets', payload);
  return unwrap(response);
}

export async function updateFinanceBudget(id, payload = {}) {
  const response = await api.put(`/api/admin/finance/budgets/${id}`, payload);
  return unwrap(response);
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
  reviewFinanceExpense,
  exportFinanceCsv,
  getAdminBranches,
  getFinanceCostCenters,
  createFinanceCostCenter,
  updateFinanceCostCenter,
  getFinanceBudgets,
  getFinanceBudgetControl,
  getFinanceTreasury,
  registerFinancePayablePayment,
  getFinanceClosingControl,
  certifyFinancePeriod,
  exportFinanceClosingCsv,
  createFinanceBudget,
  updateFinanceBudget,
};
