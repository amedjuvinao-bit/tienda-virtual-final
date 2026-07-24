'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');
const { generateCUFE } = require('../lib/dian/cufe');
const { generateInvoiceXML } = require('../lib/dian/xmlGenerator');
const { sendElectronicInvoiceToProvider } = require('../lib/dian/providerAdapter');

const BILLABLE_ORDER_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];
const PAID_PAYMENT_STATUSES = ['paid', 'approved', 'captured', 'success'];
const SENSITIVE_PROVIDER_KEY =
  /(authorization|password|passwd|secret|token|credential|cookie|softwarepin|technicalkey|certificate|privatekey|apikey|clientsecret|refresh)/i;

function cleanText(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function hasFiniteNumber(value) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function hasProviderDocumentShape(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  return Boolean(firstValue(
    value.number,
    value.invoiceNumber,
    value.reference_code,
    value.referenceCode,
    value.cufe,
    value.is_validated,
    value.validated_at
  ) !== undefined);
}

function extractProviderDocument(providerResponse = {}) {
  const data = providerResponse?.data;
  const nested = data?.data;
  const raw = providerResponse?.raw;
  const candidates = [
    nested?.bill,
    nested?.invoice,
    nested,
    data?.bill,
    data?.invoice,
    data,
    raw?.data?.data?.bill,
    raw?.data?.data?.invoice,
    raw?.data?.data,
    raw?.data,
    raw,
  ];

  return candidates.find(hasProviderDocumentShape) || {};
}

function providerMessage(providerResponse = {}, fallback = '') {
  const value = firstValue(
    providerResponse?.error,
    providerResponse?.data?.message,
    providerResponse?.message,
    fallback
  );

  if (typeof value === 'string') return cleanText(value, 500);

  try {
    return cleanText(JSON.stringify(value), 500);
  } catch {
    return cleanText(fallback, 500);
  }
}

function extractProviderErrors(providerResponse = {}, providerDocument = {}) {
  const errors = firstValue(
    providerDocument?.errors,
    providerResponse?.data?.errors,
    providerResponse?.data?.data?.errors,
    providerResponse?.raw?.errors,
    {}
  );

  return errors && typeof errors === 'object' && !Array.isArray(errors)
    ? sanitizeProviderPayload(errors)
    : {};
}

function sanitizeProviderPayload(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, 5000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'object' || depth >= 8) return undefined;
  if (seen.has(value)) return undefined;

  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => sanitizeProviderPayload(item, depth + 1, seen))
      .filter((item) => item !== undefined);
  }

  const result = {};
  Object.entries(value)
    .slice(0, 200)
    .forEach(([key, item]) => {
      const normalizedKey = String(key).replace(/[^a-z0-9]/gi, '');
      if (SENSITIVE_PROVIDER_KEY.test(normalizedKey)) return;
      const safeValue = sanitizeProviderPayload(item, depth + 1, seen);
      if (safeValue !== undefined) result[String(key).slice(0, 120)] = safeValue;
    });
  return result;
}

function toPlain(document) {
  if (!document) return null;
  return typeof document.toObject === 'function' ? document.toObject() : document;
}

async function lean(query) {
  if (!query) return null;
  return typeof query.lean === 'function' ? query.lean() : query;
}

function createBillingError(message, status, code, extra = {}) {
  return Object.assign(new Error(message), { status, code, ...extra });
}

function getItems(order = {}) {
  return Array.isArray(order.items) ? order.items : Array.isArray(order.cart) ? order.cart : [];
}

function buildCustomerSnapshot(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};
  const fullName = [customer.name, customer.lastname].filter(Boolean).join(' ').trim();
  const billingName = [
    billing.firstName || billing.name,
    billing.lastName || billing.lastname,
  ].filter(Boolean).join(' ').trim();

  const explicitFinalConsumer =
    order?.billing?.isFinalConsumer === true ||
    order?.customer?.isFinalConsumer === true ||
    order?.pos?.customerMode === 'guest' ||
    (order?.source === 'pos' && order?.pos?.quickSale === true);
  const documentNumber = cleanText(
    firstValue(
      billing.documentNumber,
      billing.identification,
      billing.id,
      customer.documentNumber,
      customer.document,
      customer.cedula,
      customer.identification,
      customer.id
    ),
    60
  );

  if (!documentNumber && !explicitFinalConsumer) {
    throw createBillingError(
      'La orden no tiene identificación fiscal del comprador ni está marcada explícitamente como consumidor final.',
      422,
      'BILLING_CUSTOMER_IDENTITY_REQUIRED'
    );
  }

  return {
    documentType: billing.documentType || customer.documentType || customer.tipoDocumento || 'CC',
    documentNumber: documentNumber || '222222222222',
    dv: billing.dv || customer.dv || '',
    personType: billing.personType || customer.personType || 'natural',
    firstName: billing.firstName || billing.name || customer.name || '',
    lastName: billing.lastName || billing.lastname || customer.lastname || '',
    businessName: billing.businessName || customer.businessName || billingName || fullName || '',
    email: billing.email || customer.email || customer.emailOrPhone || '',
    phone: billing.phone || customer.phone || '',
    address: billing.address || customer.address || '',
    city: billing.city || customer.city || '',
    municipalityCode:
      billing.municipalityCode ||
      billing.cityCode ||
      customer.municipalityId ||
      customer.municipality_id ||
      '',
    department: billing.department || customer.department || '',
    departmentCode: billing.departmentCode || customer.departmentCode || '',
    country: billing.country || customer.country || 'Colombia',
    countryCode: billing.countryCode || customer.countryCode || 'CO',
    tributeCode: billing.tributeCode || customer.tributeCode || 'ZZ',
    isFinalConsumer: explicitFinalConsumer,
  };
}

function calculateTotals(order = {}, settings = {}) {
  const lineSubtotal = getItems(order).reduce((acc, item) => {
    const quantity = Number(item.quantity || item.qty || 0) || 0;
    const price = Number(item.price || item.unitPrice || item.priceNumber || item?.product?.price || 0) || 0;
    return acc + quantity * price;
  }, 0);

  const subtotal = hasFiniteNumber(order.subtotal) ? money(order.subtotal) : money(lineSubtotal);
  const productDiscount = hasFiniteNumber(order?.pricing?.productDiscount)
    ? money(order.pricing.productDiscount)
    : money(order?.discount?.amount ?? order?.discountAmount ?? (
      typeof order?.discount === 'number' ? order.discount : 0
    ));
  const subtotalAfterDiscount = hasFiniteNumber(order?.pricing?.subtotalAfterDiscount)
    ? money(order.pricing.subtotalAfterDiscount)
    : money(Math.max(0, subtotal - productDiscount));
  const originalShipping = hasFiniteNumber(order?.pricing?.originalShipping)
    ? money(order.pricing.originalShipping)
    : money(order.shipping);
  const shippingDiscount = hasFiniteNumber(order?.pricing?.shippingDiscount)
    ? money(order.pricing.shippingDiscount)
    : 0;
  const shipping = hasFiniteNumber(order.shipping)
    ? money(order.shipping)
    : money(Math.max(0, originalShipping - shippingDiscount));
  const ivaConfig = order?.taxes?.iva || {};
  const legacyTaxConfig = settings?.billing?.taxes?.iva || {};
  const ivaEnabled = ivaConfig.enabled === undefined
    ? legacyTaxConfig.enabled !== false
    : ivaConfig.enabled === true;
  const ivaPercent = Number(ivaConfig.percent ?? legacyTaxConfig.percent ?? 0) || 0;
  const explicitTotal = hasFiniteNumber(order.total) ? money(order.total) : null;
  const impliedTaxAmount = explicitTotal !== null
    ? money(Math.max(0, explicitTotal - subtotalAfterDiscount - shipping))
    : null;
  let taxAmount;

  if (
    hasFiniteNumber(ivaConfig.amount) &&
    (Number(order?.pricing?.version || 0) >= 2 || Number(ivaConfig.amount) > 0 || impliedTaxAmount === 0)
  ) {
    taxAmount = money(ivaConfig.amount);
  } else if (impliedTaxAmount !== null) {
    // Las órdenes históricas podían guardar total con IVA pero conservar
    // taxes.iva.amount en cero por el valor predeterminado del esquema.
    taxAmount = impliedTaxAmount;
  } else if (ivaEnabled) {
    taxAmount = money((subtotalAfterDiscount * ivaPercent) / 100);
  } else {
    taxAmount = 0;
  }

  const total = explicitTotal !== null
    ? explicitTotal
    : money(subtotalAfterDiscount + shipping + taxAmount);
  const totalDiscount = money(productDiscount + shippingDiscount);

  return {
    currency: order?.pricing?.currency || order?.payment?.currency || 'COP',
    subtotal,
    productDiscount,
    subtotalAfterDiscount,
    originalShipping,
    shippingDiscount,
    shipping,
    totalDiscount,
    taxableBase: subtotalAfterDiscount,
    taxAmount,
    total,
  };
}

function assertTotalsReconciled(order = {}, totals = {}) {
  const invalidTotal = [
    totals.subtotal,
    totals.productDiscount,
    totals.subtotalAfterDiscount,
    totals.originalShipping,
    totals.shippingDiscount,
    totals.shipping,
    totals.totalDiscount,
    totals.taxableBase,
    totals.taxAmount,
    totals.total,
    order?.payment?.amount,
  ].find(
    (value) =>
      value !== undefined &&
      value !== null &&
      (!Number.isFinite(Number(value)) || Number(value) < 0)
  );
  const invalidLine = getItems(order).find((item) => {
    const quantity = Number(item.quantity ?? item.qty);
    const price = Number(
      item.price ?? item.unitPrice ?? item.priceNumber ?? item?.product?.price
    );
    return (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(price) ||
      price < 0
    );
  });

  if (invalidTotal !== undefined || invalidLine) {
    throw createBillingError(
      'La orden contiene cantidades o valores económicos inválidos y no puede facturarse.',
      422,
      'BILLING_ECONOMIC_VALUES_INVALID'
    );
  }

  if (Number(order?.pricing?.version || 0) < 2) return;

  const expectedTotal = money(
    totals.subtotalAfterDiscount + totals.shipping + totals.taxAmount
  );
  const paymentAmount = hasFiniteNumber(order?.payment?.amount)
    ? money(order.payment.amount)
    : expectedTotal;

  if (Math.abs(expectedTotal - totals.total) > 0.01) {
    throw createBillingError(
      'Los totales de la orden no concilian antes de emitir la factura.',
      422,
      'BILLING_TOTAL_MISMATCH',
      { expectedTotal, storedTotal: totals.total }
    );
  }

  const snapshotChecks = [
    ['subtotal', order?.pricing?.subtotal, totals.subtotal],
    ['productDiscount', order?.pricing?.productDiscount, totals.productDiscount],
    ['subtotalAfterDiscount', order?.pricing?.subtotalAfterDiscount, totals.subtotalAfterDiscount],
    ['originalShipping', order?.pricing?.originalShipping, totals.originalShipping],
    ['shippingDiscount', order?.pricing?.shippingDiscount, totals.shippingDiscount],
    ['shipping', order?.pricing?.shipping, totals.shipping],
    ['totalDiscount', order?.pricing?.totalDiscount, totals.totalDiscount],
    ['taxableBase', order?.pricing?.taxableBase, totals.taxableBase],
    ['taxAmount', order?.pricing?.taxAmount, totals.taxAmount],
    ['total', order?.pricing?.total, totals.total],
    ['taxes.iva.taxableBase', order?.taxes?.iva?.taxableBase, totals.taxableBase],
    ['taxes.iva.amount', order?.taxes?.iva?.amount, totals.taxAmount],
  ];
  const inconsistentSnapshot = snapshotChecks.find(([, stored, expected]) => (
    hasFiniteNumber(stored) && Math.abs(money(stored) - money(expected)) > 0.01
  ));

  if (inconsistentSnapshot) {
    const [field, stored, expected] = inconsistentSnapshot;
    throw createBillingError(
      `La fotografía económica de la orden no concilia en ${field}.`,
      422,
      'BILLING_PRICING_SNAPSHOT_MISMATCH',
      { field, stored: money(stored), expected: money(expected) }
    );
  }

  const items = getItems(order);
  if (items.length > 0) {
    const lineSnapshot = items.reduce(
      (acc, item) => {
        const quantity = Number(item.quantity || item.qty || 0) || 0;
        const price = Number(item.price || item.unitPrice || item.priceNumber || 0) || 0;
        acc.subtotal += hasFiniteNumber(item.lineSubtotal)
          ? money(item.lineSubtotal)
          : money(quantity * price);
        acc.discount += money(item.discountAmount);
        acc.taxableBase += hasFiniteNumber(item.taxableBase)
          ? money(item.taxableBase)
          : money(quantity * price - money(item.discountAmount));
        acc.tax += money(item.taxAmount);
        return acc;
      },
      { subtotal: 0, discount: 0, taxableBase: 0, tax: 0 }
    );
    const lineChecks = [
      ['items.lineSubtotal', lineSnapshot.subtotal, totals.subtotal],
      ['items.discountAmount', lineSnapshot.discount, totals.productDiscount],
      ['items.taxableBase', lineSnapshot.taxableBase, totals.taxableBase],
      ['items.taxAmount', lineSnapshot.tax, totals.taxAmount],
    ];
    const inconsistentLines = lineChecks.find(([, stored, expected]) => (
      Math.abs(money(stored) - money(expected)) > 0.01
    ));

    if (inconsistentLines) {
      const [field, stored, expected] = inconsistentLines;
      throw createBillingError(
        `Las líneas de la orden no concilian en ${field}.`,
        422,
        'BILLING_LINE_TOTAL_MISMATCH',
        { field, stored: money(stored), expected: money(expected) }
      );
    }
  }

  if (paymentAmount > 0 && Math.abs(paymentAmount - totals.total) > 0.01) {
    throw createBillingError(
      'El valor del pago no coincide con el total que se va a facturar.',
      422,
      'BILLING_PAYMENT_TOTAL_MISMATCH',
      { paymentAmount, invoiceTotal: totals.total }
    );
  }
}

function buildSettingsForInvoice(settings = {}) {
  const billing = settings?.billing || {};
  const dianConfig = billing.dian || {};
  const resolution = billing.dianResolution || {};
  const environment = dianConfig.mode === 'production'
    ? '1'
    : dianConfig.environment || resolution.environment || '2';

  return {
    ...(settings || {}),
    billing: {
      ...billing,
      dianResolution: {
        ...resolution,
        environment,
      },
    },
  };
}

function buildInvoiceNumber(resolution = {}) {
  const prefix = cleanText(resolution.prefix || 'FE', 20).replace(/\s+/g, '').toUpperCase() || 'FE';
  const currentNumber = Math.max(1, Number(resolution.currentNumber || resolution.rangeFrom || 1) || 1);

  return {
    invoiceNumber: `${prefix}${String(currentNumber).padStart(6, '0')}`,
    currentNumber,
    nextNumber: currentNumber + 1,
  };
}

function readPaymentMethodFromTransaction(transaction = {}) {
  const rawMethod = transaction?.payment_method || transaction?.rawMethod || {};

  return {
    methodType:
      cleanText(transaction?.payment_method_type, 80) ||
      cleanText(transaction?.paymentMethodType, 80) ||
      cleanText(rawMethod?.type, 80),
    method:
      cleanText(transaction?.payment_method_name, 120) ||
      cleanText(typeof transaction?.payment_method === 'string' ? transaction.payment_method : '', 120) ||
      cleanText(transaction?.paymentMethod, 120) ||
      cleanText(rawMethod?.type, 120),
    methodLabel:
      cleanText(transaction?.payment_method_name, 120) ||
      cleanText(transaction?.payment_method_type, 120) ||
      cleanText(transaction?.paymentMethodType, 120) ||
      cleanText(rawMethod?.type, 120),
    rawMethod,
  };
}

function isBillableOrder(order = {}) {
  const status = cleanText(order.status, 50).toLowerCase();
  const paymentStatus = cleanText(order.payment?.status, 50).toLowerCase();
  const source = cleanText(order.source || order.channel, 50).toLowerCase();

  return (
    BILLABLE_ORDER_STATUSES.includes(status) ||
    PAID_PAYMENT_STATUSES.includes(paymentStatus) ||
    (source === 'pos' && money(order.total) > 0)
  );
}

function isDuplicateKeyError(error) {
  return String(error?.code || '') === '11000';
}

function createElectronicInvoiceIssuanceService(overrides = {}) {
  const InvoiceModel = overrides.ElectronicInvoice || ElectronicInvoice;
  const OrderModel = overrides.Order || Order;
  const SettingsModel = overrides.SiteSettings || SiteSettings;
  const createCufe = overrides.generateCUFE || generateCUFE;
  const createXml = overrides.generateInvoiceXML || generateInvoiceXML;
  const sendToProvider = overrides.sendElectronicInvoiceToProvider || sendElectronicInvoiceToProvider;
  const isValidObjectId = overrides.isValidObjectId || mongoose.Types.ObjectId.isValid;
  const nowFactory = overrides.now || (() => new Date());
  const tokenFactory = overrides.randomUUID || (() => crypto.randomUUID());
  const sendValidatedInvoiceEmail =
    typeof overrides.sendValidatedInvoiceEmail === 'function'
      ? overrides.sendValidatedInvoiceEmail
      : null;
  const assertProductionActivation =
    typeof overrides.assertProductionActivation === 'function'
      ? overrides.assertProductionActivation
      : async (billing) => {
          const {
            assertClientActivationReady,
          } = require('./billingClientActivationOrchestrator');
          return assertClientActivationReady(billing);
        };

  async function findExistingInvoice(orderId, idempotencyKey) {
    return lean(InvoiceModel.findOne({
      $or: [
        { orderId },
        { idempotencyKey },
      ],
    }));
  }

  async function issueElectronicInvoiceForOrder({
    orderId,
    source = 'system',
    initiatedBy = 'system',
    transaction = {},
    payments = {},
    skipWhenElectronicBillingIsInactive = false,
    allowRetry = false,
  } = {}) {
    if (!isValidObjectId(String(orderId || ''))) {
      throw createBillingError('La orden enviada no es válida.', 400, 'INVALID_ORDER_ID');
    }

    const order = await lean(OrderModel.findById(orderId));
    if (!order) {
      throw createBillingError('Orden no encontrada.', 404, 'ORDER_NOT_FOUND');
    }

    if (!isBillableOrder(order)) {
      throw createBillingError(
        'Solo se pueden facturar órdenes pagadas o ventas POS cerradas.',
        422,
        'ORDER_NOT_BILLABLE'
      );
    }

    const normalizedSource = cleanText(source || 'system', 60).toLowerCase() || 'system';
    const idempotencyKey = `electronic-invoice:order:${String(order._id)}`;
    const previousInvoice = await findExistingInvoice(order._id, idempotencyKey);

    let retryInvoice = null;

    if (previousInvoice) {
      const inProgress = previousInvoice?.emission?.state === 'processing' || previousInvoice.status === 'processing';
      const retryable = ['failed', 'rejected', 'error'].includes(
        cleanText(previousInvoice.status, 40).toLowerCase()
      );

      if (inProgress || !allowRetry || !retryable) {
        return {
          created: false,
          reused: true,
          retried: false,
          retryable,
          inProgress,
          invoice: previousInvoice,
          message: inProgress
            ? 'La factura de esta orden ya se está procesando.'
            : retryable
              ? 'La orden ya tenía una factura fallida disponible para reintento controlado.'
              : 'La orden ya tenía factura registrada y no debe volver a emitirse.',
        };
      }

      retryInvoice = previousInvoice;
    }

    const settings = await lean(SettingsModel.findOne());
    const settingsForInvoice = buildSettingsForInvoice(settings || {});
    const billing = settingsForInvoice.billing || {};
    const fiscalInfo = billing.fiscalInfo || {};
    const dianResolution = billing.dianResolution || {};
    const legalTexts = billing.legalTexts || {};
    const providerName = cleanText(
      billing?.electronicProvider?.provider || billing?.dian?.providerType || 'mock',
      60
    ).toLowerCase();
    const providerMode = cleanText(billing?.dian?.mode || 'internal', 30).toLowerCase();
    const isExternalProvider =
      billing?.dian?.enabled === true &&
      providerMode !== 'internal' &&
      providerName !== 'mock';

    if (isExternalProvider && providerMode === 'production') {
      await assertProductionActivation(billing);
    }

    if (skipWhenElectronicBillingIsInactive && !isExternalProvider) {
      return {
        created: false,
        reused: retryInvoice !== null,
        retried: false,
        skipped: true,
        invoice: retryInvoice,
        message: 'Facturación electrónica omitida porque el modo externo no está activo.',
      };
    }

    const environment = dianResolution.environment || '2';
    const totals = calculateTotals(order, settingsForInvoice);
    assertTotalsReconciled(order, totals);
    const {
      subtotal,
      productDiscount,
      subtotalAfterDiscount,
      originalShipping,
      shippingDiscount,
      shipping,
      totalDiscount,
      taxableBase,
      taxAmount,
      total,
    } = totals;
    const customerSnapshot = buildCustomerSnapshot(order);
    const now = nowFactory();
    const issueDate = now.toISOString().slice(0, 10);
    const issueTime = now.toISOString().slice(11, 19);
    const { invoiceNumber, currentNumber, nextNumber } = buildInvoiceNumber(dianResolution);
    const lockToken = tokenFactory();

    const cufeData = createCufe({
      invoiceNumber,
      issueDate,
      issueTime,
      grossAmount: subtotalAfterDiscount,
      taxAmount,
      totalAmount: total,
      companyNit: fiscalInfo.nit || billing?.dian?.providerNit || '900000000',
      customerDocument: customerSnapshot.documentNumber || '222222222222',
      technicalKey: dianResolution.technicalKey || billing?.dian?.technicalKey || 'INTERNAL',
      environment,
    });
    const localQrUrl = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufeData.cufe}`;

    let xmlContent = '';
    try {
      xmlContent = createXml({ order, settings: settingsForInvoice, cufeData });
    } catch (error) {
      if (!isExternalProvider) {
        throw createBillingError(
          'No fue posible generar el XML del comprobante interno.',
          500,
          'BILLING_XML_GENERATION_FAILED',
          { cause: cleanText(error?.message, 300) }
        );
      }
    }

    let claimedInvoice = null;

    try {
      const claimPayload = {
        orderId: order._id,
        orderNumber: order.orderNumber || '',
        idempotencyKey,
        required: true,
        status: 'processing',
        emission: {
          state: 'processing',
          source: normalizedSource,
          initiatedBy: cleanText(initiatedBy || 'system', 120) || 'system',
          lockToken,
          attempts: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
        },
        totals,
        customer: customerSnapshot,
        fiscalInfo,
        dianResolution: {
          resolutionNumber: dianResolution.resolutionNumber || '',
          prefix: dianResolution.prefix || '',
          rangeFrom: Number(dianResolution.rangeFrom || 1),
          rangeTo: Number(dianResolution.rangeTo || 1),
          currentNumber,
          resolutionDate: dianResolution.resolutionDate || '',
          expirationDate: dianResolution.expirationDate || '',
          documentType: dianResolution.documentType || '01',
        },
        legalTexts: {
          invoiceLegalText: legalTexts.invoiceLegalText || '',
          internalReceiptNote: legalTexts.internalReceiptNote || '',
        },
        invoiceNumber: isExternalProvider ? '' : invoiceNumber,
        cufe: isExternalProvider ? '' : cufeData.cufe,
        xmlContent,
        qrUrl: isExternalProvider ? '' : localQrUrl,
        provider: {
          name: providerName,
          status: 'processing',
          referenceCode: cleanText(order.orderNumber || order._id, 180),
        },
        dianResponse: {
          stage: 'emission_reserved',
          environment,
          issueDate,
          issueTime,
          message: 'Emisión reservada antes de contactar al proveedor.',
          code: 'PROCESSING',
          raw: {
            source: normalizedSource,
            paymentMode: cleanText(payments?.mode, 40),
            transactionId: cleanText(
              transaction?.id || transaction?.transaction_id || transaction?.transactionId,
              120
            ),
          },
        },
        generatedAt: now,
      };

      if (retryInvoice) {
        claimedInvoice = await InvoiceModel.findOneAndUpdate(
          {
            _id: retryInvoice._id,
            status: { $in: ['failed', 'rejected', 'error'] },
            'emission.state': { $ne: 'processing' },
          },
          {
            $set: {
              ...claimPayload,
              emission: {
                state: 'processing',
                source: normalizedSource,
                initiatedBy: cleanText(initiatedBy || 'system', 120) || 'system',
                lockToken,
                attempts: Number(retryInvoice?.emission?.attempts || 1) + 1,
                firstAttemptAt: retryInvoice?.emission?.firstAttemptAt || now,
                lastAttemptAt: now,
                completedAt: null,
                failedAt: null,
              },
            },
          },
          { new: true, runValidators: true }
        );

        if (!claimedInvoice) {
          const concurrentInvoice = await findExistingInvoice(order._id, idempotencyKey);
          return {
            created: false,
            reused: true,
            retried: false,
            inProgress: true,
            invoice: concurrentInvoice,
            message: 'Otro proceso tomó primero el reintento de esta factura.',
          };
        }
      } else {
        claimedInvoice = await InvoiceModel.create(claimPayload);
      }
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;

      const concurrentInvoice = await findExistingInvoice(order._id, idempotencyKey);
      if (!concurrentInvoice) throw error;

      return {
        created: false,
        reused: true,
        retried: false,
        inProgress: concurrentInvoice?.emission?.state === 'processing' || concurrentInvoice.status === 'processing',
        invoice: concurrentInvoice,
        message: 'La factura de esta orden ya fue reservada por otra solicitud.',
      };
    }

    const transactionPayment = readPaymentMethodFromTransaction(transaction);
    const providerOrder = {
      ...order,
      subtotal,
      shipping,
      total,
      pricing: {
        ...(order.pricing || {}),
        version: Number(order?.pricing?.version || 1),
        currency: totals.currency,
        subtotal,
        productDiscount,
        subtotalAfterDiscount,
        originalShipping,
        shippingDiscount,
        shipping,
        totalDiscount,
        taxableBase,
        taxAmount,
        total,
      },
      taxes: {
        ...(order.taxes || {}),
        iva: {
          ...(order?.taxes?.iva || {}),
          enabled: taxAmount > 0 || order?.taxes?.iva?.enabled === true,
          taxableBase,
          amount: taxAmount,
        },
      },
      payment: {
        ...(order.payment || {}),
        methodType: order.payment?.methodType || transactionPayment.methodType || '',
        method: order.payment?.method || transactionPayment.method || '',
        methodLabel: order.payment?.methodLabel || transactionPayment.methodLabel || '',
        rawMethod: order.payment?.rawMethod || transactionPayment.rawMethod || {},
      },
    };

    let providerResponse = null;
    let providerDocument = {};

    if (isExternalProvider) {
      try {
        providerResponse = await sendToProvider({
          provider: providerName,
          invoiceData: {
            order: providerOrder,
            settings: settingsForInvoice,
            cufeData,
            xmlContent,
            provider: providerName,
            providerConfig: billing.electronicProvider || {},
          },
        });
      } catch (error) {
        providerResponse = {
          success: false,
          provider: providerName,
          stage: 'send_invoice',
          error: error?.message || 'No fue posible enviar la factura al proveedor.',
        };
      }

      providerDocument = extractProviderDocument(providerResponse);
    }

    const remoteNumber = cleanText(firstValue(
      providerDocument?.number,
      providerDocument?.invoiceNumber,
      providerResponse?.data?.invoiceNumber
    ), 160);
    const remoteCufe = cleanText(providerDocument?.cufe, 220);
    const providerSucceeded = !isExternalProvider || providerResponse?.success === true;
    const providerNumberMissing =
      isExternalProvider &&
      providerName === 'factus' &&
      providerResponse?.success === true &&
      !remoteNumber;

    if (!providerSucceeded || providerNumberMissing) {
      const failureMessage = providerNumberMissing
        ? 'Factus respondió la creación, pero no devolvió el número oficial de la factura.'
        : providerMessage(providerResponse, 'Factus no confirmó la creación de la factura.');
      const failureCode = providerNumberMissing
        ? 'BILLING_PROVIDER_NUMBER_MISSING'
        : 'BILLING_PROVIDER_GENERATION_ERROR';
      const failedAt = nowFactory();

      const failedInvoice = await InvoiceModel.findOneAndUpdate(
        { _id: claimedInvoice._id, 'emission.lockToken': lockToken },
        {
          $set: {
            status: 'failed',
            errorMessage: failureMessage,
            providerErrors: extractProviderErrors(providerResponse, providerDocument),
            provider: {
              name: providerName,
              status: 'failed',
              referenceCode: cleanText(order.orderNumber || order._id, 180),
              number: remoteNumber,
              cufe: remoteCufe,
              isValidated: false,
              links: providerDocument?.links || {},
              raw: sanitizeProviderPayload(providerDocument || {}),
            },
            dianResponse: {
              stage: 'provider_failed',
              environment,
              issueDate,
              issueTime,
              message: failureMessage,
              code: String(providerResponse?.status || failureCode),
              raw: {
                source: normalizedSource,
                subtotal,
                productDiscount,
                subtotalAfterDiscount,
                originalShipping,
                shippingDiscount,
                shipping,
                totalDiscount,
                taxableBase,
                taxAmount,
                total,
                providerResponse: sanitizeProviderPayload(providerResponse),
              },
            },
            'emission.state': 'failed',
            'emission.failedAt': failedAt,
            'emission.lastAttemptAt': failedAt,
            failedAt,
          },
        },
        { new: true, runValidators: true }
      );

      throw createBillingError(failureMessage, 502, failureCode, {
        invoice: toPlain(failedInvoice) || toPlain(claimedInvoice),
      });
    }

    const isProviderValidated =
      providerDocument?.is_validated === true ||
      providerDocument?.validated === true ||
      Boolean(providerDocument?.validated_at || providerDocument?.validatedAt);
    const officialLinks = providerDocument?.links && typeof providerDocument.links === 'object'
      ? providerDocument.links
      : {};
    const nextStatus = isExternalProvider
      ? (isProviderValidated ? 'accepted' : 'sent')
      : 'generated';
    const storedInvoiceNumber = remoteNumber || invoiceNumber;
    const storedCufe = isExternalProvider ? remoteCufe : cufeData.cufe;
    const completedAt = nowFactory();
    const responseMessage = providerMessage(
      providerResponse,
      isProviderValidated
        ? 'Factura creada y validada correctamente por Factus.'
        : isExternalProvider
          ? 'Factura enviada al proveedor y pendiente de validación.'
          : 'Comprobante interno generado correctamente.'
    );

    const completedInvoice = await InvoiceModel.findOneAndUpdate(
      { _id: claimedInvoice._id, 'emission.lockToken': lockToken },
      {
        $set: {
          status: nextStatus,
          invoiceNumber: storedInvoiceNumber,
          cufe: storedCufe,
          qrUrl: officialLinks.qr || officialLinks.qr_url || (isExternalProvider ? '' : localQrUrl),
          pdfUrl: officialLinks.pdf || officialLinks.pdf_url || officialLinks.public_url || '',
          xmlUrl: officialLinks.xml || officialLinks.xml_url || '',
          provider: {
            name: providerName,
            status: isProviderValidated ? 'validated' : isExternalProvider ? 'sent' : 'created',
            referenceCode: cleanText(
              providerDocument?.reference_code ||
              providerDocument?.referenceCode ||
              order.orderNumber ||
              order._id,
              180
            ),
            number: remoteNumber,
            cufe: storedCufe,
            isValidated: isProviderValidated,
            validatedAt: providerDocument?.validated_at || providerDocument?.validatedAt || '',
            links: officialLinks,
            raw: {
              ...sanitizeProviderPayload(providerDocument),
              mode: providerMode,
              source: normalizedSource,
              response: sanitizeProviderPayload(providerResponse),
            },
          },
          dianResponse: {
            stage: isExternalProvider
              ? (isProviderValidated ? 'provider_validated' : 'provider_sent')
              : 'internal_generated',
            environment,
            issueDate,
            issueTime,
            message: responseMessage,
            code: isExternalProvider
              ? String(providerResponse?.status || (isProviderValidated ? 'VALIDATED' : 'SENT'))
              : 'GENERATED',
            raw: {
              source: normalizedSource,
              paymentMode: cleanText(payments?.mode, 40),
              transactionId: cleanText(
                transaction?.id || transaction?.transaction_id || transaction?.transactionId,
                120
              ),
              subtotal,
              productDiscount,
              subtotalAfterDiscount,
              originalShipping,
              shippingDiscount,
              shipping,
              totalDiscount,
              taxableBase,
              taxAmount,
              total,
              providerResponse: sanitizeProviderPayload(providerResponse),
            },
          },
          providerErrors: {},
          errorMessage: '',
          'emission.state': 'completed',
          'emission.completedAt': completedAt,
          'emission.lastAttemptAt': completedAt,
          sentAt: isExternalProvider ? completedAt : null,
          acceptedAt: isProviderValidated ? completedAt : null,
          failedAt: null,
        },
      },
      { new: true, runValidators: true }
    );

    if (!completedInvoice) {
      const winner = await findExistingInvoice(order._id, idempotencyKey);
      return {
        created: false,
        reused: true,
        retried: retryInvoice !== null,
        inProgress: winner?.emission?.state === 'processing' || winner?.status === 'processing',
        invoice: winner,
        message: 'La emisión fue finalizada por otro proceso.',
      };
    }

    if (!isExternalProvider && settings?._id) {
      await SettingsModel.updateOne(
        { _id: settings._id, 'billing.dianResolution.currentNumber': currentNumber },
        { $set: { 'billing.dianResolution.currentNumber': nextNumber } }
      );
    }

    let deliveredInvoice = completedInvoice;
    let emailDelivery = null;

    if (
      sendValidatedInvoiceEmail &&
      providerName === 'factus' &&
      isExternalProvider &&
      isProviderValidated
    ) {
      try {
        const emailResult = await sendValidatedInvoiceEmail(completedInvoice._id, {
          automatic: true,
          initiatedBy: cleanText(initiatedBy || normalizedSource || 'system', 160),
        });
        deliveredInvoice = emailResult?.invoice || deliveredInvoice;
        emailDelivery = emailResult?.delivery || null;
      } catch (emailError) {
        // El correo es un proceso posterior: nunca cambia el estado fiscal
        // ni convierte una factura validada en una factura fallida.
        deliveredInvoice = emailError?.invoice || deliveredInvoice;
        emailDelivery = emailError?.delivery || {
          status: 'error',
          lastError: cleanText(emailError?.message, 500),
        };
      }
    }

    return {
      created: retryInvoice === null,
      reused: retryInvoice !== null,
      retried: retryInvoice !== null,
      inProgress: false,
      invoice: toPlain(deliveredInvoice),
      emailDelivery,
      message: isProviderValidated
        ? 'Factura generada y validada correctamente por Factus.'
        : isExternalProvider
          ? 'Factura enviada correctamente al proveedor.'
          : 'Comprobante interno generado correctamente.',
    };
  }

  return { issueElectronicInvoiceForOrder };
}

const defaultService = createElectronicInvoiceIssuanceService({
  sendValidatedInvoiceEmail: async (...args) => {
    const {
      sendValidatedInvoiceEmail,
    } = require('./electronicInvoiceEmailService');
    return sendValidatedInvoiceEmail(...args);
  },
});

module.exports = {
  BILLABLE_ORDER_STATUSES,
  PAID_PAYMENT_STATUSES,
  assertTotalsReconciled,
  buildCustomerSnapshot,
  calculateTotals,
  createElectronicInvoiceIssuanceService,
  extractProviderDocument,
  sanitizeProviderPayload,
  issueElectronicInvoiceForOrder: defaultService.issueElectronicInvoiceForOrder,
  isBillableOrder,
};
