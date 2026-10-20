'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true, immutable: true },
  revision: { type: Number, default: 0 },
  clientKey: { type: String, default: '' },
  clientSecretEncrypted: { type: String, default: '', select: false },
  tokenEncrypted: { type: String, default: '', select: false },
  refreshTokenEncrypted: { type: String, default: '', select: false },
  refreshExpiresAt: Date,
  scopes: { type: String, default: '' },
  redirectUri: { type: String, default: '' },
  enabled: { type: Boolean, default: false },
  account: { type: mongoose.Schema.Types.Mixed, default: null },
  connectionId: { type: String, default: '' },
  expiresAt: Date,
  tokenUpdatedAt: Date,
  syncedAt: Date,
  retryAt: Date,
  lastError: { type: String, default: '' },
  oauthHash: { type: String, select: false },
  oauthExpiresAt: Date,
}, { timestamps: true, optimisticConcurrency: true });
schema.statics.getSingleton = async function () {
  await this.updateOne({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true });
  return this.findOne({ key: 'main' }).select('+clientSecretEncrypted +tokenEncrypted +refreshTokenEncrypted +oauthHash');
};
module.exports = mongoose.model('TiktokSettings', schema);
