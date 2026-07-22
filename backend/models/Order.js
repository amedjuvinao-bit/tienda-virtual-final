// backend/models/Order.js
const mongoose = require('mongoose');

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
const OrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productId: String,

    title: { type: String, required: true },
    image: String,
    color: String,
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
          size: String,
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
        amount: { type: Number, default: 0 },
      },
    },

    customer: {
      name: String,
      lastname: String,
      id: String,
      documentType: String,
      emailOrPhone: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      municipalityId: String,
      municipality_id: String,
      postalCode: String,
      country: String,
      countryCode: String,
      department: String,
      departmentCode: String,
      deliveryType: String,
      wantsNewsletter: Boolean,
    },

    billing: {
      useSameAddress: Boolean,
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

    inventoryControl: {
      discountedAtCheckout: { type: Boolean, default: true },
      restockedOnFailure: { type: Boolean, default: false },
      restockedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

/* ========= Índices ========= */
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ sessionId: 1, createdAt: -1 });
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
            size: it?.size,
            quantity: qty,
            qty,
            price,
            unitPrice: price,
            priceNumber: price,
          };
        })
        .filter(Boolean);
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
