// backend/services/adminPosService.js

const crypto = require('crypto');
const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const Customer = require('../models/Customer');
const {
  applyCustomerStatsForOrder,
  findCustomerMatch,
} = require('./customerOrderLinkService');
const Counter = require('../models/Counter');
const {
  processFulfillmentOnce,
} = require('./orderCreationPostCommitService');
const {
  getPublicFulfillmentView,
} = require('../lib/products/productFulfillmentConfig');
const {
  normalizeAttributes,
  resolveVariantIdentity,
} = require('../lib/products/productVariantConfig');
const {
  normalizeProductCustoms,
} = require('../lib/products/productCustomsConfig');
const {
  isActiveMongoTransaction,
  isMongoDuplicateKeyError,
} = require('../lib/customers/customerIdentity');

const POS_PAYMENT_METHODS = ['cash', 'transfer', 'card', 'mixed', 'other'];
const DEFAULT_CURRENCY = 'COP';
const DEFAULT_POS_CUSTOMER_NAME = 'Consumidor final';
const DEFAULT_MAX_DISCOUNT_PERCENT = 20;

function createPosError(message, code, details = {}, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 300) {
  return cleanText(value, max).toLowerCase();
}

function cleanUpper(value, max = 300) {
  return cleanText(value, max).toUpperCase();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toMoney(value) {
  return Math.max(0, Math.round(toNumber(value, 0)));
}

function toQty(value) {
  return Math.max(1, Math.floor(toNumber(value, 0)));
}

function getObjectIdValue(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value);
  return String(value);
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function toObjectId(value, fieldName = 'id') {
  const cleanValue = getObjectIdValue(value);

  if (!isValidObjectId(cleanValue)) {
    throw createPosError(
      `El campo ${fieldName} no tiene un ObjectId válido.`,
      'POS_INVALID_OBJECT_ID',
      { field: fieldName, value: cleanValue },
      400
    );
  }

  return new mongoose.Types.ObjectId(cleanValue);
}

function getProductImage(product = {}) {
  if (product.image) return product.image;

  if (Array.isArray(product.images) && product.images.length > 0) {
    const coverImage = product.images.find((image) => image?.isCover);
    if (coverImage?.url) return coverImage.url;
    if (typeof product.images[0] === 'string') return product.images[0];
    if (product.images[0]?.url) return product.images[0].url;
  }

  return '';
}

function getServerUnitPrice(product = {}) {
  const price = toMoney(product.price);

  if (price <= 0) {
    throw createPosError(
      `El producto ${product.title || ''} no tiene un precio válido para vender en POS.`,
      'POS_INVALID_PRODUCT_PRICE',
      {
        productId: String(product._id || ''),
        title: product.title || '',
        price: product.price,
      },
      409
    );
  }

  return price;
}

function buildProductSnapshot(product = {}, fallback = {}) {
  return {
    title: cleanText(product.title || fallback.title || fallback.name || '', 220),
    sku: cleanUpper(product.sku || fallback.sku || '', 80),
    image: cleanText(getProductImage(product) || fallback.image || '', 1000),
    category: cleanText(product.category || fallback.category || '', 120),
  };
}

function buildBranchSnapshot(branch = {}) {
  return {
    name: cleanText(branch.name || '', 160),
    code: cleanUpper(branch.code || '', 40),
    type: cleanLower(branch.type || '', 40),
  };
}

function buildAdminSnapshot(admin = {}) {
  return {
    username: cleanLower(admin.username || admin.adminUsername || admin.email || '', 120),
    displayName: cleanText(
      admin.displayName || admin.fullName || admin.name || admin.username || admin.adminUsername || '',
      160
    ),
    role: cleanLower(admin.role || '', 80),
    adminRole: cleanLower(admin.adminRole || admin.role || '', 80),
  };
}

function normalizePosItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createPosError(
      'La venta POS necesita al menos un producto.',
      'POS_EMPTY_ITEMS',
      {},
      400
    );
  }

  return items.map((item, index) => {
    const productId =
      getObjectIdValue(item.productId) ||
      getObjectIdValue(item.product) ||
      getObjectIdValue(item._id) ||
      getObjectIdValue(item.id);

    if (!productId || !isValidObjectId(productId)) {
      throw createPosError(
        `El producto de la posición ${index + 1} no tiene un ID válido.`,
        'POS_INVALID_PRODUCT_ID',
        { index, productId },
        400
      );
    }

    const quantity = toQty(item.quantity ?? item.qty ?? item.cantidad);
    const unitPrice = toMoney(item.unitPrice ?? item.price ?? item.precio);
    const size = cleanText(item.size || item.talla || item.variant?.size || '', 80);
    const color = cleanText(item.color || item.variant?.color || '', 120);
    const variantAttributes = normalizeAttributes(
      item.variantAttributes ||
        item.attributes ||
        item.variant?.attributes ||
        []
    );

    const variantIdentity = resolveVariantIdentity({
      variantKey: item.variantKey || item.variantId,
      size,
      color,
      attributes: variantAttributes,
    });

    return {
      index,
      productId,
      productObjectId: toObjectId(productId, `items[${index}].productId`),
      quantity,
      unitPrice,
      lineSubtotal: quantity * unitPrice,
      size: variantIdentity.size,
      color: variantIdentity.color,
      variantKey: variantIdentity.variantKey,
      variantLabel: cleanText(
        item.variantLabel || item.variant?.label || '',
        160
      ),
      variantAttributes: variantIdentity.attributes,
      title: cleanText(item.title || item.name || '', 220),
      sku: cleanUpper(item.sku || '', 100),
      barcode: cleanText(item.barcode || '', 120),
      image: cleanText(item.image || '', 1000),
      category: cleanText(item.category || '', 120),
    };
  });
}

function normalizePaymentPayload(payment = {}, total = 0) {
  const method = cleanLower(payment.method || payment.methodType || 'cash', 40);
  const safeTotal = toMoney(total);

  if (!POS_PAYMENT_METHODS.includes(method)) {
    throw createPosError(
      'El medio de pago seleccionado no está habilitado para POS.',
      'POS_PAYMENT_METHOD_INVALID',
      { method },
      400
    );
  }

  const safeMethod = method;
  const amount = toMoney(payment.amount ?? safeTotal);
  const receivedAmount = toMoney(payment.receivedAmount ?? payment.received ?? amount);
  const splitPayments = Array.isArray(payment.splitPayments)
    ? payment.splitPayments
        .map((split) => {
          const splitMethod = cleanLower(split.method || 'other', 40);
          const splitAmount = toMoney(split.amount);
          const splitReceived = toMoney(split.receivedAmount ?? splitAmount);

          if (!POS_PAYMENT_METHODS.includes(splitMethod) || splitMethod === 'mixed') {
            throw createPosError(
              'El pago mixto contiene un medio no permitido.',
              'POS_SPLIT_PAYMENT_METHOD_INVALID',
              { method: splitMethod },
              400
            );
          }

          return {
            method: splitMethod,
            methodLabel: cleanText(split.methodLabel || splitMethod, 80),
            amount: splitAmount,
            reference: cleanText(split.reference || '', 120),
            receivedAmount: splitMethod === 'cash' ? splitReceived : splitAmount,
            changeAmount: splitMethod === 'cash' ? Math.max(0, splitReceived - splitAmount) : 0,
          };
        })
        .filter((split) => split.amount > 0)
    : [];

  const splitTotal = splitPayments.reduce((sum, split) => sum + split.amount, 0);

  if (safeMethod === 'mixed' && splitPayments.length < 2) {
    throw createPosError(
      'El pago mixto debe distribuirse entre al menos dos medios.',
      'POS_SPLIT_PAYMENT_METHODS_REQUIRED',
      { splitCount: splitPayments.length },
      400
    );
  }

  if (safeMethod === 'mixed' && splitTotal !== safeTotal) {
    throw createPosError(
      'La suma del pago mixto debe ser igual al total de la venta.',
      'POS_INVALID_SPLIT_PAYMENT_TOTAL',
      { splitTotal, total: safeTotal },
      400
    );
  }

  if (safeMethod !== 'mixed' && amount !== safeTotal) {
    throw createPosError(
      'El valor aplicado al medio de pago debe coincidir con el total de la venta.',
      'POS_PAYMENT_AMOUNT_MISMATCH',
      { amount, total: safeTotal },
      400
    );
  }

  if (safeMethod === 'cash' && receivedAmount < safeTotal) {
    throw createPosError(
      'El efectivo recibido no cubre el total de la venta.',
      'POS_PAYMENT_RECEIVED_TOO_LOW',
      { receivedAmount, total: safeTotal },
      400
    );
  }

  const referenceRequiredMethods = new Set(['transfer', 'card', 'other']);
  const reference = cleanText(payment.reference || '', 120);

  if (referenceRequiredMethods.has(safeMethod) && reference.length < 3) {
    throw createPosError(
      'El medio de pago requiere una referencia o soporte verificable.',
      'POS_PAYMENT_REFERENCE_REQUIRED',
      { method: safeMethod },
      400
    );
  }

  const invalidSplit = splitPayments.find((split) => (
    (split.method === 'cash' && split.receivedAmount < split.amount) ||
    (referenceRequiredMethods.has(split.method) && split.reference.length < 3)
  ));

  if (safeMethod === 'mixed' && invalidSplit) {
    const cashUnderpaid = invalidSplit.method === 'cash' && invalidSplit.receivedAmount < invalidSplit.amount;
    throw createPosError(
      cashUnderpaid
        ? 'El efectivo recibido no cubre la parte en efectivo del pago mixto.'
        : 'Cada medio electrónico del pago mixto requiere una referencia verificable.',
      cashUnderpaid ? 'POS_SPLIT_CASH_RECEIVED_TOO_LOW' : 'POS_SPLIT_PAYMENT_REFERENCE_REQUIRED',
      { method: invalidSplit.method },
      400
    );
  }

  return {
    method: safeMethod,
    methodType: safeMethod,
    methodLabel: cleanText(payment.methodLabel || safeMethod, 80),
    amount: safeMethod === 'mixed' ? splitTotal : amount,
    receivedAmount: safeMethod === 'cash' ? receivedAmount : amount,
    changeAmount: safeMethod === 'cash' ? Math.max(0, receivedAmount - safeTotal) : 0,
    reference,
    splitPayments,
  };
}

function normalizeDiscountPayload(discount = {}, subtotal = 0) {
  const type = cleanLower(discount.type || 'none', 20);
  const safeType = ['none', 'percent', 'amount'].includes(type) ? type : 'none';
  const value = toMoney(discount.value || 0);
  const safeSubtotal = toMoney(subtotal);

  let amount = 0;

  if (safeType === 'percent') {
    const percent = Math.min(100, value);
    amount = Math.round((safeSubtotal * percent) / 100);
  }

  if (safeType === 'amount') {
    amount = Math.min(safeSubtotal, value);
  }

  return {
    type: amount > 0 ? safeType : 'none',
    value: amount > 0 ? value : 0,
    amount,
    reason: cleanText(discount.reason || '', 240),
    authorizedBy: getObjectIdValue(discount.authorizedBy) || null,
    authorizedBySnapshot: buildAdminSnapshot(discount.authorizedBySnapshot || {}),
  };
}

function calculateTax({ taxableBase = 0, taxes = {} } = {}) {
  const ivaEnabled = taxes?.iva?.enabled === true;
  const ivaPercent = Math.max(0, Math.min(100, toNumber(taxes?.iva?.percent, 0)));
  const ivaAmount = ivaEnabled && ivaPercent > 0 ? Math.round((toMoney(taxableBase) * ivaPercent) / 100) : 0;

  return {
    iva: {
      enabled: ivaEnabled,
      percent: ivaPercent,
      code: cleanText(taxes?.iva?.code || '01', 20),
      name: cleanText(taxes?.iva?.name || 'IVA', 80),
      amount: ivaAmount,
    },
  };
}

function calculateTotalsFromNormalizedItems({ items = [], discount = {}, taxes = {} } = {}) {
  const subtotal = items.reduce((sum, item) => sum + toMoney(item.lineSubtotal), 0);
  const normalizedDiscount = normalizeDiscountPayload(discount, subtotal);
  const taxableBase = Math.max(0, subtotal - normalizedDiscount.amount);
  const normalizedTaxes = calculateTax({ taxableBase, taxes });
  const total = Math.max(0, taxableBase + normalizedTaxes.iva.amount);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    summary: {
      itemsCount: items.length,
      totalItems,
      subtotal,
    },
    subtotal,
    discount: normalizedDiscount,
    taxes: normalizedTaxes,
    shipping: 0,
    total,
  };
}

function calculatePosTotals({ items = [], discount = {}, taxes = {} } = {}) {
  const normalizedItems = normalizePosItems(items);
  return calculateTotalsFromNormalizedItems({
    items: normalizedItems,
    discount,
    taxes,
  });
}

function normalizePosCustomer(customer = {}, fallbackName = DEFAULT_POS_CUSTOMER_NAME) {
  const fullName = cleanText(
    customer.fullName || customer.displayName || customer.name || fallbackName,
    160
  );

  return {
    name: fullName || fallbackName,
    lastname: cleanText(customer.lastname || customer.lastName || '', 120),
    id: cleanText(customer.id || customer.documentNumber || customer.document || customer.identification || '', 40),
    documentType: cleanUpper(customer.documentType || '', 40),
    emailOrPhone: cleanText(customer.emailOrPhone || customer.email || customer.phone || '', 180),
    email: cleanLower(customer.email || '', 180),
    phone: cleanText(customer.phone || customer.cellphone || customer.mobile || '', 60),
    address: cleanText(customer.address || '', 250),
    city: cleanText(customer.city || '', 100),
    department: cleanText(customer.department || '', 100),
    postalCode: cleanText(customer.postalCode || '', 40),
    country: cleanUpper(customer.country || 'CO', 80) || 'CO',
    deliveryType: 'store',
    wantsNewsletter: customer.wantsNewsletter === true || customer.acceptsMarketing === true,
  };
}

function buildGuestCustomerSnapshot() {
  return normalizePosCustomer({ fullName: DEFAULT_POS_CUSTOMER_NAME, country: 'CO' });
}

function buildCustomerOrderSnapshot(customer = {}) {
  const raw = typeof customer.toObject === 'function' ? customer.toObject() : customer;

  return normalizePosCustomer({
    fullName: raw.fullName || raw.displayName || '',
    phone: raw.phone || '',
    email: raw.email || '',
    documentType: raw.documentType || '',
    documentNumber: raw.documentNumber || '',
    address: raw.address || '',
    city: raw.city || '',
    department: raw.department || '',
    postalCode: raw.postalCode || '',
    country: raw.country || 'CO',
    acceptsMarketing: raw.acceptsMarketing === true,
  });
}

function normalizeCustomerIdFromPayload(payload = {}) {
  return getObjectIdValue(
    payload.customerId ||
      payload.customer?._id ||
      payload.customer?.customerId ||
      payload.customer?.idRef ||
      payload.pos?.customerId
  );
}

function shouldCreateQuickCustomer(payload = {}, normalizedPayload = {}) {
  const rawMode = cleanLower(payload.customerMode || payload.pos?.customerMode || '', 40);
  const action = cleanLower(payload.customerAction || payload.pos?.customerAction || '', 40);
  const customer = payload.customer || {};
  const name = cleanText(customer.fullName || customer.displayName || customer.name || '', 160);

  if (!name || name === DEFAULT_POS_CUSTOMER_NAME) return false;
  if (normalizeCustomerIdFromPayload(payload)) return false;

  return (
    rawMode === 'identified' ||
    rawMode === 'quick' ||
    action === 'create' ||
    action === 'quick_create' ||
    normalizedPayload.customerMode === 'identified'
  );
}

function normalizePosBilling(billing = {}) {
  return {
    useSameAddress: true,
    name: cleanText(billing.name || billing.fullName || DEFAULT_POS_CUSTOMER_NAME, 120),
    lastname: cleanText(billing.lastname || billing.lastName || '', 120),
    id: cleanText(billing.id || billing.documentNumber || billing.document || '', 40),
    documentType: cleanUpper(billing.documentType || '', 40),
    address: cleanText(billing.address || '', 250),
    city: cleanText(billing.city || '', 100),
    department: cleanText(billing.department || '', 100),
    postalCode: cleanText(billing.postalCode || '', 40),
    phone: cleanText(billing.phone || '', 60),
    email: cleanLower(billing.email || '', 180),
    country: cleanUpper(billing.country || 'CO', 80) || 'CO',
  };
}

function normalizePosPayload(payload = {}, { deferPaymentValidation = false } = {}) {
  const branchId = getObjectIdValue(payload.branchId || payload.branch || payload.sede);
  const rawItems = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.cart)
      ? payload.cart
      : [];

  const calculated = calculatePosTotals({
    items: rawItems,
    discount: payload.discount,
    taxes: payload.taxes,
  });

  const payment = deferPaymentValidation
    ? null
    : normalizePaymentPayload(payload.payment || {}, calculated.total);
  const requestedCustomerMode = cleanLower(payload.customerMode || payload.pos?.customerMode || '', 40);
  const customerId = normalizeCustomerIdFromPayload(payload);
  const customerSnapshot = normalizePosCustomer(payload.customer || {});
  const hasCustomerData =
    customerId ||
    cleanText(customerSnapshot.name || '') !== DEFAULT_POS_CUSTOMER_NAME ||
    cleanText(customerSnapshot.phone || '') ||
    cleanText(customerSnapshot.email || '') ||
    cleanText(customerSnapshot.id || '');

  return {
    branchId,
    branchObjectId: branchId ? toObjectId(branchId, 'branchId') : null,
    terminalId: cleanText(payload.terminalId || payload.pos?.terminalId || '', 80),
    registerCode: cleanUpper(payload.registerCode || payload.pos?.registerCode || '', 80),
    shiftCode: cleanUpper(payload.shiftCode || payload.pos?.shiftCode || '', 80),
    customerId,
    customerMode:
      requestedCustomerMode === 'identified' || requestedCustomerMode === 'quick' || hasCustomerData
        ? 'identified'
        : 'guest',
    notes: cleanText(payload.notes || payload.pos?.notes || '', 1200),
    customer: hasCustomerData ? customerSnapshot : buildGuestCustomerSnapshot(),
    billing: normalizePosBilling(payload.billing || payload.customer),
    payment,
    ...calculated,
  };
}

async function loadExistingCustomer(
  customerId,
  { session = null, branchId = null } = {}
) {
  if (!customerId) return null;

  if (!isValidObjectId(customerId)) {
    throw createPosError(
      'El cliente seleccionado no tiene un ID válido.',
      'POS_CUSTOMER_INVALID_ID',
      { customerId },
      400
    );
  }

  const branchObjectId = branchId
    ? toObjectId(branchId, 'branchId')
    : null;
  const customer = await Customer.findOne({
    _id: toObjectId(customerId, 'customerId'),
    deletedAt: null,
    active: true,
    status: 'active',
    ...(branchObjectId
      ? {
          $or: [
            { branchIds: branchObjectId },
            { defaultBranch: branchObjectId },
          ],
        }
      : {}),
  }).session(session);

  if (!customer) {
    throw createPosError(
      'El cliente seleccionado no existe o no está activo.',
      'POS_CUSTOMER_NOT_FOUND',
      { customerId },
      404
    );
  }

  return customer;
}

function buildQuickCustomerPayload(payload = {}, branch, admin = {}) {
  const customer = payload.customer || {};
  const fullName = cleanText(customer.fullName || customer.displayName || customer.name || '', 160);

  if (!fullName) {
    throw createPosError(
      'Para crear un cliente rápido debes ingresar el nombre.',
      'POS_QUICK_CUSTOMER_NAME_REQUIRED',
      {},
      400
    );
  }

  return {
    fullName,
    displayName: fullName,
    phone: cleanText(customer.phone || customer.cellphone || customer.mobile || '', 60),
    email: cleanLower(customer.email || '', 180),
    documentType: cleanUpper(customer.documentType || '', 40),
    documentNumber: cleanText(customer.documentNumber || customer.document || customer.id || '', 40),
    address: cleanText(customer.address || '', 250),
    city: cleanText(customer.city || '', 100),
    department: cleanText(customer.department || '', 100),
    country: cleanUpper(customer.country || 'CO', 80) || 'CO',
    postalCode: cleanText(customer.postalCode || '', 40),
    source: 'pos',
    status: 'active',
    acceptsMarketing: customer.acceptsMarketing === true || customer.wantsNewsletter === true,
    notes: cleanText(customer.notes || 'Cliente creado desde POS.', 1200),
    defaultBranch: branch?._id || null,
    branchIds: branch?._id ? [branch._id] : [],
    createdByAdmin: getObjectIdValue(admin._id || admin.id || admin.adminUserId || admin.userId) || null,
  };
}

async function resolvePosCustomerForPreview(
  payload = {},
  normalizedPayload = {},
  { session = null, branch = null } = {}
) {
  if (normalizedPayload.customerId) {
    const customer = await loadExistingCustomer(normalizedPayload.customerId, {
      session,
      branchId: branch?._id || normalizedPayload.branchId,
    });
    return {
      customerMode: 'identified',
      quickSale: false,
      customer,
      customerSnapshot: buildCustomerOrderSnapshot(customer),
      matchedBy: 'customer_id',
    };
  }

  if (shouldCreateQuickCustomer(payload, normalizedPayload)) {
    return {
      customerMode: 'identified',
      quickSale: false,
      customer: null,
      customerSnapshot: normalizedPayload.customer,
    };
  }

  return {
    customerMode: 'guest',
    quickSale: true,
    customer: null,
    customerSnapshot: buildGuestCustomerSnapshot(),
  };
}

async function resolvePosCustomerForSale(payload = {}, normalizedPayload = {}, branch, admin = {}, { session = null } = {}) {
  if (normalizedPayload.customerId) {
    const customer = await loadExistingCustomer(normalizedPayload.customerId, {
      session,
      branchId: branch?._id,
    });
    return {
      customerMode: 'identified',
      quickSale: false,
      customer,
      customerSnapshot: buildCustomerOrderSnapshot(customer),
      matchedBy: 'customer_id',
    };
  }

  if (shouldCreateQuickCustomer(payload, normalizedPayload)) {
    const quickCustomerPayload = buildQuickCustomerPayload(payload, branch, admin);
    const existingMatch = await findCustomerMatch(quickCustomerPayload, {
      session,
    });

    if (existingMatch?.customer) {
      const conflictingMatch = await findCustomerMatch(quickCustomerPayload, {
        session,
        excludeId: existingMatch.customer._id,
      });
      if (conflictingMatch?.customer) {
        throw createPosError(
          'Los datos ingresados pertenecen a fichas de clientes diferentes.',
          'POS_CUSTOMER_IDENTITY_CONFLICT',
          {
            matchedBy: existingMatch.matchedBy,
            conflictingBy: conflictingMatch.matchedBy,
          },
          409
        );
      }

      const branchIds = new Set(
        (Array.isArray(existingMatch.customer.branchIds)
          ? existingMatch.customer.branchIds
          : []).map(String)
      );
      branchIds.add(String(branch._id));
      existingMatch.customer.branchIds = [...branchIds];
      if (!existingMatch.customer.defaultBranch) {
        existingMatch.customer.defaultBranch = branch._id;
      }
      await existingMatch.customer.save({ session });

      return {
        customerMode: 'identified',
        quickSale: false,
        customer: existingMatch.customer,
        customerSnapshot: buildCustomerOrderSnapshot(existingMatch.customer),
        matchedBy: existingMatch.matchedBy,
      };
    }

    let customer = null;
    let matchedBy = 'created';

    try {
      const createdCustomers = await Customer.create(
        [quickCustomerPayload],
        { session }
      );
      customer = createdCustomers[0];
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) throw error;

      if (isActiveMongoTransaction(session)) {
        throw createPosError(
          'Otro proceso registró ese cliente al mismo tiempo. Reintenta la venta.',
          'POS_CUSTOMER_DUPLICATE',
          {},
          409
        );
      }

      const concurrentMatch = await findCustomerMatch(quickCustomerPayload, {
        session,
      });
      if (!concurrentMatch?.customer) {
        throw createPosError(
          'Otro proceso registró ese cliente al mismo tiempo. Reintenta la venta.',
          'POS_CUSTOMER_DUPLICATE',
          {},
          409
        );
      }
      customer = concurrentMatch.customer;
      matchedBy = concurrentMatch.matchedBy;
      const concurrentBranchIds = new Set(
        (Array.isArray(customer.branchIds) ? customer.branchIds : []).map(String)
      );
      concurrentBranchIds.add(String(branch._id));
      customer.branchIds = [...concurrentBranchIds];
      if (!customer.defaultBranch) customer.defaultBranch = branch._id;
      await customer.save({ session });
    }

    return {
      customerMode: 'identified',
      quickSale: false,
      customer,
      customerSnapshot: buildCustomerOrderSnapshot(customer),
      matchedBy,
    };
  }

  return {
    customerMode: 'guest',
    quickSale: true,
    customer: null,
    customerSnapshot: buildGuestCustomerSnapshot(),
  };
}

async function updateCustomerStatsAfterPosSale(customer, order, { session = null } = {}) {
  if (!customer?._id || !order?._id) return { applied: false };
  return applyCustomerStatsForOrder(order, { session });
}

async function validatePosBranch(branchId, { session = null } = {}) {
  if (!branchId) {
    throw createPosError(
      'Debes seleccionar una sede para realizar la venta física.',
      'POS_BRANCH_REQUIRED',
      {},
      400
    );
  }

  const branch = await Branch.findOne({
    _id: toObjectId(branchId, 'branchId'),
    deletedAt: null,
  }).session(session);

  if (!branch) {
    throw createPosError(
      'La sede seleccionada no existe.',
      'POS_BRANCH_NOT_FOUND',
      { branchId: String(branchId) },
      404
    );
  }

  if (!branch.canSell()) {
    throw createPosError(
      'La sede seleccionada no está habilitada para ventas físicas.',
      'POS_BRANCH_NOT_ALLOWED',
      {
        branchId: String(branch._id),
        status: branch.status,
        active: branch.active,
        allowPosSales: branch.settings?.allowPosSales === true,
      },
      409
    );
  }

  return branch;
}

async function loadAndValidatePosItems(items = [], branch, { session = null } = {}) {
  const normalizedItems = normalizePosItems(items);
  const validatedItems = [];

  for (const item of normalizedItems) {
    const product = await Product.findOne({
      _id: item.productObjectId,
      active: { $ne: false },
      visible: { $ne: false },
    })
      .select(
        '+digitalDelivery.assetUrl +digitalDelivery.customerMessage +serviceDelivery.bookingUrl +serviceDelivery.internalInstructions +bundleComponents'
      )
      .session(session)
      .lean();

    if (!product) {
      throw createPosError(
        `El producto de la posición ${item.index + 1} no existe o no está activo.`,
        'POS_PRODUCT_NOT_FOUND',
        { index: item.index, productId: item.productId },
        404
      );
    }

    const serverUnitPrice = getServerUnitPrice(product);
    const fulfillment = getPublicFulfillmentView(product);
    const inventoryLines = [];

    if (product.productType === 'bundle') {
      for (const component of product.bundleComponents || []) {
        if (
          component.trackInventory === false ||
          component.allowBackorder === true
        ) {
          continue;
        }

        const componentProductId = toObjectId(
          component.product,
          'bundleComponents.product'
        );
        const requiredQuantity =
          item.quantity * Math.max(1, Number(component.quantity || 1));
        const componentStock = await InventoryStock.findOne({
          branch: branch._id,
          product: componentProductId,
          variantKey:
            component.variantKey || 'default__default',
          active: true,
          deletedAt: null,
        })
          .session(session)
          .lean();

        if (!componentStock) {
          throw createPosError(
            `No existe inventario en la sede para el componente ${component.title || product.title}.`,
            'POS_BUNDLE_COMPONENT_STOCK_NOT_FOUND',
            {
              productId: String(product._id),
              componentProductId: String(componentProductId),
              branchId: String(branch._id),
            },
            409
          );
        }

        const componentAvailable = Math.max(
          0,
          toNumber(
            componentStock.availableStock,
            toNumber(componentStock.stock, 0) -
              toNumber(componentStock.reservedStock, 0)
          )
        );
        if (
          componentAvailable < requiredQuantity &&
          branch.settings?.allowNegativeStock !== true
        ) {
          throw createPosError(
            `No hay stock suficiente para el componente ${component.title || product.title}. Disponible: ${componentAvailable}.`,
            'POS_BUNDLE_COMPONENT_STOCK_NOT_AVAILABLE',
            {
              productId: String(product._id),
              componentProductId: String(componentProductId),
              requestedQuantity: requiredQuantity,
              availableStock: componentAvailable,
            },
            409
          );
        }

        const componentProduct = await Product.findById(
          componentProductId
        )
          .session(session)
          .lean();
        const componentIdentity = resolveVariantIdentity({
          variantKey: componentStock.variantKey,
          size: componentStock.variant?.size,
          color: componentStock.variant?.color,
          attributes: componentStock.variant?.attributes || [],
        });
        inventoryLines.push({
          ...item,
          productId: String(componentProductId),
          productObjectId: componentProductId,
          quantity: requiredQuantity,
          stock: componentStock,
          availableStock: componentAvailable,
          product: componentProduct || {
            _id: componentProductId,
            title: component.title || '',
            sku: component.sku || '',
            image: component.image || '',
          },
          productSnapshot: buildProductSnapshot(
            componentProduct || {},
            component
          ),
          variantKey: componentIdentity.variantKey,
          variantSnapshot: {
            label: cleanText(component.variantLabel || '', 160),
            size: componentIdentity.size,
            color: componentIdentity.color,
            attributes: componentIdentity.attributes,
            sku: cleanUpper(component.sku || '', 100),
            barcode: '',
          },
          bundleParentProduct: product._id,
          bundleParentTitle: product.title || '',
        });
      }
    } else if (
      product.trackInventory !== false &&
      product.allowBackorder !== true
    ) {
      const stock = await InventoryStock.findOne({
        branch: branch._id,
        product: item.productObjectId,
        variantKey: item.variantKey,
        active: true,
        deletedAt: null,
      })
        .session(session)
        .lean();

      if (!stock) {
        throw createPosError(
          `No existe inventario en la sede para ${product.title}.`,
          'POS_STOCK_NOT_FOUND',
          {
            index: item.index,
            productId: item.productId,
            branchId: String(branch._id),
            size: item.size,
            color: item.color,
          },
          409
        );
      }

      const availableStock = Math.max(
        0,
        toNumber(
          stock.availableStock,
          toNumber(stock.stock, 0) -
            toNumber(stock.reservedStock, 0)
        )
      );

      if (
        availableStock < item.quantity &&
        branch.settings?.allowNegativeStock !== true
      ) {
        throw createPosError(
          `No hay stock suficiente para ${product.title}. Disponible: ${availableStock}.`,
          'POS_STOCK_NOT_AVAILABLE',
          {
            index: item.index,
            productId: item.productId,
            branchId: String(branch._id),
            requestedQuantity: item.quantity,
            availableStock,
            size: item.size,
            color: item.color,
          },
          409
        );
      }

      inventoryLines.push({
        ...item,
        stock,
        availableStock,
        product,
        productSnapshot: buildProductSnapshot(product, item),
        variantKey: stock.variantKey,
        variantSnapshot: {
          label: cleanText(
            stock.variant?.label || item.variantLabel || '',
            160
          ),
          size: cleanText(stock.variant?.size || item.size, 80),
          color: cleanText(stock.variant?.color || item.color, 120),
          attributes: normalizeAttributes(
            stock.variant?.attributes ||
              item.variantAttributes ||
              []
          ),
          sku: cleanUpper(stock.variant?.sku || item.sku || product.sku || '', 100),
          barcode: cleanText(stock.variant?.barcode || item.barcode || product.barcode || '', 120),
        },
      });
    }

    validatedItems.push({
      ...item,
      unitPrice: serverUnitPrice,
      lineSubtotal: item.quantity * serverUnitPrice,
      product,
      fulfillment,
      stock: inventoryLines[0]?.stock || null,
      availableStock:
        inventoryLines.length > 0
          ? Math.min(
              ...inventoryLines.map((line) =>
                Number(line.availableStock || 0)
              )
            )
          : Infinity,
      inventoryLines,
      productSnapshot: buildProductSnapshot(product, item),
      branchSnapshot: buildBranchSnapshot(branch),
      variantSnapshot: {
        label: cleanText(item.variantLabel || '', 160),
        size: cleanText(item.size, 80),
        color: cleanText(item.color, 120),
        attributes: normalizeAttributes(
          item.variantAttributes || []
        ),
        sku: cleanUpper(item.sku || product.sku || '', 100),
        barcode: cleanText(item.barcode || product.barcode || '', 120),
      },
    });
  }

  return validatedItems;
}

async function getNextOrderNumber({ session = null } = {}) {
  const doc = await Counter.findOneAndUpdate(
    { _id: 'orderNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  ).lean();

  return String(doc.seq).padStart(6, '0');
}

function validateDiscountAuthorization({ normalizedPayload, admin = {}, maxPercent = DEFAULT_MAX_DISCOUNT_PERCENT }) {
  const subtotal = toMoney(normalizedPayload.subtotal);
  const discountAmount = toMoney(normalizedPayload.discount?.amount);

  if (!discountAmount || subtotal <= 0) return;

  if (!admin.canApplyPosDiscount) {
    throw createPosError(
      'Tu perfil no tiene permiso para aplicar descuentos POS.',
      'POS_DISCOUNT_PERMISSION_REQUIRED',
      {},
      403
    );
  }

  if (cleanText(normalizedPayload.discount?.reason || '', 240).length < 3) {
    throw createPosError(
      'Todo descuento POS debe registrar un motivo comercial.',
      'POS_DISCOUNT_REASON_REQUIRED',
      {},
      400
    );
  }

  const discountPercent = Math.round((discountAmount / subtotal) * 10000) / 100;

  if (discountPercent > maxPercent && !admin.canApprovePosDiscount) {
    throw createPosError(
      'El descuento supera el límite permitido y requiere autorización.',
      'POS_DISCOUNT_NOT_ALLOWED',
      { discountPercent, maxPercent },
      403
    );
  }
}

function buildPosOrderPayload({
  normalizedPayload,
  branch,
  orderNumber,
  admin = {},
  paymentTransactionId = '',
}) {
  const now = new Date();
  const adminId = getObjectIdValue(admin._id || admin.id || admin.adminUserId || admin.userId) || null;
  const adminSnapshot = buildAdminSnapshot(admin);

  const orderItems = normalizedPayload.items.map((item) => ({
    product: item.productObjectId,
    productId: item.productId,
    title: item.productSnapshot?.title || item.title,
    image: item.productSnapshot?.image || item.image,
    color: item.color,
    size: item.size,
    variantId: item.variantKey,
    variantKey: item.variantKey,
    variantLabel:
      item.variantSnapshot?.label || item.variantLabel || '',
    variantAttributes:
      item.variantSnapshot?.attributes ||
      item.variantAttributes ||
      [],
    qty: item.quantity,
    quantity: item.quantity,
    price: item.unitPrice,
    unitPrice: item.unitPrice,
    priceNumber: item.unitPrice,
    productType: item.fulfillment?.productType || item.product?.productType || 'physical',
    requiresShipping: item.fulfillment?.requiresShipping !== false,
    fulfillmentKind: item.fulfillment?.kind || 'shipment',
    fulfillmentSnapshot: item.fulfillment || {},
    customsSnapshot: normalizeProductCustoms(item.product?.customs),
  }));
  const hasVirtualFulfillment = normalizedPayload.items.some(
    (item) =>
      ['digital', 'service'].includes(item.product?.productType) ||
      (
        item.product?.productType === 'bundle' &&
        (item.product?.bundleComponents || []).some((component) =>
          ['digital', 'service'].includes(component.productType)
        )
      )
  );
  const safePaymentTransactionId = cleanUpper(
    paymentTransactionId || `POS-${crypto.randomUUID()}`,
    120
  );
  const recordedDiscount = toMoney(normalizedPayload.discount?.amount) > 0
    ? {
        ...normalizedPayload.discount,
        authorizedBy: adminId,
        authorizedBySnapshot: adminSnapshot,
      }
    : normalizedPayload.discount;

  return {
    sessionId: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderNumber,
    status: 'paid',
    fulfillmentStatus: hasVirtualFulfillment ? 'processing' : 'delivered',
    source: 'pos',
    channel: 'physical_store',
    saleType: 'pos_sale',
    branch: branch._id,
    branchSnapshot: buildBranchSnapshot(branch),
    createdByAdmin: adminId,
    createdByAdminSnapshot: adminSnapshot,
    cashier: adminId,
    cashierSnapshot: adminSnapshot,
    pos: {
      saleNumber: `POS-${orderNumber}`,
      receiptNumber: `REC-${orderNumber}`,
      terminalId: normalizedPayload.terminalId,
      registerCode: normalizedPayload.registerCode,
      shiftCode: normalizedPayload.shiftCode,
      customerMode: normalizedPayload.customerMode,
      quickSale: normalizedPayload.quickSale !== false ? normalizedPayload.customerMode !== 'identified' : false,
      notes: normalizedPayload.notes,
      confirmedAt: now,
    },
    cart: orderItems.map((item) => ({
      productId: item.productId,
      title: item.title,
      image: item.image,
      color: item.color,
      size: item.size,
      variantId: item.variantId,
      variantKey: item.variantKey,
      variantLabel: item.variantLabel,
      variantAttributes: item.variantAttributes,
      quantity: item.quantity,
      price: item.price,
    })),
    items: orderItems,
    summary: normalizedPayload.summary,
    subtotal: normalizedPayload.subtotal,
    shipping: 0,
    total: normalizedPayload.total,
    taxes: normalizedPayload.taxes,
    customer: normalizedPayload.customer,
    billing: normalizedPayload.billing,
    discount: recordedDiscount,
    payment: {
      active: true,
      provider: 'pos',
      providerLabel: 'Venta física',
      mode: 'production',
      currency: DEFAULT_CURRENCY,
      checkoutLabel: 'Pago en tienda física',
      enableWebhook: false,
      status: 'paid',
      methodType: normalizedPayload.payment.methodType,
      method: normalizedPayload.payment.method,
      methodLabel: normalizedPayload.payment.methodLabel,
      transactionId: safePaymentTransactionId,
      reference: normalizedPayload.payment.reference,
      amountInCents: Math.round(normalizedPayload.total * 100),
      amount: normalizedPayload.total,
      paidAt: now,
      receivedAmount: normalizedPayload.payment.receivedAmount,
      changeAmount: normalizedPayload.payment.changeAmount,
      splitPayments: normalizedPayload.payment.splitPayments,
      rawMethod: {
        source: 'pos',
        method: normalizedPayload.payment.method,
      },
    },
    inventoryControl: {
      reservationRequired: false,
      discountedAtCheckout: true,
      restockedOnFailure: false,
      restockedAt: null,
    },
    paymentProcessing: {
      provider: 'pos',
      approvedTransactionId: safePaymentTransactionId,
      approvedAt: now,
      inventory: {
        status: 'confirmed',
        confirmedAt: now,
      },
      fulfillment: {
        status: hasVirtualFulfillment ? 'pending' : 'not_required',
      },
      invoice: {
        status: 'not_required',
        transactionId: safePaymentTransactionId,
      },
    },
    tags: normalizedPayload.customerMode === 'identified'
      ? ['pos', 'venta física', 'cliente identificado']
      : ['pos', 'venta física'],
    timeline: [
      {
        type: 'status',
        statusFrom: undefined,
        statusTo: 'paid',
        message: hasVirtualFulfillment
          ? 'Venta POS pagada; cumplimiento digital o de servicio pendiente.'
          : 'Venta física POS pagada y entregada.',
        by: adminSnapshot.username || 'pos',
        at: now,
      },
    ],
  };
}

async function applyPosInventoryOut({ order, validatedItems = [], branch, admin = {}, session }) {
  const movements = [];

  const inventoryLines = validatedItems.flatMap((item) =>
    Array.isArray(item.inventoryLines)
      ? item.inventoryLines
      : item.stock
        ? [item]
        : []
  );

  for (const item of inventoryLines) {
    const stockBefore = toNumber(item.stock.stock, 0);
    const stockAfter = Math.max(0, stockBefore - item.quantity);

    const updatedStock = await InventoryStock.findOneAndUpdate(
      {
        _id: item.stock._id,
        active: true,
        deletedAt: null,
        ...(branch.settings?.allowNegativeStock === true
          ? {}
          : {
              $expr: {
                $gte: [
                  {
                    $subtract: [
                      '$stock',
                      {
                        $ifNull: ['$reservedStock', 0],
                      },
                    ],
                  },
                  item.quantity,
                ],
              },
            }),
      },
      [
        {
          $set: {
            stock: {
              $max: [
                0,
                {
                  $subtract: ['$stock', item.quantity],
                },
              ],
            },
          },
        },
        {
          $set: {
            availableStock: {
              $max: [
                0,
                {
                  $subtract: [
                    '$stock',
                    {
                      $ifNull: ['$reservedStock', 0],
                    },
                  ],
                },
              ],
            },
            lastMovementAt: new Date(),
            updatedBy: getObjectIdValue(admin._id || admin.id || admin.adminUserId || admin.userId) || null,
          },
        },
      ],
      {
        new: true,
        session,
        runValidators: false,
      }
    );

    if (!updatedStock) {
      throw createPosError(
        'El inventario cambió mientras se registraba la venta. Intenta nuevamente.',
        'POS_CONCURRENT_STOCK_CHANGE',
        {
          productId: item.productId,
          stockId: String(item.stock._id),
          requestedQuantity: item.quantity,
        },
        409
      );
    }

    const movement = await InventoryMovement.create(
      [
        {
          type: 'sale_out',
          status: 'posted',
          product: item.productObjectId,
          productSnapshot: item.productSnapshot,
          variant: item.variantSnapshot,
          variantKey: item.variantKey,
          branchFrom: branch._id,
          branchFromSnapshot: buildBranchSnapshot(branch),
          quantity: item.quantity,
          stockFrom: {
            before: stockBefore,
            quantity: item.quantity,
            after: stockAfter,
          },
          unitCost: toMoney(item.product?.averageCost || item.product?.cost || 0),
          totalCost: toMoney(item.product?.averageCost || item.product?.cost || 0) * item.quantity,
          reason: 'Venta física POS',
          notes: item.bundleParentProduct
            ? `Salida por combo ${item.bundleParentTitle || ''} en venta POS ${order.orderNumber}`
            : `Salida automática por venta POS ${order.orderNumber}`,
          reference: `POS-${order.orderNumber}`,
          order: order._id,
          orderNumber: order.orderNumber,
          sourceModel: 'Order',
          sourceId: order._id,
          createdBy: getObjectIdValue(admin._id || admin.id || admin.adminUserId || admin.userId) || null,
          postedBy: getObjectIdValue(admin._id || admin.id || admin.adminUserId || admin.userId) || null,
          postedAt: new Date(),
        },
      ],
      { session }
    );

    movements.push(movement[0]);

    await InventoryStock.updateOne(
      { _id: item.stock._id },
      { $set: { lastMovement: movement[0]._id } },
      { session }
    );

    await syncProductTotalStock(item.productObjectId, { session });
  }

  return movements;
}

async function syncProductTotalStock(productId, { session = null } = {}) {
  const rows = await InventoryStock.find({
    product: toObjectId(productId, 'productId'),
    deletedAt: null,
    active: true,
  })
    .select('stock')
    .session(session)
    .lean();

  const totalStock = rows.reduce((sum, row) => sum + Math.max(0, Number(row.stock || 0)), 0);

  await Product.updateOne(
    { _id: toObjectId(productId, 'productId') },
    { $set: { stock: totalStock } },
    { session }
  );

  return totalStock;
}

async function preparePosSalePreview(payload = {}, options = {}) {
  const session = options.session || null;
  // Los precios enviados por el navegador no son autoritativos. La validación
  // del pago se difiere hasta recalcular el total con producto e inventario.
  const normalizedPayload = normalizePosPayload(payload, { deferPaymentValidation: true });
  const branch = await validatePosBranch(normalizedPayload.branchId, { session });
  const validatedItems = await loadAndValidatePosItems(normalizedPayload.items, branch, { session });
  const recalculated = calculateTotalsFromNormalizedItems({
    items: validatedItems,
    discount: payload.discount,
    taxes: payload.taxes,
  });
  const customerResolution = await resolvePosCustomerForPreview(
    payload,
    normalizedPayload,
    { session, branch }
  );
  const needsElectronicContact = validatedItems.some(
    (item) =>
      ['digital', 'service'].includes(item.product?.productType) ||
      (
        item.product?.productType === 'bundle' &&
        (item.product?.bundleComponents || []).some((component) =>
          ['digital', 'service'].includes(component.productType)
        )
      )
  );
  const deliveryEmail = cleanLower(
    customerResolution.customerSnapshot?.email ||
      customerResolution.customerSnapshot?.emailOrPhone ||
      '',
    180
  );

  if (
    needsElectronicContact &&
    !deliveryEmail.includes('@')
  ) {
    throw createPosError(
      'Los productos digitales y servicios necesitan el correo del cliente para completar la entrega.',
      'POS_FULFILLMENT_EMAIL_REQUIRED',
      {},
      400
    );
  }

  return {
    ...normalizedPayload,
    ...recalculated,
    payment: normalizePaymentPayload(payload.payment || {}, recalculated.total),
    customerMode: customerResolution.customerMode,
    quickSale: customerResolution.quickSale,
    customer: customerResolution.customerSnapshot,
    billing: normalizePosBilling(payload.billing || customerResolution.customerSnapshot),
    customerRecord: customerResolution.customer
      ? {
          id: String(customerResolution.customer._id),
          customerCode: customerResolution.customer.customerCode || '',
          fullName: customerResolution.customer.fullName || '',
        }
      : null,
    branch,
    branchSnapshot: buildBranchSnapshot(branch),
  };
}

async function createPosSale(payload = {}, options = {}) {
  const externalSession = options.session || null;
  const admin = options.admin || {};

  const run = async (session) => {
    const normalizedPayload = await preparePosSalePreview(payload, { session });
    const branch = normalizedPayload.branch;

    validateDiscountAuthorization({ normalizedPayload, admin });

    const customerResolution = await resolvePosCustomerForSale(payload, normalizedPayload, branch, admin, { session });
    normalizedPayload.customerMode = customerResolution.customerMode;
    normalizedPayload.quickSale = customerResolution.quickSale;
    normalizedPayload.customer = customerResolution.customerSnapshot;
    normalizedPayload.billing = normalizePosBilling(payload.billing || customerResolution.customerSnapshot);

    const orderNumber = await getNextOrderNumber({ session });
    const orderPayload = buildPosOrderPayload({
      normalizedPayload,
      branch,
      orderNumber,
      admin,
      paymentTransactionId: options.paymentTransactionId,
    });
    if (customerResolution.customer?._id) {
      orderPayload.customer = {
        ...(orderPayload.customer || {}),
        customerId: customerResolution.customer._id,
        customerCode: customerResolution.customer.customerCode || '',
      };
      orderPayload.customerRelationship = {
        linkedAt: new Date(),
        statsAppliedAt: null,
        source: 'pos',
        matchedBy: customerResolution.matchedBy || 'customer_id',
      };
    }
    const createdOrders = await Order.create([orderPayload], { session });
    const order = createdOrders[0];
    await OrderEvent.create(
      [
        {
          orderId: order._id,
          type: 'status_changed',
          message: `Orden POS creada con estado ${order.status}.`,
          meta: {
            from: null,
            to: order.status,
            source: 'pos',
            branch: branch._id,
            by:
              order.createdByAdminSnapshot?.username ||
              order.cashierSnapshot?.username ||
              'pos',
          },
        },
      ],
      { session }
    );

    const movements = await applyPosInventoryOut({
      order,
      validatedItems: normalizedPayload.items,
      branch,
      admin,
      session,
    });

    await updateCustomerStatsAfterPosSale(customerResolution.customer, order, { session });

    return {
      order,
      movements,
      branch,
      customer: customerResolution.customer || null,
    };
  };

  let result;

  if (externalSession) {
    result = await run(externalSession);
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        result = await run(session);
      });
    } finally {
      await session.endSession();
    }
  }

  if (!externalSession) {
    try {
      await processFulfillmentOnce({
        orderId: result.order._id,
        paymentProvider: 'pos',
        transaction: {
          id: result.order.payment?.transactionId,
          provider: 'pos',
          payment_method_type:
            result.order.payment?.methodType || 'pos',
          payment_method_name:
            result.order.payment?.methodLabel || 'Venta física',
          payment_method: result.order.payment?.method || 'pos',
          rawMethod: result.order.payment?.rawMethod || {},
        },
      });
    } catch (error) {
      console.error(
        '[adminPosService] Error registrando cumplimiento POS recuperable:',
        error.message
      );
    }
  }

  return result;
}

module.exports = {
  POS_PAYMENT_METHODS,
  createPosError,
  normalizePosPayload,
  normalizePosItems,
  normalizePaymentPayload,
  normalizeDiscountPayload,
  validateDiscountAuthorization,
  normalizePosCustomer,
  calculatePosTotals,
  calculateTotalsFromNormalizedItems,
  validatePosBranch,
  loadAndValidatePosItems,
  buildPosOrderPayload,
  applyPosInventoryOut,
  preparePosSalePreview,
  createPosSale,
};
