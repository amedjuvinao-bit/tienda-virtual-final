// backend/models/Order.js
const mongoose = require('mongoose');

/* ========= Helpers de normalización y validación de tags ========= */
const MAX_TAGS = 8;
const MIN_LEN = 2;
const MAX_LEN = 24;

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
      set: (v) => Math.max(1, Math.floor(Number(v || 0))),
    },
    quantity: {
      type: Number,
      min: [1, 'Cantidad mínima 1'],
      set: (v) => Math.max(1, Math.floor(Number(v || 0))),
    },

    price: {
      type: Number,
      min: [0, 'El precio no puede ser negativo'],
      set: (v) => Math.max(0, Number(v || 0)),
    },
    unitPrice: {
      type: Number,
      min: [0, 'El precio no puede ser negativo'],
      set: (v) => Math.max(0, Number(v || 0)),
    },
    priceNumber: {
      type: Number,
      min: [0, 'El precio no puede ser negativo'],
      set: (v) => Math.max(0, Number(v || 0)),
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

/* ========= Pago ========= */
const PaymentSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: true },
    provider: {
      type: String,
      enum: ['bold', 'wompi', 'mercado-pago', 'payu', 'manual', ''],
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
      enum: ['pending', 'processing', 'paid', 'shipped', 'cancelled', 'canceled', 'refunded','failed'],
      default: 'pending',
      index: true,
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
            set: (v) => Math.max(0, Number(v || 0)),
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
      emailOrPhone: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      municipalityId: String,
      municipality_id: String,
      postalCode: String,
      country: String,
      department: String,
      deliveryType: String,
      wantsNewsletter: Boolean,
    },

    billing: {
      useSameAddress: Boolean,
      name: String,
      lastname: String,
      id: String,
      address: String,
      city: String,
      department: String,
      postalCode: String,
      phone: String,
      extra: String,
      country: String,
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
OrderSchema.index({ 'timeline.type': 1, createdAt: -1 });
OrderSchema.index({ tags: 1, createdAt: -1 });
OrderSchema.index({ printed: 1, createdAt: -1 });
OrderSchema.index({ archived: 1, createdAt: -1 });
OrderSchema.index({ 'payment.provider': 1, createdAt: -1 });
OrderSchema.index({ 'payment.status': 1, createdAt: -1 });

/* ========= Hooks ========= */
OrderSchema.pre('validate', function (next) {
  try {
    if (!Array.isArray(this.items)) this.items = [];
    if (!Array.isArray(this.cart)) this.cart = [];

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
      this.summary = { itemsCount: this.items.length, totalItems, subtotal: subtotalCalc };
    } else {
      if (typeof this.summary.itemsCount !== 'number') this.summary.itemsCount = this.items.length;
      if (typeof this.summary.totalItems !== 'number') this.summary.totalItems = totalItems;
      if (typeof this.summary.subtotal !== 'number') this.summary.subtotal = subtotalCalc;
    }

    if (typeof this.subtotal !== 'number') this.subtotal = subtotalCalc;
    if (typeof this.total !== 'number') {
      const shipping = toNum(this.shipping, 0);
      this.total = subtotalCalc + shipping;
    }

    if (!this.payment || typeof this.payment !== 'object') {
      this.payment = {
        active: true,
        provider: '',
        providerLabel: '',
        mode: 'sandbox',
        currency: 'COP',
        checkoutLabel: '',
        enableWebhook: false,
        status: 'pending_gateway',
      };
    } else {
      this.payment.active = typeof this.payment.active === 'boolean' ? this.payment.active : true;
      this.payment.provider = String(this.payment.provider || '').trim().toLowerCase();
      this.payment.providerLabel = String(this.payment.providerLabel || '').trim();
      this.payment.mode =
        String(this.payment.mode || '').trim().toLowerCase() === 'production'
          ? 'production'
          : 'sandbox';
      this.payment.currency = String(this.payment.currency || 'COP').trim().toUpperCase() || 'COP';
      this.payment.checkoutLabel = String(this.payment.checkoutLabel || '').trim();
      this.payment.enableWebhook = this.payment.enableWebhook === true;

      const safeStatus = String(this.payment.status || '').trim().toLowerCase();
      this.payment.status = ['pending_gateway', 'pending_manual', 'paid', 'failed', 'cancelled'].includes(safeStatus)
        ? safeStatus
        : (this.payment.provider === 'manual' ? 'pending_manual' : 'pending_gateway');
    }

    if (!this.inventoryControl || typeof this.inventoryControl !== 'object') {
      this.inventoryControl = {
        discountedAtCheckout: true,
        restockedOnFailure: false,
        restockedAt: null,
      };
    } else {
      this.inventoryControl.discountedAtCheckout =
        typeof this.inventoryControl.discountedAtCheckout === 'boolean'
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
    if (!this.timeline.some((t) => t.type === 'status' && t.statusTo === this.status)) {
      this.timeline.push({
        type: 'status',
        statusFrom: undefined,
        statusTo: this.status || 'pending',
        message: 'Estado inicial',
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