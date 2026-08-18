'use strict';

const crypto = require('crypto');

const { env } = require('../config/env');

const BASE_URLS = Object.freeze({
  sandbox: {
    shipping: 'https://api-test.envia.com',
    queries: 'https://queries-test.envia.com',
  },
  production: {
    shipping: 'https://api.envia.com',
    queries: 'https://queries.envia.com',
  },
});

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
  const data = Array.isArray(payload?.data) ? payload.data : [];
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
} = {}) {
  const mode = config?.mode === 'production' ? 'production' : 'sandbox';
  const urls = BASE_URLS[mode];

  async function request(
    path,
    body,
    operation,
    { queryApi = false, method = 'POST', normalize = true } = {}
  ) {
    if (!clean(config?.token)) throw providerNotConfigured(mode);
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
          Authorization: `Bearer ${clean(config.token)}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      };
      if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const response = await fetchImpl(
        `${queryApi ? urls.queries : urls.shipping}${path}`,
        options
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new ShippingProviderError(
          safeProviderMessage(payload) || `Envia respondió HTTP ${response.status}.`,
          'SHIPPING_PROVIDER_HTTP_ERROR',
          502,
          { provider: 'envia', operation, providerStatus: response.status }
        );
      }
      if (clean(payload?.meta).toLowerCase() === 'error') {
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

  return {
    key: 'envia',
    name: 'Envia.com',
    mode,
    configured: Boolean(clean(config?.token)),
    webhookConfigured: Boolean(clean(config?.webhookSecret)),
    async testConnection() {
      await request('/locale', undefined, 'test_connection', {
        queryApi: true,
        method: 'GET',
        normalize: false,
      });
      return { ok: true, provider: 'envia', mode };
    },
    async registerTrackingWebhook(url) {
      const payload = await request(
        '/webhooks',
        { type_id: 3, url: clean(url), active: 1 },
        'register_webhook',
        { queryApi: true, normalize: false }
      );
      return payload?.data || payload;
    },
    async resolveColombiaCity({ city, state, country = 'CO' } = {}) {
      const data = await request(
        '/locate',
        { city: clean(city), state: clean(state), country: clean(country) || 'CO' },
        'resolve_colombia_city'
      );
      return data[0];
    },
    async quote(payload) {
      return request('/ship/rate/', payload, 'quote');
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

module.exports = {
  BASE_URLS,
  ShippingProviderError,
  createEnviaProvider,
  verifyEnviaWebhook,
};
