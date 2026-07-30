const mongoose = require("mongoose");
const { Schema } = mongoose;
const {
  normalizeAttributes,
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

// ⚡ Virtual: `quantity` <-> `qty`
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
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "", index: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

/* Índices */
cartSchema.index({ sessionId: 1 }, { unique: true });
cartSchema.index({ userId: 1 });

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
