'use strict';

const mongoose = require('mongoose');

const Order = require('../../models/Order');
const OrderEvent = require('../../models/OrderEvent');
const {
  MAX_ORDER_TIMELINE_ENTRIES,
  retainRecentOrderTimeline,
} = require('../../models/order/timelinePolicy');

function cleanText(value, maximum = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maximum);
}

function orderIdValue(order) {
  return order?._id || order?.id || null;
}

function createOrderTimelineWriter({
  mongooseAdapter = mongoose,
  OrderModel = Order,
  OrderEventModel = OrderEvent,
  now = () => new Date(),
} = {}) {
  if (!mongooseAdapter || typeof mongooseAdapter.startSession !== 'function') {
    throw new TypeError('ORDER_TIMELINE_MONGOOSE_ADAPTER_REQUIRED');
  }
  if (!OrderModel || typeof OrderModel.updateOne !== 'function') {
    throw new TypeError('ORDER_TIMELINE_ORDER_MODEL_REQUIRED');
  }
  if (!OrderEventModel || typeof OrderEventModel.create !== 'function') {
    throw new TypeError('ORDER_TIMELINE_EVENT_MODEL_REQUIRED');
  }

  async function write(
    {
      order,
      type = 'system',
      message = '',
      by = 'system',
      at = null,
      eventType = 'order_timeline_recorded',
      eventMeta = {},
    } = {},
    { session: externalSession = null } = {}
  ) {
    const orderId = orderIdValue(order);
    if (!orderId) return;

    const occurredAt = at instanceof Date ? at : now();
    const embeddedType = String(type || 'system');
    if (!['status', 'note', 'system'].includes(embeddedType)) {
      throw Object.assign(new Error('El tipo de evento de la orden no es válido.'), {
        code: 'ORDER_TIMELINE_TYPE_INVALID',
      });
    }
    const embeddedEntry = {
      type: embeddedType,
      message: String(message || ''),
      by: String(by || 'system'),
      at: occurredAt,
    };
    const canonicalEvent = {
      orderId,
      type: cleanText(eventType, 120) || 'order_timeline_recorded',
      message: embeddedEntry.message,
      meta: {
        ...(eventMeta && typeof eventMeta === 'object' ? eventMeta : {}),
        embeddedType: embeddedEntry.type,
        by: embeddedEntry.by,
        occurredAt,
      },
    };

    const persist = async (session) => {
      const updateResult = await OrderModel.updateOne(
        { _id: orderId },
        {
          $push: {
            timeline: {
              $each: [embeddedEntry],
              $slice: -MAX_ORDER_TIMELINE_ENTRIES,
            },
          },
        },
        { session }
      );
      if (Number(updateResult?.matchedCount ?? updateResult?.n ?? 0) !== 1) {
        throw Object.assign(
          new Error('La orden ya no está disponible para registrar su evento.'),
          { code: 'ORDER_TIMELINE_ORDER_NOT_FOUND' }
        );
      }
      await OrderEventModel.create([canonicalEvent], { session });
    };

    if (externalSession) {
      await persist(externalSession);
    } else {
      const session = await mongooseAdapter.startSession();
      try {
        await session.withTransaction(async () => persist(session));
      } finally {
        await session.endSession();
      }
    }

    if (order && Array.isArray(order.timeline)) {
      order.timeline = retainRecentOrderTimeline([
        ...order.timeline,
        embeddedEntry,
      ]);
      if (typeof order.unmarkModified === 'function') {
        order.unmarkModified('timeline');
      }
    }
  }

  return Object.freeze({ write });
}

const defaultWriter = createOrderTimelineWriter();

async function addOrderTimelineEvent(input, options) {
  return defaultWriter.write(input, options);
}

async function addCreditNoteCreatedEvent({
  order,
  creditNoteData,
  by = 'admin',
}) {
  const noteNumber =
    creditNoteData?.number ||
    creditNoteData?.reference_code ||
    '';

  await addOrderTimelineEvent({
    order,
    type: 'system',
    by,
    message: `Nota crédito ${noteNumber} creada correctamente en Factus.`,
    eventType: 'electronic_credit_note_created',
    eventMeta: {
      provider: 'factus',
      creditNoteNumber: cleanText(noteNumber, 160),
    },
  });
}

async function addInvoiceGeneratedEvent({
  order,
  invoiceNumber,
  by = 'system',
}) {
  await addOrderTimelineEvent({
    order,
    type: 'system',
    by,
    message: `Factura electrónica ${invoiceNumber || ''} generada correctamente.`,
    eventType: 'electronic_invoice_generated',
    eventMeta: { invoiceNumber: cleanText(invoiceNumber, 160) },
  });
}

async function addInvoiceValidatedEvent({
  order,
  invoiceNumber,
  by = 'system',
}) {
  await addOrderTimelineEvent({
    order,
    type: 'system',
    by,
    message: `Factura electrónica ${invoiceNumber || ''} validada por DIAN/Factus.`,
    eventType: 'electronic_invoice_validated',
    eventMeta: { invoiceNumber: cleanText(invoiceNumber, 160) },
  });
}

async function addInvoiceFailedEvent({
  order,
  error,
  by = 'system',
}) {
  await addOrderTimelineEvent({
    order,
    type: 'system',
    by,
    message: `Error en factura electrónica: ${
      error || 'Error desconocido'
    }`,
    eventType: 'electronic_invoice_failed',
    eventMeta: { error: cleanText(error || 'Error desconocido', 500) },
  });
}

async function addInvoiceDeletedEvent({
  order,
  invoiceNumber,
  by = 'admin',
}) {
  await addOrderTimelineEvent({
    order,
    type: 'system',
    by,
    message: `Factura electrónica ${
      invoiceNumber || ''
    } eliminada en Factus.`,
    eventType: 'electronic_invoice_deleted',
    eventMeta: { invoiceNumber: cleanText(invoiceNumber, 160) },
  });
}

async function addInvoiceRetryEvent({
  order,
  invoiceNumber,
  by = 'admin',
}) {
  await addOrderTimelineEvent({
    order,
    type: 'system',
    by,
    message: `Reintento manual de factura electrónica ${
      invoiceNumber || ''
    }.`,
    eventType: 'electronic_invoice_retry',
    eventMeta: { invoiceNumber: cleanText(invoiceNumber, 160) },
  });
}

module.exports = {
  addOrderTimelineEvent,
  addCreditNoteCreatedEvent,
  addInvoiceGeneratedEvent,
  addInvoiceValidatedEvent,
  addInvoiceFailedEvent,
  addInvoiceDeletedEvent,
  addInvoiceRetryEvent,
  createOrderTimelineWriter,
};
