// backend/services/adminPosService.js

const mongoose = require('mongoose');

const Branch = require('../models/Branch');
const Product = require('../models/Product');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Order = require('../models/Order');
const Counter = require('../models/Counter');
const { generateElectronicInvoiceAfterPayment } = require('./electronicInvoiceAfterPaymentService');

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

function buildVariantKey(size = '', color = '') {
  const cleanSize = cleanLower(size, 80);
  const cleanColor = cleanLower(color, 120);
  const key = `${cleanSize}__${cleanColor}`;
  return key === '__' ? 'default__default' : key;
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

    if (unitPrice <= 0) {
      throw createPosError(
        `El precio del producto en la posición ${index + 1} debe ser mayor a cero.`,
        'POS_INVALID_UNIT_PRICE',
        { index, productId, unitPrice },
        400
      );
    }

    return {
      index,
      productId,
      productObjectId: toObjectId(productId, `items[${index}].productId`),
      quantity,
      unitPrice,
      lineSubtotal: quantity * unitPrice,
      size,
      color,
      variantKey: buildVariantKey(size, color),
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
  const safeMethod = POS_PAYMENT_METHODS.includes(method) ? method : 'cash';
  const amount = toMoney(payment.amount || total);
  const receivedAmount = toMoney(payment.receivedAmount ?? payment.received ?? amount);
  const splitPayments = Array.isArray(payment.splitPayments)
    ? payment.splitPayments
        .map((split) => {
          const splitMethod = cleanLower(split.method || 'other', 40);
          const safeSplitMethod = POS_PAYMENT_METHODS.includes(splitMethod)
            ? splitMethod
            : 'other';

          return {
            method: safeSplitMethod,
            methodLabel: cleanText(split.methodLabel || safeSplitMethod, 80),
            amount: toMoney(split.amount),
            reference: cleanText(split.reference || '', 120),
            receivedAmount: toMoney(split.receivedAmount || split.amount),
            changeAmount: toMoney(split.changeAmount || 0),
          };
        })
        .filter((split) => split.amount > 0)
    : [];

  const splitTotal = splitPayments.reduce((sum, split) => sum + split.amount, 0);

  if (safeMethod === 'mixed' && splitTotal !== toMoney(total)) {
    throw createPosError(
      'La suma del pago mixto debe ser igual al total de la venta.',
      'POS_INVALID_SPLIT_PAYMENT_TOTAL',
      { splitTotal, total: toMoney(total) },
      400
    );
  }

  if (safeMethod !== 'mixed' && amount < toMoney(total)) {
    throw createPosError(
      'El valor pagado no puede ser menor al total de la venta.',
      'POS_PAYMENT_AMOUNT_TOO_LOW',
      { amount, total: toMoney(total) },
      400
    );
  }

  return {
    method: safeMethod,
    methodType: safeMethod,
    methodLabel: cleanText(payment.methodLabel || safeMethod, 80),
    amount: safeMethod === 'mixed' ? splitTotal : amount,
    receivedAmount: safeMethod === 'cash' ? receivedAmount : amount,
    changeAmount: safeMethod === 'cash' ? Math.max(0, receivedAmount - toMoney(total)) : 0,
    reference: cleanText(payment.reference || '', 120),
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

function calculatePosTotals({ items = [], discount = {}, taxes = {} } = {}) {
  const normalizedItems = normalizePosItems(items);
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const normalizedDiscount = normalizeDiscountPayload(discount, subtotal);
  const taxableBase = Math.max(0, subtotal - normalizedDiscount.amount);

  const ivaEnabled = taxes?.iva?.enabled === true;
  const ivaPercent = Math.max(0, Math.min(100, toNumber(taxes?.iva?.percent, 0)));
  const ivaAmount = ivaEnabled && ivaPercent > 0 ? Math.round((taxableBase * ivaPercent) / 100) : 0;
  const total = Math.max(0, taxableBase + ivaAmount);
  const totalItems = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: normalizedItems,
    summary: {
      itemsCount: normalizedItems.length,
      totalItems,
      subtotal,
    },
    subtotal,
    discount: normalizedDiscount,
    taxes: {
      iva: {
        enabled: ivaEnabled,
        percent: ivaPercent,
        code: cleanText(taxes?.iva?.code || '01', 20),
        name: cleanText(taxes?.iva?.name || 'IVA', 80),
        amount: ivaAmount,
      },
    },
    shipping: 0,
    total,
  };
}

function normalizePosPayload(payload = {}) {
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

  const payment = normalizePaymentPayload(payload.payment || {}, calculated.total);

  return {
    branchId,
    branchObjectId: branchId ? toObjectId(branchId, 'branchId') : null,
    terminalId: cleanText(payload.terminalId || payload.pos?.terminalId || '', 80),
    registerCode: cleanUpper(payload.registerCode || payload.pos?.registerCode || '', 80),
    shiftCode: cleanUpper(payload.shiftCode || payload.pos?.shiftCode || '', 80),
    customerMode:
      cleanLower(payload.customerMode || payload.pos?.customerMode || '') === 'identified'
        ? 'identified'
        : 'guest',
    notes: cleanText(payload.notes || payload.pos?.notes || '', 1200),
    customer: normalizePosCustomer(payload.customer),
    billing: normalizePosBilling(payload.billing || payload.customer),
    payment,
    ...calculated,
  };
}

function normalizePosCustomer(customer = {}) {
  return {
    name: cleanText(customer.name || DEFAULT_POS_CUSTOMER_NAME, 120),
    lastname: cleanText(customer.lastname || '', 120),
    id: cleanText(customer.id || customer.document || '', 40),
    documentType: cleanText(customer.documentType || '', 40),
    emailOrPhone: cleanText(customer.emailOrPhone || customer.email || customer.phone || '', 180),
    email: cleanText(customer.email || '', 180),
    phone: cleanText(customer.phone || '', 60),
    address: cleanText(customer.address || '', 250),
    city: cleanText(customer.city || '', 100),
    department: cleanText(customer.department || '', 100),
    country: cleanText(customer.country || 'Colombia', 80),
    deliveryType: 'store',
    wantsNewsletter: customer.wantsNewsletter === true,
  };
}

function normalizePosBilling(billing = {}) {
  return {
    useSameAddress: true,
    name: cleanText(billing.name || DEFAULT_POS_CUSTOMER_NAME, 120),
    lastname: cleanText(billing.lastname || '', 120),
    id: cleanText(billing.id || billing.document || '', 40),
    documentType: cleanText(billing.documentType || '', 40),
    address: cleanText(billing.address || '', 250),
    city: cleanText(billing.city || '', 100),
    department: cleanText(billing.department || '', 100),
    postalCode: cleanText(billing.postalCode || '', 40),
    phone: cleanText(billing.phone || '', 60),
    email: cleanText(billing.email || '', 180),
    country: cleanText(billing.country || 'Colombia', 80),
  };
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
      toNumber(stock.availableStock, toNumber(stock.stock, 0) - toNumber(stock.reservedStock, 0))
    );

    if (availableStock < item.quantity && branch.settings?.allowNegativeStock !== true) {
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

    validatedItems.push({
      ...item,
      product,
      stock,
      availableStock,
      productSnapshot: buildProductSnapshot(product, item),
      branchSnapshot: buildBranchSnapshot(branch),
      variantSnapshot: {
        size: cleanText(stock.variant?.size || item.size, 80),
        color: cleanText(stock.variant?.color || item.color, 120),
        sku: cleanUpper(stock.variant?.sku || item.sku || product.sku || '', 100),
        barcode: cleanText(stock.variant?.barcode || item.barcode || product.barcode || '', 120),
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

function buildPosOrderPayload({ normalizedPayload, branch, orderNumber, admin = {} }) {
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
    qty: item.quantity,
    quantity: item.quantity,
    price: item.unitPrice,
    unitPrice: item.unitPrice,
    priceNumber: item.unitPrice,
  }));

  return {
    sessionId: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderNumber,
    status: 'paid',
    fulfillmentStatus: 'delivered',
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
      quickSale: normalizedPayload.customerMode !== 'identified',
      notes: normalizedPayload.notes,
      confirmedAt: now,
    },
    cart: orderItems.map((item) => ({
      productId: item.productId,
      title: item.title,
      image: item.image,
      color: item.color,
      size: item.size,
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
    discount: normalizedPayload.discount,
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
      transactionId: '',
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
      discountedAtCheckout: false,
      restockedOnFailure: false,
      restockedAt: null,
    },
    tags: ['pos', 'venta física'],
    timeline: [
      {
        type: 'status',
        statusFrom: undefined,
        statusTo: 'paid',
        message: 'Venta física POS pagada y entregada.',
        by: adminSnapshot.username || 'pos',
        at: now,
      },
    ],
  };
}

async function applyPosInventoryOut({ order, validatedItems = [], branch, admin = {}, session }) {
  const movements = [];

  for (const item of validatedItems) {
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
          notes: `Salida automática por venta POS ${order.orderNumber}`,
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

async function createPosSale(payload = {}, options = {}) {
  const externalSession = options.session || null;
  const admin = options.admin || {};

  const run = async (session) => {
    const normalizedPayload = normalizePosPayload(payload);
    const branch = await validatePosBranch(normalizedPayload.branchId, { session });
    const validatedItems = await loadAndValidatePosItems(normalizedPayload.items, branch, { session });

    normalizedPayload.items = validatedItems;
    normalizedPayload.summary = {
      itemsCount: validatedItems.length,
      totalItems: validatedItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: validatedItems.reduce((sum, item) => sum + item.lineSubtotal, 0),
    };
    normalizedPayload.subtotal = normalizedPayload.summary.subtotal;
    normalizedPayload.discount = normalizeDiscountPayload(payload.discount || {}, normalizedPayload.subtotal);
    normalizedPayload.total = Math.max(
      0,
      normalizedPayload.subtotal - normalizedPayload.discount.amount + (normalizedPayload.taxes?.iva?.amount || 0)
    );
    normalizedPayload.payment = normalizePaymentPayload(payload.payment || {}, normalizedPayload.total);

    validateDiscountAuthorization({ normalizedPayload, admin });

    const orderNumber = await getNextOrderNumber({ session });
    const orderPayload = buildPosOrderPayload({ normalizedPayload, branch, orderNumber, admin });
    const createdOrders = await Order.create([orderPayload], { session });
    const order = createdOrders[0];

    const movements = await applyPosInventoryOut({
      order,
      validatedItems,
      branch,
      admin,
      session,
    });

    return {
      order,
      movements,
      branch,
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

  if (options.generateElectronicInvoice === true) {
    try {
      await generateElectronicInvoiceAfterPayment({
        orderId: result.order._id,
        paymentProvider: 'pos',
        transaction: {
          payment_method_type: result.order.payment?.methodType || 'pos',
          payment_method_name: result.order.payment?.methodLabel || 'Venta física',
          payment_method: result.order.payment?.method || 'pos',
          rawMethod: result.order.payment?.rawMethod || {},
        },
      });
    } catch (error) {
      console.error('[adminPosService] Error generando factura POS:', error.message);
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
  calculatePosTotals,
  validatePosBranch,
  loadAndValidatePosItems,
  buildPosOrderPayload,
  applyPosInventoryOut,
  createPosSale,
};
