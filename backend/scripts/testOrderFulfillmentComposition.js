'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const facade = require('../services/orderFulfillmentService');
const consumption = require('../services/orderFulfillment/consumeDigitalAccess');
const digitalAccess = require('../services/orderFulfillment/digitalAccess');
const notification = require('../services/orderFulfillment/notification');
const planning = require('../services/orderFulfillment/planning');
const presentation = require('../services/orderFulfillment/presentation');
const processor = require('../services/orderFulfillment/processAfterPayment');
const serviceTransition = require('../services/orderFulfillment/serviceTransition');

const checks = [];

async function check(name, callback) {
  await callback();
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFulfillmentFixture(overrides = {}) {
  const trace = [];
  const now = new Date('2026-08-27T10:00:00.000Z');
  const order = {
    _id: '507f1f77bcf86cd799439011',
    orderNumber: 'ORDER-FULFILLMENT-1',
    status: 'paid',
    payment: { status: 'paid' },
    billing: { email: ' Buyer@Example.COM ' },
    items: [
      {
        _id: '507f1f77bcf86cd799439021',
        product: '507f1f77bcf86cd799439031',
        title: 'Guía <Digital>',
        productType: 'digital',
        quantity: 1,
        requiresShipping: false,
      },
      {
        _id: '507f1f77bcf86cd799439022',
        product: '507f1f77bcf86cd799439032',
        title: 'Consulta remota',
        productType: 'service',
        quantity: 2,
        requiresShipping: false,
      },
    ],
    fulfillment: { notificationStatus: 'pending' },
    async save() {
      trace.push({ action: 'save' });
    },
    ...overrides.order,
  };
  const products = [
    {
      _id: '507f1f77bcf86cd799439031',
      title: 'Guía digital',
      digitalDelivery: {
        deliveryMode: 'automatic',
        assetUrl: 'https://private.example/guide.pdf',
        fileName: 'guide.pdf',
        downloadLimit: 2,
        accessDays: 10,
        customerMessage: 'Conserva tu guía.',
      },
    },
    {
      _id: '507f1f77bcf86cd799439032',
      title: 'Consulta',
      serviceDelivery: {
        fulfillmentMode: 'scheduled',
        locationType: 'online',
        durationMinutes: 90,
        leadTimeHours: 12,
        bookingUrl: 'https://booking.example/reserve',
        customerInstructions: 'Agenda tu sesión.',
        internalInstructions: 'Validar identidad.',
      },
    },
  ];
  const OrderModel = {
    findById(identifier) {
      trace.push({ action: 'find-order', identifier });
      return {
        async select(selection) {
          trace.push({ action: 'select-order', selection });
          return overrides.notFound ? null : order;
        },
      };
    },
    async updateOne(filter, update) {
      trace.push({ action: 'update-order', filter: clone(filter), update: clone(update) });
      return { modifiedCount: overrides.updateConflict ? 0 : 1 };
    },
    async findOneAndUpdate(filter, update, options) {
      trace.push({
        action: 'claim-notification',
        filter: clone(filter),
        update: clone(update),
        options: clone(options),
      });
      return overrides.noNotificationClaim ? null : order;
    },
  };
  const ProductModel = {
    find(filter) {
      trace.push({ action: 'find-products', filter: clone(filter) });
      return {
        select(selection) {
          trace.push({ action: 'select-products', selection });
          return {
            async lean() {
              return overrides.products || products;
            },
          };
        },
      };
    },
  };
  const mailer = async (message) => {
    trace.push({ action: 'send-mail', message });
    if (overrides.mailFailure) throw new Error('Proveedor de correo no disponible.');
  };

  return {
    now,
    order,
    trace,
    dependencies: { OrderModel, ProductModel, mailer },
  };
}

function createServiceTransitionFixture(overrides = {}) {
  const orderId = '507f1f77bcf86cd799439041';
  const serviceId = '507f1f77bcf86cd799439042';
  const state = {
    order: {
      _id: orderId,
      updatedAt: '2026-08-27T10:00:00.000Z',
      status: 'paid',
      payment: { status: 'paid' },
      items: [{ productType: 'service', requiresShipping: false }],
      fulfillmentStatus: 'processing',
      fulfillment: {
        status: 'action_required',
        notificationStatus: 'sent',
        digitalDeliveries: [],
        services: [
          {
            _id: serviceId,
            title: 'Consultoría',
            fulfillmentMode: 'scheduled',
            status: 'in_progress',
            scheduledAt: '2026-08-27T09:00:00.000Z',
            completedAt: null,
            notes: '',
          },
        ],
      },
      ...(overrides.order || {}),
    },
    events: [],
  };
  const trace = [];
  let waitingReads = 0;
  let releaseReads;
  const readsReady = new Promise((resolve) => {
    releaseReads = resolve;
  });

  function snapshot() {
    return clone(state.order);
  }

  const mongooseAdapter = {
    async startSession() {
      const undo = [];
      return {
        undo,
        async withTransaction(work) {
          try {
            await work();
            undo.length = 0;
          } catch (error) {
            while (undo.length) undo.pop()();
            throw error;
          }
        },
        async endSession() {},
      };
    },
  };

  const OrderModel = {
    findOne(filter) {
      trace.push({ action: 'find-order', filter: clone(filter) });
      const readSnapshot = snapshot();
      return {
        select() {
          return {
            async session() {
              if (overrides.synchronizeReads) {
                waitingReads += 1;
                if (waitingReads === 2) releaseReads();
                await readsReady;
              }
              return readSnapshot;
            },
          };
        },
      };
    },
    findOneAndUpdate(filter, update, options) {
      return {
        async select() {
          trace.push({
            action: 'cas-order',
            filter: clone(filter),
            update: clone(update),
            options: clone(options),
          });
          const expected = filter.$and[1];
          const currentService = state.order.fulfillment.services.find(
            (service) => String(service._id) === serviceId
          );
          const serviceMatch = expected['fulfillment.services'].$elemMatch;
          const matches =
            String(state.order._id) === String(expected._id) &&
            String(state.order.updatedAt) === String(expected.updatedAt) &&
            String(currentService?.status) === String(serviceMatch.status) &&
            (!expected['payment.status'] ||
              state.order.payment?.status === expected['payment.status']);
          if (!matches || overrides.forceCasMiss) return null;

          const before = snapshot();
          const previousRevision = String(state.order.updatedAt);
          const values = update.$set;
          currentService.status = values['fulfillment.services.$[service].status'];
          currentService.scheduledAt = values['fulfillment.services.$[service].scheduledAt'];
          currentService.completedAt = values['fulfillment.services.$[service].completedAt'];
          currentService.notes = values['fulfillment.services.$[service].notes'];
          state.order.fulfillment.status = values['fulfillment.status'];
          state.order.fulfillmentStatus = values.fulfillmentStatus;
          state.order.updatedAt = new Date(
            new Date(previousRevision).getTime() + 1000
          ).toISOString();
          const writtenRevision = String(state.order.updatedAt);
          options.session.undo.push(() => {
            if (String(state.order.updatedAt) === writtenRevision) {
              state.order = before;
            }
          });
          return snapshot();
        },
      };
    },
  };

  const OrderEventModel = {
    async create(events, options) {
      trace.push({ action: 'create-event', events: clone(events) });
      if (overrides.eventFailure) {
        throw new Error('No fue posible persistir el evento.');
      }
      const start = state.events.length;
      state.events.push(...clone(events));
      options.session.undo.push(() => state.events.splice(start));
      return events;
    },
  };

  return {
    orderId,
    serviceId,
    state,
    trace,
    dependencies: {
      mongooseAdapter,
      OrderModel,
      OrderEventModel,
      now: () => new Date('2026-08-27T11:00:00.000Z'),
    },
    transition(input = {}) {
      return serviceTransition.transitionOrderFulfillmentService(
        {
          orderFilter: { _id: orderId, wholeOrderAuthorized: true },
          serviceId,
          status: 'completed',
          actor: { id: 'admin-1', label: 'Operador QA' },
          ...input,
        },
        this.dependencies
      );
    },
  };
}

async function main() {
  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    DIGITAL_DELIVERY_TOKEN_SECRET: process.env.DIGITAL_DELIVERY_TOKEN_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
    PUBLIC_BACKEND_URL: process.env.PUBLIC_BACKEND_URL,
  };
  process.env.NODE_ENV = 'test';
  process.env.DIGITAL_DELIVERY_TOKEN_SECRET = 'fulfillment-composition-secret';
  process.env.PUBLIC_BACKEND_URL = 'https://backend.example/';

  try {
    await check('la fachada conserva exactamente sus siete exports y referencias', async () => {
      assert.deepEqual(Object.keys(facade), [
        'buildDigitalAccessToken',
        'hashAccessToken',
        'safeTokenMatch',
        'buildDeterministicDeliveryId',
        'buildDigitalAccessUrl',
        'processOrderFulfillmentAfterPayment',
        'consumeDigitalDeliveryAccess',
      ]);
      assert.strictEqual(facade.buildDigitalAccessToken, digitalAccess.buildDigitalAccessToken);
      assert.strictEqual(facade.hashAccessToken, digitalAccess.hashAccessToken);
      assert.strictEqual(facade.safeTokenMatch, digitalAccess.safeTokenMatch);
      assert.strictEqual(facade.buildDeterministicDeliveryId, digitalAccess.buildDeterministicDeliveryId);
      assert.strictEqual(facade.buildDigitalAccessUrl, digitalAccess.buildDigitalAccessUrl);
      assert.strictEqual(facade.processOrderFulfillmentAfterPayment, processor.processOrderFulfillmentAfterPayment);
      assert.strictEqual(facade.consumeDigitalDeliveryAccess, consumption.consumeDigitalDeliveryAccess);
    });

    await check('tokens, hashes, IDs y URLs conservan sus valores determinísticos', async () => {
      const identity = {
        orderId: '507f1f77bcf86cd799439011',
        orderItemId: 'bundle:item:component',
      };
      const token = facade.buildDigitalAccessToken(identity);
      assert.equal(token, 'AY4dNkyVO3yObLEiE4RaLRpqhiU12G24H4GXlCNEDeU');
      assert.equal(
        facade.hashAccessToken(token),
        '88e61f267595fc7f372b06e33730a56b8ae876130e9c8f7a7eb9eb3371fc8097'
      );
      assert.equal(
        String(facade.buildDeterministicDeliveryId({
          orderId: identity.orderId,
          sourceKey: identity.orderItemId,
        })),
        'b6c8ddee7f77f946a51c3d57'
      );
      assert.equal(
        facade.buildDigitalAccessUrl({
          orderNumber: 'ORDER / 1',
          deliveryId: '507f1f77bcf86cd799439012',
          token: 'a+b/c?',
        }),
        'https://backend.example/api/digital-deliveries/ORDER%20%2F%201/507f1f77bcf86cd799439012?token=a%2Bb%2Fc%3F'
      );
    });

    await check('la comparación de tokens valida el hash sin comparación variable', async () => {
      const token = facade.buildDigitalAccessToken({
        orderId: '507f1f77bcf86cd799439011',
        orderItemId: 'item-1',
      });
      const hash = facade.hashAccessToken(token);
      assert.equal(hash.length, 64);
      assert.equal(facade.safeTokenMatch(token, hash), true);
      assert.equal(facade.safeTokenMatch(`${token}x`, hash), false);
      assert.equal(facade.safeTokenMatch(token, ''), false);
      assert.equal(facade.safeTokenMatch(token, 'abcd'), false);
    });

    await check('producción rechaza la emisión de tokens cuando falta el secreto', async () => {
      delete process.env.DIGITAL_DELIVERY_TOKEN_SECRET;
      delete process.env.JWT_SECRET;
      delete process.env.ADMIN_JWT_SECRET;
      process.env.NODE_ENV = 'production';
      assert.throws(
        () => facade.buildDigitalAccessToken({ orderId: 'order', orderItemId: 'item' }),
        (error) =>
          error.code === 'DIGITAL_DELIVERY_SECRET_MISSING' &&
          error.message ===
            'Falta DIGITAL_DELIVERY_TOKEN_SECRET para habilitar descargas digitales.'
      );
      process.env.NODE_ENV = 'test';
      process.env.DIGITAL_DELIVERY_TOKEN_SECRET = 'fulfillment-composition-secret';
    });

    await check('la planificación expande digitales, servicios y componentes de combo', async () => {
      const items = [
        {
          _id: 'item-digital',
          product: 'product-digital',
          productType: 'digital',
          quantity: 2,
        },
        {
          _id: 'item-bundle',
          productType: 'bundle',
          quantity: 3,
          fulfillmentSnapshot: {
            bundle: {
              components: [
                {
                  product: 'product-service',
                  productType: 'service',
                  quantity: 2,
                  variantKey: '',
                  title: 'Servicio del combo',
                },
                { product: 'physical', productType: 'physical', quantity: 1 },
              ],
            },
          },
        },
      ];
      const relevant = planning.collectRelevantFulfillmentItems(items);
      assert.deepEqual(
        relevant.map(({ sourceKey, productType, quantity }) => ({
          sourceKey,
          productType,
          quantity,
        })),
        [
          { sourceKey: 'item-digital', productType: 'digital', quantity: 2 },
          {
            sourceKey: 'bundle:item-bundle:product-service:default__default',
            productType: 'service',
            quantity: 6,
          },
        ]
      );
      assert.deepEqual(planning.getRelevantProductIds(relevant), [
        'product-digital',
        'product-service',
      ]);
    });

    await check('la matriz de estados de fulfillment conserva todas sus decisiones', async () => {
      const status = (items, digitalDeliveries, services) =>
        planning.getFulfillmentStatus({ items, digitalDeliveries, services });
      assert.deepEqual(
        status(
          [{ requiresShipping: false }],
          [{ status: 'ready' }],
          []
        ),
        { operational: 'delivered', order: 'delivered' }
      );
      assert.deepEqual(
        status([], [{ status: 'manual' }], []),
        { operational: 'action_required', order: 'processing' }
      );
      assert.deepEqual(
        status([], [], [{ status: 'awaiting_scheduling' }]),
        { operational: 'action_required', order: 'processing' }
      );
      assert.deepEqual(
        status(
          [{ requiresShipping: true }],
          [{ status: 'ready' }],
          []
        ),
        {
          operational: 'partially_delivered',
          order: 'partially_delivered',
        }
      );
      assert.deepEqual(
        status([{ requiresShipping: true }], [], []),
        { operational: 'processing', order: 'reserved' }
      );
      assert.deepEqual(status([], [], []), {
        operational: 'pending',
        order: 'pending',
      });
    });

    await check('un servicio no puede completarse sin pago ni saltarse etapas', async () => {
      const unpaid = createServiceTransitionFixture();
      unpaid.state.order.status = 'pending';
      unpaid.state.order.payment.status = 'pending_gateway';
      unpaid.state.order.fulfillment.services[0].status =
        'awaiting_scheduling';
      await assert.rejects(
        unpaid.transition(),
        (error) =>
          error.code === 'FULFILLMENT_PAYMENT_NOT_CONFIRMED' &&
          error.statusCode === 409
      );
      assert.equal(
        unpaid.state.order.fulfillment.services[0].status,
        'awaiting_scheduling'
      );
      assert.equal(unpaid.state.events.length, 0);
      assert.equal(
        unpaid.trace.some(({ action }) => action === 'cas-order'),
        false
      );

      const paidJump = createServiceTransitionFixture();
      paidJump.state.order.fulfillment.services[0].status =
        'awaiting_scheduling';
      await assert.rejects(
        paidJump.transition(),
        (error) =>
          error.code === 'FULFILLMENT_SERVICE_TRANSITION_NOT_ALLOWED' &&
          error.details.currentStatus === 'awaiting_scheduling' &&
          error.details.targetStatus === 'completed'
      );
      assert.equal(paidJump.state.events.length, 0);
    });

    await check('las rutas programada y manual conservan transiciones válidas', async () => {
      assert.deepEqual(
        serviceTransition.allowedTargets({
          status: 'awaiting_scheduling',
          fulfillmentMode: 'scheduled',
        }),
        ['scheduled', 'cancelled']
      );
      assert.deepEqual(
        serviceTransition.allowedTargets({
          status: 'awaiting_scheduling',
          fulfillmentMode: 'manual',
        }),
        ['scheduled', 'cancelled', 'in_progress']
      );

      const fixture = createServiceTransitionFixture();
      fixture.state.order.fulfillment.digitalDeliveries = [
        { _id: 'digital-1', status: 'ready' },
      ];
      const result = await fixture.transition({
        notes: 'Prestación validada por el cliente.',
        notesProvided: true,
      });
      assert.equal(result.changed, true);
      assert.equal(result.previousStatus, 'in_progress');
      assert.equal(result.targetStatus, 'completed');
      assert.equal(result.service.status, 'completed');
      assert.equal(
        result.service.notes,
        'Prestación validada por el cliente.'
      );
      assert.equal(result.order.fulfillment.status, 'delivered');
      assert.equal(result.order.fulfillmentStatus, 'delivered');
      assert.equal(fixture.state.events.length, 1);
      assert.equal(
        fixture.state.events[0].type,
        'fulfillment_service_status_changed'
      );
      const cas = fixture.trace.find(({ action }) => action === 'cas-order');
      assert.equal(cas.filter.$and[1]['payment.status'], 'paid');
      assert.equal(
        cas.filter.$and[1]['fulfillment.services'].$elemMatch.status,
        'in_progress'
      );
      assert.equal(
        cas.options.arrayFilters[0]['service.status'],
        'in_progress'
      );
      assert.equal(
        cas.options.arrayFilters[0]['service._id'],
        fixture.serviceId
      );
    });

    await check('dos actualizaciones concurrentes producen un solo ganador y evento', async () => {
      const fixture = createServiceTransitionFixture({
        synchronizeReads: true,
      });
      const outcomes = await Promise.allSettled([
        fixture.transition(),
        fixture.transition(),
      ]);
      assert.equal(
        outcomes.filter((outcome) => outcome.status === 'fulfilled').length,
        1
      );
      assert.equal(
        outcomes.filter(
          (outcome) =>
            outcome.status === 'rejected' &&
            outcome.reason?.code ===
              'FULFILLMENT_SERVICE_CONCURRENT_MODIFICATION'
        ).length,
        1
      );
      assert.equal(
        fixture.state.order.fulfillment.services[0].status,
        'completed'
      );
      assert.equal(fixture.state.events.length, 1);
    });

    await check('CAS y transacción impiden eventos huérfanos o estados sin evento', async () => {
      const casMiss = createServiceTransitionFixture({ forceCasMiss: true });
      await assert.rejects(
        casMiss.transition(),
        (error) =>
          error.code === 'FULFILLMENT_SERVICE_CONCURRENT_MODIFICATION'
      );
      assert.equal(
        casMiss.state.order.fulfillment.services[0].status,
        'in_progress'
      );
      assert.equal(casMiss.state.events.length, 0);
      assert.equal(
        casMiss.trace.some(({ action }) => action === 'create-event'),
        false
      );

      const eventFailure = createServiceTransitionFixture({
        eventFailure: true,
      });
      await assert.rejects(
        eventFailure.transition(),
        /No fue posible persistir el evento/
      );
      assert.equal(
        eventFailure.state.order.fulfillment.services[0].status,
        'in_progress'
      );
      assert.equal(eventFailure.state.events.length, 0);
    });

    await check('la presentación conserva HTML escapado y contenido exacto', async () => {
      const message = presentation.buildFulfillmentEmail({
        orderNumber: 'ORDER-<1>',
        fulfillment: {
          digitalDeliveries: [
            {
              status: 'ready',
              accessUrl: 'https://x.example/a?x=<y>',
              title: 'Guía & Curso',
              fileName: 'a<b>.pdf',
              expiresAt: null,
              downloadLimit: 2,
            },
            {
              status: 'manual',
              title: 'Manual <X>',
              customerMessage: 'Coordinar & esperar',
            },
          ],
          services: [
            {
              title: 'Consulta "VIP"',
              durationMinutes: 90,
              bookingUrl: 'https://book.example/?a=1&b=2',
              customerInstructions: 'Llevar <ID>',
            },
          ],
        },
      });
      assert.equal(message.subject, 'Entrega de tu pedido ORDER-<1>');
      assert.equal(
        crypto.createHash('sha256').update(message.html).digest('hex'),
        'efb85147907815559cb51db262a94b3ee442b6d7c76ec7f03e9c61368971ac8a'
      );
    });

    await check('el procesamiento conserva materialización, persistencia, reclamo y correo en orden', async () => {
      const fixture = createFulfillmentFixture();
      const result = await facade.processOrderFulfillmentAfterPayment(
        { orderId: fixture.order._id, now: fixture.now },
        fixture.dependencies
      );
      assert.equal(result.notified, true);
      assert.equal(fixture.order.fulfillment.status, 'action_required');
      assert.equal(fixture.order.fulfillmentStatus, 'partially_delivered');
      assert.equal(fixture.order.fulfillment.digitalDeliveries.length, 1);
      assert.equal(fixture.order.fulfillment.services.length, 1);
      assert.equal(
        facade.safeTokenMatch(
          facade.buildDigitalAccessToken({
            orderId: fixture.order._id,
            orderItemId: String(fixture.order.items[0]._id),
          }),
          fixture.order.fulfillment.digitalDeliveries[0].accessTokenHash
        ),
        true
      );
      assert.deepEqual(
        fixture.trace.map(({ action }) => action),
        [
          'find-order',
          'select-order',
          'find-products',
          'select-products',
          'update-order',
          'claim-notification',
          'send-mail',
          'update-order',
        ]
      );
      const mail = fixture.trace.find(({ action }) => action === 'send-mail').message;
      assert.equal(mail.to, 'buyer@example.com');
      assert(mail.html.includes('Guía &lt;Digital&gt;'));
      assert(!mail.html.includes('Validar identidad.'));
    });

    await check('un reclamo existente evita duplicar el correo', async () => {
      const fixture = createFulfillmentFixture({ noNotificationClaim: true });
      const result = await facade.processOrderFulfillmentAfterPayment(
        { orderId: fixture.order._id, now: fixture.now },
        fixture.dependencies
      );
      assert.equal(result.reused, true);
      assert.equal(result.notificationInProgress, true);
      assert.equal(
        fixture.trace.some(({ action }) => action === 'send-mail'),
        false
      );
    });

    await check('un fallo de correo queda trazado y permite reintento posterior', async () => {
      const fixture = createFulfillmentFixture({ mailFailure: true });
      const result = await facade.processOrderFulfillmentAfterPayment(
        { orderId: fixture.order._id, now: fixture.now },
        fixture.dependencies
      );
      assert.equal(result.notified, false);
      assert.equal(result.notificationError, 'Proveedor de correo no disponible.');
      const failureUpdate = fixture.trace.at(-1).update.$set;
      assert.equal(failureUpdate['fulfillment.notificationStatus'], 'failed');
      assert.equal(
        failureUpdate['fulfillment.notificationError'],
        'Proveedor de correo no disponible.'
      );
    });

    await check('un worker con lease vencido no puede sobrescribir el resultado del nuevo claim', async () => {
      const order = {
        _id: '507f1f77bcf86cd799439011',
        orderNumber: 'ORDER-NOTIFICATION-FENCE',
        billing: { email: 'buyer@example.com' },
        fulfillment: {
          notificationStatus: 'pending',
          notificationClaimId: '',
          notificationClaimedAt: null,
          digitalDeliveries: [],
          services: [],
        },
      };
      const state = order.fulfillment;
      const updates = [];
      const matchesClaim = (filter) =>
        String(filter?._id) === String(order._id) &&
        (!filter['fulfillment.notificationStatus'] ||
          filter['fulfillment.notificationStatus'] === state.notificationStatus) &&
        (!filter['fulfillment.notificationClaimId'] ||
          filter['fulfillment.notificationClaimId'] === state.notificationClaimId);
      const OrderModel = {
        async findOneAndUpdate(filter, update) {
          const pending = state.notificationStatus === 'pending';
          const failed = state.notificationStatus === 'failed';
          const stale =
            state.notificationStatus === 'sending' &&
            new Date(state.notificationClaimedAt) <
              new Date(filter.$or[1]['fulfillment.notificationClaimedAt'].$lt);
          if (!pending && !failed && !stale) return null;
          Object.entries(update.$set).forEach(([path, value]) => {
            state[path.split('.').at(-1)] = value;
          });
          return order;
        },
        async updateOne(filter, update) {
          updates.push({ filter: clone(filter), update: clone(update) });
          if (!matchesClaim(filter)) {
            return { matchedCount: 0, modifiedCount: 0 };
          }
          Object.entries(update.$set).forEach(([path, value]) => {
            state[path.split('.').at(-1)] = value;
          });
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
      let releaseOld;
      let oldStarted;
      const oldStartedPromise = new Promise((resolve) => {
        oldStarted = resolve;
      });
      const releaseOldPromise = new Promise((resolve) => {
        releaseOld = resolve;
      });
      const oldWorker = notification.sendFulfillmentNotification({
        order,
        previous: { notificationStatus: 'pending' },
        now: new Date('2026-08-27T10:00:00.000Z'),
        OrderModel,
        randomUUID: () => 'notification-old-claim',
        mailer: async () => {
          oldStarted();
          await releaseOldPromise;
          throw new Error('old worker failed after its lease expired');
        },
      });
      await oldStartedPromise;
      const newWorker = await notification.sendFulfillmentNotification({
        order,
        previous: { notificationStatus: 'sending' },
        now: new Date('2026-08-27T10:11:00.000Z'),
        OrderModel,
        randomUUID: () => 'notification-new-claim',
        mailer: async () => {},
      });
      assert.equal(newWorker.notified, true);
      assert.equal(state.notificationStatus, 'sent');
      assert.equal(state.notificationClaimId, '');

      releaseOld();
      const oldResult = await oldWorker;
      assert.equal(oldResult.notified, false);
      assert.equal(state.notificationStatus, 'sent');
      assert.equal(state.notificationError, '');
      assert.equal(
        updates.at(-1).filter['fulfillment.notificationClaimId'],
        'notification-old-claim'
      );
    });

    await check('las órdenes no pagadas y sin contenido electrónico conservan sus salidas', async () => {
      const unpaid = createFulfillmentFixture({
        order: {
          status: 'pending',
          payment: { status: 'pending' },
        },
      });
      const unpaidResult = await facade.processOrderFulfillmentAfterPayment(
        { orderId: unpaid.order._id, now: unpaid.now },
        unpaid.dependencies
      );
      assert.equal(unpaidResult.reason, 'payment_not_confirmed');
      assert.deepEqual(unpaid.trace.map(({ action }) => action), [
        'find-order',
        'select-order',
      ]);

      const physicalOnly = createFulfillmentFixture({
        order: {
          items: [
            {
              _id: 'physical-item',
              productType: 'physical',
              requiresShipping: true,
            },
          ],
        },
      });
      const physicalResult = await facade.processOrderFulfillmentAfterPayment(
        { orderId: physicalOnly.order._id, now: physicalOnly.now },
        physicalOnly.dependencies
      );
      assert.equal(physicalResult.reason, 'no_digital_or_service_items');
      assert.equal(physicalOnly.order.fulfillment.notificationStatus, 'not_required');
      assert.deepEqual(physicalOnly.trace.map(({ action }) => action), [
        'find-order',
        'select-order',
        'save',
      ]);

      const deliveredPos = createFulfillmentFixture({
        order: {
          source: 'pos',
          saleType: 'pos_sale',
          fulfillmentStatus: 'delivered',
          fulfillment: {
            status: 'processing',
            notificationStatus: 'pending',
          },
          items: [
            {
              _id: 'physical-pos-item',
              productType: 'physical',
              requiresShipping: true,
            },
          ],
        },
      });
      const deliveredPosResult = await facade.processOrderFulfillmentAfterPayment(
        { orderId: deliveredPos.order._id, now: deliveredPos.now },
        deliveredPos.dependencies
      );
      assert.equal(deliveredPosResult.reason, 'no_digital_or_service_items');
      assert.equal(deliveredPos.order.fulfillment.status, 'delivered');
      assert.equal(deliveredPos.order.fulfillment.notificationStatus, 'not_required');
    });

    await check('el consumo incrementa una descarga con filtro atómico', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const deliveryId = '507f1f77bcf86cd799439012';
      const token = facade.buildDigitalAccessToken({
        orderId,
        orderItemId: 'delivery-item',
      });
      const delivery = {
        _id: deliveryId,
        status: 'ready',
        assetUrl: 'https://private.example/file.pdf',
        fileName: 'file.pdf',
        accessTokenHash: facade.hashAccessToken(token),
        expiresAt: new Date('2026-08-28T00:00:00.000Z'),
        downloadCount: 1,
        downloadLimit: 2,
      };
      let update = null;
      const OrderModel = {
        findOne() {
          return {
            async select() {
              return {
                _id: orderId,
                payment: { status: 'paid' },
                fulfillment: {
                  digitalDeliveries: { id: () => delivery },
                },
              };
            },
          };
        },
        async updateOne(filter, values) {
          update = { filter, values };
          return { modifiedCount: 1 };
        },
      };
      const result = await facade.consumeDigitalDeliveryAccess(
        {
          orderNumber: 'ORDER-FULFILLMENT-1',
          deliveryId,
          token,
          now: new Date('2026-08-27T12:00:00.000Z'),
        },
        { OrderModel }
      );
      assert.deepEqual(result, {
        assetUrl: 'https://private.example/file.pdf',
        fileName: 'file.pdf',
      });
      assert.equal(
        update.filter['fulfillment.digitalDeliveries'].$elemMatch.downloadCount.$lt,
        2
      );
      assert.equal(
        update.values.$inc['fulfillment.digitalDeliveries.$.downloadCount'],
        1
      );
    });

    await check('consumo inválido, vencido, agotado o concurrente mantiene códigos opacos', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const deliveryId = '507f1f77bcf86cd799439012';
      const token = facade.buildDigitalAccessToken({ orderId, orderItemId: 'item' });
      const base = {
        _id: deliveryId,
        status: 'ready',
        assetUrl: 'https://private.example/file.pdf',
        fileName: 'file.pdf',
        accessTokenHash: facade.hashAccessToken(token),
        expiresAt: new Date('2026-08-28T00:00:00.000Z'),
        downloadCount: 0,
        downloadLimit: 1,
      };
      function model(delivery, modifiedCount = 1) {
        return {
          findOne: () => ({
            select: async () => ({
              _id: orderId,
              payment: { status: 'paid' },
              fulfillment: { digitalDeliveries: { id: () => delivery } },
            }),
          }),
          updateOne: async () => ({ modifiedCount }),
        };
      }
      await assert.rejects(
        facade.consumeDigitalDeliveryAccess({ deliveryId: 'invalid', token }),
        (error) => error.code === 'DIGITAL_DELIVERY_NOT_FOUND' && error.statusCode === 404
      );
      await assert.rejects(
        facade.consumeDigitalDeliveryAccess(
          { deliveryId, token: 'wrong', now: new Date('2026-08-27T12:00:00.000Z') },
          { OrderModel: model(base) }
        ),
        (error) => error.code === 'DIGITAL_DELIVERY_NOT_FOUND' && error.statusCode === 404
      );
      await assert.rejects(
        facade.consumeDigitalDeliveryAccess(
          { deliveryId, token, now: new Date('2026-08-29T12:00:00.000Z') },
          { OrderModel: model(base) }
        ),
        (error) => error.code === 'DIGITAL_DELIVERY_EXPIRED' && error.statusCode === 410
      );
      await assert.rejects(
        facade.consumeDigitalDeliveryAccess(
          { deliveryId, token, now: new Date('2026-08-27T12:00:00.000Z') },
          { OrderModel: model({ ...base, downloadCount: 1 }) }
        ),
        (error) => error.code === 'DIGITAL_DELIVERY_LIMIT_REACHED' && error.statusCode === 410
      );
      await assert.rejects(
        facade.consumeDigitalDeliveryAccess(
          { deliveryId, token, now: new Date('2026-08-27T12:00:00.000Z') },
          { OrderModel: model(base, 0) }
        ),
        (error) => error.code === 'DIGITAL_DELIVERY_LIMIT_REACHED' && error.statusCode === 410
      );
    });

    await check('las entradas inválidas de procesamiento conservan códigos y mensajes', async () => {
      await assert.rejects(
        facade.processOrderFulfillmentAfterPayment({ orderId: 'invalid' }),
        (error) =>
          error.code === 'FULFILLMENT_ORDER_ID_INVALID' &&
          error.message === 'La orden no tiene un ID válido.'
      );
      const fixture = createFulfillmentFixture({ notFound: true });
      await assert.rejects(
        facade.processOrderFulfillmentAfterPayment(
          { orderId: fixture.order._id, now: fixture.now },
          fixture.dependencies
        ),
        (error) =>
          error.code === 'FULFILLMENT_ORDER_NOT_FOUND' &&
          error.message === 'No se encontró la orden para preparar la entrega.'
      );
    });

    assert.equal(typeof notification.sendFulfillmentNotification, 'function');
    console.log(
      `RESULTADO: ${checks.length}/${checks.length} controles de composición y paridad de fulfillment aprobados.`
    );
  } finally {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
