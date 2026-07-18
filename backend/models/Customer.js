// backend/models/Customer.js

const mongoose = require('mongoose');

const CUSTOMER_SOURCES = ['pos', 'web', 'admin', 'import', 'system'];
const CUSTOMER_STATUSES = ['active', 'inactive', 'blocked'];
const DOCUMENT_TYPES = ['CC', 'CE', 'NIT', 'TI', 'PP', 'RC', 'DNI', 'OTHER', ''];

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function cleanPhone(value) {
  return cleanText(value).replace(/[^0-9+]/g, '');
}

function onlyDigits(value) {
  return cleanText(value).replace(/\D/g, '');
}

function cleanMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function cleanCounter(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function buildCustomerCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CLI-${timestamp}-${random}`;
}

const CustomerAddressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Principal' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'CO' },
    postalCode: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: true },
  },
  { _id: true }
);

const CustomerPurchaseStatsSchema = new mongoose.Schema(
  {
    ordersCount: { type: Number, default: 0, min: 0, set: cleanCounter },
    posOrdersCount: { type: Number, default: 0, min: 0, set: cleanCounter },
    webOrdersCount: { type: Number, default: 0, min: 0, set: cleanCounter },
    totalSpent: { type: Number, default: 0, min: 0, set: cleanMoney },
    lastOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    lastOrderNumber: { type: String, trim: true, default: '' },
    lastPurchaseAt: { type: Date, default: null },
    firstPurchaseAt: { type: Date, default: null },
  },
  { _id: false }
);

const CustomerSchema = new mongoose.Schema(
  {
    customerCode: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },

    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    fullName: { type: String, trim: true, required: true },
    displayName: { type: String, trim: true, default: '' },

    phone: { type: String, trim: true, default: '' },
    normalizedPhone: { type: String, trim: true, default: '' },

    email: { type: String, trim: true, lowercase: true, default: '' },
    normalizedEmail: { type: String, trim: true, lowercase: true, default: '' },

    documentType: {
      type: String,
      trim: true,
      uppercase: true,
      enum: DOCUMENT_TYPES,
      default: '',
    },
    documentNumber: { type: String, trim: true, default: '' },
    normalizedDocument: { type: String, trim: true, default: '' },

    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, uppercase: true, default: 'CO' },
    postalCode: { type: String, trim: true, default: '' },
    addresses: { type: [CustomerAddressSchema], default: [] },

    source: {
      type: String,
      enum: CUSTOMER_SOURCES,
      default: 'admin',
      index: true,
    },
    status: {
      type: String,
      enum: CUSTOMER_STATUSES,
      default: 'active',
      index: true,
    },
    active: { type: Boolean, default: true, index: true },

    acceptsMarketing: { type: Boolean, default: false },
    notes: { type: String, trim: true, default: '' },
    tags: { type: [String], default: [] },

    defaultBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null, index: true },
    updatedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },

    stats: {
      type: CustomerPurchaseStatsSchema,
      default: () => ({
        ordersCount: 0,
        posOrdersCount: 0,
        webOrdersCount: 0,
        totalSpent: 0,
        lastOrder: null,
        lastOrderNumber: '',
        lastPurchaseAt: null,
        firstPurchaseAt: null,
      }),
    },

    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

CustomerSchema.index({ fullName: 'text', phone: 'text', email: 'text', documentNumber: 'text', customerCode: 'text' });
CustomerSchema.index({ normalizedPhone: 1 }, { partialFilterExpression: { normalizedPhone: { $type: 'string', $ne: '' } } });
CustomerSchema.index({ normalizedEmail: 1 }, { partialFilterExpression: { normalizedEmail: { $type: 'string', $ne: '' } } });
CustomerSchema.index({ documentType: 1, normalizedDocument: 1 }, { partialFilterExpression: { normalizedDocument: { $type: 'string', $ne: '' } } });
CustomerSchema.index({ source: 1, status: 1, createdAt: -1 });
CustomerSchema.index({ active: 1, deletedAt: 1, createdAt: -1 });

CustomerSchema.pre('validate', function preValidateCustomer(next) {
  this.firstName = cleanText(this.firstName);
  this.lastName = cleanText(this.lastName);
  this.fullName = cleanText(this.fullName || `${this.firstName} ${this.lastName}`);
  this.displayName = cleanText(this.displayName || this.fullName);

  this.phone = cleanPhone(this.phone);
  this.normalizedPhone = cleanPhone(this.normalizedPhone || this.phone);

  this.email = cleanLower(this.email);
  this.normalizedEmail = cleanLower(this.normalizedEmail || this.email);

  this.documentType = cleanUpper(this.documentType);
  this.documentNumber = cleanText(this.documentNumber);
  this.normalizedDocument = onlyDigits(this.normalizedDocument || this.documentNumber);

  this.address = cleanText(this.address);
  this.city = cleanText(this.city);
  this.department = cleanText(this.department);
  this.country = cleanUpper(this.country || 'CO');
  this.postalCode = cleanText(this.postalCode);

  this.source = cleanLower(this.source || 'admin');
  this.status = cleanLower(this.status || 'active');
  this.active = this.status === 'active' && this.deletedAt == null;

  if (!this.customerCode) this.customerCode = buildCustomerCode();

  this.tags = Array.isArray(this.tags)
    ? [...new Set(this.tags.map((tag) => cleanLower(tag)).filter(Boolean))].slice(0, 12)
    : [];

  if (!this.fullName) {
    this.invalidate('fullName', 'El nombre del cliente es obligatorio.');
  }

  next();
});

CustomerSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject({ virtuals: true });
  obj.id = String(this._id);
  return obj;
};

CustomerSchema.methods.toOrderSnapshot = function toOrderSnapshot() {
  return {
    customerId: String(this._id),
    customerCode: this.customerCode || '',
    name: this.fullName || this.displayName || '',
    lastname: '',
    id: this.documentNumber || '',
    documentType: this.documentType || '',
    emailOrPhone: this.email || this.phone || '',
    email: this.email || '',
    phone: this.phone || '',
    address: this.address || '',
    city: this.city || '',
    postalCode: this.postalCode || '',
    country: this.country || 'CO',
    department: this.department || '',
  };
};

CustomerSchema.statics.buildGuestSnapshot = function buildGuestSnapshot() {
  return {
    customerId: null,
    customerCode: '',
    name: 'Consumidor final',
    lastname: '',
    id: '',
    documentType: '',
    emailOrPhone: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'CO',
    department: '',
  };
};

module.exports = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
