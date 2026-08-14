'use strict';

const mongoose = require('mongoose');

const Customer = require('../models/Customer');

const CONFIRMED_ORDER_STATUSES = new Set([
  'paid',
  'shipped',
  'delivered',
  'refunded',
]);

function cleanText(value, max = 250) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 250) {
  return cleanText(value, max).toLowerCase();
}

function cleanUpper(value, max = 80) {
  return cleanText(value, max).toUpperCase();
}

function onlyDigits(value) {
  return cleanText(value, 80).replace(/\D/g, '');
}

function normalizePhone(value) {
  return cleanText(value, 80).replace(/[^0-9+]/g, '');
}

function normalizeDocumentType(value) {
  const normalized = cleanUpper(value, 40);
  const aliases = {
    CEDULA: 'CC',
    'CÉDULA': 'CC',
    PASAPORTE: 'PP',
    NIT: 'NIT',
  };
  const resolved = aliases[normalized] || normalized;
  return ['CC', 'CE', 'NIT', 'TI', 'PP', 'RC', 'DNI', 'OTHER', ''].includes(resolved)
    ? resolved
    : resolved
      ? 'OTHER'
      : '';
}

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
  const phoneCandidate = normalizePhone(
    customer.phone ||
      billing.phone ||
      (!String(customer.emailOrPhone || '').includes('@')
        ? customer.emailOrPhone
        : '')
  );

  return {
    fullName: fullName || 'Cliente sin nombre',
    displayName: fullName || 'Cliente sin nombre',
    firstName,
    lastName,
    phone: phoneCandidate,
    normalizedPhone: phoneCandidate,
    email: emailCandidate,
    normalizedEmail: emailCandidate,
    documentType: normalizeDocumentType(
      customer.documentType || billing.documentType
    ),
    documentNumber,
    normalizedDocument: onlyDigits(documentNumber),
    address: cleanText(customer.address || billing.address, 250),
    city: cleanText(customer.city || billing.city, 100),
    department: cleanText(customer.department || billing.department, 100),
    country: cleanUpper(customer.country || billing.country || 'CO', 80) || 'CO',
    postalCode: cleanText(customer.postalCode || billing.postalCode, 40),
    source: cleanLower(source || raw.source, 40) === 'pos' ? 'pos' : 'web',
    status: 'active',
    acceptsMarketing: customer.wantsNewsletter === true,
    defaultBranch: raw.branch || null,
  };
}

function hasCustomerIdentity(payload = {}) {
  return Boolean(
    cleanLower(payload.normalizedEmail || payload.email, 180) ||
      normalizePhone(payload.normalizedPhone || payload.phone) ||
      onlyDigits(payload.normalizedDocument || payload.documentNumber)
  );
}

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

async function applyCustomerStatsForOrder(
  order,
  { session = null, CustomerModel = Customer } = {}
) {
  if (
    !order?._id ||
    !order?.customer?.customerId ||
    order?.customerRelationship?.statsAppliedAt ||
    isDemoOrder(order) ||
    !isConfirmedOrder(order)
  ) {
    return { applied: false };
  }

  const customerId = order.customer.customerId;
  const now = new Date();
  const source = cleanLower(order.source, 40) === 'pos' ? 'pos' : 'web';
  const customer = await withSession(
    CustomerModel.findOne({ _id: customerId, deletedAt: null }),
    session
  );
  if (!customer) return { applied: false, reason: 'customer_not_found' };

  const update = {
    $inc: {
      'stats.ordersCount': 1,
      [`stats.${source}OrdersCount`]: 1,
      'stats.totalSpent': Math.max(0, Number(order.total || 0)),
    },
    $set: {
      'stats.lastOrder': order._id,
      'stats.lastOrderNumber': cleanText(order.orderNumber, 80),
      'stats.lastPurchaseAt': order.payment?.paidAt || order.createdAt || now,
      'stats.firstPurchaseAt':
        customer.stats?.firstPurchaseAt ||
        order.payment?.paidAt ||
        order.createdAt ||
        now,
    },
  };

  await CustomerModel.updateOne({ _id: customerId }, update, { session });
  order.customerRelationship = {
    ...(order.customerRelationship?.toObject
      ? order.customerRelationship.toObject()
      : order.customerRelationship || {}),
    linkedAt: order.customerRelationship?.linkedAt || now,
    source,
    matchedBy: order.customerRelationship?.matchedBy || 'customer_id',
    statsAppliedAt: now,
  };
  await order.save({ session });

  return { applied: true, customerId: String(customerId) };
}

function createCustomerLinkError(message, code, statusCode = 409, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

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
  applyCustomerResolutionToOrderData,
  applyCustomerStatsForOrder,
  buildCustomerPayloadFromOrder,
  findCustomerMatch,
  hasCustomerIdentity,
  isConfirmedOrder,
  isDemoOrder,
  resolveCustomerForOrder,
  syncCustomerMasterFromOrder,
};
