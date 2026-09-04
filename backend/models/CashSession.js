// backend/models/CashSession.js

const mongoose = require('mongoose');
const {
  CASH_SESSION_INDEX_DEFINITIONS,
} = require('./cashSessionIndexDefinitions');

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
const CASH_MOVEMENT_APPROVAL_STATUSES = [
  'not_required',
  'pending',
  'approved',
  'rejected',
];
const CASH_CLOSING_REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

function isAppliedCashMovement(movement = {}) {
  return !['pending', 'rejected'].includes(cleanLower(movement.approvalStatus));
}

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
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => dateParts.find((entry) => entry.type === type)?.value || '';
  const y = part('year');
  const m = part('month');
  const d = part('day');
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
    approvalRequired: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: CASH_MOVEMENT_APPROVAL_STATUSES,
      default: 'not_required',
      trim: true,
      lowercase: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    createdBySnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    createdAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    reviewedBySnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: true }
);

const CashDenominationSchema = new mongoose.Schema(
  {
    value: { type: Number, required: true, min: 1, set: cleanMoney },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: { validator: Number.isInteger, message: 'La cantidad debe ser un entero.' },
    },
    subtotal: { type: Number, required: true, min: 0, default: 0, set: cleanMoney },
  },
  { _id: false }
);

const CashCountSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['manual', 'denominations'], default: 'manual' },
    denominations: { type: [CashDenominationSchema], default: [] },
    total: { type: Number, min: 0, default: 0, set: cleanMoney },
  },
  { _id: false }
);

const CashClosingReviewSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: CASH_CLOSING_REVIEW_STATUSES,
      required: true,
      default: 'pending',
    },
    countedCash: { type: Number, min: 0, required: true, set: cleanMoney },
    expectedCash: { type: Number, min: 0, required: true, set: cleanMoney },
    differenceAmount: { type: Number, required: true, set: cleanSignedMoney },
    toleranceAmount: { type: Number, min: 0, required: true, set: cleanMoney },
    cashCount: { type: CashCountSchema, default: () => ({}) },
    closingNotes: { type: String, trim: true, maxlength: 1000, default: '' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    requestedBySnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    requestedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    reviewedBySnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: true }
);

const CashReconciliationCheckSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, lowercase: true, required: true },
    label: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['ok', 'attention', 'critical'], default: 'ok' },
    expected: { type: Number, default: 0, set: cleanSignedMoney },
    actual: { type: Number, default: 0, set: cleanSignedMoney },
    difference: { type: Number, default: 0, set: cleanSignedMoney },
    message: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false }
);

const CashReconciliationSchema = new mongoose.Schema(
  {
    version: { type: String, trim: true, default: 'cash-reconciliation-v1' },
    status: {
      type: String,
      enum: ['in_progress', 'balanced', 'attention', 'critical'],
      default: 'in_progress',
    },
    generatedAt: { type: Date, default: null },
    serverAuthoritative: { type: Boolean, default: true },
    final: { type: Boolean, default: false },
    openingAmount: { type: Number, default: 0, min: 0, set: cleanMoney },
    cashSales: { type: Number, default: 0, min: 0, set: cleanMoney },
    cashIn: { type: Number, default: 0, min: 0, set: cleanMoney },
    cashOut: { type: Number, default: 0, min: 0, set: cleanMoney },
    calculatedExpectedCash: { type: Number, default: 0, min: 0, set: cleanMoney },
    storedExpectedCash: { type: Number, default: 0, min: 0, set: cleanMoney },
    countedCash: { type: Number, default: 0, min: 0, set: cleanMoney },
    differenceAmount: { type: Number, default: 0, set: cleanSignedMoney },
    netSales: { type: Number, default: 0, min: 0, set: cleanMoney },
    paymentTotal: { type: Number, default: 0, min: 0, set: cleanMoney },
    ordersCount: { type: Number, default: 0, min: 0 },
    pendingMovements: { type: Number, default: 0, min: 0 },
    pendingClosingReviews: { type: Number, default: 0, min: 0 },
    checks: { type: [CashReconciliationCheckSchema], default: [] },
  },
  { _id: false }
);

const CashSessionSchema = new mongoose.Schema(
  {
    sessionCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: buildSessionCode,
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

    cashCount: {
      type: CashCountSchema,
      default: () => ({ mode: 'manual', denominations: [], total: 0 }),
    },

    closingReviews: {
      type: [CashClosingReviewSchema],
      default: [],
    },

    salesSummary: {
      type: SalesSummarySchema,
      default: () => ({}),
    },

    reconciliation: {
      type: CashReconciliationSchema,
      default: null,
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

for (const definition of CASH_SESSION_INDEX_DEFINITIONS) {
  CashSessionSchema.index(
    { ...definition.key },
    {
      ...definition.options,
      ...(definition.options.partialFilterExpression
        ? { partialFilterExpression: { ...definition.options.partialFilterExpression } }
        : {}),
    }
  );
}

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

    const appliedMovements = this.cashMovements.filter(isAppliedCashMovement);

    const cashMovementsIn = appliedMovements
      .filter((movement) => movement.direction === 'in')
      .reduce((total, movement) => total + cleanMoney(movement.amount), 0);

    const cashMovementsOut = appliedMovements
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
  cashCount = null,
  closedBy = null,
  closedBySnapshot = {},
  closingNotes = '',
} = {}) {
  if (this.status !== 'open') {
    throw new Error('Solo se puede cerrar una caja abierta.');
  }

  this.status = 'closed';
  this.countedCash = cleanMoney(countedCash);
  this.cashCount = cashCount || {
    mode: 'manual',
    denominations: [],
    total: cleanMoney(countedCash),
  };
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
    approvalRequired: movement.approvalRequired === true,
    approvalStatus: cleanLower(movement.approvalStatus || 'not_required'),
    createdBy: movement.createdBy || null,
    createdBySnapshot: movement.createdBySnapshot || {},
    reviewedBy: movement.reviewedBy || null,
    reviewedBySnapshot: movement.reviewedBySnapshot || {},
    reviewedAt: movement.reviewedAt || null,
    reviewNotes: cleanText(movement.reviewNotes || ''),
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

CashSessionSchema.statics.getMovementApprovalStatuses = function getMovementApprovalStatuses() {
  return [...CASH_MOVEMENT_APPROVAL_STATUSES];
};

CashSessionSchema.statics.getClosingReviewStatuses = function getClosingReviewStatuses() {
  return [...CASH_CLOSING_REVIEW_STATUSES];
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

const CashSession = mongoose.models.CashSession || mongoose.model('CashSession', CashSessionSchema);

CashSession.isAppliedCashMovement = isAppliedCashMovement;

module.exports = CashSession;
