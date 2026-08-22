'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  BASE_URLS,
  COLOMBIA_PARCEL_CARRIERS,
  createEnviaProvider,
  verifyEnviaSandboxTestWebhook,
  verifyEnviaWebhook,
} = require('../services/enviaShippingProvider');
const {
  buildEnviaShipmentPayload,
  countryCode,
  daneColombiaDepartmentCode,
  enviaColombiaStateCode,
} = require('../services/shippingPayloadService');
const {
  buildStandalonePickupPayload,
  pickupOnGeneratePayload,
  resolveColombiaAddresses,
  resolveShippingAddresses,
} = require('../services/orderShippingIntegrationService');
const {
  applyProviderTrackingUpdate,
  providerStage,
} = require('../services/shippingTrackingStateService');
const {
  processShippingWebhookEvent,
  webhookTrackingEvent,
} = require('../services/shippingWebhookProcessingService');

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

  const automationCalls = [];
  const automationProvider = createEnviaProvider({
    config: { mode: 'sandbox', token: 'sandbox-secret', timeoutMs: 1000 },
    fetchImpl: async (url, options) => {
      automationCalls.push({ url, options, body: options.body ? JSON.parse(options.body) : null });
      if (url.endsWith('/carrier-action/fedex')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { data: [{ action_name: 'pickup_on_generate' }] };
          },
        };
      }
      if (url.endsWith('/ship/pickup/')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { data: [{ confirmation: 'PU-001' }] };
          },
        };
      }
      if (url.endsWith('/ship/webhooktest/')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { success: true };
          },
        };
      }
      throw new Error(`URL inesperada: ${url}`);
    },
  });
  assert.deepStrictEqual(await automationProvider.getCarrierActions('FedEx'), ['pickup_on_generate']);
  const pickupRequest = {
    origin: { country: 'CO', city: '08001000' },
    shipment: {
      type: 1,
      carrier: 'fedex',
      pickup: {
        weightUnit: 'KG',
        totalWeight: 1,
        totalPackages: 1,
        date: '2026-08-21',
        timeFrom: 9,
        timeTo: 14,
        carrier: 'fedex',
        trackingNumbers: ['TEST-001'],
      },
    },
  };
  const pickupResult = await automationProvider.schedulePickup(pickupRequest);
  assert.strictEqual(pickupResult[0].confirmation, 'PU-001');
  await automationProvider.testWebhook({
    carrier: 'FedEx',
    trackingNumber: 'TEST-001',
    status: 'Delivered',
  });
  assert.strictEqual(
    automationCalls[0].url,
    `${BASE_URLS.sandbox.queries}/carrier-action/fedex`
  );
  assert.strictEqual(automationCalls[0].options.method, 'GET');
  assert.deepStrictEqual(automationCalls[1].body, pickupRequest);
  assert.strictEqual('pickupAddress' in automationCalls[1].body, false);
  assert.strictEqual('pickupDate' in automationCalls[1].body, false);
  assert.deepStrictEqual(automationCalls[2].body, {
    carrier: 'fedex',
    trackingNumber: 'TEST-001',
    status: 'Delivered',
  });
  ok('capacidades, recolección y prueba de webhook usan los endpoints y cuerpos oficiales');

  const sandboxTestBody = Buffer.from(JSON.stringify({
    carrierName: 'fedex',
    trackingNumber: 'TEST-001',
    status: 'Delivered',
  }));
  const verifiedSandboxTest = verifyEnviaSandboxTestWebhook({
    rawBody: sandboxTestBody,
    headers: { authorization: 'Bearer sandbox-secret' },
    mode: 'sandbox',
    webhookToken: 'sandbox-secret',
    now: 1_800_000,
  });
  assert.strictEqual(verifiedSandboxTest.event, 'tracking.test');
  assert.strictEqual(verifiedSandboxTest.timestamp, 1_800_000);
  assert.strictEqual(verifiedSandboxTest.sandboxTest, true);
  assert.match(verifiedSandboxTest.eventId, /^sandbox-test-[a-f0-9]{64}$/);
  const verifiedRawAuthorization = verifyEnviaSandboxTestWebhook({
    rawBody: sandboxTestBody,
    headers: { authorization: 'sandbox-secret' },
    mode: 'sandbox',
    webhookToken: 'sandbox-secret',
    now: 1_800_001,
  });
  assert.strictEqual(verifiedRawAuthorization.sandboxTest, true);
  const verifiedApiAuthorization = verifyEnviaSandboxTestWebhook({
    rawBody: sandboxTestBody,
    headers: { authorization: 'Bearer sandbox-api-token' },
    mode: 'sandbox',
    webhookToken: 'sandbox-webhook-secret',
    apiToken: 'sandbox-api-token',
    now: 1_800_002,
  });
  assert.strictEqual(verifiedApiAuthorization.sandboxTest, true);
  const verifiedTemporaryTunnelProbe = verifyEnviaSandboxTestWebhook({
    rawBody: sandboxTestBody,
    headers: { authorization: 'Bearer token-generado-por-el-portal' },
    mode: 'sandbox',
    webhookToken: 'sandbox-webhook-secret',
    apiToken: 'sandbox-api-token',
    allowLegacySandboxProbe: true,
    now: 1_800_003,
  });
  assert.strictEqual(verifiedTemporaryTunnelProbe.sandboxTest, true);
  assert.strictEqual(verifiedTemporaryTunnelProbe.sandboxUnverified, true);
  assert.throws(
    () => verifyEnviaSandboxTestWebhook({
      rawBody: sandboxTestBody,
      headers: { authorization: 'Bearer sandbox-secret' },
      mode: 'production',
      webhookToken: 'sandbox-secret',
    }),
    (error) => error.code === 'UNSIGNED_SHIPPING_WEBHOOK_FORBIDDEN'
  );
  assert.throws(
    () => verifyEnviaSandboxTestWebhook({
      rawBody: sandboxTestBody,
      headers: { authorization: 'Bearer incorrecto' },
      mode: 'sandbox',
      webhookToken: 'sandbox-secret',
      apiToken: 'sandbox-api-token',
    }),
    (error) => error.code === 'INVALID_SANDBOX_WEBHOOK_AUTHORIZATION'
  );
  ok('la prueba v1 acepta credenciales válidas y limita la compatibilidad legacy al túnel Sandbox autorizado');

  const generateWithPickup = pickupOnGeneratePayload(
    {
      packages: [
        { amount: 2, weight: 1.25 },
        { amount: 1, weight: 0.5 },
      ],
      shipment: { type: 1, carrier: 'fedex', service: 'ground' },
    },
    '2026-08-21'
  );
  assert.deepStrictEqual(generateWithPickup.shipment.pickup, {
    date: '2026-08-21',
    totalPackages: 3,
    totalWeight: 3,
  });
  ok('pickup_on_generate incorpora fecha, número de paquetes y peso total en la guía');

  const standalonePickup = buildStandalonePickupPayload({
    shipmentPayload: {
      origin: { country: 'CO', city: '08001000' },
      packages: [
        { amount: 2, weight: 1.25 },
        { amount: 1, weight: 0.5 },
      ],
    },
    carrier: 'fedex',
    trackingNumber: 'TEST-001',
    requestedDate: '2026-08-21',
    timeFrom: '09:30',
    timeTo: '14:00',
    instructions: 'Tocar el timbre de la bodega',
  });
  assert.deepStrictEqual(standalonePickup, {
    origin: { country: 'CO', city: '08001000' },
    shipment: {
      type: 1,
      carrier: 'fedex',
      pickup: {
        weightUnit: 'KG',
        totalWeight: 3,
        totalPackages: 3,
        date: '2026-08-21',
        timeFrom: 9.5,
        timeTo: 14,
        carrier: 'fedex',
        trackingNumbers: ['TEST-001'],
        instructions: 'Tocar el timbre de la bodega',
      },
    },
  });
  ok('la recolección independiente usa el contrato canónico origin + shipment.pickup');

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

  const officialWebhook = webhookTrackingEvent({
    type: 'tracking.simple',
    created_at: '2026-08-20T12:00:00.000Z',
    data: {
      shipment_id: 98765,
      tracking_number: 'TEST-TRACK-1',
      carrier_name: 'FedEx',
      status: 'delivered',
      status_description: 'Entregado al destinatario',
      location: 'Bogotá',
    },
  });
  assert.strictEqual(officialWebhook.trackingNumber, 'TEST-TRACK-1');
  assert.strictEqual(officialWebhook.providerShipmentId, '98765');
  assert.strictEqual(officialWebhook.event.status, 'delivered');

  const webhookShipment = {
    _id: 'shipment-1',
    status: 'packed',
    allocationIds: ['allocation-1'],
    carrier: { trackingNumber: 'TEST-TRACK-1' },
    shippingIntegration: { provider: 'envia', status: 'tracking', trackingEvents: [] },
    history: [],
  };
  const webhookOrder = {
    status: 'paid',
    inventoryAllocations: [{
      _id: 'allocation-1',
      quantity: 1,
      reservedQuantity: 1,
      soldQuantity: 1,
      returnedQuantity: 0,
      shippedQuantity: 0,
      deliveredQuantity: 0,
    }],
    fulfillment: {
      shipments: [webhookShipment],
      logisticsSummary: {},
    },
  };
  const appliedWebhook = applyProviderTrackingUpdate(
    webhookOrder,
    webhookShipment,
    officialWebhook.event,
    {
      provider: 'envia',
      source: 'webhook',
      eventId: 'evt-official-1',
      receivedAt: new Date('2026-08-20T12:00:01.000Z'),
    }
  );
  assert.strictEqual(appliedWebhook.stage, 'delivered');
  assert.strictEqual(webhookShipment.status, 'delivered');
  assert.strictEqual(webhookOrder.inventoryAllocations[0].deliveredQuantity, 1);
  assert.strictEqual(providerStage('Undeliverable address'), 'exception');
  assert.strictEqual(providerStage('Delivery exception'), 'exception');
  ok('el webhook oficial actualiza guía, orden e inventario sin intervención manual');

  let durableOrderSaves = 0;
  const durableShipment = {
    _id: 'shipment-durable-1',
    status: 'packed',
    allocationIds: ['allocation-durable-1'],
    carrier: { trackingNumber: 'DURABLE-TRACK-1' },
    shippingIntegration: { provider: 'envia', status: 'tracking', trackingEvents: [] },
    history: [],
  };
  const durableOrder = {
    _id: 'order-durable-1',
    status: 'paid',
    inventoryAllocations: [{
      _id: 'allocation-durable-1',
      quantity: 1,
      reservedQuantity: 1,
      soldQuantity: 1,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      returnedQuantity: 0,
    }],
    fulfillment: { shipments: [durableShipment], logisticsSummary: {} },
    async save() { durableOrderSaves += 1; },
  };
  const durableEvent = {
    _id: 'webhook-event-1',
    provider: 'envia',
    eventId: 'evt-durable-1',
    eventType: 'tracking.simple',
    providerTimestamp: new Date('2026-08-20T12:00:00.000Z'),
    status: 'received',
    attempts: 0,
    payload: {
      type: 'tracking.simple',
      data: {
        shipment_id: 12345,
        tracking_number: 'DURABLE-TRACK-1',
        carrier_name: 'FedEx',
        status: 'delivered',
        status_description: 'Entregado al destinatario',
      },
    },
    async save() {},
  };
  const DurableEventModel = {
    async findOneAndUpdate() {
      if (!['received', 'failed'].includes(durableEvent.status)) return null;
      durableEvent.status = 'processing';
      durableEvent.attempts += 1;
      return durableEvent;
    },
  };
  const DurableOrderModel = {
    async findOne() { return durableOrder; },
  };
  const durableResult = await processShippingWebhookEvent('webhook-event-1', {
    EventModel: DurableEventModel,
    OrderModel: DurableOrderModel,
    now: new Date('2026-08-20T12:00:01.000Z'),
  });
  const duplicateDurableResult = await processShippingWebhookEvent('webhook-event-1', {
    EventModel: DurableEventModel,
    OrderModel: DurableOrderModel,
    now: new Date('2026-08-20T12:00:02.000Z'),
  });
  assert.strictEqual(durableResult.processed, true);
  assert.strictEqual(duplicateDurableResult.skipped, true);
  assert.strictEqual(durableEvent.status, 'processed');
  assert.strictEqual(durableEvent.attempts, 1);
  assert.strictEqual(durableOrderSaves, 1);
  ok('el procesamiento durable reclama cada webhook una sola vez y permite recuperación segura');

  console.log(`\n${checks.length} verificaciones de transportadoras completadas.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
