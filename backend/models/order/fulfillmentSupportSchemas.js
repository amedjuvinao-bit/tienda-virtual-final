const mongoose = require('mongoose');

const DigitalDeliveryItemSchema = new mongoose.Schema(
  {
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    sourceKey: { type: String, trim: true, required: true },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    title: { type: String, trim: true, default: '' },
    fileName: { type: String, trim: true, default: '' },
    deliveryMode: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'manual',
    },
    assetUrl: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
    accessTokenHash: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
    accessUrl: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
    status: {
      type: String,
      enum: ['pending', 'ready', 'manual', 'expired', 'blocked'],
      default: 'pending',
    },
    downloadLimit: { type: Number, min: 1, default: 3 },
    downloadCount: { type: Number, min: 0, default: 0 },
    expiresAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    lastDownloadedAt: { type: Date, default: null },
    customerMessage: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const ServiceFulfillmentItemSchema = new mongoose.Schema(
  {
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    sourceKey: { type: String, trim: true, required: true },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    title: { type: String, trim: true, default: '' },
    quantity: { type: Number, min: 1, default: 1 },
    fulfillmentMode: {
      type: String,
      enum: ['scheduled', 'manual'],
      default: 'manual',
    },
    locationType: {
      type: String,
      enum: ['online', 'store', 'customer'],
      default: 'online',
    },
    durationMinutes: { type: Number, min: 5, default: 60 },
    leadTimeHours: { type: Number, min: 0, default: 0 },
    bookingUrl: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
    customerInstructions: { type: String, trim: true, default: '' },
    internalInstructions: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
    status: {
      type: String,
      enum: [
        'awaiting_scheduling',
        'scheduled',
        'in_progress',
        'completed',
        'cancelled',
      ],
      default: 'awaiting_scheduling',
    },
    scheduledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const LogisticsActorSnapshotSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    displayName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, lowercase: true, default: '' },
    source: { type: String, trim: true, lowercase: true, default: 'admin' },
  },
  { _id: false }
);

const LogisticsPackageSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, uppercase: true, required: true },
    weightGrams: { type: Number, min: 0, max: 1000000, default: 0 },
    lengthCm: { type: Number, min: 0, max: 1000, default: 0 },
    widthCm: { type: Number, min: 0, max: 1000, default: 0 },
    heightCm: { type: Number, min: 0, max: 1000, default: 0 },
    labelReference: { type: String, trim: true, default: '' },
    sealedAt: { type: Date, default: null },
  },
  { _id: true }
);

const LogisticsIncidentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['open', 'resolved'],
      default: 'open',
    },
    type: {
      type: String,
      enum: [
        'delay',
        'stock_mismatch',
        'damage',
        'address',
        'carrier',
        'customer_unavailable',
        'other',
      ],
      default: 'other',
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    description: { type: String, trim: true, maxlength: 1000, required: true },
    resolution: { type: String, trim: true, maxlength: 1000, default: '' },
    openedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    openedBy: { type: LogisticsActorSnapshotSchema, default: () => ({}) },
    resolvedBy: { type: LogisticsActorSnapshotSchema, default: () => ({}) },
  },
  { _id: true }
);

const LogisticsHistoryEntrySchema = new mongoose.Schema(
  {
    action: { type: String, trim: true, lowercase: true, required: true },
    statusFrom: { type: String, trim: true, lowercase: true, default: '' },
    statusTo: { type: String, trim: true, lowercase: true, default: '' },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
    evidenceReference: { type: String, trim: true, maxlength: 240, default: '' },
    actor: { type: LogisticsActorSnapshotSchema, default: () => ({}) },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ShippingRateSnapshotSchema = new mongoose.Schema(
  {
    carrier: { type: String, trim: true, default: '' },
    service: { type: String, trim: true, default: '' },
    serviceDescription: { type: String, trim: true, default: '' },
    deliveryEstimate: { type: String, trim: true, default: '' },
    totalPrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'COP' },
    quotedAt: { type: Date, default: null },
  },
  { _id: false }
);

const ShippingTrackingEventSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: '' },
    status: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    location: { type: String, trim: true, maxlength: 240, default: '' },
    occurredAt: { type: Date, default: null },
    receivedAt: { type: Date, default: Date.now },
    source: { type: String, trim: true, lowercase: true, default: 'provider' },
  },
  { _id: false }
);

const ShippingPickupSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['not_requested', 'scheduled', 'completed', 'cancelled', 'failed'],
      default: 'not_requested',
    },
    confirmation: { type: String, trim: true, default: '' },
    requestedDate: { type: String, trim: true, default: '' },
    timeFrom: { type: String, trim: true, default: '' },
    timeTo: { type: String, trim: true, default: '' },
    instructions: { type: String, trim: true, maxlength: 500, default: '' },
    requestedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const ShippingCancellationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        'not_requested',
        'pending',
        'confirmed',
        'refund_pending',
        'refunded',
        'rejected',
      ],
      default: 'not_requested',
    },
    balanceReturned: { type: Boolean, default: false },
    balanceReturnDate: { type: Date, default: null },
    requestedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    providerMessage: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false }
);

const ShippingIntegrationSchema = new mongoose.Schema(
  {
    provider: { type: String, trim: true, lowercase: true, default: 'manual' },
    mode: {
      type: String,
      enum: ['manual', 'sandbox', 'production'],
      default: 'manual',
    },
    status: {
      type: String,
      enum: [
        'manual',
        'quoted',
        'label_generated',
        'pickup_scheduled',
        'tracking',
        'cancelled',
        'error',
      ],
      default: 'manual',
    },
    providerShipmentId: { type: String, trim: true, default: '' },
    labelUrl: { type: String, trim: true, default: '' },
    labelFormat: { type: String, trim: true, uppercase: true, default: '' },
    carrierActions: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: [],
    },
    selectedRate: { type: ShippingRateSnapshotSchema, default: () => ({}) },
    trackingEvents: { type: [ShippingTrackingEventSchema], default: [] },
    providerStatus: { type: String, trim: true, default: '' },
    providerStatusDescription: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    lastWebhookAt: { type: Date, default: null },
    handoffMode: {
      type: String,
      enum: ['pending', 'dropoff', 'pickup'],
      default: 'pending',
    },
    handoffConfirmedAt: { type: Date, default: null },
    pickup: { type: ShippingPickupSchema, default: () => ({}) },
    cancellation: { type: ShippingCancellationSchema, default: () => ({}) },
    lastSyncedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    lastError: {
      code: { type: String, trim: true, default: '' },
      message: { type: String, trim: true, maxlength: 500, default: '' },
      at: { type: Date, default: null },
    },
  },
  { _id: false }
);

module.exports = {
  DigitalDeliveryItemSchema,
  LogisticsHistoryEntrySchema,
  LogisticsIncidentSchema,
  LogisticsPackageSchema,
  ServiceFulfillmentItemSchema,
  ShippingIntegrationSchema,
};
