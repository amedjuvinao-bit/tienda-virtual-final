// frontend/src/admin/api/adminBranchesApi.js

import api from '../../lib/api';

/* ============================================================
 * ADMIN BRANCHES API
 * Conecta el frontend con:
 * backend/routes/adminBranches.js
 * ============================================================ */

const BASE_URL = '/api/admin/branches';

function buildQueryParams(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.append(key, String(value));
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : '';
}

export async function getAdminBranches(params = {}) {
  const queryString = buildQueryParams(params);

  const response = await api.get(`${BASE_URL}${queryString}`);

  return response.data;
}

export async function getAdminBranchesMeta() {
  const response = await api.get(`${BASE_URL}/meta`);

  return response.data;
}

export async function getAdminBranchById(branchId) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  const response = await api.get(`${BASE_URL}/${branchId}`);

  return response.data;
}

export async function createAdminBranch(payload) {
  if (!payload) {
    throw new Error('Los datos de la sede administrativa son obligatorios.');
  }

  const response = await api.post(BASE_URL, payload);

  return response.data;
}

export async function updateAdminBranch(branchId, payload) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos para actualizar la sede son obligatorios.');
  }

  const response = await api.put(`${BASE_URL}/${branchId}`, payload);

  return response.data;
}

export async function updateAdminBranchStatus(branchId, payload) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos del estado son obligatorios.');
  }

  const response = await api.patch(`${BASE_URL}/${branchId}/status`, payload);

  return response.data;
}

export async function markAdminBranchAsMain(branchId) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  const response = await api.patch(`${BASE_URL}/${branchId}/main`);

  return response.data;
}

export async function markAdminBranchAsOnlineDefault(branchId) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  const response = await api.patch(`${BASE_URL}/${branchId}/online-default`);

  return response.data;
}

export async function deleteAdminBranch(branchId) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  const response = await api.delete(`${BASE_URL}/${branchId}`);

  return response.data;
}

const adminBranchesApi = {
  getAdminBranches,
  getAdminBranchesMeta,
  getAdminBranchById,
  createAdminBranch,
  updateAdminBranch,
  updateAdminBranchStatus,
  markAdminBranchAsMain,
  markAdminBranchAsOnlineDefault,
  deleteAdminBranch,
};

export default adminBranchesApi;