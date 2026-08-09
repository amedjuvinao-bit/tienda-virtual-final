// backend/models/InventoryStock.js

const mongoose = require('mongoose');
const {
  buildVariantKey,
  normalizeAttributes,
  buildVariantLabel,
  resolveVariantIdentity,
} = require('../lib/products/productVariantConfig');

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function cleanPositiveNumber(value, fallback = 0) {
  return Math.max(0, cleanNumber(value, fallback));
}

const BranchSnapshotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
    },

    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: 40,
    },

    type: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 40,
    },
  },
  { _id: false }
);

const ProductSnapshotSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: '',
      maxlength: 220,
    },

    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: 80,
    },

    image: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },

    category: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
  },
  { _id: false }
);

const VariantAttributeSnapshotSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, lowercase: true, default: '' },
    label: { type: String, trim: true, default: '' },
    value: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const VariantSnapshotSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
    },

    size: {
      type: String,
      trim: true,
      default: '',
      maxlength: 40,
    },

    color: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },

    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: 100,
    },

    barcode: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },

    attributes: {
      type: [VariantAttributeSnapshotSchema],
      default: [],
      set: normalizeAttributes,
    },
  },
  { _id: false }
);

const InventoryStockSchema = new mongoose.Schema(
  {
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
      type: ProductSnapshotSchema,
      default: () => ({
        title: '',
        sku: '',
        image: '',
        category: '',
      }),
    },

    variant: {
      type: VariantSnapshotSchema,
      default: () => ({
        size: '',
        color: '',
        label: '',
        attributes: [],
        sku: '',
        barcode: '',
      }),
    },

    variantKey: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      index: true,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },

    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },

    availableStock: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },

    reorderPoint: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },

    reorderQty: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },

    warehouseLocation: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },

    lastMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryMovement',
      default: null,
    },

    lastMovementAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastCountedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 800,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* ============================
 * Índices
 * ============================ */

InventoryStockSchema.index(
  {
    branch: 1,
    product: 1,
    variantKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
    },
  }
);

InventoryStockSchema.index({ branch: 1, active: 1, deletedAt: 1 });
InventoryStockSchema.index({ product: 1, active: 1, deletedAt: 1 });
InventoryStockSchema.index({ branch: 1, product: 1 });
InventoryStockSchema.index({ branch: 1, 'productSnapshot.title': 1 });
InventoryStockSchema.index({ branch: 1, 'productSnapshot.sku': 1 });
InventoryStockSchema.index({ branch: 1, stock: 1 });
InventoryStockSchema.index({ availableStock: 1 });
InventoryStockSchema.index({ lastMovementAt: -1 });

/* ============================
 * Hooks
 * ============================ */

InventoryStockSchema.pre('validate', function inventoryStockPreValidate(next) {
  try {
    if (!this.variant || typeof this.variant !== 'object') {
      this.variant = {
        size: '',
        color: '',
        sku: '',
        barcode: '',
      };
    }

    this.variant.size = cleanText(this.variant.size);
    this.variant.color = cleanText(this.variant.color);
    this.variant.attributes = normalizeAttributes(this.variant.attributes);
    const identity = resolveVariantIdentity({
      variantKey: this.variantKey,
      size: this.variant.size,
      color: this.variant.color,
      attributes: this.variant.attributes,
    });
    this.variantKey = identity.variantKey;
    this.variant.size = identity.size;
    this.variant.color = identity.color;
    this.variant.attributes = identity.attributes;
    this.variant.label = cleanText(
      this.variant.label || buildVariantLabel(this.variant)
    );
    this.variant.sku = cleanUpper(this.variant.sku);
    this.variant.barcode = cleanText(this.variant.barcode);

    if (this.branchSnapshot) {
      this.branchSnapshot.name = cleanText(this.branchSnapshot.name);
      this.branchSnapshot.code = cleanUpper(this.branchSnapshot.code);
      this.branchSnapshot.type = cleanLower(this.branchSnapshot.type);
    }

    if (this.productSnapshot) {
      this.productSnapshot.title = cleanText(this.productSnapshot.title);
      this.productSnapshot.sku = cleanUpper(this.productSnapshot.sku);
      this.productSnapshot.image = cleanText(this.productSnapshot.image);
      this.productSnapshot.category = cleanText(this.productSnapshot.category);
    }

    this.stock = cleanPositiveNumber(this.stock);
    this.reservedStock = cleanPositiveNumber(this.reservedStock);

    if (this.reservedStock > this.stock) {
      this.reservedStock = this.stock;
    }

    this.availableStock = Math.max(0, this.stock - this.reservedStock);

    this.reorderPoint = cleanPositiveNumber(this.reorderPoint);
    this.reorderQty = cleanPositiveNumber(this.reorderQty);
    this.warehouseLocation = cleanUpper(this.warehouseLocation);
    this.notes = cleanText(this.notes);

    if (this.deletedAt) {
      this.active = false;
    }

    next();
  } catch (error) {
    next(error);
  }
});

/* ============================
 * Métodos de instancia
 * ============================ */

InventoryStockSchema.methods.canReserve = function canReserve(quantity = 0) {
  const qty = Math.max(1, Math.floor(Number(quantity || 0)));

  return this.availableStock >= qty;
};

InventoryStockSchema.methods.isBelowReorderPoint = function isBelowReorderPoint() {
  return Number(this.reorderPoint || 0) > 0 && this.availableStock <= this.reorderPoint;
};

InventoryStockSchema.methods.toSafeObject = function toSafeObject() {
  const stock = this.toObject({ virtuals: true });

  delete stock.__v;

  return stock;
};

/* ============================
 * Métodos estáticos
 * ============================ */

InventoryStockSchema.statics.buildVariantKey = buildVariantKey;
InventoryStockSchema.statics.resolveVariantIdentity = resolveVariantIdentity;

InventoryStockSchema.statics.buildBranchSnapshot = function buildBranchSnapshot(branch) {
  if (!branch) {
    return {
      name: '',
      code: '',
      type: '',
    };
  }

  return {
    name: cleanText(branch.name),
    code: cleanUpper(branch.code),
    type: cleanLower(branch.type),
  };
};

InventoryStockSchema.statics.buildProductSnapshot = function buildProductSnapshot(product) {
  if (!product) {
    return {
      title: '',
      sku: '',
      image: '',
      category: '',
    };
  }

  return {
    title: cleanText(product.title || product.name),
    sku: cleanUpper(product.sku),
    image: cleanText(product.image),
    category: cleanText(product.category),
  };
};

InventoryStockSchema.statics.buildVariantSnapshot = function buildVariantSnapshot(variant = {}) {
  return {
    label: cleanText(variant.label || buildVariantLabel(variant)),
    size: cleanText(variant.size),
    color: cleanText(variant.color),
    attributes: normalizeAttributes(
      variant.attributes || variant.variantAttributes || []
    ),
    sku: cleanUpper(variant.sku),
    barcode: cleanText(variant.barcode),
  };
};

module.exports =
  mongoose.models.InventoryStock ||
  mongoose.model('InventoryStock', InventoryStockSchema);
