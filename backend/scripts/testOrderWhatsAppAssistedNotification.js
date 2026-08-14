const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  CUSTOMER_NOTIFIABLE_EVENT_TYPES,
  buildOrderWhatsAppPreview,
  isCustomerNotifiableEventType,
  normalizeWhatsappPhone,
  resolveCustomerWhatsapp,
} = require('../services/orderCustomerNotificationService');

const ROOT = path.join(__dirname, '..', '..');
const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function ok(message) {
  checks.push(message);
  console.log(`OK  ${message}`);
}

function baseOrder(overrides = {}) {
  return {
    _id: '66b900000000000000000001',
    orderNumber: 'OTR-WHATSAPP-001',
    status: 'paid',
    createdAt: new Date('2026-08-14T15:00:00.000Z'),
    updatedAt: new Date('2026-08-14T16:00:00.000Z'),
    customer: {
      name: 'María',
      lastname: 'Pérez',
      phone: '300 123 4567',
      email: 'maria@example.com',
    },
    billing: {
      phone: '',
    },
    fulfillment: {
      shipments: [],
    },
    ...overrides,
  };
}

function main() {
  assert.strictEqual(normalizeWhatsappPhone('300 123 4567'), '573001234567');
  assert.strictEqual(normalizeWhatsappPhone('+57 300 123 4567'), '573001234567');
  assert.strictEqual(normalizeWhatsappPhone('0057 300 123 4567'), '573001234567');
  ok('normaliza celulares colombianos al formato internacional de WhatsApp');

  assert.strictEqual(normalizeWhatsappPhone('cliente@example.com'), '');
  assert.strictEqual(normalizeWhatsappPhone('12345'), '');
  ok('rechaza correos y números insuficientes como destino de WhatsApp');

  const billingFallback = resolveCustomerWhatsapp(
    baseOrder({
      customer: { name: 'María', emailOrPhone: 'maria@example.com' },
      billing: { phone: '3017654321' },
    })
  );
  assert.strictEqual(billingFallback.phone, '573017654321');
  assert.ok(!billingFallback.maskedPhone.includes('573017654321'));
  ok('usa el teléfono fiscal como respaldo y nunca expone el número completo');

  const paidPreview = buildOrderWhatsAppPreview({
    order: baseOrder(),
    event: {
      _id: '66b900000000000000000010',
      type: 'status_changed',
      createdAt: new Date('2026-08-14T16:00:00.000Z'),
      meta: { from: 'pending', to: 'paid' },
    },
    store: { name: 'Rosa Boutique' },
  });
  assert.strictEqual(paidPreview.report.stage, 'Pago confirmado');
  assert.ok(paidPreview.message.includes('*Qué pasó:*'));
  assert.ok(paidPreview.message.includes('*Estado actual:*'));
  assert.ok(paidPreview.message.includes('*Qué sigue:*'));
  ok('el informe de pago cuenta qué pasó, el estado actual y el siguiente paso');

  const shipmentId = '66b900000000000000000020';
  const dispatchOrder = baseOrder({
    status: 'shipped',
    fulfillment: {
      shipments: [
        {
          _id: shipmentId,
          code: 'SHP-WHATSAPP-001',
          status: 'dispatched',
          branchSnapshot: { name: 'Sede Principal', code: 'PRINCIPAL' },
          carrier: {
            name: 'Envia',
            trackingNumber: 'GUIA-123456',
            trackingUrl: 'https://transportadora.example/GUIA-123456',
          },
          sla: { deliveryDueAt: new Date('2026-08-17T20:00:00.000Z') },
          updatedAt: new Date('2026-08-14T17:00:00.000Z'),
          internalNote: 'NO MOSTRAR ESTA NOTA',
        },
      ],
    },
  });
  const dispatchEvent = {
    _id: '66b900000000000000000021',
    type: 'logistics_dispatch',
    createdAt: new Date('2026-08-14T17:00:00.000Z'),
    meta: { shipmentId, shipmentCode: 'SHP-WHATSAPP-001' },
  };
  const dispatchPreview = buildOrderWhatsAppPreview({
    order: dispatchOrder,
    event: dispatchEvent,
    store: { businessName: 'Rosa Boutique S.A.S.' },
  });
  assert.strictEqual(dispatchPreview.report.stage, 'Pedido despachado');
  assert.ok(dispatchPreview.message.includes('Envia'));
  assert.ok(dispatchPreview.message.includes('GUIA-123456'));
  assert.ok(dispatchPreview.message.includes('Entrega estimada'));
  assert.ok(!dispatchPreview.message.includes('NO MOSTRAR ESTA NOTA'));
  ok('el despacho incluye sede, transportadora, guía y promesa sin notas internas');

  assert.ok(dispatchPreview.whatsappUrl.startsWith('https://wa.me/573001234567?text='));
  assert.ok(dispatchPreview.whatsappUrl.includes('Qu%C3%A9%20pas%C3%B3'));
  ok('genera un enlace wa.me codificado hacia el celular del cliente');

  const repeatedPreview = buildOrderWhatsAppPreview({
    order: dispatchOrder,
    event: dispatchEvent,
    store: { businessName: 'Rosa Boutique S.A.S.' },
  });
  assert.strictEqual(repeatedPreview.fingerprint, dispatchPreview.fingerprint);
  assert.strictEqual(repeatedPreview.templateVersion, 'orders-whatsapp-assisted-v1');
  ok('la misma etapa conserva una huella determinística para controlar repeticiones');

  const incidentPreview = buildOrderWhatsAppPreview({
    order: dispatchOrder,
    event: {
      _id: '66b900000000000000000022',
      type: 'logistics_report_incident',
      createdAt: new Date('2026-08-14T18:00:00.000Z'),
      meta: {
        shipmentId,
        description: 'Dato operativo reservado que no debe salir',
        severity: 'critical',
      },
    },
    store: { name: 'Rosa Boutique' },
  });
  assert.strictEqual(incidentPreview.report.stage, 'Novedad en la entrega');
  assert.ok(!incidentPreview.message.includes('Dato operativo reservado'));
  assert.ok(!incidentPreview.message.includes('critical'));
  ok('las incidencias usan redacción segura y no filtran detalles administrativos');

  assert.throws(
    () =>
      buildOrderWhatsAppPreview({
        order: baseOrder({
          customer: { name: 'Sin teléfono', email: 'sin@example.com' },
          billing: {},
        }),
        store: { name: 'Rosa Boutique' },
      }),
    (error) => error.code === 'ORDER_WHATSAPP_PHONE_REQUIRED'
  );
  ok('bloquea la preparación cuando la orden no tiene un celular válido');

  assert.ok(isCustomerNotifiableEventType('logistics_deliver'));
  assert.ok(isCustomerNotifiableEventType('payment_updated'));
  assert.ok(!isCustomerNotifiableEventType('note_created'));
  assert.ok(!isCustomerNotifiableEventType('tags_updated'));
  assert.ok(!isCustomerNotifiableEventType('logistics_update_plan'));
  assert.ok(CUSTOMER_NOTIFIABLE_EVENT_TYPES.length >= 10);
  ok('solo etapas aptas para clientes pueden alimentar el informe');

  const routeSource = read('backend/routes/orderCustomerNotificationRoutes.js');
  assert.ok(routeSource.includes("requirePermission('orders:email')"));
  assert.ok(routeSource.includes('buildScopedOrderFilter'));
  assert.ok(routeSource.includes('deliveryConfirmed: false'));
  assert.ok(!routeSource.includes('axios'));
  assert.ok(!routeSource.includes('fetch('));
  ok('las rutas son privadas, respetan la sede y no simulan una entrega externa');

  const modelSource = read('backend/models/OrderCustomerNotification.js');
  assert.ok(modelSource.includes('order_customer_notification_idempotency'));
  assert.ok(modelSource.includes('fingerprint'));
  assert.ok(modelSource.includes('recipientMasked'));
  ok('la auditoría agrega idempotencia y almacena únicamente el destino enmascarado');

  const indexSource = read('backend/index.js');
  assert.ok(indexSource.includes("'./routes/orderCustomerNotificationRoutes'"));
  assert.ok(
    indexSource.indexOf("app.use('/api/orders', orderCustomerNotificationRoutes)") <
      indexSource.indexOf("app.use('/api/orders', orderRoutes)")
  );
  ok('el backend monta las notificaciones antes de la ruta general de órdenes');

  const modalSource = read(
    'frontend/src/admin/orders/components/OrderDetailModal.jsx'
  );
  const toolbarSource = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailActionToolbar.jsx'
  );
  const previewSource = read(
    'frontend/src/admin/orders/components/orderDetail/OrderWhatsAppPreview.jsx'
  );
  assert.ok(modalSource.includes('saveStatusAndOfferWhatsApp'));
  assert.ok(modalSource.includes('Etapa confirmada'));
  assert.ok(toolbarSource.includes('Informar por WhatsApp'));
  assert.ok(previewSource.includes('Mensaje que verá el cliente'));
  assert.ok(previewSource.includes('Abrir WhatsApp'));
  ok('la interfaz ofrece el informe después de confirmar y también como acción permanente');

  const logisticsSource = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailLogisticsPanel.jsx'
  );
  assert.ok(logisticsSource.includes('CUSTOMER_STAGE_LABELS'));
  assert.ok(logisticsSource.includes('onCustomerStageConfirmed'));
  assert.ok(!logisticsSource.includes("update_plan: '"));
  ok('picking, empaque, despacho, tránsito, entrega e incidencias activan el aviso rápido');

  console.log(
    `\nWhatsApp asistido para Órdenes: ${checks.length}/${checks.length} controles superados.`
  );
}

try {
  main();
} catch (error) {
  console.error('\nFALLO WhatsApp asistido para Órdenes:', error);
  process.exitCode = 1;
}
