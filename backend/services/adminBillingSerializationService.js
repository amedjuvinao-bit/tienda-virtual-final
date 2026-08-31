'use strict';

// Serialización de lectura para Facturación. Este módulo de dominio inferior
// no conoce orquestadores, persistencia ni servicios de emisión/sincronización.

const {
  extractFactusLinks,
} = require('../lib/dian/factusDownloads');

function cleanText(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getProviderStatus(invoice = {}) {
  return cleanText(
    invoice?.provider?.status ||
      invoice?.dianResponse?.code ||
      invoice?.status ||
      '',
    60
  ).toLowerCase();
}

function isValidatedInvoice(invoice = {}) {
  const status = cleanText(invoice.status, 60).toLowerCase();
  const providerStatus = getProviderStatus(invoice);

  return (
    ['accepted', 'validated', 'validada', 'validado'].includes(status) ||
    ['accepted', 'validated', 'validada', 'validado'].includes(providerStatus) ||
    invoice?.provider?.isValidated === true ||
    Boolean(invoice?.provider?.validatedAt || invoice?.acceptedAt)
  );
}

function getInvoiceLinks(invoice = {}) {
  const factusLinks = extractFactusLinks(invoice);
  const providerLinks = invoice?.provider?.links || {};

  return {
    pdfUrl: invoice.pdfUrl || factusLinks?.pdfUrl || providerLinks?.pdf_url || providerLinks?.pdfUrl || '',
    publicUrl: factusLinks?.publicUrl || providerLinks?.public_url || providerLinks?.publicUrl || '',
    xmlUrl: invoice.xmlUrl || providerLinks?.xml_url || providerLinks?.xmlUrl || '',
    qrUrl: invoice.qrUrl || providerLinks?.qr_url || providerLinks?.qrUrl || '',
  };
}

function getCreditNoteLinks(note = {}) {
  const links = note?.provider?.links || {};
  const rawLinks = note?.provider?.raw?.data?.links || note?.provider?.raw?.links || {};

  return {
    publicUrl: links.public_url || links.publicUrl || rawLinks.public_url || rawLinks.publicUrl || '',
    qrUrl: links.qr || links.qrUrl || rawLinks.qr || rawLinks.qrUrl || '',
    pdfUrl: links.pdf_url || links.pdfUrl || rawLinks.pdf_url || rawLinks.pdfUrl || '',
    xmlUrl: links.xml_url || links.xmlUrl || rawLinks.xml_url || rawLinks.xmlUrl || '',
  };
}

function serializeSync(sync = {}) {
  return {
    status: sync?.status || 'never',
    provider: sync?.provider || '',
    providerStatus: sync?.providerStatus || '',
    message: sync?.message || '',
    httpStatus: sync?.httpStatus ?? null,
    adminUser: sync?.adminUser || '',
    lastAttemptAt: sync?.lastAttemptAt || null,
    lastSuccessAt: sync?.lastSuccessAt || null,
  };
}

function serializeEmailDelivery(delivery = {}, customer = {}) {
  const history = Array.isArray(delivery?.history) ? delivery.history : [];

  return {
    status: delivery?.status || 'pending',
    recipient: delivery?.recipient || customer?.email || '',
    source: delivery?.source || 'automatic',
    initiatedBy: delivery?.initiatedBy || '',
    attempts: Number(delivery?.attempts || 0),
    messageId: delivery?.messageId || '',
    lastError: delivery?.lastError || '',
    lastAttemptAt: delivery?.lastAttemptAt || null,
    lastSentAt: delivery?.lastSentAt || null,
    attachments: Array.isArray(delivery?.attachments) ? delivery.attachments : [],
    history: history.slice(-10),
  };
}

function serializeElectronicInvoice(invoice = {}) {
  const links = getInvoiceLinks(invoice);
  const providerName = cleanText(invoice?.provider?.name, 60).toLowerCase();
  const providerNumber = cleanText(invoice?.provider?.number || invoice.invoiceNumber, 160);
  const hasOfficialFactusDocument =
    providerName === 'factus' &&
    Boolean(providerNumber) &&
    isValidatedInvoice(invoice);
  const officialDocuments = invoice.officialDocuments || {};

  return {
    id: String(invoice._id || ''),
    orderId: invoice.orderId ? String(invoice.orderId) : '',
    orderNumber: invoice.orderNumber || '',
    required: invoice.required === true,
    status: invoice.status || 'pending',
    invoiceNumber: invoice.invoiceNumber || invoice?.provider?.number || '',
    cufe: invoice.cufe || invoice?.provider?.cufe || '',
    customer: invoice.customer || {},
    totals: invoice.totals || {},
    fiscalInfo: invoice.fiscalInfo || {},
    dianResolution: invoice.dianResolution || {},
    provider: {
      name: invoice?.provider?.name || '',
      id: Number(invoice?.provider?.id || 0) || null,
      status: invoice?.provider?.status || '',
      referenceCode: invoice?.provider?.referenceCode || '',
      number: invoice?.provider?.number || '',
      cufe: invoice?.provider?.cufe || '',
      isValidated: invoice?.provider?.isValidated === true,
      validatedAt: invoice?.provider?.validatedAt || '',
    },
    dianResponse: invoice.dianResponse || {},
    emission: invoice.emission
      ? {
          state: invoice.emission.state || '',
          source: invoice.emission.source || '',
          initiatedBy: invoice.emission.initiatedBy || '',
          attempts: Number(invoice.emission.attempts || 0),
          firstAttemptAt: invoice.emission.firstAttemptAt || null,
          lastAttemptAt: invoice.emission.lastAttemptAt || null,
          completedAt: invoice.emission.completedAt || null,
          failedAt: invoice.emission.failedAt || null,
        }
      : null,
    hasXml: Boolean(
      officialDocuments?.xml?.available ||
      hasOfficialFactusDocument ||
      cleanText(invoice.xmlContent, 20) ||
      links.xmlUrl
    ),
    hasPdf: Boolean(
      officialDocuments?.pdf?.available ||
      hasOfficialFactusDocument ||
      links.pdfUrl ||
      links.publicUrl
    ),
    officialDocuments: {
      pdf: officialDocuments?.pdf || null,
      xml: officialDocuments?.xml || null,
    },
    emailDelivery: serializeEmailDelivery(invoice.emailDelivery, invoice.customer),
    links,
    errorMessage: invoice.errorMessage || '',
    providerErrors: invoice.providerErrors || {},
    sync: serializeSync(invoice.sync),
    creditNotesCount: Number.isFinite(Number(invoice._billingCreditNotesCount))
      ? Number(invoice._billingCreditNotesCount)
      : Array.isArray(invoice.creditNotes)
        ? invoice.creditNotes.length
        : 0,
    generatedAt: invoice.generatedAt || null,
    sentAt: invoice.sentAt || null,
    acceptedAt: invoice.acceptedAt || null,
    rejectedAt: invoice.rejectedAt || null,
    failedAt: invoice.failedAt || null,
    createdAt: invoice.createdAt || null,
    updatedAt: invoice.updatedAt || null,
  };
}

function serializeCreditNote(invoice = {}, note = {}, index = 0) {
  const links = getCreditNoteLinks(note);
  const customer = invoice.customer || {};
  const officialDocuments = note.officialDocuments || {};

  return {
    id: String(note._id || `${invoice._id || 'invoice'}-${index}`),
    invoiceId: String(invoice._id || ''),
    orderId: invoice.orderId ? String(invoice.orderId) : '',
    orderNumber: invoice.orderNumber || '',
    invoiceNumber: invoice.invoiceNumber || invoice?.provider?.number || note.billNumber || '',
    invoiceStatus: invoice.status || 'pending',
    invoiceCufe: invoice.cufe || invoice?.provider?.cufe || '',
    customer,
    noteNumber: note?.provider?.number || note.number || note.referenceCode || '',
    referenceCode: note.referenceCode || note?.provider?.referenceCode || '',
    billNumber: note.billNumber || invoice.invoiceNumber || invoice?.provider?.number || '',
    type: note.type || 'total',
    status: note.status || note?.provider?.status || 'created',
    reasonCode: note.reasonCode || '',
    reasonText: note.reasonText || note.reason || note.observation || '',
    subtotal: money(note.subtotal),
    taxAmount: money(note.taxAmount),
    totalAmount: money(note.totalAmount || note.total || note.amount),
    itemsCount: Array.isArray(note.items) ? note.items.length : 0,
    items: Array.isArray(note.items) ? note.items : [],
    idempotencyKey: note.idempotencyKey || '',
    emission: note.emission
      ? {
          state: note.emission.state || '',
          source: note.emission.source || '',
          initiatedBy: note.emission.initiatedBy || '',
          attempts: Number(note.emission.attempts || 0),
          firstAttemptAt: note.emission.firstAttemptAt || null,
          lastAttemptAt: note.emission.lastAttemptAt || null,
          completedAt: note.emission.completedAt || null,
          failedAt: note.emission.failedAt || null,
        }
      : null,
    provider: {
      name: note?.provider?.name || invoice?.provider?.name || '',
      id: Number(note?.provider?.id || 0) || null,
      status: note?.provider?.status || '',
      number: note?.provider?.number || '',
      cude: note?.provider?.cude || note?.provider?.cufe || '',
      cufe: note?.provider?.cufe || note?.provider?.cude || '',
      isValidated: note?.provider?.isValidated === true,
      validatedAt: note?.provider?.validatedAt || '',
    },
    links,
    hasPdf: Boolean(officialDocuments?.pdf?.available || note?.provider?.isValidated),
    hasXml: Boolean(officialDocuments?.xml?.available || note?.provider?.isValidated),
    officialDocuments: {
      pdf: officialDocuments?.pdf || null,
      xml: officialDocuments?.xml || null,
    },
    errorMessage: note.errorMessage || '',
    providerErrors: note.providerErrors || {},
    sync: serializeSync(note.sync),
    createdAt: note.createdAt || invoice.updatedAt || invoice.createdAt || null,
    updatedAt: note.updatedAt || null,
    invoice: serializeElectronicInvoice(invoice),
  };
}


module.exports = {
  serializeCreditNote,
  serializeElectronicInvoice,
  serializeEmailDelivery,
};
