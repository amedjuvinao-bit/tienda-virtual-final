'use strict';

const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ENCRYPTION_VERSION = 'v1';

function getEncryptionSecret() {
  const value = String(
    process.env.ADMIN_2FA_ENCRYPTION_KEY ||
      process.env.INTEGRATIONS_ENCRYPTION_KEY ||
      ''
  ).trim();

  if (value.length < 32) {
    const error = new Error(
      'Configura ADMIN_2FA_ENCRYPTION_KEY con al menos 32 caracteres.'
    );
    error.code = 'ADMIN_2FA_KEY_MISSING';
    throw error;
  }

  return value;
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(getEncryptionSecret()).digest();
}

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');

  let encoded = '';
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, '0');
    encoded += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return encoded;
}

function base32Decode(value) {
  const clean = String(value || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');
  let bits = '';

  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Secreto TOTP inválido.');
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function generateTotp(secret, { time = Date.now(), stepSeconds = 30, digits = 6 } = {}) {
  const counter = Math.floor(Number(time) / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = crypto
    .createHmac('sha1', base32Decode(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const modulus = 10 ** digits;

  return String(binary % modulus).padStart(digits, '0');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function verifyTotp(secret, code, { time = Date.now(), window = 1 } = {}) {
  const normalizedCode = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotp(secret, {
      time: Number(time) + offset * 30 * 1000,
    });
    if (safeEqual(expected, normalizedCode)) return true;
  }

  return false;
}

function encryptTwoFactorSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(secret || ''), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

function decryptTwoFactorSecret(encrypted) {
  const [version, ivValue, tagValue, ciphertextValue, extra] = String(
    encrypted || ''
  ).split(':');

  if (
    version !== ENCRYPTION_VERSION ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue ||
    extra
  ) {
    throw new Error('El secreto 2FA almacenado no tiene un formato válido.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function normalizeRecoveryCode(value) {
  const clean = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return clean.length === 10 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : '';
}

function hashRecoveryCode(value) {
  const normalized = normalizeRecoveryCode(value);
  if (!normalized) return '';
  return crypto
    .createHmac('sha256', getEncryptionKey())
    .update(normalized)
    .digest('hex');
}

function generateRecoveryCodes(count = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = [];

  while (codes.length < count) {
    let raw = '';
    const random = crypto.randomBytes(10);
    for (let index = 0; index < 10; index += 1) {
      raw += alphabet[random[index] % alphabet.length];
    }
    const code = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    if (!codes.includes(code)) codes.push(code);
  }

  return codes;
}

function buildTotpUri({ secret, username, issuer }) {
  const cleanIssuer = String(issuer || 'Tienda Virtual').trim().slice(0, 80);
  const account = String(username || 'admin').trim().slice(0, 160);
  const label = encodeURIComponent(`${cleanIssuer}:${account}`);
  const query = new URLSearchParams({
    secret,
    issuer: cleanIssuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

module.exports = {
  base32Decode,
  base32Encode,
  buildTotpUri,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  generateRecoveryCodes,
  generateTotp,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotp,
};
