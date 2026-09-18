'use strict';

const mongoose = require('mongoose');

const AdminTwoFactorChallengeSchema = new mongoose.Schema(
  {
    challengeId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      select: false,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
      max: 10,
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
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
      index: true,
    },
    consumeReason: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
  },
  { timestamps: true, versionKey: false }
);

AdminTwoFactorChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AdminTwoFactorChallengeSchema.index({ adminUser: 1, consumedAt: 1, expiresAt: 1 });

module.exports =
  mongoose.models.AdminTwoFactorChallenge ||
  mongoose.model('AdminTwoFactorChallenge', AdminTwoFactorChallengeSchema);
