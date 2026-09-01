'use strict';

const {
  classifyCartLifecycle,
  getCartMetrics,
} = require('../cartAdminOperationsService');

const FINAL_ORDER_STATUSES = new Set([
  'paid',
  'shipped',
  'delivered',
  'refunded',
]);

function toPlain(value = {}) {
  if (typeof value?.toObject === 'function') {
    return value.toObject({ virtuals: true });
  }
  return value || {};
}

function asId(value) {
  if (!value) return '';
  if (typeof value === 'object' && (value._id || value.id)) {
    return String(value._id || value.id);
  }
  return String(value);
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

function serializeOrder(order = {}) {
  const raw = toPlain(order);
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    id: asId(raw._id || raw.id),
    orderNumber: cleanText(raw.orderNumber),
    status: cleanText(raw.status).toLowerCase(),
    fulfillmentStatus: cleanText(raw.fulfillmentStatus).toLowerCase(),
    source: cleanText(raw.source).toLowerCase(),
    channel: cleanText(raw.channel).toLowerCase(),
    saleType: cleanText(raw.saleType).toLowerCase(),
    subtotal: money(raw.subtotal),
    shipping: money(raw.shipping),
    total: money(raw.total),
    itemsCount: items.reduce(
      (total, item) => total + Math.max(0, Number(item.quantity || item.qty || 0)),
      0
    ),
    branch: {
      id: asId(raw.branch),
      name: cleanText(raw.branchSnapshot?.name),
      code: cleanText(raw.branchSnapshot?.code),
    },
    payment: {
      status: cleanText(raw.payment?.status).toLowerCase(),
      provider: cleanText(raw.payment?.provider).toLowerCase(),
      providerLabel: cleanText(raw.payment?.providerLabel),
      method: cleanText(raw.payment?.method || raw.payment?.methodType).toLowerCase(),
      methodLabel: cleanText(raw.payment?.methodLabel || raw.payment?.checkoutLabel),
      amount: money(raw.payment?.amount || raw.total),
      currency: cleanText(raw.payment?.currency || 'COP').toUpperCase(),
      transactionId: cleanText(raw.payment?.transactionId),
      reference: cleanText(raw.payment?.reference),
      paidAt: raw.payment?.paidAt || null,
      reviewRequired: raw.payment?.reviewRequired === true,
      reviewMessage: cleanText(raw.payment?.reviewMessage),
    },
    storeCredit: {
      applied: raw.storeCredit?.applied === true,
      amount: money(raw.storeCredit?.amount),
      status: cleanText(raw.storeCredit?.status).toLowerCase(),
      references: Array.isArray(raw.storeCredit?.references)
        ? raw.storeCredit.references.map(cleanText).filter(Boolean)
        : [],
    },
    refund: {
      amount: money(raw.refundControl?.totalAmount),
      count: Math.max(0, Number(raw.refundControl?.transactionCount || 0)),
      reconciliationState: cleanText(
        raw.refundControl?.reconciliationState
      ).toLowerCase(),
    },
    returns: {
      count: Math.max(0, Number(raw.returnControl?.requestCount || 0)),
      activeCount: Math.max(0, Number(raw.returnControl?.activeCount || 0)),
    },
    logistics: {
      status: cleanText(raw.fulfillment?.logisticsSummary?.status).toLowerCase(),
      shipmentCount: Math.max(
        0,
        Number(raw.fulfillment?.logisticsSummary?.shipmentCount || 0)
      ),
      exceptionCount: Math.max(
        0,
        Number(raw.fulfillment?.logisticsSummary?.exceptionCount || 0)
      ),
    },
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

function serializeAttempt(attempt = {}) {
  const raw = toPlain(attempt);
  return {
    id: asId(raw._id || raw.id),
    orderId: asId(raw.order),
    orderNumber: cleanText(raw.orderNumber),
    provider: cleanText(raw.provider).toLowerCase(),
    state: cleanText(raw.state).toLowerCase(),
    active: raw.active === true,
    amount: money(Number(raw.amountInCents || 0) / 100),
    currency: cleanText(raw.currency || 'COP').toUpperCase(),
    reference: cleanText(raw.reference),
    transactionId: cleanText(raw.transactionId),
    providerStatus: cleanText(raw.providerStatus),
    reconciliationRequired: raw.reconciliation?.required === true,
    reconciliationMessage: cleanText(raw.reconciliation?.message),
    issuedAt: raw.issuedAt || raw.createdAt || null,
    finalizedAt: raw.finalizedAt || null,
  };
}

function serializePayment(order = {}, attempts = []) {
  const serializedOrder = serializeOrder(order);
  const records = attempts.map(serializeAttempt);
  return {
    id: serializedOrder.id,
    orderId: serializedOrder.id,
    orderNumber: serializedOrder.orderNumber,
    status: serializedOrder.payment.status || serializedOrder.status,
    provider: serializedOrder.payment.provider,
    providerLabel: serializedOrder.payment.providerLabel,
    method: serializedOrder.payment.method,
    methodLabel: serializedOrder.payment.methodLabel,
    amount: serializedOrder.payment.amount,
    currency: serializedOrder.payment.currency,
    transactionId: serializedOrder.payment.transactionId,
    reference: serializedOrder.payment.reference,
    paidAt: serializedOrder.payment.paidAt,
    reviewRequired:
      serializedOrder.payment.reviewRequired ||
      records.some((item) => item.reconciliationRequired),
    attempts: records,
    createdAt: serializedOrder.createdAt,
  };
}

function serializeCreditNote(note = {}, invoice = {}) {
  const raw = toPlain(note);
  return {
    id: asId(raw._id || raw.id),
    invoiceId: asId(invoice._id || invoice.id),
    orderId: asId(invoice.orderId),
    orderNumber: cleanText(invoice.orderNumber),
    type: cleanText(raw.type).toLowerCase(),
    status: cleanText(raw.status).toLowerCase(),
    reason: cleanText(raw.reasonText),
    referenceCode: cleanText(raw.referenceCode),
    number: cleanText(raw.provider?.number || raw.billNumber),
    cude: cleanText(raw.provider?.cude),
    amount: money(raw.totalAmount),
    createdAt: raw.createdAt || null,
    validatedAt: raw.validatedAt || raw.provider?.validatedAt || null,
    pdfAvailable: raw.officialDocuments?.pdf?.available === true,
    xmlAvailable: raw.officialDocuments?.xml?.available === true,
  };
}

function serializeInvoice(invoice = {}, associatedOrder = {}) {
  const raw = toPlain(invoice);
  const order = toPlain(associatedOrder);
  const storedTotal = money(raw.totals?.total);
  const orderTotal = money(order.total);
  const recoveredFromOrder = storedTotal <= 0 && orderTotal > 0;
  return {
    id: asId(raw._id || raw.id),
    orderId: asId(raw.orderId),
    orderNumber: cleanText(raw.orderNumber),
    status: cleanText(raw.status).toLowerCase(),
    invoiceNumber: cleanText(raw.invoiceNumber || raw.provider?.number),
    cufe: cleanText(raw.cufe || raw.provider?.cufe),
    provider: cleanText(raw.provider?.name).toLowerCase(),
    providerStatus: cleanText(raw.provider?.status),
    validated: raw.provider?.isValidated === true || raw.status === 'accepted',
    total: recoveredFromOrder ? orderTotal : storedTotal,
    totalSource: recoveredFromOrder ? 'order' : 'invoice',
    currency: cleanText(raw.totals?.currency || 'COP').toUpperCase(),
    pdfUrl: cleanText(raw.pdfUrl || raw.provider?.links?.public_url),
    xmlUrl: cleanText(raw.xmlUrl),
    pdfAvailable:
      Boolean(raw.pdfUrl || raw.provider?.links?.public_url) ||
      raw.officialDocuments?.pdf?.available === true,
    xmlAvailable:
      Boolean(raw.xmlUrl) || raw.officialDocuments?.xml?.available === true,
    emailStatus: cleanText(raw.emailDelivery?.status).toLowerCase(),
    creditNotes: Array.isArray(raw.creditNotes)
      ? raw.creditNotes
          .filter((note) => cleanText(note?.status).toLowerCase() !== 'deleted')
          .map((note) => serializeCreditNote(note, raw))
      : [],
    generatedAt: raw.generatedAt || raw.createdAt || null,
    acceptedAt: raw.acceptedAt || raw.provider?.validatedAt || null,
    createdAt: raw.createdAt || null,
  };
}

function serializeReturn(returnCase = {}) {
  const raw = toPlain(returnCase);
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    id: asId(raw._id || raw.id),
    returnNumber: cleanText(raw.returnNumber),
    orderId: asId(raw.order),
    orderNumber: cleanText(raw.orderNumber),
    status: cleanText(raw.status).toLowerCase(),
    requestedResolution: cleanText(raw.requestedResolution).toLowerCase(),
    reason: cleanText(raw.reasonSummary),
    itemsCount: items.length,
    requestedUnits: items.reduce(
      (total, item) => total + Math.max(0, Number(item.requestedQuantity || 0)),
      0
    ),
    estimatedAmount: money(raw.estimatedRefundAmount),
    risk: {
      level: cleanText(raw.riskAssessment?.level).toLowerCase(),
      decision: cleanText(raw.riskAssessment?.decision).toLowerCase(),
      score: Math.max(0, Number(raw.riskAssessment?.score || 0)),
    },
    resolution: {
      type: cleanText(raw.resolution?.type).toLowerCase(),
      state: cleanText(raw.resolution?.state).toLowerCase(),
      amount: money(raw.resolution?.amount),
      reference: cleanText(raw.resolution?.reference),
      storeCreditNumber: cleanText(raw.resolution?.storeCreditNumber),
      replacementOrderNumber: cleanText(raw.resolution?.replacementOrderNumber),
      completedAt: raw.resolution?.completedAt || null,
    },
    shipping: {
      status: cleanText(raw.shipping?.status).toLowerCase(),
      provider: cleanText(raw.shipping?.provider).toLowerCase(),
      trackingNumber: cleanText(raw.shipping?.trackingNumber),
      trackingUrl: cleanText(raw.shipping?.trackingUrl),
    },
    requestedAt: raw.requestedAt || raw.createdAt || null,
    resolvedAt: raw.resolvedAt || null,
    createdAt: raw.createdAt || null,
  };
}

function serializeRefund(refund = {}) {
  const raw = toPlain(refund);
  return {
    id: asId(raw._id || raw.id),
    refundNumber: cleanText(raw.refundNumber),
    orderId: asId(raw.order),
    orderNumber: cleanText(raw.orderNumber),
    returnId: asId(raw.returnCase),
    status: cleanText(raw.status).toLowerCase(),
    amount: money(raw.amount),
    currency: cleanText(raw.currency || 'COP').toUpperCase(),
    reason: cleanText(raw.reason),
    reconciliation: {
      state: cleanText(raw.reconciliation?.state).toLowerCase(),
      inventory: cleanText(raw.reconciliation?.inventory?.state).toLowerCase(),
      payment: cleanText(raw.reconciliation?.payment?.state).toLowerCase(),
      cash: cleanText(raw.reconciliation?.cash?.state).toLowerCase(),
      billing: cleanText(raw.reconciliation?.billing?.state).toLowerCase(),
    },
    processedAt: raw.processedAt || null,
    createdAt: raw.createdAt || null,
  };
}

function serializeShipments(orders = [], operations = []) {
  const operationsByShipment = operations.reduce((map, operation) => {
    const raw = toPlain(operation);
    const shipmentId = asId(raw.shipmentId);
    if (!shipmentId) return map;
    const current = map.get(shipmentId) || [];
    current.push({
      id: asId(raw._id || raw.id),
      type: cleanText(raw.type).toLowerCase(),
      status: cleanText(raw.status).toLowerCase(),
      provider: cleanText(raw.provider).toLowerCase(),
      trackingNumber: cleanText(raw.trackingNumber),
      attempts: Math.max(0, Number(raw.attempts || 0)),
      error: cleanText(raw.error?.message),
      createdAt: raw.createdAt || null,
    });
    map.set(shipmentId, current);
    return map;
  }, new Map());

  return orders.flatMap((order) => {
    const raw = toPlain(order);
    const shipments = Array.isArray(raw.fulfillment?.shipments)
      ? raw.fulfillment.shipments
      : [];
    return shipments.map((shipment) => {
      const shipmentId = asId(shipment._id || shipment.id);
      return {
        id: shipmentId,
        orderId: asId(raw._id || raw.id),
        orderNumber: cleanText(raw.orderNumber),
        code: cleanText(shipment.code),
        status: cleanText(shipment.status).toLowerCase(),
        priority: cleanText(shipment.priority).toLowerCase(),
        branch: {
          id: asId(shipment.branch),
          name: cleanText(shipment.branchSnapshot?.name),
          code: cleanText(shipment.branchSnapshot?.code),
        },
        carrier: {
          code: cleanText(shipment.carrier?.code),
          name: cleanText(shipment.carrier?.name),
          serviceLevel: cleanText(shipment.carrier?.serviceLevel),
          trackingNumber: cleanText(shipment.carrier?.trackingNumber),
          trackingUrl: cleanText(shipment.carrier?.trackingUrl),
        },
        incidentCount: Array.isArray(shipment.incidents)
          ? shipment.incidents.length
          : 0,
        slaBreached: Boolean(shipment.sla?.breachedAt),
        nextDueAt:
          shipment.sla?.deliveryDueAt ||
          shipment.sla?.dispatchDueAt ||
          shipment.sla?.pickingDueAt ||
          null,
        deliveredAt: shipment.deliveredAt || null,
        updatedAt: shipment.updatedAt || raw.updatedAt || null,
        operations: operationsByShipment.get(shipmentId) || [],
      };
    });
  });
}

function serializeCart(cart = {}) {
  const raw = toPlain(cart);
  const metrics = getCartMetrics(raw);
  const lifecycle = classifyCartLifecycle(raw);
  return {
    id: asId(raw._id || raw.id),
    sessionId: cleanText(raw.sessionId),
    lifecycle,
    customerName: cleanText(raw.userName),
    customerEmail: cleanText(raw.userEmail).toLowerCase(),
    itemsCount: metrics.differentProducts,
    units: metrics.totalUnits,
    subtotal: money(metrics.subtotal),
    recoveryAttempts: metrics.recoveryAttemptsCount,
    convertedOrderId: asId(raw.convertedOrderId),
    convertedAt: raw.convertedAt || null,
    lastActivityAt:
      raw.lastCustomerActivityAt || raw.updatedAt || raw.createdAt || null,
    createdAt: raw.createdAt || null,
  };
}

function serializeStoreCredit(credit = {}) {
  const raw = toPlain(credit);
  return {
    id: asId(raw._id || raw.id),
    creditNumber: cleanText(raw.creditNumber),
    status: cleanText(raw.status).toLowerCase(),
    currency: cleanText(raw.currency || 'COP').toUpperCase(),
    originalAmount: money(raw.originalAmount),
    balance: money(raw.balance),
    sourceOrderId: asId(raw.sourceOrder),
    sourceOrderNumber: cleanText(raw.sourceOrderNumber),
    sourceReturnId: asId(raw.sourceReturn),
    expiresAt: raw.expiresAt || null,
    issuedAt: raw.issuedAt || raw.createdAt || null,
  };
}

function serializeStoreCreditUsage(usage = {}) {
  const raw = toPlain(usage);
  return {
    id: asId(raw._id || raw.id),
    orderId: asId(raw.order),
    orderNumber: cleanText(raw.orderNumber),
    status: cleanText(raw.status).toLowerCase(),
    currency: cleanText(raw.currency || 'COP').toUpperCase(),
    amount: money(raw.amount),
    reservedAt: raw.reservedAt || raw.createdAt || null,
    consumedAt: raw.consumedAt || null,
    releasedAt: raw.releasedAt || null,
    releaseReason: cleanText(raw.releaseReason),
  };
}

function isPaidOrder(order = {}) {
  return order.payment?.status === 'paid' || FINAL_ORDER_STATUSES.has(order.status);
}

function buildSummary({
  orders = [],
  attempts = [],
  invoices = [],
  returns = [],
  refunds = [],
  shipments = [],
  carts = [],
  storeCredits = [],
  storeCreditUsages = [],
  totalOrders = orders.length,
} = {}) {
  const paidOrders = orders.filter(isPaidOrder);
  const grossSales = paidOrders.reduce((sum, order) => sum + money(order.total), 0);
  const refundedAmount = refunds
    .filter((refund) => refund.status === 'processed')
    .reduce((sum, refund) => sum + money(refund.amount), 0);
  const creditNotes = invoices.flatMap((invoice) => invoice.creditNotes || []);
  const activeReturnStatuses = new Set([
    'requested',
    'authorized',
    'in_transit',
    'received',
    'inspected',
    'resolution_required',
  ]);
  const activeShipmentStatuses = new Set([
    'ready_to_pick',
    'picking',
    'packed',
    'ready_to_dispatch',
    'dispatched',
    'in_transit',
    'exception',
  ]);

  return {
    commercial: {
      totalOrders,
      loadedOrders: orders.length,
      paidOrders: paidOrders.length,
      pendingOrders: orders.filter((order) =>
        ['pending', 'processing'].includes(order.status)
      ).length,
      cancelledOrders: orders.filter((order) =>
        ['cancelled', 'canceled', 'failed'].includes(order.status)
      ).length,
      grossSales,
      refundedAmount,
      netSales: Math.max(0, money(grossSales - refundedAmount)),
      averageTicket: paidOrders.length ? money(grossSales / paidOrders.length) : 0,
    },
    payments: {
      paid: paidOrders.length,
      pending: orders.filter((order) =>
        ['pending_gateway', 'pending_manual'].includes(order.payment?.status)
      ).length,
      failed: orders.filter((order) =>
        ['failed', 'cancelled'].includes(order.payment?.status)
      ).length,
      attempts: attempts.length,
      declinedAttempts: attempts.filter((attempt) =>
        ['declined', 'error', 'cancelled'].includes(attempt.state)
      ).length,
      reconciliationRequired: attempts.filter(
        (attempt) => attempt.reconciliationRequired
      ).length,
    },
    billing: {
      invoices: invoices.length,
      accepted: invoices.filter((invoice) => invoice.validated).length,
      pending: invoices.filter((invoice) =>
        ['pending', 'processing', 'reconciliation_pending', 'generated', 'sent'].includes(
          invoice.status
        )
      ).length,
      failed: invoices.filter((invoice) =>
        ['rejected', 'failed', 'error'].includes(invoice.status)
      ).length,
      creditNotes: creditNotes.length,
      creditNoteAmount: creditNotes.reduce(
        (sum, note) => sum + money(note.amount),
        0
      ),
    },
    returns: {
      total: returns.length,
      active: returns.filter((item) => activeReturnStatuses.has(item.status)).length,
      resolved: returns.filter((item) => item.status === 'resolved').length,
      refunds: refunds.length,
      refundedAmount,
    },
    shipping: {
      total: shipments.length,
      active: shipments.filter((item) => activeShipmentStatuses.has(item.status)).length,
      delivered: shipments.filter((item) => item.status === 'delivered').length,
      incidents: shipments.reduce(
        (sum, item) => sum + Number(item.incidentCount || 0),
        0
      ),
      slaBreaches: shipments.filter((item) => item.slaBreached).length,
    },
    carts: {
      total: carts.length,
      active: carts.filter((item) => item.lifecycle === 'active').length,
      abandoned: carts.filter((item) =>
        ['abandoned', 'recoverable', 'inactive'].includes(item.lifecycle)
      ).length,
      recoverable: carts.filter((item) => item.lifecycle === 'recoverable').length,
      converted: carts.filter((item) => item.lifecycle === 'converted').length,
      openValue: carts
        .filter((item) => item.lifecycle !== 'converted')
        .reduce((sum, item) => sum + money(item.subtotal), 0),
    },
    storeCredit: {
      issued: storeCredits.reduce(
        (sum, credit) => sum + money(credit.originalAmount),
        0
      ),
      activeBalance: storeCredits
        .filter((credit) => credit.status === 'active')
        .reduce((sum, credit) => sum + money(credit.balance), 0),
      activeCredits: storeCredits.filter((credit) => credit.status === 'active').length,
      consumed: storeCreditUsages
        .filter((usage) => usage.status === 'consumed')
        .reduce((sum, usage) => sum + money(usage.amount), 0),
    },
  };
}

function activityEntry(type, occurredAt, data = {}) {
  if (!occurredAt) return null;
  return {
    type,
    occurredAt,
    title: cleanText(data.title),
    detail: cleanText(data.detail),
    status: cleanText(data.status).toLowerCase(),
    amount: data.amount == null ? null : money(data.amount),
    orderId: cleanText(data.orderId),
    orderNumber: cleanText(data.orderNumber),
    reference: cleanText(data.reference),
  };
}

function buildActivity({
  orders = [],
  attempts = [],
  invoices = [],
  returns = [],
  refunds = [],
  shipments = [],
  carts = [],
  storeCredits = [],
  storeCreditUsages = [],
} = {}, limit = 100) {
  const entries = [];

  orders.forEach((order) => {
    entries.push(activityEntry('order', order.createdAt, {
      title: `Orden ${order.orderNumber}`,
      detail: 'Compra registrada',
      status: order.status,
      amount: order.total,
      orderId: order.id,
      orderNumber: order.orderNumber,
    }));
    entries.push(activityEntry('payment', order.payment?.paidAt, {
      title: `Pago de ${order.orderNumber}`,
      detail: order.payment?.providerLabel || order.payment?.provider,
      status: order.payment?.status,
      amount: order.payment?.amount,
      orderId: order.id,
      orderNumber: order.orderNumber,
      reference: order.payment?.transactionId || order.payment?.reference,
    }));
  });

  attempts.forEach((attempt) => entries.push(activityEntry(
    'payment_attempt',
    attempt.finalizedAt || attempt.issuedAt,
    {
      title: `Intento de pago ${attempt.orderNumber}`,
      detail: attempt.provider,
      status: attempt.state,
      amount: attempt.amount,
      orderId: attempt.orderId,
      orderNumber: attempt.orderNumber,
      reference: attempt.transactionId || attempt.reference,
    }
  )));

  invoices.forEach((invoice) => {
    entries.push(activityEntry('invoice', invoice.acceptedAt || invoice.generatedAt, {
      title: invoice.invoiceNumber
        ? `Factura ${invoice.invoiceNumber}`
        : `Factura de ${invoice.orderNumber}`,
      detail: invoice.provider,
      status: invoice.status,
      amount: invoice.total,
      orderId: invoice.orderId,
      orderNumber: invoice.orderNumber,
      reference: invoice.cufe,
    }));
    (invoice.creditNotes || []).forEach((note) => entries.push(activityEntry(
      'credit_note',
      note.validatedAt || note.createdAt,
      {
        title: note.number ? `Nota crédito ${note.number}` : 'Nota crédito',
        detail: note.reason,
        status: note.status,
        amount: note.amount,
        orderId: note.orderId,
        orderNumber: note.orderNumber,
        reference: note.referenceCode,
      }
    )));
  });

  returns.forEach((item) => entries.push(activityEntry(
    'return',
    item.resolvedAt || item.requestedAt,
    {
      title: `Devolución ${item.returnNumber}`,
      detail: item.reason || item.requestedResolution,
      status: item.status,
      amount: item.resolution?.amount || item.estimatedAmount,
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      reference: item.returnNumber,
    }
  )));

  refunds.forEach((item) => entries.push(activityEntry(
    'refund',
    item.processedAt || item.createdAt,
    {
      title: `Reembolso ${item.refundNumber}`,
      detail: item.reason,
      status: item.status,
      amount: item.amount,
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      reference: item.refundNumber,
    }
  )));

  shipments.forEach((item) => entries.push(activityEntry(
    'shipment',
    item.deliveredAt || item.updatedAt,
    {
      title: `Envío ${item.code || item.orderNumber}`,
      detail: item.carrier?.name || item.carrier?.trackingNumber,
      status: item.status,
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      reference: item.carrier?.trackingNumber,
    }
  )));

  carts.forEach((item) => entries.push(activityEntry(
    'cart',
    item.convertedAt || item.lastActivityAt || item.createdAt,
    {
      title: item.lifecycle === 'converted' ? 'Carrito convertido' : 'Actividad de carrito',
      detail: `${item.units} unidad(es)`,
      status: item.lifecycle,
      amount: item.subtotal,
      orderId: item.convertedOrderId,
      reference: item.sessionId,
    }
  )));

  storeCredits.forEach((item) => entries.push(activityEntry(
    'store_credit',
    item.issuedAt,
    {
      title: `Saldo ${item.creditNumber}`,
      detail: 'Saldo a favor emitido',
      status: item.status,
      amount: item.originalAmount,
      orderId: item.sourceOrderId,
      orderNumber: item.sourceOrderNumber,
      reference: item.creditNumber,
    }
  )));

  storeCreditUsages.forEach((item) => entries.push(activityEntry(
    'store_credit_usage',
    item.consumedAt || item.releasedAt || item.reservedAt,
    {
      title: `Uso de saldo en ${item.orderNumber}`,
      detail: item.releaseReason,
      status: item.status,
      amount: item.amount,
      orderId: item.orderId,
      orderNumber: item.orderNumber,
    }
  )));

  return entries
    .filter(Boolean)
    .sort((left, right) =>
      new Date(right.occurredAt || 0).getTime() -
      new Date(left.occurredAt || 0).getTime()
    )
    .slice(0, limit);
}

module.exports = {
  buildActivity,
  buildSummary,
  serializeAttempt,
  serializeCart,
  serializeInvoice,
  serializeOrder,
  serializePayment,
  serializeRefund,
  serializeReturn,
  serializeShipments,
  serializeStoreCredit,
  serializeStoreCreditUsage,
};
