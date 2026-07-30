const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const https = require('https');
const http = require('http');

// ─── Paleta base ──────────────────────────────────────────────────────────────
const FALLBACK_PRIMARY = '#D4AF37';
const FALLBACK_DARK = '#111827';
const MUTED = '#6B7280';
const MUTED_LIGHT = '#9CA3AF';
const LIGHT_BG = '#FFFFFF';
const WHITE = '#FFFFFF';

// ─── Helpers de datos ─────────────────────────────────────────────────────────
function moneyCOP(n) {
  return Number(n || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
  });
}

function qtyOf(it) {
  return Number(it?.quantity ?? it?.qty ?? 0) || 0;
}

function safe(v, fb = '—') {
  const s = String(v ?? '').trim();
  return s || fb;
}

function fullName(o = {}) {
  return [o.name, o.lastname].filter(Boolean).join(' ').trim() || '—';
}

function normalizeHexColor(value, fallback) {
  const raw = String(value || '').trim();

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw.toUpperCase();
  }

  const rgbMatch = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

  if (rgbMatch) {
    const r = Math.max(0, Math.min(255, Number(rgbMatch[1])));
    const g = Math.max(0, Math.min(255, Number(rgbMatch[2])));
    const b = Math.max(0, Math.min(255, Number(rgbMatch[3])));

    return `#${[r, g, b]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`;
  }

  return fallback;
}

function hexToRgb(hex) {
  const value = normalizeHexColor(hex, FALLBACK_PRIMARY).replace('#', '');

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((n) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`;
}

function mixColor(color, target = '#FFFFFF', amount = 0.5) {
  const c1 = hexToRgb(color);
  const c2 = hexToRgb(target);

  return rgbToHex({
    r: c1.r + (c2.r - c1.r) * amount,
    g: c1.g + (c2.g - c1.g) * amount,
    b: c1.b + (c2.b - c1.b) * amount,
  });
}

function getInvoicePalette(settings = {}) {
  const theme = settings?.theme || {};
  const publicColors = theme?.colors || {};
  const adminTheme = settings?.admin?.theme || {};

  const primary = normalizeHexColor(
    adminTheme.primary ||
      adminTheme.buttonBg ||
      adminTheme.inputFocus ||
      adminTheme.cardBorder ||
      publicColors.primary ||
      publicColors.accent ||
      theme.primaryColor ||
      theme.accentColor ||
      theme?.header?.iconColor ||
      theme?.header?.linkColor ||
      FALLBACK_PRIMARY,
    FALLBACK_PRIMARY
  );

  const accent = normalizeHexColor(
    adminTheme.primaryHover ||
      adminTheme.activeNavText ||
      adminTheme.buttonHover ||
      adminTheme.primarySoftText ||
      publicColors.accent ||
      publicColors.secondary ||
      primary,
    primary
  );

  const text = FALLBACK_DARK;

  return {
    primary,
    accent,
    text,
    cream: mixColor(primary, WHITE, 0.97),
    creamDeep: mixColor(primary, WHITE, 0.92),
    border: mixColor(primary, WHITE, 0.7),
    borderSoft: mixColor(primary, WHITE, 0.85),
    stripe: mixColor(primary, WHITE, 0.97),
  };
}

function getPublicBaseUrl(settings = {}) {
  const raw =
    settings?.billing?.publicInvoiceBaseUrl ||
    settings?.billing?.publicSiteUrl ||
    settings?.billing?.storeUrl ||
    settings?.publicInvoiceBaseUrl ||
    settings?.publicSiteUrl ||
    settings?.publicUrl ||
    settings?.siteUrl ||
    settings?.storeUrl ||
    settings?.theme?.publicUrl ||
    settings?.theme?.siteUrl ||
    process.env.PUBLIC_SITE_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    'http://localhost:5173';

  return String(raw || 'http://localhost:5173').trim().replace(/\/+$/, '');
}

function buildInvoiceQrUrl(data = {}) {
  const baseUrl = getPublicBaseUrl(data.settings);
  const invoiceNumber = encodeURIComponent(safe(data.invoiceNumber, 'pendiente'));
  const orderId = encodeURIComponent(String(data.orderId || ''));

  if (orderId) {
    return `${baseUrl}/factura/${invoiceNumber}?ordenId=${orderId}`;
  }

  return `${baseUrl}/factura/${invoiceNumber}`;
}

function getLogoUrl(settings = {}) {
  return (
    settings?.theme?.header?.logoLight ||
    settings?.theme?.header?.logoDark ||
    settings?.theme?.logo?.light ||
    settings?.theme?.logo?.dark ||
    ''
  );
}

function fetchImageBuffer(url) {
  return new Promise((resolve) => {
    try {
      if (!url || !/^https?:\/\//i.test(url)) return resolve(null);

      const client = url.startsWith('https') ? https : http;

      client
        .get(url, (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            return resolve(null);
          }

          const chunks = [];

          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

async function generateQrBuffer(data = {}) {
  const qrPayload = buildInvoiceQrUrl(data);

  try {
    return await QRCode.toBuffer(qrPayload, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 260,
      color: {
        dark: '#111827',
        light: '#FFFFFF',
      },
    });
  } catch {
    return null;
  }
}

// ─── Utilidades de dibujo ─────────────────────────────────────────────────────
function roundedRect(doc, x, y, w, h, r, fill, stroke) {
  doc.save().roundedRect(x, y, w, h, r);

  if (fill) doc.fillColor(fill).fill();
  if (stroke) doc.strokeColor(stroke).lineWidth(0.5).stroke();

  doc.restore();
}

function softLine(doc, x, y, w = 515, color = '#E5E7EB', lineWidth = 0.5) {
  doc
    .save()
    .moveTo(x, y)
    .lineTo(x + w, y)
    .strokeColor(color)
    .lineWidth(lineWidth)
    .stroke()
    .restore();
}

function verticalLine(doc, x, y, h, color = '#E5E7EB', lineWidth = 0.45) {
  doc
    .save()
    .moveTo(x, y)
    .lineTo(x, y + h)
    .strokeColor(color)
    .lineWidth(lineWidth)
    .stroke()
    .restore();
}

function sectionTitle(doc, title, x, y, width = 515, palette = {}) {
  doc.save().rect(x, y + 2, 3, 12).fillColor(palette.primary).fill().restore();

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(palette.text)
    .text(title.toUpperCase(), x + 10, y, {
      width: width - 10,
      characterSpacing: 0.6,
      lineBreak: false,
    });

  softLine(doc, x, y + 18, width, palette.border, 0.5);

  return y + 28;
}

function detailRow(doc, label, value, x, y, width = 245, palette = {}) {
  doc
    .font('Helvetica-Bold')
    .fontSize(6.8)
    .fillColor(MUTED_LIGHT)
    .text(label.toUpperCase(), x, y, {
      width,
      characterSpacing: 0.35,
      lineBreak: false,
    });

  doc
    .font('Helvetica')
    .fontSize(8.2)
    .fillColor(palette.text)
    .text(safe(value), x + 105, y, {
      width: width - 105,
      lineBreak: false,
    });

  softLine(doc, x, y + 15, width, palette.borderSoft, 0.35);

  return y + 21;
}

function twoColumnDetails(doc, left, right, x, y, palette = {}) {
  let lY = y;
  let rY = y;

  left.forEach((r) => {
    lY = detailRow(doc, r.label, r.value, x, lY, 245, palette);
  });

  right.forEach((r) => {
    rY = detailRow(doc, r.label, r.value, x + 270, rY, 245, palette);
  });

  return Math.max(lY, rY);
}

function drawValueBox(doc, label, value, x, y, width, options = {}) {
  const {
    labelColor = MUTED_LIGHT,
    valueColor = FALLBACK_DARK,
    labelSize = 6.8,
    valueSize = 9,
    bold = false,
    align = 'left',
  } = options;

  doc
    .font('Helvetica-Bold')
    .fontSize(labelSize)
    .fillColor(labelColor)
    .text(label.toUpperCase(), x, y, {
      width,
      align,
      characterSpacing: 0.45,
      lineBreak: false,
    });

  doc
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(valueSize)
    .fillColor(valueColor)
    .text(safe(value), x, y + 11, {
      width,
      align,
      lineBreak: false,
    });
}

function drawQrPlaceholder(doc, x, y, size, data = {}, palette = {}) {
  roundedRect(doc, x, y, size, size, 4, LIGHT_BG, palette.border);

  if (data.qrBuffer) {
    try {
      doc.image(data.qrBuffer, x + 3, y + 3, {
        fit: [size - 6, size - 6],
      });
      return;
    } catch {}
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(palette.accent)
    .text('QR', x, y + 18, {
      width: size,
      align: 'center',
      lineBreak: false,
    });

  doc
    .font('Helvetica')
    .fontSize(5.4)
    .fillColor(MUTED_LIGHT)
    .text('Pendiente CUFE', x + 5, y + 34, {
      width: size - 10,
      align: 'center',
      lineBreak: false,
    });
}

function drawFooter(doc, pageWidth, margin, inner, palette = {}, fiscalInfo = {}) {
  const footerY = 742;
  const footerH = 68;

  doc.save();

  doc.rect(0, footerY, pageWidth, footerH).fillColor(palette.cream).fill();
  doc.rect(0, footerY, pageWidth, 1.2).fillColor(palette.primary).fill();
  doc.rect(0, footerY, 6, footerH).fillColor(palette.accent).fill();

  doc
    .font('Helvetica')
    .fontSize(6.1)
    .fillColor(MUTED_LIGHT)
    .text('Documento generado automáticamente', margin, footerY + 10, {
      width: inner,
      align: 'center',
      lineBreak: false,
    });

  if (fiscalInfo.nit) {
    doc
      .font('Helvetica')
      .fontSize(6.1)
      .fillColor(MUTED_LIGHT)
      .text(`NIT: ${fiscalInfo.nit}`, margin, footerY + 21, {
        width: inner,
        align: 'center',
        lineBreak: false,
      });
  }

  doc
    .font('Helvetica')
    .fontSize(5.9)
    .fillColor(MUTED_LIGHT)
    .text('Factura preparada para evolución a facturación electrónica DIAN.', margin, footerY + 32, {
      width: inner,
      align: 'center',
      lineBreak: false,
    });

  doc.restore();
}

// ─── Generador principal ──────────────────────────────────────────────────────
async function generateOrderPdf({ order, invoice, settings, res }) {
  const palette = getInvoicePalette(settings);

  const billingSettings = settings?.billing || {};
  const fiscalInfo = invoice?.fiscalInfo || billingSettings.fiscalInfo || {};
  const dianResolution =
    invoice?.dianResolution || billingSettings.dianResolution || {};
  const legalTexts = invoice?.legalTexts || billingSettings.legalTexts || {};

  const logoUrl = getLogoUrl(settings);
  const logoBuffer = await fetchImageBuffer(logoUrl);

  const items = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.cart)
      ? order.cart
      : [];

  const shipping = Number(order.shipping || 0);

  const subtotal =
    Number(order.subtotal || 0) ||
    items.reduce((acc, it) => {
      const price =
        Number(it?.product?.price ?? it?.price ?? it?.unitPrice ?? 0) || 0;

      return acc + price * qtyOf(it);
    }, 0);

  const total = Number(order.total || subtotal + shipping);

  const ivaConfig = order?.taxes?.iva || settings?.billing?.taxes?.iva || {};
  const ivaEnabled = ivaConfig.enabled !== false;
  const ivaPercent = Number(ivaConfig.percent || 0);
  const ivaName = ivaConfig.name || 'IVA';
  const taxAmountByDifference = Math.max(0, Number(total || 0) - Number(subtotal || 0) - Number(shipping || 0));
  const taxAmountByPercent = ivaEnabled ? Math.round((Number(subtotal || 0) * ivaPercent) / 100) : 0;
  const taxAmountBySnapshot =
    typeof ivaConfig.amount === 'number'
      ? Math.max(0, Number(ivaConfig.amount || 0))
      : 0;
  const taxAmount = taxAmountBySnapshot || taxAmountByDifference || taxAmountByPercent;

  const customer = order.customer || {};
  const payment = order.payment || {};
  const invoiceNumber = invoice?.orderNumber || order.orderNumber || 'Pendiente';

  const issuedDate = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const qrBuffer = await generateQrBuffer({
    settings,
    invoiceNumber,
    orderNumber: order.orderNumber,
    orderId: order._id,
    issuedDate,
    customerName: fullName(customer),
    customerDocument: customer.id,
    total,
  });

  const filename = `factura-${
    invoiceNumber || order.orderNumber || String(order._id).slice(-6)
  }.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    autoFirstPage: true,
    bufferPages: false,
  });

  doc.pipe(res);

  const PAGE_W = 595;
  const MARGIN = 40;
  const INNER = PAGE_W - MARGIN * 2;

  // ══════════════════════════════════════════════════════════════════════════
  //  ENCABEZADO
  // ══════════════════════════════════════════════════════════════════════════
  doc.rect(0, 0, PAGE_W, 150).fillColor(palette.cream).fill();
  doc.rect(0, 0, 6, 150).fillColor(palette.primary).fill();
  softLine(doc, 0, 149, PAGE_W, palette.primary, 1.2);

  const headerTop = 22;

  // Columna izquierda: logo, notas y documento comercial
  const leftX = MARGIN;
  const leftW = 210;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, leftX, headerTop, { fit: [112, 45] });
    } catch {
      _fallbackBrandText(doc, leftX, palette);
    }
  } else {
    _fallbackBrandText(doc, leftX, palette);
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(7.2)
    .fillColor(palette.text)
    .text('NOTAS Y TEXTOS LEGALES', leftX, 78, {
      width: leftW,
      characterSpacing: 0.45,
      lineBreak: false,
    });

  softLine(doc, leftX, 91, leftW, palette.borderSoft, 0.45);

  const headerLegalText = [legalTexts.invoiceLegalText, legalTexts.internalReceiptNote]
    .filter(Boolean)
    .join(' ');

  doc
    .font('Helvetica')
    .fontSize(5.8)
    .fillColor(MUTED)
    .text(headerLegalText || 'Factura generada automáticamente desde la tienda virtual.', leftX, 99, {
      width: leftW,
      height: 18,
      align: 'justify',
      lineGap: 1,
      ellipsis: true,
    });

  doc
    .font('Helvetica')
    .fontSize(6.3)
    .fillColor(MUTED)
    .text('Documento comercial generado por compra en tienda virtual.', leftX, 124, {
      width: leftW,
      lineBreak: false,
    });

  // Columna central: título y número
  const centerX = MARGIN + 220;
  const centerW = 160;

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(palette.text)
    .text('FACTURA DE VENTA', centerX, 32, {
      width: centerW,
      align: 'center',
      lineBreak: false,
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(MUTED_LIGHT)
    .text('NÚMERO DE FACTURA', centerX, 60, {
      width: centerW,
      align: 'center',
      characterSpacing: 0.5,
      lineBreak: false,
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(palette.accent)
    .text(safe(invoiceNumber), centerX, 74, {
      width: centerW,
      align: 'center',
      lineBreak: false,
    });

  // Columna derecha: QR y orden interna
  const qrSize = 58;
  const rightX = PAGE_W - MARGIN - 112;
  const qrX = rightX + 27;
  const qrY = 28;

  drawQrPlaceholder(
    doc,
    qrX,
    qrY,
    qrSize,
    {
      orderNumber: order.orderNumber,
      invoiceNumber,
      qrBuffer,
    },
    palette
  );

  doc
    .font('Helvetica')
    .fontSize(6.3)
    .fillColor(MUTED)
    .text(`Orden interna: ${safe(order.orderNumber)}`, rightX, qrY + qrSize + 12, {
      width: 112,
      align: 'center',
      lineBreak: false,
    });

  let y = 170;

  // DATOS GENERALES
  roundedRect(doc, MARGIN, y, INNER, 58, 6, LIGHT_BG, palette.border);

  const generalBoxY = y;
  const generalBoxH = 58;
  const slotW = INNER / 4;

  verticalLine(doc, MARGIN + slotW, generalBoxY + 9, generalBoxH - 18, palette.borderSoft);
  verticalLine(doc, MARGIN + slotW * 2, generalBoxY + 9, generalBoxH - 18, palette.borderSoft);
  verticalLine(doc, MARGIN + slotW * 3, generalBoxY + 9, generalBoxH - 18, palette.borderSoft);
  softLine(doc, MARGIN, generalBoxY + generalBoxH, INNER, palette.primary, 0.65);

  drawValueBox(doc, 'Fecha de emisión', issuedDate, MARGIN + 14, y + 13, 105, {
    valueColor: palette.text,
  });
  drawValueBox(doc, 'Método de pago', payment.method, MARGIN + 145, y + 13, 105, {
    valueColor: palette.text,
  });
  drawValueBox(doc, 'Estado de pago', payment.status, MARGIN + 276, y + 13, 105, {
    valueColor: palette.text,
  });
  drawValueBox(doc, 'Estado orden', order.status, MARGIN + 407, y + 13, 90, {
    valueColor: palette.text,
  });

  y += 80;

  // DATOS FISCALES
  y = sectionTitle(doc, 'Datos fiscales de la tienda', MARGIN, y, INNER, palette);

  y = twoColumnDetails(
    doc,
    [
      { label: 'NIT', value: fiscalInfo.nit },
      { label: 'Régimen', value: fiscalInfo.taxRegime },
      { label: 'Representante', value: fiscalInfo.legalRepresentative },
      { label: 'Correo fiscal', value: fiscalInfo.billingEmail },
    ],
    [
      { label: 'Resolución', value: dianResolution.resolutionNumber },
      { label: 'Prefijo', value: dianResolution.prefix },
      {
        label: 'Rango',
        value: `${safe(dianResolution.rangeFrom)} – ${safe(dianResolution.rangeTo)}`,
      },
      {
        label: 'Vigencia',
        value: `${safe(dianResolution.resolutionDate)} / ${safe(
          dianResolution.expirationDate
        )}`,
      },
    ],
    MARGIN,
    y,
    palette
  );

  y += 18;

  // CLIENTE
  y = sectionTitle(doc, 'Cliente y datos de entrega', MARGIN, y, INNER, palette);

  y = twoColumnDetails(
    doc,
    [
      { label: 'Cliente', value: fullName(customer) },
      { label: 'Documento', value: customer.id },
      {
        label: 'Email / Tel.',
        value: customer.emailOrPhone || customer.email || customer.phone,
      },
    ],
    [
      { label: 'Dirección', value: customer.address },
      {
        label: 'Ciudad / Dpto',
        value: `${safe(customer.city)} / ${safe(customer.department)}`,
      },
      { label: 'País', value: customer.country },
    ],
    MARGIN,
    y,
    palette
  );

  y += 18;

  // TABLA PRODUCTOS
  y = sectionTitle(doc, 'Detalle de productos', MARGIN, y, INNER, palette);

  const tX = MARGIN;
  const tW = INNER;
  const hH = 24;
  const rowH = 30;

  doc.rect(tX, y, tW, hH).fillColor(palette.creamDeep).fill();
  softLine(doc, tX, y, tW, palette.primary, 0.8);
  softLine(doc, tX, y + hH, tW, palette.border, 0.6);

  doc
    .font('Helvetica-Bold')
    .fontSize(7.3)
    .fillColor(palette.text)
    .text('PRODUCTO', tX + 10, y + 8, { width: 205, characterSpacing: 0.45, lineBreak: false })
    .text('VARIANTE', tX + 228, y + 8, { width: 78, characterSpacing: 0.45, lineBreak: false })
    .text('P. UNIT.', tX + 318, y + 8, { width: 68, align: 'right', characterSpacing: 0.45, lineBreak: false })
    .text('CANT.', tX + 396, y + 8, { width: 38, align: 'right', characterSpacing: 0.45, lineBreak: false })
    .text('TOTAL', tX + 444, y + 8, { width: 58, align: 'right', characterSpacing: 0.45, lineBreak: false });

  y += hH + 2;

  items.slice(0, 8).forEach((it, index) => {
    const p = it.product || {};
    const title = p.title || it.title || 'Producto';
    const sku = p.sku ? `SKU: ${p.sku}` : '';
    const variant =
      it.variantLabel ||
      (Array.isArray(it.variantAttributes)
        ? it.variantAttributes
            .map((attribute) => attribute?.value)
            .filter(Boolean)
            .join(' / ')
        : '') ||
      [it.color, it.size].filter(Boolean).join(' / ') ||
      '—';
    const price = Number(p.price ?? it.price ?? it.unitPrice ?? 0) || 0;
    const qty = qtyOf(it);
    const line = price * qty;

    if (index % 2 === 0) {
      doc.rect(tX, y - 2, tW, rowH + 2).fillColor(palette.stripe).fill();
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(8.2)
      .fillColor(palette.text)
      .text(title, tX + 10, y + 3, { width: 205, lineBreak: false });

    if (sku) {
      doc
        .font('Helvetica')
        .fontSize(6.2)
        .fillColor(MUTED_LIGHT)
        .text(sku, tX + 10, y + 15, { width: 205, lineBreak: false });
    }

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(palette.text)
      .text(variant, tX + 228, y + 3, { width: 78, lineBreak: false })
      .text(moneyCOP(price), tX + 318, y + 3, { width: 68, align: 'right', lineBreak: false })
      .text(String(qty), tX + 396, y + 3, { width: 38, align: 'right', lineBreak: false });

    doc
      .font('Helvetica-Bold')
      .fontSize(8.2)
      .fillColor(palette.text)
      .text(moneyCOP(line), tX + 444, y + 3, { width: 58, align: 'right', lineBreak: false });

    softLine(doc, tX, y + rowH, tW, palette.borderSoft, 0.4);

    y += rowH + 4;
  });

  if (items.length > 8) {
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(`+ ${items.length - 8} producto(s) adicional(es).`, tX + 10, y + 3, {
        width: 250,
        lineBreak: false,
      });
    y += 18;
  }

  y += 16;

  // TOTALES
  const totX = tX + tW - 210;
  const totW = 210;

  roundedRect(doc, totX, y, totW, 112, 6, LIGHT_BG, palette.border);

  doc
    .font('Helvetica')
    .fontSize(8.3)
    .fillColor(MUTED)
    .text('Subtotal', totX + 12, y + 14, { width: 90, lineBreak: false })
    .text(moneyCOP(subtotal), totX + 12, y + 14, {
      width: totW - 24,
      align: 'right',
      lineBreak: false,
    });

  doc
    .font('Helvetica')
    .fontSize(8.3)
    .fillColor(MUTED)
    .text(`${ivaName} ${ivaPercent}%`, totX + 12, y + 34, { width: 90, lineBreak: false })
    .text(moneyCOP(taxAmount), totX + 12, y + 34, {
      width: totW - 24,
      align: 'right',
      lineBreak: false,
    });

  doc
    .font('Helvetica')
    .fontSize(8.3)
    .fillColor(MUTED)
    .text('Envío', totX + 12, y + 54, { width: 90, lineBreak: false })
    .text(shipping > 0 ? moneyCOP(shipping) : 'Gratis', totX + 12, y + 54, {
      width: totW - 24,
      align: 'right',
      lineBreak: false,
    });

  softLine(doc, totX + 12, y + 73, totW - 24, palette.primary, 0.7);

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(palette.text)
    .text('TOTAL', totX + 12, y + 82, { width: 90, lineBreak: false });

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(palette.accent)
    .text(moneyCOP(total), totX + 12, y + 82, {
      width: totW - 24,
      align: 'right',
      lineBreak: false,
    });

  drawFooter(doc, PAGE_W, MARGIN, INNER, palette, fiscalInfo);

  doc.end();
}

// ─── Helpers internos ─────────────────────────────────────────────────────────
function _fallbackBrandText(doc, x, palette = {}) {
  doc.font('Helvetica-Bold').fontSize(18).fillColor(palette.text || FALLBACK_DARK).text('ROSA', x, 28);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(palette.accent || palette.primary || FALLBACK_PRIMARY)
    .text('BOUTIQUE', x, 50, {
      characterSpacing: 2,
      lineBreak: false,
    });
}

module.exports = { generateOrderPdf };
