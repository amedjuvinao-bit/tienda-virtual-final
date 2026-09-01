'use strict';

const {
  buildCustomerIdentity,
  cleanLower,
  cleanPhone,
  cleanText,
  cleanUpper,
  normalizeDocumentNumber,
  normalizeDocumentType,
  normalizePhone,
  onlyDigits,
} = require('../../lib/customers/customerIdentity');

const CONFIRMED_ORDER_STATUSES = new Set([
  'paid',
  'shipped',
  'delivered',
  'refunded',
]);

function getRawOrder(order = {}) {
  return typeof order?.toObject === 'function'
    ? order.toObject({ virtuals: false })
    : order || {};
}

function getOrderTags(order = {}) {
  return (Array.isArray(order?.tags) ? order.tags : [])
    .map((tag) => cleanLower(tag, 80))
    .filter(Boolean);
}

function isDemoOrder(order = {}) {
  const raw = getRawOrder(order);
  const tags = new Set(getOrderTags(raw));
  const email = cleanLower(
    raw?.customer?.email ||
      raw?.billing?.email ||
      raw?.customer?.emailOrPhone,
    180
  );
  const source = cleanLower(raw?.source, 40);

  return (
    tags.has('demo') ||
    tags.has('orders-trace') ||
    tags.has('order-trace') ||
    (
      source === 'system' &&
      (email.endsWith('@example.com') || email.endsWith('.example.com'))
    )
  );
}

function isConfirmedOrder(order = {}) {
  const raw = getRawOrder(order);
  const orderStatus = cleanLower(raw?.status, 40);
  const paymentStatus = cleanLower(raw?.payment?.status, 40);

  return paymentStatus === 'paid' || CONFIRMED_ORDER_STATUSES.has(orderStatus);
}

function buildCustomerPayloadFromOrder(order = {}, { source = '' } = {}) {
  const raw = getRawOrder(order);
  const customer = raw.customer || {};
  const billing = raw.billing || {};
  const firstName = cleanText(customer.name || billing.firstName || billing.name, 160);
  const lastName = cleanText(customer.lastname || billing.lastName || billing.lastname, 120);
  const fullName = cleanText(
    customer.fullName ||
      customer.displayName ||
      cleanText(`${firstName} ${lastName}`, 160) ||
      billing.businessName,
    160
  );
  const documentNumber = cleanText(
    customer.documentNumber ||
      customer.document ||
      customer.id ||
      billing.documentNumber ||
      billing.id,
    40
  );
  const emailCandidate = cleanLower(
    customer.email ||
      billing.email ||
      (String(customer.emailOrPhone || '').includes('@')
        ? customer.emailOrPhone
        : ''),
    180
  );
  const phoneCandidate = cleanPhone(
    customer.phone ||
      billing.phone ||
      (!String(customer.emailOrPhone || '').includes('@')
        ? customer.emailOrPhone
        : '')
  );

  const documentType = normalizeDocumentType(
    customer.documentType || billing.documentType
  );
  const normalizedPhone = normalizePhone(phoneCandidate, {
    defaultCountry: customer.country || billing.country || 'CO',
  });

  return {
    fullName: fullName || 'Cliente sin nombre',
    displayName: fullName || 'Cliente sin nombre',
    firstName,
    lastName,
    phone: phoneCandidate,
    normalizedPhone,
    email: emailCandidate,
    normalizedEmail: emailCandidate,
    documentType,
    documentNumber,
    normalizedDocument: normalizeDocumentNumber(documentNumber, documentType),
    address: cleanText(customer.address || billing.address, 250),
    city: cleanText(customer.city || billing.city, 100),
    department: cleanText(customer.department || billing.department, 100),
    country: cleanUpper(customer.country || billing.country || 'CO', 80) || 'CO',
    postalCode: cleanText(customer.postalCode || billing.postalCode, 40),
    source: cleanLower(source || raw.source, 40) === 'pos' ? 'pos' : 'web',
    status: 'active',
    acceptsMarketing: customer.wantsNewsletter === true,
    defaultBranch: raw.branch || null,
    branchIds: raw.branch ? [raw.branch] : [],
    fiscalProfile: {
      personType: cleanLower(billing.personType, 20),
      businessName: cleanText(billing.businessName, 180),
      verificationDigit: onlyDigits(billing.dv).slice(0, 1),
      municipalityCode: cleanText(
        billing.municipalityCode || billing.cityCode,
        20
      ),
      departmentCode: cleanText(billing.departmentCode, 20),
      countryCode: cleanUpper(
        billing.countryCode || billing.country || customer.country || 'CO',
        2
      ),
      tributeCode: cleanUpper(billing.tributeCode || 'ZZ', 20),
      taxRegime: cleanText(billing.taxRegime, 100),
      taxResponsibilities: Array.isArray(billing.taxResponsibilities)
        ? billing.taxResponsibilities
            .map((item) => cleanUpper(item, 40))
            .filter(Boolean)
        : [],
    },
  };
}

function hasCustomerIdentity(payload = {}) {
  const identity = buildCustomerIdentity(payload);
  return Boolean(
    identity.normalizedEmail ||
      identity.normalizedPhone ||
      identity.normalizedDocument
  );
}

function applyCustomerResolutionToOrderData(orderData = {}, resolution = {}) {
  if (!resolution?.customer || !resolution?.snapshot) return orderData;

  return {
    ...orderData,
    customer: {
      ...(orderData.customer || {}),
      ...resolution.snapshot,
    },
    customerRelationship: {
      ...(orderData.customerRelationship || {}),
      linkedAt: new Date(),
      source: cleanLower(orderData.source, 40) === 'pos' ? 'pos' : 'web',
      matchedBy: resolution.matchedBy || '',
      statsAppliedAt: orderData?.customerRelationship?.statsAppliedAt || null,
    },
  };
}

module.exports = {
  applyCustomerResolutionToOrderData,
  buildCustomerPayloadFromOrder,
  cleanLower,
  cleanText,
  cleanUpper,
  getRawOrder,
  hasCustomerIdentity,
  isConfirmedOrder,
  isDemoOrder,
  normalizePhone,
  onlyDigits,
};
