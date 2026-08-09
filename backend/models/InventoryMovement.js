// backend/models/InventoryMovement.js

const mongoose = require('mongoose');
const Counter = require('./Counter');
const {
  normalizeAttributes,
  buildVariantLabel,
  assertVariantIdentity,
} = require('../lib/products/productVariantConfig');

const INVENTORY_MOVEMENT_TYPES = [
  'initial_stock', // Carga inicial de inventario
  'purchase_in', // Entrada por compra o proveedor
  'sale_out', // Salida por venta
  'return_in', // Entrada por devolución del cliente
  'return_out', // Salida por devolución a proveedor
  'adjustment_in', // Ajuste manual positivo
  'adjustment_out', // Ajuste manual negativo
  'transfer', // Traslado entre sedes
  'damage_out', // Salida por daño
  'loss_out', // Salida por pérdida
  'correction', // Corrección administrativa
];

const INVENTORY_MOVEMENT_DIRECTIONS = [
  'in', // Aumenta stock
  'out', // Disminuye stock
  'transfer', // Mueve stock de una sede a otra
  'neutral', // No modifica stock directamente
];

const INVENTORY_MOVEMENT_STATUS = [
  'draft', // Borrador, aún no aplicado
  'posted', // Aplicado al inventario
  'cancelled', // Cancelado antes o después de aplicar
  'reversed', // Reversado por otro movimiento
];

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

function normalizeMovementType(value) {
  const type = cleanLower(value);

  return INVENTORY_MOVEMENT_TYPES.includes(type) ? type : 'correction';
}

function resolveDirectionFromType(type) {
  const cleanType = normalizeMovementType(type);

  if (
    [
      'initial_stock',
      'purchase_in',
      'return_in',
      'adjustment_in',
    ].includes(cleanType)
  ) {
    return 'in';
  }

  if (
    [
      'sale_out',
      'return_out',
      'adjustment_out',
      'damage_out',
      'loss_out',
    ].includes(cleanType)
  ) {
    return 'out';
  }

  if (cleanType === 'transfer') {
    return 'transfer';
  }

  return 'neutral';
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

const StockImpactSchema = new mongoose.Schema(
  {
    before: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },

    quantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },

    after: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },
  },
  { _id: false }
);

const InventoryMovementSchema = new mongoose.Schema(
  {
    movementNumber: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      index: true,
      maxlength: 40,
    },

    type: {
      type: String,
      enum: INVENTORY_MOVEMENT_TYPES,
      required: true,
      default: 'correction',
      set: normalizeMovementType,
      index: true,
    },

    direction: {
      type: String,
      enum: INVENTORY_MOVEMENT_DIRECTIONS,
      default: 'neutral',
      index: true,
    },

    status: {
      type: String,
      enum: INVENTORY_MOVEMENT_STATUS,
      default: 'draft',
      index: true,
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
        sku: '',
        barcode: '',
      }),
    },

    variantKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      index: true,
    },

    branchFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },

    branchFromSnapshot: {
      type: BranchSnapshotSchema,
      default: () => ({
        name: '',
        code: '',
        type: '',
      }),
    },

    branchTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },

    branchToSnapshot: {
      type: BranchSnapshotSchema,
      default: () => ({
        name: '',
        code: '',
        type: '',
      }),
    },

    quantity: {
      type: Number,
      required: true,
      min: [1, 'La cantidad del movimiento debe ser mayor a cero.'],
      set: (value) => Math.max(1, Math.floor(Number(value || 0))),
    },

    stockFrom: {
      type: StockImpactSchema,
      default: () => ({
        before: 0,
        quantity: 0,
        after: 0,
      }),
    },

    stockTo: {
      type: StockImpactSchema,
      default: () => ({
        before: 0,
        quantity: 0,
        after: 0,
      }),
    },

    unitCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },

    totalCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (value) => cleanPositiveNumber(value),
    },

    reason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 240,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1200,
    },

    reference: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },

    orderNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: 40,
      index: true,
    },

    sourceModel: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    postedAt: {
      type: Date,
      default: null,
      index: true,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    reversedByMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryMovement',
      default: null,
    },

    reversalOfMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryMovement',
      default: null,
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
  },
  {
    timestamps: true,
  }
);

/* ============================
 * Índices
 * ============================ */

InventoryMovementSchema.index({ product: 1, createdAt: -1 });
InventoryMovementSchema.index({ product: 1, variantKey: 1, createdAt: -1 });
InventoryMovementSchema.index({ product: 1, 'variant.size': 1, 'variant.color': 1 });
InventoryMovementSchema.index({ branchFrom: 1, createdAt: -1 });
InventoryMovementSchema.index({ branchTo: 1, createdAt: -1 });
InventoryMovementSchema.index({ type: 1, status: 1, createdAt: -1 });
InventoryMovementSchema.index({ direction: 1, status: 1, createdAt: -1 });
InventoryMovementSchema.index({ order: 1, createdAt: -1 });
InventoryMovementSchema.index({ createdBy: 1, createdAt: -1 });
InventoryMovementSchema.index({ deletedAt: 1, createdAt: -1 });

/* ============================
 * Hooks
 * ============================ */

InventoryMovementSchema.pre('validate', async function inventoryMovementPreValidate(next) {
  try {
    this.type = normalizeMovementType(this.type);
    this.direction = resolveDirectionFromType(this.type);

    this.reason = cleanText(this.reason);
    this.notes = cleanText(this.notes);
    this.reference = cleanUpper(this.reference);
    this.orderNumber = cleanUpper(this.orderNumber);
    this.sourceModel = cleanText(this.sourceModel);

    if (!this.movementNumber) {
      const counter = await Counter.findOneAndUpdate(
        { _id: 'inventoryMovementNumber' },
        { $inc: { seq: 1 } },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      ).lean();

      this.movementNumber = `IM-${String(counter.seq).padStart(8, '0')}`;
    }

    if (this.productSnapshot) {
      this.productSnapshot.title = cleanText(this.productSnapshot.title);
      this.productSnapshot.sku = cleanUpper(this.productSnapshot.sku);
      this.productSnapshot.image = cleanText(this.productSnapshot.image);
      this.productSnapshot.category = cleanText(this.productSnapshot.category);
    }

    if (this.variant) {
      this.variant.size = cleanText(this.variant.size);
      this.variant.color = cleanText(this.variant.color);
      this.variant.attributes = normalizeAttributes(this.variant.attributes);
      const identity = assertVariantIdentity({
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
    }

    if (this.branchFromSnapshot) {
      this.branchFromSnapshot.name = cleanText(this.branchFromSnapshot.name);
      this.branchFromSnapshot.code = cleanUpper(this.branchFromSnapshot.code);
      this.branchFromSnapshot.type = cleanLower(this.branchFromSnapshot.type);
    }

    if (this.branchToSnapshot) {
      this.branchToSnapshot.name = cleanText(this.branchToSnapshot.name);
      this.branchToSnapshot.code = cleanUpper(this.branchToSnapshot.code);
      this.branchToSnapshot.type = cleanLower(this.branchToSnapshot.type);
    }

    this.quantity = Math.max(1, Math.floor(Number(this.quantity || 0)));
    this.unitCost = cleanPositiveNumber(this.unitCost);
    this.totalCost = cleanPositiveNumber(this.totalCost || this.unitCost * this.quantity);

    if (this.direction === 'in' && !this.branchTo) {
      return next(new Error('Los movimientos de entrada requieren una sede destino.'));
    }

    if (this.direction === 'out' && !this.branchFrom) {
      return next(new Error('Los movimientos de salida requieren una sede origen.'));
    }

    if (this.direction === 'transfer') {
      if (!this.branchFrom || !this.branchTo) {
        return next(new Error('Los traslados requieren sede origen y sede destino.'));
      }

      if (String(this.branchFrom) === String(this.branchTo)) {
        return next(new Error('La sede origen y la sede destino no pueden ser la misma.'));
      }
    }

    if (this.status === 'posted' && !this.postedAt) {
      this.postedAt = new Date();
    }

    if (this.status !== 'posted') {
      this.postedAt = this.postedAt || null;
    }

    if (this.status === 'cancelled' && !this.cancelledAt) {
      this.cancelledAt = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

/* ============================
 * Métodos de instancia
 * ============================ */

InventoryMovementSchema.methods.isPosted = function isPosted() {
  return this.status === 'posted';
};

InventoryMovementSchema.methods.isTransfer = function isTransfer() {
  return this.direction === 'transfer';
};

InventoryMovementSchema.methods.affectsBranch = function affectsBranch(branchId) {
  const id = String(branchId || '');

  if (!id) return false;

  return String(this.branchFrom || '') === id || String(this.branchTo || '') === id;
};

InventoryMovementSchema.methods.toSafeObject = function toSafeObject() {
  const movement = this.toObject({ virtuals: true });

  delete movement.__v;

  return movement;
};

/* ============================
 * Métodos estáticos
 * ============================ */

InventoryMovementSchema.statics.getTypes = function getTypes() {
  return [...INVENTORY_MOVEMENT_TYPES];
};

InventoryMovementSchema.statics.getDirections = function getDirections() {
  return [...INVENTORY_MOVEMENT_DIRECTIONS];
};

InventoryMovementSchema.statics.getStatuses = function getStatuses() {
  return [...INVENTORY_MOVEMENT_STATUS];
};

InventoryMovementSchema.statics.resolveDirectionFromType = resolveDirectionFromType;

InventoryMovementSchema.statics.buildBranchSnapshot = function buildBranchSnapshot(branch) {
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

InventoryMovementSchema.statics.buildProductSnapshot = function buildProductSnapshot(product) {
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

module.exports =
  mongoose.models.InventoryMovement ||
  mongoose.model('InventoryMovement', InventoryMovementSchema);
