"use strict";
const mongoose = require("mongoose");
const proofSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["unknown", "granted", "withdrawn"],
      default: "unknown",
    },
    channel: { type: String, enum: ["email"], default: "email" },
    source: { type: String, maxlength: 40 },
    method: { type: String, maxlength: 40 },
    proofReference: { type: String, maxlength: 240 },
    version: { type: String, maxlength: 80 },
    privacyVersion: { type: String, maxlength: 80 },
    text: { type: String, maxlength: 2000 },
    privacyText: { type: String, maxlength: 12000 },
    seller: {
      legalName: String,
      nit: String,
      notificationAddress: String,
      email: String,
      phone: String,
    },
    requestedAt: Date,
    confirmedAt: Date,
    recordedAt: Date,
    recordedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },
  },
  { _id: false },
);
module.exports = proofSchema;
