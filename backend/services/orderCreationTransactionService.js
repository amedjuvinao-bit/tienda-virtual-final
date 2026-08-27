'use strict';

const Counter = require('../models/Counter');
const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const SiteSettings = require('../models/SiteSettings');
const {
  calculateItemsSummary,
} = require('../lib/orders/orderRouteUtils');
const {
  buildAdminSnapshot,
  buildOrderCouponSnapshot,
  buildOrderDiscountSnapshot,
  buildPricingSnapshot,
  getOrderCustomerEmail,
  getValidSource,
  isValidDeliveryEmail,
  orderNeedsElectronicDelivery,
} = require('../lib/orders/orderCreationPayload');
const { buildOrderQuote } = require('./orderPricingService');
const {
  createInventoryReservation,
  expandReservableItems,
} = require('./inventoryReservationService');
const {
  applyReservationToOrderDocument,
} = require('./orderInventoryAllocationService');
const {
  applyCustomerResolutionToOrderData,
  applyCustomerStatsForOrder,
  resolveCustomerForOrder,
} = require('./customerOrderLinkService');
const { markCartConverted } = require('./cartAdminOperationsService');
const {
  resolveOrderBranchData,
} = require('./orderCreationBranchService');
const {
  beginIdempotencyRecord,
  completeIdempotencyRecord,
} = require('./orderCreationIdempotencyService');
const {
  applyStoreCreditToNewOrder,
} = require('./orderCreationStoreCreditService');
const { recordNewOrderCoupon } = require('./orderCreationCouponService');
const {
  normalizeNewsletterIntent,
} = require('./orderCreationNewsletterService');

async function getNextOrderNumber({ session } = {}) {
  const document = await Counter.findOneAndUpdate(
    { _id: 'orderNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  ).lean();

  return String(document.seq).padStart(6, '0');
}

function buildNewOrderDocument({
  cleaned,
  pricing,
  quote,
  orderNumber,
  orderBranchData,
  orderSource,
  createdByAdminSnapshot,
  adminUserId,
  reservationRequired,
}) {
  const itemSummary = calculateItemsSummary(pricing.items);

  return {
    ...cleaned,
    orderNumber,
    cart: pricing.items,
    items: pricing.items,
    summary: {
      itemsCount: pricing.items.length,
      totalItems: itemSummary.totalItems,
      subtotal: pricing.subtotal,
    },
    subtotal: pricing.subtotal,
    shipping: pricing.shipping,
    total: pricing.total,
    discount: buildOrderDiscountSnapshot(quote),
    coupon: buildOrderCouponSnapshot(quote),
    pricing: buildPricingSnapshot(pricing),
    taxes: {
      iva: {
        enabled: pricing.tax.enabled,
        percent: pricing.tax.percent,
        code: pricing.tax.code,
        name: pricing.tax.name,
        taxableBase: pricing.tax.taxableBase,
        amount: pricing.tax.amount,
      },
    },
    payment: {
      ...(cleaned.payment || {}),
      amount: pricing.total,
      amountInCents: Math.round(pricing.total * 100),
    },
    branch: orderBranchData.branchId,
    branchSnapshot: orderBranchData.branchSnapshot,
    createdByAdmin: adminUserId || null,
    createdByAdminSnapshot,
    source: orderSource,
    inventoryControl: {
      reservationRequired,
      reservationId: null,
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
  };
}

function assertValidQuote(quote, cleaned) {
  if (quote.couponCode && !quote.couponValidation?.valid) {
    throw Object.assign(
      new Error(quote.couponValidation?.message || 'El cupón no es válido.'),
      {
        code: quote.couponValidation?.code || 'COUPON_INVALID',
        statusCode: 422,
        details: { code: quote.couponValidation?.code || 'COUPON_INVALID' },
      }
    );
  }

  if (
    orderNeedsElectronicDelivery(quote.pricing.items) &&
    !isValidDeliveryEmail(getOrderCustomerEmail(cleaned))
  ) {
    throw Object.assign(
      new Error(
        'Los productos digitales y servicios necesitan un correo válido para completar la entrega.'
      ),
      { code: 'FULFILLMENT_EMAIL_REQUIRED', statusCode: 400 }
    );
  }
}

function assertReservationUsesEligibleBranches(reservation, orderBranchData) {
  if (!reservation) return;
  const eligible = new Set(
    (orderBranchData?.eligibleBranchIds || []).map(String).filter(Boolean)
  );
  const disallowedBranchIds = [
    ...new Set(
      (reservation.items || [])
        .map((item) => String(item?.branch || '').trim())
        .filter((branchId) => branchId && !eligible.has(branchId))
    ),
  ];
  if (!disallowedBranchIds.length) return;

  throw Object.assign(
    new Error('La reserva intentó usar una sede no elegible para venta online.'),
    {
      code: 'INSUFFICIENT_STOCK',
      statusCode: 409,
      details: {
        reason: 'RESERVATION_USED_INELIGIBLE_BRANCH',
        disallowedBranchIds,
      },
    }
  );
}

async function createInventoryReservationForOrder({
  order,
  cleaned,
  rawBody,
  orderBranchData,
  orderSource,
  idempotencyKey,
  session,
}) {
  const reservation = await createInventoryReservation(
    {
      sessionId: cleaned.sessionId,
      order: order._id,
      orderNumber: order.orderNumber,
      paymentReference:
        rawBody?.paymentReference ||
        rawBody?.payment?.reference ||
        rawBody?.payment?.transactionId ||
        '',
      paymentTransactionId:
        rawBody?.paymentTransactionId || rawBody?.payment?.transactionId || '',
      source: 'checkout',
      items: order.items,
      branchPriorityIds: orderBranchData.branchPriorityIds || [],
      expiresInMinutes: 20,
      currency: cleaned.payment?.currency || 'COP',
      metadata: {
        orderSource,
        idempotencyKey: idempotencyKey || '',
        orderBranch: orderBranchData.branchId
          ? String(orderBranchData.branchId)
          : '',
        orderBranchSnapshot: orderBranchData.branchSnapshot,
        branchSelectionReason: orderBranchData.selectionReason || '',
        eligibleBranchIds: orderBranchData.eligibleBranchIds || [],
      },
      notes: 'Reserva automática creada al generar la orden online.',
    },
    { session }
  );

  assertReservationUsesEligibleBranches(reservation, orderBranchData);
  order.inventoryControl.reservationId = reservation?._id || null;
  applyReservationToOrderDocument(order, reservation);
  await order.save({ session });
  return reservation;
}

async function recordOrderCreatedEvent({
  order,
  requestIp,
  orderBranchData,
  orderSource,
  reservation,
  createdByAdminSnapshot,
  session,
}) {
  await OrderEvent.create(
    [
      {
        orderId: order._id,
        type: 'status_changed',
        message: `Orden creada con estado ${order.status}`,
        meta: {
          to: order.status,
          ip: requestIp,
          branch: orderBranchData.branchId,
          branchSnapshot: orderBranchData.branchSnapshot,
          source: orderSource,
          reservationId: reservation?._id || null,
          reservationCode: reservation?.reservationCode || '',
          reservationStatus: reservation?.status || '',
          reservationExpiresAt: reservation?.expiresAt || null,
          by: createdByAdminSnapshot.username || 'system',
        },
      },
    ],
    { session }
  );
}

async function createOrderInTransaction({
  session,
  cleaned,
  rawBody,
  requestContext,
  idempotencyKey,
  requestHash,
}) {
  let result = {
    created: null,
    inventoryReservation: null,
    fullyPaidWithStoreCredit: false,
    newsletterIntent: null,
  };

  await session.withTransaction(async () => {
    // MongoDB puede volver a ejecutar el callback. No se reutiliza estado de un
    // intento abortado.
    result = {
      created: null,
      inventoryReservation: null,
      fullyPaidWithStoreCredit: false,
      newsletterIntent: null,
    };

    const idempotencyRecord = await beginIdempotencyRecord({
      key: idempotencyKey,
      requestHash,
      session,
    });
    const orderNumber = await getNextOrderNumber({ session });
    const settings = await SiteSettings.findOne().session(session).lean();
    const quote = await buildOrderQuote(
      {
        items: cleaned.cart,
        customer: cleaned.customer,
        billing: cleaned.billing,
        couponCode: cleaned.couponCode,
        customerEmail: getOrderCustomerEmail(cleaned),
        sessionId: cleaned.sessionId,
      },
      { session, settings }
    );
    assertValidQuote(quote, cleaned);

    const pricing = quote.pricing;
    const reservableItems = await expandReservableItems(pricing.items, {
      session,
    });
    const reservationRequired = reservableItems.length > 0;
    const orderBranchData = await resolveOrderBranchData(rawBody, cleaned, {
      session,
      reservableItems,
    });
    const hasAdminUser = Boolean(requestContext.adminUserId);
    const orderSource = getValidSource(
      rawBody?.source || cleaned.source,
      hasAdminUser
    );
    const createdByAdminSnapshot = buildAdminSnapshot(requestContext);
    const adminUserId =
      hasAdminUser && requestContext.adminUserId
        ? requestContext.adminUserId
        : null;

    const base = buildNewOrderDocument({
      cleaned,
      pricing,
      quote,
      orderNumber,
      orderBranchData,
      orderSource,
      createdByAdminSnapshot,
      adminUserId,
      reservationRequired,
    });
    base.status = base.status || 'pending';

    const customerResolution = await resolveCustomerForOrder(base, {
      session,
      source: orderSource,
    });
    const linkedBase = applyCustomerResolutionToOrderData(
      base,
      customerResolution
    );
    const createdDocuments = await Order.create([{ ...linkedBase }], {
      session,
    });
    const created = createdDocuments[0];
    await applyCustomerStatsForOrder(created, { session });

    let inventoryReservation = null;
    if (reservationRequired) {
      inventoryReservation = await createInventoryReservationForOrder({
        order: created,
        cleaned,
        rawBody,
        orderBranchData,
        orderSource,
        idempotencyKey,
        session,
      });
    }

    const storeCreditResult = await applyStoreCreditToNewOrder({
      order: created,
      cleaned,
      pricing,
      inventoryReservation,
      reservationRequired,
      session,
    });
    if (storeCreditResult.fullyPaidWithStoreCredit) {
      await applyCustomerStatsForOrder(created, { session });
    }

    await recordNewOrderCoupon({
      order: created,
      cleaned,
      quote,
      pricing,
      session,
    });
    await recordOrderCreatedEvent({
      order: created,
      requestIp: requestContext.ip,
      orderBranchData,
      orderSource,
      reservation: inventoryReservation,
      createdByAdminSnapshot,
      session,
    });

    const cartConversion = await markCartConverted(
      {
        sessionId: cleaned.sessionId,
        orderId: created._id,
        convertedAt: created.createdAt || new Date(),
      },
      { session }
    );
    if (Number(cartConversion?.matchedCount || 0) !== 1) {
      throw Object.assign(
        new Error('La credencial del carrito ya fue utilizada.'),
        { code: 'CART_ACCESS_ALREADY_USED', statusCode: 404 }
      );
    }

    if (idempotencyKey) {
      await completeIdempotencyRecord(
        idempotencyRecord,
        { order: created, reservation: inventoryReservation, pricing },
        { session }
      );
    }

    result = {
      created,
      inventoryReservation,
      fullyPaidWithStoreCredit:
        storeCreditResult.fullyPaidWithStoreCredit,
      newsletterIntent: normalizeNewsletterIntent(
        cleaned.customer,
        cleaned.sessionId
      ),
    };
  });

  return result;
}

module.exports = {
  assertReservationUsesEligibleBranches,
  createOrderInTransaction,
  getNextOrderNumber,
};
