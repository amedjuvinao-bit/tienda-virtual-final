'use strict';

const mongoose = require('mongoose');

const SHIPPING_SETTINGS_KEY = 'main';

const ShippingSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: SHIPPING_SETTINGS_KEY,
      immutable: true,
    },
    managedFromPanel: { type: Boolean, default: false },
    defaultProvider: {
      type: String,
      enum: ['manual', 'envia'],
      default: 'manual',
    },
    enviaMode: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox',
    },
    internationalDutiesPaymentEntity: {
      type: String,
      enum: ['recipient', 'sender', 'envia_guaranteed'],
      default: 'recipient',
    },
    enviaTokenEncrypted: {
      type: String,
      default: '',
      select: false,
    },
    enviaTokenHint: { type: String, trim: true, default: '' },
    hasEnviaToken: { type: Boolean, default: false },
    webhookSecretEncrypted: {
      type: String,
      default: '',
      select: false,
    },
    webhookSecretHint: { type: String, trim: true, default: '' },
    hasWebhookSecret: { type: Boolean, default: false },
    credentialRevision: { type: Number, min: 0, default: 0 },
    lastTestStatus: {
      type: String,
      enum: ['none', 'success', 'error'],
      default: 'none',
    },
    lastTestMessage: { type: String, trim: true, maxlength: 500, default: '' },
    lastTestAt: { type: Date, default: null },
    lastTestMode: {
      type: String,
      enum: ['', 'sandbox', 'production'],
      default: '',
    },
    lastTestCredentialRevision: { type: Number, min: 0, default: 0 },
    providerWebhookId: { type: String, trim: true, default: '' },
    providerWebhookMode: {
      type: String,
      enum: ['', 'sandbox', 'production'],
      default: '',
    },
    providerWebhookUrl: { type: String, trim: true, default: '' },
    webhookRegisteredAt: { type: Date, default: null },
    productionActivatedAt: { type: Date, default: null },
    productionActivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
  },
  { timestamps: true }
);

ShippingSettingsSchema.pre('validate', function (next) {
  this.key = SHIPPING_SETTINGS_KEY;
  this.hasEnviaToken = Boolean(this.enviaTokenEncrypted);
  this.hasWebhookSecret = Boolean(this.webhookSecretEncrypted);
  next();
});

ShippingSettingsSchema.methods.toSafeObject = function toSafeObject() {
  const settings = this.toObject();
  settings.hasEnviaToken = Boolean(
    settings.enviaTokenEncrypted || settings.hasEnviaToken
  );
  settings.hasWebhookSecret = Boolean(
    settings.webhookSecretEncrypted || settings.hasWebhookSecret
  );
  delete settings.enviaTokenEncrypted;
  delete settings.webhookSecretEncrypted;
  delete settings.__v;
  return settings;
};

ShippingSettingsSchema.statics.getSingleton = async function getSingleton() {
  let settings = await this.findOne({ key: SHIPPING_SETTINGS_KEY }).select(
    '+enviaTokenEncrypted +webhookSecretEncrypted'
  );
  if (!settings) {
    settings = await this.create({ key: SHIPPING_SETTINGS_KEY });
  }
  return settings;
};

module.exports =
  mongoose.models.ShippingSettings ||
  mongoose.model('ShippingSettings', ShippingSettingsSchema);
