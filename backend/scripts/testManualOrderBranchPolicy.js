'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const SiteSettings = require('../models/SiteSettings');
const orders = require('../routes/orders');
const {
  findManualBranch,
  manualBranchFilter,
  prepareManualPayload,
  prepareQuote,
} = require('../services/manualOrderCreationService');

const id = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();
const otherId = new mongoose.Types.ObjectId();
const owner = { adminRole: 'owner' };
const cashier = { adminRole: 'cashier', adminBranches: [{ branch: id }] };
const input = {
  branchId: String(id),
  items: [{ productId: String(productId), quantity: 2, price: 1 }],
  customer: {
    name: 'Ana', lastname: 'Prueba', id: '1234567',
    emailOrPhone: 'ana@example.com', deliveryType: 'retiro',
  },
};

async function main() {
  const old = {
    branchFind: Branch.findOne,
    productFind: Product.find,
    settingsFind: SiteSettings.findOne,
  };
  try {
    const branchRoute = orders.stack.find((entry) => entry.route?.path === '/admin/manual/branches');
    const createRoute = orders.stack.find((entry) => entry.route?.path === '/admin/manual');
    assert.ok(branchRoute?.route?.methods.get);
    assert.ok(createRoute?.route?.methods.post);
    const permission = createRoute.route.stack[0].handle;
    const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let passed = false;
    await permission({ method: 'POST', adminRole: 'cashier',
      adminEffectivePermissionsLoaded: true, adminEffectivePermissions: ['orders:view'] },
    response, () => { passed = true; });
    assert.equal(passed, false);
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body.requiredPermissions, ['orders:create']);
    await permission({ method: 'POST', adminRole: 'cashier',
      adminEffectivePermissionsLoaded: true, adminEffectivePermissions: ['orders:create'] },
    response, () => { passed = true; });
    assert.equal(passed, true);

    assert.deepEqual(manualBranchFilter(cashier)._id.$in.map(String), [String(id)]);
    assert.equal(manualBranchFilter(owner)._id, undefined);
    assert.equal(manualBranchFilter(owner)['settings.allowManualOrders'], true);
    assert.equal(prepareManualPayload(input).cart[0].price, 1);
    assert.throws(() => prepareManualPayload({ ...input, items: [] }), { code: 'INVALID_ITEMS' });
    assert.throws(() => prepareManualPayload({ ...input, customer: { ...input.customer, deliveryType: 'x' } }), { code: 'INVALID_DELIVERY_TYPE' });
    await assert.rejects(findManualBranch(cashier, String(otherId)), { code: 'BRANCH_FORBIDDEN' });

    let enabled = false;
    Branch.findOne = (filter) => ({ lean: async () => enabled ? {
      _id: id, name: 'Sede Principal', code: 'PRINCIPAL',
      settings: { allowManualOrders: true, allowInventoryMovements: true },
    } : null });
    await assert.rejects(findManualBranch(owner, String(id)), { code: 'MANUAL_ORDERS_DISABLED' });
    enabled = true;

    const product = {
      _id: productId, title: 'Producto real', price: 42000,
      visible: true, active: true, variants: [],
      productType: 'physical', trackInventory: false,
    };
    Product.find = () => ({ select() { return this; }, lean: async () => [product] });
    SiteSettings.findOne = () => ({ lean: async () => ({ billing: { taxes: { iva: { enabled: false } } } }) });
    const { pricing, branch } = await prepareQuote(owner, {
      ...input,
      items: [{ ...input.items[0], price: 1_000_000, title: 'Precio falso' }],
    });
    assert.equal(pricing.subtotal, 84000, 'el precio del cliente nunca determina el total');
    assert.equal(branch._id, id);

    product.variants = [{ variantKey: 'm__', label: 'M', size: 'M', active: true }];
    await assert.rejects(prepareQuote(owner, input), { code: 'INVALID_VARIANT' });
    console.log('Pedidos manuales: permiso, sede deshabilitada, validación, variantes y precio autoritativo verificados.');
  } finally {
    Branch.findOne = old.branchFind;
    Product.find = old.productFind;
    SiteSettings.findOne = old.settingsFind;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
