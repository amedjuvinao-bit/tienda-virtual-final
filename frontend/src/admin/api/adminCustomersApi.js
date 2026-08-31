// frontend/src/admin/api/adminCustomersApi.js

import api from '../../lib/api';

const BASE_URL = '/api/admin/customers';
const FOLLOW_UPS_URL = '/api/admin/customer-follow-ups';

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeTextList(value) {
  const entries = Array.isArray(value)
    ? value
    : cleanText(value)
      .split(',')
      .map((item) => item.trim());

  return [...new Set(entries.map(cleanText).filter(Boolean))];
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
  const fiscalProfile = payload.fiscalProfile || {};

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
    ...(Array.isArray(payload.addresses)
      ? { addresses: payload.addresses }
      : {}),
    fiscalProfile: {
      personType: cleanText(
        fiscalProfile.personType || payload.personType
      ).toLowerCase(),
      businessName: cleanText(
        fiscalProfile.businessName || payload.businessName
      ),
      verificationDigit: cleanText(
        fiscalProfile.verificationDigit || fiscalProfile.dv || payload.dv
      )
        .replace(/\D/g, '')
        .slice(0, 1),
      municipalityCode: cleanText(
        fiscalProfile.municipalityCode ||
          fiscalProfile.cityCode ||
          payload.municipalityCode ||
          payload.cityCode
      ),
      departmentCode: cleanText(
        fiscalProfile.departmentCode || payload.departmentCode
      ),
      countryCode: cleanText(
        fiscalProfile.countryCode || payload.countryCode || payload.country || 'CO'
      ).toUpperCase(),
      tributeCode: cleanText(
        fiscalProfile.tributeCode || payload.tributeCode || 'ZZ'
      ).toUpperCase(),
      taxRegime: cleanText(fiscalProfile.taxRegime || payload.taxRegime),
      taxResponsibilities: normalizeTextList(
        fiscalProfile.taxResponsibilities ?? payload.taxResponsibilities
      ),
    },
    ...(payload.source !== undefined
      ? { source: cleanText(payload.source).toLowerCase() }
      : {}),
    ...(payload.status !== undefined
      ? { status: cleanText(payload.status).toLowerCase() }
      : {}),
    ...(payload.acceptsMarketing !== undefined
      ? { acceptsMarketing: payload.acceptsMarketing === true }
      : {}),
    notes: cleanText(payload.notes),
    ...(Array.isArray(payload.tags) ? { tags: payload.tags } : {}),
    ...(cleanText(payload.branchId || payload.defaultBranch)
      ? { branchId: cleanText(payload.branchId || payload.defaultBranch) }
      : {}),
  };
}

export function normalizeCustomerFollowUpPayload(payload = {}) {
  return {
    type: cleanText(payload.type || 'note').toLowerCase(),
    status: cleanText(payload.status || 'pending').toLowerCase(),
    note: cleanText(payload.note || payload.message || payload.comment),
    nextAction: cleanText(payload.nextAction),
    dueAt: payload.dueAt || null,
    ...(cleanText(payload.branchId)
      ? { branchId: cleanText(payload.branchId) }
      : {}),
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
    branchId: params.branchId,
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

export async function getAdminCustomer(customerId, params = {}) {
  const cleanId = cleanText(customerId);

  if (!cleanId) {
    throw new Error('Debes seleccionar un cliente válido.');
  }

  try {
    const queryString = buildQueryParams({
      branchId: params.branchId,
      ordersLimit: params.ordersLimit,
    });
    const response = await api.get(`${BASE_URL}/${cleanId}${queryString}`);

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

export async function getAdminCustomerFollowUps(customerId, params = {}) {
  const cleanId = cleanText(customerId);

  if (!cleanId) {
    throw new Error('Debes seleccionar un cliente válido.');
  }

  const queryString = buildQueryParams({
    status: params.status || 'all',
    limit: params.limit || 20,
    branchId: params.branchId,
  });

  try {
    const response = await api.get(`${FOLLOW_UPS_URL}/${cleanId}${queryString}`);

    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible cargar el seguimiento del cliente.');
  }
}

export async function createAdminCustomerFollowUp(customerId, payload) {
  const cleanId = cleanText(customerId);

  if (!cleanId) {
    throw new Error('Debes seleccionar un cliente válido.');
  }

  assertPayload(payload, 'Los datos del seguimiento son obligatorios.');

  try {
    const response = await api.post(`${FOLLOW_UPS_URL}/${cleanId}`, normalizeCustomerFollowUpPayload(payload));

    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible crear el seguimiento del cliente.');
  }
}

export async function updateAdminCustomerFollowUp(customerId, followUpId, payload) {
  const cleanCustomerId = cleanText(customerId);
  const cleanFollowUpId = cleanText(followUpId);

  if (!cleanCustomerId || !cleanFollowUpId) {
    throw new Error('Debes seleccionar un seguimiento válido.');
  }

  assertPayload(payload, 'Los datos del seguimiento son obligatorios.');

  try {
    const response = await api.put(`${FOLLOW_UPS_URL}/${cleanCustomerId}/${cleanFollowUpId}`, normalizeCustomerFollowUpPayload(payload));

    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible actualizar el seguimiento del cliente.');
  }
}

export async function deleteAdminCustomerFollowUp(customerId, followUpId) {
  const cleanCustomerId = cleanText(customerId);
  const cleanFollowUpId = cleanText(followUpId);

  if (!cleanCustomerId || !cleanFollowUpId) {
    throw new Error('Debes seleccionar un seguimiento válido.');
  }

  try {
    const response = await api.delete(`${FOLLOW_UPS_URL}/${cleanCustomerId}/${cleanFollowUpId}`);

    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible eliminar el seguimiento del cliente.');
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
  getAdminCustomerFollowUps,
  createAdminCustomerFollowUp,
  updateAdminCustomerFollowUp,
  deleteAdminCustomerFollowUp,
  createQuickPosCustomer,
  normalizeCustomerPayload,
  normalizeCustomerFollowUpPayload,
};

export default adminCustomersApi;
