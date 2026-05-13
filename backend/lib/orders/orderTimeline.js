// backend/lib/orders/orderTimeline.js

async function addOrderTimelineEvent({
  order,
  type = 'system',
  message = '',
  by = 'system',
}) {
  if (!order) return;

  order.timeline = Array.isArray(order.timeline)
    ? order.timeline
    : [];

  order.timeline.push({
    type,
    message,
    by,
    at: new Date(),
  });

  await order.save();
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
};