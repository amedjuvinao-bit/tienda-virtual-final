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

const FACTUS_DOCUMENT_CODES = Object.freeze({
  RC: '11',
  TI: '12',
  CC: '13',
  CE: '22',
  NIT: '31',
  PP: '41',
  PASAPORTE: '41',
  PPT: '48',
});

function normalizeFactusDocumentCode(value) {
  const normalized = trimSafe(value, 30).toUpperCase();

  if (FACTUS_DOCUMENT_CODES[normalized]) return FACTUS_DOCUMENT_CODES[normalized];
  if (Object.values(FACTUS_DOCUMENT_CODES).includes(normalized)) return normalized;

  return '13';
}

function normalizeFactusCountryCode(value) {
  const normalized = trimSafe(value, 80).toUpperCase();

  if (normalized === 'COLOMBIA') return 'CO';
  if (/^[A-Z]{2,3}$/.test(normalized)) return normalized;

  return 'CO';
}

function normalizeFactusIdentification(value, documentCode, dv) {
  const raw = trimSafe(value, 40);
  let normalized = raw.replace(/[.\-\s]/g, '');
  const safeDv = trimSafe(dv, 1);

  if (
    documentCode === '31' &&
    /^\d$/.test(safeDv) &&
    new RegExp(`[-\s]${safeDv}$`).test(raw) &&
    normalized.endsWith(safeDv)
  ) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function buildFactusCustomer(order = {}) {
  const customer = order?.customer || {};
  const billing = order?.billing || {};
  const personType = trimSafe(billing?.personType || customer?.personType || 'natural', 30).toLowerCase();
  const isCompany = personType === 'juridica';
  const documentCode = normalizeFactusDocumentCode(
    billing?.documentType || customer?.documentType || 'CC'
  );
  const rawIdentification = normalizeFactusIdentification(
    billing?.documentNumber ||
      billing?.identification ||
      billing?.id ||
      customer?.documentNumber ||
      customer?.identification ||
      customer?.id ||
      '',
    documentCode,
    billing?.dv || customer?.dv
  );
  const firstName = trimSafe(billing?.firstName || billing?.name || customer?.name, 100);
  const lastName = trimSafe(billing?.lastName || billing?.lastname || customer?.lastname, 100);
  const naturalName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const isPosConsumerFinal =
    !rawIdentification &&
    String(order?.source || '').trim().toLowerCase() === 'pos' &&
    /consumidor final/i.test(naturalName);
  const identification = isPosConsumerFinal ? '222222222222' : rawIdentification;
  const businessName = trimSafe(
    billing?.businessName || billing?.company || customer?.businessName || '',
    180
  );
  const countryCode = normalizeFactusCountryCode(
    billing?.countryCode || billing?.country || customer?.countryCode || customer?.country
  );
  const municipalityCode = trimSafe(
    billing?.municipalityCode ||
      billing?.cityCode ||
      billing?.municipalityId ||
      customer?.municipalityId ||
      customer?.municipality_id ||
      '',
    30
  );
  const emailCandidate = billing?.email || customer?.email || customer?.emailOrPhone || '';

  const factusCustomer = {
    identification_document_code: documentCode,
    identification,
    legal_organization_code: isCompany ? '1' : '2',
    tribute_code: trimSafe(billing?.tributeCode || customer?.tributeCode || 'ZZ', 10).toUpperCase() || 'ZZ',
    address: trimSafe(billing?.address || customer?.address || '', 180),
    email: isValidEmail(emailCandidate) ? trimSafe(emailCandidate, 180) : '',
    phone: trimSafe(billing?.phone || customer?.phone || '', 40),
    country_code: countryCode,
  };

  if (documentCode === '31' && /^\d$/.test(trimSafe(billing?.dv || customer?.dv, 1))) {
    factusCustomer.dv = trimSafe(billing?.dv || customer?.dv, 1);
  }

  if (isCompany) {
    factusCustomer.company = businessName;
    if (businessName) factusCustomer.trade_name = businessName;
  } else {
    factusCustomer.names = naturalName || (isPosConsumerFinal ? 'Consumidor final' : '');
  }

  if (countryCode === 'CO' && municipalityCode) {
    factusCustomer.municipality_code = municipalityCode;
  }

  return factusCustomer;
}

function allocateFactusDiscounts(orderItems = [], totalDiscount = 0) {
  const lines = orderItems.map((item) => {
    const quantity = Math.max(0, toNumber(item?.quantity ?? item?.qty ?? 0, 0));
    const price = Math.max(0, toNumber(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0, 0));
    return Math.round(quantity * price * 100);
  });
  const subtotalCents = lines.reduce((sum, value) => sum + value, 0);
  let remainingCents = Math.min(Math.round(toMoney(totalDiscount) * 100), subtotalCents);

  return lines.map((lineCents, index) => {
    if (remainingCents <= 0 || subtotalCents <= 0) return 0;
    const isLast = index === lines.length - 1;
    const allocated = isLast
      ? Math.min(lineCents, remainingCents)
      : Math.min(
          lineCents,
          remainingCents,
          Math.round((Math.round(toMoney(totalDiscount) * 100) * lineCents) / subtotalCents)
        );
    remainingCents -= allocated;
    return allocated / 100;
  });
}

function buildFactusInvoicePayload(invoiceData = {}) {
  const order = invoiceData?.order || {};
  const transaction = invoiceData?.transaction || {};
  const orderItems = Array.isArray(order?.items) ? order.items : [];

  const calculatedItemsTotal = orderItems.reduce((acc, item) => {
    const quantity = toNumber(item?.quantity ?? item?.qty ?? 1, 1);
    const price = toNumber(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0, 0);

    return acc + quantity * price;
  }, 0);

  const subtotal = Number.isFinite(Number(order?.subtotal))
    ? toMoney(order.subtotal)
    : toMoney(calculatedItemsTotal);
  const shipping = toMoney(order?.shipping ?? order?.pricing?.shipping ?? 0);
  const ivaAmount = toMoney(order?.taxes?.iva?.amount ?? order?.pricing?.taxAmount ?? 0);
  const ivaPercent = toMoney(order?.taxes?.iva?.percent ?? 0);
  const productDiscount = toMoney(
    order?.pricing?.productDiscount ??
      order?.discount?.amount ??
      order?.discountAmount ??
      (typeof order?.discount === 'number' ? order.discount : 0)
  );
  const netSubtotal = toMoney(
    order?.pricing?.subtotalAfterDiscount ?? subtotal - productDiscount
  );
  const total = Number.isFinite(Number(order?.total))
    ? toMoney(order.total)
    : toMoney(netSubtotal + shipping + ivaAmount);

  const ivaEnabled = order?.taxes?.iva?.enabled !== false && ivaPercent > 0;
  const hasIva = ivaEnabled;
  const ivaRate = hasIva ? ivaPercent.toFixed(2) : '0.00';
  const explicitDiscountTotal = toMoney(
    orderItems.reduce((sum, item) => sum + toNumber(item?.discountAmount, 0), 0)
  );
  const allocatedDiscounts = explicitDiscountTotal > 0
    ? orderItems.map((item) => toMoney(item?.discountAmount || 0))
    : allocateFactusDiscounts(orderItems, productDiscount);

  const items = orderItems.map((item, index) => {
    const quantity = toNumber(item?.quantity ?? item?.qty ?? 1, 1);
    const price = toMoney(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0);
    const discountAmount = toMoney(allocatedDiscounts[index] || 0);
    const factusItem = {
      code_reference: String(item?.productId || item?.product || item?._id || item?.title || 'ITEM'),
      name: String(item?.title || 'Producto'),
      quantity,
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

    if (discountAmount > 0) {
      factusItem.discount_amount = discountAmount.toFixed(2);
    }

    return factusItem;
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

  return {
    reference_code: String(order?.orderNumber || order?._id || `ORDER-${Date.now()}`),
    document: '01',
    send_email: false,
    observation: 'Factura generada desde tienda virtual.',

    customer: buildFactusCustomer(order),
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
      discount: productDiscount,
      taxable_base: netSubtotal,
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
  billId = 0,
  referenceCode = '',
  numberingRangeId = 0,
}) {
  const resolvedNumberingRangeId = Number(
    numberingRangeId ||
      settings?.billing?.electronicProvider?.creditNoteNumberingRangeId ||
      settings?.billing?.electronicProvider?.numberingRangeId ||
      settings?.billing?.dianResolution?.creditNoteNumberingRangeId ||
      settings?.billing?.dianResolution?.numberingRangeId ||
      0
    
  );

  const invoicePayload = buildFactusInvoicePayload({ order });
  const originalItems = Array.isArray(invoicePayload.items) ? invoicePayload.items : [];
  const selectedByCode = new Map(
    (Array.isArray(selectedItems) ? selectedItems : []).map((item) => [
      String(item?.codeReference || item?.code_reference || item?.productId || ''),
      item,
    ])
  );
  const sourceItems = type === 'partial'
    ? originalItems.filter((item) => selectedByCode.has(String(item.code_reference || '')))
    : originalItems;

  const items = sourceItems.map((item) => {
    const selected = selectedByCode.get(String(item.code_reference || '')) || {};
    const originalQuantity = Math.max(0, toNumber(item.quantity, 0));
    const quantity = type === 'partial'
      ? Math.min(originalQuantity, Math.max(0, toNumber(selected.quantity, 0)))
      : originalQuantity;
    const ratio = originalQuantity > 0 ? quantity / originalQuantity : 0;
    const discountAmount = toMoney(toNumber(item.discount_amount, 0) * ratio);
    const creditItem = {
      ...item,
      quantity,
      note: trimSafe(reasonText, 250),
    };

    if (discountAmount > 0) creditItem.discount_amount = discountAmount.toFixed(2);
    else delete creditItem.discount_amount;

    return creditItem;
  }).filter((item) => Number(item.quantity || 0) > 0);

  const totals = items.reduce((acc, item) => {
    const gross = toMoney(toNumber(item.quantity, 0) * toNumber(item.price, 0));
    const discount = toMoney(item.discount_amount || 0);
    const taxable = toMoney(Math.max(0, gross - discount));
    const rate = item.is_excluded === true
      ? 0
      : toNumber(item.tax_rate ?? item?.taxes?.[0]?.rate, 0);
    const tax = toMoney(taxable * (rate / 100));
    acc.subtotal = toMoney(acc.subtotal + gross);
    acc.discount = toMoney(acc.discount + discount);
    acc.tax = toMoney(acc.tax + tax);
    acc.total = toMoney(acc.total + taxable + tax);
    return acc;
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 });

  const payload = {
    reference_code: trimSafe(referenceCode, 100),

    bill_id: Number(billId || 0),

    correction_concept_code: String(reasonCode),

    customization_id: '20',

    observation: reasonText,

    payment_details: [
      {
        payment_form: '1',
        payment_method_code: '10',
        amount: totals.total.toFixed(2),
      },
    ],

    items,
  };

  payload.numbering_range_id = resolvedNumberingRangeId;

  if (!payload.reference_code) {
    throw new Error('La nota crédito requiere un código de referencia idempotente.');
  }

  if (!Number.isInteger(payload.bill_id) || payload.bill_id <= 0) {
    throw new Error('La factura relacionada no tiene el ID oficial de Factus.');
  }

  if (!items.length || totals.total <= 0) {
    throw new Error('La nota crédito no contiene ítems válidos para acreditar.');
  }

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

    const result = await postFactusCreditNoteValidate({
      credentials,
      tokenResult,
      payload,
    });

    if (!result.ok) {
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
      customer: {
        identification_document_code: payload.customer?.identification_document_code,
        legal_organization_code: payload.customer?.legal_organization_code,
        country_code: payload.customer?.country_code,
        has_municipality: Boolean(payload.customer?.municipality_code),
      },
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

    return {
      success: true,
      provider: 'factus',
      stage: 'send_invoice',
      status: result.status,

      data: {
        ...result.data,

        invoiceNumber,
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
  downloadInvoiceDocumentFromFactus,
  downloadCreditNoteDocumentFromFactus,
  extractFactusDownloadPayload,
  decodeFactusBase64Document,
  postFactusCreditNoteValidate,
  buildFactusCustomer,
  buildFactusInvoicePayload,
  buildFactusCreditNotePayload,
};
