const mongoose = require("mongoose");

const PageBlockSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: [
        "banner",
        "tendencia",
        "look",
        "complementos",
        "categorias",
        "instagram",
        "tiktok",
        "informacion",
      ],
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    order: {
      type: Number,
      default: 0,
    },

    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const PageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },

    pageType: {
      type: String,
      trim: true,
      lowercase: true,
      enum: ["custom", "catalog", "product-detail", "cart-page", "checkout-page", "thanks-page", "favorites-page", "notfound-page"],
      default: "custom",
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    useHeader: {
      type: Boolean,
      default: true,
    },

    useFooter: {
      type: Boolean,
      default: true,
    },

    blocks: {
      type: [PageBlockSchema],
      default: [],
    },

    catalogConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    productDetailConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    cartPageConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    checkoutPageConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    thanksPageConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    favoritesPageConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    notFoundPageConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "pages",
  }
);

module.exports = mongoose.models.Page || mongoose.model("Page", PageSchema);