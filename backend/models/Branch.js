// backend/models/Branch.js

const mongoose = require('mongoose');

const BRANCH_STATUS = ['active', 'inactive', 'closed', 'maintenance'];

const BRANCH_TYPES = [
  'store', // Tienda física
  'warehouse', // Bodega
  'office', // Oficina administrativa
  'pickup_point', // Punto de recogida
  'virtual', // Sede virtual / ventas online
];

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeCode(value) {
  return normalizeUpper(value)
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9._-]/g, '');
}

function normalizeEmail(value) {
  return normalizeLower(value);
}

const BranchContactSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },

    whatsapp: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'El correo electrónico de la sede no tiene un formato válido.',
      ],
    },
  },
  { _id: false }
);

const BranchAddressSchema = new mongoose.Schema(
  {
    country: {
      type: String,
      trim: true,
      default: 'Colombia',
      maxlength: 80,
    },

    department: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },

    departmentCode: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    cityCode: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },

    addressLine: {
      type: String,
      trim: true,
      maxlength: 250,
      default: '',
    },

    neighborhood: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    postalCode: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },
  },
  { _id: false }
);

const BranchGeoSchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      default: null,
    },

    lng: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const BranchScheduleDaySchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },

    open: {
      type: String,
      trim: true,
      default: '08:00',
      maxlength: 10,
    },

    close: {
      type: String,
      trim: true,
      default: '18:00',
      maxlength: 10,
    },
  },
  { _id: false }
);

const BranchScheduleSchema = new mongoose.Schema(
  {
    monday: {
      type: BranchScheduleDaySchema,
      default: () => ({}),
    },

    tuesday: {
      type: BranchScheduleDaySchema,
      default: () => ({}),
    },

    wednesday: {
      type: BranchScheduleDaySchema,
      default: () => ({}),
    },

    thursday: {
      type: BranchScheduleDaySchema,
      default: () => ({}),
    },

    friday: {
      type: BranchScheduleDaySchema,
      default: () => ({}),
    },

    saturday: {
      type: BranchScheduleDaySchema,
      default: () => ({
        enabled: true,
        open: '09:00',
        close: '14:00',
      }),
    },

    sunday: {
      type: BranchScheduleDaySchema,
      default: () => ({
        enabled: false,
        open: '',
        close: '',
      }),
    },
  },
  { _id: false }
);

const BranchFiscalSchema = new mongoose.Schema(
  {
    useCompanyFiscalInfo: {
      type: Boolean,
      default: true,
    },

    legalName: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
    },

    nit: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },

    dv: {
      type: String,
      trim: true,
      maxlength: 5,
      default: '',
    },

    billingEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'El correo de facturación de la sede no tiene un formato válido.',
      ],
    },

    dianResolutionPrefix: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 20,
      default: '',
    },
  },
  { _id: false }
);

const BranchSettingsSchema = new mongoose.Schema(
  {
    allowPosSales: {
      type: Boolean,
      default: true,
    },

    allowManualOrders: {
      type: Boolean,
      default: true,
    },

    allowInventoryMovements: {
      type: Boolean,
      default: true,
    },

    allowElectronicInvoice: {
      type: Boolean,
      default: true,
    },

    requireCashSessionForPos: {
      type: Boolean,
      default: true,
    },

    allowNegativeStock: {
      type: Boolean,
      default: false,
    },

    defaultPaymentMethod: {
      type: String,
      trim: true,
      enum: ['', 'cash', 'transfer', 'card', 'mixed', 'other'],
      default: 'cash',
    },

    defaultCustomerName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Consumidor final',
    },
  },
  { _id: false }
);

const BranchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 30,
      match: [
        /^[A-Z0-9._-]+$/,
        'El código de la sede solo puede contener letras, números, punto, guion y guion bajo.',
      ],
    },

    type: {
      type: String,
      enum: BRANCH_TYPES,
      default: 'store',
    },

    status: {
      type: String,
      enum: BRANCH_STATUS,
      default: 'active',
    },

    active: {
      type: Boolean,
      default: true,
    },

    isMain: {
      type: Boolean,
      default: false,
    },

    isDefaultForOnlineOrders: {
      type: Boolean,
      default: false,
    },

    contact: {
      type: BranchContactSchema,
      default: () => ({}),
    },

    address: {
      type: BranchAddressSchema,
      default: () => ({}),
    },

    geo: {
      type: BranchGeoSchema,
      default: () => ({}),
    },

    schedule: {
      type: BranchScheduleSchema,
      default: () => ({}),
    },

    fiscal: {
      type: BranchFiscalSchema,
      default: () => ({}),
    },

    settings: {
      type: BranchSettingsSchema,
      default: () => ({}),
    },

    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
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

    deletedAt: {
      type: Date,
      default: null,
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

BranchSchema.index({ code: 1 }, { unique: true });
BranchSchema.index({ active: 1, status: 1, type: 1 });
BranchSchema.index({ isMain: 1 });
BranchSchema.index({ isDefaultForOnlineOrders: 1 });
BranchSchema.index({ manager: 1 });
BranchSchema.index({ 'address.city': 1 });
BranchSchema.index({ 'address.department': 1 });
BranchSchema.index({ deletedAt: 1 });

/* ============================
 * Virtuales
 * ============================ */

BranchSchema.virtual('fullAddress').get(function () {
  const parts = [
    this.address?.addressLine,
    this.address?.neighborhood,
    this.address?.city,
    this.address?.department,
    this.address?.country,
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return parts.join(', ');
});

BranchSchema.virtual('isOperational').get(function () {
  return this.active === true && this.status === 'active';
});

/* ============================
 * Hooks
 * ============================ */

BranchSchema.pre('validate', function (next) {
  try {
    this.name = normalizeText(this.name);
    this.code = normalizeCode(this.code || this.name);
    this.notes = normalizeText(this.notes);

    if (this.status !== 'active') {
      this.active = false;
    }

    if (this.active === false && this.status === 'active') {
      this.status = 'inactive';
    }

    if (this.contact) {
      this.contact.phone = normalizeText(this.contact.phone);
      this.contact.whatsapp = normalizeText(this.contact.whatsapp);
      this.contact.email = normalizeEmail(this.contact.email);
    }

    if (this.address) {
      this.address.country = normalizeText(this.address.country || 'Colombia');
      this.address.department = normalizeText(this.address.department);
      this.address.departmentCode = normalizeText(this.address.departmentCode);
      this.address.city = normalizeText(this.address.city);
      this.address.cityCode = normalizeText(this.address.cityCode);
      this.address.addressLine = normalizeText(this.address.addressLine);
      this.address.neighborhood = normalizeText(this.address.neighborhood);
      this.address.postalCode = normalizeText(this.address.postalCode);
    }

    if (this.fiscal) {
      this.fiscal.legalName = normalizeText(this.fiscal.legalName);
      this.fiscal.nit = normalizeText(this.fiscal.nit);
      this.fiscal.dv = normalizeText(this.fiscal.dv);
      this.fiscal.billingEmail = normalizeEmail(this.fiscal.billingEmail);
      this.fiscal.dianResolutionPrefix = normalizeUpper(
        this.fiscal.dianResolutionPrefix
      );
    }

    if (this.settings) {
      this.settings.defaultCustomerName = normalizeText(
        this.settings.defaultCustomerName || 'Consumidor final'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

/* ============================
 * Métodos
 * ============================ */

BranchSchema.methods.canSell = function canSell() {
  return (
    this.active === true &&
    this.status === 'active' &&
    this.settings?.allowPosSales === true
  );
};

BranchSchema.methods.canCreateManualOrders = function canCreateManualOrders() {
  return (
    this.active === true &&
    this.status === 'active' &&
    this.settings?.allowManualOrders === true
  );
};

BranchSchema.methods.canManageInventory = function canManageInventory() {
  return (
    this.active === true &&
    this.status === 'active' &&
    this.settings?.allowInventoryMovements === true
  );
};

BranchSchema.methods.canGenerateElectronicInvoice =
  function canGenerateElectronicInvoice() {
    return (
      this.active === true &&
      this.status === 'active' &&
      this.settings?.allowElectronicInvoice === true
    );
  };

BranchSchema.methods.toSafeObject = function toSafeObject() {
  const branch = this.toObject({ virtuals: true });

  delete branch.__v;

  return branch;
};

/* ============================
 * Métodos estáticos
 * ============================ */

BranchSchema.statics.normalizeCode = normalizeCode;

BranchSchema.statics.getStatuses = function getStatuses() {
  return [...BRANCH_STATUS];
};

BranchSchema.statics.getTypes = function getTypes() {
  return [...BRANCH_TYPES];
};

BranchSchema.statics.findMain = function findMain() {
  return this.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
    isMain: true,
  });
};

BranchSchema.statics.findDefaultForOnlineOrders =
  function findDefaultForOnlineOrders() {
    return this.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      isDefaultForOnlineOrders: true,
    });
  };

/* ============================
 * Salida limpia
 * ============================ */

BranchSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

BranchSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
});

/* ============================
 * Export
 * ============================ */

module.exports = mongoose.models.Branch || mongoose.model('Branch', BranchSchema);