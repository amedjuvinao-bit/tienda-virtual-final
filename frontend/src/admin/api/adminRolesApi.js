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

function getApiErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data;

  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (typeof data?.error === 'string' && data.error.trim()) {
    return data.error;
  }

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors
      .map((item) => {
        if (typeof item === 'string') return item;
        return item?.message || item?.msg || item?.error || '';
      })
      .filter(Boolean)
      .join(' ');
  }

  if (data?.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors)
      .flat()
      .map((item) => {
        if (typeof item === 'string') return item;
        return item?.message || item?.msg || item?.error || '';
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  if (error?.response?.status === 409) {
    return 'Ya existe un perfil administrativo con esos datos.';
  }

  return error?.message || fallbackMessage;
}

function normalizeApiError(error, fallbackMessage) {
  const message = getApiErrorMessage(error, fallbackMessage);

  error.userMessage = message;

  return error;
}

export async function getAdminRoles(params = {}) {
  try {
    const queryString = buildQueryParams(params);

    const response = await api.get(`${BASE_URL}${queryString}`);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudieron cargar los perfiles administrativos.'
    );
  }
}

export async function getAdminRolesMeta() {
  try {
    const response = await api.get(`${BASE_URL}/meta`);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo cargar la información base de perfiles.'
    );
  }
}

export async function getAdminRoleById(roleId) {
  if (!roleId) {
    throw new Error('El ID del rol administrativo es obligatorio.');
  }

  try {
    const response = await api.get(`${BASE_URL}/${roleId}`);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo consultar el perfil administrativo.'
    );
  }
}

export async function createAdminRole(payload) {
  if (!payload) {
    throw new Error('Los datos del rol administrativo son obligatorios.');
  }

  try {
    const response = await api.post(BASE_URL, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo crear el perfil administrativo.'
    );
  }
}

export async function updateAdminRole(roleId, payload) {
  if (!roleId) {
    throw new Error('El ID del rol administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos para actualizar el rol son obligatorios.');
  }

  try {
    const response = await api.put(`${BASE_URL}/${roleId}`, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo actualizar el perfil administrativo.'
    );
  }
}

export async function updateAdminRoleStatus(roleId, payload) {
  if (!roleId) {
    throw new Error('El ID del rol administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos del estado son obligatorios.');
  }

  try {
    const response = await api.patch(`${BASE_URL}/${roleId}/status`, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo cambiar el estado del perfil administrativo.'
    );
  }
}

export async function deleteAdminRole(roleId) {
  if (!roleId) {
    throw new Error('El ID del rol administrativo es obligatorio.');
  }

  try {
    const response = await api.delete(`${BASE_URL}/${roleId}`);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo eliminar el perfil administrativo.'
    );
  }
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