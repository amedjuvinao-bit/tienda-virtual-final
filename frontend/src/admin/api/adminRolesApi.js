// frontend/src/admin/api/adminRolesApi.js

import api from '../../lib/api';

/* ============================================================
 * ADMIN ROLES API
 * Conecta el frontend con:
 * backend/routes/adminRoles.js
 * ============================================================ */

const BASE_URL = '/api/admin/roles';

function buildQueryParams(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.append(key, String(value));
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : '';
}

export async function getAdminRoles(params = {}) {
  const queryString = buildQueryParams(params);

  const response = await api.get(`${BASE_URL}${queryString}`);

  return response.data;
}

export async function getAdminRolesMeta() {
  const response = await api.get(`${BASE_URL}/meta`);

  return response.data;
}

export async function getAdminRoleById(roleId) {
  if (!roleId) {
    throw new Error('El ID del rol administrativo es obligatorio.');
  }

  const response = await api.get(`${BASE_URL}/${roleId}`);

  return response.data;
}

export async function createAdminRole(payload) {
  if (!payload) {
    throw new Error('Los datos del rol administrativo son obligatorios.');
  }

  const response = await api.post(BASE_URL, payload);

  return response.data;
}

export async function updateAdminRole(roleId, payload) {
  if (!roleId) {
    throw new Error('El ID del rol administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos para actualizar el rol son obligatorios.');
  }

  const response = await api.put(`${BASE_URL}/${roleId}`, payload);

  return response.data;
}

export async function updateAdminRoleStatus(roleId, payload) {
  if (!roleId) {
    throw new Error('El ID del rol administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos del estado son obligatorios.');
  }

  const response = await api.patch(`${BASE_URL}/${roleId}/status`, payload);

  return response.data;
}

export async function deleteAdminRole(roleId) {
  if (!roleId) {
    throw new Error('El ID del rol administrativo es obligatorio.');
  }

  const response = await api.delete(`${BASE_URL}/${roleId}`);

  return response.data;
}

const adminRolesApi = {
  getAdminRoles,
  getAdminRolesMeta,
  getAdminRoleById,
  createAdminRole,
  updateAdminRole,
  updateAdminRoleStatus,
  deleteAdminRole,
};

export default adminRolesApi;