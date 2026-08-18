'use strict';

const crypto = require('crypto');

const { env } = require('../../config/env');

const PREFIX = 'shipping:v1';

class ShippingConfigurationSecurityError extends Error {
  constructor(message, code, statusCode = 503) {
    super(message);
    this.name = 'ShippingConfigurationSecurityError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function encryptionConfigured() {
  return Boolean(
    env.integrationsEncryptionKey &&
    env.integrationsEncryptionKey.length >= 32
  );
}

function encryptionKey() {
  if (!encryptionConfigured()) {
    throw new ShippingConfigurationSecurityError(
      'Falta configurar INTEGRATIONS_ENCRYPTION_KEY con al menos 32 caracteres antes de guardar credenciales externas.',
      'SHIPPING_ENCRYPTION_KEY_REQUIRED'
    );
  }
  return crypto
    .createHash('sha256')
    .update(`shipping:${env.integrationsEncryptionKey}`)
    .digest();
}

function isEncryptedShippingSecret(value) {
  return String(value || '').trim().startsWith(`${PREFIX}:`);
}

function encryptShippingSecret(value) {
  const plain = String(value || '');
  if (!plain) return '';
  if (isEncryptedShippingSecret(plain)) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decryptShippingSecret(value) {
  const stored = String(value || '').trim();
  if (!stored) return '';
  if (!isEncryptedShippingSecret(stored)) {
    throw new ShippingConfigurationSecurityError(
      'La credencial de transportadora no está cifrada con el formato vigente.',
      'SHIPPING_SECRET_FORMAT_INVALID',
      500
    );
  }

  const parts = stored.split(':');
  if (
    parts.length !== 5 ||
    parts[0] !== 'shipping' ||
    parts[1] !== 'v1' ||
    !parts[2] ||
    !parts[3] ||
    !parts[4]
  ) {
    throw new ShippingConfigurationSecurityError(
      'La credencial cifrada tiene un formato inválido.',
      'SHIPPING_SECRET_FORMAT_INVALID',
      500
    );
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(parts[2], 'base64')
    );
    decipher.setAuthTag(Buffer.from(parts[3], 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[4], 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    if (error instanceof ShippingConfigurationSecurityError) throw error;
    throw new ShippingConfigurationSecurityError(
      'No fue posible descifrar la credencial de transportadora. Verifica la llave maestra.',
      'SHIPPING_SECRET_DECRYPTION_FAILED'
    );
  }
}

function secretHint(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return `••••${text.slice(-4)}`;
}

module.exports = {
  ShippingConfigurationSecurityError,
  decryptShippingSecret,
  encryptShippingSecret,
  encryptionConfigured,
  isEncryptedShippingSecret,
  secretHint,
};
