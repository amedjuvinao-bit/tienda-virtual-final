'use strict';

const {
  isValidEmail,
  toMoney,
  toNumber,
  trimSafe,
} = require('./factusProviderShared');

const FACTUS_DOCUMENT_CODES = Object.freeze({
  RC: '11',
  TI: '12',
  CC: '13',
  CE: '22',
  NIT: '31',
  PP: '41',
  PASAPORTE: '41',
  PPT: '48',
});

function normalizeFactusDocumentCode(value) {
  const normalized = trimSafe(value, 30).toUpperCase();

  if (FACTUS_DOCUMENT_CODES[normalized]) return FACTUS_DOCUMENT_CODES[normalized];
  if (Object.values(FACTUS_DOCUMENT_CODES).includes(normalized)) return normalized;

  return '13';
}

function normalizeFactusCountryCode(value) {
  const normalized = trimSafe(value, 80).toUpperCase();

  if (normalized === 'COLOMBIA') return 'CO';
  if (/^[A-Z]{2,3}$/.test(normalized)) return normalized;

  return 'CO';
}

function normalizeFactusIdentification(value, documentCode, dv) {
  const raw = trimSafe(value, 40);
  let normalized = raw.replace(/[.\-\s]/g, '');
  const safeDv = trimSafe(dv, 1);

  if (
    documentCode === '31' &&
    /^\d$/.test(safeDv) &&
    new RegExp(`[-\s]${safeDv}$`).test(raw) &&
    normalized.endsWith(safeDv)
  ) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function buildFactusCustomer(order = {}) {
  const customer = order?.customer || {};
  const billing = order?.billing || {};
  const personType = trimSafe(billing?.personType || customer?.personType || 'natural', 30).toLowerCase();
  const isCompany = personType === 'juridica';
  const documentCode = normalizeFactusDocumentCode(
    billing?.documentType || customer?.documentType || 'CC'
  );
  const rawIdentification = normalizeFactusIdentification(
    billing?.documentNumber ||
      billing?.identification ||
      billing?.id ||
      customer?.documentNumber ||
      customer?.identification ||
      customer?.id ||
      '',
    documentCode,
    billing?.dv || customer?.dv
  );
  const firstName = trimSafe(billing?.firstName || billing?.name || customer?.name, 100);
  const lastName = trimSafe(billing?.lastName || billing?.lastname || customer?.lastname, 100);
  const naturalName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const isPosConsumerFinal =
    !rawIdentification &&
    String(order?.source || '').trim().toLowerCase() === 'pos' &&
    /consumidor final/i.test(naturalName);
  const identification = isPosConsumerFinal ? '222222222222' : rawIdentification;
  const businessName = trimSafe(
    billing?.businessName || billing?.company || customer?.businessName || '',
    180
  );
  const countryCode = normalizeFactusCountryCode(
    billing?.countryCode || billing?.country || customer?.countryCode || customer?.country
  );
  const municipalityCode = trimSafe(
    billing?.municipalityCode ||
      billing?.cityCode ||
      billing?.municipalityId ||
      customer?.municipalityId ||
      customer?.municipality_id ||
      '',
    30
  );
  const emailCandidate = billing?.email || customer?.email || customer?.emailOrPhone || '';

  const factusCustomer = {
    identification_document_code: documentCode,
    identification,
    legal_organization_code: isCompany ? '1' : '2',
    tribute_code: trimSafe(billing?.tributeCode || customer?.tributeCode || 'ZZ', 10).toUpperCase() || 'ZZ',
    address: trimSafe(billing?.address || customer?.address || '', 180),
    email: isValidEmail(emailCandidate) ? trimSafe(emailCandidate, 180) : '',
    phone: trimSafe(billing?.phone || customer?.phone || '', 40),
    country_code: countryCode,
  };

  if (documentCode === '31' && /^\d$/.test(trimSafe(billing?.dv || customer?.dv, 1))) {
    factusCustomer.dv = trimSafe(billing?.dv || customer?.dv, 1);
  }

  if (isCompany) {
    factusCustomer.company = businessName;
    if (businessName) factusCustomer.trade_name = businessName;
  } else {
    factusCustomer.names = naturalName || (isPosConsumerFinal ? 'Consumidor final' : '');
  }

  if (countryCode === 'CO' && municipalityCode) {
    factusCustomer.municipality_code = municipalityCode;
  }

  return factusCustomer;
}

function allocateFactusDiscounts(orderItems = [], totalDiscount = 0) {
  const lines = orderItems.map((item) => {
    const quantity = Math.max(0, toNumber(item?.quantity ?? item?.qty ?? 0, 0));
    const price = Math.max(0, toNumber(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0, 0));
    return Math.round(quantity * price * 100);
  });
  const subtotalCents = lines.reduce((sum, value) => sum + value, 0);
  let remainingCents = Math.min(Math.round(toMoney(totalDiscount) * 100), subtotalCents);

  return lines.map((lineCents, index) => {
    if (remainingCents <= 0 || subtotalCents <= 0) return 0;
    const isLast = index === lines.length - 1;
    const allocated = isLast
      ? Math.min(lineCents, remainingCents)
      : Math.min(
          lineCents,
          remainingCents,
          Math.round((Math.round(toMoney(totalDiscount) * 100) * lineCents) / subtotalCents)
        );
    remainingCents -= allocated;
    return allocated / 100;
  });
}

function buildFactusInvoicePayload(invoiceData = {}) {
  const order = invoiceData?.order || {};
  const transaction = invoiceData?.transaction || {};
  const orderItems = Array.isArray(order?.items) ? order.items : [];

  const calculatedItemsTotal = orderItems.reduce((acc, item) => {
    const quantity = toNumber(item?.quantity ?? item?.qty ?? 1, 1);
    const price = toNumber(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0, 0);

    return acc + quantity * price;
  }, 0);

  const subtotal = Number.isFinite(Number(order?.subtotal))
    ? toMoney(order.subtotal)
    : toMoney(calculatedItemsTotal);
  const shipping = toMoney(order?.shipping ?? order?.pricing?.shipping ?? 0);
  const ivaAmount = toMoney(order?.taxes?.iva?.amount ?? order?.pricing?.taxAmount ?? 0);
  const ivaPercent = toMoney(order?.taxes?.iva?.percent ?? 0);
  const productDiscount = toMoney(
    order?.pricing?.productDiscount ??
      order?.discount?.amount ??
      order?.discountAmount ??
      (typeof order?.discount === 'number' ? order.discount : 0)
  );
  const netSubtotal = toMoney(
    order?.pricing?.subtotalAfterDiscount ?? subtotal - productDiscount
  );
  const total = Number.isFinite(Number(order?.total))
    ? toMoney(order.total)
    : toMoney(netSubtotal + shipping + ivaAmount);

  const ivaEnabled = order?.taxes?.iva?.enabled !== false && ivaPercent > 0;
  const hasIva = ivaEnabled;
  const ivaRate = hasIva ? ivaPercent.toFixed(2) : '0.00';
  const explicitDiscountTotal = toMoney(
    orderItems.reduce((sum, item) => sum + toNumber(item?.discountAmount, 0), 0)
  );
  const allocatedDiscounts = explicitDiscountTotal > 0
    ? orderItems.map((item) => toMoney(item?.discountAmount || 0))
    : allocateFactusDiscounts(orderItems, productDiscount);

  const items = orderItems.map((item, index) => {
    const quantity = toNumber(item?.quantity ?? item?.qty ?? 1, 1);
    const price = toMoney(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0);
    const discountAmount = toMoney(allocatedDiscounts[index] || 0);
    const factusItem = {
      code_reference: String(item?.productId || item?.product || item?._id || item?.title || 'ITEM'),
      name: String(item?.title || 'Producto'),
      quantity,
      price,

      unit_measure_code: '94',
      standard_code: '999',
      taxes: hasIva
        ? [{ code: '01', rate: ivaRate }]
        : [{ is_excluded: true }],
      withholding_taxes: [],
    };

    if (discountAmount > 0) {
      factusItem.discount_amount = discountAmount.toFixed(2);
    }

    return factusItem;
  });

  if (shipping > 0) {
    items.push({
      code_reference: 'ENVIO',
      name: 'Servicio de envío',
      quantity: 1,
      discount_rate: 0,
      price: shipping,

      unit_measure_code: '94',
      standard_code: '999',
      taxes: [{ is_excluded: true }],
      withholding_taxes: [],
    });
  }

  const paymentMethodType =
    String(
      order?.payment?.methodType ||
      order?.payment?.method ||
      order?.payment?.methodLabel ||
      order?.payment?.rawMethod?.type ||
      order?.paymentMethodType ||
      order?.payment_method_type ||
      transaction?.payment_method_type ||
      transaction?.payment_method?.type ||
      ''
    )
      .trim()
      .toUpperCase();

  let factusPaymentMethodCode = '10';

  if (
    paymentMethodType.includes('DAVIPLATA') ||
    paymentMethodType.includes('NEQUI') ||
    paymentMethodType.includes('PSE') ||
    paymentMethodType.includes('BANCOLOMBIA') ||
    paymentMethodType.includes('TRANSFER')
  ) {
    factusPaymentMethodCode = '47';
  } else if (
    paymentMethodType.includes('DEBIT')
  ) {
    factusPaymentMethodCode = '49';
  } else if (
    paymentMethodType.includes('CARD') ||
    paymentMethodType.includes('CREDIT') ||
    paymentMethodType.includes('TARJETA')
  ) {
    factusPaymentMethodCode = '48';
  }

  return {
    reference_code: String(order?.orderNumber || order?._id || `ORDER-${Date.now()}`),
    document: '01',
    send_email: false,
    observation: 'Factura generada desde tienda virtual.',

    customer: buildFactusCustomer(order),
    payment_details: [
      {
        payment_form: '1',
        payment_method_code: factusPaymentMethodCode,
        amount: total.toFixed(2),
      },
    ],

    items,

    totals: {
      subtotal,
      discount: productDiscount,
      taxable_base: netSubtotal,
      shipping,
      iva: ivaAmount,
      total,
    },
  };
}

function buildFactusCreditNotePayload({
  electronicInvoice = {},
  order = {},
  settings = {},
  reasonCode = '1',
  reasonText = 'Devolución de factura',
  type = 'total',
  selectedItems = [],
  billId = 0,
  referenceCode = '',
  numberingRangeId = 0,
}) {
  const resolvedNumberingRangeId = Number(
    numberingRangeId ||
      settings?.billing?.electronicProvider?.creditNoteNumberingRangeId ||
      settings?.billing?.electronicProvider?.numberingRangeId ||
      settings?.billing?.dianResolution?.creditNoteNumberingRangeId ||
      settings?.billing?.dianResolution?.numberingRangeId ||
      0

  );

  const invoicePayload = buildFactusInvoicePayload({ order });
  const originalItems = Array.isArray(invoicePayload.items) ? invoicePayload.items : [];
  const selectedByCode = new Map(
    (Array.isArray(selectedItems) ? selectedItems : []).map((item) => [
      String(item?.codeReference || item?.code_reference || item?.productId || ''),
      item,
    ])
  );
  const sourceItems = type === 'partial'
    ? originalItems.filter((item) => selectedByCode.has(String(item.code_reference || '')))
    : originalItems;

  const items = sourceItems.map((item) => {
    const selected = selectedByCode.get(String(item.code_reference || '')) || {};
    const originalQuantity = Math.max(0, toNumber(item.quantity, 0));
    const quantity = type === 'partial'
      ? Math.min(originalQuantity, Math.max(0, toNumber(selected.quantity, 0)))
      : originalQuantity;
    const ratio = originalQuantity > 0 ? quantity / originalQuantity : 0;
    const discountAmount = toMoney(toNumber(item.discount_amount, 0) * ratio);
    const creditItem = {
      ...item,
      quantity,
      note: trimSafe(reasonText, 250),
    };

    if (discountAmount > 0) creditItem.discount_amount = discountAmount.toFixed(2);
    else delete creditItem.discount_amount;

    return creditItem;
  }).filter((item) => Number(item.quantity || 0) > 0);

  const totals = items.reduce((acc, item) => {
    const gross = toMoney(toNumber(item.quantity, 0) * toNumber(item.price, 0));
    const discount = toMoney(item.discount_amount || 0);
    const taxable = toMoney(Math.max(0, gross - discount));
    const taxDefinition = item?.taxes?.[0] || {};
    const rate = taxDefinition.is_excluded === true || item.is_excluded === true
      ? 0
      : toNumber(taxDefinition.rate ?? item.tax_rate, 0);
    const taxAmount = toMoney(taxable * (rate / 100));
    acc.subtotal = toMoney(acc.subtotal + gross);
    acc.discount = toMoney(acc.discount + discount);
    acc.tax = toMoney(acc.tax + taxAmount);
    acc.total = toMoney(acc.total + taxable + taxAmount);
    return acc;
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 });

  const payload = {
    reference_code: trimSafe(referenceCode, 100),

    bill_id: Number(billId || 0),

    correction_concept_code: String(reasonCode),

    customization_id: '20',

    observation: reasonText,

    payment_details: [
      {
        payment_form: '1',
        payment_method_code: '10',
        amount: totals.total.toFixed(2),
      },
    ],

    items,
  };

  payload.numbering_range_id = resolvedNumberingRangeId;

  if (!payload.reference_code) {
    throw new Error('La nota crédito requiere un código de referencia idempotente.');
  }

  if (!Number.isInteger(payload.bill_id) || payload.bill_id <= 0) {
    throw new Error('La factura relacionada no tiene el ID oficial de Factus.');
  }

  if (!items.length || totals.total <= 0) {
    throw new Error('La nota crédito no contiene ítems válidos para acreditar.');
  }

  return payload;
}

module.exports = {
  buildFactusCreditNotePayload,
  buildFactusCustomer,
  buildFactusInvoicePayload,
};
