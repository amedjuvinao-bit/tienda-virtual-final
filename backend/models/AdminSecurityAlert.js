'use strict';

const mongoose = require('mongoose');

const AdminSecurityAlertSchema = new mongoose.Schema(
  {
    fingerprint: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      maxlength: 240,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'login_failure',
        'login_blocked',
        'new_device',
        'ip_changed',
        'refresh_token_reuse',
        'two_factor_changed',
      ],
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['open', 'reviewed', 'resolved'],
      default: 'open',
      index: true,
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
      index: true,
    },
    adminSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminSession',
      default: null,
      index: true,
    },
    sourceId: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    detail: {
      type: String,
      required: true,
      trim: true,
      maxlength: 800,
    },
    ip: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    occurrenceCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    firstOccurredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastOccurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    resolutionAction: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    resolutionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    notificationStatus: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'skipped', 'failed'],
      default: 'pending',
      index: true,
    },
    notificationAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    notificationRecipients: {
      type: [String],
      default: [],
    },
    notificationAttemptedAt: {
      type: Date,
      default: null,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
    notificationError: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

AdminSecurityAlertSchema.index({ status: 1, severity: 1, lastOccurredAt: -1 });
AdminSecurityAlertSchema.index({ adminUser: 1, status: 1, lastOccurredAt: -1 });
AdminSecurityAlertSchema.index({ username: 1, status: 1, lastOccurredAt: -1 });

module.exports =
  mongoose.models.AdminSecurityAlert ||
  mongoose.model('AdminSecurityAlert', AdminSecurityAlertSchema);
