const mongoose = require("mongoose");
const { Schema } = mongoose;
const {
  normalizeAttributes,
  resolveVariantIdentity,
} = require("../lib/products/productVariantConfig");

const cartVariantAttributeSchema = new Schema(
  {
    key: { type: String, trim: true, lowercase: true, default: "" },
    label: { type: String, trim: true, default: "" },
    value: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

/**
 * Item del carrito:
 * - Guardamos SOLO `qty` en base de datos.
 * - Exponemos `quantity` como **virtual** que lee/escribe `qty`.
 * - Referencia directa al Product por su _id (ObjectId).
 */
const cartItemSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, ref: "Product", required: true }, // id de producto

    // precio snapshot opcional (si viene vacío, el validador usa el de Product)
    price: { type: Number, default: 0, min: 0 },

    // Cantidad real almacenada
    qty: {
      type: Number,
      default: 0,
      min: 0,
      set: (v) => Math.max(0, Math.floor(Number(v || 0))),
    },

    // variantes / atributos
    color: { type: String, default: "" },
    size: { type: String, default: "" },
    variantId: { type: String, default: "" },
    variantKey: { type: String, default: "" },
    variantLabel: { type: String, default: "" },
    variantAttributes: {
      type: [cartVariantAttributeSchema],
      default: [],
      set: normalizeAttributes,
    },

    // snapshot opcional para UI
    title: { type: String, default: "" },
    image: { type: String, default: "" },
  },
  {
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const cartAdminNoteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    authorId: { type: String, trim: true, default: "", maxlength: 80 },
    authorName: { type: String, trim: true, default: "", maxlength: 160 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const cartRecoveryAttemptSchema = new Schema(
  {
    channel: {
      type: String,
      enum: ["link", "email", "note"],
      required: true,
    },
    result: {
      type: String,
      enum: ["generated", "sent", "failed", "recorded", "blocked"],
      required: true,
    },
    subject: { type: String, trim: true, default: "", maxlength: 220 },
    detail: { type: String, trim: true, default: "", maxlength: 500 },
    administratorId: { type: String, trim: true, default: "", maxlength: 80 },
    administratorName: { type: String, trim: true, default: "", maxlength: 160 },
    idempotencyKeyHash: {
      type: String,
      default: "",
      select: false,
      maxlength: 64,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ⚡ Virtual: `quantity` <-> `qty`
cartItemSchema.pre("validate", function normalizeCartVariant(next) {
  try {
    const identity = resolveVariantIdentity({
      variantKey: this.variantKey || this.variantId,
      size: this.size,
      color: this.color,
      attributes: this.variantAttributes || [],
    });
    this.variantKey = identity.variantKey;
    this.variantId = this.variantId || identity.variantKey;
    this.size = identity.size;
    this.color = identity.color;
    this.variantAttributes = identity.attributes;
    next();
  } catch (error) {
    next(error);
  }
});

cartItemSchema
  .virtual("quantity")
  .get(function () {
    return Number(this.qty || 0);
  })
  .set(function (v) {
    this.qty = Math.max(0, Math.floor(Number(v || 0)));
  });

const cartSchema = new Schema(
  {
    sessionId: { type: String, required: true }, // 1 carrito por sesión
    accessTokenHash: {
      type: String,
      select: false,
      minlength: 64,
      maxlength: 64,
    },
    accessVersion: { type: Number, default: 0, select: false },
    accessIssuedAt: { type: Date, select: false },
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "", index: true },
    items: { type: [cartItemSchema], default: [] },
    lastCustomerActivityAt: { type: Date, default: null, index: true },
    lastAdminActivityAt: { type: Date, default: null },
    convertedAt: { type: Date, default: null },
    convertedOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    adminTags: {
      type: [String],
      default: [],
      set: (values) => Array.from(
        new Set(
          (Array.isArray(values) ? values : [])
            .map((value) => String(value || "").trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 20)
        )
      ),
    },
    adminNotes: { type: [cartAdminNoteSchema], default: [] },
    recoveryAttempts: { type: [cartRecoveryAttemptSchema], default: [] },
    lastRecoveryAttemptAt: { type: Date, default: null },
    lastRecoveryEmailAt: { type: Date, default: null },
    recoveryEmailLockUntil: { type: Date, default: null, select: false },
    recoveryEmailLockKeyHash: { type: String, default: "", select: false, maxlength: 64 },
    recoveryAccess: {
      tokenHash: { type: String, default: "", select: false, maxlength: 64 },
      issuedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      usedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

/* Índices */
cartSchema.index({ sessionId: 1 }, { unique: true });
cartSchema.index({ userId: 1 });
cartSchema.index({ convertedOrderId: 1, lastCustomerActivityAt: -1 });
cartSchema.index({ lastRecoveryAttemptAt: -1 });

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
