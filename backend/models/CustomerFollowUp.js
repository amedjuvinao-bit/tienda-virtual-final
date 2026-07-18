// backend/models/CustomerFollowUp.js

const mongoose = require('mongoose');

const FOLLOW_UP_TYPES = [
  'note',
  'whatsapp',
  'call',
  'payment',
  'size_request',
  'reminder',
  'complaint',
  'task',
  'other',
];

const FOLLOW_UP_STATUSES = ['pending', 'done', 'cancelled'];

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

const CustomerFollowUpSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: FOLLOW_UP_TYPES,
      default: 'note',
      set: cleanLower,
      index: true,
    },
    status: {
      type: String,
      enum: FOLLOW_UP_STATUSES,
      default: 'pending',
      set: cleanLower,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      required: true,
      set: cleanText,
    },
    nextAction: {
      type: String,
      trim: true,
      default: '',
      set: cleanText,
    },
    dueAt: {
      type: Date,
      default: null,
      index: true,
    },
    doneAt: {
      type: Date,
      default: null,
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
    },
    updatedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

CustomerFollowUpSchema.index({ customer: 1, status: 1, createdAt: -1 });
CustomerFollowUpSchema.index({ customer: 1, deletedAt: 1, createdAt: -1 });

CustomerFollowUpSchema.pre('validate', function preValidateFollowUp(next) {
  this.type = cleanLower(this.type || 'note');
  this.status = cleanLower(this.status || 'pending');
  this.note = cleanText(this.note);
  this.nextAction = cleanText(this.nextAction);

  if (!this.note) {
    this.invalidate('note', 'La nota de seguimiento es obligatoria.');
  }

  if (this.status === 'done' && !this.doneAt) {
    this.doneAt = new Date();
  }

  if (this.status !== 'done') {
    this.doneAt = null;
  }

  next();
});

CustomerFollowUpSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject({ virtuals: true });
  obj.id = String(this._id);
  obj.customerId = String(this.customer || '');
  return obj;
};

module.exports = mongoose.models.CustomerFollowUp || mongoose.model('CustomerFollowUp', CustomerFollowUpSchema);
