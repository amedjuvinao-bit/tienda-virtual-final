// backend/models/MailSettings.js

const mongoose = require('mongoose');

const MAIL_SETTINGS_KEY = 'main';

const MAIL_PROVIDERS = [
  'gmail',
  'outlook',
  'zoho',
  'smtp',
];

const MAIL_SECURITY_TYPES = [
  'ssl',
  'starttls',
  'none',
];

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeProvider(value) {
  const provider = normalizeLower(value);

  if (MAIL_PROVIDERS.includes(provider)) {
    return provider;
  }

  return 'smtp';
}

function normalizeSecurity(value) {
  const security = normalizeLower(value);

  if (MAIL_SECURITY_TYPES.includes(security)) {
    return security;
  }

  return 'ssl';
}

const MailSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: MAIL_SETTINGS_KEY,
      immutable: true,
    },

    enabled: {
      type: Boolean,
      default: false,
    },

    provider: {
      type: String,
      enum: MAIL_PROVIDERS,
      default: 'smtp',
      set: normalizeProvider,
    },

    fromName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    fromEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'El correo remitente no tiene un formato válido.',
      ],
    },

    replyToEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'El correo de respuesta no tiene un formato válido.',
      ],
    },

    smtpHost: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
    },

    smtpPort: {
      type: Number,
      min: 1,
      max: 65535,
      default: 465,
    },

    smtpSecurity: {
      type: String,
      enum: MAIL_SECURITY_TYPES,
      default: 'ssl',
      set: normalizeSecurity,
    },

    smtpUser: {
      type: String,
      trim: true,
      maxlength: 180,
      default: '',
    },

    smtpPasswordEncrypted: {
      type: String,
      default: '',
      select: false,
    },

    hasSmtpPassword: {
      type: Boolean,
      default: false,
    },

    passwordUpdatedAt: {
      type: Date,
      default: null,
      select: false,
    },

    testEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'El correo de prueba no tiene un formato válido.',
      ],
    },

    lastTestStatus: {
      type: String,
      enum: ['none', 'success', 'error'],
      default: 'none',
    },

    lastTestMessage: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    lastTestAt: {
      type: Date,
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
  {
    timestamps: true,
  }
);

MailSettingsSchema.pre('validate', function (next) {
  try {
    this.key = MAIL_SETTINGS_KEY;
    this.provider = normalizeProvider(this.provider);
    this.fromName = normalizeText(this.fromName);
    this.fromEmail = normalizeLower(this.fromEmail);
    this.replyToEmail = normalizeLower(this.replyToEmail);
    this.smtpHost = normalizeLower(this.smtpHost);
    this.smtpUser = normalizeText(this.smtpUser);
    this.smtpSecurity = normalizeSecurity(this.smtpSecurity);
    this.testEmail = normalizeLower(this.testEmail);
    this.lastTestMessage = normalizeText(this.lastTestMessage);

    if (this.provider === 'gmail') {
      this.smtpHost = 'smtp.gmail.com';
      this.smtpPort = 465;
      this.smtpSecurity = 'ssl';
    }

    if (this.provider === 'outlook') {
      this.smtpHost = 'smtp.office365.com';
      this.smtpPort = 587;
      this.smtpSecurity = 'starttls';
    }

    if (this.provider === 'zoho') {
      this.smtpHost = 'smtp.zoho.com';
      this.smtpPort = 465;
      this.smtpSecurity = 'ssl';
    }

    this.hasSmtpPassword = Boolean(this.smtpPasswordEncrypted);

    next();
  } catch (error) {
    next(error);
  }
});

MailSettingsSchema.methods.toSafeObject = function toSafeObject() {
  const settings = this.toObject();

  settings.hasSmtpPassword = Boolean(
    settings.smtpPasswordEncrypted || settings.hasSmtpPassword
  );

  delete settings.smtpPasswordEncrypted;
  delete settings.passwordUpdatedAt;
  delete settings.__v;

  return settings;
};

MailSettingsSchema.statics.getSingleton = async function getSingleton() {
  let settings = await this.findOne({ key: MAIL_SETTINGS_KEY }).select(
    '+smtpPasswordEncrypted +passwordUpdatedAt'
  );

  if (!settings) {
    settings = await this.create({
      key: MAIL_SETTINGS_KEY,
      provider: 'smtp',
      enabled: false,
    });
  }

  return settings;
};

MailSettingsSchema.statics.getProviders = function getProviders() {
  return [...MAIL_PROVIDERS];
};

MailSettingsSchema.statics.getSecurityTypes = function getSecurityTypes() {
  return [...MAIL_SECURITY_TYPES];
};

module.exports = mongoose.model('MailSettings', MailSettingsSchema);