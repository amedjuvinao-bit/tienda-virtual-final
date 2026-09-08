'use strict';

const mongoose = require('mongoose');

const COST_CENTER_STATUSES = ['active', 'inactive'];
const COST_CENTER_ACTIONS = ['created', 'updated', 'activated', 'deactivated'];

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanCode(value) {
  return cleanText(value, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

function cleanLower(value, max = 80) {
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

const CostCenterHistorySchema = new mongoose.Schema(
  {
    action: { type: String, enum: COST_CENTER_ACTIONS, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    actorSnapshot: { type: AdminSnapshotSchema, default: () => ({}) },
    at: { type: Date, default: Date.now, required: true },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
    revision: { type: Number, min: 0, default: 0 },
  },
  { _id: true }
);

const FinanceCostCenterSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
      set: cleanCode,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    status: {
      type: String,
      enum: COST_CENTER_STATUSES,
      default: 'active',
    },
    revision: {
      type: Number,
      min: 0,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    createdBySnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({}),
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    updatedBySnapshot: {
      type: AdminSnapshotSchema,
      default: () => ({}),
    },
    history: {
      type: [CostCenterHistorySchema],
      default: [],
      validate: [
        (events) => Array.isArray(events) && events.length <= 100,
        'Máximo 100 eventos por centro de costo.',
      ],
    },
  },
  { timestamps: true }
);

FinanceCostCenterSchema.index(
  { code: 1 },
  { unique: true, name: 'code_1_unique' }
);
FinanceCostCenterSchema.index(
  { status: 1, name: 1 },
  { name: 'status_1_name_1' }
);

FinanceCostCenterSchema.pre('validate', function normalizeCostCenter(next) {
  try {
    this.code = cleanCode(this.code);
    this.name = cleanText(this.name, 120);
    this.description = cleanText(this.description, 500);
    this.status = COST_CENTER_STATUSES.includes(cleanLower(this.status))
      ? cleanLower(this.status)
      : 'active';
    this.revision = Math.max(0, Math.floor(Number(this.revision || 0)));

    if (!this.code || this.code.length < 2) {
      this.invalidate('code', 'El código debe tener al menos 2 caracteres.');
    }
    if (!this.name) {
      this.invalidate('name', 'El nombre del centro de costo es obligatorio.');
    }
    next();
  } catch (error) {
    next(error);
  }
});

FinanceCostCenterSchema.methods.toSafeObject = function toSafeObject() {
  const value = this.toObject({ virtuals: true });
  delete value.__v;
  return value;
};

FinanceCostCenterSchema.statics.getStatuses = function getStatuses() {
  return [...COST_CENTER_STATUSES];
};

module.exports =
  mongoose.models.FinanceCostCenter ||
  mongoose.model('FinanceCostCenter', FinanceCostCenterSchema);
