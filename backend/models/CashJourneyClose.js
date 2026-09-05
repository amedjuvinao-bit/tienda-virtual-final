'use strict';

const mongoose = require('mongoose');
const { CASH_JOURNEY_CLOSE_INDEX_DEFINITIONS } = require('./cashJourneyCloseIndexDefinitions');

const AdminSnapshotSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, lowercase: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, lowercase: true, default: '' },
    adminRole: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const CashJourneyCloseSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    businessDate: { type: String, required: true, trim: true },
    timezone: { type: String, default: 'America/Bogota', immutable: true },
    periodStart: { type: Date, required: true, immutable: true },
    periodEnd: { type: Date, required: true, immutable: true },
    status: { type: String, enum: ['certified'], default: 'certified', immutable: true },
    summaryVersion: { type: String, default: 'cash-journey-summary-v1', immutable: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
    contentDigest: { type: String, required: true, trim: true, immutable: true },
    notes: { type: String, trim: true, maxlength: 1000, default: '', immutable: true },
    certifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null, immutable: true },
    certifiedBySnapshot: { type: AdminSnapshotSchema, default: () => ({}), immutable: true },
    certifiedAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { timestamps: true }
);

for (const definition of CASH_JOURNEY_CLOSE_INDEX_DEFINITIONS) {
  CashJourneyCloseSchema.index({ ...definition.key }, { ...definition.options });
}

CashJourneyCloseSchema.set('toJSON', { versionKey: false });
CashJourneyCloseSchema.set('toObject', { versionKey: false });

module.exports = mongoose.models.CashJourneyClose || mongoose.model('CashJourneyClose', CashJourneyCloseSchema);
