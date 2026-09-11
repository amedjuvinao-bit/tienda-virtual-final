'use strict';

const Coupon = require('../models/Coupon');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const couponService = require('./couponService');
const { resolveAuthoritativeItems } = require('./orderPricingService');

function clean(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

async function getCouponCampaignMetadata() {
  const [products, customers, branches] = await Promise.all([
    Product.find({
      active: { $ne: false },
      visible: { $ne: false },
      archivedAt: null,
    })
      .select('_id title sku category categories price')
      .sort({ title: 1 })
      .limit(500)
      .lean(),
    Customer.find({ deletedAt: null, active: { $ne: false }, status: { $ne: 'blocked' } })
      .select('_id customerCode fullName displayName documentType documentNumber email stats.ordersCount')
      .sort({ fullName: 1 })
      .limit(500)
      .lean(),
    Branch.find({ status: 'active' })
      .select('_id name code type')
      .sort({ name: 1 })
      .lean(),
  ]);

  const categories = Array.from(new Set(products.flatMap((product) => [
    product.category,
    ...(Array.isArray(product.categories) ? product.categories : []),
  ]).map((value) => clean(value, 120)).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'es'));

  return {
    products: products.map((product) => ({
      id: String(product._id),
      title: clean(product.title),
      sku: clean(product.sku, 120),
      category: clean(product.category, 120),
      categories: Array.isArray(product.categories) ? product.categories.map((value) => clean(value, 120)).filter(Boolean) : [],
      price: Number(product.price || 0),
    })),
    categories,
    customers: customers.map((customer) => ({
      id: String(customer._id),
      customerCode: clean(customer.customerCode, 80),
      name: clean(customer.displayName || customer.fullName),
      documentType: clean(customer.documentType, 20),
      documentNumber: clean(customer.documentNumber, 80),
      email: clean(customer.email, 180),
      ordersCount: Number(customer.stats?.ordersCount || 0),
    })),
    branches: branches.map((branch) => ({
      id: String(branch._id),
      name: clean(branch.name),
      code: clean(branch.code, 80),
      type: clean(branch.type, 40),
    })),
  };
}

async function simulateCouponCampaign(input = {}, options = {}) {
  const payload = couponService.cleanCouponPayload(input.coupon || input);
  const coupon = new Coupon(payload);
  const validationError = coupon.validateSync();
  if (validationError) throw validationError;

  const items = await resolveAuthoritativeItems(input.items || input.cart || [], {
    session: options.session || null,
  });
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const validation = await couponService.validateCouponDefinition(coupon, {
    ...input,
    code: payload.code,
    items,
    subtotal,
    shippingAmount: Number(input.shippingAmount || 0),
  }, options);

  return {
    validation,
    cart: {
      subtotal,
      items: items.map((item) => ({
        productId: item.productId,
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.price,
        lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
      })),
    },
  };
}

module.exports = {
  getCouponCampaignMetadata,
  simulateCouponCampaign,
};
