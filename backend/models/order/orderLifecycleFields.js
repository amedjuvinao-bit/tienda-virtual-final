const mongoose = require('mongoose');

const {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MIN_TAG_LENGTH,
  ORDER_CHANNELS,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_SALE_TYPES,
  ORDER_SOURCES,
} = require('./constants');
const {
  AdminSnapshotSchema,
  BranchSnapshotSchema,
  DiscountSchema,
  NoteSchema,
  TimelineEntrySchema,
} = require('./coreSchemas');
const {
  CouponSnapshotSchema,
  PosMetadataSchema,
  PricingSnapshotSchema,
} = require('./commercialSchemas');
const {
  OrderInventoryAllocationSchema,
  OrderInventoryAllocationSummarySchema,
} = require('./inventorySchemas');
const {
  OrderExchangeOriginSchema,
  OrderFulfillmentSchema,
} = require('./logisticsSchemas');
const { normalizeTags } = require('./normalizers');

function createOrderLifecycleFields() {
  return {
  sessionId: { type: String, required: true },

  orderNumber: { type: String, required: true, unique: true, index: true },

  status: {
    type: String,
    enum: [
      'pending',
      'processing',
      'paid',
      'shipped',
      'delivered',
      'cancelled',
      'canceled',
      'refunded',
      'failed',
    ],
    default: 'pending',
  },

  fulfillmentStatus: {
    type: String,
    enum: ORDER_FULFILLMENT_STATUSES,
    default: 'pending',
  },

  fulfillment: {
    type: OrderFulfillmentSchema,
    default: () => ({}),
  },

  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null,
  },

  branchSnapshot: {
    type: BranchSnapshotSchema,
    default: () => ({
      name: '',
      code: '',
      type: '',
    }),
  },

  inventoryAllocations: {
    type: [OrderInventoryAllocationSchema],
    default: [],
  },

  inventoryAllocationSummary: {
    type: OrderInventoryAllocationSummarySchema,
    default: () => ({}),
  },

  createdByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null,
  },

  createdByAdminSnapshot: {
    type: AdminSnapshotSchema,
    default: () => ({
      username: '',
      displayName: '',
      role: '',
      adminRole: '',
    }),
  },

  source: {
    type: String,
    enum: ORDER_SOURCES,
    default: 'online',
  },

  channel: {
    type: String,
    enum: ORDER_CHANNELS,
    default: 'web',
  },

  saleType: {
    type: String,
    enum: ORDER_SALE_TYPES,
    default: 'online_order',
  },

  exchangeOrigin: {
    type: OrderExchangeOriginSchema,
    default: undefined,
  },

  cashSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CashSession',
    default: null,
  },

  cashRegister: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CashRegister',
    default: null,
  },

  cashier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null,
  },

  cashierSnapshot: {
    type: AdminSnapshotSchema,
    default: () => ({
      username: '',
      displayName: '',
      role: '',
      adminRole: '',
    }),
  },

  pos: {
    type: PosMetadataSchema,
    default: () => ({
      saleNumber: '',
      receiptNumber: '',
      terminalId: '',
      registerCode: '',
      shiftCode: '',
      customerMode: 'guest',
      quickSale: true,
      notes: '',
      confirmedAt: null,
    }),
  },

  discount: {
    type: DiscountSchema,
    default: () => ({
      type: 'none',
      value: 0,
      amount: 0,
      reason: '',
      authorizedBy: null,
      authorizedBySnapshot: {
        username: '',
        displayName: '',
        role: '',
        adminRole: '',
      },
    }),
  },

  coupon: {
    type: CouponSnapshotSchema,
    default: undefined,
  },

  pricing: {
    type: PricingSnapshotSchema,
    default: undefined,
  },

  printed: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },

  tags: {
    type: [String],
    default: [],
    set: normalizeTags,
    validate: [
      {
        validator(v) {
          return Array.isArray(v) && v.length <= MAX_TAGS;
        },
        message: `Máximo ${MAX_TAGS} tags por orden.`,
      },
      {
        validator(v) {
          return (v || []).every(
            (t) => t.length >= MIN_TAG_LENGTH && t.length <= MAX_TAG_LENGTH
          );
        },
        message: `Cada tag debe tener entre ${MIN_TAG_LENGTH} y ${MAX_TAG_LENGTH} caracteres.`,
      },
    ],
  },

  timeline: { type: [TimelineEntrySchema], default: [] },
  notes: { type: [NoteSchema], default: [] },
  };
}

module.exports = { createOrderLifecycleFields };
