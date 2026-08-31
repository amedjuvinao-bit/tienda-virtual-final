const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const {
  applyCustomerStatsForOrder,
  syncCustomerMasterFromOrder,
} = require('../services/customerOrderLinkService');
const {
  buildOrderOperationFilter,
  sendOrderScopeError,
} = require('../services/orderRouteAccessService');
const {
  sanitizeAdminOrderDetail,
} = require('../services/orderAdminDetailPresentationService');

const ORDER_CUSTOMER_EDITABLE_FIELDS = new Set([
  'name',
  'lastname',
  'id',
  'documentType',
  'emailOrPhone',
  'email',
  'phone',
  'address',
  'city',
  'municipalityCode',
  'municipalityId',
  'municipality_id',
  'postalCode',
  'country',
  'countryCode',
  'department',
  'departmentCode',
  'deliveryType',
  'wantsNewsletter',
]);

const ORDER_BILLING_EDITABLE_FIELDS = new Set([
  'useSameAddress',
  'isFinalConsumer',
  'personType',
  'firstName',
  'lastName',
  'name',
  'lastname',
  'id',
  'documentNumber',
  'documentType',
  'dv',
  'businessName',
  'address',
  'city',
  'cityCode',
  'municipalityCode',
  'department',
  'departmentCode',
  'postalCode',
  'phone',
  'email',
  'extra',
  'country',
  'countryCode',
  'tributeCode',
]);

const ORDER_PARTY_BOOLEAN_FIELDS = new Set([
  'useSameAddress',
  'isFinalConsumer',
  'wantsNewsletter',
]);

const ORDER_PERSON_TYPES = new Set(['natural', 'juridica']);
const ORDER_DOCUMENT_TYPES = new Set([
  'RC',
  'TI',
  'CC',
  'TE',
  'CE',
  'NIT',
  'PP',
  'DIE',
  'PEP',
  'PPT',
  'NIT_EXTRANJERO',
  'NUIP',
]);

function sanitizeOrderPartyPatch(value, allowedFields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const result = {};

  for (const [field, rawValue] of Object.entries(value)) {
    if (!allowedFields.has(field)) continue;

    if (ORDER_PARTY_BOOLEAN_FIELDS.has(field)) {
      if (typeof rawValue === 'boolean') result[field] = rawValue;
      continue;
    }

    if (
      rawValue !== null &&
      typeof rawValue !== 'string' &&
      typeof rawValue !== 'number'
    ) continue;

    result[field] = String(rawValue ?? '').trim().slice(0, 180);
  }

  return Object.keys(result).length ? result : null;
}

async function updateOrderCustomerData(req, res) {
  const session = await mongoose.startSession();

  try {
    const id = req.params.id;
    const syncCustomer = req.body?.syncCustomer === true;

    const customer = sanitizeOrderPartyPatch(
      req.body?.customer,
      ORDER_CUSTOMER_EDITABLE_FIELDS
    );

    const billing = sanitizeOrderPartyPatch(
      req.body?.billing,
      ORDER_BILLING_EDITABLE_FIELDS
    );

    if (customer?.documentType) {
      customer.documentType = customer.documentType.toUpperCase();
      if (!ORDER_DOCUMENT_TYPES.has(customer.documentType)) {
        return res.status(400).json({
          error: 'CUSTOMER_DOCUMENT_TYPE_INVALID',
          message: 'Selecciona un tipo de documento válido para el comprador.',
        });
      }
    }

    if (billing?.personType) {
      billing.personType = billing.personType.toLowerCase();
      if (!ORDER_PERSON_TYPES.has(billing.personType)) {
        return res.status(400).json({
          error: 'BILLING_PERSON_TYPE_INVALID',
          message: 'Selecciona un tipo de persona válido.',
        });
      }
    }

    if (billing?.documentType) {
      billing.documentType = billing.documentType.toUpperCase();
      if (!ORDER_DOCUMENT_TYPES.has(billing.documentType)) {
        return res.status(400).json({
          error: 'BILLING_DOCUMENT_TYPE_INVALID',
          message: 'Selecciona un tipo de documento fiscal válido.',
        });
      }
    }

    if (
      billing?.personType === 'juridica' &&
      billing?.documentType &&
      billing.documentType !== 'NIT'
    ) {
      return res.status(400).json({
        error: 'BILLING_COMPANY_DOCUMENT_TYPE_INVALID',
        message: 'Una persona jurídica debe identificarse con NIT.',
      });
    }

    if (!customer && !billing) {
      return res.status(400).json({
        error: 'CUSTOMER_DATA_REQUIRED',
        message: 'No se recibieron campos editables de cliente o facturación.',
      });
    }

    const access = buildOrderOperationFilter(req, id, {
      requireWholeOrder: true,
    });

    if (!access.ok) return sendOrderScopeError(res, access);

    let order = null;
    let linkedCustomer = null;

    await session.withTransaction(async () => {
      order = await Order.findOne(access.filter).session(session);

      if (!order) {
        throw Object.assign(new Error('Orden no encontrada.'), {
          code: 'ORDER_NOT_FOUND',
          statusCode: 404,
        });
      }

      const beforeCustomer = order.customer?.toObject
        ? order.customer.toObject()
        : order.customer || {};
      const beforeBilling = order.billing?.toObject
        ? order.billing.toObject()
        : order.billing || {};

      if (customer) {
        order.customer = {
          ...beforeCustomer,
          ...customer,
        };
      }

      if (billing) {
        order.billing = {
          ...beforeBilling,
          ...billing,
        };
      }

      if (syncCustomer) {
        const result = await syncCustomerMasterFromOrder(order, {
          session,
          updatedByAdmin:
            req.adminUserId || req.user?._id || req.user?.id || null,
        });
        linkedCustomer = result.customer;
      }

      await order.save({ session });
      await applyCustomerStatsForOrder(order, { session });

      await OrderEvent.create(
        [
          {
            orderId: order._id,
            type: 'customer_data_updated',
            message: syncCustomer
              ? 'Datos actualizados en la orden y en la ficha del cliente'
              : 'Datos actualizados únicamente en la orden',
            meta: {
              customerFields: customer ? Object.keys(customer) : [],
              billingFields: billing ? Object.keys(billing) : [],
              syncCustomer,
              customerId: linkedCustomer?._id || order.customer?.customerId || null,
              by: req.adminUsername || req.adminUserId || 'admin',
            },
          },
        ],
        { session }
      );
    });

    return res.json({
      ok: true,
      customer: order.customer,
      billing: order.billing,
      customerRelationship: order.customerRelationship,
      linkedCustomer: linkedCustomer
        ? {
            id: String(linkedCustomer._id),
            customerCode: linkedCustomer.customerCode || '',
          }
        : null,
      order: sanitizeAdminOrderDetail(order.toObject({ virtuals: true })),
    });
  } catch (error) {
    console.error('PATCH /orders/:id/customer-data', error);

    return res.status(error.statusCode || error.status || 500).json({
      error: error.code || 'CUSTOMER_DATA_UPDATE_ERROR',
      message:
        error.message || 'No fue posible actualizar los datos del cliente.',
      details: error.details || undefined,
    });
  } finally {
    await session.endSession();
  }
}

module.exports = {
  ORDER_BILLING_EDITABLE_FIELDS,
  ORDER_CUSTOMER_EDITABLE_FIELDS,
  ORDER_DOCUMENT_TYPES,
  ORDER_PERSON_TYPES,
  sanitizeOrderPartyPatch,
  updateOrderCustomerData,
};
