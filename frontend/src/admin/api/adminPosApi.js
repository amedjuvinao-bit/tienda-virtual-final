// frontend/src/admin/api/adminPosApi.js

import api, { postIdempotent } from '../../lib/api';

const BASE_URL = '/api/admin/pos';

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidEmail(value) {
  const email = cleanText(value).toLowerCase();

  if (!email) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function assertQuickCustomer(customer = {}) {
  const fullName = cleanText(customer.fullName);
  const phone = cleanText(customer.phone);
  const email = cleanText(customer.email).toLowerCase();

  if (fullName.length < 3) {
    throw new Error('Ingresa el nombre del cliente rápido.');
  }

  if (phone && cleanDigits(phone).length < 7) {
    throw new Error('El celular del cliente debe tener mínimo 7 números o dejarse vacío.');
  }

  if (email && !isValidEmail(email)) {
    throw new Error('El correo del cliente no tiene un formato válido. Déjalo vacío o escribe un correo real.');
  }
}

function buildPosApiErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data || {};

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.join(' ');
  }

  if (data?.details?.message) {
    return data.details.message;
  }

  return data?.message || error?.userMessage || error?.message || fallbackMessage;
}

function emitPosSaleError(message) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent('pos:sale-error', {
    detail: {
      message: cleanText(message) || 'No fue posible crear la venta POS.',
    },
  }));
}

function throwPosApiError(error, fallbackMessage) {
  const message = buildPosApiErrorMessage(error, fallbackMessage);
  const enhancedError = new Error(message);

  emitPosSaleError(message);

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

function assertPayload(payload, message) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(message);
  }
}

function emitPosSaleCreated(data) {
  if (typeof window === 'undefined' || !data?.order) return;

  window.dispatchEvent(new CustomEvent('pos:sale-created', {
    detail: data,
  }));
}

function getSelectedPosCustomerPayload(payload = {}) {
  if (payload.customerId || payload.customerMode === 'identified') return payload;
  if (typeof window === 'undefined') return payload;

  const state = window.__rbPosCustomerSelection || {};
  const mode = cleanText(state.mode || 'guest').toLowerCase();

  if (mode === 'existing') {
    const customer = state.selectedCustomer || {};

    if (!customer.id) {
      throw new Error('Selecciona un cliente existente o cambia a consumidor final.');
    }

    return {
      ...payload,
      customerMode: 'identified',
      customerId: customer.id,
      customer: {
        fullName: customer.fullName || customer.displayName || '',
        name: customer.fullName || customer.displayName || '',
        phone: customer.phone || '',
        email: customer.email || '',
        documentType: customer.documentType || '',
        documentNumber: customer.documentNumber || '',
        address: customer.address || '',
        city: customer.city || '',
        department: customer.department || '',
        country: customer.country || 'CO',
      },
    };
  }

  if (mode === 'quick') {
    const customer = state.quickCustomer || {};
    const fullName = cleanText(customer.fullName);
    const phone = cleanText(customer.phone);
    const email = cleanText(customer.email).toLowerCase();

    assertQuickCustomer({ fullName, phone, email });

    return {
      ...payload,
      customerMode: 'identified',
      customerAction: 'quick_create',
      customer: {
        fullName,
        name: fullName,
        phone,
        email,
        documentType: cleanText(customer.documentType || 'CC').toUpperCase(),
        documentNumber: cleanText(customer.documentNumber),
        country: 'CO',
      },
    };
  }

  return {
    ...payload,
    customerMode: 'guest',
    customer: {
      fullName: 'Consumidor final',
      name: 'Consumidor final',
      country: 'CO',
    },
  };
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

export function buildPosIdempotencyKey(prefix = 'pos-sale') {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${cleanText(prefix) || 'pos-sale'}-${Date.now()}-${randomPart}`;
}

export async function getPosBootstrap() {
  try {
    const response = await api.get(`${BASE_URL}/bootstrap`);

    return response.data;
  } catch (error) {
    throwPosApiError(error, 'No fue posible cargar la información inicial del POS.');
  }
}

export async function getPosProducts({ branchId, q = '', limit = 30 } = {}) {
  const cleanBranchId = cleanText(branchId);

  if (!cleanBranchId) {
    throw new Error('Debes seleccionar una sede para buscar productos POS.');
  }

  const queryString = buildQueryParams({
    branchId: cleanBranchId,
    q,
    limit,
  });

  try {
    const response = await api.get(`${BASE_URL}/products${queryString}`);

    return response.data;
  } catch (error) {
    throwPosApiError(error, 'No fue posible buscar productos POS.');
  }
}

export async function previewPosSale(payload) {
  assertPayload(payload, 'Los datos de la venta POS son obligatorios.');

  try {
    const response = await api.post(`${BASE_URL}/sales/preview`, getSelectedPosCustomerPayload(payload));

    return response.data;
  } catch (error) {
    throwPosApiError(error, 'No fue posible calcular la venta POS.');
  }
}

export async function createPosSale(payload, options = {}) {
  assertPayload(payload, 'Los datos de la venta POS son obligatorios.');

  const idempotencyKey =
    cleanText(options.idempotencyKey || '') ||
    buildPosIdempotencyKey('pos-sale');

  try {
    const response = await postIdempotent(
      `${BASE_URL}/sales`,
      getSelectedPosCustomerPayload(payload),
      idempotencyKey
    );

    emitPosSaleCreated(response.data);

    return response.data;
  } catch (error) {
    throwPosApiError(error, 'No fue posible crear la venta POS.');
  }
}

const adminPosApi = {
  getPosBootstrap,
  getPosProducts,
  previewPosSale,
  createPosSale,
  buildPosIdempotencyKey,
};

export default adminPosApi;
