'use strict';

const mongoose = require('mongoose');

const Customer = require('../../models/Customer');
const {
  cleanLower,
  cleanUpper,
  normalizePhone,
  onlyDigits,
} = require('./normalization');

function withSession(query, session) {
  return session && typeof query?.session === 'function'
    ? query.session(session)
    : query;
}

async function findCustomerMatch(
  payload = {},
  { session = null, excludeId = null, CustomerModel = Customer } = {}
) {
  const base = {
    deletedAt: null,
    ...(excludeId && mongoose.Types.ObjectId.isValid(String(excludeId))
      ? { _id: { $ne: new mongoose.Types.ObjectId(String(excludeId)) } }
      : {}),
  };
  const document = onlyDigits(payload.normalizedDocument || payload.documentNumber);
  const email = cleanLower(payload.normalizedEmail || payload.email, 180);
  const phone = normalizePhone(payload.normalizedPhone || payload.phone);
  const candidates = [
    document
      ? {
          matchedBy: 'document',
          filter: {
            ...base,
            normalizedDocument: document,
            ...(payload.documentType
              ? { documentType: cleanUpper(payload.documentType, 40) }
              : {}),
          },
        }
      : null,
    email
      ? {
          matchedBy: 'email',
          filter: { ...base, normalizedEmail: email },
        }
      : null,
    phone
      ? {
          matchedBy: 'phone',
          filter: { ...base, normalizedPhone: phone },
        }
      : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const customer = await withSession(
      CustomerModel.findOne(candidate.filter),
      session
    );
    if (customer) return { customer, matchedBy: candidate.matchedBy };
  }

  return null;
}

function fillMissingCustomerFields(customer, payload = {}) {
  const fields = [
    'firstName',
    'lastName',
    'fullName',
    'displayName',
    'phone',
    'email',
    'documentType',
    'documentNumber',
    'address',
    'city',
    'department',
    'country',
    'postalCode',
    'defaultBranch',
  ];
  let changed = false;

  for (const field of fields) {
    if (!customer[field] && payload[field]) {
      customer[field] = payload[field];
      changed = true;
    }
  }

  if (payload.acceptsMarketing === true && customer.acceptsMarketing !== true) {
    customer.acceptsMarketing = true;
    changed = true;
  }

  return changed;
}

module.exports = {
  fillMissingCustomerFields,
  findCustomerMatch,
  withSession,
};
