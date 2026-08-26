'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const RETURN_STATUSES = [
  'requested',
  'authorized',
  'rejected',
  'in_transit',
  'received',
  'inspected',
  'resolution_required',
  'resolved',
  'cancelled',
];

const RETURN_REASON_CODES = [
  'wrong_size',
  'wrong_item',
  'damaged',
  'defective',
  'not_as_described',
  'changed_mind',
  'warranty',
  'other',
];

const RETURN_RESOLUTION_TYPES = ['refund', 'exchange', 'store_credit'];
const RETURN_RISK_LEVELS = ['low', 'medium', 'high', 'blocked'];
const RETURN_RISK_DECISIONS = ['clear', 'manual_review', 'blocked', 'approved'];

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function cleanQuantity(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function cleanMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

const ActorSnapshotSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    label: { type: String, trim: true, default: '', maxlength: 160 },
    role: { type: String, trim: true, lowercase: true, default: '', maxlength: 80 },
  },
  { _id: false }
);

const CustomerSnapshotSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    name: { type: String, trim: true, default: '', maxlength: 180 },
    email: { type: String, trim: true, lowercase: true, default: '', maxlength: 220 },
    phone: { type: String, trim: true, default: '', maxlength: 80 },
  },
  { _id: false }
);

const ReturnItemSchema = new Schema(
  {
    orderItemId: { type: Schema.Types.ObjectId, required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    title: { type: String, trim: true, default: '', maxlength: 240 },
    productType: { type: String, trim: true, lowercase: true, default: 'physical' },
    variantKey: { type: String, trim: true, lowercase: true, default: 'default__default' },
    size: { type: String, trim: true, default: '', maxlength: 80 },
    color: { type: String, trim: true, default: '', maxlength: 120 },
    purchasedQuantity: { type: Number, min: 1, required: true, set: cleanQuantity },
    unitAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    requestedQuantity: { type: Number, min: 1, required: true, set: cleanQuantity },
    authorizedQuantity: { type: Number, min: 0, default: 0, set: cleanQuantity },
    receivedQuantity: { type: Number, min: 0, default: 0, set: cleanQuantity },
    acceptedQuantity: { type: Number, min: 0, default: 0, set: cleanQuantity },
    rejectedQuantity: { type: Number, min: 0, default: 0, set: cleanQuantity },
    sellableQuantity: { type: Number, min: 0, default: 0, set: cleanQuantity },
    damagedQuantity: { type: Number, min: 0, default: 0, set: cleanQuantity },
    quarantineQuantity: { type: Number, min: 0, default: 0, set: cleanQuantity },
    reasonCode: {
      type: String,
      enum: RETURN_REASON_CODES,
      required: true,
      set: cleanLower,
    },
    reasonText: { type: String, trim: true, default: '', maxlength: 500 },
    inspectionNote: { type: String, trim: true, default: '', maxlength: 1000 },
    policyRuleKey: { type: String, trim: true, lowercase: true, default: 'default', maxlength: 80 },
    policyRuleName: { type: String, trim: true, default: 'Política general', maxlength: 160 },
    policyWindowDays: { type: Number, min: 1, max: 365, default: 30 },
    policyManualReview: { type: Boolean, default: false },
  },
  { _id: true }
);

const RiskSignalSchema = new Schema(
  {
    code: { type: String, trim: true, lowercase: true, required: true, maxlength: 80 },
    severity: {
      type: String,
      enum: ['info', 'warning', 'high', 'blocked'],
      default: 'warning',
    },
    message: { type: String, trim: true, required: true, maxlength: 320 },
    value: { type: Number, min: 0, default: 0 },
    threshold: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const ReturnRiskAssessmentSchema = new Schema(
  {
    level: { type: String, enum: RETURN_RISK_LEVELS, default: 'low' },
    decision: { type: String, enum: RETURN_RISK_DECISIONS, default: 'clear' },
    score: { type: Number, min: 0, max: 100, default: 0 },
    signals: { type: [RiskSignalSchema], default: [] },
    history: {
      lookbackDays: { type: Number, min: 7, max: 730, default: 90 },
      requestCount: { type: Number, min: 0, default: 0 },
      unitCount: { type: Number, min: 0, default: 0 },
      amount: { type: Number, min: 0, default: 0 },
      activeCount: { type: Number, min: 0, default: 0 },
      rejectedCount: { type: Number, min: 0, default: 0 },
    },
    evaluatedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, default: '', maxlength: 800 },
    reviewedBy: { type: ActorSnapshotSchema, default: () => ({}) },
  },
  { _id: false }
);

const InventoryRestorationSchema = new Schema(
  {
    reservationItem: { type: Schema.Types.ObjectId, default: null },
    inventoryStock: { type: Schema.Types.ObjectId, ref: 'InventoryStock', required: true },
    inventoryMovement: { type: Schema.Types.ObjectId, ref: 'InventoryMovement', required: true },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantKey: { type: String, trim: true, lowercase: true, default: 'default__default' },
    size: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    quantity: { type: Number, min: 1, required: true, set: cleanQuantity },
    bundleParentProduct: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
  },
  { _id: true }
);

const OrderReturnSchema = new Schema(
  {
    returnNumber: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      unique: true,
      index: true,
      maxlength: 90,
    },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, trim: true, uppercase: true, default: '', index: true },
    status: { type: String, enum: RETURN_STATUSES, default: 'requested', index: true },
    revision: { type: Number, min: 0, default: 0 },
    requestedResolution: {
      type: String,
      enum: RETURN_RESOLUTION_TYPES,
      default: 'refund',
      required: true,
    },
    requestSource: {
      type: String,
      enum: ['admin', 'customer'],
      default: 'admin',
      index: true,
    },
    customerSnapshot: {
      type: CustomerSnapshotSchema,
      default: () => ({}),
    },
    items: { type: [ReturnItemSchema], default: [] },
    reasonSummary: { type: String, trim: true, default: '', maxlength: 800 },
    eligibility: {
      windowDays: { type: Number, min: 1, max: 365, default: 30 },
      deliveredAt: { type: Date, default: null },
      eligibleUntil: { type: Date, default: null },
      overridden: { type: Boolean, default: false },
      overrideReason: { type: String, trim: true, default: '', maxlength: 500 },
    },
    policySnapshot: {
      revision: { type: Number, min: 0, default: 0 },
      windowDays: { type: Number, min: 1, max: 365, default: 30 },
      autoAuthorized: { type: Boolean, default: false },
      returnShippingPaidBy: {
        type: String,
        enum: ['store', 'customer', 'case_by_case'],
        default: 'case_by_case',
      },
      matchedRules: {
        type: [{
          key: { type: String, trim: true, lowercase: true, default: 'default' },
          name: { type: String, trim: true, default: 'Política general' },
        }],
        default: [],
      },
      requiresManualReview: { type: Boolean, default: false },
    },
    riskAssessment: {
      type: ReturnRiskAssessmentSchema,
      default: () => ({}),
    },
    shipping: {
      method: {
        type: String,
        enum: ['pending', 'drop_off', 'carrier', 'customer_arranged'],
        default: 'pending',
      },
      carrierName: { type: String, trim: true, default: '', maxlength: 160 },
      trackingNumber: { type: String, trim: true, default: '', maxlength: 180 },
      trackingUrl: { type: String, trim: true, default: '', maxlength: 1000 },
      labelUrl: { type: String, trim: true, default: '', maxlength: 1000 },
      labelType: {
        type: String,
        enum: ['none', 'internal_rma', 'carrier'],
        default: 'none',
      },
      instructions: { type: String, trim: true, default: '', maxlength: 1600 },
    },
    inventoryRestorations: { type: [InventoryRestorationSchema], default: [] },
    inventoryProcessedAt: { type: Date, default: null },
    estimatedRefundAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    resolution: {
      type: { type: String, enum: [...RETURN_RESOLUTION_TYPES, 'no_refund'], default: null },
      state: {
        type: String,
        enum: ['pending', 'action_required', 'completed'],
        default: 'pending',
      },
      amount: { type: Number, min: 0, default: 0, set: cleanMoney },
      reference: { type: String, trim: true, default: '', maxlength: 240 },
      refund: { type: Schema.Types.ObjectId, ref: 'OrderRefund', default: null },
      storeCredit: { type: Schema.Types.ObjectId, ref: 'StoreCredit', default: null },
      storeCreditNumber: { type: String, trim: true, uppercase: true, default: '' },
      replacementOrder: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
      replacementOrderNumber: { type: String, trim: true, uppercase: true, default: '' },
      completedAt: { type: Date, default: null },
    },
    rejectionReason: { type: String, trim: true, default: '', maxlength: 800 },
    cancellationReason: { type: String, trim: true, default: '', maxlength: 800 },
    requestedAt: { type: Date, default: Date.now },
    authorizedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    inTransitAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    inspectedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    requestedBy: { type: ActorSnapshotSchema, default: () => ({}) },
    authorizedBy: { type: ActorSnapshotSchema, default: () => ({}) },
    receivedBy: { type: ActorSnapshotSchema, default: () => ({}) },
    inspectedBy: { type: ActorSnapshotSchema, default: () => ({}) },
    resolvedBy: { type: ActorSnapshotSchema, default: () => ({}) },
  },
  { timestamps: true }
);

OrderReturnSchema.index({ order: 1, status: 1, createdAt: -1 });
OrderReturnSchema.index({ order: 1, 'items.orderItemId': 1, status: 1 });
OrderReturnSchema.index({ status: 1, 'eligibility.eligibleUntil': 1 });
OrderReturnSchema.index({ 'customerSnapshot.customer': 1, requestedAt: -1 });
OrderReturnSchema.index({ 'customerSnapshot.email': 1, requestedAt: -1 });
OrderReturnSchema.index({ 'customerSnapshot.phone': 1, requestedAt: -1 });

OrderReturnSchema.pre('validate', function normalizeOrderReturn(next) {
  this.returnNumber = cleanUpper(this.returnNumber);
  this.orderNumber = cleanUpper(this.orderNumber);
  this.reasonSummary = cleanText(this.reasonSummary);
  this.rejectionReason = cleanText(this.rejectionReason);
  this.cancellationReason = cleanText(this.cancellationReason);
  this.revision = cleanQuantity(this.revision);
  this.estimatedRefundAmount = (this.items || []).reduce(
    (sum, item) => sum + cleanMoney(item.unitAmount) * cleanQuantity(
      this.inspectedAt ? item.acceptedQuantity : item.requestedQuantity
    ),
    0
  );
  next();
});

module.exports =
  mongoose.models.OrderReturn || mongoose.model('OrderReturn', OrderReturnSchema);

module.exports.RETURN_STATUSES = RETURN_STATUSES;
module.exports.RETURN_REASON_CODES = RETURN_REASON_CODES;
module.exports.RETURN_RESOLUTION_TYPES = RETURN_RESOLUTION_TYPES;
module.exports.RETURN_RISK_LEVELS = RETURN_RISK_LEVELS;
module.exports.RETURN_RISK_DECISIONS = RETURN_RISK_DECISIONS;
