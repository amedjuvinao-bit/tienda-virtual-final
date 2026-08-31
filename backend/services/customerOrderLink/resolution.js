'use strict';

const mongoose = require('mongoose');

const Customer = require('../../models/Customer');
const {
  buildCustomerPayloadFromOrder,
  getRawOrder,
  hasCustomerIdentity,
  isDemoOrder,
} = require('./normalization');
const {
  fillMissingCustomerFields,
  findCustomerMatch,
  withSession,
} = require('./matching');

function createCustomerLinkError(message, code, statusCode = 409, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

async function resolveCustomerForOrder(
  orderData = {},
  {
    session = null,
    source = '',
    createIfMissing = true,
    CustomerModel = Customer,
  } = {}
) {
  const raw = getRawOrder(orderData);

  if (isDemoOrder(raw)) {
    return { skipped: true, reason: 'demo_order', customer: null };
  }

  const payload = buildCustomerPayloadFromOrder(raw, { source });
  const linkedCustomerId = raw?.customer?.customerId;
  let match = null;

  if (
    linkedCustomerId &&
    mongoose.Types.ObjectId.isValid(String(linkedCustomerId))
  ) {
    const customer = await withSession(
      CustomerModel.findOne({
        _id: linkedCustomerId,
        deletedAt: null,
      }),
      session
    );
    if (customer) match = { customer, matchedBy: 'customer_id' };
  }

  if (!match) {
    match = await findCustomerMatch(payload, {
      session,
      CustomerModel,
    });
  }

  if (match?.customer) {
    const conflictingMatch = await findCustomerMatch(payload, {
      session,
      excludeId: match.customer._id,
      CustomerModel,
    });
    if (conflictingMatch?.customer) {
      throw createCustomerLinkError(
        'Los datos de la orden coinciden con más de una ficha de cliente. Corrige la identidad antes de continuar.',
        'CUSTOMER_IDENTITY_CONFLICT',
        409,
        {
          primaryCustomerId: String(match.customer._id),
          conflictingCustomerId: String(conflictingMatch.customer._id),
          matchedBy: match.matchedBy,
          conflictingBy: conflictingMatch.matchedBy,
        }
      );
    }

    if (fillMissingCustomerFields(match.customer, payload)) {
      await match.customer.save({ session });
    }

    return {
      skipped: false,
      created: false,
      customer: match.customer,
      snapshot: match.customer.toOrderSnapshot(),
      matchedBy: match.matchedBy,
    };
  }

  if (!createIfMissing || !hasCustomerIdentity(payload)) {
    return {
      skipped: true,
      reason: 'customer_identity_required',
      customer: null,
    };
  }

  const created = await CustomerModel.create([payload], { session });
  const customer = created[0];

  return {
    skipped: false,
    created: true,
    customer,
    snapshot: customer.toOrderSnapshot(),
    matchedBy: 'created',
  };
}

module.exports = {
  createCustomerLinkError,
  resolveCustomerForOrder,
};
