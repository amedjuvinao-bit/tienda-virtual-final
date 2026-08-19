// backend/services/inventoryReservationService.js

const mongoose = require('mongoose');

const InventoryReservation = require('../models/InventoryReservation');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const {
  canonicalizeVariantKey,
  normalizeAttributes,
  resolveVariantIdentity,
} = require('../lib/products/productVariantConfig');
const {
  syncOrderInventoryAllocationsFromReservation,
} = require('./orderInventoryAllocationService');

const RAW_DEFAULT_RESERVATION_MINUTES = Number(process.env.INVENTORY_RESERVATION_MINUTES);

const DEFAULT_RESERVATION_MINUTES =
  Number.isFinite(RAW_DEFAULT_RESERVATION_MINUTES) && RAW_DEFAULT_RESERVATION_MINUTES > 0
    ? RAW_DEFAULT_RESERVATION_MINUTES
    : 30;

const PAYMENT_FAILURE_RELEASE_PREFIX = 'PAYMENT_FAILURE_RECOVERY';

function createServiceError(message, code, details = {}, statusCode = 400) {
  const error = new Error(message);

  error.code = code;
  error.details = details;
  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function normalizePaymentReferenceIdentity(value = '') {
  const reference = cleanUpper(value);
  if (!reference) return '';
  return reference.includes('__TRY__')
    ? reference.split('__TRY__')[0]
    : reference;
}

function encodeReleaseIdentity(value = '') {
  return encodeURIComponent(cleanText(value));
}

function decodeReleaseIdentity(value = '') {
  try {
    return decodeURIComponent(String(value || ''));
  } catch (_error) {
    return '';
  }
}

function buildPaymentFailureReleaseReason({
  provider = '',
  paymentStatus = '',
  orderNumber = '',
  paymentReference = '',
  paymentTransactionId = '',
} = {}) {
  const safeProvider = cleanText(provider).toLowerCase();
  const safeStatus = cleanText(paymentStatus).toLowerCase();
  const safeOrderNumber = cleanText(orderNumber);
  const safeReference = cleanText(paymentReference);
  const safeTransactionId = cleanText(paymentTransactionId);
  const canonicalReference = normalizePaymentReferenceIdentity(safeReference);
  const expectedCanonicalReference = normalizePaymentReferenceIdentity(
    `ORDER-${safeOrderNumber}`
  );

  if (!['failed', 'cancelled'].includes(safeStatus)) {
    throw createServiceError(
      'El estado no autoriza una liberacion por fallo de pago.',
      'INVALID_PAYMENT_FAILURE_RELEASE_STATUS',
      { paymentStatus: safeStatus },
      409
    );
  }
  if (
    !safeProvider ||
    !safeOrderNumber ||
    !safeReference ||
    !safeTransactionId ||
    canonicalReference !== expectedCanonicalReference
  ) {
    throw createServiceError(
      'La liberacion requiere una identidad de pago persistible y coherente.',
      'PAYMENT_FAILURE_RELEASE_IDENTITY_REQUIRED',
      {
        provider: safeProvider,
        orderNumber: safeOrderNumber,
        canonicalReference,
      },
      409
    );
  }

  return [
    PAYMENT_FAILURE_RELEASE_PREFIX,
    'operation=inventory_release',
    `provider=${encodeReleaseIdentity(safeProvider)}`,
    `status=${encodeReleaseIdentity(safeStatus)}`,
    `order=${encodeReleaseIdentity(safeOrderNumber)}`,
    `reference=${encodeReleaseIdentity(safeReference)}`,
    `canonicalReference=${encodeReleaseIdentity(canonicalReference)}`,
    `transaction=${encodeReleaseIdentity(safeTransactionId)}`,
  ].join('|');
}

function parsePaymentFailureReleaseReason(value = '') {
  const source = cleanText(value);
  const parts = source.split('|');
  if (parts.shift() !== PAYMENT_FAILURE_RELEASE_PREFIX) return null;

  const result = {};
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator <= 0) return null;
    result[part.slice(0, separator)] = decodeReleaseIdentity(
      part.slice(separator + 1)
    );
  }

  if (
    !['failed', 'cancelled'].includes(result.status) ||
    result.operation !== 'inventory_release' ||
    !result.provider ||
    !result.order ||
    !result.reference ||
    !result.canonicalReference ||
    !result.transaction
  ) {
    return null;
  }
  return result;
}

function normalizeVariantValue(value) {
  return cleanText(value);
}

function getObjectIdValue(value) {
  if (!value) return '';

  if (typeof value === 'object') {
    return String(value._id || value.id || value);
  }

  return String(value);
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function toObjectId(value, fieldName = 'id') {
  const cleanValue = getObjectIdValue(value);

  if (!isValidObjectId(cleanValue)) {
    throw createServiceError(
      `El campo ${fieldName} no tiene un ObjectId válido.`,
      'INVALID_OBJECT_ID',
      {
        field: fieldName,
        value: cleanValue,
      },
      400
    );
  }

  return new mongoose.Types.ObjectId(cleanValue);
}

function toNumber(value, defaultValue = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return defaultValue;

  return number;
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

function getProductSnapshot(product = {}, fallbackItem = {}) {
  return {
    title: cleanText(product.title || fallbackItem.title || fallbackItem.name || ''),
    sku: cleanUpper(product.sku || fallbackItem.sku || ''),
    image: cleanText(getProductImage(product) || fallbackItem.image || ''),
    category: cleanText(product.category || fallbackItem.category || ''),
  };
}

function getBranchSnapshot(branch = {}) {
  return {
    name: cleanText(branch.name || branch.title || ''),
    code: cleanUpper(branch.code || ''),
    type: cleanText(branch.type || '').toLowerCase(),
  };
}

function getAvailableFromStock(stock = {}) {
  const physicalStock = toNumber(stock.stock, 0);
  const reservedStock = toNumber(stock.reservedStock, 0);

  return Math.max(0, physicalStock - reservedStock);
}

function normalizeCartItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createServiceError(
      'La reserva necesita al menos un producto.',
      'EMPTY_RESERVATION_ITEMS',
      {},
      400
    );
  }

  return items.map((item, index) => {
    const productId =
      getObjectIdValue(item.productId) ||
      getObjectIdValue(item.product) ||
      getObjectIdValue(item._id);

    const size = normalizeVariantValue(item.size || item.talla || item.variant?.size);
    const color = normalizeVariantValue(item.color || item.variant?.color);
    const variantAttributes = normalizeAttributes(
      item.variantAttributes ||
        item.attributes ||
        item.variant?.attributes ||
        []
    );
    const identity = resolveVariantIdentity({
      variantKey: item.variantKey || item.variantId,
      size,
      color,
      attributes: variantAttributes,
    });
    const quantity = toNumber(item.quantity || item.qty || item.cantidad, 0);
    const unitPrice = toNumber(item.unitPrice || item.price || item.precio, 0);

    if (!productId || !isValidObjectId(productId)) {
      throw createServiceError(
        `El producto de la posición ${index + 1} no tiene un ID válido.`,
        'INVALID_PRODUCT_ID',
        {
          index,
          productId,
        },
        400
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createServiceError(
        `La cantidad del producto en la posición ${index + 1} debe ser mayor a cero.`,
        'INVALID_QUANTITY',
        {
          index,
          productId,
          quantity,
        },
        400
      );
    }

    return {
      originalItem: item,
      orderItem:
        getObjectIdValue(item.orderItem || item._id) || null,
      productId,
      productObjectId: toObjectId(productId, `items[${index}].productId`),
      size: identity.size,
      color: identity.color,
      variantLabel: cleanText(
        item.variantLabel || item.variant?.label || ''
      ),
      variantAttributes: identity.attributes,
      variantKey: identity.variantKey,
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
      title: cleanText(item.title || item.name || ''),
      sku: cleanUpper(item.sku || ''),
      image: cleanText(item.image || ''),
      category: cleanText(item.category || ''),
      bundleParentProduct:
        getObjectIdValue(item.bundleParentProduct) || null,
      bundleParentTitle: cleanText(item.bundleParentTitle || ''),
    };
  });
}

function buildStockVariantFilter(item) {
  const filter = {
    product: item.productObjectId,
    active: true,
    deletedAt: null,
  };

  if (
    item.variantKey &&
    item.variantKey !== 'default__default'
  ) {
    filter.variantKey = item.variantKey;
    return filter;
  }

  filter.$or = [
      {
        size: item.size,
        color: item.color,
      },
      {
        'variant.size': item.size,
        'variant.color': item.color,
      },
    ];

  return filter;
}

function sortStocksByPriority(stocks = [], branchPriorityIds = []) {
  const priorityMap = new Map(
    branchPriorityIds.map((branchId, index) => [String(branchId), index])
  );

  return [...stocks].sort((a, b) => {
    const branchA = String(a.branch || a.branchId || '');
    const branchB = String(b.branch || b.branchId || '');

    const priorityA = priorityMap.has(branchA) ? priorityMap.get(branchA) : 9999;
    const priorityB = priorityMap.has(branchB) ? priorityMap.get(branchB) : 9999;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const availableA = getAvailableFromStock(a);
    const availableB = getAvailableFromStock(b);

    return availableB - availableA;
  });
}

async function withTransaction(work, externalSession = null) {
  if (externalSession) {
    return work(externalSession);
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await work(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
}

async function loadProductMap(items, session) {
  const productIds = [...new Set(items.map((item) => item.productId))];

  const products = await Product.find({
    _id: {
      $in: productIds.map((productId) => toObjectId(productId, 'productId')),
    },
  })
    .select(
      'title sku image images category productType trackInventory allowBackorder bundleComponents active visible archivedAt'
    )
    .session(session)
    .lean();

  return new Map(products.map((product) => [String(product._id), product]));
}

async function expandReservableItems(
  items = [],
  {
    session = null,
    ProductModel = Product,
  } = {}
) {
  const sourceItems = Array.isArray(items) ? items : [];
  if (!sourceItems.length) return [];

  const productIds = Array.from(
    new Set(
      sourceItems
        .map((item) =>
          getObjectIdValue(
            item.productId || item.product || item._id
          )
        )
        .filter((id) => isValidObjectId(id))
    )
  );

  let query = ProductModel.find({
    _id: {
      $in: productIds.map((id) => toObjectId(id, 'productId')),
    },
  }).select(
    'title sku image productType trackInventory allowBackorder bundleComponents active visible archivedAt'
  );

  if (session && typeof query.session === 'function') {
    query = query.session(session);
  }

  const products = await query.lean();
  const productMap = new Map(
    products.map((product) => [String(product._id), product])
  );
  const expanded = [];

  for (const item of sourceItems) {
    const productId = getObjectIdValue(
      item.productId || item.product || item._id
    );
    const product = productMap.get(productId);

    if (!product) continue;

    if (product.productType === 'bundle') {
      for (const component of product.bundleComponents || []) {
        if (
          component.trackInventory === false ||
          component.allowBackorder === true
        ) {
          continue;
        }

        const componentIdentity = resolveVariantIdentity({
          variantKey: component.variantKey,
          size: component.size,
          color: component.color,
          attributes:
            component.variantAttributes || component.attributes || [],
        });

        expanded.push({
          orderItem:
            getObjectIdValue(item.orderItem || item._id) || null,
          productId: getObjectIdValue(component.product),
          title: component.title || '',
          image: component.image || '',
          sku: component.sku || '',
          size: componentIdentity.size,
          color: componentIdentity.color,
          variantLabel: component.variantLabel || '',
          variantAttributes: componentIdentity.attributes,
          variantKey: componentIdentity.variantKey,
          quantity:
            Math.max(1, Number(item.quantity || item.qty || 1)) *
            Math.max(1, Number(component.quantity || 1)),
          unitPrice: 0,
          price: 0,
          bundleParentProduct: product._id,
          bundleParentTitle: product.title || item.title || '',
        });
      }
      continue;
    }

    if (
      product.trackInventory === false ||
      product.allowBackorder === true
    ) {
      continue;
    }

    expanded.push(item);
  }

  return expanded;
}

async function loadBranchMap(branchIds, session) {
  const cleanBranchIds = [...new Set(branchIds.map(String).filter(Boolean))];

  if (cleanBranchIds.length === 0) return new Map();

  const branches = await Branch.find({
    _id: {
      $in: cleanBranchIds.map((branchId) => toObjectId(branchId, 'branchId')),
    },
  })
    .select('name code type')
    .session(session)
    .lean();

  return new Map(branches.map((branch) => [String(branch._id), branch]));
}

function buildReservationStockUpdate(quantityToReserve) {
  return [
    {
      $set: {
        reservedStock: {
          $add: [
            {
              $ifNull: ['$reservedStock', 0],
            },
            quantityToReserve,
          ],
        },
        availableStock: {
          $max: [
            0,
            {
              $subtract: [
                '$stock',
                {
                  $add: [
                    {
                      $ifNull: ['$reservedStock', 0],
                    },
                    quantityToReserve,
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  ];
}

function resolveReservationStockVariant(stock, requestedVariantKey = '') {
  const stockIdentity = resolveVariantIdentity({
    variantKey: stock?.variantKey,
    size: stock?.variant?.size,
    color: stock?.variant?.color,
    attributes: stock?.variant?.attributes || [],
  });
  const requestedKey = canonicalizeVariantKey(requestedVariantKey);

  if (requestedVariantKey && requestedKey !== stockIdentity.variantKey) {
    throw createServiceError(
      'La variante solicitada no coincide con la fila de inventario seleccionada.',
      'VARIANT_KEY_MISMATCH',
      {
        inventoryStock: String(stock?._id || ''),
        requestedVariantKey,
        stockVariantKey: stockIdentity.variantKey,
      },
      409
    );
  }

  return stockIdentity;
}

function buildReleaseStockUpdate(quantityToRelease) {
  return [
    {
      $set: {
        reservedStock: {
          $max: [
            0,
            {
              $subtract: [
                {
                  $ifNull: ['$reservedStock', 0],
                },
                quantityToRelease,
              ],
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
      },
    },
  ];
}

function buildConfirmStockUpdate(quantityToConfirm) {
  return [
    {
      $set: {
        stock: {
          $max: [
            0,
            {
              $subtract: ['$stock', quantityToConfirm],
            },
          ],
        },
        reservedStock: {
          $max: [
            0,
            {
              $subtract: [
                {
                  $ifNull: ['$reservedStock', 0],
                },
                quantityToConfirm,
              ],
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
      },
    },
  ];
}

async function reserveFromStockRow({
  stock,
  item,
  product,
  branch,
  quantityToReserve,
  session,
}) {
  const stockBeforeReservation = toNumber(stock.stock, 0);
  const reservedBeforeReservation = toNumber(stock.reservedStock, 0);
  const availableBeforeReservation = getAvailableFromStock(stock);

  const updatedStock = await InventoryStock.findOneAndUpdate(
    {
      _id: stock._id,
      active: true,
      deletedAt: null,
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
          quantityToReserve,
        ],
      },
    },
    buildReservationStockUpdate(quantityToReserve),
    {
      new: true,
      session,
      runValidators: false,
    }
  );

  if (!updatedStock) {
    throw createServiceError(
      'El inventario cambió mientras se intentaba reservar. Intenta nuevamente.',
      'CONCURRENT_STOCK_CHANGE',
      {
        productId: item.productId,
        size: item.size,
        color: item.color,
        stockId: String(stock._id),
      },
      409
    );
  }

  const stockIdentity = resolveReservationStockVariant(
    stock,
    item.variantKey
  );

  return {
    product: item.productObjectId,
    inventoryStock: stock._id,
    branch: stock.branch,
    orderItem:
      item.orderItem && isValidObjectId(item.orderItem)
        ? toObjectId(item.orderItem, 'orderItem')
        : null,
    productSnapshot: getProductSnapshot(product, item),
    branchSnapshot: getBranchSnapshot(branch),
    size: stockIdentity.size,
    color: stockIdentity.color,
    variantLabel:
      stock.variant?.label || item.variantLabel || '',
    variantAttributes: stockIdentity.attributes,
    variantKey: stockIdentity.variantKey,
    bundleParentProduct: item.bundleParentProduct || null,
    bundleParentTitle: item.bundleParentTitle || '',
    quantity: quantityToReserve,
    unitPrice: item.unitPrice,
    lineTotal: quantityToReserve * item.unitPrice,
    stockBeforeReservation,
    reservedBeforeReservation,
    availableBeforeReservation,
  };
}

async function releaseReservedItems({
  items = [],
  session,
  InventoryStockModel = InventoryStock,
}) {
  for (const item of items) {
    const quantity = toNumber(item.quantity, 0);

    if (!item.inventoryStock || quantity <= 0) continue;

    const identity = resolveVariantIdentity({
      variantKey: item.variantKey,
      size: item.size,
      color: item.color,
      attributes: item.variantAttributes || [],
    });

    const result = await InventoryStockModel.updateOne(
      {
        _id: item.inventoryStock,
        ...(item.branch ? { branch: item.branch } : {}),
        ...(item.product ? { product: item.product } : {}),
        variantKey: identity.variantKey,
        reservedStock: { $gte: quantity },
      },
      buildReleaseStockUpdate(quantity),
      {
        session,
      }
    );

    if (Number(result?.matchedCount || 0) !== 1) {
      throw createServiceError(
        'No se pudo liberar completamente la fila reservada.',
        'RESERVED_STOCK_RELEASE_FAILED',
        {
          inventoryStock: String(item.inventoryStock),
          branch: String(item.branch || ''),
          product: String(item.product || ''),
          variantKey: identity.variantKey,
          quantity,
        },
        409
      );
    }
  }
}

async function allocateReservationItems({
  items,
  branchPriorityIds = [],
  session,
}) {
  const normalizedItems = normalizeCartItems(items);
  const productMap = await loadProductMap(normalizedItems, session);

  const reservationItems = [];
  const insufficientItems = [];
  const usedBranchIds = new Set();

  for (const item of normalizedItems) {
    let remainingQuantity = item.quantity;

    const rawStocks = await InventoryStock.find(buildStockVariantFilter(item))
      .select(
        'product branch stock reservedStock availableStock size color variant productSnapshot branchSnapshot'
      )
      .session(session)
      .lean();

    const stocks = sortStocksByPriority(rawStocks, branchPriorityIds);

    const branchIdsForItem = stocks.map((stock) => String(stock.branch || ''));
    const branchMap = await loadBranchMap(branchIdsForItem, session);

    for (const stock of stocks) {
      if (remainingQuantity <= 0) break;

      const availableStock = getAvailableFromStock(stock);

      if (availableStock <= 0) continue;

      const quantityToReserve = Math.min(remainingQuantity, availableStock);
      const product = productMap.get(item.productId) || {};
      const branchId = String(stock.branch || '');
      const branch = branchMap.get(branchId) || {};

      const reservedItem = await reserveFromStockRow({
        stock,
        item,
        product,
        branch,
        quantityToReserve,
        session,
      });

      reservationItems.push(reservedItem);
      usedBranchIds.add(branchId);

      remainingQuantity -= quantityToReserve;
    }

    if (remainingQuantity > 0) {
      insufficientItems.push({
        productId: item.productId,
        title: item.title || productMap.get(item.productId)?.title || '',
        sku: item.sku || productMap.get(item.productId)?.sku || '',
        size: item.size,
        color: item.color,
        requestedQuantity: item.quantity,
        missingQuantity: remainingQuantity,
      });
    }
  }

  if (insufficientItems.length > 0) {
    await releaseReservedItems({
      items: reservationItems,
      session,
    });

    throw createServiceError(
      'No hay inventario suficiente para completar la reserva.',
      'INSUFFICIENT_STOCK',
      {
        insufficientItems,
      },
      409
    );
  }

  return {
    reservationItems,
    usedBranchIds: Array.from(usedBranchIds),
  };
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

  const totalStock = rows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.stock || 0)),
    0
  );

  await Product.updateOne(
    {
      _id: toObjectId(productId, 'productId'),
    },
    {
      $set: {
        stock: totalStock,
      },
    },
    {
      session,
    }
  );

  return totalStock;
}

async function createSaleOutMovementFromReservationItem({
  reservation,
  reservationItem,
  inventoryStock,
  stockBefore,
  stockAfter,
  order = null,
  orderNumber = '',
  paymentReference = '',
  paymentTransactionId = '',
  session,
}) {
  const quantity = toNumber(reservationItem.quantity, 0);

  if (!quantity) return null;

  const reference =
    cleanUpper(paymentReference) ||
    cleanUpper(paymentTransactionId) ||
    cleanUpper(orderNumber) ||
    cleanUpper(reservation.reservationCode);
  const stockIdentity = resolveReservationStockVariant(
    inventoryStock,
    reservationItem.variantKey
  );

  const movement = new InventoryMovement({
    type: 'sale_out',
    direction: 'out',
    status: 'posted',

    product: reservationItem.product,
    productSnapshot: reservationItem.productSnapshot || {},
    variant: {
      size: stockIdentity.size,
      color: stockIdentity.color,
      label: reservationItem.variantLabel || '',
      attributes: stockIdentity.attributes,
      sku: reservationItem.productSnapshot?.sku || '',
      barcode: '',
    },
    variantKey: stockIdentity.variantKey,

    branchFrom: reservationItem.branch,
    branchFromSnapshot: reservationItem.branchSnapshot || {},

    branchTo: null,
    branchToSnapshot: {},

    quantity,

    stockFrom: {
      before: stockBefore,
      quantity,
      after: stockAfter,
    },

    stockTo: {
      before: 0,
      quantity: 0,
      after: 0,
    },

    unitCost: 0,
    totalCost: 0,

    reason: 'Salida automática por venta confirmada',
    notes: `Reserva ${reservation.reservationCode || reservation._id} confirmada.`,
    reference,

    order: order || reservation.order || null,
    orderNumber: cleanUpper(orderNumber || reservation.orderNumber || ''),

    sourceModel: 'InventoryReservation',
    sourceId: reservation._id,

    createdBy: null,
    updatedBy: null,
    postedBy: null,
    postedAt: new Date(),
  });

  await movement.save({ session });

  return movement;
}

async function createInventoryReservation({
  sessionId = '',
  order = null,
  orderNumber = '',
  paymentReference = '',
  paymentTransactionId = '',
  source = 'checkout',
  items = [],
  branchPriorityIds = [],
  expiresInMinutes = DEFAULT_RESERVATION_MINUTES,
  currency = 'COP',
  metadata = {},
  notes = '',
} = {}, options = {}) {
  return withTransaction(async (session) => {
    const safeExpiresInMinutes =
      Number.isFinite(Number(expiresInMinutes)) && Number(expiresInMinutes) > 0
        ? Number(expiresInMinutes)
        : DEFAULT_RESERVATION_MINUTES;

    const expiresAt = new Date(Date.now() + safeExpiresInMinutes * 60 * 1000);

    const reservableItems = await expandReservableItems(items, {
      session,
    });

    if (!reservableItems.length) {
      return null;
    }

    const { reservationItems, usedBranchIds } = await allocateReservationItems({
      items: reservableItems,
      branchPriorityIds,
      session,
    });

    const subtotal = reservationItems.reduce((sum, item) => {
      return sum + toNumber(item.lineTotal, 0);
    }, 0);

    const totalQuantity = reservationItems.reduce((sum, item) => {
      return sum + toNumber(item.quantity, 0);
    }, 0);

    const [reservation] = await InventoryReservation.create(
      [
        {
          sessionId: cleanText(sessionId),
          order: order ? toObjectId(order, 'order') : null,
          orderNumber: cleanText(orderNumber),
          paymentReference: cleanText(paymentReference),
          paymentTransactionId: cleanText(paymentTransactionId),
          source,
          status: 'pending',
          items: reservationItems,
          totalQuantity,
          subtotal,
          total: subtotal,
          currency,
          expiresAt,
          notes: cleanText(notes),
          metadata: {
            ...metadata,
            usedBranchIds,
          },
        },
      ],
      {
        session,
      }
    );

    return reservation;
  }, options.session || null);
}

async function findReservation(identifier, session) {
  if (!identifier) {
    throw createServiceError(
      'Debes enviar el identificador de la reserva.',
      'MISSING_RESERVATION_IDENTIFIER',
      {},
      400
    );
  }

  const cleanIdentifier = String(identifier);

  const filter = isValidObjectId(cleanIdentifier)
    ? { _id: cleanIdentifier }
    : {
        $or: [
          { reservationCode: cleanIdentifier },
          { orderNumber: cleanIdentifier },
          { paymentReference: cleanIdentifier },
          { paymentTransactionId: cleanIdentifier },
        ],
      };

  const reservation = await InventoryReservation.findOne(filter).session(session);

  if (!reservation) {
    throw createServiceError(
      'No se encontró la reserva de inventario.',
      'RESERVATION_NOT_FOUND',
      {
        identifier: cleanIdentifier,
      },
      404
    );
  }

  return reservation;
}

async function releaseInventoryReservation(
  identifier,
  {
    status = 'released',
    releaseReason = 'Reserva liberada',
    paymentReference = '',
    paymentTransactionId = '',
  } = {},
  options = {}
) {
  return withTransaction(async (session) => {
    const reservation = await findReservation(identifier, session);

    if (reservation.status !== 'pending') {
      if (options.syncOrderAllocations !== false) {
        await syncOrderInventoryAllocationsFromReservation(
          reservation,
          {
            session,
            orderId: reservation.order,
          }
        );
      }
      return reservation;
    }

    await releaseReservedItems({
      items: reservation.items,
      session,
    });

    const now = new Date();

    reservation.status = status;
    reservation.releaseReason = cleanText(releaseReason);
    if (paymentReference) {
      reservation.paymentReference = cleanText(paymentReference);
    }
    if (paymentTransactionId) {
      reservation.paymentTransactionId = cleanText(paymentTransactionId);
    }

    if (status === 'expired') {
      reservation.expiredAt = now;
    } else if (status === 'cancelled') {
      reservation.cancelledAt = now;
    } else if (status === 'failed') {
      reservation.failedAt = now;
    } else {
      reservation.releasedAt = now;
    }

    reservation.items.forEach((item) => {
      item.releasedAt = now;
    });

    await reservation.save({ session });

    if (options.syncOrderAllocations !== false) {
      await syncOrderInventoryAllocationsFromReservation(
        reservation,
        {
          session,
          orderId: reservation.order,
        }
      );
    }

    return reservation;
  }, options.session || null);
}

async function reconcilePaymentFailureReservation(
  identifier,
  {
    order = null,
    orderNumber = '',
    provider = 'wompi',
    paymentReference = '',
    paymentTransactionId = '',
  } = {},
  options = {}
) {
  return withTransaction(async (session) => {
    const reservation =
      typeof options.findReservation === 'function'
        ? await options.findReservation(identifier, session)
        : await findReservation(identifier, session);
    const InventoryStockModel = options.InventoryStockModel || InventoryStock;
    const expectedOrderId = getObjectIdValue(order);
    const reservationOrderId = getObjectIdValue(reservation.order);
    const expectedOrderNumber = cleanText(orderNumber);
    const reservationOrderNumber = cleanText(reservation.orderNumber);
    const expectedProvider = cleanText(provider).toLowerCase();
    const expectedReference = cleanText(paymentReference);
    const expectedTransactionId = cleanText(paymentTransactionId);
    const expectedCanonicalReference = normalizePaymentReferenceIdentity(
      expectedReference
    );
    const orderCanonicalReference = normalizePaymentReferenceIdentity(
      `ORDER-${expectedOrderNumber}`
    );
    const reservationReference = cleanText(reservation.paymentReference);
    const reservationTransactionId = cleanText(
      reservation.paymentTransactionId
    );

    if (
      (expectedOrderId && reservationOrderId !== expectedOrderId) ||
      (expectedOrderNumber && reservationOrderNumber !== expectedOrderNumber) ||
      !expectedProvider ||
      !expectedReference ||
      !expectedTransactionId ||
      !expectedCanonicalReference ||
      expectedCanonicalReference !== orderCanonicalReference
    ) {
      throw createServiceError(
        'La reserva liberada no pertenece a la misma orden y operacion de pago.',
        'PAYMENT_FAILURE_RESERVATION_OWNERSHIP_MISMATCH',
        {
          reservationId: reservation._id,
          expectedOrderId,
          reservationOrderId,
          expectedOrderNumber,
          reservationOrderNumber,
        },
        409
      );
    }

    if (reservation.status === 'confirmed') return reservation;

    const releaseEvidence = parsePaymentFailureReleaseReason(
      reservation.releaseReason
    );
    if (
      !['failed', 'cancelled'].includes(reservation.status) ||
      !releaseEvidence ||
      releaseEvidence.provider !== expectedProvider ||
      releaseEvidence.order !== expectedOrderNumber ||
      releaseEvidence.status !== reservation.status ||
      releaseEvidence.canonicalReference !== expectedCanonicalReference ||
      normalizePaymentReferenceIdentity(releaseEvidence.reference) !==
        expectedCanonicalReference ||
      reservationReference !== releaseEvidence.reference ||
      reservationTransactionId !== releaseEvidence.transaction
    ) {
      throw createServiceError(
        'La reserva no fue liberada por este flujo de pago fallido.',
        'PAYMENT_FAILURE_RESERVATION_NOT_RECONCILABLE',
        {
          reservationId: reservation._id,
          status: reservation.status,
        },
        409
      );
    }

    if (reservation.confirmedAt || reservation.expiredAt || reservation.releasedAt) {
      throw createServiceError(
        'La reserva conserva evidencia terminal ajena a una liberacion reconciliable.',
        'PAYMENT_FAILURE_RESERVATION_TERMINAL_EVIDENCE',
        {
          reservationId: reservation._id,
          status: reservation.status,
        },
        409
      );
    }

    for (const item of reservation.items || []) {
      const quantity = toNumber(item.quantity, 0);
      if (
        !item.inventoryStock ||
        !item.branch ||
        !item.product ||
        quantity <= 0 ||
        !item.releasedAt ||
        item.confirmedAt ||
        item.saleMovement
      ) {
        throw createServiceError(
          'Una linea de la reserva liberada no conserva evidencia reconciliable.',
          'PAYMENT_FAILURE_RESERVATION_ITEM_INVALID',
          {
            reservationId: reservation._id,
            reservationItem: item?._id || null,
          },
          409
        );
      }

      const identity = resolveVariantIdentity({
        variantKey: item.variantKey,
        size: item.size,
        color: item.color,
        attributes: item.variantAttributes || [],
      });
      const updatedStock = await InventoryStockModel.findOneAndUpdate(
        {
          _id: item.inventoryStock,
          branch: item.branch,
          product: item.product,
          variantKey: identity.variantKey,
          active: true,
          deletedAt: null,
          $expr: {
            $gte: [
              {
                $subtract: [
                  '$stock',
                  { $ifNull: ['$reservedStock', 0] },
                ],
              },
              quantity,
            ],
          },
        },
        buildReservationStockUpdate(quantity),
        { new: true, session, runValidators: false }
      );

      if (!updatedStock) {
        throw createServiceError(
          'El stock liberado ya no esta disponible para reconciliar la aprobacion.',
          'PAYMENT_FAILURE_RESERVATION_RECONCILIATION_UNAVAILABLE',
          {
            reservationId: reservation._id,
            reservationItem: item._id,
            inventoryStock: item.inventoryStock,
            quantity,
          },
          503
        );
      }
      item.releasedAt = null;
    }

    reservation.status = 'pending';
    reservation.failedAt = null;
    reservation.cancelledAt = null;
    reservation.releaseReason = '';
    await reservation.save({ session });
    return reservation;
  }, options.session || null);
}

async function confirmInventoryReservation(
  identifier,
  {
    order = null,
    orderNumber = '',
    paymentReference = '',
    paymentTransactionId = '',
  } = {},
  options = {}
) {
  return withTransaction(async (session) => {
    const reservation = await findReservation(identifier, session);

    if (reservation.status === 'confirmed') {
      if (options.syncOrderAllocations !== false) {
        await syncOrderInventoryAllocationsFromReservation(
          reservation,
          {
            session,
            orderId: order || reservation.order,
          }
        );
      }
      return reservation;
    }

    if (reservation.status !== 'pending') {
      throw createServiceError(
        `La reserva no se puede confirmar porque está en estado ${reservation.status}.`,
        'RESERVATION_NOT_CONFIRMABLE',
        {
          reservationId: reservation._id,
          status: reservation.status,
        },
        409
      );
    }

    if (reservation.isExpired()) {
      await releaseInventoryReservation(
        reservation._id,
        {
          status: 'expired',
          releaseReason: 'Reserva vencida antes de confirmar el pago',
        },
        {
          session,
        }
      );

      throw createServiceError(
        'La reserva está vencida y no puede confirmarse.',
        'RESERVATION_EXPIRED',
        {
          reservationId: reservation._id,
        },
        409
      );
    }

    const now = new Date();
    const affectedProducts = new Set();

    for (const item of reservation.items) {
      const quantity = toNumber(item.quantity, 0);

      if (!item.inventoryStock || quantity <= 0) continue;

      const stockBeforeDoc = await InventoryStock.findOne({
        _id: item.inventoryStock,
        stock: {
          $gte: quantity,
        },
        reservedStock: {
          $gte: quantity,
        },
      })
        .session(session)
        .lean();

      if (!stockBeforeDoc) {
        throw createServiceError(
          'No se pudo confirmar la reserva porque el stock reservado ya no está disponible.',
          'RESERVED_STOCK_NOT_AVAILABLE',
          {
            reservationId: reservation._id,
            inventoryStock: item.inventoryStock,
            quantity,
          },
          409
        );
      }

      const stockBefore = toNumber(stockBeforeDoc.stock, 0);
      const stockAfter = Math.max(0, stockBefore - quantity);

      const updatedStock = await InventoryStock.findOneAndUpdate(
        {
          _id: item.inventoryStock,
          stock: {
            $gte: quantity,
          },
          reservedStock: {
            $gte: quantity,
          },
        },
        buildConfirmStockUpdate(quantity),
        {
          new: true,
          session,
          runValidators: false,
        }
      );

      if (!updatedStock) {
        throw createServiceError(
          'El inventario cambió mientras se confirmaba la reserva.',
          'CONCURRENT_CONFIRMATION_CHANGE',
          {
            reservationId: reservation._id,
            inventoryStock: item.inventoryStock,
            quantity,
          },
          409
        );
      }

      const movement = await createSaleOutMovementFromReservationItem({
        reservation,
        reservationItem: item,
        inventoryStock: updatedStock,
        stockBefore,
        stockAfter,
        order: order || reservation.order || null,
        orderNumber: orderNumber || reservation.orderNumber || '',
        paymentReference: paymentReference || reservation.paymentReference || '',
        paymentTransactionId: paymentTransactionId || reservation.paymentTransactionId || '',
        session,
      });

      await InventoryStock.updateOne(
        {
          _id: item.inventoryStock,
        },
        {
          $set: {
            lastMovement: movement?._id || null,
            lastMovementAt: now,
          },
        },
        {
          session,
        }
      );

      item.saleMovement = movement?._id || null;
      item.confirmedAt = now;
      affectedProducts.add(String(item.product || ''));
    }

    reservation.status = 'confirmed';
    reservation.confirmedAt = now;

    if (order) {
      reservation.order = toObjectId(order, 'order');
    }

    if (orderNumber) {
      reservation.orderNumber = cleanText(orderNumber);
    }

    if (paymentReference) {
      reservation.paymentReference = cleanText(paymentReference);
    }

    if (paymentTransactionId) {
      reservation.paymentTransactionId = cleanText(paymentTransactionId);
    }

    await reservation.save({ session });

    for (const productId of affectedProducts) {
      if (productId) {
        await syncProductTotalStock(productId, { session });
      }
    }

    if (options.syncOrderAllocations !== false) {
      await syncOrderInventoryAllocationsFromReservation(
        reservation,
        {
          session,
          orderId: order || reservation.order,
        }
      );
    }

    return reservation;
  }, options.session || null);
}

async function expireInventoryReservations({ limit = 50 } = {}, options = {}) {
  return withTransaction(async (session) => {
    const now = new Date();

    const reservations = await InventoryReservation.find({
      status: 'pending',
      expiresAt: {
        $lte: now,
      },
    })
      .sort({ expiresAt: 1 })
      .limit(Number(limit || 50))
      .session(session);

    const expiredReservations = [];

    for (const reservation of reservations) {
      await releaseReservedItems({
        items: reservation.items,
        session,
      });

      reservation.status = 'expired';
      reservation.expiredAt = now;
      reservation.releaseReason = 'Reserva vencida automáticamente';

      reservation.items.forEach((item) => {
        item.releasedAt = now;
      });

      await reservation.save({ session });

      if (options.syncOrderAllocations !== false) {
        await syncOrderInventoryAllocationsFromReservation(
          reservation,
          {
            session,
            orderId: reservation.order,
          }
        );
      }

      expiredReservations.push(reservation);
    }

    return {
      count: expiredReservations.length,
      reservations: expiredReservations,
    };
  }, options.session || null);
}

module.exports = {
  DEFAULT_RESERVATION_MINUTES,
  PAYMENT_FAILURE_RELEASE_PREFIX,
  buildPaymentFailureReleaseReason,
  buildStockVariantFilter,
  createInventoryReservation,
  confirmInventoryReservation,
  reconcilePaymentFailureReservation,
  releaseInventoryReservation,
  expireInventoryReservations,
  allocateReservationItems,
  expandReservableItems,
  releaseReservedItems,
  resolveReservationStockVariant,
  buildReleaseStockUpdate,
  parsePaymentFailureReleaseReason,
  createServiceError,
  getAvailableFromStock,
  normalizePaymentReferenceIdentity,
};
