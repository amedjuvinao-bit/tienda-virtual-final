// frontend/src/admin/api/adminCustomersApi.js

import api from '../../lib/api';

const BASE_URL = '/api/admin/customers';

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function buildCustomersApiErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data || {};

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.join(' ');
  }

  if (data?.details?.message) {
    return data.details.message;
  }

  return data?.message || error?.userMessage || error?.message || fallbackMessage;
}

function throwCustomersApiError(error, fallbackMessage) {
  const message = buildCustomersApiErrorMessage(error, fallbackMessage);
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

function buildQueryParams(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const cleanValue = typeof value === 'string' ? cleanText(value) : value;

    if (cleanValue === '') return;

    query.set(key, String(cleanValue));
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : '';
}

function assertPayload(payload, message) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(message);
  }
}

export function normalizeCustomerPayload(payload = {}) {
  return {
    firstName: cleanText(payload.firstName),
    lastName: cleanText(payload.lastName),
    fullName: cleanText(payload.fullName || payload.name),
    displayName: cleanText(payload.displayName || payload.fullName || payload.name),
    phone: cleanText(payload.phone || payload.cellphone || payload.mobile),
    email: cleanText(payload.email).toLowerCase(),
    documentType: cleanText(payload.documentType).toUpperCase(),
    documentNumber: cleanText(payload.documentNumber || payload.document || payload.identification),
    address: cleanText(payload.address),
    city: cleanText(payload.city),
    department: cleanText(payload.department),
    country: cleanText(payload.country || 'CO').toUpperCase(),
    postalCode: cleanText(payload.postalCode),
    source: cleanText(payload.source || 'admin').toLowerCase(),
    status: cleanText(payload.status || 'active').toLowerCase(),
    acceptsMarketing: payload.acceptsMarketing === true,
    notes: cleanText(payload.notes),
    tags: Array.isArray(payload.tags) ? payload.tags : [],
  };
}

export async function getAdminCustomers(params = {}) {
  const queryString = buildQueryParams({
    q: params.q,
    status: params.status,
    source: params.source,
    segment: params.segment,
    page: params.page || 1,
    limit: params.limit || 20,
  });

  try {
    const response = await api.get(`${BASE_URL}${queryString}`);

    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible cargar los clientes.');
  }
}

export async function searchAdminCustomers(q, options = {}) {
  return getAdminCustomers({
    q,
    status: options.status || 'active',
    source: options.source || 'all',
    segment: options.segment || 'all',
    page: 1,
    limit: options.limit || 10,
  });
}

export async function getAdminCustomer(customerId) {
  const cleanId = cleanText(customerId);

  if (!cleanId) {
    throw new Error('Debes seleccionar un cliente válido.');
  }

  try {
    const response = await api.get(`${BASE_URL}/${cleanId}`);

    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible consultar el cliente.');
  }
}

export async function createAdminCustomer(payload) {
  assertPayload(payload, 'Los datos del cliente son obligatorios.');

  try {
    const response = await api.post(BASE_URL, normalizeCustomerPayload(payload));

    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible crear el cliente.');
  }
}

export async function updateAdminCustomer(customerId, payload) {
  const cleanId = cleanText(customerId);

  if (!cleanId) {
    throw new Error('Debes seleccionar un cliente válido.');
  }

  assertPayload(payload, 'Los datos del cliente son obligatorios.');

  try {
    const response = await api.put(`${BASE_URL}/${cleanId}`, normalizeCustomerPayload(payload));

    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible editar el cliente.');
  }
}

export async function createQuickPosCustomer(payload) {
  assertPayload(payload, 'Los datos del cliente son obligatorios.');

  return createAdminCustomer({
    ...payload,
    source: 'pos',
    status: 'active',
  });
}

const adminCustomersApi = {
  getAdminCustomers,
  searchAdminCustomers,
  getAdminCustomer,
  createAdminCustomer,
  updateAdminCustomer,
  createQuickPosCustomer,
  normalizeCustomerPayload,
};

export default adminCustomersApi;
