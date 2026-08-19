'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  BASE_URLS,
  COLOMBIA_PARCEL_CARRIERS,
  createEnviaProvider,
  verifyEnviaWebhook,
} = require('../services/enviaShippingProvider');
const {
  buildEnviaShipmentPayload,
  countryCode,
  daneColombiaDepartmentCode,
  enviaColombiaStateCode,
} = require('../services/shippingPayloadService');
const {
  resolveColombiaAddresses,
  resolveShippingAddresses,
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
  assert.strictEqual(daneColombiaDepartmentCode('MA'), '47');
  assert.strictEqual(countryCode('Estados Unidos'), 'US');
  assert.strictEqual(countryCode('USA'), 'US');
  assert.strictEqual(countryCode('México'), 'MX');
  assert.strictEqual(payload.settings.currency, 'COP');
  assert.strictEqual(payload.customsSettings, undefined);
  assert.strictEqual(payload.packages[0].items, undefined);
  assert.throws(
    () => buildEnviaShipmentPayload({
      order,
      branch,
      shipment: { ...shipment, packages: [{ ...shipment.packages[0], heightCm: 0 }] },
    }),
    (error) => error.code === 'SHIPPING_DATA_INCOMPLETE'
  );
  ok('el contrato valida origen, destino, peso y dimensiones antes de cotizar');

  const internationalOrder = {
    ...order,
    customer: {
      ...order.customer,
      city: 'New York',
      department: 'New York',
      departmentCode: 'NY',
      country: 'Estados Unidos',
      countryCode: 'US',
      postalCode: '10001',
    },
    items: [
      {
        _id: 'item-1',
        title: 'Vestido de algodón',
        quantity: 2,
        unitPrice: 45000,
        productType: 'physical',
        requiresShipping: true,
        customsSnapshot: {
          description: 'Vestido de algodón para mujer',
          hsCode: '610442',
          countryOfManufacture: 'Colombia',
        },
      },
    ],
    inventoryAllocations: [
      {
        _id: 'allocation-1',
        orderItem: 'item-1',
        soldQuantity: 2,
        returnedQuantity: 0,
      },
    ],
  };
  const internationalShipment = {
    ...shipment,
    allocationIds: ['allocation-1'],
  };
  const internationalOrderSnapshot = JSON.parse(JSON.stringify(internationalOrder));
  const customsPayload = buildEnviaShipmentPayload({
    order: internationalOrder,
    shipment: internationalShipment,
    branch,
    customsPolicy: {
      dutiesPaymentEntity: 'sender',
      exportReason: 'sale',
    },
  });
  assert.deepStrictEqual(internationalOrder, internationalOrderSnapshot);
  assert.deepStrictEqual(customsPayload.customsSettings, {
    dutiesPaymentEntity: 'sender',
    exportReason: 'sale',
  });
  assert.deepStrictEqual(customsPayload.packages[0].items, [
    {
      description: 'Vestido de algodón para mujer',
      quantity: 2,
      price: 45000,
      hsCode: '6104.42',
      countryOfManufacture: 'CO',
    },
  ]);
  assert.throws(
    () => buildEnviaShipmentPayload({
      order: {
        ...internationalOrder,
        items: [{ ...internationalOrder.items[0], customsSnapshot: {} }],
      },
      shipment: internationalShipment,
      branch,
    }),
    (error) =>
      error.code === 'SHIPPING_CUSTOMS_DATA_INCOMPLETE' &&
      error.statusCode === 422
  );
  assert.throws(
    () => buildEnviaShipmentPayload({
      order: internationalOrder,
      shipment: {
        ...internationalShipment,
        packages: [
          shipment.packages[0],
          { ...shipment.packages[0], code: 'PKG-002' },
        ],
      },
      branch,
    }),
    (error) => error.code === 'SHIPPING_INTERNATIONAL_PACKAGE_ALLOCATION_REQUIRED'
  );
  ok('aduanas internacionales usa snapshots por envío y nunca inventa ni muta datos');

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

  let unnecessaryLocateCalls = 0;
  const locallyResolved = await resolveColombiaAddresses(
    {
      async resolveColombiaCity() {
        unnecessaryLocateCalls += 1;
        throw new Error('No debe consultarse Envia para un municipio del catálogo nacional.');
      },
    },
    {
      origin: {
        name: 'Sede Principal',
        country: 'CO',
        city: 'Ciénaga',
        state: 'MA',
      },
      destination: {
        country: 'CO',
        city: 'Bogotá',
        state: 'DC',
      },
    }
  );
  assert.strictEqual(locallyResolved.origin.city, '47189000');
  assert.strictEqual(locallyResolved.destination.city, '11001000');
  assert.strictEqual(unnecessaryLocateCalls, 0);
  ok('el catálogo nacional convierte Ciénaga y Bogotá al DANE sin depender de /locate');

  const internationalCalls = [];
  const internationalProvider = createEnviaProvider({
    config: { mode: 'sandbox', token: 'sandbox-secret', timeoutMs: 1000 },
    fetchImpl: async (url, options) => {
      internationalCalls.push({ url, options });
      if (url === `${BASE_URLS.sandbox.queries}/state?country_code=US`) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { meta: 'success', data: [{ code: 'NY', name: 'New York' }] };
          },
        };
      }
      assert.strictEqual(
        url,
        `${BASE_URLS.sandbox.geocodes}/zipcode/US/10001`
      );
      assert.strictEqual(options.method, 'GET');
      assert.strictEqual(options.headers.Authorization, undefined);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            success: true,
            data: {
              city: 'New York',
              state: 'NY',
              country: 'US',
              zipcode: '10001',
            },
          };
        },
      };
    },
  });
  const internationalInput = {
    origin: {
      name: 'Warehouse',
      country: 'US',
      city: 'New York City',
      state: 'New York',
      postalCode: '10001',
    },
    destination: {
      country: 'CO',
      city: '11001000',
      state: 'DC',
      postalCode: '110111',
    },
  };
  const internationalSnapshot = JSON.parse(JSON.stringify(internationalInput));
  const internationalResolved = await resolveShippingAddresses(
    internationalProvider,
    internationalInput
  );
  assert.deepStrictEqual(internationalInput, internationalSnapshot);
  assert.strictEqual(internationalResolved.origin.city, 'New York');
  assert.strictEqual(internationalResolved.origin.state, 'NY');
  assert.strictEqual(internationalResolved.origin.postalCode, '10001');
  assert.strictEqual(internationalCalls.length, 2);
  ok('las direcciones internacionales usan estado y geocódigo oficiales sin mutar la orden');

  const stateFallbackInput = {
    origin: {
      name: 'Warehouse',
      country: 'FR',
      city: 'Paris',
      state: 'Île-de-France',
      postalCode: '75001',
    },
    destination: {
      country: 'CO',
      city: '11001000',
      state: 'DC',
      postalCode: '110111',
    },
  };
  const stateFallbackResult = await resolveShippingAddresses(
    {
      async resolveState() {
        const error = new Error('Catálogo no disponible');
        error.code = 'SHIPPING_PROVIDER_HTTP_ERROR';
        error.details = { operation: 'list_states', providerStatus: 404 };
        throw error;
      },
      async resolveAddress() {
        return [{ city: 'Paris', state: 'Île-de-France', zipcode: '75001' }];
      },
    },
    stateFallbackInput
  );
  assert.strictEqual(stateFallbackResult.origin.city, 'Paris');
  assert.strictEqual(stateFallbackResult.origin.state, 'Île-de-France');
  ok('los países sin endpoint de estados continúan con el geocódigo oficial');

  const globalRateCalls = [];
  const globalRatesProvider = createEnviaProvider({
    config: { mode: 'sandbox', token: 'sandbox-secret', timeoutMs: 1000 },
    fetchImpl: async (url, options) => {
      globalRateCalls.push({ url, options });
      if (url === `${BASE_URLS.sandbox.queries}/carrier?country_code=US`) {
        assert.strictEqual(options.method, 'GET');
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              meta: 'success',
              data: [
                { carrier: 'ups', name: 'UPS' },
                { carrier: 'fedex', name: 'FedEx' },
              ],
            };
          },
        };
      }
      assert.strictEqual(url, `${BASE_URLS.sandbox.shipping}/ship/rate/`);
      const carrier = JSON.parse(options.body).shipment.carrier;
      return {
        ok: true,
        status: 200,
        async json() {
          return carrier === 'ups'
            ? { meta: 'rate', data: [{ carrier, service: 'ground', totalPrice: 25 }] }
            : { meta: 'rate', data: [] };
        },
      };
    },
  });
  const globalRates = await globalRatesProvider.quote({
    origin: { country: 'US' },
    destination: { country: 'CA' },
    shipment: { type: 1 },
  });
  assert.strictEqual(globalRates.length, 1);
  assert.strictEqual(globalRates[0].carrier, 'ups');
  assert.deepStrictEqual(
    globalRateCalls
      .filter((call) => call.url.endsWith('/ship/rate/'))
      .map((call) => JSON.parse(call.options.body).shipment.carrier)
      .sort(),
    ['fedex', 'ups']
  );
  ok('cada país descubre sus transportadoras y cotiza una por solicitud');

  const checkoutSource = fs.readFileSync(
    path.join(__dirname, '../../frontend/src/pages/CheckoutPage.jsx'),
    'utf8'
  );
  const branchesSource = fs.readFileSync(
    path.join(__dirname, '../../frontend/src/admin/configuracion/sections/SedesSection.jsx'),
    'utf8'
  );
  const productFormSource = fs.readFileSync(
    path.join(__dirname, '../../frontend/src/admin/FormularioProducto.jsx'),
    'utf8'
  );
  const shippingSettingsSource = fs.readFileSync(
    path.join(
      __dirname,
      '../../frontend/src/admin/configuracion/sections/envios/ShippingProvidersCard.jsx'
    ),
    'utf8'
  );
  assert(checkoutSource.includes("'Estado / provincia'"));
  assert(checkoutSource.includes('autoComplete="address-level1"'));
  assert(branchesSource.includes('form.address.postalCode'));
  assert(branchesSource.includes('autoComplete="postal-code"'));
  assert(branchesSource.includes("api.get('/api/geo/countries')"));
  assert(branchesSource.includes("api.get('/api/geo/regions'"));
  assert(branchesSource.includes("api.get('/api/geo/cities'"));
  assert(branchesSource.includes('cityCode: event.target.value'));
  assert(productFormSource.includes('customsHsCode'));
  assert(productFormSource.includes('customsCountryOfManufacture'));
  assert(productFormSource.includes("api.get('/api/geo/countries')"));
  assert(shippingSettingsSource.includes('internationalDutiesPaymentEntity'));
  ok('checkout, sedes, productos y configuración capturan los datos internacionales');

  const quotedCarriers = [];
  const colombiaRates = createEnviaProvider({
    config: { mode: 'sandbox', token: 'sandbox-secret', timeoutMs: 1000 },
    fetchImpl: async (url, options) => {
      assert.strictEqual(url, `${BASE_URLS.sandbox.shipping}/ship/rate/`);
      const carrier = JSON.parse(options.body).shipment.carrier;
      quotedCarriers.push(carrier);
      return {
        ok: true,
        async json() {
          return carrier === 'coordinadora'
            ? { meta: 'rate', data: [{ carrier, service: 'standard', totalPrice: 12000 }] }
            : { meta: 'rate', data: [] };
        },
      };
    },
  });
  const availableRates = await colombiaRates.quote({
    origin: { country: 'CO' },
    destination: { country: 'CO' },
    shipment: { type: 1 },
  });
  assert.deepStrictEqual(quotedCarriers.sort(), [...COLOMBIA_PARCEL_CARRIERS].sort());
  assert.strictEqual(availableRates.length, 1);
  assert.strictEqual(availableRates[0].carrier, 'coordinadora');
  ok('la cotización nacional consulta cada transportadora y conserva las tarifas disponibles');

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

  let locationCalls = 0;
  const emptyDestinationProvider = {
    async resolveColombiaCity() {
      locationCalls += 1;
      const error = new Error('La transportadora respondió sin datos utilizables.');
      error.code = 'SHIPPING_PROVIDER_EMPTY_RESPONSE';
      error.details = { operation: 'resolve_colombia_city' };
      throw error;
    },
  };
  await assert.rejects(
    () => resolveColombiaAddresses(emptyDestinationProvider, {
      origin: {
        name: 'Sede Principal',
        country: 'CO',
        city: 'Santa Marta',
        state: 'MA',
      },
      destination: {
        country: 'CO',
        city: 'Ciudad no reconocida',
        state: 'MA',
      },
    }),
    (error) =>
      error.code === 'SHIPPING_CITY_NOT_RESOLVED' &&
      error.statusCode === 422 &&
      error.details.address === 'destination' &&
      error.details.city === 'Ciudad no reconocida' &&
      error.details.state === 'MA' &&
      error.message.includes('dirección del cliente')
  );
  assert.strictEqual(locationCalls, 1);
  ok('una búsqueda de ciudad vacía identifica el origen o destino que debe corregirse');

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
