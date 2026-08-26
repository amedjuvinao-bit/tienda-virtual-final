// backend/models/Order.js
const mongoose = require('mongoose');
const {
  normalizeCanonicalAttributes: normalizeAttributes,
  resolveVariantIdentity,
} = require('../../shared/variantKeyAuthority.cjs');

/* ========= Helpers de normalización y validación de tags ========= */
const MAX_TAGS = 8;
const MIN_LEN = 2;
const MAX_LEN = 24;

const ORDER_SOURCES = ['online', 'admin', 'pos', 'manual', 'import', 'system'];
const ORDER_CHANNELS = ['web', 'physical_store', 'manual', 'import', 'system'];
const ORDER_SALE_TYPES = ['online_order', 'pos_sale', 'manual_order', 'imported_order', 'system_order'];
const ORDER_FULFILLMENT_STATUSES = [
  'pending',
  'reserved',
  'processing',
  'delivered',
  'partially_delivered',
  'cancelled',
  'returned',
];

function normalizeTag(t) {
  return String(t || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeTags(input) {
  const arr = Array.isArray(input) ? input : String(input || '').split(',');
  const cleaned = arr
    .map((t) => normalizeTag(t))
    .filter((t) => t.length >= MIN_LEN && t.length <= MAX_LEN);

  const seen = new Set();
  const unique = [];
  for (const t of cleaned) {
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(t);
    }
  }
  return unique.slice(0, MAX_TAGS);
}

const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function cleanMoney(value) {
  return Math.max(0, Number(value || 0));
}

function cleanQty(value) {
  return Math.max(1, Math.floor(Number(value || 0)));
}

function applyCanonicalVariantIdentity(item) {
  if (!item || typeof item !== 'object') return item;
  const visibleColor = cleanText(item.colorLabel || item.color);
  const identity = resolveVariantIdentity({
    variantKey: item.variantKey || item.variantId,
    size: item.size,
    color: item.color,
    attributes: item.variantAttributes || [],
  });
  item.variantKey = identity.variantKey;
  item.variantId = identity.variantKey;
  item.size = identity.size;
  item.color = identity.color;
  item.colorLabel = visibleColor;
  item.variantAttributes = identity.attributes;
  return item;
}

/* ========= Subesquemas ========= */
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

/* ========= Snapshot de sede operativa ========= */
const BranchSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, uppercase: true, default: '' },
    type: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

/* ========= Snapshot de usuario administrativo ========= */
const AdminSnapshotSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, lowercase: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, lowercase: true, default: '' },
    adminRole: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

/* ========= Ítems (snapshot de producto) ========= */
const OrderVariantAttributeSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, lowercase: true, default: '' },
    label: { type: String, trim: true, default: '' },
    value: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

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
      index: true,
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

/* ========= Resumen precalculado (opcional) ========= */
const SummarySchema = new mongoose.Schema(
  {
    itemsCount: Number,
    totalItems: Number,
    subtotal: Number,
  },
  { _id: false }
);

/* ========= Pago POS mixto ========= */
const PaymentSplitSchema = new mongoose.Schema(
  {
    method: { type: String, trim: true, lowercase: true, default: '' },
    methodLabel: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0, min: 0, set: cleanMoney },
    reference: { type: String, trim: true, default: '' },
    receivedAmount: { type: Number, default: 0, min: 0, set: cleanMoney },
    changeAmount: { type: Number, default: 0, min: 0, set: cleanMoney },
  },
  { _id: false }
);

/* ========= Pago ========= */
const PaymentSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: true },
    provider: {
      type: String,
      enum: ['bold', 'wompi', 'mercado-pago', 'payu', 'manual', 'pos', ''],
      default: '',
    },
    providerLabel: { type: String, default: '' },
    mode: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox',
    },
    currency: { type: String, default: 'COP' },
    checkoutLabel: { type: String, default: '' },
    enableWebhook: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending_gateway', 'pending_manual', 'paid', 'failed', 'cancelled'],
      default: 'pending_gateway',
    },
    methodType: { type: String, trim: true, default: '' },
    method: { type: String, trim: true, default: '' },
    methodLabel: { type: String, trim: true, default: '' },
    transactionId: { type: String, trim: true, default: '' },
    reference: { type: String, trim: true, default: '' },
    amountInCents: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date, default: null },
    receivedAmount: { type: Number, default: 0, min: 0, set: cleanMoney },
    changeAmount: { type: Number, default: 0, min: 0, set: cleanMoney },
    splitPayments: { type: [PaymentSplitSchema], default: [] },
    rawMethod: { type: Object, default: () => ({}) },
  },
  { _id: false }
);

const PaymentInventoryProcessingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'not_required', 'failed'],
      default: 'pending',
    },
    lastAttemptAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    errorCode: { type: String, trim: true, default: '' },
    errorMessage: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PaymentInvoiceProcessingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'scheduling', 'scheduled', 'not_required', 'failed'],
      default: 'pending',
    },
    claimId: { type: String, trim: true, default: '' },
    claimedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    transactionId: { type: String, trim: true, default: '' },
    outcomeCode: { type: String, trim: true, default: '' },
    errorCode: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PaymentProcessingSchema = new mongoose.Schema(
  {
    provider: { type: String, trim: true, lowercase: true, default: '' },
    approvedTransactionId: { type: String, trim: true, default: '' },
    approvedAt: { type: Date, default: null },
    inventory: {
      type: PaymentInventoryProcessingSchema,
      default: () => ({}),
    },
    invoice: {
      type: PaymentInvoiceProcessingSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

/* ========= Descuento comercial ========= */
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

/* ========= Cupón y conciliación monetaria ========= */
const CouponSnapshotSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    redemption: { type: mongoose.Schema.Types.ObjectId, ref: 'CouponRedemption', default: null },
    code: { type: String, trim: true, uppercase: true, default: '' },
    type: { type: String, trim: true, lowercase: true, default: '' },
    value: { type: Number, min: 0, default: 0 },
    name: { type: String, trim: true, default: '' },
    discountAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    shippingDiscountAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    totalDiscountAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    originalShippingAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    finalShippingAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    status: { type: String, trim: true, lowercase: true, default: '' },
    message: { type: String, trim: true, default: '' },
    appliedAt: { type: Date, default: null },
  },
  { _id: false }
);

const PricingSnapshotSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 2 },
    currency: { type: String, trim: true, uppercase: true, default: 'COP' },
    subtotal: { type: Number, min: 0, default: 0, set: cleanMoney },
    productDiscount: { type: Number, min: 0, default: 0, set: cleanMoney },
    subtotalAfterDiscount: { type: Number, min: 0, default: 0, set: cleanMoney },
    originalShipping: { type: Number, min: 0, default: 0, set: cleanMoney },
    shippingDiscount: { type: Number, min: 0, default: 0, set: cleanMoney },
    shipping: { type: Number, min: 0, default: 0, set: cleanMoney },
    totalDiscount: { type: Number, min: 0, default: 0, set: cleanMoney },
    taxableBase: { type: Number, min: 0, default: 0, set: cleanMoney },
    taxAmount: { type: Number, min: 0, default: 0, set: cleanMoney },
    total: { type: Number, min: 0, default: 0, set: cleanMoney },
  },
  { _id: false }
);

/* ========= Metadata POS ========= */
const PosMetadataSchema = new mongoose.Schema(
  {
    saleNumber: { type: String, trim: true, default: '' },
    receiptNumber: { type: String, trim: true, default: '' },
    terminalId: { type: String, trim: true, default: '' },
    registerCode: { type: String, trim: true, uppercase: true, default: '' },
    shiftCode: { type: String, trim: true, uppercase: true, default: '' },
    customerMode: {
      type: String,
      enum: ['guest', 'identified'],
      default: 'guest',
    },
    quickSale: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: '' },
    confirmedAt: { type: Date, default: null },
  },
  { _id: false }
);

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

const LOGISTICS_SHIPMENT_STATUSES = [
  'ready_to_pick',
  'picking',
  'picked',
  'packing',
  'packed',
  'dispatched',
  'in_transit',
  'delivered',
  'exception',
  'cancelled',
];

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
      enum: ['not_requested', 'pending', 'confirmed', 'refund_pending', 'refunded', 'rejected'],
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
    mode: { type: String, enum: ['manual', 'sandbox', 'production'], default: 'manual' },
    status: {
      type: String,
      enum: ['manual', 'quoted', 'label_generated', 'pickup_scheduled', 'tracking', 'cancelled', 'error'],
      default: 'manual',
    },
    providerShipmentId: { type: String, trim: true, default: '' },
    labelUrl: { type: String, trim: true, default: '' },
    labelFormat: { type: String, trim: true, uppercase: true, default: '' },
    carrierActions: { type: [{ type: String, trim: true, lowercase: true }], default: [] },
    selectedRate: { type: ShippingRateSnapshotSchema, default: () => ({}) },
    trackingEvents: { type: [ShippingTrackingEventSchema], default: [] },
    providerStatus: { type: String, trim: true, default: '' },
    providerStatusDescription: { type: String, trim: true, maxlength: 500, default: '' },
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

const PhysicalShipmentSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, uppercase: true, required: true },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
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
      enum: LOGISTICS_SHIPMENT_STATUSES.filter((status) => status !== 'exception'),
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
      enum: ['not_initialized', 'ready', 'in_progress', 'partially_dispatched', 'dispatched', 'partially_delivered', 'delivered', 'exception', 'cancelled'],
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
      enum: [
        'pending',
        'sending',
        'sent',
        'failed',
        'not_required',
      ],
      default: 'pending',
    },
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

/* ========= Esquema principal ========= */
const OrderSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },

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
      index: true,
    },

    fulfillmentStatus: {
      type: String,
      enum: ORDER_FULFILLMENT_STATUSES,
      default: 'pending',
      index: true,
    },

    fulfillment: {
      type: OrderFulfillmentSchema,
      default: () => ({}),
    },

    /* ========= Sede operativa ========= */
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
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

    /* ========= Usuario administrativo que originó o gestionó la orden ========= */
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
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
      index: true,
    },

    channel: {
      type: String,
      enum: ORDER_CHANNELS,
      default: 'web',
      index: true,
    },

    saleType: {
      type: String,
      enum: ORDER_SALE_TYPES,
      default: 'online_order',
      index: true,
    },

    exchangeOrigin: {
      type: OrderExchangeOriginSchema,
      default: undefined,
    },

    cashSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashSession',
      default: null,
      index: true,
    },

    cashRegister: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashRegister',
      default: null,
      index: true,
    },

    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
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

    /* ========= Flags operativos ========= */
    printed: { type: Boolean, default: false, index: true },
    archived: { type: Boolean, default: false, index: true },

    /* ========= Tags normalizados ========= */
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
            return (v || []).every((t) => t.length >= MIN_LEN && t.length <= MAX_LEN);
          },
          message: `Cada tag debe tener entre ${MIN_LEN} y ${MAX_LEN} caracteres.`,
        },
      ],
    },

    /* ========= Embebidos locales ========= */
    timeline: { type: [TimelineEntrySchema], default: [] },
    notes: { type: [NoteSchema], default: [] },

    /* ========= Carrito (payload actual) ========= */
    cart: {
      type: [
        {
          productId: String,
          title: String,
          image: String,
          color: String,
          colorLabel: { type: String, trim: true, default: '' },
          size: String,
          variantId: { type: String, trim: true, default: '' },
          variantKey: { type: String, trim: true, default: '' },
          variantLabel: { type: String, trim: true, default: '' },
          variantAttributes: {
            type: [OrderVariantAttributeSchema],
            default: [],
            set: normalizeAttributes,
          },
          quantity: {
            type: Number,
            default: 0,
            min: 0,
            set: (v) => Math.max(0, Math.floor(Number(v || 0))),
          },
          price: {
            type: Number,
            default: 0,
            min: 0,
            set: cleanMoney,
          },
        },
      ],
      default: [],
    },

    /* ========= Ítems ========= */
    items: {
      type: [OrderItemSchema],
      default: [],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'La orden debe contener al menos un ítem.',
      },
      required: true,
    },

    /* ========= Resumen y totales ========= */
    summary: SummarySchema,
    subtotal: Number,
    shipping: Number,
    total: Number,

    taxes: {
      iva: {
        enabled: { type: Boolean, default: false },
        percent: { type: Number, default: 0 },
        code: { type: String, default: '01' },
        name: { type: String, default: 'IVA' },
        taxableBase: { type: Number, default: 0, min: 0, set: cleanMoney },
        amount: { type: Number, default: 0 },
      },
    },

    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: null,
      },
      customerCode: { type: String, trim: true, uppercase: true, default: '' },
      name: String,
      lastname: String,
      id: String,
      documentType: String,
      emailOrPhone: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      municipalityCode: String,
      municipalityId: String,
      municipality_id: String,
      postalCode: String,
      country: String,
      countryCode: String,
      department: String,
      departmentCode: String,
      deliveryType: String,
      wantsNewsletter: Boolean,
      isFinalConsumer: Boolean,
    },

    customerRelationship: {
      linkedAt: { type: Date, default: null },
      statsAppliedAt: { type: Date, default: null },
      source: {
        type: String,
        enum: ['', 'web', 'pos'],
        default: '',
      },
      matchedBy: {
        type: String,
        enum: ['', 'customer_id', 'document', 'email', 'phone', 'created'],
        default: '',
      },
    },

    billing: {
      useSameAddress: Boolean,
      isFinalConsumer: Boolean,
      personType: String,
      firstName: String,
      lastName: String,
      name: String,
      lastname: String,
      id: String,
      documentNumber: String,
      documentType: String,
      dv: String,
      businessName: String,
      address: String,
      city: String,
      cityCode: String,
      municipalityCode: String,
      department: String,
      departmentCode: String,
      postalCode: String,
      phone: String,
      email: String,
      extra: String,
      country: String,
      countryCode: String,
      tributeCode: String,
    },

    payment: {
      type: PaymentSchema,
      default: () => ({
        active: true,
        provider: '',
        providerLabel: '',
        mode: 'sandbox',
        currency: 'COP',
        checkoutLabel: '',
        enableWebhook: false,
        status: 'pending_gateway',
        methodType: '',
        method: '',
        methodLabel: '',
        transactionId: '',
        reference: '',
        amountInCents: 0,
        amount: 0,
        paidAt: null,
        receivedAmount: 0,
        changeAmount: 0,
        splitPayments: [],
        rawMethod: {},
      }),
    },

    paymentProcessing: {
      type: PaymentProcessingSchema,
      default: undefined,
    },

    inventoryControl: {
      reservationRequired: { type: Boolean, default: true },
      reservationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryReservation',
        default: null,
      },
      discountedAtCheckout: { type: Boolean, default: true },
      restockedOnFailure: { type: Boolean, default: false },
      restockedAt: { type: Date, default: null },
    },

    refundControl: {
      totalAmount: {
        type: Number,
        default: 0,
        min: 0,
        set: cleanMoney,
      },
      transactionCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      returnedUnits: {
        type: Number,
        default: 0,
        min: 0,
      },
      restockedUnits: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastRefundAt: {
        type: Date,
        default: null,
      },
      lastRefund: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderRefund',
        default: null,
      },
      reconciliationState: {
        type: String,
        enum: ['not_started', 'pending', 'action_required', 'completed', 'failed'],
        default: 'not_started',
        index: true,
      },
      pendingActions: {
        type: [String],
        default: [],
      },
      lastReconciledAt: {
        type: Date,
        default: null,
      },
    },

    returnControl: {
      revision: {
        type: Number,
        default: 0,
        min: 0,
      },
      requestCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastRequestedAt: {
        type: Date,
        default: null,
      },
      lastReturn: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderReturn',
        default: null,
      },
    },
  },
  { timestamps: true }
);

/* ========= Índices ========= */
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ sessionId: 1, createdAt: -1 });
OrderSchema.index({ 'customer.customerId': 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ fulfillmentStatus: 1, createdAt: -1 });
OrderSchema.index({ 'timeline.type': 1, createdAt: -1 });
OrderSchema.index({ tags: 1, createdAt: -1 });
OrderSchema.index({ printed: 1, createdAt: -1 });
OrderSchema.index({ archived: 1, createdAt: -1 });
OrderSchema.index({ 'payment.provider': 1, createdAt: -1 });
OrderSchema.index({ 'payment.status': 1, createdAt: -1 });
OrderSchema.index({ 'payment.method': 1, createdAt: -1 });
OrderSchema.index({ 'payment.transactionId': 1 }, { sparse: true });
OrderSchema.index({ 'payment.reference': 1 }, { sparse: true });
OrderSchema.index({ branch: 1, createdAt: -1 });
OrderSchema.index({ 'inventoryAllocations.branch': 1, createdAt: -1 });
OrderSchema.index(
  {
    'fulfillment.shipments.branch': 1,
    'fulfillment.shipments.status': 1,
    'fulfillment.shipments.sla.dispatchDueAt': 1,
  },
  { name: 'orders_logistics_branch_status_sla' }
);
OrderSchema.index(
  { 'fulfillment.shipments.carrier.trackingNumber': 1 },
  {
    name: 'orders_shipping_tracking_number',
    partialFilterExpression: {
      'fulfillment.shipments.carrier.trackingNumber': { $gt: '' },
    },
  }
);
OrderSchema.index(
  { branch: 1, status: 1, createdAt: -1 },
  { name: 'orders_admin_branch_status_date' }
);
OrderSchema.index(
  { 'inventoryAllocations.branch': 1, status: 1, createdAt: -1 },
  { name: 'orders_admin_allocation_status_date' }
);
OrderSchema.index(
  { archived: 1, status: 1, createdAt: -1 },
  { name: 'orders_admin_archive_status_date' }
);
OrderSchema.index({
  'inventoryAllocationSummary.splitAcrossBranches': 1,
  createdAt: -1,
});
OrderSchema.index({ source: 1, createdAt: -1 });
OrderSchema.index({ channel: 1, createdAt: -1 });
OrderSchema.index({ saleType: 1, createdAt: -1 });
OrderSchema.index({ createdByAdmin: 1, createdAt: -1 });
OrderSchema.index({ cashier: 1, createdAt: -1 });
OrderSchema.index({ cashSession: 1, createdAt: -1 });
OrderSchema.index({ cashRegister: 1, createdAt: -1 });
OrderSchema.index({ 'branchSnapshot.code': 1, createdAt: -1 });
OrderSchema.index({ 'pos.receiptNumber': 1 }, { sparse: true });
OrderSchema.index({ 'pos.saleNumber': 1 }, { sparse: true });

/* ========= Hooks ========= */
OrderSchema.pre('validate', function (next) {
  try {
    if (!Array.isArray(this.items)) this.items = [];
    if (!Array.isArray(this.cart)) this.cart = [];

    this.source = cleanLower(this.source || 'online');

    if (!ORDER_SOURCES.includes(this.source)) {
      this.source = 'online';
    }

    this.channel = cleanLower(this.channel || '');
    if (!ORDER_CHANNELS.includes(this.channel)) {
      this.channel = this.source === 'pos' ? 'physical_store' : 'web';
    }

    this.saleType = cleanLower(this.saleType || '');
    if (!ORDER_SALE_TYPES.includes(this.saleType)) {
      if (this.source === 'pos') this.saleType = 'pos_sale';
      else if (this.source === 'manual' || this.source === 'admin') this.saleType = 'manual_order';
      else if (this.source === 'import') this.saleType = 'imported_order';
      else if (this.source === 'system') this.saleType = 'system_order';
      else this.saleType = 'online_order';
    }

    if (this.source === 'pos') {
      this.channel = 'physical_store';
      this.saleType = 'pos_sale';
      if (!this.fulfillmentStatus || this.fulfillmentStatus === 'pending') {
        this.fulfillmentStatus = 'delivered';
      }
      if (typeof this.shipping !== 'number') {
        this.shipping = 0;
      }
    }

    this.fulfillmentStatus = cleanLower(this.fulfillmentStatus || 'pending');
    if (!ORDER_FULFILLMENT_STATUSES.includes(this.fulfillmentStatus)) {
      this.fulfillmentStatus = this.source === 'pos' ? 'delivered' : 'pending';
    }

    if (!this.branchSnapshot || typeof this.branchSnapshot !== 'object') {
      this.branchSnapshot = {
        name: '',
        code: '',
        type: '',
      };
    } else {
      this.branchSnapshot.name = cleanText(this.branchSnapshot.name);
      this.branchSnapshot.code = cleanUpper(this.branchSnapshot.code);
      this.branchSnapshot.type = cleanLower(this.branchSnapshot.type);
    }

    if (!this.createdByAdminSnapshot || typeof this.createdByAdminSnapshot !== 'object') {
      this.createdByAdminSnapshot = {
        username: '',
        displayName: '',
        role: '',
        adminRole: '',
      };
    } else {
      this.createdByAdminSnapshot.username = cleanLower(this.createdByAdminSnapshot.username);
      this.createdByAdminSnapshot.displayName = cleanText(this.createdByAdminSnapshot.displayName);
      this.createdByAdminSnapshot.role = cleanLower(this.createdByAdminSnapshot.role);
      this.createdByAdminSnapshot.adminRole = cleanLower(this.createdByAdminSnapshot.adminRole);
    }

    if (!this.cashierSnapshot || typeof this.cashierSnapshot !== 'object') {
      this.cashierSnapshot = {
        username: '',
        displayName: '',
        role: '',
        adminRole: '',
      };
    } else {
      this.cashierSnapshot.username = cleanLower(this.cashierSnapshot.username);
      this.cashierSnapshot.displayName = cleanText(this.cashierSnapshot.displayName);
      this.cashierSnapshot.role = cleanLower(this.cashierSnapshot.role);
      this.cashierSnapshot.adminRole = cleanLower(this.cashierSnapshot.adminRole);
    }

    if (this.items.length === 0 && this.cart.length > 0) {
      this.items = this.cart
        .map((it) => {
          const qty = Math.max(1, Math.floor(Number(it?.quantity || 0)));
          const price = Math.max(0, Number(it?.price || 0));
          if (!it?.title || qty <= 0) return null;
          return {
            productId: it?.productId,
            title: String(it.title),
            image: it?.image,
            color: it?.color,
            colorLabel: it?.colorLabel || it?.color || '',
            size: it?.size,
            variantId: it?.variantId || it?.variantKey || '',
            variantKey: it?.variantKey || it?.variantId || '',
            variantLabel: it?.variantLabel || '',
            variantAttributes: normalizeAttributes(
              it?.variantAttributes || []
            ),
            quantity: qty,
            qty,
            price,
            unitPrice: price,
            priceNumber: price,
          };
        })
        .filter(Boolean);
    }

    this.cart.forEach(applyCanonicalVariantIdentity);
    this.items.forEach(applyCanonicalVariantIdentity);
    if (Array.isArray(this.inventoryAllocations)) {
      this.inventoryAllocations.forEach(applyCanonicalVariantIdentity);
    }

    if (!Array.isArray(this.items) || this.items.length === 0) {
      const err = new mongoose.Error.ValidationError(this);
      err.addError(
        'items',
        new mongoose.Error.ValidatorError({
          path: 'items',
          message: 'La orden debe contener al menos un ítem.',
        })
      );
      return next(err);
    }

    const totalItems = this.items.reduce(
      (acc, it) => acc + toNum(it.quantity ?? it.qty, 0),
      0
    );
    const subtotalCalc = this.items.reduce(
      (acc, it) =>
        acc +
        toNum(it.price ?? it.unitPrice ?? it.priceNumber, 0) *
          toNum(it.quantity ?? it.qty, 0),
      0
    );

    if (!this.summary || typeof this.summary !== 'object') {
      this.summary = {
        itemsCount: this.items.length,
        totalItems,
        subtotal: subtotalCalc,
      };
    } else {
      if (typeof this.summary.itemsCount !== 'number') {
        this.summary.itemsCount = this.items.length;
      }
      if (typeof this.summary.totalItems !== 'number') {
        this.summary.totalItems = totalItems;
      }
      if (typeof this.summary.subtotal !== 'number') {
        this.summary.subtotal = subtotalCalc;
      }
    }

    if (!this.discount || typeof this.discount !== 'object') {
      this.discount = {
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
      };
    } else {
      const safeDiscountType = cleanLower(this.discount.type || 'none');
      this.discount.type = ['none', 'percent', 'amount'].includes(safeDiscountType)
        ? safeDiscountType
        : 'none';
      this.discount.value = cleanMoney(this.discount.value);
      this.discount.amount = cleanMoney(this.discount.amount);
      this.discount.reason = cleanText(this.discount.reason);

      if (!this.discount.authorizedBySnapshot || typeof this.discount.authorizedBySnapshot !== 'object') {
        this.discount.authorizedBySnapshot = {
          username: '',
          displayName: '',
          role: '',
          adminRole: '',
        };
      } else {
        this.discount.authorizedBySnapshot.username = cleanLower(this.discount.authorizedBySnapshot.username);
        this.discount.authorizedBySnapshot.displayName = cleanText(this.discount.authorizedBySnapshot.displayName);
        this.discount.authorizedBySnapshot.role = cleanLower(this.discount.authorizedBySnapshot.role);
        this.discount.authorizedBySnapshot.adminRole = cleanLower(this.discount.authorizedBySnapshot.adminRole);
      }
    }

    if (typeof this.subtotal !== 'number') this.subtotal = subtotalCalc;
    if (typeof this.shipping !== 'number') this.shipping = toNum(this.shipping, 0);
    if (typeof this.total !== 'number') {
      this.total = Math.max(0, subtotalCalc - toNum(this.discount?.amount, 0) + this.shipping);
    }

    if (!this.payment || typeof this.payment !== 'object') {
      this.payment = {
        active: true,
        provider: this.source === 'pos' ? 'pos' : '',
        providerLabel: this.source === 'pos' ? 'Venta física' : '',
        mode: 'sandbox',
        currency: 'COP',
        checkoutLabel: '',
        enableWebhook: false,
        status: this.source === 'pos' ? 'paid' : 'pending_gateway',
        methodType: '',
        method: '',
        methodLabel: '',
        amount: toNum(this.total, 0),
        amountInCents: Math.round(toNum(this.total, 0) * 100),
        paidAt: this.source === 'pos' ? new Date() : null,
        splitPayments: [],
        rawMethod: {},
      };
    } else {
      this.payment.active =
        typeof this.payment.active === 'boolean' ? this.payment.active : true;
      this.payment.provider = cleanLower(this.payment.provider || '');

      if (this.source === 'pos' && !this.payment.provider) {
        this.payment.provider = 'pos';
      }

      this.payment.providerLabel = cleanText(
        this.payment.providerLabel || (this.payment.provider === 'pos' ? 'Venta física' : '')
      );
      this.payment.mode =
        cleanLower(this.payment.mode || '') === 'production' ? 'production' : 'sandbox';
      this.payment.currency = cleanUpper(this.payment.currency || 'COP') || 'COP';
      this.payment.checkoutLabel = cleanText(this.payment.checkoutLabel);
      this.payment.enableWebhook = this.payment.enableWebhook === true;
      this.payment.methodType = cleanLower(this.payment.methodType);
      this.payment.method = cleanLower(this.payment.method);
      this.payment.methodLabel = cleanText(this.payment.methodLabel);
      this.payment.transactionId = cleanText(this.payment.transactionId);
      this.payment.reference = cleanText(this.payment.reference);
      this.payment.amount = cleanMoney(this.payment.amount || this.total);
      this.payment.amountInCents = Math.max(
        0,
        Math.round(Number(this.payment.amountInCents || this.payment.amount * 100 || 0))
      );
      this.payment.receivedAmount = cleanMoney(this.payment.receivedAmount);
      this.payment.changeAmount = cleanMoney(this.payment.changeAmount);
      this.payment.splitPayments = Array.isArray(this.payment.splitPayments)
        ? this.payment.splitPayments
        : [];

      const safeStatus = cleanLower(this.payment.status || '');
      this.payment.status = [
        'pending_gateway',
        'pending_manual',
        'paid',
        'failed',
        'cancelled',
      ].includes(safeStatus)
        ? safeStatus
        : this.payment.provider === 'manual'
          ? 'pending_manual'
          : this.payment.provider === 'pos'
            ? 'paid'
            : 'pending_gateway';

      if (this.source === 'pos' && this.payment.status === 'paid' && !this.payment.paidAt) {
        this.payment.paidAt = new Date();
      }
    }

    if (!this.pos || typeof this.pos !== 'object') {
      this.pos = {
        saleNumber: '',
        receiptNumber: '',
        terminalId: '',
        registerCode: '',
        shiftCode: '',
        customerMode: 'guest',
        quickSale: true,
        notes: '',
        confirmedAt: null,
      };
    } else {
      this.pos.saleNumber = cleanText(this.pos.saleNumber);
      this.pos.receiptNumber = cleanText(this.pos.receiptNumber);
      this.pos.terminalId = cleanText(this.pos.terminalId);
      this.pos.registerCode = cleanUpper(this.pos.registerCode);
      this.pos.shiftCode = cleanUpper(this.pos.shiftCode);
      this.pos.customerMode = cleanLower(this.pos.customerMode) === 'identified' ? 'identified' : 'guest';
      this.pos.quickSale = this.pos.quickSale !== false;
      this.pos.notes = cleanText(this.pos.notes);

      if (this.source === 'pos' && this.payment?.status === 'paid' && !this.pos.confirmedAt) {
        this.pos.confirmedAt = this.payment.paidAt || new Date();
      }
    }

    if (!this.inventoryControl || typeof this.inventoryControl !== 'object') {
      this.inventoryControl = {
        discountedAtCheckout: this.source !== 'pos',
        restockedOnFailure: false,
        restockedAt: null,
      };
    } else {
      this.inventoryControl.discountedAtCheckout =
        this.source === 'pos'
          ? false
          : typeof this.inventoryControl.discountedAtCheckout === 'boolean'
            ? this.inventoryControl.discountedAtCheckout
            : true;

      this.inventoryControl.restockedOnFailure =
        this.inventoryControl.restockedOnFailure === true;

      this.inventoryControl.restockedAt =
        this.inventoryControl.restockedAt instanceof Date ||
        this.inventoryControl.restockedAt === null
          ? this.inventoryControl.restockedAt
          : null;
    }

    next();
  } catch (e) {
    next(e);
  }
});

OrderSchema.pre('save', function (next) {
  if (this.isNew) {
    this.timeline = this.timeline || [];
    if (
      !this.timeline.some(
        (t) => t.type === 'status' && t.statusTo === this.status
      )
    ) {
      this.timeline.push({
        type: 'status',
        statusFrom: undefined,
        statusTo: this.status || 'pending',
        message: 'Estado inicial',
        by: 'system',
        at: new Date(),
      });
    }

    if (this.source === 'pos') {
      this.timeline.push({
        type: 'system',
        message: 'Venta física POS creada',
        by: 'system',
        at: new Date(),
      });
    }
  }
  next();
});

/* ========= Salida limpia ========= */
OrderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});
OrderSchema.set('toObject', { virtuals: true, versionKey: false });

/* ========= Export con guardia para hot-reload ========= */
module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
