const mongoose = require('mongoose');

const {
  BranchSnapshotSchema,
  OrderVariantAttributeSchema,
} = require('./coreSchemas');
const { normalizeAttributes } = require('./normalizers');

const OrderInventoryAllocationSchema = new mongoose.Schema(
  {
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryReservation',
      default: null,
      index: true,
    },
    reservationItem: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    orderItem: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    inventoryStock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryStock',
      required: true,
      index: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    branchSnapshot: {
      type: BranchSnapshotSchema,
      default: () => ({
        name: '',
        code: '',
        type: '',
      }),
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productSnapshot: {
      title: { type: String, trim: true, default: '' },
      sku: { type: String, trim: true, default: '' },
      image: { type: String, trim: true, default: '' },
      category: { type: String, trim: true, default: '' },
    },
    bundleParentProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    bundleParentTitle: {
      type: String,
      trim: true,
      default: '',
    },
    size: {
      type: String,
      trim: true,
      default: '',
    },
    color: {
      type: String,
      trim: true,
      default: '',
    },
    colorLabel: {
      type: String,
      trim: true,
      default: '',
    },
    variantKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'default__default',
    },
    variantLabel: {
      type: String,
      trim: true,
      default: '',
    },
    variantAttributes: {
      type: [OrderVariantAttributeSchema],
      default: [],
      set: normalizeAttributes,
    },
    quantity: {
      type: Number,
      min: 1,
      required: true,
    },
    reservedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    soldQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    shippedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    deliveredQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    returnedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    releasedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        'reserved',
        'sold',
        'partially_shipped',
        'shipped',
        'partially_delivered',
        'delivered',
        'partially_returned',
        'returned',
        'released',
      ],
      default: 'reserved',
      index: true,
    },
    reservedAt: { type: Date, default: null },
    soldAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    lastReturnedAt: { type: Date, default: null },
  },
  { _id: true }
);

const OrderInventoryAllocationSummarySchema = new mongoose.Schema(
  {
    allocationCount: { type: Number, min: 0, default: 0 },
    branchCount: { type: Number, min: 0, default: 0 },
    splitAcrossBranches: { type: Boolean, default: false },
    branchIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Branch',
        },
      ],
      default: [],
    },
    totalQuantity: { type: Number, min: 0, default: 0 },
    reservedQuantity: { type: Number, min: 0, default: 0 },
    activeReservedQuantity: { type: Number, min: 0, default: 0 },
    soldQuantity: { type: Number, min: 0, default: 0 },
    shippedQuantity: { type: Number, min: 0, default: 0 },
    deliveredQuantity: { type: Number, min: 0, default: 0 },
    returnedQuantity: { type: Number, min: 0, default: 0 },
    releasedQuantity: { type: Number, min: 0, default: 0 },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

module.exports = {
  OrderInventoryAllocationSchema,
  OrderInventoryAllocationSummarySchema,
};
