// backend/lib/mail/encryption.js

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const secret = String(process.env.MAIL_ENCRYPTION_KEY || '').trim();

  if (!secret) {
    throw new Error('Falta configurar MAIL_ENCRYPTION_KEY en el archivo .env.');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function encryptText(value) {
  const plainText = String(value || '');

  if (!plainText) {
    return '';
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decryptText(value) {
  const encryptedValue = String(value || '').trim();

  if (!encryptedValue) {
    return '';
  }

  const [version, ivBase64, authTagBase64, encryptedBase64] =
    encryptedValue.split(':');

  if (version !== 'v1' || !ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('El valor cifrado no tiene un formato válido.');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

module.exports = {
  encryptText,
  decryptText,
};