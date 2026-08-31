'use strict';

const {
  buildFactusCreditNotePayload,
  buildFactusInvoicePayload,
  deleteFactusBillByReference,
  getFactusAccessToken,
  getFactusCredentials,
  postFactusCreditNoteValidate,
} = require('./factusProvider');
const {
  BillingConfigurationError,
  buildRuntimeFactusConfig,
} = require('../../billing/billingConfigurationSecurity');

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function toPlain(value) {
  return value?.toObject
    ? value.toObject({ depopulate: true })
    : value && typeof value === 'object'
      ? value
      : {};
}

function runtimeProviderConfig(data = {}) {
  const settings = toPlain(data.settings);
  const billing = toPlain(settings.billing);

  if (billing?.dian?.mode && billing?.electronicProvider) {
    return buildRuntimeFactusConfig(billing);
  }

  return toPlain(data.providerConfig);
}

function validateProviderCredentials(providerConfig = {}) {
  const credentials = getFactusCredentials({ providerConfig });
  const missing = [];

  if (!credentials.apiUrl) missing.push('apiUrl');
  if (!credentials.clientId) missing.push('clientId');
  if (!credentials.clientSecret) missing.push('clientSecret');
  if (!credentials.username) missing.push('username');
  if (!credentials.password) missing.push('password');

  if (missing.length) {
    throw new BillingConfigurationError(
      `Configuración Factus incompleta. Faltan: ${missing.join(', ')}.`,
      'FACTUS_CREDENTIALS_INCOMPLETE',
      422,
      missing
    );
  }

  return credentials;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function postInvoiceValidate({ credentials, tokenResult, payload }) {
  const { response, data } = await fetchJsonWithTimeout(
    `${credentials.apiUrl}/v2/bills/validate`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  return { ok: response.ok, status: response.status, data };
}

function collectProviderErrorText(value, output = [], depth = 0) {
  if (depth > 4 || value === undefined || value === null) return output;

  if (typeof value === 'string' || typeof value === 'number') {
    const message = cleanText(value, 500)
      .replace(/<[^>]*>/g, ' ')
      .replace(
        /\b(authorization|bearer|access[_ -]?token|client[_ -]?secret|password|technical[_ -]?key|software[_ -]?pin)\b\s*[:=]\s*[^\s,;]+/gi,
        '$1: [dato protegido]'
      )
      .replace(/\s+/g, ' ')
      .trim();

    if (message && !output.includes(message)) output.push(message);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectProviderErrorText(item, output, depth + 1));
    return output;
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((item) =>
      collectProviderErrorText(item, output, depth + 1)
    );
  }

  return output;
}

function providerMessage(result = {}) {
  const validationMessages = [];
  [result?.data?.errors, result?.data?.data?.errors].forEach((errors) =>
    collectProviderErrorText(errors, validationMessages)
  );

  if (validationMessages.length) {
    return cleanText(`Factus rechazó la factura: ${validationMessages.join(' ')}`, 1000);
  }

  return (
    result?.data?.message ||
    result?.data?.error ||
    (result?.status ? `HTTP ${result.status}` : 'Factus rechazó el documento.')
  );
}

function isPendingConflict(result = {}, label = 'factura') {
  const message = cleanText(providerMessage(result), 1000).toLowerCase();
  return (
    Number(result.status) === 409 &&
    (message.includes(`${label} pendiente`) ||
      message.includes('documento pendiente'))
  );
}

function extractList(data = {}) {
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.bills)) return data.bills;
  if (Array.isArray(data)) return data;
  return [];
}

function referenceCode(document = {}) {
  return cleanText(
    document.reference_code ||
      document.referenceCode ||
      document.reference ||
      '',
    180
  );
}

function invoiceNumber(document = {}) {
  return cleanText(document.number || document.invoice_number || '', 160);
}

function wasAlreadySentToDian(result = {}) {
  const message = cleanText(result.error || result?.data?.message || '', 500)
    .toLowerCase();
  return message.includes('enviado a la dian');
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function refreshPendingInvoiceUntilSettled({
  credentials,
  tokenResult,
  pending,
  attempts = 6,
  delayMs = 5000,
}) {
  const number = invoiceNumber(pending);
  const expectedReference = referenceCode(pending);

  if (!number) {
    return {
      success: false,
      code: 'FACTUS_PENDING_DIAN_NUMBER_MISSING',
      error:
        'Factus envió el documento a la DIAN, pero no devolvió el número necesario para actualizar su estado.',
    };
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await fetchJsonWithTimeout(
      `${credentials.apiUrl}/v2/bills/${encodeURIComponent(number)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const listed = await listPendingInvoices({ credentials, tokenResult });
    if (!listed.success) {
      return {
        success: false,
        code: listed.code,
        error: listed.error,
      };
    }

    const stillPending = listed.documents.some(
      (document) => referenceCode(document) === expectedReference
    );
    if (!stillPending) {
      return { success: true, number, referenceCode: expectedReference };
    }

    if (attempt < attempts) await wait(delayMs);
  }

  return {
    success: false,
    code: 'FACTUS_PENDING_DIAN_PROCESSING',
    number,
    referenceCode: expectedReference,
    error:
      'Factus todavía está esperando la respuesta de la DIAN para el documento anterior. No se creó otra orden ni otro pago.',
  };
}

function isPendingDocument(document = {}) {
  const status = cleanText(document.status, 60).toLowerCase();
  return (
    document.is_validated === false ||
    document.validated_at === null ||
    document.status === 0 ||
    status === 'pending' ||
    status === 'pendiente'
  );
}

async function listInvoicesByExactReference({ credentials, tokenResult, expectedReference }) {
  const expected = cleanText(expectedReference, 180);
  if (!expected) {
    return {
      success: false,
      status: 400,
      code: 'FACTUS_REFERENCE_REQUIRED',
      error: 'La conciliación requiere una referencia exacta de la factura.',
      documents: [],
    };
  }

  const query = encodeURIComponent(expected);
  const { response, data } = await fetchJsonWithTimeout(
    `${credentials.apiUrl}/v2/bills?filter[reference_code]=${query}&filter[per_page]=100`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      code: 'FACTUS_RECONCILIATION_LOOKUP_FAILED',
      error: data?.message || data?.error || `HTTP ${response.status}`,
      documents: [],
    };
  }

  const documents = extractList(data).filter(
    (document) => referenceCode(document) === expected
  );

  return {
    success: true,
    status: response.status,
    documents,
    data,
  };
}

async function listCreditNotesByExactReference({
  credentials,
  tokenResult,
  expectedReference,
}) {
  const expected = cleanText(expectedReference, 180);
  if (!expected) {
    return {
      success: false,
      status: 400,
      code: 'FACTUS_CREDIT_NOTE_REFERENCE_REQUIRED',
      error: 'La conciliación requiere una referencia exacta de la nota crédito.',
      documents: [],
    };
  }

  const query = encodeURIComponent(expected);
  const { response, data } = await fetchJsonWithTimeout(
    `${credentials.apiUrl}/v2/credit-notes?filter[reference_code]=${query}&filter[per_page]=100`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      code: 'FACTUS_CREDIT_NOTE_RECONCILIATION_LOOKUP_FAILED',
      error: data?.message || data?.error || `HTTP ${response.status}`,
      documents: [],
    };
  }

  return {
    success: true,
    status: response.status,
    documents: extractList(data).filter(
      (document) => referenceCode(document) === expected
    ),
    data,
  };
}

async function listPendingInvoices({ credentials, tokenResult }) {
  const { response, data } = await fetchJsonWithTimeout(
    `${credentials.apiUrl}/v2/bills?filter[status]=0&filter[per_page]=100`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      code: 'FACTUS_PENDING_INVOICE_LOOKUP_FAILED',
      error: data?.message || data?.error || `HTTP ${response.status}`,
      documents: [],
    };
  }

  return {
    success: true,
    status: response.status,
    documents: extractList(data).filter(isPendingDocument),
    data,
  };
}

function isFactusSandboxUrl(value) {
  try {
    return new URL(String(value || '')).hostname ===
      'api-sandbox.factus.com.co';
  } catch {
    return false;
  }
}

async function cleanupSinglePendingInvoiceInSandbox(data = {}) {
  try {
    if (data.confirm !== true) {
      return {
        success: false,
        provider: 'factus',
        stage: 'pending_cleanup_confirmation',
        status: 409,
        code: 'FACTUS_PENDING_CLEANUP_CONFIRMATION_REQUIRED',
        error:
          'La limpieza requiere confirmación explícita y solo puede ejecutarse en Factus habilitación.',
      };
    }

    const providerConfig = runtimeProviderConfig(data);
    const credentials = validateProviderCredentials(providerConfig);

    if (!isFactusSandboxUrl(credentials.apiUrl)) {
      return {
        success: false,
        provider: 'factus',
        stage: 'pending_cleanup_environment',
        status: 409,
        code: 'FACTUS_PENDING_CLEANUP_PRODUCTION_BLOCKED',
        error:
          'La limpieza automática de facturas pendientes está bloqueada fuera de Factus habilitación.',
      };
    }

    const tokenResult = await getFactusAccessToken(credentials);
    if (!tokenResult.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'pending_cleanup_auth',
        ...tokenResult,
      };
    }

    const listed = await listPendingInvoices({
      credentials,
      tokenResult,
    });

    if (!listed.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'pending_cleanup_lookup',
        status: listed.status,
        code: listed.code,
        error: listed.error,
      };
    }

    if (listed.documents.length === 0) {
      return {
        success: true,
        provider: 'factus',
        stage: 'pending_cleanup',
        status: listed.status,
        cleaned: false,
        message: 'Factus habilitación no tiene facturas pendientes.',
      };
    }

    if (listed.documents.length !== 1) {
      return {
        success: false,
        provider: 'factus',
        stage: 'pending_cleanup_ambiguous',
        status: 409,
        code: 'FACTUS_PENDING_CLEANUP_AMBIGUOUS',
        pendingReferences: listed.documents.map(referenceCode).filter(Boolean),
        error:
          'Factus devolvió más de una factura pendiente. No se eliminó ningún documento.',
      };
    }

    const pending = listed.documents[0];
    const pendingReference = referenceCode(pending);

    if (!pendingReference) {
      return {
        success: false,
        provider: 'factus',
        stage: 'pending_cleanup_reference',
        status: 409,
        code: 'FACTUS_PENDING_CLEANUP_REFERENCE_MISSING',
        error:
          'La factura pendiente no tiene una referencia verificable. No se eliminó ningún documento.',
      };
    }

    const deleted = await deleteFactusBillByReference({
      credentials,
      tokenResult,
      referenceCode: pendingReference,
    });

    if (!deleted.success) {
      if (wasAlreadySentToDian(deleted)) {
        const settled = await refreshPendingInvoiceUntilSettled({
          credentials,
          tokenResult,
          pending,
          attempts: positiveInteger(data.settlementAttempts) || 6,
          delayMs: Number.isFinite(Number(data.settlementDelayMs))
            ? Math.max(0, Number(data.settlementDelayMs))
            : 5000,
        });

        if (settled.success) {
          return {
            success: true,
            provider: 'factus',
            stage: 'pending_cleanup_dian_settled',
            status: 200,
            cleaned: false,
            settled: true,
            referenceCode: pendingReference,
            invoiceNumber: settled.number,
            message: 'Factus actualizó el documento que ya había enviado a la DIAN.',
          };
        }

        return {
          success: false,
          provider: 'factus',
          stage: 'pending_cleanup_dian_processing',
          status: 409,
          code: settled.code,
          referenceCode: pendingReference,
          invoiceNumber: settled.number || invoiceNumber(pending),
          error: settled.error,
        };
      }

      return {
        success: false,
        provider: 'factus',
        stage: 'pending_cleanup_delete',
        status: deleted.status,
        code: 'FACTUS_PENDING_CLEANUP_DELETE_FAILED',
        referenceCode: pendingReference,
        error:
          deleted.error ||
          'No fue posible retirar la factura pendiente de Factus habilitación.',
      };
    }

    return {
      success: true,
      provider: 'factus',
      stage: 'pending_cleanup',
      status: deleted.status,
      cleaned: true,
      referenceCode: pendingReference,
      message:
        `Se retiró la factura no validada ${pendingReference} de Factus habilitación.`,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'factus',
      stage: 'pending_cleanup_exception',
      status: Number(error?.status || 503),
      code: error?.code || 'FACTUS_PENDING_CLEANUP_ERROR',
      error:
        error?.message ||
        'No fue posible revisar las facturas pendientes de Factus habilitación.',
    };
  }
}

async function findExactPendingInvoice({ credentials, tokenResult, expectedReference }) {
  const listed = await listInvoicesByExactReference({
    credentials,
    tokenResult,
    expectedReference,
  });

  if (!listed.success) return listed;

  return {
    success: true,
    status: listed.status,
    pending: listed.documents.find(isPendingDocument) || null,
  };
}

async function findInvoiceByReferenceFromFactus(data = {}) {
  try {
    const providerConfig = runtimeProviderConfig(data);
    const credentials = validateProviderCredentials(providerConfig);
    const tokenResult = await getFactusAccessToken(credentials);

    if (!tokenResult.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'reconciliation_auth',
        ...tokenResult,
      };
    }

    const listed = await listInvoicesByExactReference({
      credentials,
      tokenResult,
      expectedReference: data.referenceCode,
    });

    if (!listed.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'reconciliation_lookup',
        status: listed.status,
        code: listed.code,
        error: listed.error,
      };
    }

    if (listed.documents.length > 1) {
      return {
        success: false,
        provider: 'factus',
        stage: 'reconciliation_ambiguous',
        status: 409,
        code: 'FACTUS_RECONCILIATION_AMBIGUOUS',
        error:
          'Factus devolvió más de una factura con la misma referencia. Se requiere revisión manual para evitar asociar el documento equivocado.',
      };
    }

    return {
      success: true,
      provider: 'factus',
      stage: 'reconciliation_lookup',
      status: listed.status,
      found: listed.documents.length === 1,
      document: listed.documents[0] || null,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'factus',
      stage: 'reconciliation_exception',
      status: Number(error?.status || 503),
      code: error?.code || 'FACTUS_RECONCILIATION_ERROR',
      error: error?.message || 'No fue posible conciliar la factura con Factus.',
    };
  }
}

async function findCreditNoteByReferenceFromFactus(data = {}) {
  try {
    const providerConfig = runtimeProviderConfig(data);
    const credentials = validateProviderCredentials(providerConfig);
    const tokenResult = await getFactusAccessToken(credentials);

    if (!tokenResult.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'credit_note_reconciliation_auth',
        ...tokenResult,
      };
    }

    const listed = await listCreditNotesByExactReference({
      credentials,
      tokenResult,
      expectedReference: data.referenceCode,
    });

    if (!listed.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'credit_note_reconciliation_lookup',
        status: listed.status,
        code: listed.code,
        error: listed.error,
      };
    }

    if (listed.documents.length > 1) {
      return {
        success: false,
        provider: 'factus',
        stage: 'credit_note_reconciliation_ambiguous',
        status: 409,
        code: 'FACTUS_CREDIT_NOTE_RECONCILIATION_AMBIGUOUS',
        error:
          'Factus devolvió más de una nota crédito con la misma referencia. Se requiere revisión manual.',
      };
    }

    return {
      success: true,
      provider: 'factus',
      stage: 'credit_note_reconciliation_lookup',
      status: listed.status,
      found: listed.documents.length === 1,
      document: listed.documents[0] || null,
      data: listed.data,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'factus',
      stage: 'credit_note_reconciliation_exception',
      status: Number(error?.status || 503),
      code: error?.code || 'FACTUS_CREDIT_NOTE_RECONCILIATION_ERROR',
      error: error?.message || 'No fue posible conciliar la nota crédito con Factus.',
    };
  }
}

async function sendInvoiceToFactus(invoiceData = {}) {
  try {
    const providerConfig = runtimeProviderConfig(invoiceData);
    const numberingRangeId = positiveInteger(providerConfig.numberingRangeId);

    if (!numberingRangeId) {
      return {
        success: false,
        provider: 'factus',
        status: 409,
        stage: 'invoice_numbering_range',
        code: 'FACTUS_INVOICE_NUMBERING_RANGE_REQUIRED',
        error:
          'No hay un rango oficial de facturas sincronizado para este ambiente y estas credenciales.',
      };
    }

    const credentials = validateProviderCredentials(providerConfig);
    const tokenResult = await getFactusAccessToken(credentials);
    if (!tokenResult.success) {
      return { success: false, provider: 'factus', stage: 'auth', ...tokenResult };
    }

    const payload = {
      ...buildFactusInvoicePayload(invoiceData),
      numbering_range_id: numberingRangeId,
    };
    let result = await postInvoiceValidate({ credentials, tokenResult, payload });

    if (!result.ok && isPendingConflict(result, 'factura')) {
      const exact = await findExactPendingInvoice({
        credentials,
        tokenResult,
        expectedReference: payload.reference_code,
      });

      if (!exact.success) {
        return {
          success: false,
          provider: 'factus',
          stage: 'list_pending_invoices',
          status: exact.status,
          error: exact.error,
        };
      }

      if (!exact.pending) {
        return {
          success: false,
          provider: 'factus',
          stage: 'pending_invoice_not_found',
          status: result.status,
          code: 'FACTUS_PENDING_INVOICE_NOT_OWNED',
          error:
            `Factus informa una factura pendiente, pero no existe una pendiente con la referencia exacta ${payload.reference_code}. No se eliminó ningún documento.`,
        };
      }

      const pendingReference = referenceCode(exact.pending);
      const deleted = await deleteFactusBillByReference({
        credentials,
        tokenResult,
        referenceCode: pendingReference,
      });

      if (!deleted.success) {
        return {
          success: false,
          provider: 'factus',
          stage: 'delete_real_pending_invoice',
          status: deleted.status,
          error:
            deleted.error ||
            'No se pudo eliminar la factura pendiente correspondiente a la misma orden.',
        };
      }

      result = await postInvoiceValidate({ credentials, tokenResult, payload });
    }

    if (!result.ok) {
      return {
        success: false,
        provider: 'factus',
        stage: 'send_invoice',
        status: result.status,
        error: providerMessage(result),
        raw: result.data,
      };
    }

    const invoiceNumber = result?.data?.data?.number || '';
    return {
      success: true,
      provider: 'factus',
      stage: 'send_invoice',
      status: result.status,
      data: { ...result.data, invoiceNumber },
      payload,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'factus',
      status: Number(error?.status || 503),
      stage: 'invoice_exception',
      code: error?.code || 'FACTUS_INVOICE_ERROR',
      error: error?.message || 'No fue posible emitir la factura en Factus.',
    };
  }
}

async function sendCreditNoteToFactus(creditNoteData = {}) {
  try {
    const providerConfig = runtimeProviderConfig(creditNoteData);
    const numberingRangeId = positiveInteger(
      providerConfig.creditNoteNumberingRangeId
    );

    if (!numberingRangeId) {
      return {
        success: false,
        provider: 'factus',
        status: 409,
        stage: 'credit_note_numbering_range',
        code: 'FACTUS_CREDIT_NOTE_NUMBERING_RANGE_REQUIRED',
        error:
          'No hay un rango oficial de notas crédito sincronizado para este ambiente y estas credenciales.',
      };
    }

    const credentials = validateProviderCredentials(providerConfig);
    const tokenResult = await getFactusAccessToken(credentials);
    if (!tokenResult.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'auth_credit_note',
        ...tokenResult,
      };
    }

    const payload = buildFactusCreditNotePayload({
      ...creditNoteData,
      providerConfig,
      numberingRangeId,
    });
    const result = await postFactusCreditNoteValidate({
      credentials,
      tokenResult,
      payload,
    });

    if (!result.ok) {
      const pending = isPendingConflict(result, 'nota crédito') ||
        isPendingConflict(result, 'nota credito');
      return {
        success: false,
        provider: 'factus',
        stage: 'send_credit_note',
        status: result.status,
        error: providerMessage(result),
        code: pending
          ? 'FACTUS_PENDING_CREDIT_NOTE'
          : 'FACTUS_CREDIT_NOTE_ERROR',
        canRetry: !pending,
        requiresSync: pending,
        raw: result.data,
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
    return {
      success: false,
      provider: 'factus',
      status: Number(error?.status || 503),
      stage: 'credit_note_exception',
      code: error?.code || 'FACTUS_CREDIT_NOTE_ERROR',
      error: error?.message || 'No fue posible emitir la nota crédito en Factus.',
    };
  }
}

module.exports = {
  cleanupSinglePendingInvoiceInSandbox,
  findCreditNoteByReferenceFromFactus,
  findInvoiceByReferenceFromFactus,
  providerMessage,
  sendCreditNoteToFactus,
  sendInvoiceToFactus,
};
