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
    ...(cleanText(payload.crmStage || payload.crm?.stage)
      ? { crmStage: cleanText(payload.crmStage || payload.crm?.stage).toLowerCase() }
      : {}),
    ...(cleanText(payload.crmPriority || payload.crm?.priority)
      ? {
          crmPriority: cleanText(
            payload.crmPriority || payload.crm?.priority
          ).toLowerCase(),
        }
      : {}),
    ...(payload.crmOwnerAdmin !== undefined || payload.crm?.ownerAdmin !== undefined
      ? {
          crmOwnerAdmin: cleanText(
            payload.crmOwnerAdmin?.id ||
              payload.crmOwnerAdmin?._id ||
              payload.crmOwnerAdmin ||
              payload.crm?.ownerAdmin?.id ||
              payload.crm?.ownerAdmin
          ),
        }
      : {}),
    ...(payload.crmNextReviewAt !== undefined || payload.crm?.nextReviewAt !== undefined
      ? {
          crmNextReviewAt:
            payload.crmNextReviewAt || payload.crm?.nextReviewAt || null,
        }
      : {}),
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
    priority: cleanText(payload.priority || 'normal').toLowerCase(),
    ...(payload.assignedToAdmin !== undefined
      ? {
          assignedToAdmin: cleanText(
            payload.assignedToAdmin?.id ||
              payload.assignedToAdmin?._id ||
              payload.assignedToAdmin
          ),
        }
      : {}),
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
    crmStage: params.crmStage,
    crmPriority: params.crmPriority,
    crmOwner: params.crmOwner,
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

export async function getAdminCustomerSavedSegments() {
  try {
    const response = await api.get(`${BASE_URL}/segments/saved`);
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible cargar los segmentos guardados.');
  }
}

export async function createAdminCustomerSavedSegment(payload = {}) {
  try {
    const response = await api.post(`${BASE_URL}/segments/saved`, {
      name: cleanText(payload.name),
      filters: payload.filters || {},
    });
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible guardar el segmento.');
  }
}

export async function updateAdminCustomerSavedSegment(segmentId, payload = {}) {
  const cleanId = cleanText(segmentId);
  if (!cleanId) throw new Error('Debes seleccionar un segmento válido.');
  try {
    const response = await api.put(`${BASE_URL}/segments/saved/${cleanId}`, {
      name: cleanText(payload.name),
      filters: payload.filters || {},
    });
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible actualizar el segmento.');
  }
}

export async function deleteAdminCustomerSavedSegment(segmentId) {
  const cleanId = cleanText(segmentId);
  if (!cleanId) throw new Error('Debes seleccionar un segmento válido.');
  try {
    const response = await api.delete(`${BASE_URL}/segments/saved/${cleanId}`);
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible eliminar el segmento.');
  }
}

export async function getAdminCustomerCrmAssignees(params = {}) {
  const queryString = buildQueryParams({ branchId: params.branchId });
  try {
    const response = await api.get(`${FOLLOW_UPS_URL}/meta/assignees${queryString}`);
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible cargar los responsables CRM.');
  }
}

export async function getAdminCustomerCrmQueue(params = {}) {
  const queryString = buildQueryParams({
    q: params.q,
    status: params.status || 'pending',
    type: params.type,
    priority: params.priority,
    dueScope: params.dueScope,
    assignedTo: params.assignedTo,
    branchId: params.branchId,
    page: params.page || 1,
    limit: params.limit || 25,
  });
  try {
    const response = await api.get(`${FOLLOW_UPS_URL}/queue${queryString}`);
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible cargar la bandeja CRM.');
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

export async function getAdminCustomer360(customerId, params = {}) {
  const cleanId = cleanText(customerId);

  if (!cleanId) {
    throw new Error('Debes seleccionar un cliente válido.');
  }

  try {
    const queryString = buildQueryParams({
      branchId: params.branchId,
      historyLimit: params.historyLimit || 100,
    });
    const response = await api.get(`${BASE_URL}/${cleanId}/360${queryString}`);

    return response.data;
  } catch (error) {
    throwCustomersApiError(
      error,
      'No fue posible cargar la vista 360° del cliente.'
    );
  }
}

export async function getAdminCustomerPrivacy(customerId) {
  const cleanId = cleanText(customerId);
  if (!cleanId) throw new Error('Debes seleccionar un cliente válido.');
  try {
    const response = await api.get(`${BASE_URL}/${cleanId}/privacy`);
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible consultar la privacidad del cliente.');
  }
}

export async function getAdminCustomerAudit(customerId, params = {}) {
  const cleanId = cleanText(customerId);
  if (!cleanId) throw new Error('Debes seleccionar un cliente válido.');
  try {
    const queryString = buildQueryParams({ limit: params.limit || 100 });
    const response = await api.get(`${BASE_URL}/${cleanId}/audit${queryString}`);
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible consultar la auditoría del cliente.');
  }
}

export async function exportAdminCustomerData(customerId) {
  const cleanId = cleanText(customerId);
  if (!cleanId) throw new Error('Debes seleccionar un cliente válido.');
  try {
    const response = await api.get(`${BASE_URL}/${cleanId}/export`);
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible exportar el expediente del cliente.');
  }
}

export async function updateAdminCustomerConsent(customerId, payload = {}) {
  const cleanId = cleanText(customerId);
  if (!cleanId) throw new Error('Debes seleccionar un cliente válido.');
  try {
    const response = await api.post(`${BASE_URL}/${cleanId}/consent`, {
      status: cleanText(payload.status).toLowerCase(),
      source: cleanText(payload.source || 'admin').toLowerCase(),
      proofReference: cleanText(payload.proofReference),
      note: cleanText(payload.note),
    });
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible registrar el consentimiento.');
  }
}

export async function anonymizeAdminCustomer(customerId, confirmation) {
  const cleanId = cleanText(customerId);
  if (!cleanId) throw new Error('Debes seleccionar un cliente válido.');
  try {
    const response = await api.post(`${BASE_URL}/${cleanId}/anonymize`, {
      confirmation: cleanText(confirmation),
    });
    return response.data;
  } catch (error) {
    throwCustomersApiError(error, 'No fue posible anonimizar el cliente.');
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
  getAdminCustomerSavedSegments,
  createAdminCustomerSavedSegment,
  updateAdminCustomerSavedSegment,
  deleteAdminCustomerSavedSegment,
  searchAdminCustomers,
  getAdminCustomer,
  getAdminCustomer360,
  getAdminCustomerPrivacy,
  getAdminCustomerAudit,
  exportAdminCustomerData,
  updateAdminCustomerConsent,
  anonymizeAdminCustomer,
  getAdminCustomerCrmAssignees,
  getAdminCustomerCrmQueue,
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
