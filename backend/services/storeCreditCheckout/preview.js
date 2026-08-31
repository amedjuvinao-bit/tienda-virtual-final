'use strict';

const Customer = require('../../models/Customer');
const StoreCredit = require('../../models/StoreCredit');
const { getCartAccessSecret } = require('../cartAccessService');
const { issueStoreCreditAccess } = require('./access');
const { STORE_CREDIT_ACCESS_TTL_MS } = require('./constants');
const {
  cleanLower,
  cleanMoney,
  cleanPhone,
  cleanText,
  cleanUpper,
  customerKey,
  onlyDigits,
} = require('./normalization');

function contactFilters({ emailOrPhone = '', phone = '' } = {}) {
  const rawContact = cleanText(emailOrPhone, 220);
  const email = rawContact.includes('@') ? cleanLower(rawContact, 220) : '';
  const normalizedPhone = cleanPhone(phone || (!email ? rawContact : ''));
  return [
    email ? { normalizedEmail: email } : null,
    normalizedPhone && normalizedPhone.replace(/\D/g, '').length >= 7
      ? { normalizedPhone }
      : null,
  ].filter(Boolean);
}

async function previewCustomerStoreCredit(
  {
    documentNumber,
    emailOrPhone,
    phone,
    sessionId,
    currency = 'COP',
    now = new Date(),
  } = {},
  {
    CustomerModel = Customer,
    StoreCreditModel = StoreCredit,
    secret = getCartAccessSecret(),
  } = {}
) {
  const document = onlyDigits(documentNumber);
  const contacts = contactFilters({ emailOrPhone, phone });
  const safeCurrency = cleanUpper(currency || 'COP', 12) || 'COP';
  if (document.length < 4 || !contacts.length) {
    return { eligible: false, balance: 0, currency: safeCurrency };
  }

  const customer = await CustomerModel.findOne({
    normalizedDocument: document,
    deletedAt: null,
    active: true,
    $or: contacts,
  }).lean();
  if (!customer) {
    return { eligible: false, balance: 0, currency: safeCurrency };
  }

  const credits = await StoreCreditModel.find({
    customerKey: customerKey(customer._id),
    currency: safeCurrency,
    status: 'active',
    balance: { $gt: 0 },
    expiresAt: { $gt: now },
  })
    .sort({ expiresAt: 1, issuedAt: 1 })
    .select('balance expiresAt')
    .lean();
  const balance = cleanMoney(
    credits.reduce((sum, credit) => sum + cleanMoney(credit.balance), 0)
  );
  if (balance <= 0) {
    return { eligible: false, balance: 0, currency: safeCurrency };
  }

  const expiresAt = new Date(now.getTime() + STORE_CREDIT_ACCESS_TTL_MS);
  return {
    eligible: true,
    balance,
    currency: safeCurrency,
    accessToken: issueStoreCreditAccess(
      { customerId: customer._id, sessionId, currency: safeCurrency, expiresAt },
      { secret }
    ),
    accessExpiresAt: expiresAt,
    nearestCreditExpiration: credits[0]?.expiresAt || null,
  };
}

module.exports = { previewCustomerStoreCredit };
