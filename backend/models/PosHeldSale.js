const mongoose = require('mongoose');

const HeldItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productId: { type: String, trim: true, required: true },
    title: { type: String, trim: true, required: true },
    sku: { type: String, trim: true, default: '' },
    barcode: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    variantKey: { type: String, trim: true, default: 'default__default' },
    variantLabel: { type: String, trim: true, default: '' },
    variantAttributes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    size: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, required: true },
    availableStockSnapshot: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const PosHeldSaleSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, uppercase: true, required: true, unique: true },
    status: {
      type: String,
      enum: ['active', 'completed', 'discarded'],
      default: 'active',
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    branchSnapshot: {
      name: { type: String, trim: true, default: '' },
      code: { type: String, trim: true, uppercase: true, default: '' },
      type: { type: String, trim: true, lowercase: true, default: '' },
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    cashierSnapshot: {
      username: { type: String, trim: true, lowercase: true, default: '' },
      displayName: { type: String, trim: true, default: '' },
      role: { type: String, trim: true, lowercase: true, default: '' },
      adminRole: { type: String, trim: true, lowercase: true, default: '' },
    },
    customerSelection: {
      mode: {
        type: String,
        enum: ['guest', 'existing', 'quick'],
        default: 'guest',
      },
      selectedCustomer: { type: mongoose.Schema.Types.Mixed, default: null },
      quickCustomer: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    items: {
      type: [HeldItemSchema],
      required: true,
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0 && items.length <= 100;
        },
        message: 'Una venta en espera debe tener entre 1 y 100 productos.',
      },
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'transfer', 'card', 'mixed', 'other'],
      default: 'cash',
    },
    paymentDetails: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    discount: { type: mongoose.Schema.Types.Mixed, default: () => ({ type: 'none', value: 0 }) },
    subtotalSnapshot: { type: Number, min: 0, default: 0 },
    totalItems: { type: Number, min: 1, default: 1 },
    note: { type: String, trim: true, maxlength: 240, default: '' },
    lastOpenedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closeReason: {
      type: String,
      enum: ['', 'sold', 'discarded'],
      default: '',
    },
    completedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  { timestamps: true }
);

PosHeldSaleSchema.index({ branch: 1, status: 1, updatedAt: -1 });
PosHeldSaleSchema.index({ cashier: 1, status: 1, updatedAt: -1 });

module.exports =
  mongoose.models.PosHeldSale ||
  mongoose.model('PosHeldSale', PosHeldSaleSchema, 'pos_held_sales');
