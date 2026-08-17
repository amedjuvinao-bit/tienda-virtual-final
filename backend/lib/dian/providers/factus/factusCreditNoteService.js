'use strict';

const {
  getFactusAccessToken,
  getFactusCredentials,
  validateCredentials,
} = require('./factusAuth');
const {
  extractFactusBillsList,
} = require('./factusInvoiceService');
const {
  buildFactusCreditNotePayload,
} = require('./factusPayloads');

async function getFactusCreditNoteNumberingRangeId({ credentials, tokenResult }) {
  const response = await fetch(
    `${credentials.apiUrl}/v2/numbering-ranges?filter[document]=22&filter[is_active]=1`,
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

  const ranges = extractFactusBillsList(data);

  const activeRange = ranges.find((range) => {
    const documentValue = String(range?.document || '').toLowerCase();
    return (
      Number(range?.id || 0) > 0 &&
      (
        documentValue.includes('nota') ||
        documentValue.includes('crédito') ||
        documentValue.includes('credito') ||
        String(range?.document_code || '') === '22'
      )
    );
  }) || ranges.find((range) => Number(range?.id || 0) > 0);

  return {
    success: response.ok && Number(activeRange?.id || 0) > 0,
    status: response.status,
    id: Number(activeRange?.id || 0),
    data,
    ranges,
    error: response.ok
      ? null
      : data?.message || data?.error || data || `HTTP ${response.status}`,
  };
}

async function postFactusCreditNoteValidate({ credentials, tokenResult, payload }) {
  const response = await fetch(`${credentials.apiUrl}/v2/credit-notes/validate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function extractFactusValidationErrors(data = {}) {
  const candidates = [
    data?.data?.errors,
    data?.errors,
    data?.data?.data?.errors,
  ];
  return candidates.find((value) => value && typeof value === 'object') || {};
}

function summarizeFactusValidationErrors(errors = {}) {
  const messages = [];
  Object.entries(errors || {}).forEach(([field, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((message) => {
      if (message !== undefined && message !== null && message !== '') {
        messages.push(`${field}: ${String(message)}`);
      }
    });
  });
  return messages.slice(0, 12).join(' | ');
}

async function sendCreditNoteToFactus(creditNoteData = {}) {
  try {
    const credentials = getFactusCredentials(creditNoteData);
    const missing = validateCredentials(credentials);

    if (missing.length) {
      return {
        success: false,
        provider: 'factus',
        status: 'config_incomplete',
        error: `Configuración Factus incompleta. Faltan: ${missing.join(', ')}.`,
        missing,
      };
    }

    const tokenResult = await getFactusAccessToken(credentials);

    if (!tokenResult.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'auth_credit_note',
        ...tokenResult,
      };
    }

    const rangeResult = await getFactusCreditNoteNumberingRangeId({
      credentials,
      tokenResult,
    });

    if (!rangeResult.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'credit_note_numbering_range',
        status: rangeResult.status,
        error:
          rangeResult.error ||
          'No se encontró un rango de numeración activo para notas crédito.',
        raw: rangeResult.data,
      };
    }

    const payload = buildFactusCreditNotePayload({
      ...creditNoteData,
      numberingRangeId: rangeResult.id,
    });

    const result = await postFactusCreditNoteValidate({
      credentials,
      tokenResult,
      payload,
    });

    if (!result.ok) {
      const validationErrors = extractFactusValidationErrors(result.data);
      const providerMessage =
        result.data?.message ||
        result.data?.error ||
        `HTTP ${result.status}`;
      const validationSummary = summarizeFactusValidationErrors(validationErrors);
      const detailedMessage = validationSummary
        ? `${providerMessage}: ${validationSummary}`
        : providerMessage;

      const normalizedMessage = String(detailedMessage || '').toLowerCase();

      const isPendingCreditNoteConflict =
        Number(result.status) === 409 &&
        (
          normalizedMessage.includes('nota crédito pendiente') ||
          normalizedMessage.includes('nota credito pendiente')
        );

      return {
        success: false,
        provider: 'factus',
        stage: 'send_credit_note',
        status: result.status,
        error: detailedMessage,
        code: isPendingCreditNoteConflict
          ? 'FACTUS_PENDING_CREDIT_NOTE'
          : 'FACTUS_CREDIT_NOTE_ERROR',
        canRetry: !isPendingCreditNoteConflict,
        requiresSync: isPendingCreditNoteConflict,
        raw: result.data,
        validationErrors,
        payload,
      };
    }

    return {
      success: true,
      provider: 'factus',
      stage: 'send_credit_note',
      status: result.status,
      data: result.data,
      payload,
    };
  } catch (error) {
    console.error('❌ ERROR FACTUS CREDIT NOTE:', error.message);

    return {
      success: false,
      provider: 'factus',
      stage: 'credit_note_exception',
      error: error.message,
    };
  }
}

module.exports = {
  extractFactusValidationErrors,
  postFactusCreditNoteValidate,
  sendCreditNoteToFactus,
  summarizeFactusValidationErrors,
};
