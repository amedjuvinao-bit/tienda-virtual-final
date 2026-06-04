// backend/models/AdminAuditLog.js

const mongoose = require('mongoose');

const { Schema } = mongoose;

const AdminAuditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    permission: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    module: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    method: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    path: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    routePattern: {
      type: String,
      trim: true,
      default: '',
    },

    resourceId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    adminUserId: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
    },

    adminUsername: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    adminRole: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      index: true,
    },

    statusCode: {
      type: Number,
      default: null,
      index: true,
    },

    success: {
      type: Boolean,
      default: null,
      index: true,
    },

    ip: {
      type: String,
      trim: true,
      default: '',
    },

    userAgent: {
      type: String,
      trim: true,
      default: '',
    },

    requestId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    query: {
      type: Schema.Types.Mixed,
      default: {},
    },

    params: {
      type: Schema.Types.Mixed,
      default: {},
    },

    bodySnapshot: {
      type: Schema.Types.Mixed,
      default: {},
    },

    responseSnapshot: {
      type: Schema.Types.Mixed,
      default: {},
    },

    errorMessage: {
      type: String,
      trim: true,
      default: '',
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ adminUserId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ permission: 1, createdAt: -1 });
AdminAuditLogSchema.index({ module: 1, createdAt: -1 });
AdminAuditLogSchema.index({ success: 1, createdAt: -1 });

module.exports =
  mongoose.models.AdminAuditLog ||
  mongoose.model('AdminAuditLog', AdminAuditLogSchema);