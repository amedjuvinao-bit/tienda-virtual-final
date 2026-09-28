'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const Product = require('../models/Product');
const validateOrderPayload = require('../validators/orderPayload');
const { calculateItemsSummary } = require('../lib/orders/orderRouteUtils');
const {
  buildAdminSnapshot,
  buildPricingSnapshot,
  getOrderCustomerEmail,
  isValidDeliveryEmail,
  orderNeedsElectronicDelivery,
} = require('../lib/orders/orderCreationPayload');
const { normalizeProductVariants } = require('../lib/products/productVariantConfig');
const { buildOrderQuote } = require('./orderPricingService');
const { resolveOrderBillingMunicipality } = require('./orderBillingMunicipalityService');
const { buildBranchSnapshot } = require('./orderCreationBranchService');
const { getNextOrderNumber } = require('./orderCreationTransactionService');
const {
  createInventoryReservation,
  expandReservableItems,
} = require('./inventoryReservationService');
const { applyReservationToOrderDocument } = require('./orderInventoryAllocationService');
const {
  resolveCustomerForOrder,
  applyCustomerResolutionToOrderData,
  applyCustomerStatsForOrder,
} = require('./customerOrderLinkService');
const {
  beginIdempotencyRecord,
  completeIdempotencyRecord,
  inspectExistingIdempotency,
} = require('./orderCreationIdempotencyService');
const {
  canAdminSeeAllBranches,
  getAllowedBranchIdsFromRequest,
  normalizeBranchId,
} = require('./orderAdminScopeService');

const MANUAL_ORDER_ENDPOINT = 'POST /orders/admin/manual';

function fail(message, code = 'MANUAL_ORDER_INVALID', statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function manualBranchFilter(req) {
  const filter = {
    deletedAt: null,
    active: true,
    status: 'active',
    'settings.allowManualOrders': true,
  };
  if (!canAdminSeeAllBranches(req)) {
    const ids = getAllowedBranchIdsFromRequest(req);
    filter._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  return filter;
}

async function findManualBranch(req, branchId, session = null) {
  const id = normalizeBranchId(branchId);
  if (!id) throw fail('Selecciona una sede válida.', 'INVALID_BRANCH_ID');
  if (
    !canAdminSeeAllBranches(req) &&
    !getAllowedBranchIdsFromRequest(req).includes(id)
  ) throw fail('No tienes acceso a esa sede.', 'BRANCH_FORBIDDEN', 403);

  let query = Branch.findOne({ ...manualBranchFilter(req), _id: id });
  if (session) query = query.session(session);
  const branch = await query.lean();
  if (!branch) throw fail('Esta sede no permite pedidos manuales o está inactiva.', 'MANUAL_ORDERS_DISABLED', 409);
  return branch;
}

function prepareManualPayload(body = {}) {
  const items = body.items;
  if (!Array.isArray(items) || !items.length || items.length > 200) {
    throw fail('Añade entre 1 y 200 productos.', 'INVALID_ITEMS');
  }
  if (!['retiro', 'envio'].includes(body.customer?.deliveryType)) {
    throw fail('Selecciona entrega o retiro.', 'INVALID_DELIVERY_TYPE');
  }
  if (!body.billing || typeof body.billing !== 'object' || Array.isArray(body.billing)) {
    throw fail('Completa los datos fiscales del comprador antes de crear el pedido.', 'MANUAL_ORDER_BILLING_REQUIRED');
  }
  const sanitizedItems = items.map((item) => ({
    productId: item?.productId,
    quantity: item?.quantity,
    variantKey: item?.variantKey,
    variantAttributes: item?.variantAttributes,
    size: item?.size,
    color: item?.color,
    price: 1, // El validador necesita un subtotal; la cotización lee el precio de la base de datos.
  }));
  const { ok, errors, cleaned } = validateOrderPayload({
    cart: sanitizedItems,
    customer: body.customer,
    billing: body.billing,
    payment: { provider: 'manual', status: 'pending_manual', currency: 'COP' },
  });
  if (!ok) throw fail(errors.join(' '), 'VALIDATION_ERROR');
  resolveOrderBillingMunicipality(cleaned, { required: true });
  return cleaned;
}

async function assertVariantSelection(items, session) {
  const ids = [...new Set(items.map((item) => String(item.productId)))];
  let query = Product.find({ _id: { $in: ids } }).select('variants sizes colors stock title price');
  if (session) query = query.session(session);
  const products = await query.lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  for (const item of items) {
    const product = byId.get(String(item.productId));
    const variants = normalizeProductVariants(product?.variants || [], product || {})
      .filter((variant) => variant.active !== false);
    if (variants.length && !variants.some((variant) => variant.variantKey === item.variantKey)) {
      throw fail(`Selecciona una variante disponible de ${product?.title || 'este producto'}.`, 'INVALID_VARIANT');
    }
  }
}

async function prepareQuote(req, body, session = null) {
  const cleaned = prepareManualPayload(body);
  const branch = await findManualBranch(req, body.branchId, session);
  const quote = await buildOrderQuote({
    items: cleaned.cart,
    customer: cleaned.customer,
    branchId: branch._id,
    channel: 'manual',
  }, { session });
  await assertVariantSelection(quote.pricing.items, session);
  const reservable = await expandReservableItems(quote.pricing.items, { session });
  if (reservable.length && branch.settings?.allowInventoryMovements !== true) {
    throw fail('Esta sede no permite reservar inventario para el pedido.', 'BRANCH_INVENTORY_DISABLED', 409);
  }
  if (
    orderNeedsElectronicDelivery(quote.pricing.items) &&
    !isValidDeliveryEmail(getOrderCustomerEmail(cleaned))
  ) throw fail('Los productos digitales y servicios requieren un correo válido.', 'FULFILLMENT_EMAIL_REQUIRED');
  if (quote.pricing.total <= 0) throw fail('El total de la orden debe ser mayor a cero.', 'INVALID_TOTAL');
  return { cleaned, branch, pricing: quote.pricing, reservationRequired: reservable.length > 0 };
}

async function createManualOrder(req, body) {
  // La clave del botón se reutiliza en reintentos y se separa por operador.
  const clientKey = String(body.requestId || '').trim();
  if (!/^[a-f0-9-]{36}$/i.test(clientKey)) {
    throw fail('Vuelve a abrir el formulario e intenta nuevamente.', 'INVALID_REQUEST_ID');
  }
  const identity = String(req.adminUserId || req.adminUsername || '').slice(0, 100);
  const idempotencyKey = `manual:${identity}:${clientKey}`;
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({
    branchId: body.branchId,
    customer: body.customer,
    billing: body.billing,
    items: body.items,
  })).digest('hex');
  const existing = await inspectExistingIdempotency(
    { key: idempotencyKey, requestHash },
    { endpoint: MANUAL_ORDER_ENDPOINT }
  );
  if (existing.action === 'conflict') throw fail(existing.message, 'IDEMPOTENCY_CONFLICT', 409);
  if (existing.action === 'in_progress') throw fail('El pedido se está guardando; espera un momento.', 'IDEMPOTENT_IN_PROGRESS', 409);
  if (existing.action === 'reuse') {
    const order = await Order.findById(existing.orderId);
    if (order) {
      if (
        !canAdminSeeAllBranches(req) &&
        !getAllowedBranchIdsFromRequest(req).includes(String(order.branch))
      ) throw fail('No tienes acceso a esa sede.', 'BRANCH_FORBIDDEN', 403);
      return { order, reused: true };
    }
    throw fail('La orden anterior ya no está disponible.', 'ORDER_NOT_FOUND', 409);
  }

  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const { cleaned, branch, pricing, reservationRequired } = await prepareQuote(req, body, session);
      const record = await beginIdempotencyRecord({
        key: idempotencyKey, requestHash, session, endpoint: MANUAL_ORDER_ENDPOINT,
      });
      const orderNumber = await getNextOrderNumber({ session });
      const sessionId = `manual-${clientKey}`;
      const summary = calculateItemsSummary(pricing.items);
      const base = {
        sessionId,
        orderNumber,
        source: 'manual',
        channel: 'manual',
        saleType: 'manual_order',
        status: 'pending',
        branch: branch._id,
        branchSnapshot: buildBranchSnapshot(branch),
        customer: cleaned.customer,
        billing: cleaned.billing,
        cart: pricing.items,
        items: pricing.items,
        summary: { itemsCount: pricing.items.length, totalItems: summary.totalItems, subtotal: pricing.subtotal },
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
        total: pricing.total,
        pricing: buildPricingSnapshot(pricing),
        taxes: { iva: pricing.tax },
        payment: {
          provider: 'manual', providerLabel: 'Pago manual',
          status: 'pending_manual', currency: 'COP',
          amount: pricing.total, amountInCents: Math.round(pricing.total * 100),
        },
        createdByAdmin: req.adminUserId || null,
        createdByAdminSnapshot: buildAdminSnapshot(req),
        inventoryControl: {
          reservationRequired,
          discountedAtCheckout: false,
          restockedOnFailure: false,
        },
      };
      const customerResolution = await resolveCustomerForOrder(base, { session, source: 'manual' });
      const [order] = await Order.create([
        applyCustomerResolutionToOrderData(base, customerResolution),
      ], { session });
      await applyCustomerStatsForOrder(order, { session });

      let reservation = null;
      if (reservationRequired) {
        reservation = await createInventoryReservation({
          sessionId,
          order: order._id,
          orderNumber,
          source: 'admin',
          items: order.items,
          allowedBranchIds: [branch._id],
          branchPriorityIds: [branch._id],
          expiresInMinutes: 20,
          metadata: { orderSource: 'manual', orderBranch: String(branch._id) },
          notes: 'Reserva de pedido manual pendiente de pago.',
        }, { session });
        if (!reservation) throw fail('No se pudo reservar el inventario.', 'RESERVATION_FAILED', 409);
        order.inventoryControl.reservationId = reservation._id;
        order.inventoryControl.reservationExpiresAt = reservation.expiresAt;
        applyReservationToOrderDocument(order, reservation);
        await order.save({ session });
      }

      await OrderEvent.create([{
        orderId: order._id,
        type: 'status_changed',
        message: 'Pedido manual creado; pago pendiente.',
        meta: {
          to: 'pending', source: 'manual', branch: branch._id,
          by: req.adminUsername || 'admin', reservationId: reservation?._id || null,
        },
      }], { session });
      await completeIdempotencyRecord(record, { order, reservation, pricing }, { session });
      created = order;
    });
    return { order: created, reused: false };
  } finally {
    await session.endSession();
  }
}

module.exports = {
  createManualOrder,
  findManualBranch,
  manualBranchFilter,
  prepareManualPayload,
  prepareQuote,
};
