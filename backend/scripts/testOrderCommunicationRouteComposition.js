/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const emailRouter = require('../routes/orderEmailRoutes');
const customerNotificationRouter = require(
  '../routes/orderCustomerNotificationRoutes'
);
const {
  createOrderEmailController,
} = require('../controllers/orderEmailController');
const {
  createOrderCustomerNotificationController,
} = require('../controllers/orderCustomerNotificationController');
const {
  buildEmailContent,
  normalizeEmailAction,
} = require('../services/orderEmailContentService');
const notificationOrchestrator = require(
  '../services/orderCustomerNotificationOrchestrator'
);

const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK ${passed}: ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function lineCount(relativePath) {
  return read(relativePath).split(/\r?\n/).length;
}

function routeView(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
      handlers: layer.route.stack.map((handler) => handler.name),
    }));
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

async function run() {
  assert(lineCount('backend/routes/orderEmailRoutes.js') <= 180);
  assert(
    lineCount('backend/routes/orderCustomerNotificationRoutes.js') <= 180
  );
  for (const routePath of [
    'backend/routes/orderEmailRoutes.js',
    'backend/routes/orderCustomerNotificationRoutes.js',
  ]) {
    const source = read(routePath);
    assert(!source.includes("require('../models/"));
    assert(!source.includes("require('mongoose')"));
    assert(!/router\.(?:get|post|patch|put|delete)\([^]*?async\s*\(/.test(source));
  }
  ok('los routers son fachadas delgadas sin persistencia ni orquestación embebida');

  assert.deepStrictEqual(routeView(emailRouter), [
    {
      path: '/:id/email',
      methods: ['post'],
      handlers: [
        'requireAdmin',
        'requirePermissionMiddleware',
        'sendOrderEmail',
      ],
    },
  ]);
  assert.deepStrictEqual(routeView(customerNotificationRouter), [
    {
      path: '/:id/customer-notifications/whatsapp/preview',
      methods: ['get'],
      handlers: [
        'requireAdmin',
        'requirePermissionMiddleware',
        'previewOrderWhatsApp',
      ],
    },
    {
      path: '/:id/customer-notifications/whatsapp/opened',
      methods: ['post'],
      handlers: [
        'requireAdmin',
        'requirePermissionMiddleware',
        'recordOrderWhatsAppOpened',
      ],
    },
  ]);
  ok('métodos, paths, autenticación, permisos y orden de middleware permanecen iguales');

  assert.strictEqual(normalizeEmailAction('confirmación'), 'confirmation');
  assert.strictEqual(normalizeEmailAction('factura'), 'invoice');
  assert.strictEqual(normalizeEmailAction('estado'), 'status');
  assert.strictEqual(normalizeEmailAction('pago'), 'payment');
  const content = buildEmailContent(
    {
      orderNumber: 'ORD-001',
      status: 'paid',
      total: 50000,
      customer: {
        name: '<Cliente>',
        email: 'cliente@example.com',
      },
      payment: { providerLabel: 'Wompi', status: 'paid' },
      items: [
        {
          title: '<Producto>',
          quantity: 1,
          price: 50000,
          variantLabel: 'M / Azul',
        },
      ],
    },
    'confirmation'
  );
  assert(content.subject.includes('ORD-001'));
  assert(content.html.includes('&lt;Cliente&gt;'));
  assert(content.html.includes('&lt;Producto&gt;'));
  assert(!content.html.includes('<Producto>'));
  assert(content.text.includes('M / Azul'));
  ok('plantillas, alias y escape HTML conservan el contrato anterior');

  const sentMessages = [];
  const events = [];
  const orderId = '68a000000000000000000001';
  const order = {
    _id: orderId,
    orderNumber: 'ORD-001',
    status: 'paid',
    total: 50000,
    customer: { name: 'Cliente', email: 'cliente@example.com' },
    payment: { status: 'paid' },
    items: [{ title: 'Producto', quantity: 1, price: 50000 }],
  };
  const sendOrderEmail = createOrderEmailController({
    OrderModel: {
      findOne() {
        return { lean: async () => order };
      },
    },
    OrderEventModel: {
      async create(payload) {
        events.push(payload);
      },
    },
    sendMailImpl: async (payload) => {
      sentMessages.push(payload);
      return { messageId: 'mail-001', response: 'accepted' };
    },
    buildScopedOrderFilterImpl: () => ({ ok: true, filter: { _id: orderId } }),
  });
  const emailResponse = responseRecorder();
  await sendOrderEmail(
    {
      params: { id: orderId },
      body: { action: 'confirmacion' },
      adminUsername: 'admin-prueba',
    },
    emailResponse
  );
  assert.strictEqual(emailResponse.statusCode, 200);
  assert.deepStrictEqual(emailResponse.body, {
    ok: true,
    type: 'confirmation',
    to: 'cliente@example.com',
    message: 'Correo enviado correctamente a cliente@example.com.',
    messageId: 'mail-001',
  });
  assert.strictEqual(sentMessages.length, 1);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'email_sent');
  assert.strictEqual(events[0].meta.by, 'admin-prueba');
  ok('el controlador de correo conserva envío, respuesta y evento auditado mediante DI');

  const invalidResponse = responseRecorder();
  await sendOrderEmail(
    { params: { id: orderId }, body: { action: 'desconocido' } },
    invalidResponse
  );
  assert.strictEqual(invalidResponse.statusCode, 400);
  assert.strictEqual(invalidResponse.body.error, 'INVALID_EMAIL_TYPE');
  assert.deepStrictEqual(invalidResponse.body.allowed, [
    'confirmation',
    'invoice',
    'status',
    'payment',
  ]);
  assert.strictEqual(sentMessages.length, 1);
  ok('validaciones y códigos de correo fallan antes de producir efectos');

  const notificationController = createOrderCustomerNotificationController({
    buildPreviewImpl: async () => ({ preview: { fingerprint: 'preview-001' } }),
    recordWhatsAppOpenedImpl: async () => ({
      notification: { _id: 'notification-001', openCount: 2 },
    }),
  });
  const previewResponse = responseRecorder();
  await notificationController.previewOrderWhatsApp({}, previewResponse);
  assert.deepStrictEqual(previewResponse.body, {
    ok: true,
    mode: 'assisted',
    deliveryConfirmed: false,
    preview: { fingerprint: 'preview-001' },
  });
  const openedResponse = responseRecorder();
  await notificationController.recordOrderWhatsAppOpened({}, openedResponse);
  assert.deepStrictEqual(openedResponse.body, {
    ok: true,
    mode: 'assisted',
    deliveryConfirmed: false,
    notificationId: 'notification-001',
    openCount: 2,
    message:
      'WhatsApp abierto con el informe preparado. El administrador debe confirmar el envío dentro de WhatsApp.',
  });
  ok('controladores WhatsApp conservan modo asistido y nunca afirman entrega externa');

  [
    'createOrderCustomerNotificationOrchestrator',
    'loadScopedOrder',
    'loadSourceEvent',
    'buildPreview',
    'recordWhatsAppOpened',
  ].forEach((exportName) => {
    assert.strictEqual(
      typeof notificationOrchestrator[exportName],
      'function',
      exportName
    );
  });
  const orchestratorSource = read(
    'backend/services/orderCustomerNotificationOrchestrator.js'
  );
  assert(orchestratorSource.includes('buildScopedOrderFilterImpl'));
  assert(orchestratorSource.includes("type: 'whatsapp_opened'"));
  assert(orchestratorSource.includes('deliveryConfirmed: false'));
  assert(orchestratorSource.includes('$setOnInsert'));
  assert(orchestratorSource.includes('$inc'));
  assert(!orchestratorSource.includes('axios'));
  assert(!orchestratorSource.includes('fetch('));
  ok('orquestación WhatsApp conserva alcance, idempotencia, auditoría y cero proveedores');

  console.log(
    `\nComposición de comunicaciones de Órdenes: ${passed}/${passed} controles superados.`
  );
}

run().catch((error) => {
  console.error('\nFALLO composición de comunicaciones:', error);
  process.exitCode = 1;
});
