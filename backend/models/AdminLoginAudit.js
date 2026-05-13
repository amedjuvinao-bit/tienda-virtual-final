// backend/models/AdminLoginAudit.js
const mongoose = require('mongoose');

const AdminLoginAuditSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      trim: true,
      default: '',
    },

    ip: {
      type: String,
      trim: true,
      default: '',
    },

    status: {
      type: String,
      enum: ['success', 'failed', 'blocked', 'error'],
      required: true,
    },

    reason: {
      type: String,
      trim: true,
      default: '',
    },

    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

AdminLoginAuditSchema.index({ createdAt: -1 });
AdminLoginAuditSchema.index({ username: 1, createdAt: -1 });
AdminLoginAuditSchema.index({ ip: 1, createdAt: -1 });
AdminLoginAuditSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('AdminLoginAudit', AdminLoginAuditSchema);