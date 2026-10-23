'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  connection: { type: String, required: true },
  cursorHash: { type: String, required: true },
  posts: { type: [mongoose.Schema.Types.Mixed], default: [] },
  after: { type: String, default: '' },
  fetchedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});
schema.index({ connection: 1, cursorHash: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('InstagramFeedPage', schema);
