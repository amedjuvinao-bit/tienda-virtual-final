'use strict';

const mongoose = require('mongoose');

const BackupPreferenceSchema = new mongoose.Schema({
  _id: { type: String, default: 'primary' },
  strategy: {
    type: String,
    enum: ['free_manual', 'atlas_managed'],
    required: true,
  },
  revision: { type: Number, required: true, min: 1 },
  updatedBy: { type: String, required: true },
}, { timestamps: true, collection: 'backup_preferences' });

module.exports = mongoose.models.BackupPreference ||
  mongoose.model('BackupPreference', BackupPreferenceSchema);
