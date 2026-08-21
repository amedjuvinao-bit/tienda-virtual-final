// backend/config/env.js
const path = require('path');
const dotenv = require('dotenv');

const envFilePath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envFilePath, quiet: true });

class EnvConfigError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'EnvConfigError';
    this.details = details;
  }
}

function clean(value) {
  return String(value || '').trim();
}

function firstEnv(names = []) {
  for (const name of names) {
    const value = clean(process.env[name]);
    if (value) return { name, value };
  }
  return { name: names[0], value: '' };
}

function toBoolean(value, fallback = false) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return Boolean(fallback);
  if (['1', 'true', 'yes', 'si', 's', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return Boolean(fallback);
}

function toNumber(value, fallback, { min = null, max = null } = {}) {
  const parsed = Number(value);
  let finalValue = Number.isFinite(parsed) ? parsed : fallback;

  if (Number.isFinite(min)) finalValue = Math.max(min, finalValue);
  if (Number.isFinite(max)) finalValue = Math.min(max, finalValue);

  return finalValue;
}

function isValidMongoUri(value) {
  return /^mongodb(\+srv)?:\/\//i.test(clean(value));
}

function maskValue(value = '') {
  const text = clean(value);
  if (!text) return '';
  if (text.length <= 12) return '********';
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

const mongo = firstEnv(['MONGO_URI', 'MONGODB_URI', 'MONGO_URL', 'DATABASE_URL']);
const cloudName = firstEnv([
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_CLOUD',
  'CLOUDINARY_NAME',
  'VITE_CLOUDINARY_CLOUD_NAME',
  'VITE_CLOUDINARY_CLOUD',
]);
const cloudinaryFolder = firstEnv(['CLOUDINARY_FOLDER', 'VITE_CLOUDINARY_FOLDER']);
const cloudinaryUploadPreset = firstEnv(['CLOUDINARY_UPLOAD_PRESET', 'VITE_CLOUDINARY_PRESET']);
const enviaMode = clean(process.env.ENVIA_MODE).toLowerCase();
const integrationsEncryption = firstEnv([
  'INTEGRATIONS_ENCRYPTION_KEY',
  'BILLING_ENCRYPTION_KEY',
]);

const env = {
  nodeEnv: clean(process.env.NODE_ENV) || 'development',
  port: toNumber(process.env.PORT, 5000, { min: 1, max: 65535 }),
  mongoUri: mongo.value,
  mongoUriSource: mongo.name,
  frontendUrl: clean(process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.VITE_FRONTEND_URL),
  backendUrl: clean(process.env.BACKEND_URL || process.env.API_URL || process.env.VITE_BACKEND_URL),
  globalRateLimit: {
    windowMs: toNumber(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, { min: 1_000 }),
    max: toNumber(process.env.GLOBAL_RATE_LIMIT_MAX, 300, { min: 10, max: 100_000 }),
  },
  jwtSecret: clean(process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET),
  cartAccessSecret: clean(process.env.CART_ACCESS_SECRET),
  billingEncryptionKey: clean(process.env.BILLING_ENCRYPTION_KEY),
  integrationsEncryptionKey: integrationsEncryption.value,
  integrationsEncryptionKeySource: integrationsEncryption.value
    ? integrationsEncryption.name
    : '',
  cloudinary: {
    cloudName: cloudName.value,
    cloudNameSource: cloudName.name,
    apiKey: clean(process.env.CLOUDINARY_API_KEY),
    apiSecret: clean(process.env.CLOUDINARY_API_SECRET),
    uploadPreset: cloudinaryUploadPreset.value,
    uploadPresetSource: cloudinaryUploadPreset.name,
    folder: cloudinaryFolder.value || 'tienda_virtual',
    folderSource: cloudinaryFolder.value ? cloudinaryFolder.name : 'default',
  },
  mail: {
    host: clean(process.env.SMTP_HOST || process.env.MAIL_HOST),
    port: toNumber(process.env.SMTP_PORT || process.env.MAIL_PORT, 587, { min: 1, max: 65535 }),
    user: clean(process.env.SMTP_USER || process.env.MAIL_USER),
    pass: clean(process.env.SMTP_PASS || process.env.MAIL_PASS),
    from: clean(process.env.SMTP_FROM || process.env.MAIL_FROM),
  },
  inventoryReservation: {
    enabled: toBoolean(process.env.INVENTORY_RESERVATION_EXPIRATION_ENABLED, true),
    intervalMs: toNumber(process.env.INVENTORY_RESERVATION_EXPIRATION_INTERVAL_MS, 60_000, { min: 30_000 }),
    limit: toNumber(process.env.INVENTORY_RESERVATION_LIMIT || process.env.INVENTORY_RESERVATION_EXPIRATION_LIMIT, 50, { min: 1 }),
  },
  shipping: {
    defaultProvider: clean(process.env.SHIPPING_PROVIDER).toLowerCase() || 'manual',
    envia: {
      mode: enviaMode === 'production'
        ? 'production'
        : 'sandbox',
      token: clean(process.env.ENVIA_TOKEN),
      sandboxWebhookToken: clean(process.env.ENVIA_SANDBOX_WEBHOOK_TOKEN),
      webhookSecret: clean(process.env.ENVIA_WEBHOOK_SECRET),
      timeoutMs: toNumber(process.env.ENVIA_TIMEOUT_MS, 15_000, {
        min: 1_000,
        max: 60_000,
      }),
    },
  },
};

function assertEnv() {
  const errors = [];

  if (!env.mongoUri) {
    errors.push('Falta MONGO_URI en backend/.env. También se aceptan MONGODB_URI, MONGO_URL o DATABASE_URL como alias de compatibilidad.');
  } else if (!isValidMongoUri(env.mongoUri)) {
    errors.push(`La variable ${env.mongoUriSource} no parece una cadena MongoDB válida. Debe iniciar por mongodb:// o mongodb+srv://.`);
  }

  if (env.billingEncryptionKey && env.billingEncryptionKey.length < 32) {
    errors.push('BILLING_ENCRYPTION_KEY debe tener al menos 32 caracteres. No uses contraseñas cortas para cifrar credenciales fiscales.');
  }

  if (
    env.integrationsEncryptionKey &&
    env.integrationsEncryptionKey.length < 32
  ) {
    errors.push('INTEGRATIONS_ENCRYPTION_KEY debe tener al menos 32 caracteres.');
  }

  if (env.cartAccessSecret && env.cartAccessSecret.length < 32) {
    errors.push('CART_ACCESS_SECRET debe tener al menos 32 caracteres.');
  }

  if (
    env.nodeEnv === 'production' &&
    !env.cartAccessSecret
  ) {
    errors.push('Producción requiere CART_ACCESS_SECRET independiente con al menos 32 caracteres.');
  }

  if (!['manual', 'envia'].includes(env.shipping.defaultProvider)) {
    errors.push('SHIPPING_PROVIDER debe ser manual o envia.');
  }

  if (enviaMode && !['sandbox', 'production'].includes(enviaMode)) {
    errors.push('ENVIA_MODE debe ser sandbox o production.');
  }

  if (
    env.shipping.defaultProvider === 'envia' &&
    !env.shipping.envia.token
  ) {
    errors.push('SHIPPING_PROVIDER=envia requiere ENVIA_TOKEN. Usa manual durante el desarrollo sin cuenta externa.');
  }

  if (
    env.nodeEnv === 'production' &&
    env.shipping.defaultProvider === 'envia' &&
    env.shipping.envia.mode !== 'production'
  ) {
    errors.push('Producción no puede usar SHIPPING_PROVIDER=envia con ENVIA_MODE=sandbox.');
  }

  if (errors.length) {
    throw new EnvConfigError(`Configuración de entorno inválida:\n- ${errors.join('\n- ')}`, errors);
  }

  return true;
}

function getSafeEnvSummary() {
  const cloudinaryBackendConfigured = Boolean(
    env.cloudinary.cloudName &&
    env.cloudinary.apiKey &&
    env.cloudinary.apiSecret
  );

  return {
    nodeEnv: env.nodeEnv,
    port: env.port,
    mongo: {
      configured: Boolean(env.mongoUri),
      source: env.mongoUriSource,
      preview: maskValue(env.mongoUri),
    },
    frontendUrlConfigured: Boolean(env.frontendUrl),
    backendUrlConfigured: Boolean(env.backendUrl),
    globalRateLimit: env.globalRateLimit,
    jwtConfigured: Boolean(env.jwtSecret),
    cartAccessSecretConfigured: Boolean(
      env.cartAccessSecret && env.cartAccessSecret.length >= 32
    ),
    billingEncryptionConfigured: Boolean(
      env.billingEncryptionKey && env.billingEncryptionKey.length >= 32
    ),
    integrationsEncryptionConfigured: Boolean(
      env.integrationsEncryptionKey &&
      env.integrationsEncryptionKey.length >= 32
    ),
    integrationsEncryptionKeySource:
      env.integrationsEncryptionKeySource || 'not_configured',
    cloudinary: {
      backendConfigured: cloudinaryBackendConfigured,
      cloudNameConfigured: Boolean(env.cloudinary.cloudName),
      cloudNameSource: env.cloudinary.cloudNameSource,
      apiKeyConfigured: Boolean(env.cloudinary.apiKey),
      apiSecretConfigured: Boolean(env.cloudinary.apiSecret),
      uploadPresetConfigured: Boolean(env.cloudinary.uploadPreset),
      uploadPresetSource: env.cloudinary.uploadPresetSource,
      folder: env.cloudinary.folder,
      folderSource: env.cloudinary.folderSource,
    },
    cloudinaryConfigured: cloudinaryBackendConfigured,
    smtpConfigured: Boolean(env.mail.host && env.mail.user && env.mail.pass),
    inventoryReservation: env.inventoryReservation,
    shipping: {
      defaultProvider: env.shipping.defaultProvider,
      envia: {
        mode: env.shipping.envia.mode,
        configured: Boolean(env.shipping.envia.token),
        webhookConfigured: Boolean(env.shipping.envia.webhookSecret),
      },
    },
  };
}

module.exports = {
  env,
  assertEnv,
  getSafeEnvSummary,
  EnvConfigError,
};
