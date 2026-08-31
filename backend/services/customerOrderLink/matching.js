'use strict';

const mongoose = require('mongoose');

const Customer = require('../../models/Customer');
const {
  buildCustomerIdentity,
} = require('../../lib/customers/customerIdentity');

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
  const identity = buildCustomerIdentity(payload);
  const document = identity.normalizedDocument;
  const email = identity.normalizedEmail;
  const phone = identity.normalizedPhone;
  const candidates = [
    document
      ? {
          matchedBy: 'document',
          filter: {
            ...base,
            normalizedDocument: document,
            ...(payload.documentType
              ? { documentType: identity.documentType }
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

  const fiscalFields = [
    'personType',
    'businessName',
    'verificationDigit',
    'municipalityCode',
    'departmentCode',
    'countryCode',
    'tributeCode',
    'taxRegime',
  ];
  const currentFiscal = customer.fiscalProfile || {};
  const incomingFiscal = payload.fiscalProfile || {};
  for (const field of fiscalFields) {
    if (!currentFiscal[field] && incomingFiscal[field]) {
      currentFiscal[field] = incomingFiscal[field];
      changed = true;
    }
  }
  customer.fiscalProfile = currentFiscal;

  if (payload.defaultBranch) {
    const existingBranchIds = Array.isArray(customer.branchIds)
      ? customer.branchIds.map(String)
      : [];
    const branchId = String(payload.defaultBranch);
    if (!existingBranchIds.includes(branchId)) {
      customer.branchIds = [...(customer.branchIds || []), payload.defaultBranch];
      changed = true;
    }
  }

  return changed;
}

module.exports = {
  fillMissingCustomerFields,
  findCustomerMatch,
  withSession,
};
