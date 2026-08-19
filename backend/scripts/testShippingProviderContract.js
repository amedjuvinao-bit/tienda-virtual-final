'use strict';

const assert = require('assert');
const crypto = require('crypto');

const {
  BASE_URLS,
  createEnviaProvider,
  verifyEnviaWebhook,
} = require('../services/enviaShippingProvider');
const {
  buildEnviaShipmentPayload,
  enviaColombiaStateCode,
} = require('../services/shippingPayloadService');
const {
  resolveColombiaAddresses,
} = require('../services/orderShippingIntegrationService');

const checks = [];
function ok(message) {
  checks.push(message);
  console.log(`OK  ${message}`);
}

async function main() {
  let externalCalls = 0;
  const disabled = createEnviaProvider({
    config: { mode: 'sandbox', token: '', timeoutMs: 1000 },
    fetchImpl: async () => {
      externalCalls += 1;
      throw new Error('No debe ejecutarse');
    },
  });
  await assert.rejects(
    () => disabled.quote({}),
    (error) => error.code === 'SHIPPING_PROVIDER_NOT_CONFIGURED'
  );
  assert.strictEqual(externalCalls, 0);
  ok('sin ENVIA_TOKEN la integración falla cerrada y no abre conexiones externas');

  let capturedUrl = '';
  let capturedAuthorization = '';
  const sandbox = createEnviaProvider({
    config: { mode: 'sandbox', token: 'sandbox-secret', timeoutMs: 1000 },
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedAuthorization = options.headers.Authorization;
      return {
        ok: true,
        async json() {
          return { meta: 'rate', data: [{ carrier: 'coordinadora', totalPrice: 12000 }] };
        },
      };
    },
  });
  const rates = await sandbox.quote({ shipment: { type: 1 } });
  assert.strictEqual(capturedUrl, `${BASE_URLS.sandbox.shipping}/ship/rate/`);
  assert.strictEqual(capturedAuthorization, 'Bearer sandbox-secret');
  assert.strictEqual(rates.length, 1);
  ok('Sandbox usa exclusivamente el host de pruebas y autenticación Bearer');

  let connectionUrl = '';
  let connectionMethod = '';
  const connection = createEnviaProvider({
    config: { mode: 'sandbox', token: 'sandbox-secret', timeoutMs: 1000 },
    fetchImpl: async (url, options) => {
      connectionUrl = url;
      connectionMethod = options.method;
      assert.deepStrictEqual(JSON.parse(options.body), {});
      return {
        ok: false,
        status: 422,
        async json() {
          return { meta: 'error', error: { message: 'Origin is required.' } };
        },
      };
    },
  });
  await connection.testConnection();
  assert.strictEqual(
    connectionUrl,
    `${BASE_URLS.sandbox.shipping}/ship/rate/`
  );
  assert.strictEqual(connectionMethod, 'POST');

  const rejectedConnection = createEnviaProvider({
    config: { mode: 'sandbox', token: 'invalid-secret', timeoutMs: 1000 },
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        return {};
      },
    }),
  });
  await assert.rejects(
    () => rejectedConnection.testConnection(),
    (error) =>
      error.code === 'SHIPPING_PROVIDER_HTTP_ERROR' &&
      error.details.providerStatus === 401
  );
  ok('la conexión usa el host activo de cotización y distingue un token rechazado');

  const branch = {
    name: 'Bodega Bogotá',
    contact: { phone: '3000000000', email: 'bodega@example.com' },
    address: {
      addressLine: 'Calle 1 # 2-03',
      city: 'Bogotá',
      departmentCode: '11',
      country: 'Colombia',
      postalCode: '110111',
    },
  };
  const order = {
    orderNumber: 'ORD-001',
    total: 100000,
    customer: {
      name: 'Cliente',
      lastname: 'Prueba',
      phone: '3110000000',
      email: 'cliente@example.com',
      address: 'Carrera 3 # 4-05',
      city: 'Medellín',
      departmentCode: '05',
      countryCode: 'CO',
      postalCode: '050001',
    },
  };
  const shipment = {
    code: 'SHP-001',
    packages: [{ code: 'PKG-001', weightGrams: 1500, lengthCm: 30, widthCm: 20, heightCm: 10 }],
  };
  const payload = buildEnviaShipmentPayload({ order, shipment, branch });
  assert.strictEqual(payload.packages[0].weight, 1.5);
  assert.strictEqual(payload.origin.country, 'CO');
  assert.strictEqual(payload.destination.country, 'CO');
  assert.strictEqual(payload.origin.state, 'DC');
  assert.strictEqual(payload.destination.state, 'AN');
  assert.strictEqual(enviaColombiaStateCode('25', 'Cundinamarca'), 'CU');
  assert.strictEqual(enviaColombiaStateCode('47', 'Magdalena'), 'MA');
  assert.strictEqual(enviaColombiaStateCode('', 'Magdalena'), 'MA');
  assert.strictEqual(payload.settings.currency, 'COP');
  assert.throws(
    () => buildEnviaShipmentPayload({
      order,
      branch,
      shipment: { ...shipment, packages: [{ ...shipment.packages[0], heightCm: 0 }] },
    }),
    (error) => error.code === 'SHIPPING_DATA_INCOMPLETE'
  );
  ok('el contrato valida origen, destino, peso y dimensiones antes de cotizar');

  let locateBody = null;
  const locator = createEnviaProvider({
    config: { mode: 'sandbox', token: 'sandbox-secret', timeoutMs: 1000 },
    fetchImpl: async (url, options) => {
      assert.strictEqual(url, `${BASE_URLS.sandbox.shipping}/locate`);
      locateBody = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return { meta: 'success', data: [{ city: '11001000', state: 'DC' }] };
        },
      };
    },
  });
  const located = await locator.resolveColombiaCity({
    city: 'Bogotá',
    state: 'DC',
  });
  assert.deepStrictEqual(locateBody, { city: 'Bogotá', state: 'DC', country: 'CO' });
  assert.strictEqual(located.city, '11001000');
  ok('las ciudades colombianas se resuelven al DANE de 8 dígitos antes de cotizar');

  const invalidLocationProvider = {
    async resolveColombiaCity() {
      const error = new Error('Address cannot be validated.');
      error.code = 'SHIPPING_PROVIDER_REJECTED';
      error.details = { operation: 'resolve_colombia_city' };
      throw error;
    },
  };
  await assert.rejects(
    () => resolveColombiaAddresses(invalidLocationProvider, {
      origin: {
        name: 'Sede Principal',
        country: 'CO',
        city: 'Santa Marta',
        state: 'DC',
      },
      destination: {
        country: 'CO',
        city: 'Bogotá',
        state: 'DC',
      },
    }),
    (error) =>
      error.code === 'SHIPPING_CITY_NOT_RESOLVED' &&
      error.details.address === 'origin' &&
      error.details.city === 'Santa Marta' &&
      error.details.state === 'DC' &&
      error.message.includes('Configuración → Sedes')
  );
  ok('un rechazo de ciudad identifica si debe corregirse la sede o la entrega');

  const rawBody = Buffer.from(JSON.stringify({ trackingNumber: 'TEST-1' }));
  const timestamp = 1_775_000_000_000;
  const event = 'shipment.updated';
  const secret = 'webhook-test-secret';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${event}.${rawBody.toString('utf8')}`)
    .digest('hex');
  const verified = verifyEnviaWebhook({
    rawBody,
    secret,
    now: timestamp,
    headers: {
      'x-webhook-event': event,
      'x-webhook-id': 'evt-test-1',
      'x-webhook-timestamp': String(timestamp),
      'x-webhook-signature': `v1=${signature}`,
    },
  });
  assert.strictEqual(verified.eventId, 'evt-test-1');
  assert.throws(
    () => verifyEnviaWebhook({
      rawBody: Buffer.from('{}'),
      secret,
      now: timestamp,
      headers: {
        'x-webhook-event': event,
        'x-webhook-id': 'evt-test-1',
        'x-webhook-timestamp': String(timestamp),
        'x-webhook-signature': `v1=${signature}`,
      },
    }),
    (error) => error.code === 'INVALID_SHIPPING_WEBHOOK_SIGNATURE'
  );
  ok('el webhook exige firma HMAC exacta, identificador y ventana temporal');

  console.log(`\n${checks.length} verificaciones de transportadoras completadas.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
