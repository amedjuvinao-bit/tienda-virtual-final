'use strict';

const {
  getFactusAccessToken,
  getFactusCredentials,
  validateCredentials,
} = require('./factusAuth');
const {
  fetchFactus,
  trimSafe,
} = require('./factusProviderShared');

async function getFactusDocumentByNumber({ providerConfig = {}, number, type = 'invoice' } = {}) {
  const safeNumber = encodeURIComponent(trimSafe(number, 160));
  const resource = type === 'credit-note' ? 'credit-notes' : 'bills';

  if (!safeNumber) {
    return {
      success: false,
      provider: 'factus',
      status: 400,
      stage: 'document_number',
      error: type === 'credit-note'
        ? 'La nota crédito no tiene número Factus para consultar.'
        : 'La factura no tiene número Factus para consultar.',
    };
  }

  const credentials = getFactusCredentials({ providerConfig });
  const missing = validateCredentials(credentials);

  if (missing.length) {
    return {
      success: false,
      provider: 'factus',
      status: 422,
      stage: 'config_incomplete',
      error: `Configuración Factus incompleta. Faltan: ${missing.join(', ')}.`,
      missing,
    };
  }

  let tokenResult;

  try {
    tokenResult = await getFactusAccessToken(credentials);
  } catch (error) {
    return {
      success: false,
      provider: 'factus',
      status: 503,
      stage: 'auth',
      error: error?.name === 'AbortError'
        ? 'La autenticación con Factus superó el tiempo de espera.'
        : error?.message || 'No fue posible autenticar con Factus.',
    };
  }

  if (!tokenResult.success) {
    return {
      success: false,
      provider: 'factus',
      stage: 'auth',
      ...tokenResult,
    };
  }

  try {
    const response = await fetchFactus(
      `${credentials.apiUrl}/v2/${resource}/${safeNumber}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json().catch(() => ({}));

    return {
      success: response.ok,
      provider: 'factus',
      status: response.status,
      stage: type === 'credit-note' ? 'get_credit_note' : 'get_invoice',
      data,
      error: response.ok
        ? null
        : data?.message || data?.error || `Factus respondió HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'factus',
      status: 503,
      stage: type === 'credit-note' ? 'get_credit_note' : 'get_invoice',
      error: error?.name === 'AbortError'
        ? 'La consulta a Factus superó el tiempo de espera.'
        : error?.message || 'No fue posible consultar Factus.',
    };
  }
}

async function getInvoiceFromFactus({ providerConfig, invoiceNumber } = {}) {
  return getFactusDocumentByNumber({
    providerConfig,
    number: invoiceNumber,
    type: 'invoice',
  });
}

async function getCreditNoteFromFactus({ providerConfig, creditNoteNumber } = {}) {
  return getFactusDocumentByNumber({
    providerConfig,
    number: creditNoteNumber,
    type: 'credit-note',
  });
}

function safeFactusFileName(value, invoiceNumber, type, documentLabel = 'factura') {
  const extension = type === 'pdf' ? '.pdf' : '.xml';
  const fallback = `${documentLabel}-${trimSafe(invoiceNumber, 160) || 'factus'}`;
  const base = trimSafe(value || fallback, 220)
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '') || fallback;

  return base.toLowerCase().endsWith(extension)
    ? base
    : `${base}${extension}`;
}

function extractFactusDownloadPayload(data = {}, type = 'pdf') {
  const payload = data?.data?.data || data?.data || data || {};
  const field = type === 'pdf'
    ? 'pdf_base_64_encoded'
    : 'xml_base_64_encoded';
  const encoded = trimSafe(
    payload?.[field] ||
      payload?.base_64_encoded ||
      payload?.base64 ||
      payload?.content,
    60_000_000
  ).replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');

  return {
    encoded,
    fileName: payload?.file_name || payload?.fileName || '',
  };
}

function decodeFactusBase64Document(encoded, type = 'pdf') {
  const value = String(encoded || '').trim();

  if (
    !value ||
    value.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    return null;
  }

  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length) return null;

  if (type === 'pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return null;
  }

  if (type === 'xml') {
    const start = buffer.subarray(0, Math.min(buffer.length, 200))
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trimStart();
    if (!start.startsWith('<')) return null;
  }

  return buffer;
}

async function downloadFactusDocument({
  credentials,
  tokenResult,
  invoiceNumber,
  type,
  resource = 'bills',
}) {
  const normalizedType = type === 'pdf' ? 'pdf' : type === 'xml' ? 'xml' : '';
  const safeNumber = encodeURIComponent(String(invoiceNumber || '').trim());

  if (!safeNumber) {
    return {
      success: false,
      error: 'Número de factura vacío.',
    };
  }

  if (!normalizedType) {
    return {
      success: false,
      status: 422,
      stage: 'document_type',
      error: 'Tipo de documento Factus no soportado.',
    };
  }

  const safeResource = resource === 'credit-notes' ? 'credit-notes' : 'bills';
  const endpoint =
    normalizedType === 'pdf'
      ? `/v2/${safeResource}/${safeNumber}/download-pdf`
      : `/v2/${safeResource}/${safeNumber}/download-xml`;

  const response = await fetchFactus(`${credentials.apiUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      stage: `download_${normalizedType}`,
      error: data?.message || data?.error || `No se pudo descargar ${normalizedType}.`,
      raw: data,
    };
  }

  const payload = extractFactusDownloadPayload(data, normalizedType);
  const buffer = decodeFactusBase64Document(payload.encoded, normalizedType);

  if (!buffer) {
    return {
      success: false,
      status: 502,
      stage: `download_${normalizedType}_invalid`,
      error: `Factus respondió, pero no devolvió un ${normalizedType.toUpperCase()} válido.`,
    };
  }

  return {
    success: true,
    status: response.status,
    provider: 'factus',
    type: normalizedType,
    buffer,
    byteLength: buffer.length,
    contentType: normalizedType === 'pdf' ? 'application/pdf' : 'application/xml; charset=utf-8',
    fileName: safeFactusFileName(
      payload.fileName,
      invoiceNumber,
      normalizedType,
      safeResource === 'credit-notes' ? 'nota-credito' : 'factura'
    ),
  };
}

async function downloadInvoiceDocumentFromFactus({
  providerConfig = {},
  invoiceNumber,
  type,
} = {}) {
  const normalizedType = type === 'pdf' ? 'pdf' : type === 'xml' ? 'xml' : '';

  if (!normalizedType) {
    return {
      success: false,
      provider: 'factus',
      status: 422,
      stage: 'document_type',
      error: 'Solo se pueden descargar documentos PDF o XML de Factus.',
    };
  }

  if (!trimSafe(invoiceNumber, 160)) {
    return {
      success: false,
      provider: 'factus',
      status: 422,
      stage: 'document_number',
      error: 'La factura no tiene número oficial de Factus para descargar el documento.',
    };
  }

  const credentials = getFactusCredentials({ providerConfig });
  const missing = validateCredentials(credentials);

  if (missing.length) {
    return {
      success: false,
      provider: 'factus',
      status: 422,
      stage: 'config_incomplete',
      error: `Configuración Factus incompleta. Faltan: ${missing.join(', ')}.`,
      missing,
    };
  }

  try {
    const tokenResult = await getFactusAccessToken(credentials);

    if (!tokenResult.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'auth',
        ...tokenResult,
      };
    }

    return await downloadFactusDocument({
      credentials,
      tokenResult,
      invoiceNumber,
      type: normalizedType,
      resource: 'bills',
    });
  } catch (error) {
    return {
      success: false,
      provider: 'factus',
      status: 503,
      stage: `download_${normalizedType}`,
      error: error?.name === 'AbortError'
        ? `La descarga ${normalizedType.toUpperCase()} en Factus superó el tiempo de espera.`
        : error?.message || `No fue posible descargar el ${normalizedType.toUpperCase()} de Factus.`,
    };
  }
}

async function downloadCreditNoteDocumentFromFactus({
  providerConfig = {},
  creditNoteNumber,
  type,
} = {}) {
  const normalizedType = type === 'pdf' ? 'pdf' : type === 'xml' ? 'xml' : '';
  if (!normalizedType || !trimSafe(creditNoteNumber, 160)) {
    return {
      success: false,
      provider: 'factus',
      status: 422,
      stage: 'credit_note_document_input',
      error: 'La nota crédito requiere número oficial y tipo PDF o XML.',
    };
  }

  const credentials = getFactusCredentials({ providerConfig });
  const missing = validateCredentials(credentials);
  if (missing.length) {
    return {
      success: false,
      provider: 'factus',
      status: 422,
      stage: 'config_incomplete',
      error: `Configuración Factus incompleta. Faltan: ${missing.join(', ')}.`,
      missing,
    };
  }

  try {
    const tokenResult = await getFactusAccessToken(credentials);
    if (!tokenResult.success) return { success: false, provider: 'factus', stage: 'auth', ...tokenResult };

    return await downloadFactusDocument({
      credentials,
      tokenResult,
      invoiceNumber: creditNoteNumber,
      type: normalizedType,
      resource: 'credit-notes',
    });
  } catch (error) {
    return {
      success: false,
      provider: 'factus',
      status: 503,
      stage: `download_credit_note_${normalizedType}`,
      error: error?.message || `No fue posible descargar el ${normalizedType.toUpperCase()} de la nota crédito.`,
    };
  }
}

module.exports = {
  decodeFactusBase64Document,
  downloadCreditNoteDocumentFromFactus,
  downloadInvoiceDocumentFromFactus,
  extractFactusDownloadPayload,
  getCreditNoteFromFactus,
  getInvoiceFromFactus,
};
