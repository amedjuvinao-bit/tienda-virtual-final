// frontend/src/admin/api/adminUsersApi.js

import api from '../../lib/api';

/* ============================================================
 * ADMIN USERS API
 * Conecta el frontend con:
 * backend/routes/adminUsers.js
 * ============================================================ */

const BASE_URL = '/api/admin/users';

function buildQueryParams(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.append(key, String(value));
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : '';
}

export async function getAdminUsers(params = {}) {
  const queryString = buildQueryParams(params);

  const response = await api.get(`${BASE_URL}${queryString}`);

  return response.data;
}

export async function getAdminUsersMeta() {
  const response = await api.get(`${BASE_URL}/meta`);

  return response.data;
}

export async function getAdminUserById(userId) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  const response = await api.get(`${BASE_URL}/${userId}`);

  return response.data;
}

export async function createAdminUser(payload) {
  if (!payload) {
    throw new Error('Los datos del usuario administrativo son obligatorios.');
  }

  const response = await api.post(BASE_URL, payload);

  return response.data;
}

export async function updateAdminUser(userId, payload) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos para actualizar el usuario son obligatorios.');
  }

  const response = await api.put(`${BASE_URL}/${userId}`, payload);

  return response.data;
}

export async function updateAdminUserStatus(userId, payload) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos del estado son obligatorios.');
  }

  const response = await api.patch(`${BASE_URL}/${userId}/status`, payload);

  return response.data;
}

export async function updateAdminUserPassword(userId, payload) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos de contraseña son obligatorios.');
  }

  const response = await api.patch(`${BASE_URL}/${userId}/password`, payload);

  return response.data;
}

export async function deleteAdminUser(userId) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  const response = await api.delete(`${BASE_URL}/${userId}`);

  return response.data;
}

const adminUsersApi = {
  getAdminUsers,
  getAdminUsersMeta,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  updateAdminUserStatus,
  updateAdminUserPassword,
  deleteAdminUser,
};

export default adminUsersApi;