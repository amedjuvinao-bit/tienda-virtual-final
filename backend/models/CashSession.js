// backend/models/CashSession.js

const mongoose = require('mongoose');

const CASH_SESSION_STATUSES = ['open', 'closed', 'cancelled'];
const CASH_MOVEMENT_TYPES = [
  'opening',
  'cash_in',
  'cash_out',
  'expense',
  'withdrawal',
  'adjustment',
  'closing',
];

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function cleanMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}

function cleanSignedMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number);
}

function buildSessionCode() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `CAJA-${y}${m}${d}-${random}`;
}

const BranchSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, uppercase: true, default: '' },
    type: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const AdminSnapshotSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, lowercase: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, lowercase: true, default: '' },
    adminRole: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const PaymentTotalsSchema = new mongoose.Schema(
  {
    cash: { type: Number, default: 0, min: 0, set: cleanMoney },
    transfer: { type: Number, default: 0, min: 0, set: cleanMoney },
    card: { type: Number, default: 0, min: 0, set: cleanMoney },
    mixed: { type: Number, default: 0, min: 0, set: cleanMoney },
    other: { type: Number, default: 0, min: 0, set: cleanMoney },
    total: { type: Number, default: 0, min: 0, set: cleanMoney },
  },
  { _id: false }
);

const SalesSummarySchema = new mongoose.Schema(
  {
    ordersCount: { type: Number, default: 0, min: 0 },
    cancelledOrdersCount: { type: Number, default: 0, min: 0 },
    refundedOrdersCount: { type: Number, default: 0, min: 0 },
    itemsCount: { type: Number, default: 0, min: 0 },
    grossSales: { type: Number, default: 0, min: 0, set: cleanMoney },
    discounts: { type: Number, default: 0, min: 0, set: cleanMoney },
    refunds: { type: Number, default: 0, min: 0, set: cleanMoney },
    netSales: { type: Number, default: 0, min: 0, set: cleanMoney },
    paymentTotals: { type: PaymentTotalsSchema, default: () => ({}) },
  },
  { _id: false }
);

const CashMovementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: CASH_MOVEMENT_TYPES,
      required: true,
      trim: true,
      lowercase: true,
    },
    amount: { type: Number, required: true, min: 0, set: cleanMoney },
    direction: {
      type: String,
      enum: ['in', 'out', 'neutral'],
      default: 'neutral',
      trim: true,
      lowercase: true,
    },
    reason: { type: String, trim: true, maxlength: 300, default: '' },
    reference: { type: String, trim: true, maxlength: 120, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    createdBySnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const CashSessionSchema = new mongoose.Schema(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      default: buildSessionCode,
      index: true,
    },

    status: {
      type: String,
      enum: CASH_SESSION_STATUSES,
      default: 'open',
      index: true,
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },

    branchSnapshot: {
      type: BranchSnapshotSchema,
      default: () => ({ name: '', code: '', type: '' }),
    },

    cashRegisterCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 40,
      default: 'CAJA PRINCIPAL',
      index: true,
    },

    cashRegisterName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Caja principal',
    },

    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
      index: true,
    },

    cashierSnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({ username: '', displayName: '', role: '', adminRole: '' }),
    },

    openedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    closedAt: {
      type: Date,
      default: null,
      index: true,
    },

    openingAmount: {
      type: Number,
      default: 0,
      min: 0,
      set: cleanMoney,
    },

    expectedCash: {
      type: Number,
      default: 0,
      min: 0,
      set: cleanMoney,
    },

    countedCash: {
      type: Number,
      default: 0,
      min: 0,
      set: cleanMoney,
    },

    differenceAmount: {
      type: Number,
      default: 0,
      set: cleanSignedMoney,
    },

    salesSummary: {
      type: SalesSummarySchema,
      default: () => ({}),
    },

    cashMovements: {
      type: [CashMovementSchema],
      default: [],
    },

    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
    },

    openedBySnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({ username: '', displayName: '', role: '', adminRole: '' }),
    },

    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
    },

    closedBySnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({ username: '', displayName: '', role: '', adminRole: '' }),
    },

    openingNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    closingNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    cancelledReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

CashSessionSchema.index(
  { branch: 1, cashRegisterCode: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'open' },
  }
);
CashSessionSchema.index({ branch: 1, openedAt: -1 });
CashSessionSchema.index({ cashier: 1, openedAt: -1 });
CashSessionSchema.index({ status: 1, openedAt: -1 });

CashSessionSchema.virtual('isOpen').get(function isOpen() {
  return this.status === 'open';
});

CashSessionSchema.virtual('isClosed').get(function isClosed() {
  return this.status === 'closed';
});

CashSessionSchema.virtual('cashSales').get(function cashSales() {
  return Number(this.salesSummary?.paymentTotals?.cash || 0);
});

CashSessionSchema.pre('validate', function beforeValidate(next) {
  try {
    this.sessionCode = cleanUpper(this.sessionCode || buildSessionCode());
    this.status = cleanLower(this.status || 'open');
    this.cashRegisterCode = cleanUpper(this.cashRegisterCode || 'CAJA PRINCIPAL');
    this.cashRegisterName = cleanText(this.cashRegisterName || 'Caja principal');
    this.openingNotes = cleanText(this.openingNotes);
    this.closingNotes = cleanText(this.closingNotes);
    this.cancelledReason = cleanText(this.cancelledReason);

    if (this.branchSnapshot) {
      this.branchSnapshot.name = cleanText(this.branchSnapshot.name);
      this.branchSnapshot.code = cleanUpper(this.branchSnapshot.code);
      this.branchSnapshot.type = cleanLower(this.branchSnapshot.type);
    }

    const paymentTotals = this.salesSummary?.paymentTotals || {};
    const paymentTotal =
      cleanMoney(paymentTotals.cash) +
      cleanMoney(paymentTotals.transfer) +
      cleanMoney(paymentTotals.card) +
      cleanMoney(paymentTotals.mixed) +
      cleanMoney(paymentTotals.other);

    if (this.salesSummary?.paymentTotals) {
      this.salesSummary.paymentTotals.total = paymentTotal;
    }

    const cashMovementsIn = this.cashMovements
      .filter((movement) => movement.direction === 'in')
      .reduce((total, movement) => total + cleanMoney(movement.amount), 0);

    const cashMovementsOut = this.cashMovements
      .filter((movement) => movement.direction === 'out')
      .reduce((total, movement) => total + cleanMoney(movement.amount), 0);

    this.expectedCash = Math.max(
      0,
      cleanMoney(this.openingAmount) + cleanMoney(paymentTotals.cash) + cashMovementsIn - cashMovementsOut
    );

    if (this.status === 'closed') {
      if (!this.closedAt) this.closedAt = new Date();
      this.differenceAmount = cleanMoney(this.countedCash) - cleanMoney(this.expectedCash);
    }

    if (this.status === 'cancelled' && !this.cancelledAt) {
      this.cancelledAt = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

CashSessionSchema.methods.closeSession = function closeSession({
  countedCash,
  closedBy = null,
  closedBySnapshot = {},
  closingNotes = '',
} = {}) {
  if (this.status !== 'open') {
    throw new Error('Solo se puede cerrar una caja abierta.');
  }

  this.status = 'closed';
  this.countedCash = cleanMoney(countedCash);
  this.closedBy = closedBy;
  this.closedBySnapshot = closedBySnapshot;
  this.closingNotes = cleanText(closingNotes);
  this.closedAt = new Date();

  return this;
};

CashSessionSchema.methods.cancelSession = function cancelSession({
  cancelledBy = null,
  cancelledReason = '',
} = {}) {
  if (this.status !== 'open') {
    throw new Error('Solo se puede anular una caja abierta.');
  }

  this.status = 'cancelled';
  this.cancelledBy = cancelledBy;
  this.cancelledReason = cleanText(cancelledReason);
  this.cancelledAt = new Date();

  return this;
};

CashSessionSchema.methods.addCashMovement = function addCashMovement(movement = {}) {
  if (this.status !== 'open') {
    throw new Error('Solo se pueden registrar movimientos en una caja abierta.');
  }

  this.cashMovements.push({
    type: cleanLower(movement.type || 'adjustment'),
    amount: cleanMoney(movement.amount),
    direction: cleanLower(movement.direction || 'neutral'),
    reason: cleanText(movement.reason || ''),
    reference: cleanText(movement.reference || ''),
    createdBy: movement.createdBy || null,
    createdBySnapshot: movement.createdBySnapshot || {},
  });

  return this;
};

CashSessionSchema.methods.toSafeObject = function toSafeObject() {
  const session = this.toObject({ virtuals: true });
  delete session.__v;
  return session;
};

CashSessionSchema.statics.getStatuses = function getStatuses() {
  return [...CASH_SESSION_STATUSES];
};

CashSessionSchema.statics.getMovementTypes = function getMovementTypes() {
  return [...CASH_MOVEMENT_TYPES];
};

CashSessionSchema.statics.buildSessionCode = buildSessionCode;

CashSessionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

CashSessionSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
});

module.exports = mongoose.models.CashSession || mongoose.model('CashSession', CashSessionSchema);
