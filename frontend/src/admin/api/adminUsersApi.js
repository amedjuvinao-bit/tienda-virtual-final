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
    return 'Ya existe un usuario administrativo con esos datos. Revisa usuario, correo o número de documento.';
  }

  return error?.message || fallbackMessage;
}

function normalizeApiError(error, fallbackMessage) {
  const message = getApiErrorMessage(error, fallbackMessage);

  error.userMessage = message;

  return error;
}

export async function getAdminUsers(params = {}) {
  try {
    const queryString = buildQueryParams(params);

    const response = await api.get(`${BASE_URL}${queryString}`);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudieron cargar los usuarios administrativos.'
    );
  }
}

export async function getAdminUsersMeta() {
  try {
    const response = await api.get(`${BASE_URL}/meta`);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo cargar la información base de usuarios administrativos.'
    );
  }
}

export async function getAdminUserById(userId) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  try {
    const response = await api.get(`${BASE_URL}/${userId}`);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo consultar el usuario administrativo.'
    );
  }
}

export async function createAdminUser(payload) {
  if (!payload) {
    throw new Error('Los datos del usuario administrativo son obligatorios.');
  }

  try {
    const response = await api.post(BASE_URL, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo guardar el usuario administrativo.'
    );
  }
}

export async function updateAdminUser(userId, payload) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos para actualizar el usuario son obligatorios.');
  }

  try {
    const response = await api.put(`${BASE_URL}/${userId}`, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo actualizar el usuario administrativo.'
    );
  }
}

export async function updateAdminUserStatus(userId, payload) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos del estado son obligatorios.');
  }

  try {
    const response = await api.patch(`${BASE_URL}/${userId}/status`, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo cambiar el estado del usuario administrativo.'
    );
  }
}

export async function updateAdminUserPassword(userId, payload) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos de contraseña son obligatorios.');
  }

  try {
    const response = await api.patch(`${BASE_URL}/${userId}/password`, payload);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo cambiar la contraseña del usuario administrativo.'
    );
  }
}

export async function deleteAdminUser(userId) {
  if (!userId) {
    throw new Error('El ID del usuario administrativo es obligatorio.');
  }

  try {
    const response = await api.delete(`${BASE_URL}/${userId}`);

    return response.data;
  } catch (error) {
    throw normalizeApiError(
      error,
      'No se pudo eliminar el usuario administrativo.'
    );
  }
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