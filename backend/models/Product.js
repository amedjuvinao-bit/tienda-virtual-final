// backend/models/Product.js
const mongoose = require('mongoose');
const Counter = require('./Counter');
const {
  PRODUCT_TYPE_VALUES,
  UNIT_OF_MEASURE_VALUES,
  normalizeProductType,
  normalizeUnitOfMeasure,
  normalizeVariantPreset,
  normalizeVariantAxes,
  shouldTrackInventory,
  buildSkuPrefix,
} = require('../lib/products/productUniversalConfig');
const {
  cleanText,
  cleanUpper,
  cleanMoney,
  normalizeAttributes,
  normalizeProductVariants,
  normalizeStringArray,
} = require('../lib/products/productVariantConfig');

// ==== Subesquemas opcionales ====
const InventoryItemSchema = new mongoose.Schema(
  {
    size: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    stock: { type: Number, default: 0, min: [0, 'El stock de la variante no puede ser negativo'] },
  },
  { _id: false }
);

const VariantAxisSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, lowercase: true, default: '' },
    label: { type: String, trim: true, default: '' },
    values: { type: [String], default: [] },
  },
  { _id: false }
);

const VariantAttributeSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, lowercase: true, default: '' },
    label: { type: String, trim: true, default: '' },
    value: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const ProductVariantSchema = new mongoose.Schema(
  {
    variantKey: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      index: true,
    },
    label: { type: String, trim: true, default: '' },
    size: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    attributes: {
      type: [VariantAttributeSchema],
      default: [],
      set: normalizeAttributes,
    },
    sku: { type: String, trim: true, uppercase: true, default: '' },
    barcode: { type: String, trim: true, default: '' },
    price: { type: Number, default: null, min: 0 },
    cost: { type: Number, default: null, min: 0 },
    originalPrice: { type: Number, default: null, min: 0 },
    image: { type: String, trim: true, default: '' },
    images: {
      type: [String],
      default: [],
      set: (arr) => normalizeStringArray(arr, 8),
      validate: [
        (arr) => Array.isArray(arr) && arr.length <= 8,
        'La galería de la variante admite máximo 8 imágenes.',
      ],
    },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0 },

    // Solo se usa para carga inicial/sincronización; la existencia real vive en InventoryStock.
    initialStock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const DimensionsSchema = new mongoose.Schema(
  { l: { type: Number, default: 0, min: 0 }, w: { type: Number, default: 0, min: 0 }, h: { type: Number, default: 0, min: 0 } },
  { _id: false }
);

const SupplierSchema = new mongoose.Schema(
  { name: { type: String, trim: true, default: '' } },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // SKU autogenerado si no lo envían
    sku: { type: String, required: true, trim: true }, // unicidad por índice

    // Slug para URL amigable (autogenerado del título)
    slug: { type: String, trim: true }, // unicidad por índice

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },

    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },

    // imágenes
    image: { type: String, default: '' },
    images: {
      type: [String],
      default: [],
      validate: [
        (arr) => Array.isArray(arr) && arr.length <= 5,
        'La galería admite máximo 5 imágenes.',
      ],
    },

    features: [String],

    // Colores (normalizados, máx 10)
    colors: {
      type: [String],
      default: [],
      set: (arr) => {
        if (!Array.isArray(arr)) return [];

        const normalized = arr
          .map((c) => {
            const raw =
              typeof c === 'string'
                ? c
                : c?.hex || c?.value || c?.name || '';

            return normalizeColorToHex(raw);
          })
          .filter(Boolean);

        const out = [];
        const seen = new Set();
        for (const c of normalized) {
          const key = c.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            out.push(c);
            if (out.length >= 10) break;
          }
        }
        return out;
      },
      validate: [
        (arr) => Array.isArray(arr) && arr.length <= 10,
        'Máximo 10 colores por producto.',
      ],
    },

    // Tallas / variantes heredadas. Se mantienen por compatibilidad.
    sizes: {
      type: [String],
      default: [],
      set: normalizeUniqueStringArray,
    },

    // Matriz de inventario heredada (talla x color)
    inventory: { type: [InventoryItemSchema], default: [] },

    // Variantes comerciales avanzadas.
    // Aquí viven precio/costo/SKU/barcode/imágenes por variante.
    // InventoryStock sigue siendo la fuente real de existencias por sede.
    variants: {
      type: [ProductVariantSchema],
      default: [],
    },

    // Tipo universal de producto
    productType: {
      type: String,
      enum: PRODUCT_TYPE_VALUES,
      default: 'physical',
      set: normalizeProductType,
      index: true,
    },

    unitOfMeasure: {
      type: String,
      enum: UNIT_OF_MEASURE_VALUES,
      default: 'unit',
      set: normalizeUnitOfMeasure,
    },

    trackInventory: {
      type: Boolean,
      default: true,
      index: true,
    },

    allowBackorder: {
      type: Boolean,
      default: false,
    },

    variantPreset: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'fashion',
      set: normalizeVariantPreset,
    },

    variantAxes: {
      type: [VariantAxisSchema],
      default: [],
    },

    // Ojo: en tu API haces populate('category'), pero aquí es String.
    // Lo dejo String para no romper compatibilidad.
    category: { type: String, trim: true, default: '' },

    // Categorías adicionales
    categories: {
      type: [String],
      default: [],
      set: normalizeUniqueStringArray,
    },

    // inventario/estado heredado. La fuente profesional es InventoryStock.
    stock: { type: Number, default: 0, min: 0 },

    // visible para el checkout/validador
    visible: { type: Boolean, default: true },

    // Se mantiene 'active' para compatibilidad con otras partes
    active: { type: Boolean, default: true },

    // campos opcionales
    reorderPoint: { type: Number, default: 0, min: 0 },
    reorderQty: { type: Number, default: 0, min: 0 },
    warehouseLocation: { type: String, trim: true, default: '' },
    weightGrams: { type: Number, default: 0, min: 0 },
    dimensionsCm: { type: DimensionsSchema, default: () => ({}) },

    // contabilidad / finanzas
    cost: { type: Number, default: 0, min: 0 },
    averageCost: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxIncluded: { type: Boolean, default: true },

    // comerciales
    brand: { type: String, trim: true, default: '' },
    season: { type: String, trim: true, default: '' },
    supplier: { type: SupplierSchema, default: () => ({}) },
    barcode: { type: String, trim: true, default: '' },

    // notas
    notes: { type: String, trim: true, default: '' },

    // reseñas por producto
    reviews: {
      type: [
        {
          name: { type: String, required: true, trim: true },
          rating: { type: Number, required: true, min: 1, max: 5 },
          comment: { type: String, required: true, trim: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// ===== Índices =====
productSchema.index({ categories: 1 });
productSchema.index({ productType: 1, active: 1 });
productSchema.index({ trackInventory: 1, active: 1 });
productSchema.index({ 'variants.variantKey': 1 });
productSchema.index({ 'variants.sku': 1 });
productSchema.index({ 'variants.barcode': 1 });
productSchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: 'string' } } }
);
productSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string', $ne: '' } } }
);
productSchema.index({ title: 'text', description: 'text' });
productSchema.index(
  { barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: 'string', $ne: '' } } }
);

function normalizeUniqueStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const v = String(x || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

// ===== Helpers para SKU =====
function pickPrefix(doc) {
  const cats = Array.isArray(doc.categories) && doc.categories.length
    ? doc.categories
    : (doc.category ? [doc.category] : []);

  const firstCategory = (cats[0] || '').toString();
  const source = firstCategory || doc.productType || 'OT';

  return buildSkuPrefix(source);
}

async function nextSeq(key) {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim());
}

function normalizeColorToHex(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (isHexColor(raw)) {
    if (raw.length === 4) {
      return (
        '#' +
        raw[1] + raw[1] +
        raw[2] + raw[2] +
        raw[3] + raw[3]
      ).toLowerCase();
    }
    return raw.toLowerCase();
  }

  const NAMED_COLORS = {
    skyblue: '#87ceeb',
    hotpink: '#ff69b4',
    pink: '#ffc0cb',
    red: '#ff0000',
    blue: '#0000ff',
    yellow: '#ffff00',
    green: '#008000',
    black: '#000000',
    white: '#ffffff',
    gray: '#808080',
    grey: '#808080',
    purple: '#800080',
    lilac: '#c8a2c8',
    gold: '#ffd700',
    beige: '#f5f5dc',
    brown: '#a52a2a',
    orange: '#ffa500',
  };

  return NAMED_COLORS[raw.toLowerCase()] || raw;
}

// Autogenera SKU si no viene
productSchema.pre('validate', async function (next) {
  try {
    this.productType = normalizeProductType(this.productType);
    this.unitOfMeasure = normalizeUnitOfMeasure(this.unitOfMeasure);
    this.variantPreset = normalizeVariantPreset(this.variantPreset);

    if (this.trackInventory === undefined || this.trackInventory === null) {
      this.trackInventory = shouldTrackInventory(this.productType);
    }

    if (!Array.isArray(this.variantAxes) || this.variantAxes.length === 0) {
      this.variantAxes = normalizeVariantAxes([], this.variantPreset);
    } else {
      this.variantAxes = normalizeVariantAxes(this.variantAxes, this.variantPreset);
    }

    this.variants = normalizeProductVariants(this.variants || [], {
      _id: this._id,
      title: this.title,
      sku: this.sku,
      price: this.price,
      cost: this.cost,
      averageCost: this.averageCost,
      image: this.image,
      images: this.images,
      stock: this.stock,
      sizes: this.sizes,
      colors: this.colors,
      inventory: this.inventory,
      trackInventory: this.trackInventory,
    }).map((variant) => ({
      ...variant,
      price: variant.price == null ? null : cleanMoney(variant.price, this.price || 0),
      cost: variant.cost == null ? null : cleanMoney(variant.cost, this.cost || this.averageCost || 0),
      originalPrice: variant.originalPrice == null ? null : cleanMoney(variant.originalPrice, 0),
    }));

    if (!this.sku) {
      const prefix = pickPrefix(this);
      const now = new Date();
      const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const counterKey = `sku-${prefix}-${yyyymm}`;
      const seq = await nextSeq(counterKey);
      this.sku = `${prefix}-${yyyymm}-${String(seq).padStart(4, '0')}`;
    }

    // Si no han seteado 'visible' explícitamente, refleja 'active'
    if (this.isModified('active') && !this.isModified('visible')) {
      this.visible = this.active !== false;
    }
    if (this.isModified('visible') && !this.isModified('active')) {
      this.active = this.visible !== false;
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Marca si al guardar debe sincronizar la ficha comercial con InventoryStock.
productSchema.pre('save', function markProductInventorySync(next) {
  try {
    this.$locals = this.$locals || {};
    this.$locals.syncInventoryAfterSave =
      this.isNew ||
      this.isModified('title') ||
      this.isModified('sku') ||
      this.isModified('image') ||
      this.isModified('category') ||
      this.isModified('productType') ||
      this.isModified('trackInventory') ||
      this.isModified('variantPreset') ||
      this.isModified('variantAxes') ||
      this.isModified('sizes') ||
      this.isModified('colors') ||
      this.isModified('inventory') ||
      this.isModified('variants') ||
      this.isModified('stock') ||
      this.isModified('reorderPoint') ||
      this.isModified('reorderQty') ||
      this.isModified('warehouseLocation') ||
      this.isModified('cost') ||
      this.isModified('averageCost');

    next();
  } catch (error) {
    next(error);
  }
});

// Autogenera/actualiza SLUG desde el título y garantiza unicidad
productSchema.pre('save', async function (next) {
  try {
    // Sin cambios en título y ya hay slug → no tocar
    if (!this.isModified('title') && this.slug) return next();

    const base = slugify(this.title || '');
    if (!base) {
      this.slug = undefined;
      return next();
    }

    let candidate = base;
    let suffix = 2;
    const Model = this.constructor;

    const exists = async (slug) => {
      const found = await Model.findOne({ slug }, { _id: 1 }).lean();
      if (!found) return false;
      return String(found._id) !== String(this._id || '');
    };

    while (await exists(candidate)) {
      candidate = `${base}-${suffix++}`;
    }

    this.slug = candidate;
    next();
  } catch (err) {
    next(err);
  }
});

// Mantén stock heredado en sync con inventory (suma variantes) si cambia.
// La fuente profesional por sede es InventoryStock.
productSchema.pre('save', function (next) {
  try {
    if (this.isModified('inventory') && Array.isArray(this.inventory)) {
      this.stock = this.inventory.reduce((acc, row) => {
        const n = Number(row?.stock || 0);
        return acc + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0);
    }
    next();
  } catch (e) {
    next(e);
  }
});

// Sincroniza catálogo comercial con inventario real sin sobrescribir movimientos existentes.
productSchema.post('save', async function syncProductInventoryAfterSave(doc) {
  if (!doc?.$locals?.syncInventoryAfterSave) return;

  try {
    const { syncProductInventoryFromProduct } = require('../services/productInventorySyncService');
    await syncProductInventoryFromProduct(doc);
  } catch (error) {
    console.error('[Product] No se pudo sincronizar InventoryStock:', error.message);
  }
});

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
