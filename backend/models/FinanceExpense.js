// backend/models/FinanceExpense.js
const mongoose = require('mongoose');

const EXPENSE_STATUSES = ['draft', 'pending', 'paid', 'rejected', 'cancelled'];
const EXPENSE_WORKFLOW_ACTIONS = [
  'submitted',
  'updated',
  'resubmitted',
  'approved',
  'rejected',
  'cancelled',
];
const EXPENSE_SOURCES = ['manual', 'cash_session', 'inventory', 'system'];
const EXPENSE_TYPES = [
  'operating',
  'inventory_purchase',
  'shipping',
  'marketing',
  'payroll',
  'rent',
  'utilities',
  'tax',
  'fee',
  'other',
];
const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'mixed', 'other', ''];

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 300) {
  return cleanText(value, max).toLowerCase();
}

function cleanMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}

function normalizeTags(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(',');
  const out = [];
  const seen = new Set();

  for (const item of raw) {
    const value = cleanLower(item, 40);
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= 12) break;
  }

  return out;
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

const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    type: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const WorkflowEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: EXPENSE_WORKFLOW_ACTIONS,
      required: true,
    },
    fromStatus: {
      type: String,
      enum: ['', ...EXPENSE_STATUSES],
      default: '',
    },
    toStatus: {
      type: String,
      enum: EXPENSE_STATUSES,
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    actorSnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({ username: '', displayName: '', role: '', adminRole: '' }),
    },
    at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    revision: {
      type: Number,
      min: 0,
      default: 0,
    },
    selfApprovalOverride: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const FinanceExpenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
      set: cleanMoney,
    },

    type: {
      type: String,
      enum: EXPENSE_TYPES,
      default: 'operating',
      index: true,
    },

    category: {
      type: String,
      trim: true,
      default: 'General',
      maxlength: 120,
      index: true,
    },

    subcategory: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },

    vendor: {
      type: String,
      trim: true,
      default: '',
      maxlength: 160,
    },

    invoiceNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: 80,
    },

    reference: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: '',
      index: true,
    },

    status: {
      type: String,
      enum: EXPENSE_STATUSES,
      default: 'paid',
      index: true,
    },

    source: {
      type: String,
      enum: EXPENSE_SOURCES,
      default: 'manual',
      index: true,
    },

    requestKey: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 128,
      default: undefined,
    },

    revision: {
      type: Number,
      min: 0,
      default: 0,
    },

    submittedAt: {
      type: Date,
      default: null,
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    reviewedBySnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({ username: '', displayName: '', role: '', adminRole: '' }),
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNotes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },

    selfApprovalOverride: {
      type: Boolean,
      default: false,
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

    cancelledBySnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({ username: '', displayName: '', role: '', adminRole: '' }),
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },

    workflow: {
      type: [WorkflowEventSchema],
      default: [],
      validate: [
        (events) => Array.isArray(events) && events.length <= 80,
        'Máximo 80 eventos de flujo por gasto.',
      ],
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },

    branchSnapshot: {
      type: BranchSnapshotSchema,
      default: () => ({ name: '', code: '', type: '' }),
    },

    cashSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CashSession',
      default: null,
      index: true,
    },

    tags: {
      type: [String],
      default: [],
      set: normalizeTags,
    },

    attachments: {
      type: [AttachmentSchema],
      default: [],
      validate: [
        (arr) => Array.isArray(arr) && arr.length <= 8,
        'Máximo 8 soportes por gasto.',
      ],
    },

    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    createdBySnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({ username: '', displayName: '', role: '', adminRole: '' }),
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
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

FinanceExpenseSchema.index({ status: 1, date: -1 });
FinanceExpenseSchema.index({ type: 1, category: 1, date: -1 });
FinanceExpenseSchema.index({ branch: 1, date: -1 });
FinanceExpenseSchema.index({ source: 1, date: -1 });
FinanceExpenseSchema.index({ deletedAt: 1, date: -1 });
FinanceExpenseSchema.index({ branch: 1, status: 1, date: -1 });
FinanceExpenseSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
FinanceExpenseSchema.index(
  { requestKey: 1 },
  {
    unique: true,
    name: 'requestKey_1_unique_present',
    partialFilterExpression: { requestKey: { $exists: true } },
  }
);

FinanceExpenseSchema.pre('validate', function financeExpensePreValidate(next) {
  try {
    this.amount = cleanMoney(this.amount);
    this.type = EXPENSE_TYPES.includes(cleanLower(this.type)) ? cleanLower(this.type) : 'operating';
    this.category = cleanText(this.category || 'General', 120);
    this.subcategory = cleanText(this.subcategory, 120);
    this.description = cleanText(this.description, 500);
    this.vendor = cleanText(this.vendor, 160);
    this.invoiceNumber = cleanText(this.invoiceNumber, 80).toUpperCase();
    this.reference = cleanText(this.reference, 120);
    this.paymentMethod = PAYMENT_METHODS.includes(cleanLower(this.paymentMethod)) ? cleanLower(this.paymentMethod) : '';
    this.status = EXPENSE_STATUSES.includes(cleanLower(this.status)) ? cleanLower(this.status) : 'paid';
    this.source = EXPENSE_SOURCES.includes(cleanLower(this.source)) ? cleanLower(this.source) : 'manual';
    this.requestKey = cleanLower(this.requestKey, 128) || undefined;
    this.revision = Math.max(0, Math.floor(Number(this.revision || 0)));
    this.reviewNotes = cleanText(this.reviewNotes, 500);
    this.cancellationReason = cleanText(this.cancellationReason, 500);
    this.tags = normalizeTags(this.tags);
    this.notes = cleanText(this.notes, 1000);

    if (this.branchSnapshot) {
      this.branchSnapshot.name = cleanText(this.branchSnapshot.name, 160);
      this.branchSnapshot.code = cleanText(this.branchSnapshot.code, 40).toUpperCase();
      this.branchSnapshot.type = cleanLower(this.branchSnapshot.type, 40);
    }

    if (this.deletedAt) {
      this.status = 'cancelled';
    }

    next();
  } catch (error) {
    next(error);
  }
});

FinanceExpenseSchema.methods.toSafeObject = function toSafeObject() {
  const expense = this.toObject({ virtuals: true });
  delete expense.__v;
  return expense;
};

FinanceExpenseSchema.statics.getStatuses = function getStatuses() {
  return [...EXPENSE_STATUSES];
};

FinanceExpenseSchema.statics.getTypes = function getTypes() {
  return [...EXPENSE_TYPES];
};

module.exports = mongoose.models.FinanceExpense || mongoose.model('FinanceExpense', FinanceExpenseSchema);
