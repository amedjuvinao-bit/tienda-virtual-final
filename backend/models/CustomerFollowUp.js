// backend/models/CustomerFollowUp.js

const mongoose = require('mongoose');

const {
  CUSTOMER_FOLLOW_UP_INDEX_DEFINITIONS,
  cloneDefinitions,
} = require('./customerIndexDefinitions');

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
const FOLLOW_UP_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const FOLLOW_UP_PRIORITY_RANK = Object.freeze({
  low: 10,
  normal: 20,
  high: 30,
  urgent: 40,
});

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
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    type: {
      type: String,
      enum: FOLLOW_UP_TYPES,
      default: 'note',
      set: cleanLower,
    },
    status: {
      type: String,
      enum: FOLLOW_UP_STATUSES,
      default: 'pending',
      set: cleanLower,
    },
    priority: {
      type: String,
      enum: FOLLOW_UP_PRIORITIES,
      default: 'normal',
      set: cleanLower,
    },
    priorityRank: {
      type: Number,
      enum: Object.values(FOLLOW_UP_PRIORITY_RANK),
      default: FOLLOW_UP_PRIORITY_RANK.normal,
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
    },
    doneAt: {
      type: Date,
      default: null,
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    updatedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    assignedToAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

cloneDefinitions(CUSTOMER_FOLLOW_UP_INDEX_DEFINITIONS).forEach(({ key, options }) => {
  CustomerFollowUpSchema.index(key, options);
});

CustomerFollowUpSchema.pre('validate', function preValidateFollowUp(next) {
  this.type = cleanLower(this.type || 'note');
  this.status = cleanLower(this.status || 'pending');
  this.priority = FOLLOW_UP_PRIORITIES.includes(cleanLower(this.priority))
    ? cleanLower(this.priority)
    : 'normal';
  this.priorityRank = FOLLOW_UP_PRIORITY_RANK[this.priority];
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
module.exports.FOLLOW_UP_PRIORITIES = FOLLOW_UP_PRIORITIES;
module.exports.FOLLOW_UP_PRIORITY_RANK = FOLLOW_UP_PRIORITY_RANK;
