// backend/lib/dian/providers/factusProvider.js

let factusTokenCache = {
  key: '',
  accessToken: '',
  tokenType: 'Bearer',
  expiresAt: 0,
};

async function fetchFactus(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function trimSafe(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function isValidEmail(value) {
  const email = trimSafe(value, 180);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toMoney(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

function resolveFactusBaseUrl(providerConfig = {}) {
  const fromPanel = trimSafe(providerConfig.apiUrl, 300);
  const fromEnv = trimSafe(process.env.FACTUS_API_URL, 300);

  const base = fromPanel || fromEnv || 'https://api-sandbox.factus.com.co';
  return base.replace(/\/+$/, '');
}

function getFactusCredentials(invoiceData = {}) {
  const providerConfig = invoiceData?.providerConfig || {};

  return {
    apiUrl: resolveFactusBaseUrl(providerConfig),
    clientId: trimSafe(providerConfig.clientId || process.env.FACTUS_CLIENT_ID, 300),
    clientSecret: trimSafe(providerConfig.clientSecret || process.env.FACTUS_CLIENT_SECRET, 500),
    username: trimSafe(providerConfig.username || process.env.FACTUS_USERNAME, 300),
    password: trimSafe(providerConfig.password || process.env.FACTUS_PASSWORD, 500),
  };
}

function validateCredentials(credentials) {
  const missing = [];

  if (!credentials.apiUrl) missing.push('apiUrl');
  if (!credentials.clientId) missing.push('clientId');
  if (!credentials.clientSecret) missing.push('clientSecret');
  if (!credentials.username) missing.push('username');
  if (!credentials.password) missing.push('password');

  return missing;
}

function buildTokenCacheKey(credentials) {
  return [
    credentials.apiUrl,
    credentials.clientId,
    credentials.username,
  ].join('|');
}

function getCachedFactusToken(credentials) {
  const now = Date.now();
  const cacheKey = buildTokenCacheKey(credentials);

  if (
    factusTokenCache.key === cacheKey &&
    factusTokenCache.accessToken &&
    factusTokenCache.expiresAt > now + 60000
  ) {
    return {
      success: true,
      status: 200,
      tokenType: factusTokenCache.tokenType || 'Bearer',
      accessToken: factusTokenCache.accessToken,
      fromCache: true,
    };
  }

  return null;
}

function saveFactusTokenInCache(credentials, tokenResult) {
  const expiresInSeconds = Number(tokenResult.expiresIn || 0);
  const safeExpiresInMs =
    Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? expiresInSeconds * 1000
      : 50 * 60 * 1000;

  factusTokenCache = {
    key: buildTokenCacheKey(credentials),
    accessToken: tokenResult.accessToken,
    tokenType: tokenResult.tokenType || 'Bearer',
    expiresAt: Date.now() + safeExpiresInMs,
  };
}

async function getFactusAccessToken(credentials) {
  const cachedToken = getCachedFactusToken(credentials);

  if (cachedToken) {
    return cachedToken;
  }

  const body = new URLSearchParams();

  body.append('grant_type', 'password');
  body.append('client_id', credentials.clientId);
  body.append('client_secret', credentials.clientSecret);
  body.append('username', credentials.username);
  body.append('password', credentials.password);

  const response = await fetchFactus(`${credentials.apiUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.access_token) {
    return {
      success: false,
      status: response.status,
      error:
        data?.message ||
        data?.error ||
        data ||
        `No se pudo obtener token Factus. HTTP ${response.status}`,
      raw: data,
    };
  }

  const tokenResult = {
    success: true,
    status: response.status,
    tokenType: data.token_type || 'Bearer',
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresIn: data.expires_in || null,
    fromCache: false,
  };

  saveFactusTokenInCache(credentials, tokenResult);

  return tokenResult;
}

function isFactusPendingBillConflict(data, status) {
  const message = String(data?.message || data?.error || '').toLowerCase();

  return (
    Number(status) === 409 &&
    message.includes('factura pendiente') ||
    message.includes('nota crédito pendiente') ||
    message.includes('nota credito pendiente')
      );
}

function extractFactusBillsList(data) {
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.bills)) return data.bills;
  if (Array.isArray(data)) return data;
  return [];
}

function getBillReferenceCode(bill = {}) {
  return (
    bill.reference_code ||
    bill.referenceCode ||
    bill.reference ||
    bill.number ||
    bill.code ||
    bill.id ||
    ''
  );
}

function isPendingFactusBill(bill = {}) {
  const text = JSON.stringify(bill).toLowerCase();

  return (
    text.includes('pendiente') ||
    text.includes('pending') ||
    text.includes('no validada') ||
    text.includes('not validated') ||
    bill.is_validated === false ||
    bill.validated_at === null ||
    bill.status === 0
  );
}

async function listFactusBills({ credentials, tokenResult }) {
  const response = await fetch(`${credentials.apiUrl}/v2/bills?per_page=20`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));

  return {
    success: response.ok,
    status: response.status,
    data,
    bills: extractFactusBillsList(data),
    error: response.ok
      ? null
      : data?.message || data?.error || data || `HTTP ${response.status}`,
  };
}

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

async function deleteFactusBillByReference({ credentials, tokenResult, referenceCode }) {
  const safeReference = encodeURIComponent(String(referenceCode || '').trim());

  if (!safeReference) {
    return {
      success: false,
      status: 'reference_missing',
      error: 'No hay reference_code para eliminar la factura pendiente.',
    };
  }

  const response = await fetch(
    `${credentials.apiUrl}/v2/bills/destroy/reference/${safeReference}`,
    {
      method: 'DELETE',
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
    status: response.status,
    data,
    error: response.ok
      ? null
      : data?.message || data?.error || data || `HTTP ${response.status}`,
  };
}

function buildFactusInvoicePayload(invoiceData = {}) {
  const order = invoiceData?.order || {};
  const transaction = invoiceData?.transaction || {};
  const settings = invoiceData?.settings || {};
  const fiscalInfo = settings?.billing?.fiscalInfo || {};
  const customer = order?.customer || {};
  const orderItems = Array.isArray(order?.items) ? order.items : [];

  const calculatedItemsTotal = orderItems.reduce((acc, item) => {
    const quantity = toNumber(item?.quantity ?? item?.qty ?? 1, 1);
    const price = toNumber(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0, 0);

    return acc + quantity * price;
  }, 0);

  const subtotal = toMoney(order?.subtotal || calculatedItemsTotal);
  const shipping = toMoney(order?.shipping || 0);
  const ivaAmount = toMoney(order?.taxes?.iva?.amount || 0);
  const ivaPercent = toMoney(order?.taxes?.iva?.percent || 0);
  const total = toMoney(order?.total || subtotal + shipping + ivaAmount);

  const hasIva = ivaPercent > 0 && ivaAmount > 0;
  const ivaRate = hasIva ? ivaPercent.toFixed(2) : '0.00';

  const items = orderItems.map((item) => {
    const quantity = toNumber(item?.quantity ?? item?.qty ?? 1, 1);
    const price = toMoney(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0);

    return {
      code_reference: String(item?.productId || item?.product || item?._id || item?.title || 'ITEM'),
      name: String(item?.title || 'Producto'),
      quantity,
      discount_rate: 0,
      price,

      unit_measure_code: '94',
      standard_code: '999',
      taxes: [
        {
          code: '01',
          rate: ivaRate,
        },
      ],

      tax_rate: ivaRate,
      unit_measure_id: 70,
      standard_code_id: 1,
      is_excluded: !hasIva,
      tribute_id: 1,
      withholding_taxes: [],
    };
  });

  if (shipping > 0) {
    items.push({
      code_reference: 'ENVIO',
      name: 'Servicio de envío',
      quantity: 1,
      discount_rate: 0,
      price: shipping,

      unit_measure_code: '94',
      standard_code: '999',
      taxes: [
        {
          code: '01',
          rate: '0.00',
        },
      ],

      tax_rate: '0.00',
      unit_measure_id: 70,
      standard_code_id: 1,
      is_excluded: true,
      tribute_id: 1,
      withholding_taxes: [],
    });
  }

  const paymentMethodType =
    String(
      order?.payment?.methodType ||
      order?.payment?.method ||
      order?.payment?.methodLabel ||
      order?.payment?.rawMethod?.type ||
      order?.paymentMethodType ||
      order?.payment_method_type ||
      transaction?.payment_method_type ||
      transaction?.payment_method?.type ||
      ''
    )
      .trim()
      .toUpperCase();

  let factusPaymentMethodCode = '10';

  if (
    paymentMethodType.includes('DAVIPLATA') ||
    paymentMethodType.includes('NEQUI') ||
    paymentMethodType.includes('PSE') ||
    paymentMethodType.includes('BANCOLOMBIA') ||
    paymentMethodType.includes('TRANSFER')
  ) {
    factusPaymentMethodCode = '47';
  } else if (
    paymentMethodType.includes('DEBIT')
  ) {
    factusPaymentMethodCode = '49';
  } else if (
    paymentMethodType.includes('CARD') ||
    paymentMethodType.includes('CREDIT') ||
    paymentMethodType.includes('TARJETA')
  ) {
    factusPaymentMethodCode = '48';
  }

  const customerEmail =
    isValidEmail(customer?.email)
      ? trimSafe(customer.email, 180)
      : isValidEmail(customer?.emailOrPhone)
        ? trimSafe(customer.emailOrPhone, 180)
        : isValidEmail(fiscalInfo?.billingEmail)
          ? trimSafe(fiscalInfo.billingEmail, 180)
          : 'cliente.pruebas@factus.com.co';

  const customerMunicipalityId = trimSafe(
    customer?.municipalityId ||
    customer?.municipality_id ||
    '',
    30
  );

  const fiscalBusinessName = trimSafe(
    fiscalInfo?.businessName ||
    fiscalInfo?.company ||
    fiscalInfo?.legalName ||
    fiscalInfo?.legalRepresentative ||
    fiscalInfo?.representativeName ||
    '',
    180
  );

  return {
    reference_code: String(order?.orderNumber || order?._id || `ORDER-${Date.now()}`),
    document: '01',
    send_email: false,
    observation: 'Factura generada desde tienda virtual.',

    customer: {
      identification: String(customer?.id || '222222222222'),

      identification_document_code: '13',
      identification_document_id: 3,

      dv: '',

      company: fiscalBusinessName,
      trade_name: fiscalBusinessName,
      graphic_representation_name: fiscalBusinessName,

      names:
        [customer?.name, customer?.lastname]
          .filter(Boolean)
          .join(' ')
          .trim() || 'Cliente final',

      address: String(customer?.address || 'Dirección no registrada'),

      email: customerEmail,

      phone: String(customer?.phone || '3000000000'),

      legal_organization_id: 2,
      tribute_id: 21,

      merchant_registration: trimSafe(
        fiscalInfo?.nit ||
        fiscalInfo?.taxId ||
        fiscalInfo?.taxIdentification ||
        '',
        80
      ),

      municipality_code: customerMunicipalityId || null,
    },
    payment_details: [
      {
        payment_form: '1',
        payment_method_code: factusPaymentMethodCode,
        amount: total.toFixed(2),
      },
    ],

    items,

    totals: {
      subtotal,
      shipping,
      iva: ivaAmount,
      total,
    },
  };
}

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

function buildFactusCreditNotePayload({
  electronicInvoice = {},
  order = {},
  settings = {},
  reasonCode = '1',
  reasonText = 'Devolución de factura',
  type = 'total',
  selectedItems = [],
  billNumber = '',
  numberingRangeId = 0,
}) {
  const invoiceNumber =
    billNumber ||
    electronicInvoice?.invoiceNumber ||
    electronicInvoice?.provider?.number ||
    electronicInvoice?.provider?.raw?.number ||
    '';

  const resolvedNumberingRangeId = Number(
    numberingRangeId ||
      settings?.billing?.electronicProvider?.creditNoteNumberingRangeId ||
      settings?.billing?.electronicProvider?.numberingRangeId ||
      settings?.billing?.dianResolution?.creditNoteNumberingRangeId ||
      settings?.billing?.dianResolution?.numberingRangeId ||
      0
    
  );

  const customer = order?.customer || {};

  const orderItems = Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.cart)
      ? order.cart
      : [];

  const itemsSource =
    type === 'partial' && selectedItems.length
      ? selectedItems
      : orderItems;

  const items = itemsSource.map((item) => {
    const quantity = toNumber(
      item?.quantity ?? item?.qty ?? 1,
      1
    );

    const price = toMoney(
      item?.price ??
        item?.unitPrice ??
        item?.priceNumber ??
        0
    );

    const taxRate = toMoney(
      item?.taxRate ??
        item?.tax_rate ??
        order?.taxes?.iva?.percent ??
        0
    ).toFixed(2);

    const subtotalLine = toMoney(quantity * price);

    const taxAmount =
      Number(taxRate) > 0
        ? toMoney(subtotalLine * (Number(taxRate) / 100))
        : 0;

    return {
      code_reference: String(
        item?.productId ||
          item?.product ||
          item?._id ||
          item?.title ||
          'ITEM'
      ),

      name: String(item?.title || item?.name || 'Producto'),

      quantity,

      discount_rate: 0,

      price,

      tax_rate: taxRate,

      unit_measure_code: '94',

      standard_code: '999',

      taxes: [
        {
          code: '01',
          rate: taxRate,
          base: subtotalLine.toFixed(2),
          amount: taxAmount.toFixed(2),
        },
      ],

      is_excluded: Number(taxRate) <= 0,

      withholding_taxes: [],
    };
  });

  const subtotal = toMoney(
    items.reduce((acc, item) => {
      return acc + item.quantity * item.price;
    }, 0)
  );

  const ivaPercent = toMoney(
    order?.taxes?.iva?.percent || 0
  );

  const ivaAmount =
    ivaPercent > 0
      ? toMoney(subtotal * (ivaPercent / 100))
      : 0;

  const total = toMoney(subtotal + ivaAmount);

  const payload = {
    reference_code: `NC-${order?.orderNumber}-${Date.now()}`,

    bill_number: invoiceNumber,

    correction_concept_code: String(reasonCode),

    customization_id: '20',

    observation: reasonText,

    customer: {
      identification: String(customer?.id || ''),

      identification_document_code: '13',

      names:
        [customer?.name, customer?.lastname]
          .filter(Boolean)
          .join(' ')
          .trim(),

      email: customer?.email || customer?.emailOrPhone || '',
      phone: customer?.phone || '',
      address: customer?.address || '',
    },

    payment_details: [
      {
        payment_form: '1',
        payment_method_code: '10',
        amount: total.toFixed(2),
      },
    ],

    items,
  };

  payload.numbering_range_id = resolvedNumberingRangeId;

  return payload;
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

    console.log(
      '🧾 FACTUS CREDIT NOTE PAYLOAD:',
      JSON.stringify(payload, null, 2)
    );

    const result = await postFactusCreditNoteValidate({
      credentials,
      tokenResult,
      payload,
    });

    if (!result.ok) {
      console.log(
        '❌ FACTUS CREDIT NOTE VALIDATION FULL:',
        
        JSON.stringify(result.data, null, 2)
        
      );
      console.log('❌ FACTUS FULL RESULT OBJECT:', result);

     const providerMessage =
        result.data?.message ||
        result.data?.error ||
        `HTTP ${result.status}`;

      const normalizedMessage = String(providerMessage || '').toLowerCase();

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
        error: providerMessage,
        code: isPendingCreditNoteConflict
          ? 'FACTUS_PENDING_CREDIT_NOTE'
          : 'FACTUS_CREDIT_NOTE_ERROR',
        canRetry: !isPendingCreditNoteConflict,
        requiresSync: isPendingCreditNoteConflict,
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
    console.error('❌ ERROR FACTUS CREDIT NOTE:', error.message);

    return {
      success: false,
      provider: 'factus',
      stage: 'credit_note_exception',
      error: error.message,
    };
  }
}

async function downloadFactusDocument({ credentials, tokenResult, invoiceNumber, type }) {
  const safeNumber = encodeURIComponent(String(invoiceNumber || '').trim());

  if (!safeNumber) {
    return {
      success: false,
      error: 'Número de factura vacío.',
    };
  }

  const endpoint =
    type === 'pdf'
      ? `/v2/bills/${safeNumber}/download-pdf`
      : `/v2/bills/${safeNumber}/download-xml`;

  const response = await fetch(`${credentials.apiUrl}${endpoint}`, {
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
      error: data?.message || data?.error || `No se pudo descargar ${type}.`,
      raw: data,
    };
  }

  return {
    success: true,
    status: response.status,
    data,
  };
}

async function postFactusInvoiceValidate({ credentials, tokenResult, payload }) {
  const response = await fetch(`${credentials.apiUrl}/v2/bills/validate`, {
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

async function sendInvoiceToFactus(invoiceData) {
  try {
    const credentials = getFactusCredentials(invoiceData);
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
        stage: 'auth',
        ...tokenResult,
      };
    }

    const payload = buildFactusInvoicePayload(invoiceData);

    console.log('🧾 FACTUS PAYLOAD RESUMEN:', JSON.stringify({
      reference_code: payload.reference_code,
      customer: payload.customer,
      payment_details: payload.payment_details,
      totals: payload.totals,
      items: payload.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        tax_rate: item.tax_rate,
        is_excluded: item.is_excluded,
      })),
    }, null, 2));

    let result = await postFactusInvoiceValidate({
      credentials,
      tokenResult,
      payload,
    });

    if (!result.ok && isFactusPendingBillConflict(result.data, result.status)) {
      console.log('⚠️ FACTUS: factura pendiente detectada. Consultando últimas facturas...');

      const listResult = await listFactusBills({
        credentials,
        tokenResult,
      });

      console.log('📋 FACTUS LIST BILLS RESULT:', JSON.stringify({
        success: listResult.success,
        status: listResult.status,
        totalFound: listResult.bills.length,
        error: listResult.error,
        bills: listResult.bills.map((bill) => ({
          id: bill.id,
          number: bill.number,
          reference_code: getBillReferenceCode(bill),
          status: bill.status,
          validated_at: bill.validated_at,
          is_validated: bill.is_validated,
        })),
      }, null, 2));

      if (!listResult.success) {
        return {
          success: false,
          provider: 'factus',
          stage: 'list_pending_invoices',
          status: listResult.status,
          error: listResult.error || 'No se pudieron consultar las facturas en Factus.',
          raw: {
            originalValidation: result.data,
            listResult: listResult.data,
          },
        };
      }

      const expectedReferenceCode = String(payload.reference_code || '').trim();
      const pendingBill = listResult.bills.find((bill) => {
        const referenceCode = String(getBillReferenceCode(bill) || '').trim();
        return (
          referenceCode &&
          referenceCode === expectedReferenceCode &&
          isPendingFactusBill(bill)
        );
      });

      if (!pendingBill) {
        return {
          success: false,
          provider: 'factus',
          stage: 'pending_invoice_not_found',
          status: result.status,
          error: `Factus informa una factura pendiente, pero no se encontró una pendiente con la referencia ${expectedReferenceCode}. No se eliminó ningún otro documento.`,
          raw: {
            originalValidation: result.data,
            bills: listResult.bills,
          },
        };
      }

      const pendingReferenceCode = getBillReferenceCode(pendingBill);

      console.log('🧾 FACTUS: factura pendiente localizada.', {
        pendingReferenceCode,
        pendingBill,
      });

      const deleteResult = await deleteFactusBillByReference({
        credentials,
        tokenResult,
        referenceCode: pendingReferenceCode,
      });

      console.log('🧹 FACTUS DELETE REAL PENDING RESULT:', JSON.stringify(deleteResult, null, 2));

      if (deleteResult.success) {
        console.log('🔁 FACTUS: reintentando envío después de eliminar factura pendiente real...', {
          reference_code: payload.reference_code,
        });

        result = await postFactusInvoiceValidate({
          credentials,
          tokenResult,
          payload,
        });
      } else {
        return {
          success: false,
          provider: 'factus',
          stage: 'delete_real_pending_invoice',
          status: deleteResult.status,
          error: deleteResult.error || 'No se pudo eliminar la factura pendiente real en Factus.',
          raw: {
            originalValidation: result.data,
            pendingBill,
            deleteResult,
          },
        };
      }
    }

    if (!result.ok) {
      console.log(
        '❌ FACTUS VALIDATION FULL:',
        JSON.stringify(result.data, null, 2)
      );

      return {
        success: false,
        provider: 'factus',
        stage: 'send_invoice',
        status: result.status,
        error:
          result.data?.message ||
          result.data?.error ||
          result.data ||
          `HTTP ${result.status}`,
        raw: result.data,
      };
    }

    const invoiceNumber =
      result?.data?.data?.number || '';

    const pdfDownload = await downloadFactusDocument({
      credentials,
      tokenResult,
      invoiceNumber,
      type: 'pdf',
    });

    const xmlDownload = await downloadFactusDocument({
      credentials,
      tokenResult,
      invoiceNumber,
      type: 'xml',
    });

    console.log('📄 FACTUS PDF DOWNLOAD:', pdfDownload);
    console.log('📄 FACTUS XML DOWNLOAD:', xmlDownload);

    return {
      success: true,
      provider: 'factus',
      stage: 'send_invoice',
      status: result.status,

      data: {
        ...result.data,

        invoiceNumber,

        downloads: {
          pdf: {
            success: false,
            error: 'No descargado todavía',
          },

          xml: {
            success: false,
            error: 'No descargado todavía',
          },
        },
      },
    };
  } catch (error) {
    console.error('❌ ERROR FACTUS:', error.message);

    return {
      success: false,
      provider: 'factus',
      error: error.message,
    };
  }
}

module.exports = {
  sendInvoiceToFactus,
  sendCreditNoteToFactus,
  getInvoiceFromFactus,
  getCreditNoteFromFactus,
  deleteFactusBillByReference,
  getFactusCredentials,
  getFactusAccessToken,
  postFactusCreditNoteValidate,
};
