'use strict';

const mongoose = require('mongoose');

const AdminSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      select: false,
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
      index: true,
    },
    authType: {
      type: String,
      enum: ['db', 'legacy'],
      required: true,
      default: 'db',
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    tokenVersion: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    previousRefreshTokenHash: {
      type: String,
      default: '',
      select: false,
    },
    previousRefreshValidUntil: {
      type: Date,
      default: null,
      select: false,
    },
    createdIp: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    lastIp: {
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
    lastSeenAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    rotatedAt: {
      type: Date,
      default: null,
    },
    idleExpiresAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokeReason: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

AdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AdminSessionSchema.index({ adminUser: 1, revokedAt: 1, expiresAt: 1 });
AdminSessionSchema.index({ sessionId: 1, revokedAt: 1 });

module.exports =
  mongoose.models.AdminSession ||
  mongoose.model('AdminSession', AdminSessionSchema);
