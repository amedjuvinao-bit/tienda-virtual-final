'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');

const Branch = require('../../models/Branch');
const Cart = require('../../models/Cart');
const InventoryStock = require('../../models/InventoryStock');
const Product = require('../../models/Product');
const {
  getCartAccessSecret,
  issueCartAccess,
} = require('../../services/cartAccessService');
const {
  defaultCartCanonicalValidationService,
  toStoredCartItem,
} = require('../../services/cartCanonicalValidationService');

const TRACE_TAG = 'wompi-factus-sandbox';

function buildTraceIdentity(now = new Date()) {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  const numeric = String(
    1_000_000_000 + (parseInt(suffix, 16) % 1_000_000_000)
  );
  return {
    runId: `WFS-${now.toISOString().replace(/\D/g, '').slice(0, 14)}-${suffix}`,
    documentNumber: numeric,
    email: `wompi.factus.sandbox+${suffix.toLowerCase()}@example.com`,
  };
}

function candidateInput(stock) {
  return {
    _id: stock.product,
    productId: stock.product,
    quantity: 1,
    qty: 1,
    price: 0,
    variantId: stock.variantKey,
    variantKey: stock.variantKey,
    variantLabel: stock.variant?.label || '',
    variantAttributes: stock.variant?.attributes || [],
    size: stock.variant?.size || '',
    color: stock.variant?.color || '',
  };
}

async function findPurchasableInventoryItem() {
  const branches = await Branch.find({
    deletedAt: null,
    active: true,
    status: 'active',
    type: { $in: ['store', 'warehouse', 'pickup_point'] },
    'settings.allowInventoryMovements': { $ne: false },
  }).select('_id').lean();
  const branchIds = branches.map((branch) => branch._id);
  const stocks = await InventoryStock.find({
    branch: { $in: branchIds },
    active: true,
    deletedAt: null,
    $expr: { $gt: ['$stock', '$reservedStock'] },
  })
    .select('product variantKey variant stock reservedStock')
    .sort({ availableStock: -1, lastMovementAt: -1 })
    .limit(80)
    .lean();

  const candidates = [];
  for (const stock of stocks) {
    const product = await Product.findOne({
      _id: stock.product,
      active: { $ne: false },
      visible: { $ne: false },
      archivedAt: null,
      productType: 'physical',
      trackInventory: { $ne: false },
    }).select('_id price title').lean();
    if (!product) continue;

    const validation = await defaultCartCanonicalValidationService.validateItems(
      [candidateInput(stock)],
      { mode: 'strict' }
    );
    const item = validation.ok ? validation.items[0] : null;
    if (item && Number(item.price) > 0 && Number(item.availableStock) > 0) {
      candidates.push(item);
    }
  }

  candidates.sort((left, right) => Number(left.price) - Number(right.price));
  const selected = candidates[0];
  if (!selected) {
    throw Object.assign(
      new Error('No existe un producto físico visible con inventario elegible.'),
      { code: 'SANDBOX_TRACE_PRODUCT_UNAVAILABLE' }
    );
  }
  return selected;
}

async function createAuthorizedCart(item, identity) {
  const cartId = new mongoose.Types.ObjectId();
  const access = issueCartAccess({
    cartId,
    secret: getCartAccessSecret(),
  });
  const storedItem = toStoredCartItem(item);
  const cart = await Cart.create({
    _id: cartId,
    sessionId: access.sessionId,
    accessTokenHash: access.tokenHash,
    accessVersion: access.version,
    accessIssuedAt: new Date(),
    userName: 'Cliente Sandbox Wompi Factus',
    userEmail: identity.email,
    items: [{ ...storedItem, qty: 1, quantity: 1 }],
    adminTags: [TRACE_TAG],
    lastCustomerActivityAt: new Date(),
  });
  return { access, cart };
}

function buildCheckoutPayload({ item, identity, sessionId }) {
  const customer = {
    name: 'Cliente',
    lastname: `Sandbox ${identity.runId.slice(-8)}`,
    id: identity.documentNumber,
    documentType: 'CC',
    emailOrPhone: identity.email,
    email: identity.email,
    phone: '3000000000',
    address: 'Calle 93 # 12-34 - Prueba de habilitación',
    city: 'Bogotá D.C.',
    municipalityId: '11001',
    country: 'Colombia',
    countryCode: 'CO',
    department: 'Bogotá D.C.',
    departmentCode: '11',
    deliveryType: 'retiro',
    wantsNewsletter: false,
  };
  return {
    sessionId,
    cart: [{ ...toStoredCartItem(item), quantity: 1, qty: 1 }],
    subtotal: Number(item.price),
    shipping: 0,
    total: Number(item.price),
    customer,
    billing: {
      useSameAddress: true,
      personType: 'natural',
      documentType: 'CC',
      documentNumber: identity.documentNumber,
      firstName: customer.name,
      lastName: customer.lastname,
      email: identity.email,
      address: customer.address,
      city: customer.city,
      municipalityCode: customer.municipalityId,
      department: customer.department,
      departmentCode: customer.departmentCode,
      country: customer.country,
      countryCode: customer.countryCode,
      phone: customer.phone,
      tributeCode: 'ZZ',
    },
    payment: { provider: 'wompi' },
    storeCredit: { apply: false, amount: 0 },
  };
}

module.exports = {
  TRACE_TAG,
  buildCheckoutPayload,
  buildTraceIdentity,
  createAuthorizedCart,
  findPurchasableInventoryItem,
};
