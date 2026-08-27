'use strict';

const mongoose = require('mongoose');

const Customer = require('../../models/Customer');
const {
  buildCustomerPayloadFromOrder,
  cleanLower,
  hasCustomerIdentity,
  isDemoOrder,
} = require('./normalization');
const { findCustomerMatch, withSession } = require('./matching');
const { createCustomerLinkError } = require('./resolution');

async function syncCustomerMasterFromOrder(
  order,
  { session = null, updatedByAdmin = null, CustomerModel = Customer } = {}
) {
  if (isDemoOrder(order)) {
    throw createCustomerLinkError(
      'Las órdenes DEMO pueden corregirse en la orden, pero no crear ni modificar clientes reales.',
      'DEMO_CUSTOMER_SYNC_NOT_ALLOWED',
      422
    );
  }

  const payload = buildCustomerPayloadFromOrder(order, {
    source: order?.source,
  });
  if (!hasCustomerIdentity(payload)) {
    throw createCustomerLinkError(
      'Se necesita correo, celular o documento para vincular la ficha del cliente.',
      'CUSTOMER_IDENTITY_REQUIRED',
      422
    );
  }

  const linkedId = order?.customer?.customerId;
  let customer = null;
  let matchedBy = '';

  if (linkedId && mongoose.Types.ObjectId.isValid(String(linkedId))) {
    customer = await withSession(
      CustomerModel.findOne({ _id: linkedId, deletedAt: null }),
      session
    );
    matchedBy = customer ? 'customer_id' : '';
  }

  if (customer) {
    const conflict = await findCustomerMatch(payload, {
      session,
      excludeId: customer._id,
      CustomerModel,
    });
    if (conflict?.customer) {
      throw createCustomerLinkError(
        'Los datos coinciden con otra ficha de cliente. Revisa correo, celular o documento.',
        'CUSTOMER_DUPLICATE',
        409,
        {
          existingCustomerId: String(conflict.customer._id),
          matchedBy: conflict.matchedBy,
        }
      );
    }
  } else {
    const match = await findCustomerMatch(payload, {
      session,
      CustomerModel,
    });
    customer = match?.customer || null;
    matchedBy = match?.matchedBy || '';

    if (customer) {
      const conflict = await findCustomerMatch(payload, {
        session,
        excludeId: customer._id,
        CustomerModel,
      });
      if (conflict?.customer) {
        throw createCustomerLinkError(
          'Los datos coinciden con fichas de clientes diferentes. Corrige la identidad antes de sincronizar.',
          'CUSTOMER_IDENTITY_CONFLICT',
          409,
          {
            primaryCustomerId: String(customer._id),
            conflictingCustomerId: String(conflict.customer._id),
            matchedBy,
            conflictingBy: conflict.matchedBy,
          }
        );
      }
    }
  }

  if (!customer) {
    const created = await CustomerModel.create(
      [
        {
          ...payload,
          source: cleanLower(order?.source, 40) === 'pos' ? 'pos' : 'web',
          updatedByAdmin:
            updatedByAdmin && mongoose.Types.ObjectId.isValid(String(updatedByAdmin))
              ? updatedByAdmin
              : null,
        },
      ],
      { session }
    );
    customer = created[0];
    matchedBy = 'created';
  } else {
    const writableFields = [
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
    ];
    writableFields.forEach((field) => {
      customer[field] = payload[field] || '';
    });
    customer.acceptsMarketing = payload.acceptsMarketing === true;
    if (updatedByAdmin && mongoose.Types.ObjectId.isValid(String(updatedByAdmin))) {
      customer.updatedByAdmin = updatedByAdmin;
    }
    await customer.save({ session });
  }

  const snapshot = customer.toOrderSnapshot();
  order.customer = {
    ...(order.customer?.toObject
      ? order.customer.toObject()
      : order.customer || {}),
    ...snapshot,
  };
  order.customerRelationship = {
    ...(order.customerRelationship?.toObject
      ? order.customerRelationship.toObject()
      : order.customerRelationship || {}),
    linkedAt: order.customerRelationship?.linkedAt || new Date(),
    source: cleanLower(order?.source, 40) === 'pos' ? 'pos' : 'web',
    matchedBy,
  };

  return { customer, matchedBy, snapshot };
}

module.exports = {
  syncCustomerMasterFromOrder,
};
