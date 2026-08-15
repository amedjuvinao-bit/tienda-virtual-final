/* eslint-disable no-console */
'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const crypto = require('crypto');
const mongoose = require('mongoose');

require('../models/Branch');
require('../models/Product');
const Customer = require('../models/Customer');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryStock = require('../models/InventoryStock');
const Order = require('../models/Order');
const {
  applyCustomerResolutionToOrderData,
  resolveCustomerForOrder,
  syncCustomerMasterFromOrder,
} = require('../services/customerOrderLinkService');
const {
  createInventoryReservation,
} = require('../services/inventoryReservationService');
const {
  applyReservationToOrderDocument,
} = require('../services/orderInventoryAllocationService');
const {
  initializeOrderLogistics,
  updateOrderShipment,
} = require('../services/orderLogisticsService');
const {
  transitionOrderStatus,
} = require('../services/orderStatusTransitionService');
const {
  buildOrderDraft,
  buildOrderNumber,
  buildRunId,
  loadCandidates,
  normalizeLabel,
} = require('./seedPersistentOrdersTrace');

const OrderEvent =
  mongoose.models.OrderEvent ||
  mongoose.model(
    'OrderEvent',
    new mongoose.Schema(
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Order',
          index: true,
          required: true,
        },
        type: { type: String, required: true },
        message: { type: String },
        meta: { type: Object },
      },
      {
        timestamps: { createdAt: true, updatedAt: false },
        versionKey: false,
      }
    ),
    'order_events'
  );

const REQUIRED_CONFIRMATION = '--confirm-real-transaction';
const LOGISTICS_ACTIONS = Object.freeze([
  'start_picking',
  'complete_picking',
  'start_packing',
  'complete_packing',
  'dispatch',
  'mark_in_transit',
  'deliver',
]);

function cleanText(value, max = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function optionValue(argv, name) {
  const prefix = `--${name}=`;
  const entry = argv.find((value) => String(value).startsWith(prefix));
  return entry ? String(entry).slice(prefix.length) : '';
}

function parseOptions(argv = process.argv.slice(2)) {
  const rawLimit = optionValue(argv, 'stock-limit');
  const stockLimit = rawLimit ? Number(rawLimit) : 400;
  if (!Number.isInteger(stockLimit) || stockLimit < 20 || stockLimit > 2000) {
    throw new Error('stock-limit debe ser un entero entre 20 y 2000.');
  }
  return {
    confirmRealTransaction: argv.includes(REQUIRED_CONFIRMATION),
    label: normalizeLabel(optionValue(argv, 'label') || 'cliente-real'),
    stockLimit,
  };
}

function assertRealTransactionConfirmation(options = {}) {
  if (options.confirmRealTransaction) return;
  const error = new Error(
    `Esta prueba crea una orden y un cliente persistentes, descuenta una unidad real de inventario y completa la entrega. Repite el comando con ${REQUIRED_CONFIRMATION}.`
  );
  error.code = 'REAL_ORDER_CUSTOMER_CONFIRMATION_REQUIRED';
  throw error;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildIdentity(now = new Date(), randomBytes = crypto.randomBytes) {
  const digits = `${now.getTime()}${randomBytes(3).readUIntBE(0, 3)}`;
  const tail = digits.slice(-7).padStart(7, '0');
  const token = `${now.toISOString().replace(/\D/g, '').slice(0, 14)}${randomBytes(2).toString('hex')}`.toLowerCase();
  return {
    token,
    email: `orden.cliente.real+${token}@example.com`,
    initialPhone: `310${tail}`,
    correctedPhone: `311${tail}`,
    documentNumber: `9${digits.slice(-9).padStart(9, '0')}`,
  };
}

function buildRealOrderDraft({ candidate, runId, identity, now = new Date() }) {
  const entry = {
    key: 'customer_lifecycle_real',
    label: 'Validación transaccional Orden–Cliente',
    status: 'pending',
    paymentStatus: 'pending_gateway',
    allocationState: 'reserved',
    sequence: 1,
    candidates: [candidate],
    activityAt: now,
  };
  const draft = buildOrderDraft(entry, runId);
  const name = 'Validación transaccional';
  const lastname = `Cliente ${identity.token.slice(-6).toUpperCase()}`;
  const reference = `QA-CUSTOMER-${identity.token}`.toUpperCase();

  return {
    ...draft,
    sessionId: `${runId}_customer_lifecycle`.slice(0, 120),
    orderNumber: buildOrderNumber(runId, 1),
    status: 'pending',
    fulfillmentStatus: 'pending',
    source: 'online',
    channel: 'web',
    saleType: 'online_order',
    tags: ['qa-real-order', 'customer-lifecycle'],
    customer: {
      name,
      lastname,
      email: identity.email,
      emailOrPhone: identity.email,
      phone: identity.initialPhone,
      id: identity.documentNumber,
      documentType: 'CC',
      address: 'Calle 1 # 2-3',
      city: 'Bogotá',
      department: 'Bogotá D.C.',
      country: 'CO',
      countryCode: 'CO',
    },
    billing: {
      personType: 'natural',
      name,
      lastname,
      email: identity.email,
      phone: identity.initialPhone,
      id: identity.documentNumber,
      documentType: 'CC',
      address: 'Calle 1 # 2-3',
      city: 'Bogotá',
      department: 'Bogotá D.C.',
      country: 'CO',
      countryCode: 'CO',
    },
    inventoryAllocations: [],
    inventoryAllocationSummary: {
      reservedQuantity: 0,
      soldQuantity: 0,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      returnedQuantity: 0,
      releasedQuantity: 0,
    },
    payment: {
      active: true,
      provider: 'manual',
      providerLabel: 'Confirmación administrativa',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: 'Validación transaccional',
      enableWebhook: false,
      status: 'pending_gateway',
      methodType: 'admin',
      method: 'admin',
      methodLabel: 'Confirmación administrativa',
      transactionId: reference,
      reference,
      amount: draft.total,
      amountInCents: Math.round(Number(draft.total || 0) * 100),
      paidAt: null,
    },
    inventoryControl: {
      reservationRequired: true,
      reservationId: null,
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
    timeline: [
      {
        type: 'system',
        message: 'Orden creada mediante la validación transaccional del ciclo Orden–Cliente.',
        by: 'order-customer-lifecycle',
        at: now,
      },
    ],
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function createRealOrderWithReservation({ draft, runId, candidate }) {
  const session = await mongoose.startSession();
  let createdOrder = null;
  let createdCustomer = null;
  let createdReservation = null;

  try {
    await session.withTransaction(async () => {
      const customerResolution = await resolveCustomerForOrder(draft, {
        session,
        source: 'web',
      });
      if (customerResolution.skipped || !customerResolution.customer) {
        throw new Error('La orden real no creó ni vinculó una ficha de cliente.');
      }
      if (!customerResolution.created) {
        throw new Error('La identidad única de la prueba coincidió con un cliente anterior.');
      }

      const linkedDraft = applyCustomerResolutionToOrderData(
        draft,
        customerResolution
      );
      [createdOrder] = await Order.create([linkedDraft], { session });
      createdCustomer = customerResolution.customer;

      createdReservation = await createInventoryReservation(
        {
          sessionId: createdOrder.sessionId,
          order: createdOrder._id,
          orderNumber: createdOrder.orderNumber,
          paymentReference: createdOrder.payment.reference,
          paymentTransactionId: createdOrder.payment.transactionId,
          source: 'checkout',
          items: createdOrder.items.map((item) => item.toObject()),
          branchPriorityIds: [candidate.branch.id],
          expiresInMinutes: 30,
          currency: 'COP',
          metadata: {
            testRunId: runId,
            customerLifecycle: true,
          },
        },
        { session }
      );

      if (!createdReservation) {
        throw new Error('No se creó la reserva transaccional de inventario.');
      }

      applyReservationToOrderDocument(createdOrder, createdReservation);
      createdOrder.inventoryControl.reservationId = createdReservation._id;
      await createdOrder.save({ session });

      await OrderEvent.create(
        [
          {
            orderId: createdOrder._id,
            type: 'created',
            message: 'Orden real creada y vinculada con cliente e inventario.',
            meta: {
              runId,
              customerId: createdCustomer._id,
              reservationId: createdReservation._id,
            },
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    order: createdOrder,
    customer: createdCustomer,
    reservation: createdReservation,
  };
}

function logisticsPayload(action, runId) {
  if (action === 'dispatch') {
    return {
      carrier: {
        code: 'QA',
        name: 'Transportadora de validación',
        serviceLevel: 'Control transaccional',
        trackingNumber: `${runId}-TRACK`.toUpperCase(),
        trackingUrl: '',
      },
      dispatchReference: `${runId}-DISPATCH`.toUpperCase(),
      note: 'Despacho confirmado por la prueba transaccional.',
    };
  }
  if (action === 'deliver') {
    return {
      deliveryReference: `${runId}-DELIVERY`.toUpperCase(),
      recipient: 'Cliente de validación',
      note: 'Entrega confirmada por la prueba transaccional.',
    };
  }
  return { note: `Transición logística ${action}.` };
}

async function completeLogistics(orderId, runId, actor) {
  const initialized = await initializeOrderLogistics(
    {
      orderFilter: { _id: orderId },
      actor,
      allowAllBranches: true,
    },
    { OrderEventModel: OrderEvent }
  );

  let current = initialized.order;
  for (const initialShipment of [...current.fulfillment.shipments]) {
    let shipmentId = initialShipment._id;
    let revision = Number(initialShipment.revision || 0);
    for (const action of LOGISTICS_ACTIONS) {
      const result = await updateOrderShipment(
        {
          orderFilter: { _id: orderId },
          shipmentId,
          action,
          expectedRevision: revision,
          payload: logisticsPayload(action, runId),
          actor,
          allowAllBranches: true,
        },
        { OrderEventModel: OrderEvent }
      );
      shipmentId = result.shipment._id;
      revision = Number(result.shipment.revision || 0);
      current = result.order;
    }
  }
  return current;
}

async function correctCustomerFromOrder({ orderId, correctedPhone, actor }) {
  const session = await mongoose.startSession();
  let linkedCustomer = null;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new Error('La orden desapareció antes de corregir al cliente.');

      order.customer.phone = correctedPhone;
      order.customer.emailOrPhone = order.customer.email || correctedPhone;
      order.billing.phone = correctedPhone;

      const syncResult = await syncCustomerMasterFromOrder(order, {
        session,
      });
      linkedCustomer = syncResult.customer;
      await order.save({ session });
      await OrderEvent.create(
        [
          {
            orderId: order._id,
            type: 'customer_data_updated',
            message: 'Datos actualizados en la orden y en la ficha del cliente.',
            meta: {
              customerId: linkedCustomer._id,
              syncCustomer: true,
              by: actor.source,
            },
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return linkedCustomer;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`OK  ${message}`);
}

async function verifyFinalState({
  orderId,
  customerId,
  reservationId,
  identity,
  initialStock,
}) {
  const [order, customer, reservation, stock, movements, events] =
    await Promise.all([
      Order.findById(orderId).lean().exec(),
      Customer.findById(customerId).lean().exec(),
      InventoryReservation.findById(reservationId).lean().exec(),
      InventoryStock.findById(initialStock._id).lean().exec(),
      InventoryMovement.find({
        order: orderId,
        type: 'sale_out',
        status: 'posted',
      }).lean().exec(),
      OrderEvent.find({ orderId }).sort({ createdAt: 1 }).lean().exec(),
    ]);

  assertCondition(Boolean(order), 'la orden persiste en la base configurada');
  assertCondition(Boolean(customer), 'el cliente persiste en el CRM');
  assertCondition(
    String(order.customer?.customerId || '') === String(customerId),
    'la orden conserva el customerId de la ficha maestra'
  );
  assertCondition(
    String(customer.phone || '') === identity.correctedPhone &&
      String(customer.normalizedPhone || '') === identity.correctedPhone,
    'la corrección del celular actualiza también su identidad normalizada'
  );
  assertCondition(
    order.customer?.phone === identity.correctedPhone &&
      order.billing?.phone === identity.correctedPhone,
    'la orden y la facturación conservan el celular corregido'
  );
  assertCondition(
    order.status === 'delivered' && order.payment?.status === 'paid',
    'la orden completa pago y entrega mediante transiciones oficiales'
  );
  assertCondition(
    (order.fulfillment?.shipments || []).length > 0 &&
      order.fulfillment.shipments.every((shipment) => shipment.status === 'delivered'),
    'todos los envíos terminan entregados'
  );
  assertCondition(
    reservation?.status === 'confirmed',
    'la reserva de inventario queda confirmada'
  );
  assertCondition(
    movements.length === 1 && Number(movements[0].quantity || 0) === 1,
    'el kardex registra una única salida de venta'
  );
  assertCondition(
    Number(stock?.stock || 0) === Number(initialStock.stock || 0) - 1,
    'la existencia física disminuye exactamente una unidad'
  );
  assertCondition(
    Number(customer.stats?.ordersCount || 0) === 1 &&
      Number(customer.stats?.webOrdersCount || 0) === 1 &&
      Number(customer.stats?.totalSpent || 0) === Number(order.total || 0),
    'las estadísticas del cliente contabilizan una sola compra web'
  );

  const duplicates = await Customer.countDocuments({
    _id: { $ne: customerId },
    deletedAt: null,
    $or: [
      { normalizedEmail: identity.email },
      { normalizedPhone: identity.correctedPhone },
      { normalizedDocument: onlyDigits(identity.documentNumber) },
    ],
  }).exec();
  assertCondition(duplicates === 0, 'la transición no crea clientes duplicados');
  assertCondition(
    events.some((event) => event.type === 'customer_data_updated') &&
      events.some((event) => event.type === 'logistics_deliver'),
    'la auditoría conserva la corrección y la entrega'
  );

  return { order, customer, reservation, stock, movements, events };
}

async function run(options = parseOptions()) {
  assertRealTransactionConfirmation(options);
  const mongoUri =
    process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI || '';
  if (!mongoUri) {
    throw new Error('Falta MONGODB_URI, MONGO_URI o DB_URI en backend/.env.');
  }

  await mongoose.connect(mongoUri);
  const now = new Date();
  const runId = buildRunId({ now, label: options.label }).replace(
    /^ord_trace/,
    'ord_customer_live'
  );
  const identity = buildIdentity(now);
  const candidates = await loadCandidates(options.stockLimit);
  const candidate = candidates.find(
    (item) => item?.product?.productType === 'physical'
  );
  if (!candidate) {
    throw new Error('No existe una unidad física disponible para la prueba real.');
  }

  const initialStock = await InventoryStock.findById(candidate.stockId)
    .lean()
    .exec();
  if (!initialStock || Number(initialStock.stock || 0) < 1) {
    throw new Error('La existencia seleccionada ya no tiene inventario disponible.');
  }

  const draft = buildRealOrderDraft({ candidate, runId, identity, now });
  const actor = {
    displayName: 'Prueba transaccional Orden–Cliente',
    role: 'system',
    source: 'order-customer-lifecycle',
  };

  console.log('\n=== PRUEBA REAL: CICLO COMPLETO ORDEN–CLIENTE ===');
  console.log(`Base: ${mongoose.connection.name}`);
  console.log(`Ejecución: ${runId}`);
  console.log('Persistencia: se conservarán orden, cliente, kardex y auditoría.');
  console.log('Impacto: se descontará una unidad real de inventario.');
  console.log('Pasarelas y DIAN: no se invocan en esta prueba administrativa.\n');

  const created = await createRealOrderWithReservation({
    draft,
    runId,
    candidate,
  });
  assertCondition(
    String(created.order.customer?.customerId || '') ===
      String(created.customer._id),
    'la creación transaccional vincula orden, cliente y reserva'
  );

  const paid = await transitionOrderStatus(
    {
      orderId: created.order._id,
      status: 'paid',
      actor,
    },
    { OrderEventModel: OrderEvent }
  );
  assertCondition(
    paid.changed && paid.order?.payment?.status === 'paid',
    'la transición a pagada confirma el inventario'
  );

  const repeatedPaid = await transitionOrderStatus(
    {
      orderId: created.order._id,
      status: 'paid',
      actor,
    },
    { OrderEventModel: OrderEvent }
  );
  assertCondition(
    repeatedPaid.changed === false,
    'repetir la confirmación es idempotente'
  );

  await completeLogistics(created.order._id, runId, actor);
  await correctCustomerFromOrder({
    orderId: created.order._id,
    correctedPhone: identity.correctedPhone,
    actor,
  });

  const finalState = await verifyFinalState({
    orderId: created.order._id,
    customerId: created.customer._id,
    reservationId: created.reservation._id,
    identity,
    initialStock,
  });

  console.log('\n=== RESULTADO CONSERVADO PARA REVISIÓN VISUAL ===');
  console.log(`Orden: ${finalState.order.orderNumber}`);
  console.log(`Cliente: ${finalState.customer.customerCode}`);
  console.log(`Buscar cliente por: ${identity.email}`);
  console.log(`Celular corregido: ${identity.correctedPhone}`);
  console.log(`Estado final: ${finalState.order.status}`);
  console.log(`Salida de inventario: ${finalState.movements[0]._id}`);
  console.log('Resultado: CICLO REAL ORDEN–CLIENTE SUPERADO.');

  return {
    runId,
    orderId: String(finalState.order._id),
    orderNumber: finalState.order.orderNumber,
    customerId: String(finalState.customer._id),
    customerCode: finalState.customer.customerCode,
    customerEmail: identity.email,
    correctedPhone: identity.correctedPhone,
    inventoryMovementId: String(finalState.movements[0]._id),
  };
}

async function main() {
  try {
    await run(parseOptions());
  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    if (error.code) console.error(`Código: ${error.code}`);
    console.error(
      'Las transacciones incompletas se revierten; las etapas ya confirmadas se conservan para auditoría.'
    );
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

if (require.main === module) main();

module.exports = {
  LOGISTICS_ACTIONS,
  REQUIRED_CONFIRMATION,
  assertRealTransactionConfirmation,
  buildIdentity,
  buildRealOrderDraft,
  completeLogistics,
  logisticsPayload,
  parseOptions,
  run,
  verifyFinalState,
};
