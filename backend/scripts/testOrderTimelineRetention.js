'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const {
  createOrderTimelineWriter,
} = require('../lib/orders/orderTimeline');
const {
  MAX_ORDER_TIMELINE_ENTRIES,
  retainRecentOrderTimeline,
} = require('../models/order/timelinePolicy');

const tests = [];
let orderSequence = 0;

function test(name, callback) {
  tests.push({ name, callback });
}

function timelineEntries(count) {
  return Array.from({ length: count }, (_, index) => ({
    type: 'status',
    statusFrom: index ? 'processing' : 'pending',
    statusTo: 'pending',
    message: `entrada-${index}`,
    by: 'contract',
    at: new Date(2026, 0, 1, 0, index),
  }));
}

function buildOrder(values = {}) {
  orderSequence += 1;
  return new Order({
    sessionId: 'timeline-contract',
    orderNumber: `TIMELINE-${String(orderSequence).padStart(4, '0')}`,
    status: 'pending',
    source: 'online',
    items: [
      {
        title: 'Producto de contrato',
        quantity: 1,
        qty: 1,
        price: 1000,
        unitPrice: 1000,
      },
    ],
    ...values,
  });
}

async function runCanonicalOrderSaveHook(order) {
  const saveHook = Order.schema.s.hooks._pres
    .get('save')
    ?.find(({ fn }) => String(fn).includes('applyOrderTimelineRetention'));
  assert(saveHook, 'El modelo no registró la política central de timeline.');
  await new Promise((resolve, reject) => {
    Order.schema.s.hooks.execPre('save', order, [], (error) =>
      error ? reject(error) : resolve()
    );
  });
}

function createFakeTimelinePersistence({ failEvent = false } = {}) {
  const state = { timeline: timelineEntries(200) };
  const events = [];
  const updates = [];
  let sessionsStarted = 0;
  let sessionsEnded = 0;
  const session = {
    async withTransaction(callback) {
      const timelineBefore = [...state.timeline];
      const eventCountBefore = events.length;
      try {
        await callback();
      } catch (error) {
        state.timeline = timelineBefore;
        events.splice(eventCountBefore);
        throw error;
      }
    },
    async endSession() {
      sessionsEnded += 1;
    },
  };
  const mongooseAdapter = {
    async startSession() {
      sessionsStarted += 1;
      return session;
    },
  };
  const OrderModel = {
    async updateOne(filter, update, options) {
      assert.deepStrictEqual(filter, { _id: 'order-timeline-1' });
      assert.strictEqual(options.session, session);
      updates.push(update);
      const push = update.$push.timeline;
      state.timeline.push(...push.$each);
      state.timeline = state.timeline.slice(push.$slice);
      return { matchedCount: 1 };
    },
  };
  const OrderEventModel = {
    async create(documents, options) {
      assert.strictEqual(options.session, session);
      if (failEvent) throw new Error('EVENT_WRITE_FAILED');
      events.push(...documents);
      return documents;
    },
  };
  return {
    OrderEventModel,
    OrderModel,
    events,
    mongooseAdapter,
    session,
    sessionsEnded: () => sessionsEnded,
    sessionsStarted: () => sessionsStarted,
    state,
    updates,
  };
}

test('250 entradas se reducen a las 200 más recientes sin reordenarlas', () => {
  const original = timelineEntries(250);
  const retained = retainRecentOrderTimeline(original);

  assert.strictEqual(MAX_ORDER_TIMELINE_ENTRIES, 200);
  assert.strictEqual(retained.length, 200);
  assert.deepStrictEqual(
    retained.map((entry) => entry.message),
    original.slice(50).map((entry) => entry.message)
  );
  assert.strictEqual(original.length, 250);
});

test('todo save aplica el límite central después de agregar eventos normales', async () => {
  const order = buildOrder({ timeline: timelineEntries(250) });
  await runCanonicalOrderSaveHook(order);

  assert.strictEqual(order.timeline.length, 200);
  assert.strictEqual(order.timeline[0].message, 'entrada-50');
  assert.strictEqual(order.timeline[199].message, 'entrada-249');

  order.$isNew = false;
  order.timeline.push({
    type: 'system',
    message: 'entrada-250',
    by: 'contract',
    at: new Date(2026, 0, 2),
  });
  await runCanonicalOrderSaveHook(order);
  assert.strictEqual(order.timeline.length, 200);
  assert.strictEqual(order.timeline[0].message, 'entrada-51');
  assert.strictEqual(order.timeline[199].message, 'entrada-250');
});

test('la creación normal conserva su evento inicial y la respuesta embebida', async () => {
  const order = buildOrder();
  await order.validate();
  await runCanonicalOrderSaveHook(order);

  assert.strictEqual(order.timeline.length, 1);
  assert.deepStrictEqual(
    {
      type: order.timeline[0].type,
      statusTo: order.timeline[0].statusTo,
      message: order.timeline[0].message,
      by: order.timeline[0].by,
    },
    {
      type: 'status',
      statusTo: 'pending',
      message: 'Estado inicial',
      by: 'system',
    }
  );
});

test('OrderEvent permanece como colección externa sin política de truncado', () => {
  assert.strictEqual(OrderEvent.collection.collectionName, 'order_events');
  const eventSource = fs.readFileSync(
    path.resolve(__dirname, '../models/OrderEvent.js'),
    'utf8'
  );
  assert(!eventSource.includes('MAX_ORDER_TIMELINE_ENTRIES'));
  assert(!eventSource.includes('retainRecentOrderTimeline'));
});

test('el helper fiscal persiste resumen y OrderEvent con el mismo dato en una transacción', async () => {
  const persistence = createFakeTimelinePersistence();
  const occurredAt = new Date('2026-08-27T12:00:00.000Z');
  const order = {
    _id: 'order-timeline-1',
    timeline: timelineEntries(200),
    unmarkModified(pathName) {
      assert.strictEqual(pathName, 'timeline');
    },
  };
  const writer = createOrderTimelineWriter({
    mongooseAdapter: persistence.mongooseAdapter,
    OrderModel: persistence.OrderModel,
    OrderEventModel: persistence.OrderEventModel,
    now: () => occurredAt,
  });

  await writer.write({
    order,
    type: 'system',
    message: ' Nota crédito NC-100 creada. ',
    by: 'facturacion',
    eventType: 'electronic_credit_note_created',
    eventMeta: { creditNoteNumber: 'NC-100' },
  });

  assert.strictEqual(persistence.sessionsStarted(), 1);
  assert.strictEqual(persistence.sessionsEnded(), 1);
  assert.strictEqual(persistence.state.timeline.length, 200);
  assert.strictEqual(
    persistence.state.timeline[199].message,
    ' Nota crédito NC-100 creada. '
  );
  assert.strictEqual(order.timeline.length, 200);
  assert.strictEqual(persistence.events.length, 1);
  assert.strictEqual(
    persistence.events[0].message,
    persistence.state.timeline[199].message
  );
  assert.strictEqual(
    persistence.events[0].type,
    'electronic_credit_note_created'
  );
  assert.deepStrictEqual(persistence.updates[0].$push.timeline, {
    $each: [
      {
        type: 'system',
        message: ' Nota crédito NC-100 creada. ',
        by: 'facturacion',
        at: occurredAt,
      },
    ],
    $slice: -200,
  });
});

test('si falla OrderEvent la transacción no deja únicamente el resumen embebido', async () => {
  const persistence = createFakeTimelinePersistence({ failEvent: true });
  const originalMessages = persistence.state.timeline.map(
    (entry) => entry.message
  );
  const order = {
    _id: 'order-timeline-1',
    timeline: timelineEntries(200),
  };
  const writer = createOrderTimelineWriter({
    mongooseAdapter: persistence.mongooseAdapter,
    OrderModel: persistence.OrderModel,
    OrderEventModel: persistence.OrderEventModel,
  });

  await assert.rejects(
    () =>
      writer.write({
        order,
        message: 'Evento que debe revertirse',
        eventType: 'electronic_credit_note_created',
      }),
    /EVENT_WRITE_FAILED/
  );
  assert.deepStrictEqual(
    persistence.state.timeline.map((entry) => entry.message),
    originalMessages
  );
  assert.strictEqual(persistence.events.length, 0);
  assert.strictEqual(order.timeline[199].message, 'entrada-199');
  assert.strictEqual(persistence.sessionsEnded(), 1);
});

test('la creación POS registra también un OrderEvent en la misma sesión', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../services/adminPosService.js'),
    'utf8'
  );
  const orderCreation = source.indexOf(
    'const createdOrders = await Order.create([orderPayload], { session });'
  );
  const externalEvent = source.indexOf('await OrderEvent.create(', orderCreation);
  const inventoryWrite = source.indexOf(
    'const movements = await applyPosInventoryOut',
    orderCreation
  );

  assert(orderCreation >= 0);
  assert(externalEvent > orderCreation);
  assert(externalEvent < inventoryWrite);
  assert(source.slice(externalEvent, inventoryWrite).includes('{ session }'));
});

(async () => {
  let passed = 0;
  for (const entry of tests) {
    try {
      await entry.callback();
      passed += 1;
      console.log(`OK ${passed}: ${entry.name}`);
    } catch (error) {
      console.error(`FAIL: ${entry.name}`);
      console.error(error);
      process.exitCode = 1;
    }
  }
  console.log(`\nRetención timeline de Order: ${passed}/${tests.length}.`);
})();
