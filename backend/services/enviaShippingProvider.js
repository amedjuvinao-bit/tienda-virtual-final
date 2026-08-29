'use strict';

const crypto = require('crypto');

const { env } = require('../config/env');

const BASE_URLS = Object.freeze({
  sandbox: {
    shipping: 'https://api-test.envia.com',
    queries: 'https://queries-test.envia.com',
    accountQueries: 'https://queries.test.envia.com',
    geocodes: 'https://geocodes.envia.com',
  },
  production: {
    shipping: 'https://api.envia.com',
    queries: 'https://queries.envia.com',
    accountQueries: 'https://queries.envia.com',
    geocodes: 'https://geocodes.envia.com',
  },
});

const COLOMBIA_PARCEL_CARRIERS = Object.freeze([
  'coordinadora',
  'servientrega',
  'interrapidisimo',
  'tcc',
  'deprisa',
  'dhl',
  'fedex',
]);

class ShippingProviderError extends Error {
  constructor(message, code, statusCode = 502, details = {}) {
    super(message);
    this.name = 'ShippingProviderError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function clean(value) {
  return String(value || '').trim();
}

function normalizedText(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function carrierActionRows(payload = {}) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  if (payload?.data && typeof payload.data === 'object') return [payload.data];
  return [];
}

function carrierActionNames(rows = []) {
  return [...new Set((Array.isArray(rows) ? rows : [])
    .map((item) => clean(item?.action_name || item?.action || item?.name).toLowerCase())
    .filter(Boolean))];
}

function carrierNameMatches(value, expected) {
  const candidate = normalizedText(value);
  const requested = normalizedText(expected);
  return Boolean(
    candidate &&
    requested &&
    (
      candidate === requested ||
      candidate.startsWith(`${requested} `) ||
      requested.startsWith(`${candidate} `)
    )
  );
}

async function settleWithConcurrency(values, limit, worker) {
  const source = Array.isArray(values) ? values : [];
  const results = new Array(source.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < source.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = {
          status: 'fulfilled',
          value: await worker(source[index], index),
        };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, Number(limit) || 1), source.length) },
      run
    )
  );
  return results;
}

function safeProviderMessage(payload) {
  return clean(
    payload?.error?.message ||
    payload?.message ||
    payload?.data?.message
  ).slice(0, 300);
}

function providerNotConfigured(mode = 'sandbox') {
  return new ShippingProviderError(
    `Envia ${mode === 'production' ? 'Producción' : 'Sandbox'} está preparado, pero falta guardar un token desde Configuración → Envíos.`,
    'SHIPPING_PROVIDER_NOT_CONFIGURED',
    409,
    { provider: 'envia', mode }
  );
}

function normalizeData(payload, operation) {
  if (clean(payload?.meta).toLowerCase() === 'error') {
    throw new ShippingProviderError(
      safeProviderMessage(payload) || 'La transportadora rechazó la operación.',
      'SHIPPING_PROVIDER_REJECTED',
      422,
      { provider: 'envia', operation }
    );
  }
  const data = Array.isArray(payload?.data)
    ? payload.data
    : payload?.data && typeof payload.data === 'object' && Object.keys(payload.data).length
      ? [payload.data]
      : [];
  if (!data.length) {
    throw new ShippingProviderError(
      'La transportadora respondió sin datos utilizables.',
      'SHIPPING_PROVIDER_EMPTY_RESPONSE',
      502,
      { provider: 'envia', operation }
    );
  }
  return data;
}

function createEnviaProvider({
  config = env.shipping.envia,
  fetchImpl = global.fetch,
  sleepImpl = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
} = {}) {
  const mode = config?.mode === 'production' ? 'production' : 'sandbox';
  const urls = BASE_URLS[mode];

  async function request(
    path,
    body,
    operation,
    {
      queryApi = false,
      accountQueryApi = false,
      geocodesApi = false,
      requiresAuth = true,
      method = 'POST',
      normalize = true,
      acceptedStatuses = [],
      allowProviderError = false,
    } = {}
  ) {
    if (requiresAuth && !clean(config?.token)) throw providerNotConfigured(mode);
    if (typeof fetchImpl !== 'function') {
      throw new ShippingProviderError(
        'El runtime no dispone de un cliente HTTP para la transportadora.',
        'SHIPPING_HTTP_CLIENT_UNAVAILABLE',
        500
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Number(config?.timeoutMs || 15_000)
    );
    try {
      const options = {
        method,
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      };
      if (requiresAuth) {
        options.headers.Authorization = `Bearer ${clean(config.token)}`;
      }
      if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const response = await fetchImpl(
        `${
          geocodesApi
            ? urls.geocodes
            : accountQueryApi
              ? urls.accountQueries
              : queryApi
                ? urls.queries
                : urls.shipping
        }${path}`,
        options
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && !acceptedStatuses.includes(response.status)) {
        throw new ShippingProviderError(
          safeProviderMessage(payload) || `Envia respondió HTTP ${response.status}.`,
          'SHIPPING_PROVIDER_HTTP_ERROR',
          502,
          { provider: 'envia', operation, providerStatus: response.status }
        );
      }
      if (!allowProviderError && clean(payload?.meta).toLowerCase() === 'error') {
        throw new ShippingProviderError(
          safeProviderMessage(payload) || 'La transportadora rechazó la operación.',
          'SHIPPING_PROVIDER_REJECTED',
          422,
          { provider: 'envia', operation }
        );
      }
      return normalize ? normalizeData(payload, operation) : payload;
    } catch (error) {
      if (error instanceof ShippingProviderError) throw error;
      if (error?.name === 'AbortError') {
        throw new ShippingProviderError(
          'La transportadora no respondió dentro del tiempo permitido.',
          'SHIPPING_PROVIDER_TIMEOUT',
          504,
          { provider: 'envia', operation }
        );
      }
      throw new ShippingProviderError(
        'No fue posible conectar con la transportadora.',
        'SHIPPING_PROVIDER_UNAVAILABLE',
        502,
        { provider: 'envia', operation }
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function listCarriers(country) {
    const countryCode = clean(country).toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      throw new ShippingProviderError(
        'El país de origen no tiene un código ISO de dos letras válido.',
        'SHIPPING_COUNTRY_INVALID',
        422,
        { provider: 'envia', operation: 'list_carriers', country: countryCode }
      );
    }
    return request(
      `/carrier?country_code=${encodeURIComponent(countryCode)}`,
      undefined,
      'list_carriers',
      { queryApi: true, method: 'GET' }
    );
  }

  async function listStates(country) {
    const countryCode = clean(country).toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      throw new ShippingProviderError(
        'El país no tiene un código ISO de dos letras válido.',
        'SHIPPING_COUNTRY_INVALID',
        422,
        { provider: 'envia', operation: 'list_states', country: countryCode }
      );
    }
    return request(
      `/state?country_code=${encodeURIComponent(countryCode)}`,
      undefined,
      'list_states',
      { queryApi: true, method: 'GET' }
    );
  }

  async function resolveState({ country, state } = {}) {
    const requested = normalizedText(state);
    if (!requested) return null;
    const states = await listStates(country);
    return states.find((item) => {
      const code = item?.code || item?.state_code || item?.stateCode;
      const name = item?.name || item?.state || item?.description;
      return [code, name].some((value) => normalizedText(value) === requested);
    }) || null;
  }

  return {
    key: 'envia',
    name: 'Envia.com',
    mode,
    customsPolicy: {
      dutiesPaymentEntity:
        ['recipient', 'sender', 'envia_guaranteed'].includes(
          clean(config?.internationalDutiesPaymentEntity).toLowerCase()
        )
          ? clean(config.internationalDutiesPaymentEntity).toLowerCase()
          : 'recipient',
      exportReason: 'sale',
    },
    configured: Boolean(clean(config?.token)),
    webhookConfigured: Boolean(clean(config?.webhookSecret)),
    async testConnection() {
      await request('/ship/rate/', {}, 'test_connection', {
        normalize: false,
        acceptedStatuses: [400, 422],
        allowProviderError: true,
      });
      return { ok: true, provider: 'envia', mode };
    },
    async getCarrierActions(carrier, { carrierId, countryCode } = {}) {
      const safeCarrier = clean(carrier).toLowerCase();
      const safeCarrierId = clean(carrierId);
      const safeCountryCode = clean(countryCode).toUpperCase();

      if (/^\d+$/.test(safeCarrierId)) {
        try {
          const payload = await request(
            `/carrier-action/${encodeURIComponent(safeCarrierId)}`,
            undefined,
            'carrier_actions',
            { queryApi: true, method: 'GET', normalize: false }
          );
          return carrierActionNames(carrierActionRows(payload));
        } catch (error) {
          if (
            error?.code !== 'SHIPPING_PROVIDER_HTTP_ERROR' ||
            ![404, 422].includes(Number(error?.details?.providerStatus))
          ) {
            throw error;
          }
        }
      }

      const payload = await request(
        '/carrier-action',
        undefined,
        'carrier_actions',
        { queryApi: true, method: 'GET', normalize: false }
      );
      const matches = carrierActionRows(payload).filter((item) => {
        const itemCarrier = item?.carrier || item?.carrier_name || item?.name;
        const itemCountry = clean(
          item?.country_code || item?.countryCode || item?.country
        ).toUpperCase();
        return (
          carrierNameMatches(itemCarrier, safeCarrier) &&
          (!safeCountryCode || !itemCountry || itemCountry === safeCountryCode)
        );
      });
      return carrierActionNames(matches);
    },
    async resolveColombiaCity({ city, state, country = 'CO' } = {}) {
      const data = await request(
        '/locate',
        { city: clean(city), state: clean(state), country: clean(country) || 'CO' },
        'resolve_colombia_city'
      );
      return data[0];
    },
    async resolveAddress({ country, city, postalCode } = {}) {
      const safeCountry = clean(country).toUpperCase();
      const safePostalCode = clean(postalCode);
      const safeCity = clean(city);
      if (!/^[A-Z]{2}$/.test(safeCountry) || (!safePostalCode && !safeCity)) {
        throw new ShippingProviderError(
          'La dirección requiere país y ciudad o código postal para validarse.',
          'SHIPPING_ADDRESS_LOOKUP_INCOMPLETE',
          422,
          { provider: 'envia', operation: 'resolve_address' }
        );
      }
      const path = safePostalCode
        ? `/zipcode/${encodeURIComponent(safeCountry)}/${encodeURIComponent(safePostalCode)}`
        : `/locate/${encodeURIComponent(safeCountry)}/${encodeURIComponent(safeCity)}`;
      const payload = await request(path, undefined, 'resolve_address', {
        geocodesApi: true,
        requiresAuth: false,
        method: 'GET',
        normalize: false,
      });
      const data = Array.isArray(payload?.data)
        ? payload.data
        : payload?.data && typeof payload.data === 'object'
          ? [payload.data]
          : [];
      if (payload?.success === false || !data.length) {
        throw new ShippingProviderError(
          'Envia no encontró una ubicación válida para la dirección.',
          'SHIPPING_PROVIDER_EMPTY_RESPONSE',
          422,
          { provider: 'envia', operation: 'resolve_address' }
        );
      }
      return data;
    },
    listCarriers,
    listStates,
    resolveState,
    async quote(payload) {
      const selectedCarrier = clean(payload?.shipment?.carrier);
      const originCountry = clean(payload?.origin?.country).toUpperCase();
      if (selectedCarrier || !originCountry) {
        return request('/ship/rate/', payload, 'quote');
      }

      let carrierNames = [];
      try {
        const carriers = await listCarriers(originCountry);
        carrierNames = carriers
          .map((carrier) => clean(carrier?.carrier || carrier?.code || carrier?.name))
          .filter(Boolean);
      } catch (error) {
        if (originCountry !== 'CO') throw error;
        carrierNames = [...COLOMBIA_PARCEL_CARRIERS];
      }
      carrierNames = [...new Set(carrierNames)];
      if (!carrierNames.length) {
        throw new ShippingProviderError(
          `Envia no reportó transportadoras disponibles para ${originCountry}.`,
          'SHIPPING_PROVIDER_NO_CARRIERS',
          422,
          { provider: 'envia', operation: 'quote', country: originCountry }
        );
      }

      const attempts = await settleWithConcurrency(
        carrierNames,
        5,
        (carrier) =>
          request(
            '/ship/rate/',
            {
              ...payload,
              shipment: { ...payload.shipment, carrier },
            },
            'quote'
          )
      );
      const rates = attempts.flatMap((attempt) =>
        attempt.status === 'fulfilled' ? attempt.value : []
      );
      if (rates.length) return rates;

      const authenticationFailure = attempts.find(
        (attempt) =>
          attempt.status === 'rejected' &&
          attempt.reason?.code === 'SHIPPING_PROVIDER_HTTP_ERROR' &&
          [401, 403].includes(Number(attempt.reason?.details?.providerStatus))
      );
      if (authenticationFailure) throw authenticationFailure.reason;

      throw new ShippingProviderError(
        'Envia no devolvió tarifas para esta ruta con las transportadoras disponibles.',
        'SHIPPING_PROVIDER_NO_RATES',
        422,
        {
          provider: 'envia',
          operation: 'quote',
          country: originCountry,
          carriers: carrierNames,
        }
      );
    },
    async generateLabel(payload) {
      return request('/ship/generate/', payload, 'generate_label');
    },
    async track(trackingNumber) {
      return request(
        '/ship/generaltrack/',
        { trackingNumbers: [clean(trackingNumber)] },
        'track'
      );
    },
    async listShipmentsByMonth({ month, year } = {}) {
      const safeMonth = clean(month);
      const safeYear = clean(year);
      if (!/^(0[1-9]|1[0-2])$/.test(safeMonth) || !/^\d{4}$/.test(safeYear)) {
        throw new ShippingProviderError(
          'El mes y el año para consultar las guías de Envia no son válidos.',
          'SHIPPING_SHIPMENT_PERIOD_INVALID',
          422,
          { provider: 'envia', operation: 'list_shipments' }
        );
      }
      const payload = await request(
        `/guide/${safeMonth}/${safeYear}`,
        undefined,
        'list_shipments',
        { accountQueryApi: true, method: 'GET', normalize: false }
      );
      return Array.isArray(payload?.data) ? payload.data : [];
    },
    async schedulePickup(payload) {
      return request('/ship/pickup/', payload, 'schedule_pickup');
    },
    async testWebhook({ carrier, trackingNumber, status = 'Shipped' } = {}) {
      const safeCarrier = clean(carrier).toLowerCase();
      const safeTrackingNumber = clean(trackingNumber);
      const safeStatus = clean(status);
      const allowedStatuses = new Set([
        'Shipped',
        'Delivered',
        'Canceled',
        'Picked Up',
      ]);
      if (!safeCarrier || !safeTrackingNumber || !allowedStatuses.has(safeStatus)) {
        throw new ShippingProviderError(
          'La prueba oficial del webhook exige la transportadora, una guía de la cuenta y un estado válido.',
          'SHIPPING_WEBHOOK_TEST_DATA_REQUIRED',
          422,
          { provider: 'envia', operation: 'test_webhook' }
        );
      }
      const body = {
        carrier: safeCarrier,
        trackingNumber: safeTrackingNumber,
        status: safeStatus,
      };
      const retryableStatuses = new Set([500, 502, 503, 504]);
      const retryDelaysMs = [250, 750];
      let lastError = null;
      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
        try {
          return await request(
            '/ship/webhooktest/',
            body,
            'test_webhook',
            { normalize: false }
          );
        } catch (error) {
          lastError = error;
          const providerStatus = Number(error?.details?.providerStatus || 0);
          const canRetry =
            error?.code === 'SHIPPING_PROVIDER_HTTP_ERROR' &&
            retryableStatuses.has(providerStatus) &&
            attempt < retryDelaysMs.length;
          if (!canRetry) break;
          await sleepImpl(retryDelaysMs[attempt]);
        }
      }
      const providerStatus = Number(lastError?.details?.providerStatus || 0);
      if (retryableStatuses.has(providerStatus)) {
        throw new ShippingProviderError(
          `Envia Sandbox respondió HTTP ${providerStatus} en tres intentos. El webhook no fue aprobado.`,
          'SHIPPING_WEBHOOK_TEST_PROVIDER_ERROR',
          502,
          {
            provider: 'envia',
            operation: 'test_webhook',
            providerStatus,
            attempts: retryDelaysMs.length + 1,
          }
        );
      }
      throw lastError;
    },
    async cancel({ carrier, trackingNumber }) {
      return request(
        '/ship/cancel/',
        { carrier: clean(carrier), trackingNumber: clean(trackingNumber) },
        'cancel'
      );
    },
  };
}

function verifyEnviaWebhook({
  rawBody,
  headers = {},
  secret = env.shipping.envia.webhookSecret,
  now = Date.now(),
  toleranceMs = 5 * 60 * 1000,
} = {}) {
  if (!clean(secret)) {
    throw new ShippingProviderError(
      'El webhook de Envia no está habilitado: falta ENVIA_WEBHOOK_SECRET.',
      'SHIPPING_WEBHOOK_NOT_CONFIGURED',
      503
    );
  }
  const event = clean(headers['x-webhook-event']);
  const eventId = clean(headers['x-webhook-id']);
  const timestamp = clean(headers['x-webhook-timestamp']);
  const received = clean(headers['x-webhook-signature']).replace(/^v1=/i, '');
  const timestampNumber = Number(timestamp);
  if (!event || !eventId || !timestamp || !received || !Number.isFinite(timestampNumber)) {
    throw new ShippingProviderError(
      'Faltan encabezados firmados del webhook.',
      'INVALID_SHIPPING_WEBHOOK_HEADERS',
      400
    );
  }
  if (Math.abs(Number(now) - timestampNumber) > toleranceMs) {
    throw new ShippingProviderError(
      'El webhook está fuera de la ventana de seguridad.',
      'STALE_SHIPPING_WEBHOOK',
      401
    );
  }
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${event}.${body}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new ShippingProviderError(
      'La firma del webhook no es válida.',
      'INVALID_SHIPPING_WEBHOOK_SIGNATURE',
      401
    );
  }
  return { event, eventId, timestamp: timestampNumber, body };
}

function verifyEnviaSandboxTestWebhook({
  rawBody,
  headers = {},
  mode,
  webhookToken,
  apiToken,
  now = Date.now(),
} = {}) {
  if (clean(mode).toLowerCase() !== 'sandbox') {
    throw new ShippingProviderError(
      'Producción exige la firma HMAC completa del webhook.',
      'UNSIGNED_SHIPPING_WEBHOOK_FORBIDDEN',
      401
    );
  }

  const authorization = clean(headers.authorization);
  const suppliedToken = authorization.replace(/^Bearer\s+/i, '');
  const suppliedDigest = crypto.createHash('sha256').update(suppliedToken).digest();
  const acceptedTokens = [webhookToken, apiToken]
    .map((value) => clean(value))
    .filter(Boolean);
  const authenticated = acceptedTokens.some((expectedToken) => {
    const expectedDigest = crypto.createHash('sha256').update(expectedToken).digest();
    return crypto.timingSafeEqual(suppliedDigest, expectedDigest);
  });
  if (!suppliedToken || !authenticated) {
    throw new ShippingProviderError(
      'La prueba de webhook Sandbox no pudo autenticarse con la credencial del webhook configurada.',
      'INVALID_SANDBOX_WEBHOOK_AUTHORIZATION',
      401
    );
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    throw new ShippingProviderError(
      'El cuerpo de la prueba de webhook no contiene JSON válido.',
      'INVALID_SHIPPING_WEBHOOK_JSON',
      400
    );
  }
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const carrier = clean(
    data?.carrier_name ||
    data?.carrierName ||
    data?.carrier ||
    payload?.carrier_name ||
    payload?.carrierName ||
    payload?.carrier
  );
  const trackingNumber = clean(
    data?.tracking_number || data?.trackingNumber || payload?.tracking_number || payload?.trackingNumber
  );
  const status = clean(
    data?.shipment_status || data?.status || payload?.shipment_status || payload?.status
  );
  if (!carrier || !trackingNumber || !status) {
    throw new ShippingProviderError(
      'La prueba de webhook Sandbox no contiene transportadora, guía y estado.',
      'INVALID_SANDBOX_WEBHOOK_PAYLOAD',
      400
    );
  }

  const minuteBucket = Math.floor(Number(now) / 60_000);
  const eventId = `sandbox-test-${crypto
    .createHash('sha256')
    .update(`${minuteBucket}.${body}`)
    .digest('hex')}`;
  return {
    event: clean(payload?.type) || 'tracking.test',
    eventId,
    timestamp: Number(now),
    body,
    sandboxTest: true,
  };
}

module.exports = {
  BASE_URLS,
  COLOMBIA_PARCEL_CARRIERS,
  ShippingProviderError,
  createEnviaProvider,
  verifyEnviaWebhook,
  verifyEnviaSandboxTestWebhook,
};
