const mongoose = require('mongoose');

const { LOGISTICS_SHIPMENT_STATUSES } = require('./constants');
const { BranchSnapshotSchema } = require('./coreSchemas');
const {
  DigitalDeliveryItemSchema,
  LogisticsHistoryEntrySchema,
  LogisticsIncidentSchema,
  LogisticsPackageSchema,
  ServiceFulfillmentItemSchema,
  ShippingIntegrationSchema,
} = require('./fulfillmentSupportSchemas');

const PhysicalShipmentSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, uppercase: true, required: true },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    branchSnapshot: { type: BranchSnapshotSchema, default: () => ({}) },
    allocationIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId }],
      default: [],
    },
    quantity: { type: Number, min: 1, required: true },
    initializationSource: {
      type: String,
      enum: ['inventory_allocations', 'legacy_allocation_state'],
      default: 'inventory_allocations',
    },
    status: {
      type: String,
      enum: LOGISTICS_SHIPMENT_STATUSES,
      default: 'ready_to_pick',
      index: true,
    },
    resumeStatus: {
      type: String,
      enum: LOGISTICS_SHIPMENT_STATUSES.filter(
        (status) => status !== 'exception'
      ),
      default: 'ready_to_pick',
    },
    priority: {
      type: String,
      enum: ['normal', 'high', 'urgent'],
      default: 'normal',
    },
    revision: { type: Number, min: 0, default: 0 },
    carrier: {
      code: { type: String, trim: true, uppercase: true, default: '' },
      name: { type: String, trim: true, default: '' },
      serviceLevel: { type: String, trim: true, default: '' },
      trackingNumber: { type: String, trim: true, default: '' },
      trackingUrl: { type: String, trim: true, default: '' },
    },
    shippingIntegration: {
      type: ShippingIntegrationSchema,
      default: () => ({}),
    },
    packages: { type: [LogisticsPackageSchema], default: [] },
    sla: {
      pickingDueAt: { type: Date, default: null },
      dispatchDueAt: { type: Date, default: null },
      deliveryDueAt: { type: Date, default: null },
      breachedAt: { type: Date, default: null },
      lastEvaluatedAt: { type: Date, default: null },
    },
    dispatchEvidence: {
      reference: { type: String, trim: true, default: '' },
      recordedAt: { type: Date, default: null },
    },
    deliveryEvidence: {
      reference: { type: String, trim: true, default: '' },
      recipient: { type: String, trim: true, default: '' },
      recordedAt: { type: Date, default: null },
    },
    incidents: { type: [LogisticsIncidentSchema], default: [] },
    history: { type: [LogisticsHistoryEntrySchema], default: [] },
    startedAt: { type: Date, default: null },
    pickedAt: { type: Date, default: null },
    packedAt: { type: Date, default: null },
    dispatchedAt: { type: Date, default: null },
    inTransitAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const LogisticsSummarySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        'not_initialized',
        'ready',
        'in_progress',
        'partially_dispatched',
        'dispatched',
        'partially_delivered',
        'delivered',
        'exception',
        'cancelled',
      ],
      default: 'not_initialized',
    },
    shipmentCount: { type: Number, min: 0, default: 0 },
    readyCount: { type: Number, min: 0, default: 0 },
    activeCount: { type: Number, min: 0, default: 0 },
    dispatchedCount: { type: Number, min: 0, default: 0 },
    deliveredCount: { type: Number, min: 0, default: 0 },
    exceptionCount: { type: Number, min: 0, default: 0 },
    slaBreachedCount: { type: Number, min: 0, default: 0 },
    nextDueAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const OrderFulfillmentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'partially_delivered',
        'delivered',
        'action_required',
        'failed',
      ],
      default: 'pending',
    },
    digitalDeliveries: {
      type: [DigitalDeliveryItemSchema],
      default: [],
    },
    services: {
      type: [ServiceFulfillmentItemSchema],
      default: [],
    },
    shipments: {
      type: [PhysicalShipmentSchema],
      default: [],
    },
    logisticsSummary: {
      type: LogisticsSummarySchema,
      default: () => ({}),
    },
    processedAt: { type: Date, default: null },
    notifiedAt: { type: Date, default: null },
    notificationStatus: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed', 'not_required'],
      default: 'pending',
    },
    notificationClaimId: { type: String, trim: true, default: '' },
    notificationClaimedAt: { type: Date, default: null },
    notificationError: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const OrderExchangeOriginSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['', 'rma_exchange'],
      default: '',
    },
    originalOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    originalOrderNumber: { type: String, trim: true, default: '' },
    returnCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderReturn',
      default: null,
    },
    returnNumber: { type: String, trim: true, default: '' },
    noCharge: { type: Boolean, default: true },
  },
  { _id: false }
);

module.exports = {
  OrderExchangeOriginSchema,
  OrderFulfillmentSchema,
};
