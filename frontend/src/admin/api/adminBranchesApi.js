// frontend/src/admin/api/adminBranchesApi.js

import api from '../../lib/api';

/* ============================================================
 * ADMIN BRANCHES API
 * Conecta el frontend con:
 * backend/routes/adminBranches.js
 * backend/routes/adminBranchProtection.js
 * ============================================================ */

const BASE_URL = '/api/admin/branches';

const OPERATION_LABELS = {
  activeStockCount: 'stock activo',
  reservedStockCount: 'stock reservado',
  pendingReservationsCount: 'reservas pendientes',
  movementsCount: 'movimientos de inventario',
};

function buildQueryParams(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.append(key, String(value));
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : '';
}

function getOperationSummaryItems(summary = {}) {
  return Object.entries(OPERATION_LABELS)
    .map(([key, label]) => {
      const value = Number(summary?.[key] || 0);

      if (!value) return '';

      return `${value} ${label}`;
    })
    .filter(Boolean);
}

function buildOperationBlockedMessage(data = {}) {
  const baseMessage =
    data?.message ||
    'No puedes desactivar o eliminar esta sede porque tiene operación asociada.';

  const items = getOperationSummaryItems(data?.operationSummary);

  if (!items.length) return baseMessage;

  return `${baseMessage} Operación detectada: ${items.join(', ')}.`;
}

function getApiErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data || {};

  if (data?.code === 'BRANCH_HAS_OPERATION') {
    return buildOperationBlockedMessage(data);
  }

  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.join(' ');
  }

  return data?.message || error?.message || fallbackMessage;
}

function throwBranchApiError(error, fallbackMessage) {
  const message = getApiErrorMessage(error, fallbackMessage);
  const enhancedError = new Error(message);

  enhancedError.originalError = error;
  enhancedError.response = {
    ...(error?.response || {}),
    data: {
      ...(error?.response?.data || {}),
      message,
    },
  };

  throw enhancedError;
}

export async function getAdminBranches(params = {}) {
  const queryString = buildQueryParams(params);

  try {
    const response = await api.get(`${BASE_URL}${queryString}`);

    return response.data;
  } catch (error) {
    throwBranchApiError(error, 'No fue posible cargar las sedes.');
  }
}

export async function getAdminBranchesMeta() {
  try {
    const response = await api.get(`${BASE_URL}/meta`);

    return response.data;
  } catch (error) {
    throwBranchApiError(error, 'No fue posible cargar la información base de sedes.');
  }
}

export async function getAdminBranchById(branchId) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  try {
    const response = await api.get(`${BASE_URL}/${branchId}`);

    return response.data;
  } catch (error) {
    throwBranchApiError(error, 'No fue posible cargar la sede.');
  }
}

export async function createAdminBranch(payload) {
  if (!payload) {
    throw new Error('Los datos de la sede administrativa son obligatorios.');
  }

  try {
    const response = await api.post(BASE_URL, payload);

    return response.data;
  } catch (error) {
    throwBranchApiError(error, 'No fue posible crear la sede.');
  }
}

export async function updateAdminBranch(branchId, payload) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos para actualizar la sede son obligatorios.');
  }

  try {
    const response = await api.put(`${BASE_URL}/${branchId}`, payload);

    return response.data;
  } catch (error) {
    throwBranchApiError(error, 'No fue posible actualizar la sede.');
  }
}

export async function updateAdminBranchStatus(branchId, payload) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  if (!payload) {
    throw new Error('Los datos del estado son obligatorios.');
  }

  try {
    const response = await api.patch(`${BASE_URL}/${branchId}/status`, payload);

    return response.data;
  } catch (error) {
    throwBranchApiError(error, 'No fue posible cambiar el estado de la sede.');
  }
}

export async function markAdminBranchAsMain(branchId) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  try {
    const response = await api.patch(`${BASE_URL}/${branchId}/main`);

    return response.data;
  } catch (error) {
    throwBranchApiError(error, 'No fue posible marcar la sede como principal.');
  }
}

export async function markAdminBranchAsOnlineDefault(branchId) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  try {
    const response = await api.patch(`${BASE_URL}/${branchId}/online-default`);

    return response.data;
  } catch (error) {
    throwBranchApiError(error, 'No fue posible marcar la sede para pedidos online.');
  }
}

export async function deleteAdminBranch(branchId) {
  if (!branchId) {
    throw new Error('El ID de la sede administrativa es obligatorio.');
  }

  try {
    const response = await api.delete(`${BASE_URL}/${branchId}`);

    return response.data;
  } catch (error) {
    throwBranchApiError(error, 'No fue posible eliminar la sede.');
  }
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
