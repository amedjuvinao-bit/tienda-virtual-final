"use strict";
const mongoose = require("mongoose");
const proofSchema = require("./newsletterConsentProof");

// Durable evidence is separate from the bounded recent history on the contact.
const schema = new mongoose.Schema(
  {
    subscriber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscriber",
      required: true,
    },
    proof: { type: proofSchema, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
schema.index({ subscriber: 1, createdAt: -1, _id: -1 });
module.exports =
  mongoose.models.NewsletterConsentEvent ||
  mongoose.model("NewsletterConsentEvent", schema);
