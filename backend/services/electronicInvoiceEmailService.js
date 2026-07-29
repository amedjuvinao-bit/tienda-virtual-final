'use strict';

const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const MailSettings = require('../models/MailSettings');
const { sendMail } = require('../lib/mail/mailer');
const {
  downloadOfficialInvoiceDocument,
} = require('./electronicInvoiceDocumentService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENDING_LOCK_MS = 5 * 60 * 1000;

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizeEmail(value) {
  return cleanText(value, 220).toLowerCase();
}

function createEmailError(message, status, code, details = {}) {
  return Object.assign(new Error(message), { status, code, ...details });
}

function isValidatedInvoice(invoice = {}) {
  const status = cleanText(invoice?.status, 40).toLowerCase();
  const providerStatus = cleanText(invoice?.provider?.status, 40).toLowerCase();

  return (
    ['accepted', 'validated'].includes(status) ||
    ['accepted', 'validated'].includes(providerStatus) ||
    invoice?.provider?.isValidated === true
  );
}

function isFactusInvoice(invoice = {}) {
  return cleanText(invoice?.provider?.name, 40).toLowerCase() === 'factus';
}

async function findInvoice(identifier) {
  const text = cleanText(identifier, 220);
  if (!text) return null;

  if (mongoose.Types.ObjectId.isValid(text)) {
    const byId = await ElectronicInvoice.findById(text);
    if (byId) return byId;
  }

  return ElectronicInvoice.findOne({
    $or: [
      { invoiceNumber: text },
      { orderNumber: text.replace(/^#/, '') },
      { cufe: text },
      { 'provider.number': text },
      { 'provider.cufe': text },
    ],
  });
}

function serializeEmailDelivery(delivery = {}, customer = {}) {
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
    history: Array.isArray(delivery?.history)
      ? delivery.history.slice(-10)
      : [],
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(value, currency = 'COP') {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: cleanText(currency, 10) || 'COP',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function customerName(invoice = {}) {
  const customer = invoice.customer || {};
  return cleanText(
    customer.businessName ||
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      'Cliente',
    220
  );
}

function buildInvoiceEmailContent(invoice = {}) {
  const number = cleanText(
    invoice?.provider?.number || invoice.invoiceNumber,
    160
  );
  const orderNumber = cleanText(invoice.orderNumber, 160);
  const cufe = cleanText(invoice?.provider?.cufe || invoice.cufe, 220);
  const currency = invoice?.totals?.currency || 'COP';
  const total = formatMoney(invoice?.totals?.total, currency);
  const name = customerName(invoice);

  const subject = 'Factura electrónica ' + number + ' - Orden #' + orderNumber;
  const text = [
    'Hola ' + name + ',',
    '',
    'Adjuntamos el PDF y el XML oficiales de tu factura electrónica ' + number + '.',
    'Orden: #' + orderNumber,
    'Total: ' + total,
    'CUFE: ' + cufe,
    '',
    'Conserva estos archivos como soporte de tu compra.',
  ].join('\n');

  const html = [
    '<div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:680px;margin:auto">',
    '<h2 style="margin:0 0 16px">Factura electrónica ' + escapeHtml(number) + '</h2>',
    '<p>Hola <strong>' + escapeHtml(name) + '</strong>,</p>',
    '<p>Adjuntamos el <strong>PDF</strong> y el <strong>XML</strong> oficiales de tu factura electrónica.</p>',
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:18px 0">',
    '<p style="margin:0 0 6px"><strong>Orden:</strong> #' + escapeHtml(orderNumber) + '</p>',
    '<p style="margin:0 0 6px"><strong>Total:</strong> ' + escapeHtml(total) + '</p>',
    '<p style="margin:0;word-break:break-all"><strong>CUFE:</strong> ' + escapeHtml(cufe) + '</p>',
    '</div>',
    '<p>Conserva estos archivos como soporte de tu compra.</p>',
    '</div>',
  ].join('');

  return { subject, text, html };
}

async function assertMailConfigured() {
  const settings = await MailSettings.findOne({ key: 'main' }).select(
    '+smtpPasswordEncrypted'
  );

  const configured = Boolean(
    settings?.enabled &&
      settings?.fromEmail &&
      settings?.smtpHost &&
      settings?.smtpPort &&
      settings?.smtpUser &&
      settings?.smtpPasswordEncrypted
  );

  if (!configured) {
    throw createEmailError(
      'Correo no configurado o desactivado. Revisa Configuración > Correo.',
      422,
      'BILLING_EMAIL_NOT_CONFIGURED'
    );
  }
}

function attachmentMetadata(document) {
  return {
    type: document.type,
    fileName: cleanText(document.fileName, 220),
    contentType: cleanText(document.contentType, 100),
    byteLength: Number(document.byteLength || document.buffer?.length || 0),
    sha256: cleanText(document.sha256, 80),
  };
}

async function reserveDelivery(invoice, options = {}) {
  const automatic = options.automatic === true;
  const now = new Date();
  const staleBefore = new Date(now.getTime() - SENDING_LOCK_MS);
  const conditions = [
    { _id: invoice._id },
    {
      $or: [
        { 'emailDelivery.status': { $ne: 'sending' } },
        { 'emailDelivery.lastAttemptAt': { $lt: staleBefore } },
      ],
    },
  ];

  if (automatic) {
    conditions.push({ 'emailDelivery.status': { $ne: 'sent' } });
  }

  const reserved = await ElectronicInvoice.findOneAndUpdate(
    { $and: conditions },
    {
      $set: {
        'emailDelivery.status': 'sending',
        'emailDelivery.recipient': normalizeEmail(invoice?.customer?.email),
        'emailDelivery.source': automatic ? 'automatic' : 'manual',
        'emailDelivery.initiatedBy': cleanText(options.initiatedBy || 'system', 160),
        'emailDelivery.lastAttemptAt': now,
        'emailDelivery.lastError': '',
      },
      $inc: { 'emailDelivery.attempts': 1 },
    },
    { new: true, runValidators: true }
  );

  if (reserved) return { reserved, skipped: false };

  const current = await ElectronicInvoice.findById(invoice._id);
  if (automatic && current?.emailDelivery?.status === 'sent') {
    return { reserved: current, skipped: true };
  }

  throw createEmailError(
    'Ya existe un envío de esta factura en proceso. Espera unos segundos antes de intentarlo nuevamente.',
    409,
    'BILLING_EMAIL_ALREADY_SENDING',
    { invoice: current }
  );
}

async function recordFailure(invoiceId, error, options = {}, attachments = []) {
  const now = new Date();
  const message = cleanText(
    error?.message || 'No fue posible enviar la factura por correo.',
    800
  );
  const recipient = normalizeEmail(options.recipient);
  const source = options.automatic === true ? 'automatic' : 'manual';
  const initiatedBy = cleanText(options.initiatedBy || 'system', 160);
  const attempt = {
    status: 'error',
    recipient,
    source,
    initiatedBy,
    errorMessage: message,
    attemptedAt: now,
    attachments,
  };

  const invoice = await ElectronicInvoice.findByIdAndUpdate(
    invoiceId,
    {
      $set: {
        'emailDelivery.status': 'error',
        'emailDelivery.recipient': recipient,
        'emailDelivery.source': source,
        'emailDelivery.initiatedBy': initiatedBy,
        'emailDelivery.lastError': message,
        'emailDelivery.lastAttemptAt': now,
        'emailDelivery.attachments': attachments,
      },
      $push: {
        'emailDelivery.history': {
          $each: [attempt],
          $slice: -25,
        },
      },
    },
    { new: true, runValidators: true }
  );

  error.invoice = invoice;
  error.delivery = serializeEmailDelivery(
    invoice?.emailDelivery,
    invoice?.customer
  );
  return error;
}

async function sendValidatedInvoiceEmail(identifier, options = {}) {
  const automatic = options.automatic === true;
  const invoice = await findInvoice(identifier);

  if (!invoice) {
    throw createEmailError(
      'Factura no encontrada para enviar por correo.',
      404,
      'BILLING_INVOICE_NOT_FOUND'
    );
  }

  if (!isFactusInvoice(invoice) || !isValidatedInvoice(invoice)) {
    throw createEmailError(
      'Solo se pueden enviar por correo facturas oficiales de Factus que ya estén validadas.',
      422,
      'BILLING_EMAIL_INVOICE_NOT_VALIDATED'
    );
  }

  const reservation = await reserveDelivery(invoice, {
    automatic,
    initiatedBy: options.initiatedBy,
  });

  if (reservation.skipped) {
    return {
      skipped: true,
      invoice: reservation.reserved,
      delivery: serializeEmailDelivery(
        reservation.reserved?.emailDelivery,
        reservation.reserved?.customer
      ),
      message: 'La factura ya fue enviada automáticamente al comprador.',
    };
  }

  const reserved = reservation.reserved;
  const recipient = normalizeEmail(reserved?.customer?.email);
  const deliveryOptions = {
    automatic,
    initiatedBy: options.initiatedBy,
    recipient,
  };
  let attachmentsMetadata = [];

  try {
    if (!EMAIL_PATTERN.test(recipient)) {
      throw createEmailError(
        'La factura no tiene un correo fiscal válido del comprador.',
        422,
        'BILLING_EMAIL_RECIPIENT_INVALID'
      );
    }

    await assertMailConfigured();

    const [pdf, xml] = await Promise.all([
      downloadOfficialInvoiceDocument({
        orderId: reserved.orderId,
        type: 'pdf',
      }),
      downloadOfficialInvoiceDocument({
        orderId: reserved.orderId,
        type: 'xml',
      }),
    ]);

    if (!pdf?.official || !xml?.official) {
      throw createEmailError(
        'No están disponibles los documentos oficiales de Factus para enviar.',
        422,
        'BILLING_EMAIL_OFFICIAL_DOCUMENTS_MISSING'
      );
    }

    attachmentsMetadata = [
      attachmentMetadata(pdf),
      attachmentMetadata(xml),
    ];

    const content = buildInvoiceEmailContent(reserved);
    const mailResult = await sendMail({
      to: recipient,
      subject: content.subject,
      text: content.text,
      html: content.html,
      attachments: [
        {
          filename: pdf.fileName,
          content: pdf.buffer,
          contentType: pdf.contentType,
        },
        {
          filename: xml.fileName,
          content: xml.buffer,
          contentType: xml.contentType,
        },
      ],
    });

    const now = new Date();
    const messageId = cleanText(mailResult?.messageId, 300);
    const source = automatic ? 'automatic' : 'manual';
    const initiatedBy = cleanText(options.initiatedBy || 'system', 160);
    const attempt = {
      status: 'sent',
      recipient,
      source,
      initiatedBy,
      messageId,
      attemptedAt: now,
      attachments: attachmentsMetadata,
    };

    const updated = await ElectronicInvoice.findByIdAndUpdate(
      reserved._id,
      {
        $set: {
          'emailDelivery.status': 'sent',
          'emailDelivery.recipient': recipient,
          'emailDelivery.source': source,
          'emailDelivery.initiatedBy': initiatedBy,
          'emailDelivery.messageId': messageId,
          'emailDelivery.lastError': '',
          'emailDelivery.lastAttemptAt': now,
          'emailDelivery.lastSentAt': now,
          'emailDelivery.attachments': attachmentsMetadata,
        },
        $push: {
          'emailDelivery.history': {
            $each: [attempt],
            $slice: -25,
          },
        },
      },
      { new: true, runValidators: true }
    );

    return {
      skipped: false,
      invoice: updated,
      delivery: serializeEmailDelivery(updated?.emailDelivery, updated?.customer),
      message: automatic
        ? 'Factura enviada automáticamente al correo fiscal del comprador.'
        : 'Factura enviada nuevamente al correo fiscal del comprador.',
    };
  } catch (caught) {
    const error =
      caught?.code
        ? caught
        : createEmailError(
            caught?.message || 'No fue posible enviar la factura por correo.',
            caught?.status || 502,
            'BILLING_EMAIL_SEND_ERROR'
          );

    await recordFailure(
      reserved._id,
      error,
      deliveryOptions,
      attachmentsMetadata
    );
    throw error;
  }
}

module.exports = {
  buildInvoiceEmailContent,
  findInvoice,
  isValidatedInvoice,
  sendValidatedInvoiceEmail,
  serializeEmailDelivery,
};
