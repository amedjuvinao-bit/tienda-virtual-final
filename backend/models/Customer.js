// backend/models/Customer.js

const mongoose = require('mongoose');

const {
  DOCUMENT_TYPES,
  buildCustomerIdentity,
  cleanLower,
  cleanPhone,
  cleanText,
  cleanUpper,
} = require('../lib/customers/customerIdentity');
const {
  CUSTOMER_INDEX_DEFINITIONS,
  cloneDefinitions,
} = require('./customerIndexDefinitions');

const CUSTOMER_SOURCES = ['pos', 'web', 'admin', 'import', 'system'];
const CUSTOMER_STATUSES = ['active', 'inactive', 'blocked'];

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
    cityCode: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    departmentCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'CO' },
    postalCode: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: true },
  },
  { _id: true }
);

const CustomerFiscalProfileSchema = new mongoose.Schema(
  {
    personType: {
      type: String,
      enum: ['', 'natural', 'juridica'],
      default: '',
    },
    businessName: { type: String, trim: true, default: '' },
    verificationDigit: { type: String, trim: true, default: '' },
    municipalityCode: { type: String, trim: true, default: '' },
    departmentCode: { type: String, trim: true, default: '' },
    countryCode: { type: String, trim: true, uppercase: true, default: 'CO' },
    tributeCode: { type: String, trim: true, uppercase: true, default: 'ZZ' },
    taxRegime: { type: String, trim: true, default: '' },
    taxResponsibilities: { type: [String], default: [] },
  },
  { _id: false }
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
    fiscalProfile: {
      type: CustomerFiscalProfileSchema,
      default: () => ({}),
    },

    source: {
      type: String,
      enum: CUSTOMER_SOURCES,
      default: 'admin',
    },
    status: {
      type: String,
      enum: CUSTOMER_STATUSES,
      default: 'active',
    },
    active: { type: Boolean, default: true },

    acceptsMarketing: { type: Boolean, default: false },
    notes: { type: String, trim: true, default: '' },
    tags: { type: [String], default: [] },

    defaultBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    branchIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
      default: [],
    },
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
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

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

cloneDefinitions(CUSTOMER_INDEX_DEFINITIONS).forEach(({ key, options }) => {
  CustomerSchema.index(key, options);
});

CustomerSchema.pre('validate', function preValidateCustomer(next) {
  this.firstName = cleanText(this.firstName);
  this.lastName = cleanText(this.lastName);
  this.fullName = cleanText(this.fullName || `${this.firstName} ${this.lastName}`);
  this.displayName = cleanText(this.displayName || this.fullName);

  const identity = buildCustomerIdentity(this);

  this.phone = cleanPhone(this.phone);
  this.normalizedPhone = identity.normalizedPhone;

  this.email = cleanLower(this.email, 180);
  this.normalizedEmail = identity.normalizedEmail;

  this.documentType = identity.documentType;
  this.documentNumber = cleanText(this.documentNumber);
  this.normalizedDocument = identity.normalizedDocument;

  this.address = cleanText(this.address);
  this.city = cleanText(this.city);
  this.department = cleanText(this.department);
  this.country = cleanUpper(this.country || 'CO');
  this.postalCode = cleanText(this.postalCode);

  const fiscal = this.fiscalProfile || {};
  fiscal.personType = cleanLower(fiscal.personType);
  fiscal.businessName = cleanText(fiscal.businessName);
  fiscal.verificationDigit = cleanText(fiscal.verificationDigit).replace(/\D/g, '').slice(0, 1);
  fiscal.municipalityCode = cleanText(fiscal.municipalityCode);
  fiscal.departmentCode = cleanText(fiscal.departmentCode);
  fiscal.countryCode = cleanUpper(fiscal.countryCode || this.country || 'CO');
  fiscal.tributeCode = cleanUpper(fiscal.tributeCode || 'ZZ');
  fiscal.taxRegime = cleanText(fiscal.taxRegime);
  fiscal.taxResponsibilities = Array.isArray(fiscal.taxResponsibilities)
    ? [...new Set(fiscal.taxResponsibilities.map((item) => cleanUpper(item)).filter(Boolean))].slice(0, 12)
    : [];
  this.fiscalProfile = fiscal;

  this.source = cleanLower(this.source || 'admin');
  this.status = cleanLower(this.status || 'active');
  this.active = this.status === 'active' && this.deletedAt == null;

  const branchIds = [
    ...(Array.isArray(this.branchIds) ? this.branchIds : []),
    this.defaultBranch,
  ]
    .filter(Boolean)
    .map((value) => String(value));
  this.branchIds = [...new Set(branchIds)].map(
    (value) => new mongoose.Types.ObjectId(value)
  );

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
    municipalityCode: this.fiscalProfile?.municipalityCode || '',
    postalCode: this.postalCode || '',
    country: this.country || 'CO',
    department: this.department || '',
    departmentCode: this.fiscalProfile?.departmentCode || '',
  };
};

CustomerSchema.methods.toBillingSnapshot = function toBillingSnapshot() {
  return {
    personType: this.fiscalProfile?.personType || 'natural',
    firstName: this.firstName || this.fullName || '',
    lastName: this.lastName || '',
    businessName: this.fiscalProfile?.businessName || '',
    documentType: this.documentType || '',
    documentNumber: this.documentNumber || '',
    id: this.documentNumber || '',
    dv: this.fiscalProfile?.verificationDigit || '',
    email: this.email || '',
    phone: this.phone || '',
    address: this.address || '',
    city: this.city || '',
    cityCode: this.fiscalProfile?.municipalityCode || '',
    municipalityCode: this.fiscalProfile?.municipalityCode || '',
    department: this.department || '',
    departmentCode: this.fiscalProfile?.departmentCode || '',
    country: this.country || 'CO',
    countryCode: this.fiscalProfile?.countryCode || this.country || 'CO',
    postalCode: this.postalCode || '',
    tributeCode: this.fiscalProfile?.tributeCode || 'ZZ',
    taxRegime: this.fiscalProfile?.taxRegime || '',
    taxResponsibilities: Array.isArray(
      this.fiscalProfile?.taxResponsibilities
    )
      ? [...this.fiscalProfile.taxResponsibilities]
      : [],
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
