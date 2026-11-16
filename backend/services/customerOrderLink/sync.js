'use strict';

const mongoose = require('mongoose');

const Customer = require('../../models/Customer');
const Order = require('../../models/Order');
const { buildCustomerOrdersFilter } = require('../customerOrderIdentityFilter');
const { buildScopedOrderFilter } = require('../orderAdminScopeService');
const {
  buildCustomerIdentity,
  isActiveMongoTransaction,
  isMongoDuplicateKeyError,
} = require('../../lib/customers/customerIdentity');
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
    try {
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
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) throw error;

      if (isActiveMongoTransaction(session)) {
        throw createCustomerLinkError(
          'Otro proceso registró esa identidad al mismo tiempo. Reintenta la sincronización.',
          'CUSTOMER_DUPLICATE',
          409
        );
      }

      const concurrentMatch = await findCustomerMatch(payload, {
        session,
        CustomerModel,
      });
      if (!concurrentMatch?.customer) {
        throw createCustomerLinkError(
          'Otro proceso registró esa identidad al mismo tiempo. Reintenta la sincronización.',
          'CUSTOMER_DUPLICATE',
          409
        );
      }
      customer = concurrentMatch.customer;
      matchedBy = concurrentMatch.matchedBy;
    }
  }

  if (matchedBy !== 'created') {
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
    // Preserve the current, independently recorded marketing decision.
    customer.fiscalProfile = payload.fiscalProfile || customer.fiscalProfile;
    if (!customer.defaultBranch && payload.defaultBranch) {
      customer.defaultBranch = payload.defaultBranch;
    }
    if (payload.defaultBranch) {
      const branchIds = new Set(
        (Array.isArray(customer.branchIds) ? customer.branchIds : []).map(String)
      );
      branchIds.add(String(payload.defaultBranch));
      customer.branchIds = [...branchIds];
    }
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

async function isVerifiedLegacyOrder(order, customer, options) {
  if (isDemoOrder(order)) return false;

  const target = buildCustomerIdentity(customer);
  const snapshots = [
    buildCustomerPayloadFromOrder({ customer: order.customer }),
    buildCustomerPayloadFromOrder({ billing: order.billing }),
  ].filter(hasCustomerIdentity);

  let document = target;
  let matchesCustomer = false;
  for (const snapshot of snapshots) {
    const identity = buildCustomerIdentity(snapshot);
    if (identity.normalizedDocument) {
      if (
        document.normalizedDocument &&
        (document.normalizedDocument !== identity.normalizedDocument ||
          (document.documentType && identity.documentType &&
            document.documentType !== identity.documentType))
      ) {
        return false;
      }
      if (!document.normalizedDocument || !document.documentType) {
        document = identity;
      }
    }

    const conflictingMatch = await findCustomerMatch(snapshot, {
      ...options,
      excludeId: customer._id,
    });
    if (conflictingMatch) return false;

    matchesCustomer = matchesCustomer || Boolean(
      (identity.normalizedDocument && identity.normalizedDocument === target.normalizedDocument) ||
      (identity.normalizedEmail && identity.normalizedEmail === target.normalizedEmail) ||
      (identity.normalizedPhone && identity.normalizedPhone === target.normalizedPhone)
    );
  }
  return matchesCustomer;
}

async function preserveLegacyCustomerOrderLinks(
  req,
  customer,
  { session, OrderModel = Order, CustomerModel = Customer } = {}
) {
  const access = buildScopedOrderFilter(
    req,
    {
      $and: [
        buildCustomerOrdersFilter(customer),
        { 'customer.customerId': null },
      ],
    },
    { requestedBranchId: '', requireWholeOrder: true }
  );

  if (!access.ok) {
    throw createCustomerLinkError(access.message, access.error, access.status);
  }

  const orders = OrderModel.find(access.filter)
    .select('customer billing source tags')
    .session(session)
    .lean()
    .cursor();

  try {
    for await (const order of orders) {
      const verified = await isVerifiedLegacyOrder(order, customer, {
        session,
        CustomerModel,
      });
      if (!verified) continue;

      const link = order.customer == null
        ? { customer: { customerId: customer._id } }
        : { 'customer.customerId': customer._id };
      const result = await OrderModel.updateOne(
        { ...access.filter, _id: order._id },
        { $set: link },
        { session, timestamps: false }
      );
      if (result.matchedCount !== 1) {
        throw createCustomerLinkError(
          'Una orden cambió al vincular el historial. Recarga la ficha y vuelve a intentarlo.',
          'CUSTOMER_LEGACY_ORDER_LINK_CHANGED'
        );
      }
    }
  } finally {
    await orders.close();
  }
}

module.exports = {
  preserveLegacyCustomerOrderLinks,
  syncCustomerMasterFromOrder,
};
