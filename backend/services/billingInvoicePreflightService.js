'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');
const {
  buildRuntimeFactusConfig,
} = require('../lib/billing/billingConfigurationSecurity');
const {
  buildFactusInvoicePayload,
} = require('../lib/dian/providers/factus/factusPayloads');
const {
  assertTotalsReconciled,
  buildCustomerSnapshot,
  calculateTotals,
  isBillableOrder,
} = require('./electronicInvoiceIssuanceService');

const FINAL_CONSUMER_DOCUMENT = '222222222222';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const READY_RETRY_STATES = new Set(['failed', 'rejected', 'error']);
const CLOSED_INVOICE_STATES = new Set(['accepted', 'validated']);

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 500) {
  return cleanText(value, max).toLowerCase();
}

function toPlain(value) {
  return value?.toObject
    ? value.toObject({ depopulate: true })
    : value && typeof value === 'object'
      ? value
      : {};
}

function issue(code, field, message, severity = 'error') {
  return { code, field, message, severity };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function normalizeDocument(value) {
  return cleanText(value, 60).replace(/[.\s-]+/g, '');
}

function validateCustomerSnapshot(
  customer = {},
  payloadCustomer = {},
  { requireMunicipality = true } = {}
) {
  const blockers = [];
  const warnings = [];
  const documentNumber = normalizeDocument(customer.documentNumber);
  const documentType = cleanText(customer.documentType, 20).toUpperCase();
  const personType = cleanLower(customer.personType, 30) || 'natural';
  const isFinalConsumer = customer.isFinalConsumer === true;
  const isGenericDocument = documentNumber === FINAL_CONSUMER_DOCUMENT;
  const fullName = cleanText(
    [customer.firstName, customer.lastName].filter(Boolean).join(' '),
    220
  );
  const businessName = cleanText(customer.businessName, 220);

  if (isGenericDocument && !isFinalConsumer) {
    blockers.push(issue(
      'BILLING_FINAL_CONSUMER_MISMATCH',
      'billing.documentNumber',
      'El documento 222222222222 solo puede utilizarse cuando la orden está marcada expresamente como consumidor final.'
    ));
  }

  if (isFinalConsumer && documentNumber && !isGenericDocument) {
    blockers.push(issue(
      'BILLING_IDENTIFIED_CUSTOMER_MISMATCH',
      'billing.isFinalConsumer',
      'La orden está marcada como consumidor final, pero conserva un documento de comprador identificado.'
    ));
  }

  if (!isFinalConsumer) {
    if (!documentNumber) {
      blockers.push(issue(
        'BILLING_CUSTOMER_DOCUMENT_REQUIRED',
        'billing.documentNumber',
        'Registra el documento fiscal del comprador.'
      ));
    }

    if (!documentType) {
      blockers.push(issue(
        'BILLING_CUSTOMER_DOCUMENT_TYPE_REQUIRED',
        'billing.documentType',
        'Selecciona el tipo de documento fiscal del comprador.'
      ));
    }

    if (personType === 'juridica') {
      if (documentType !== 'NIT') {
        blockers.push(issue(
          'BILLING_COMPANY_NIT_REQUIRED',
          'billing.documentType',
          'Una persona jurídica debe facturarse con NIT.'
        ));
      }
      if (!businessName) {
        blockers.push(issue(
          'BILLING_COMPANY_NAME_REQUIRED',
          'billing.businessName',
          'Registra la razón social de la persona jurídica.'
        ));
      }
    } else if (!fullName && !businessName) {
      blockers.push(issue(
        'BILLING_CUSTOMER_NAME_REQUIRED',
        'customer.name',
        'Registra el nombre del comprador identificado.'
      ));
    }

    if (!cleanText(customer.address, 220)) {
      blockers.push(issue(
        'BILLING_CUSTOMER_ADDRESS_REQUIRED',
        'billing.address',
        'Registra la dirección fiscal del comprador.'
      ));
    }

    const email = cleanLower(customer.email, 220);
    if (!email || !EMAIL_PATTERN.test(email)) {
      blockers.push(issue(
        'BILLING_CUSTOMER_EMAIL_INVALID',
        'billing.email',
        'Registra un correo fiscal válido para el comprador.'
      ));
    }
  }

  if (requireMunicipality && !cleanText(customer.municipalityCode, 30)) {
    blockers.push(issue(
      'BILLING_CUSTOMER_MUNICIPALITY_REQUIRED',
      'billing.municipalityCode',
      'Selecciona el municipio fiscal del comprador.'
    ));
  }

  if (!payloadCustomer || Array.isArray(payloadCustomer) || typeof payloadCustomer !== 'object') {
    blockers.push(issue(
      'BILLING_PROVIDER_CUSTOMER_INVALID',
      'customer',
      'No fue posible construir el comprador que recibirá Factus.'
    ));
  }

  if (!cleanText(customer.phone, 40)) {
    warnings.push(issue(
      'BILLING_CUSTOMER_PHONE_MISSING',
      'billing.phone',
      'El comprador no tiene teléfono fiscal; la factura puede emitirse, pero el contacto quedará incompleto.',
      'warning'
    ));
  }

  return { blockers, warnings };
}

function providerMode(settings = {}) {
  const billing = settings.billing || {};
  const provider = cleanLower(
    billing?.electronicProvider?.provider || billing?.dian?.providerType || 'mock',
    40
  );
  const mode = cleanLower(billing?.dian?.mode || 'internal', 40);
  const external = billing?.dian?.enabled === true && mode !== 'internal' && provider !== 'mock';
  return { provider, mode, external };
}

function createPreflightError(message, code, statusCode = 422, details = {}) {
  return Object.assign(new Error(message), { code, statusCode, details });
}

function safeInvoice(invoice = {}) {
  if (!invoice?._id) return null;
  return {
    id: String(invoice._id),
    number: cleanText(invoice.invoiceNumber || invoice?.provider?.number, 160),
    status: cleanLower(invoice.status, 40),
    providerStatus: cleanLower(invoice?.provider?.status, 60),
    validated: invoice?.provider?.isValidated === true || CLOSED_INVOICE_STATES.has(cleanLower(invoice.status, 40)),
    retryable: READY_RETRY_STATES.has(cleanLower(invoice.status, 40)),
    inProgress:
      cleanLower(invoice?.emission?.state, 40) === 'processing' ||
      cleanLower(invoice.status, 40) === 'processing',
  };
}

async function buildInvoicePreflight(
  orderId,
  {
    OrderModel = Order,
    SettingsModel = SiteSettings,
    InvoiceModel = ElectronicInvoice,
  } = {}
) {
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) {
    throw createPreflightError('La orden enviada no es válida.', 'INVALID_ORDER_ID', 400);
  }

  const [orderDocument, settingsDocument, invoiceDocument] = await Promise.all([
    OrderModel.findById(orderId).lean(),
    SettingsModel.findOne().lean(),
    InvoiceModel.findOne({ orderId }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!orderDocument) {
    throw createPreflightError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
  }

  const order = toPlain(orderDocument);
  const settings = toPlain(settingsDocument);
  const blockers = [];
  const warnings = [];
  const mode = providerMode(settings);
  const existingInvoice = safeInvoice(invoiceDocument);

  if (!isBillableOrder(order)) {
    blockers.push(issue(
      'ORDER_NOT_BILLABLE',
      'payment.status',
      'Solo se pueden facturar órdenes pagadas o ventas POS cerradas.'
    ));
  }

  if (existingInvoice?.validated) {
    blockers.push(issue(
      'INVOICE_ALREADY_VALIDATED',
      'electronicInvoice',
      `La orden ya tiene una factura validada${existingInvoice.number ? `: ${existingInvoice.number}` : ''}.`
    ));
  } else if (existingInvoice?.inProgress) {
    blockers.push(issue(
      'INVOICE_ALREADY_PROCESSING',
      'electronicInvoice',
      'La factura de esta orden ya se está procesando.'
    ));
  }

  let runtimeConfig = null;
  if (mode.external && mode.provider === 'factus') {
    try {
      runtimeConfig = buildRuntimeFactusConfig(settings.billing || {});
      if (!(Number(runtimeConfig.numberingRangeId) > 0)) {
        blockers.push(issue(
          'FACTUS_INVOICE_NUMBERING_RANGE_REQUIRED',
          'billing.electronicProvider.numberingRangeId',
          'No hay un rango oficial de facturas sincronizado para Factus.'
        ));
      }
    } catch (error) {
      blockers.push(issue(
        error?.code || 'BILLING_PROVIDER_CONFIGURATION_INVALID',
        'billing.electronicProvider',
        cleanText(error?.message, 500) || 'La configuración de Factus está incompleta.'
      ));
    }
  }

  let totals = null;
  try {
    totals = calculateTotals(order, settings);
    assertTotalsReconciled(order, totals);
  } catch (error) {
    blockers.push(issue(
      error?.code || 'BILLING_TOTALS_INVALID',
      'totals',
      cleanText(error?.message, 500) || 'Los totales de la orden no concilian.'
    ));
  }

  let customer = null;
  try {
    customer = buildCustomerSnapshot(order, {
      requireMunicipality: mode.external && mode.provider === 'factus',
    });
  } catch (error) {
    blockers.push(issue(
      error?.code || 'BILLING_CUSTOMER_INVALID',
      'billing',
      cleanText(error?.message, 500) || 'Los datos fiscales del comprador están incompletos.'
    ));
  }

  const normalizedOrder = totals
    ? {
        ...order,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        total: totals.total,
        pricing: {
          ...(order.pricing || {}),
          ...totals,
        },
        taxes: {
          ...(order.taxes || {}),
          iva: {
            ...(order?.taxes?.iva || {}),
            enabled: totals.taxAmount > 0 || order?.taxes?.iva?.enabled === true,
            taxableBase: totals.taxableBase,
            amount: totals.taxAmount,
          },
        },
      }
    : order;

  let factusPayload = null;
  if (customer && totals) {
    factusPayload = buildFactusInvoicePayload({ order: normalizedOrder });
    if (runtimeConfig?.numberingRangeId) {
      factusPayload.numbering_range_id = Number(runtimeConfig.numberingRangeId);
    }
    const validation = validateCustomerSnapshot(customer, factusPayload.customer, {
      requireMunicipality: mode.external && mode.provider === 'factus',
    });
    blockers.push(...validation.blockers);
    warnings.push(...validation.warnings);
  }

  const snapshot = {
    orderId: String(order._id),
    orderNumber: cleanText(order.orderNumber, 180),
    orderUpdatedAt: order.updatedAt || null,
    provider: mode.provider,
    environment: runtimeConfig?.environment || mode.mode,
    existingInvoice,
    customer,
    totals,
    payload: factusPayload,
  };

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    fingerprint: fingerprint(snapshot),
    ...snapshot,
  };
}

function assertPreflightReady(preflight = {}, expectedFingerprint = '') {
  if (!preflight.ready) {
    throw createPreflightError(
      preflight.blockers?.[0]?.message || 'La orden no supera el control fiscal previo.',
      preflight.blockers?.[0]?.code || 'BILLING_PREFLIGHT_BLOCKED',
      422,
      { blockers: preflight.blockers || [] }
    );
  }

  const expected = cleanText(expectedFingerprint, 128);
  if (!expected) {
    throw createPreflightError(
      'Debes revisar y confirmar la vista previa fiscal antes de emitir.',
      'BILLING_PREFLIGHT_CONFIRMATION_REQUIRED',
      409
    );
  }

  if (expected !== preflight.fingerprint) {
    throw createPreflightError(
      'Los datos fiscales cambiaron después de la revisión. Vuelve a comprobarlos antes de emitir.',
      'BILLING_PREFLIGHT_CHANGED',
      409
    );
  }

  return true;
}

module.exports = {
  FINAL_CONSUMER_DOCUMENT,
  assertPreflightReady,
  buildInvoicePreflight,
  validateCustomerSnapshot,
};
