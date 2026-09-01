'use strict';

const mongoose = require('mongoose');

const {
  cleanLower,
  cleanText,
  normalizeDocumentNumber,
  normalizePhone,
} = require('../lib/customers/customerIdentity');

function buildCustomerOrdersFilter(customer = {}) {
  const raw = typeof customer.toObject === 'function'
    ? customer.toObject()
    : customer;
  const filters = [];
  const id = String(raw._id || raw.id || '');
  const email = cleanLower(raw.email || '');
  const phone = cleanText(raw.phone || '');
  const documentNumber = cleanText(raw.documentNumber || '');
  const normalizedPhone = normalizePhone(phone, {
    defaultCountry: raw.country || 'CO',
  });
  const normalizedDocument = normalizeDocumentNumber(
    documentNumber,
    raw.documentType
  );

  if (id) filters.push({ 'customer.customerId': id });
  if (email) {
    filters.push(
      { 'customer.email': email },
      { 'billing.email': email }
    );
  }
  if (phone) {
    filters.push(
      { 'customer.phone': phone },
      { 'billing.phone': phone }
    );
  }
  if (normalizedPhone && normalizedPhone !== phone) {
    filters.push(
      { 'customer.phone': normalizedPhone },
      { 'billing.phone': normalizedPhone }
    );
  }
  if (documentNumber) {
    filters.push(
      { 'customer.id': documentNumber },
      { 'billing.id': documentNumber }
    );
  }
  if (normalizedDocument && normalizedDocument !== documentNumber) {
    filters.push(
      { 'customer.id': normalizedDocument },
      { 'billing.id': normalizedDocument }
    );
  }

  if (
    raw.stats?.lastOrder &&
    mongoose.Types.ObjectId.isValid(String(raw.stats.lastOrder))
  ) {
    filters.push({ _id: raw.stats.lastOrder });
  }

  return filters.length > 0 ? { $or: filters } : { _id: null };
}

module.exports = { buildCustomerOrdersFilter };
