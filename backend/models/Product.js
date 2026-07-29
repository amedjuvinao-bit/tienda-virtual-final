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
  buildVariantKey,
  normalizeAttributes,
  normalizeProductVariants,
  normalizeStringArray,
} = require('../lib/products/productVariantConfig');
const {
  COMMERCIAL_FIELD_TYPES,
  normalizeCommercialFields,
  normalizeSeo,
  normalizeStringArray: normalizeCommercialStringArray,
} = require('../lib/products/productCommercialConfig');
const {
  DIGITAL_DELIVERY_MODES,
  SERVICE_FULFILLMENT_MODES,
  SERVICE_LOCATION_TYPES,
  normalizeDigitalDelivery,
  normalizeServiceDelivery,
  normalizeBundleComponents,
} = require('../lib/products/productFulfillmentConfig');

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
      default: '',
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

ProductVariantSchema.pre('validate', function normalizeVariantBeforeValidate(next) {
  try {
    this.size = cleanText(this.size, 80);
    this.color = cleanText(this.color, 120);
    this.variantKey = cleanText(this.variantKey || buildVariantKey(this.size, this.color), 180).toLowerCase();

    if (!this.variantKey || this.variantKey === '__') {
      this.variantKey = 'default__default';
    }

    if (!this.label) {
      this.label = [this.size, this.color].filter(Boolean).join(' / ') || 'Variante general';
    }

    this.label = cleanText(this.label, 160);
    this.attributes = normalizeAttributes(this.attributes);
    this.sku = cleanUpper(this.sku, 100);
    this.barcode = cleanText(this.barcode, 120);
    this.image = cleanText(this.image, 1000);
    this.images = normalizeStringArray(this.images, 8);
    this.price = this.price == null ? null : cleanMoney(this.price, 0);
    this.cost = this.cost == null ? null : cleanMoney(this.cost, 0);
    this.originalPrice = this.originalPrice == null ? null : cleanMoney(this.originalPrice, 0);
    this.initialStock = cleanMoney(this.initialStock, 0);
    this.sortOrder = Math.max(0, Math.floor(Number(this.sortOrder || 0)));
    this.active = this.active !== false;

    next();
  } catch (error) {
    next(error);
  }
});

const DimensionsSchema = new mongoose.Schema(
  { l: { type: Number, default: 0, min: 0 }, w: { type: Number, default: 0, min: 0 }, h: { type: Number, default: 0, min: 0 } },
  { _id: false }
);

const SupplierSchema = new mongoose.Schema(
  { name: { type: String, trim: true, default: '' } },
  { _id: false }
);

const ProductSeoSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    keywords: {
      type: [String],
      default: [],
      set: (values) =>
        normalizeCommercialStringArray(values, 15, 60),
    },
    image: { type: String, trim: true, default: '' },
    canonicalUrl: { type: String, trim: true, default: '' },
    noIndex: { type: Boolean, default: false },
  },
  { _id: false }
);

const ProductCommercialFieldSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
    },
    label: { type: String, trim: true, required: true },
    group: { type: String, trim: true, default: 'General' },
    type: {
      type: String,
      enum: COMMERCIAL_FIELD_TYPES,
      default: 'text',
    },
    value: { type: String, default: '' },
    public: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const DigitalDeliverySchema = new mongoose.Schema(
  {
    deliveryMode: {
      type: String,
      enum: DIGITAL_DELIVERY_MODES,
      default: 'manual',
    },
    assetUrl: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
    fileName: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    fileSizeBytes: { type: Number, min: 0, default: 0 },
    downloadLimit: { type: Number, min: 1, max: 100, default: 3 },
    accessDays: { type: Number, min: 1, max: 3650, default: 30 },
    customerMessage: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
  },
  { _id: false }
);

const ServiceDeliverySchema = new mongoose.Schema(
  {
    fulfillmentMode: {
      type: String,
      enum: SERVICE_FULFILLMENT_MODES,
      default: 'manual',
    },
    locationType: {
      type: String,
      enum: SERVICE_LOCATION_TYPES,
      default: 'online',
    },
    durationMinutes: { type: Number, min: 5, max: 10080, default: 60 },
    leadTimeHours: { type: Number, min: 0, max: 8760, default: 0 },
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
  },
  { _id: false }
);

const BundleComponentSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'default__default',
    },
    quantity: { type: Number, min: 1, max: 9999, default: 1 },
    title: { type: String, trim: true, default: '' },
    sku: { type: String, trim: true, uppercase: true, default: '' },
    image: { type: String, trim: true, default: '' },
    productType: { type: String, trim: true, lowercase: true, default: '' },
    size: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    variantLabel: { type: String, trim: true, default: '' },
    trackInventory: { type: Boolean, default: true },
    allowBackorder: { type: Boolean, default: false },
    requiresShipping: { type: Boolean, default: true },
  },
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

    // Taxonomía profesional. Los campos de texto anteriores se conservan
    // como instantánea compatible para catálogo, cupones e informes.
    primaryCategoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductTaxonomy',
      default: null,
      index: true,
    },
    categoryRefs: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ProductTaxonomy',
        },
      ],
      default: [],
    },
    collectionRefs: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ProductTaxonomy',
        },
      ],
      default: [],
    },

    tags: {
      type: [String],
      default: [],
      set: (values) =>
        normalizeCommercialStringArray(values, 30, 80),
    },

    seo: {
      type: ProductSeoSchema,
      default: () => ({}),
    },

    commercialFields: {
      type: [ProductCommercialFieldSchema],
      default: [],
    },

    digitalDelivery: {
      type: DigitalDeliverySchema,
      default: () => ({}),
    },

    serviceDelivery: {
      type: ServiceDeliverySchema,
      default: () => ({}),
    },

    bundleComponents: {
      type: [BundleComponentSchema],
      default: [],
    },

    // inventario/estado heredado. La fuente profesional es InventoryStock.
    stock: { type: Number, default: 0, min: 0 },

    // visible para el checkout/validador
    visible: { type: Boolean, default: true },

    // Se mantiene 'active' para compatibilidad con otras partes
    active: { type: Boolean, default: true },

    // Archivo lógico: conserva historial, códigos, imágenes y relaciones.
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

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
productSchema.index({ categoryRefs: 1 });
productSchema.index({ collectionRefs: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ 'bundleComponents.product': 1 });
productSchema.index({ productType: 1, active: 1 });
productSchema.index({ trackInventory: 1, active: 1 });
productSchema.index({ archivedAt: 1, active: 1 });
productSchema.index({ archivedAt: 1, createdAt: -1 });
productSchema.index({ archivedAt: 1, updatedAt: -1 });
productSchema.index({ archivedAt: 1, title: 1 });
productSchema.index({
  archivedAt: 1,
  productType: 1,
  active: 1,
  createdAt: -1,
});
productSchema.index({
  archivedAt: 1,
  active: 1,
  visible: 1,
  createdAt: -1,
});
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

function findDuplicateCode(values = [], normalize = (value) => value) {
  const seen = new Set();

  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized) continue;
    if (seen.has(normalized)) return normalized;
    seen.add(normalized);
  }

  return '';
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
    this.tags = normalizeCommercialStringArray(
      this.tags,
      30,
      80
    );
    this.seo = normalizeSeo(this.seo, {
      title: this.title,
      description: this.description,
      image: this.image,
    });
    this.commercialFields = normalizeCommercialFields(
      this.commercialFields
    );
    this.digitalDelivery = normalizeDigitalDelivery(
      this.digitalDelivery
    );
    this.serviceDelivery = normalizeServiceDelivery(
      this.serviceDelivery
    );
    this.bundleComponents = normalizeBundleComponents(
      this.bundleComponents
    );

    if (this.productType === 'bundle') {
      const bundleIdentities = new Set();
      for (const component of this.bundleComponents) {
        const identity =
          `${String(component.product)}:${component.variantKey}`;
        if (bundleIdentities.has(identity)) {
          throw new Error(
            'El combo contiene el mismo producto y variante más de una vez.'
          );
        }
        bundleIdentities.add(identity);
      }
    }

    if (this.productType !== 'digital') {
      this.digitalDelivery = normalizeDigitalDelivery({});
    }

    if (this.productType !== 'service') {
      this.serviceDelivery = normalizeServiceDelivery({});
    }

    if (this.productType !== 'bundle') {
      this.bundleComponents = [];
    }

    this.trackInventory = shouldTrackInventory(
      this.productType,
      this.trackInventory
    );

    if (!Array.isArray(this.variantAxes) || this.variantAxes.length === 0) {
      this.variantAxes = normalizeVariantAxes([], this.variantPreset);
    } else {
      this.variantAxes = normalizeVariantAxes(this.variantAxes, this.variantPreset);
    }

    const shouldValidateCommercialCodes =
      this.isNew ||
      this.isModified('sku') ||
      this.isModified('barcode') ||
      this.isModified('variants');
    const rawVariantRows = Array.isArray(this.variants)
      ? this.variants
      : [];
    const duplicateVariantKey = shouldValidateCommercialCodes
      ? findDuplicateCode(
          rawVariantRows.map((variant) =>
            buildVariantKey(variant?.size, variant?.color)
          ),
          (value) => cleanText(value, 180).toLowerCase()
        )
      : '';

    const variantsAreExplicitlyEmpty =
      this.$locals?.variantsAuthoritative === true &&
      (!Array.isArray(this.variants) || this.variants.length === 0);
    this.variants = variantsAreExplicitlyEmpty
      ? []
      : normalizeProductVariants(this.variants || [], {
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

    const variantRows = Array.isArray(this.variants) ? this.variants : [];
    const skuValues = shouldValidateCommercialCodes
      ? [
          cleanUpper(this.sku, 100),
          ...variantRows.map((variant) => cleanUpper(variant?.sku, 100)),
        ].filter(Boolean)
      : [];
    const barcodeValues = shouldValidateCommercialCodes
      ? [
          cleanText(this.barcode, 120),
          ...variantRows.map((variant) => cleanText(variant?.barcode, 120)),
        ].filter(Boolean)
      : [];

    const duplicateSku = findDuplicateCode(
      skuValues,
      (value) => cleanUpper(value, 100)
    );
    const duplicateBarcode = findDuplicateCode(
      barcodeValues,
      (value) => cleanText(value, 120).toLowerCase()
    );

    if (duplicateVariantKey) {
      this.invalidate(
        'variants',
        `Combinación de variante duplicada: ${duplicateVariantKey}`
      );
    }

    if (duplicateSku) {
      this.invalidate(
        'variants',
        `SKU duplicado dentro del producto: ${duplicateSku}`
      );
    }

    if (duplicateBarcode) {
      this.invalidate(
        'variants',
        `Código de barras duplicado dentro del producto: ${duplicateBarcode}`
      );
    }

    if (!duplicateVariantKey && !duplicateSku && skuValues.length) {
      const skuConflict = await this.constructor
        .findOne({
          _id: { $ne: this._id },
          $or: [
            { sku: { $in: skuValues } },
            { 'variants.sku': { $in: skuValues } },
          ],
        })
        .select('_id')
        .lean();

      if (skuConflict) {
        this.invalidate(
          'variants',
          'Uno de los SKU ya pertenece a otro producto o variante.'
        );
      }
    }

    if (!duplicateVariantKey && !duplicateBarcode && barcodeValues.length) {
      const barcodeConflict = await this.constructor
        .findOne({
          _id: { $ne: this._id },
          $or: [
            { barcode: { $in: barcodeValues } },
            { 'variants.barcode': { $in: barcodeValues } },
          ],
        })
        .select('_id')
        .lean();

      if (barcodeConflict) {
        this.invalidate(
          'variants',
          'Uno de los códigos de barras ya pertenece a otro producto o variante.'
        );
      }
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
    doc.$locals.inventorySyncResult = await syncProductInventoryFromProduct(
      doc,
      {
        adminId: doc.$locals.adminId || null,
        variantsAuthoritative:
          doc.$locals.variantsAuthoritative === true,
      }
    );
  } catch (error) {
    doc.$locals.inventorySyncResult = {
      ok: false,
      message: error.message,
    };
    console.error('[Product] No se pudo sincronizar InventoryStock:', error.message);
  }
});

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
