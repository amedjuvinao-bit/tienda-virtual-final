'use strict';

const mongoose = require('mongoose');
const {
  FINANCE_PERIOD_CLOSE_INDEX_DEFINITIONS,
} = require('./financePeriodCloseIndexDefinitions');

const CLOSE_STATUSES = ['provisional', 'certified'];

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 100) {
  return cleanText(value, max).toLowerCase();
}

const AdminSnapshotSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, lowercase: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, lowercase: true, default: '' },
    adminRole: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const BranchSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, uppercase: true, default: '' },
    type: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const CertificationSchema = new mongoose.Schema(
  {
    requestKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 16,
      maxlength: 128,
    },
    revision: { type: Number, min: 0, required: true },
    status: { type: String, enum: CLOSE_STATUSES, required: true },
    snapshotHash: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 64,
      maxlength: 64,
    },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    overrideUsed: { type: Boolean, default: false },
    overrideReason: { type: String, trim: true, default: '', maxlength: 1000 },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    actorSnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    at: { type: Date, default: Date.now, required: true },
  },
  { _id: true }
);

const FinancePeriodCloseSchema = new mongoose.Schema(
  {
    closeKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    periodKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    branchSnapshot: { type: BranchSnapshotSchema, required: true },
    status: { type: String, enum: CLOSE_STATUSES, required: true },
    revision: { type: Number, min: 0, default: 0 },
    snapshotHash: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 64,
      maxlength: 64,
    },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    certifiedAt: { type: Date, required: true, default: Date.now },
    certifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    certifiedBySnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    certifications: {
      type: [CertificationSchema],
      default: [],
      validate: [
        (events) => Array.isArray(events) && events.length <= 60,
        'Máximo 60 certificaciones por periodo y sede.',
      ],
    },
  },
  { timestamps: true }
);

FINANCE_PERIOD_CLOSE_INDEX_DEFINITIONS.forEach(({ key, options }) => {
  FinancePeriodCloseSchema.index({ ...key }, { ...options });
});

FinancePeriodCloseSchema.pre('validate', function normalizePeriodClose(next) {
  try {
    this.closeKey = cleanLower(this.closeKey, 120);
    this.periodKey = cleanText(this.periodKey, 7);
    this.status = CLOSE_STATUSES.includes(cleanLower(this.status, 20))
      ? cleanLower(this.status, 20)
      : 'provisional';
    this.revision = Math.max(0, Math.floor(Number(this.revision || 0)));
    this.snapshotHash = cleanLower(this.snapshotHash, 64);
    next();
  } catch (error) {
    next(error);
  }
});

FinancePeriodCloseSchema.methods.toSafeObject = function toSafeObject() {
  const value = this.toObject({ virtuals: true });
  delete value.__v;
  return value;
};

module.exports =
  mongoose.models.FinancePeriodClose ||
  mongoose.model('FinancePeriodClose', FinancePeriodCloseSchema);
