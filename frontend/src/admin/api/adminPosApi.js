// frontend/src/admin/api/adminPosApi.js

import api, { postIdempotent } from '../../lib/api';

const BASE_URL = '/api/admin/pos';

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
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

function throwPosApiError(error, fallbackMessage) {
  const message = buildPosApiErrorMessage(error, fallbackMessage);
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

function assertPayload(payload, message) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(message);
  }
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

export async function previewPosSale(payload) {
  assertPayload(payload, 'Los datos de la venta POS son obligatorios.');

  try {
    const response = await api.post(`${BASE_URL}/sales/preview`, payload);

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
      payload,
      idempotencyKey
    );

    return response.data;
  } catch (error) {
    throwPosApiError(error, 'No fue posible crear la venta POS.');
  }
}

const adminPosApi = {
  getPosBootstrap,
  previewPosSale,
  createPosSale,
  buildPosIdempotencyKey,
};

export default adminPosApi;
