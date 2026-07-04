// backend/services/posReceiptService.js

const PDFDocument = require('pdfkit');

const Order = require('../models/Order');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const SiteSettings = require('../models/SiteSettings');
const { sendMail } = require('../lib/mail/mailer');
const { generateElectronicInvoiceAfterPayment } = require('./electronicInvoiceAfterPaymentService');

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanEmail(value) {
  return cleanText(value, 180).toLowerCase();
}

function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CO', { hour12: false });
}

function createReceiptError(message, code, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function getOrderId(value) {
  return cleanText(value, 80);
}

function getCustomerEmail(order = {}, fallbackEmail = '') {
  return cleanEmail(
    fallbackEmail ||
      order.customer?.email ||
      order.customer?.emailOrPhone ||
      order.billing?.email ||
      ''
  );
}

function getCustomerName(order = {}) {
  return cleanText(order.customer?.name || order.customer?.fullName || 'Consumidor final', 160);
}

function getStoreInfo(settings = {}) {
  const store = settings?.store || settings?.theme?.store || {};
  const billing = settings?.billing || {};
  const fiscalInfo = billing?.fiscalInfo || {};

  return {
    name: cleanText(store.name || fiscalInfo.businessName || fiscalInfo.legalRepresentative || 'Rosa Boutique', 160),
    businessName: cleanText(store.businessName || fiscalInfo.businessName || '', 180),
    nit: cleanText(fiscalInfo.nit || '', 80),
    email: cleanEmail(store.email || fiscalInfo.billingEmail || ''),
    phone: cleanText(store.phone || '', 80),
    address: cleanText(store.address || '', 220),
  };
}

function mapOrderItems(order = {}) {
  const rawItems = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : Array.isArray(order.cart)
      ? order.cart
      : [];

  return rawItems.map((item) => {
    const quantity = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.unitPrice || item.price || item.priceNumber || 0);

    return {
      title: cleanText(item.title || item.name || 'Producto', 220),
      size: cleanText(item.size || '', 80),
      color: cleanText(item.color || '', 120),
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0,
      subtotal: (Number.isFinite(quantity) && quantity > 0 ? quantity : 1) * (Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0),
    };
  });
}

function serializeInvoice(invoice = null) {
  if (!invoice) {
    return {
      exists: false,
      status: 'not_generated',
      message: 'La factura electrónica será enviada una vez sea emitida.',
    };
  }

  return {
    exists: true,
    id: String(invoice._id || ''),
    status: invoice.status || '',
    invoiceNumber: invoice.invoiceNumber || invoice.provider?.number || '',
    cufe: invoice.cufe || invoice.provider?.cufe || '',
    pdfUrl: invoice.pdfUrl || invoice.provider?.links?.pdf || invoice.provider?.links?.pdf_url || '',
    xmlUrl: invoice.xmlUrl || invoice.provider?.links?.xml || invoice.provider?.links?.xml_url || '',
    qrUrl: invoice.qrUrl || '',
    generatedAt: invoice.generatedAt || invoice.createdAt || null,
    message: invoice.status === 'generated'
      ? 'Factura electrónica generada.'
      : 'Factura electrónica pendiente o con novedad del proveedor.',
  };
}

async function loadPosOrder(orderId) {
  const cleanOrderId = getOrderId(orderId);

  if (!cleanOrderId) {
    throw createReceiptError('Debes indicar una orden POS.', 'POS_RECEIPT_ORDER_REQUIRED', 400);
  }

  const query = cleanOrderId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: cleanOrderId }
    : { orderNumber: cleanOrderId };

  const order = await Order.findOne(query).lean();

  if (!order) {
    throw createReceiptError('Orden POS no encontrada.', 'POS_RECEIPT_ORDER_NOT_FOUND', 404, { orderId: cleanOrderId });
  }

  if (order.source !== 'pos') {
    throw createReceiptError('La orden indicada no corresponde a una venta POS.', 'POS_RECEIPT_NOT_POS_ORDER', 409, { orderId: cleanOrderId });
  }

  return order;
}

async function loadInvoiceForOrder(order) {
  if (!order?._id) return null;
  return ElectronicInvoice.findOne({ orderId: order._id }).lean();
}

async function maybeGenerateInvoice(order, shouldGenerate = false) {
  let invoice = await loadInvoiceForOrder(order);

  if (invoice?.status === 'generated') return invoice;
  if (!shouldGenerate) return invoice;

  const generated = await generateElectronicInvoiceAfterPayment({
    orderId: order._id,
    paymentProvider: 'pos',
    transaction: {
      payment_method_type: order.payment?.methodType || 'pos',
      payment_method_name: order.payment?.methodLabel || 'Venta física',
      payment_method: order.payment?.method || 'pos',
      rawMethod: order.payment?.rawMethod || {},
    },
  });

  return generated || invoice || loadInvoiceForOrder(order);
}

async function buildPosReceipt(orderId, options = {}) {
  const order = await loadPosOrder(orderId);
  const settings = await SiteSettings.findOne().lean().catch(() => null);
  const invoice = await maybeGenerateInvoice(order, options.generateInvoice === true);
  const store = getStoreInfo(settings || {});
  const items = mapOrderItems(order);

  return {
    order: {
      id: String(order._id),
      orderNumber: order.orderNumber || '',
      receiptNumber: order.pos?.receiptNumber || `REC-${order.orderNumber || ''}`,
      saleNumber: order.pos?.saleNumber || `POS-${order.orderNumber || ''}`,
      date: order.createdAt || order.pos?.confirmedAt || new Date(),
      status: order.status || '',
      fulfillmentStatus: order.fulfillmentStatus || '',
      source: order.source || '',
    },
    store,
    branch: order.branchSnapshot || {},
    cashier: order.cashierSnapshot || order.createdByAdminSnapshot || {},
    customer: {
      name: getCustomerName(order),
      email: cleanEmail(order.customer?.email || order.customer?.emailOrPhone || ''),
      phone: cleanText(order.customer?.phone || '', 80),
      documentType: cleanText(order.customer?.documentType || '', 40),
      documentNumber: cleanText(order.customer?.id || order.customer?.documentNumber || '', 80),
      address: cleanText(order.customer?.address || '', 220),
      city: cleanText(order.customer?.city || '', 120),
    },
    payment: {
      method: order.payment?.method || '',
      methodLabel: order.payment?.methodLabel || order.payment?.method || '',
      amount: Number(order.payment?.amount || order.total || 0),
      receivedAmount: Number(order.payment?.receivedAmount || order.payment?.amount || order.total || 0),
      changeAmount: Number(order.payment?.changeAmount || 0),
      paidAt: order.payment?.paidAt || order.createdAt || null,
    },
    items,
    totals: {
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount?.amount || 0),
      taxes: Number(order.taxes?.iva?.amount || 0),
      shipping: Number(order.shipping || 0),
      total: Number(order.total || 0),
    },
    invoice: serializeInvoice(invoice),
  };
}

function buildReceiptText(receipt) {
  const lines = [
    receipt.store.name,
    `Comprobante POS ${receipt.order.receiptNumber}`,
    `Orden: ${receipt.order.orderNumber}`,
    `Fecha: ${formatDate(receipt.order.date)}`,
    `Sede: ${receipt.branch?.name || ''}`,
    `Vendedor: ${receipt.cashier?.displayName || receipt.cashier?.username || ''}`,
    `Cliente: ${receipt.customer.name}`,
    '',
    'Productos:',
    ...receipt.items.map((item) => `- ${item.title} ${item.size || ''} ${item.color || ''} x${item.quantity}: ${money(item.subtotal)}`),
    '',
    `Total: ${money(receipt.totals.total)}`,
    `Pago: ${receipt.payment.methodLabel || receipt.payment.method}`,
    `Recibido: ${money(receipt.payment.receivedAmount)}`,
    `Cambio: ${money(receipt.payment.changeAmount)}`,
    '',
    receipt.invoice.exists
      ? `Factura electronica: ${receipt.invoice.invoiceNumber || receipt.invoice.status}`
      : 'Factura electronica: pendiente de emision.',
  ];

  return lines.join('\n');
}

function escapeHtml(value) {
  return cleanText(value, 2000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReceiptHtml(receipt) {
  const invoiceLinks = [];
  if (receipt.invoice.pdfUrl) invoiceLinks.push(`<li><a href="${escapeHtml(receipt.invoice.pdfUrl)}">Descargar factura PDF</a></li>`);
  if (receipt.invoice.xmlUrl) invoiceLinks.push(`<li><a href="${escapeHtml(receipt.invoice.xmlUrl)}">Descargar factura XML</a></li>`);

  return `
    <div style="font-family: Arial, sans-serif; color:#222; line-height:1.5; max-width:720px; margin:0 auto;">
      <h2 style="margin:0 0 8px;">${escapeHtml(receipt.store.name)}</h2>
      <p style="margin:0 0 16px;color:#666;">Comprobante de venta POS</p>

      <div style="border:1px solid #eee;border-radius:14px;padding:16px;margin-bottom:16px;">
        <p><strong>Orden:</strong> ${escapeHtml(receipt.order.orderNumber)}</p>
        <p><strong>Comprobante:</strong> ${escapeHtml(receipt.order.receiptNumber)}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(formatDate(receipt.order.date))}</p>
        <p><strong>Sede:</strong> ${escapeHtml(receipt.branch?.name || '')}</p>
        <p><strong>Vendedor:</strong> ${escapeHtml(receipt.cashier?.displayName || receipt.cashier?.username || '')}</p>
        <p><strong>Cliente:</strong> ${escapeHtml(receipt.customer.name)}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr>
            <th align="left" style="border-bottom:1px solid #eee;padding:8px;">Producto</th>
            <th align="center" style="border-bottom:1px solid #eee;padding:8px;">Cant.</th>
            <th align="right" style="border-bottom:1px solid #eee;padding:8px;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${receipt.items.map((item) => `
            <tr>
              <td style="border-bottom:1px solid #f4f4f4;padding:8px;">
                <strong>${escapeHtml(item.title)}</strong><br />
                <span style="color:#777;font-size:12px;">${escapeHtml([item.size, item.color].filter(Boolean).join(' / '))}</span>
              </td>
              <td align="center" style="border-bottom:1px solid #f4f4f4;padding:8px;">${item.quantity}</td>
              <td align="right" style="border-bottom:1px solid #f4f4f4;padding:8px;">${money(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="border:1px solid #eee;border-radius:14px;padding:16px;margin-bottom:16px;">
        <p><strong>Subtotal:</strong> ${money(receipt.totals.subtotal)}</p>
        <p><strong>Descuento:</strong> ${money(receipt.totals.discount)}</p>
        <p><strong>Impuestos:</strong> ${money(receipt.totals.taxes)}</p>
        <p style="font-size:18px;"><strong>Total pagado:</strong> ${money(receipt.totals.total)}</p>
        <p><strong>Método de pago:</strong> ${escapeHtml(receipt.payment.methodLabel || receipt.payment.method)}</p>
        <p><strong>Cambio:</strong> ${money(receipt.payment.changeAmount)}</p>
      </div>

      <div style="border:1px solid #eee;border-radius:14px;padding:16px;">
        <p><strong>Factura electrónica:</strong> ${escapeHtml(receipt.invoice.message)}</p>
        ${receipt.invoice.invoiceNumber ? `<p><strong>Número:</strong> ${escapeHtml(receipt.invoice.invoiceNumber)}</p>` : ''}
        ${receipt.invoice.cufe ? `<p><strong>CUFE:</strong> ${escapeHtml(receipt.invoice.cufe)}</p>` : ''}
        ${invoiceLinks.length ? `<ul>${invoiceLinks.join('')}</ul>` : '<p>La factura electrónica será enviada una vez sea emitida.</p>'}
      </div>
    </div>
  `;
}

async function buildReceiptPdfBuffer(receipt) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(18).text(receipt.store.name || 'Rosa Boutique', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).text('Comprobante de venta POS', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10);
    doc.text(`Orden: ${receipt.order.orderNumber}`);
    doc.text(`Comprobante: ${receipt.order.receiptNumber}`);
    doc.text(`Fecha: ${formatDate(receipt.order.date)}`);
    doc.text(`Sede: ${receipt.branch?.name || ''}`);
    doc.text(`Vendedor: ${receipt.cashier?.displayName || receipt.cashier?.username || ''}`);
    doc.text(`Cliente: ${receipt.customer.name}`);
    if (receipt.customer.documentNumber) doc.text(`Documento: ${receipt.customer.documentType || ''} ${receipt.customer.documentNumber}`);
    doc.moveDown(1);

    doc.fontSize(12).text('Productos', { underline: true });
    doc.moveDown(0.5);
    receipt.items.forEach((item) => {
      doc.fontSize(10).text(`${item.title}`);
      doc.fontSize(9).text(`${[item.size, item.color].filter(Boolean).join(' / ')} | Cantidad: ${item.quantity} | Unitario: ${money(item.unitPrice)} | Subtotal: ${money(item.subtotal)}`);
      doc.moveDown(0.35);
    });

    doc.moveDown(0.8);
    doc.fontSize(11).text(`Subtotal: ${money(receipt.totals.subtotal)}`, { align: 'right' });
    doc.text(`Descuento: ${money(receipt.totals.discount)}`, { align: 'right' });
    doc.text(`Impuestos: ${money(receipt.totals.taxes)}`, { align: 'right' });
    doc.fontSize(14).text(`Total: ${money(receipt.totals.total)}`, { align: 'right' });
    doc.moveDown(0.8);
    doc.fontSize(10).text(`Método de pago: ${receipt.payment.methodLabel || receipt.payment.method}`);
    doc.text(`Recibido: ${money(receipt.payment.receivedAmount)}`);
    doc.text(`Cambio: ${money(receipt.payment.changeAmount)}`);
    doc.moveDown(1);

    doc.fontSize(10).text(`Factura electrónica: ${receipt.invoice.message}`);
    if (receipt.invoice.invoiceNumber) doc.text(`Número factura: ${receipt.invoice.invoiceNumber}`);
    if (receipt.invoice.cufe) doc.text(`CUFE: ${receipt.invoice.cufe}`);

    doc.end();
  });
}

async function sendPosReceiptEmail(orderId, options = {}) {
  const receipt = await buildPosReceipt(orderId, { generateInvoice: options.generateInvoice !== false });
  const to = getCustomerEmail({ customer: receipt.customer, billing: { email: receipt.customer.email } }, options.to);

  if (!to) {
    throw createReceiptError(
      'El cliente no tiene correo. Agrega un correo al cliente o escribe un destinatario.',
      'POS_RECEIPT_EMAIL_REQUIRED',
      400
    );
  }

  const pdfBuffer = await buildReceiptPdfBuffer(receipt);
  const attachments = [
    {
      filename: `comprobante-pos-${receipt.order.orderNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ];

  if (receipt.invoice.exists && receipt.invoice.cufe) {
    attachments.push({
      filename: `factura-electronica-${receipt.invoice.invoiceNumber || receipt.order.orderNumber}.txt`,
      content: [
        `Factura electrónica: ${receipt.invoice.invoiceNumber || ''}`,
        `CUFE: ${receipt.invoice.cufe || ''}`,
        receipt.invoice.pdfUrl ? `PDF: ${receipt.invoice.pdfUrl}` : '',
        receipt.invoice.xmlUrl ? `XML: ${receipt.invoice.xmlUrl}` : '',
      ].filter(Boolean).join('\n'),
      contentType: 'text/plain; charset=utf-8',
    });
  }

  const subject = `Comprobante de compra - Orden ${receipt.order.orderNumber}`;
  const html = buildReceiptHtml(receipt);
  const text = buildReceiptText(receipt);

  await sendMail({
    to,
    subject,
    text,
    html,
    attachments,
  });

  return {
    ok: true,
    to,
    subject,
    receipt,
    invoice: receipt.invoice,
    message: `Comprobante enviado correctamente a ${to}.`,
  };
}

module.exports = {
  buildPosReceipt,
  buildReceiptText,
  buildReceiptHtml,
  buildReceiptPdfBuffer,
  sendPosReceiptEmail,
};
