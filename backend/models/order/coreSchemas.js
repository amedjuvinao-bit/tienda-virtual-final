const mongoose = require('mongoose');

const {
  cleanMoney,
  cleanQty,
  normalizeAttributes,
} = require('./normalizers');

const TimelineEntrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['status', 'note', 'system'], required: true },
    statusFrom: { type: String },
    statusTo: { type: String },
    message: { type: String },
    by: { type: String, default: 'system' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const NoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    by: { type: String, default: 'admin' },
    pinned: { type: Boolean, default: false },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const BranchSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, uppercase: true, default: '' },
    type: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const AdminSnapshotSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, lowercase: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, lowercase: true, default: '' },
    adminRole: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const OrderVariantAttributeSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, lowercase: true, default: '' },
    label: { type: String, trim: true, default: '' },
    value: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const OrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productId: String,

    title: { type: String, required: true },
    image: String,
    color: String,
    colorLabel: { type: String, trim: true, default: '' },
    size: String,

    qty: {
      type: Number,
      min: [1, 'Cantidad mínima 1'],
      set: cleanQty,
    },
    quantity: {
      type: Number,
      min: [1, 'Cantidad mínima 1'],
      set: cleanQty,
    },

    price: {
      type: Number,
      min: [0, 'El precio no puede ser negativo'],
      set: cleanMoney,
    },
    unitPrice: {
      type: Number,
      min: [0, 'El precio no puede ser negativo'],
      set: cleanMoney,
    },
    priceNumber: {
      type: Number,
      min: [0, 'El precio no puede ser negativo'],
      set: cleanMoney,
    },
    variantId: { type: String, trim: true, default: '' },
    variantKey: { type: String, trim: true, default: '' },
    variantLabel: { type: String, trim: true, default: '' },
    variantAttributes: {
      type: [OrderVariantAttributeSchema],
      default: [],
      set: normalizeAttributes,
    },
    variantSku: { type: String, trim: true, default: '' },
    variantBarcode: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    categories: { type: [String], default: [] },
    productType: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'physical',
    },
    requiresShipping: { type: Boolean, default: true },
    fulfillmentKind: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'shipment',
    },
    fulfillmentSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    customsSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    lineSubtotal: { type: Number, min: 0, default: 0, set: cleanMoney },
    discountAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    discountRate: { type: Number, min: 0, max: 100, default: 0 },
    taxableBase: { type: Number, min: 0, default: 0, set: cleanMoney },
    taxRate: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    lineTotal: { type: Number, min: 0, default: 0, set: cleanMoney },
  },
  { _id: true }
);

const SummarySchema = new mongoose.Schema(
  {
    itemsCount: Number,
    totalItems: Number,
    subtotal: Number,
  },
  { _id: false }
);

const DiscountSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['none', 'percent', 'amount'],
      default: 'none',
    },
    value: { type: Number, default: 0, min: 0, set: cleanMoney },
    amount: { type: Number, default: 0, min: 0, set: cleanMoney },
    reason: { type: String, trim: true, default: '' },
    authorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    authorizedBySnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({
        username: '',
        displayName: '',
        role: '',
        adminRole: '',
      }),
    },
  },
  { _id: false }
);

module.exports = {
  AdminSnapshotSchema,
  BranchSnapshotSchema,
  DiscountSchema,
  NoteSchema,
  OrderItemSchema,
  OrderVariantAttributeSchema,
  SummarySchema,
  TimelineEntrySchema,
};
