"use strict";
const mongoose = require("mongoose");
const ConsumerCaseSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    accessHash: { type: String, required: true, unique: true, select: false },
    requestHash: { type: String, required: true, select: false },
    trackingHash: { type: String, select: false },
    recoveryEmail: { type: String, maxlength: 180, select: false },
    recovery: { type: mongoose.Schema.Types.Mixed, select: false },
    receiptEmail: { type: mongoose.Schema.Types.Mixed, select: false },
    accessRecovery: { type: mongoose.Schema.Types.Mixed, select: false },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    orderLink: { type: mongoose.Schema.Types.Mixed },
    name: { type: String, required: true, maxlength: 180 },
    contact: { type: String, required: true, maxlength: 180 },
    type: { type: String, required: true },
    orderNumber: { type: String, default: "", maxlength: 80 },
    subject: { type: String, required: true, maxlength: 180 },
    message: { type: String, required: true, maxlength: 6000 },
    preferredRefundMethod: { type: String, default: "", maxlength: 300 },
    status: {
      type: String,
      enum: ["received", "in_review", "answered", "closed"],
      default: "received",
    },
    revision: { type: Number, default: 0 },
    authorization: { type: mongoose.Schema.Types.Mixed, required: true },
    history: {
      type: [{ at: Date, status: String, message: String, admin: String }],
      default: [],
    },
  },
  { timestamps: true },
);
ConsumerCaseSchema.index({ status: 1, createdAt: 1 });
ConsumerCaseSchema.index({ order: 1, _id: -1 });
ConsumerCaseSchema.index({ orderNumber: 1, order: 1, _id: -1 });
module.exports =
  mongoose.models.ConsumerCase ||
  mongoose.model("ConsumerCase", ConsumerCaseSchema);
