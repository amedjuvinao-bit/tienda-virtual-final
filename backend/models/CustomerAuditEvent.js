'use strict';

const mongoose = require('mongoose');
const {
  CUSTOMER_AUDIT_INDEX_DEFINITIONS,
  cloneDefinitions,
} = require('./customerIndexDefinitions');

const AUDIT_EVENT_TYPES = Object.freeze([
  'viewed',
  'created',
  'updated',
  'follow_up_created',
  'follow_up_updated',
  'follow_up_deleted',
  'consent_changed',
  'exported',
  'anonymized',
  'retention_reviewed',
]);

const AuditChangeSchema = new mongoose.Schema(
  {
    path: { type: String, trim: true, required: true, maxlength: 160 },
    beforeHash: { type: String, trim: true, default: '', maxlength: 64 },
    afterHash: { type: String, trim: true, default: '', maxlength: 64 },
    beforePreview: { type: String, trim: true, default: '', maxlength: 240 },
    afterPreview: { type: String, trim: true, default: '', maxlength: 240 },
  },
  { _id: false }
);

const CustomerAuditEventSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    customerCode: { type: String, trim: true, uppercase: true, default: '' },
    eventType: { type: String, enum: AUDIT_EVENT_TYPES, required: true },
    action: { type: String, trim: true, required: true, maxlength: 180 },
    actorAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    actorUsername: { type: String, trim: true, default: '', maxlength: 120 },
    actorRole: { type: String, trim: true, lowercase: true, default: '', maxlength: 80 },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    requestId: { type: String, trim: true, default: '', maxlength: 160 },
    ipHash: { type: String, trim: true, default: '', maxlength: 64 },
    changes: { type: [AuditChangeSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    previousHash: { type: String, trim: true, default: '', maxlength: 64 },
    eventHash: { type: String, trim: true, required: true, maxlength: 64 },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

cloneDefinitions(CUSTOMER_AUDIT_INDEX_DEFINITIONS).forEach(({ key, options }) => {
  CustomerAuditEventSchema.index(key, options);
});

function rejectMutation(next) {
  const error = new Error('Los eventos de auditoría de Clientes son inmutables.');
  error.code = 'CUSTOMER_AUDIT_IMMUTABLE';
  next(error);
}

[
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
].forEach((operation) => CustomerAuditEventSchema.pre(operation, rejectMutation));

CustomerAuditEventSchema.pre('save', function preventExistingMutation(next) {
  if (this.isNew) return next();
  return rejectMutation(next);
});

CustomerAuditEventSchema.statics.getEventTypes = function getEventTypes() {
  return [...AUDIT_EVENT_TYPES];
};

module.exports =
  mongoose.models.CustomerAuditEvent ||
  mongoose.model('CustomerAuditEvent', CustomerAuditEventSchema);
